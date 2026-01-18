import os
import csv
import io
import re
import json
import asyncio
import unicodedata
import logging
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Request, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any, Literal
from decimal import Decimal
import psycopg2
import psycopg2.pool
import pytz
from psycopg2.extras import RealDictCursor, Json
from contextlib import contextmanager
from datetime import datetime, timedelta, date
import jwt
import bcrypt
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables early
load_dotenv('.env.local', override=True)
load_dotenv('.env')

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(
    title="Pem2 Services API",
    description="Job management, inventory tracking, and business operations for Pem2 Services",
    version="1.0.0"
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Custom exception handler to prevent leaking internal error details
from fastapi.responses import JSONResponse
import uuid

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler that logs full errors server-side
    but returns generic messages to clients.
    """
    # Generate a unique error ID for correlation
    error_id = str(uuid.uuid4())[:8]

    # Log the full error server-side
    logger.error(f"Error {error_id}: {type(exc).__name__}: {str(exc)}", exc_info=True)

    # Return generic message to client (with error ID for support)
    return JSONResponse(
        status_code=500,
        content={"detail": f"An internal error occurred. Reference: {error_id}"}
    )

def log_and_raise(e: Exception, context: str = ""):
    """Helper to log errors and raise HTTPException with generic message."""
    error_id = str(uuid.uuid4())[:8]
    logger.error(f"Error {error_id} ({context}): {type(e).__name__}: {str(e)}")
    raise HTTPException(status_code=500, detail=f"Operation failed. Reference: {error_id}")

# Sanitize 500 error messages that might leak internal details
from starlette.exceptions import HTTPException as StarletteHTTPException

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Sanitize 500 errors to not leak internal details."""
    if exc.status_code == 500:
        # Check if the detail looks like an internal error message
        detail = str(exc.detail) if exc.detail else ""
        # List of patterns that indicate internal error leakage
        internal_patterns = [
            "psycopg2", "PostgreSQL", "connection", "cursor", "SQL",
            "Traceback", "File \"", "line ", "Error:", "Exception",
            "duplicate key", "foreign key", "constraint", "violates"
        ]
        if any(pattern.lower() in detail.lower() for pattern in internal_patterns):
            error_id = str(uuid.uuid4())[:8]
            logger.error(f"Sanitized error {error_id}: {detail}")
            return JSONResponse(
                status_code=500,
                content={"detail": f"A database error occurred. Reference: {error_id}"}
            )
    # For non-500 errors or safe messages, pass through
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

# CORS configuration from environment variables
cors_origins_env = os.getenv("CORS_ORIGINS", "http://localhost:3001,https://localhost:3443")
cors_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https?://(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?",  # All private network ranges (http/https, any port)
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
)

# Database connection pool configuration
# ThreadedConnectionPool is thread-safe and suitable for FastAPI/uvicorn
# minconn=5: Minimum connections kept open (for quick response times)
# maxconn=50: Maximum connections (supports 20-30 concurrent users with headroom)
_connection_pool = None

def _get_pool():
    """Get or create the connection pool."""
    global _connection_pool
    if _connection_pool is None:
        db_password = os.getenv("DB_PASSWORD")
        if not db_password:
            raise ValueError("DB_PASSWORD environment variable must be set")
        
        _connection_pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=5,
            maxconn=50,
            dbname=os.getenv("DB_NAME", "ma_electrical"),
            user=os.getenv("DB_USER", "postgres"),
            password=db_password,
            host=os.getenv("DB_HOST", "ma_electrical-db"),
            port=os.getenv("DB_PORT", "5432"),
            cursor_factory=RealDictCursor
        )
        logger.info("Database connection pool initialized (min=5, max=50)")
    return _connection_pool

class PooledConnection:
    """Wrapper that returns connection to pool on close() instead of closing it."""
    def __init__(self, conn, pool):
        self._conn = conn
        self._pool = pool
    
    def cursor(self, *args, **kwargs):
        return self._conn.cursor(*args, **kwargs)
    
    def commit(self):
        return self._conn.commit()
    
    def rollback(self):
        return self._conn.rollback()
    
    def close(self):
        """Return connection to pool instead of closing."""
        try:
            if not self._conn.closed:
                self._conn.rollback()
            self._pool.putconn(self._conn)
        except Exception as e:
            logger.warning(f"Error returning connection to pool: {e}")
    
    @property
    def closed(self):
        return self._conn.closed
    
    def __enter__(self):
        return self
    
    def __exit__(self, *args):
        self.close()

def get_db_connection():
    """Get a connection from the pool wrapped for automatic return."""
    pool = _get_pool()
    conn = pool.getconn()
    return PooledConnection(conn, pool)

@contextmanager
def get_db_cursor():
    """Context manager for database operations - handles connection and cursor lifecycle."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        yield cur
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise
    finally:
        conn.close()

# Auto-undelay jobs whose delay_end_date has passed
def auto_undelay_expired_jobs():
    """
    Check for jobs where delay_end_date has passed and automatically undelay them.
    Called on startup and can be called periodically.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Find jobs where delay has expired (delay_end_date is in the past)
        cur.execute("""
            SELECT id, work_order_number, delay_end_date
            FROM work_orders
            WHERE delay_start_date IS NOT NULL
              AND delay_end_date IS NOT NULL
              AND delay_end_date < CURRENT_DATE
              AND status = 'delayed'
        """)
        expired_delays = cur.fetchall()

        undelayed_count = 0
        for job in expired_delays:
            # Check if job has crew scheduled for future dates
            cur.execute("""
                SELECT COUNT(*) as crew_count
                FROM job_schedule_crew jsc
                JOIN job_schedule_dates jsd ON jsc.job_schedule_date_id = jsd.id
                WHERE jsd.work_order_id = %s AND jsd.scheduled_date >= CURRENT_DATE
            """, (job['id'],))
            crew_count = cur.fetchone()['crew_count']

            new_status = 'scheduled' if crew_count > 0 else 'pending'

            # Clear delay fields and update status
            cur.execute("""
                UPDATE work_orders
                SET status = %s,
                    delay_start_date = NULL,
                    delay_end_date = NULL,
                    last_updated = CURRENT_TIMESTAMP,
                    last_updated_by = 'system'
                WHERE id = %s
            """, (new_status, job['id']))

            # Log activity
            cur.execute("""
                INSERT INTO work_order_activity
                (work_order_id, activity_type, description, performed_by, created_at)
                VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
            """, (
                job['id'],
                'auto_undelay',
                f"Delay automatically removed (delay ended {job['delay_end_date']}). Status set to '{new_status}'",
                'system'
            ))

            undelayed_count += 1
            logger.info(f"Auto-undelayed job {job['work_order_number']} (delay ended {job['delay_end_date']})")

        conn.commit()
        if undelayed_count > 0:
            logger.info(f"Auto-undelayed {undelayed_count} job(s) with expired delays")

    except Exception as e:
        logger.error(f"Error in auto_undelay_expired_jobs: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()


@app.on_event("startup")
async def startup_event():
    """Run tasks on application startup."""
    # Auto-undelay any jobs whose delay period has expired
    try:
        auto_undelay_expired_jobs()
    except Exception as e:
        logger.error(f"Error running auto_undelay on startup: {e}")


# Cleanup pool on shutdown
@app.on_event("shutdown")
async def shutdown_event():
    global _connection_pool
    if _connection_pool:
        _connection_pool.closeall()
        logger.info("Database connection pool closed")

# Initialize database schema on first boot (fresh database only)
def init_db():
    """Initialize a fresh database schema (schema + required migrations)."""
    conn = get_db_connection()
    cur = conn.cursor()

    # Check if tables exist, if not run full schema
    cur.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_name = 'inventory'
        )
    """)
    tables_exist = cur.fetchone()['exists']

    if not tables_exist:
        database_dir = os.path.join(os.path.dirname(__file__), '..', 'database')
        sql_files = [
            "schema_v3_final.sql",
            "migration_add_activity_tracking.sql",
            "migration_multi_worker_dates.sql",
            "migration_add_time_tracking_fixed.sql",
            "migration_schedule_contradictions.sql",
            "migration_add_reporting_views.sql",
            "migration_add_financial_reports_v3.sql",
            "migration_scope_to_tasks.sql",
            "migration_work_order_photos_compat.sql",
            "migration_missing_core_tables.sql",
            "migration_photo_notes.sql",
            "migration_notifications.sql",
            "migration_communication_settings.sql",
            "migration_email_notification_templates.sql",
        ]

        for filename in sql_files:
            sql_path = os.path.join(database_dir, filename)
            if not os.path.exists(sql_path):
                continue
            with open(sql_path, 'r') as f:
                cur.execute(f.read())
                conn.commit()

        print("Database initialized (schema_v3_final.sql + migrations)")

    cur.close()
    conn.close()

# Initialize database
init_db()

# JWT settings
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable must be set")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# Root endpoint
@app.get("/")
async def root():
    return {"message": "Pem2 Services Inventory Backend", "version": "1.0.0"}

# Health check endpoints
@app.get("/health")
async def health_check():
    """Basic health check endpoint"""
    return {"status": "healthy", "service": "pem2-inventory-api"}

@app.get("/api/health")
async def api_health_check():
    """Detailed health check with database connectivity"""
    try:
        # Test database connection
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.close()
        conn.close()

        return {
            "status": "healthy",
            "service": "pem2-inventory-api",
            "database": "connected",
            "version": "1.0.0"
        }
    except Exception as e:
        # Log full error details server-side, return generic message to client
        logger.error(f"Health check failed: {type(e).__name__}: {str(e)}")
        return {
            "status": "unhealthy",
            "service": "pem2-inventory-api",
            "database": "disconnected",
            "error": "Database connection failed"
        }

# ============================================================
# PYDANTIC MODELS
# (Inventory models moved to inventory_endpoints.py)
# ============================================================

# Vendor model moved to vendors_dashboard_endpoints.py
# UserSettings, UserProfileUpdate, PasswordChange models moved to settings_endpoints.py

class JobTaskCreate(BaseModel):
    task_description: str
    task_order: Optional[int] = 0

class JobTaskUpdate(BaseModel):
    task_description: Optional[str] = None
    task_order: Optional[int] = None
    is_completed: Optional[bool] = None

class JobNoteCreate(BaseModel):
    note_text: str
    note_type: Optional[str] = "general"  # general, task, issue, resolution
    related_task_id: Optional[int] = None

# ============================================================
# AUTHENTICATION - Token verification (auth endpoints moved to auth_endpoints.py)
# ============================================================

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception

        # Fetch user details from database
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT role, full_name, email, phone, hire_date,
                   license_number, license_expiration, can_create_quotes, can_close_jobs
            FROM users WHERE username = %s AND active = TRUE
        """, (username,))
        user = cur.fetchone()
        cur.close()
        conn.close()

        if not user:
            raise credentials_exception

        return {
            "username": username,
            "role": user['role'],
            "full_name": user['full_name'],
            "email": user['email'],
            "phone": user['phone'],
            "hire_date": str(user['hire_date']) if user['hire_date'] else None,
            "license_number": user['license_number'],
            "license_expiration": str(user['license_expiration']) if user['license_expiration'] else None,
            "can_create_quotes": user['can_create_quotes'],
            "can_close_jobs": user['can_close_jobs']
        }
    except jwt.PyJWTError:
        raise credentials_exception

# Account lockout configuration (used by auth_endpoints.py)
ACCOUNT_LOCKOUT_ATTEMPTS = int(os.getenv("ACCOUNT_LOCKOUT_ATTEMPTS", "5"))
ACCOUNT_LOCKOUT_MINUTES = int(os.getenv("ACCOUNT_LOCKOUT_MINUTES", "15"))

# Login endpoint moved to auth_endpoints.py

# ============================================================
# ROLE-BASED ACCESS CONTROL
# ============================================================

def require_admin(current_user: dict = Depends(get_current_user)):
    """Dependency that requires admin role"""
    if current_user.get('role') != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user

def require_manager_or_admin(current_user: dict = Depends(get_current_user)):
    """Dependency that requires manager or admin role"""
    if current_user.get('role') not in ['admin', 'manager']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager or admin access required"
        )
    return current_user

def require_admin_or_office(current_user: dict = Depends(get_current_user)):
    """Dependency that requires admin or office role (for invoice access)"""
    if current_user.get('role') not in ['admin', 'office']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or office access required"
        )
    return current_user

def require_admin_access(current_user: dict):
    """Ensure user has admin role only (for Reports, Purchase Orders, etc.)"""
    if current_user['role'] != 'admin':
        raise HTTPException(
            status_code=403,
            detail="Access denied. Admin privileges required."
        )

# User management endpoints moved to auth_endpoints.py
# (login, /users, /admin/users, /admin/managers, /admin/workers, /admin/manager-workers, /manager/my-workers, /user/me)

# Inventory endpoints moved to inventory_endpoints.py

# ============================================================
# SEARCH & FILTERS
# ============================================================

@app.get("/categories")
async def get_categories(current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT category FROM inventory WHERE category IS NOT NULL ORDER BY category")
    categories = [row['category'] for row in cur.fetchall()]
    cur.close()
    conn.close()

    return {"categories": categories}

# CSV import/export endpoints moved to inventory_endpoints.py

# ============================================================
# COMMUNICATION SERVICES (used by multiple modules)
# ============================================================

from communication_service import (
    EmailService, SMSService, SMSGatewayService, encrypt_config, decrypt_config, mask_config,
    log_communication, get_email_template, render_template, TWILIO_AVAILABLE, CARRIER_GATEWAYS,
    get_email_service, SendGridEmailService, SENDGRID_AVAILABLE
)

# Import notification service for sending in-app + email notifications
from notification_service import (
    notify_user, notify_admins_and_managers,
    notify_pto_request_submitted, notify_pto_request_approved, notify_pto_request_denied,
    notify_job_assigned, notify_callout
)

# User settings, profile, password change, and communication settings moved to settings_endpoints.py
# Notification endpoints moved to notifications_endpoints.py
# Purchase order endpoints moved to purchase_orders_endpoints.py
# Vendor and dashboard endpoints moved to vendors_dashboard_endpoints.py
# Reports endpoints moved to reports_endpoints.py


# ============================================================
# QUOTES MODULE REGISTRATION
# ============================================================
from quotes_endpoints import router as quotes_router, init_quotes_module

# Create a wrapper function for authentication that accepts token string directly
async def get_user_from_token(token: str):
    """Get user from token string (for use in quotes module)"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT role, full_name, email, phone, hire_date,
                   license_number, license_expiration, can_create_quotes, can_close_jobs
            FROM users WHERE username = %s AND active = TRUE
        """, (username,))
        user = cur.fetchone()
        cur.close()
        conn.close()

        if not user:
            raise credentials_exception

        return {
            "username": username,
            "role": user['role'],
            "full_name": user['full_name'],
            "email": user['email'],
            "phone": user['phone'],
            "hire_date": str(user['hire_date']) if user['hire_date'] else None,
            "license_number": user['license_number'],
            "license_expiration": str(user['license_expiration']) if user['license_expiration'] else None,
            "can_create_quotes": user['can_create_quotes'],
            "can_close_jobs": user['can_close_jobs']
        }
    except jwt.PyJWTError:
        raise credentials_exception

# Initialize quotes module with db and auth functions
init_quotes_module(get_db_connection, get_user_from_token)

# Register quotes router
app.include_router(quotes_router)


# ============================================================
# AUTH MODULE REGISTRATION
# ============================================================
from auth_endpoints import router as auth_router, init_auth_module

# Initialize auth module with dependencies
init_auth_module(
    db_func=get_db_connection,
    auth_func=get_user_from_token,
    log_raise_func=log_and_raise,
    secret_key=SECRET_KEY,
    algorithm=ALGORITHM,
    token_expire_minutes=ACCESS_TOKEN_EXPIRE_MINUTES,
    lockout_attempts=ACCOUNT_LOCKOUT_ATTEMPTS,
    lockout_minutes=ACCOUNT_LOCKOUT_MINUTES
)

# Register auth router
app.include_router(auth_router)


# ============================================================
# INVENTORY MODULE REGISTRATION
# ============================================================
from inventory_endpoints import router as inventory_router, init_inventory_module

# Initialize inventory module with dependencies
init_inventory_module(
    db_func=get_db_connection,
    auth_func=get_user_from_token,
    log_raise_func=log_and_raise,
    require_mgr_admin_func=require_manager_or_admin,
    require_admin_func=require_admin_access
)

# Register inventory router
app.include_router(inventory_router)


# ============================================================
# VAN INVENTORY MODULE REGISTRATION
# ============================================================
from van_endpoints import router as van_router, init_van_module

# Initialize van module with dependencies
init_van_module(
    db_func=get_db_connection,
    auth_func=get_user_from_token,
    log_raise_func=log_and_raise
)

# Register van router
app.include_router(van_router)


# ============================================================
# WORK ORDER MODULE REGISTRATION
# ============================================================
from workorder_endpoints import router as workorder_router, init_workorder_module

# Initialize work order module with dependencies
init_workorder_module(
    get_db_func=get_db_connection,
    get_user_func=get_user_from_token,
    log_raise_func=log_and_raise
)

# Register work order router
app.include_router(workorder_router)


# ============================================================
# SCHEDULE MODULE REGISTRATION
# ============================================================
from schedule_endpoints import router as schedule_router, init_schedule_module

# Initialize schedule module with dependencies
init_schedule_module(
    db_func=get_db_connection,
    auth_func=get_user_from_token,
    log_raise_func=log_and_raise,
    notify_callout_func=notify_callout,
    notify_pto_submitted_func=notify_pto_request_submitted,
    notify_pto_approved_func=notify_pto_request_approved,
    notify_pto_denied_func=notify_pto_request_denied
)

# Register schedule router
app.include_router(schedule_router)


# ============================================================
# INVOICE MODULE REGISTRATION
# ============================================================
from invoice_endpoints import router as invoice_router, init_invoice_module

# Initialize invoice module with dependencies
init_invoice_module(
    db_func=get_db_connection,
    auth_func=get_user_from_token,
    log_raise_func=log_and_raise
)

# Register invoice router
app.include_router(invoice_router)


# ============================================================
# TIME ENTRY MODULE REGISTRATION
# ============================================================
from time_endpoints import router as time_router, init_time_module

# Initialize time entry module with dependencies
init_time_module(
    db_func=get_db_connection,
    auth_func=get_user_from_token,
    log_raise_func=log_and_raise
)

# Register time entry router
app.include_router(time_router)


# ============================================================
# SETTINGS MODULE REGISTRATION
# ============================================================
from settings_endpoints import router as settings_router, init_settings_module

# Initialize settings module with dependencies
init_settings_module(
    db_func=get_db_connection,
    auth_func=get_current_user,
    limiter=limiter,
    communication_imports={
        'EmailService': EmailService,
        'SMSService': SMSService,
        'SMSGatewayService': SMSGatewayService,
        'SendGridEmailService': SendGridEmailService,
        'encrypt_config': encrypt_config,
        'decrypt_config': decrypt_config,
        'mask_config': mask_config,
        'log_communication': log_communication,
        'get_email_template': get_email_template,
        'render_template': render_template,
        'get_email_service': get_email_service,
        'TWILIO_AVAILABLE': TWILIO_AVAILABLE,
        'SENDGRID_AVAILABLE': SENDGRID_AVAILABLE,
        'CARRIER_GATEWAYS': CARRIER_GATEWAYS
    }
)

# Register settings router
app.include_router(settings_router)

# ============================================================
# NOTIFICATIONS MODULE REGISTRATION
# ============================================================
from notifications_endpoints import router as notifications_router, init_notifications_module

# Initialize notifications module with dependencies
init_notifications_module(
    db_func=get_db_connection,
    auth_func=get_current_user
)

# Register notifications router
app.include_router(notifications_router)

# ============================================================
# PURCHASE ORDERS MODULE REGISTRATION
# ============================================================
from purchase_orders_endpoints import router as purchase_orders_router, init_purchase_orders_module

# Initialize purchase orders module with dependencies
init_purchase_orders_module(
    db_func=get_db_connection,
    auth_func=get_current_user,
    log_raise_func=log_and_raise
)

# Register purchase orders router
app.include_router(purchase_orders_router)

# ============================================================
# VENDORS & DASHBOARD MODULE REGISTRATION
# ============================================================
from vendors_dashboard_endpoints import router as vendors_dashboard_router, init_vendors_dashboard_module

# Initialize vendors/dashboard module with dependencies
init_vendors_dashboard_module(
    db_func=get_db_connection,
    auth_func=get_current_user
)

# Register vendors/dashboard router
app.include_router(vendors_dashboard_router)

# ============================================================
# REPORTS MODULE REGISTRATION
# ============================================================
from reports_endpoints import router as reports_router, init_reports_module

# Initialize reports module with dependencies
init_reports_module(
    db_func=get_db_connection,
    auth_func=get_current_user,
    log_raise_func=log_and_raise
)

# Register reports router
app.include_router(reports_router)

# ============================================================
# CUSTOMERS MODULE
# ============================================================
from customers_endpoints import router as customers_router, init_customers_module

# Initialize customers module with dependencies
init_customers_module(
    db_func=get_db_connection,
    auth_func=get_current_user
)

# Register customers router
app.include_router(customers_router)
