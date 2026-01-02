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
    title="MA Electrical Inventory API",
    description="Job management, inventory tracking, and business operations for MA Electrical",
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
        return {
            "status": "unhealthy",
            "service": "pem2-inventory-api",
            "database": "disconnected",
            "error": str(e)
        }

# ============================================================
# PYDANTIC MODELS
# ============================================================

class InventoryItem(BaseModel):
    # ============================================================
    # IDENTIFICATION (6 fields) - item_id, brand, description are REQUIRED
    # ============================================================
    item_id: str
    sku: Optional[str] = None
    brand: str
    upc: Optional[str] = None
    manufacturer_part_number: Optional[str] = None
    description: str

    # ============================================================
    # CATEGORY & CLASSIFICATION (2 fields)
    # ============================================================
    category: str
    subcategory: Optional[str] = None

    # ============================================================
    # PRICING (6 fields) - cost and sell_price are REQUIRED
    # ============================================================
    cost: Decimal
    list_price: Optional[Decimal] = None
    contractor_price: Optional[Decimal] = None
    markup_percent: Optional[Decimal] = Decimal("35.00")
    sell_price: Decimal
    discount_price: Optional[Decimal] = None

    # ============================================================
    # INVENTORY MANAGEMENT (10 fields) - qty, min_stock, location REQUIRED
    # ============================================================
    qty: int
    qty_allocated: Optional[int] = 0
    # qty_available is computed in DB - don't allow setting it
    qty_on_order: Optional[int] = 0
    min_stock: int
    reorder_qty: Optional[int] = 0
    max_stock: Optional[int] = 0
    location: str
    bin_location: Optional[str] = None
    last_counted_date: Optional[date] = None
    count_variance: Optional[int] = 0

    # ============================================================
    # PHYSICAL PROPERTIES (5 fields)
    # ============================================================
    qty_per: Optional[str] = "Each"
    package_quantity: Optional[int] = None
    weight_lbs: Optional[Decimal] = None
    length_inches: Optional[Decimal] = None
    dimensions: Optional[str] = None

    # ============================================================
    # ELECTRICAL SPECIFICATIONS (10 fields)
    # ============================================================
    voltage: Optional[str] = None
    amperage: Optional[str] = None
    wire_gauge: Optional[str] = None
    wire_type: Optional[str] = None
    num_poles: Optional[int] = None
    phase: Optional[str] = None
    wire_insulation: Optional[str] = None
    wire_stranding: Optional[str] = None
    conduit_compatible: Optional[str] = None
    indoor_outdoor: Optional[str] = None
    wet_location_rated: Optional[bool] = False

    # ============================================================
    # COMPLIANCE & CERTIFICATIONS (7 fields)
    # ============================================================
    ma_code_ref: Optional[str] = None
    nec_ref: Optional[str] = None
    ul_listed: Optional[bool] = False
    certifications: Optional[str] = None
    arc_fault_required: Optional[bool] = False
    gfci_required: Optional[bool] = False
    tamper_resistant: Optional[bool] = False

    # ============================================================
    # SUPPLY CHAIN (9 fields)
    # ============================================================
    primary_vendor_id: Optional[int] = None
    alternate_vendor_id: Optional[int] = None
    vendor_part_number: Optional[str] = None
    lead_time_days: Optional[int] = 0
    last_order_date: Optional[date] = None
    last_order_cost: Optional[Decimal] = None
    last_order_vendor_id: Optional[int] = None
    discontinued: Optional[bool] = False
    replacement_item_id: Optional[str] = None

    # ============================================================
    # MEDIA & DOCUMENTATION (6 fields)
    # ============================================================
    image_url: Optional[str] = None
    image_urls: Optional[List[str]] = None
    datasheet_pdf: Optional[str] = None
    installation_guide: Optional[str] = None
    video_url: Optional[str] = None
    qr_code: Optional[str] = None

    # ============================================================
    # USAGE & ANALYTICS (5 fields)
    # ============================================================
    commonly_used: Optional[bool] = False
    last_used_date: Optional[date] = None
    times_used: Optional[int] = 0
    usage_frequency: Optional[str] = None
    seasonal_item: Optional[bool] = False

    # ============================================================
    # BUSINESS & FINANCIAL (4 fields)
    # ============================================================
    taxable: Optional[bool] = True
    serialized: Optional[bool] = False
    warranty_months: Optional[int] = 0
    returnable: Optional[bool] = True

    # ============================================================
    # METADATA (6 fields)
    # ============================================================
    notes: Optional[str] = None
    estimation_guide: Optional[str] = None
    hazmat: Optional[bool] = False
    active: Optional[bool] = True
    created_by: Optional[str] = None
    # date_added and last_updated are auto-set by DB

class InventoryItemUpdate(BaseModel):
    # All fields optional for PATCH updates
    # Identification
    item_id: Optional[str] = None
    sku: Optional[str] = None
    brand: Optional[str] = None
    upc: Optional[str] = None
    manufacturer_part_number: Optional[str] = None
    description: Optional[str] = None

    # Category
    category: Optional[str] = None
    subcategory: Optional[str] = None

    # Pricing
    cost: Optional[Decimal] = None
    list_price: Optional[Decimal] = None
    contractor_price: Optional[Decimal] = None
    markup_percent: Optional[Decimal] = None
    sell_price: Optional[Decimal] = None
    discount_price: Optional[Decimal] = None

    # Inventory Management (note: qty_available is read-only, computed)
    qty: Optional[int] = None
    qty_allocated: Optional[int] = None
    qty_on_order: Optional[int] = None
    min_stock: Optional[int] = None
    reorder_qty: Optional[int] = None
    max_stock: Optional[int] = None
    location: Optional[str] = None
    bin_location: Optional[str] = None
    last_counted_date: Optional[date] = None
    count_variance: Optional[int] = None

    # Physical Properties
    qty_per: Optional[str] = None
    package_quantity: Optional[int] = None
    weight_lbs: Optional[Decimal] = None
    length_inches: Optional[Decimal] = None
    dimensions: Optional[str] = None

    # Electrical Specifications
    voltage: Optional[str] = None
    amperage: Optional[str] = None
    wire_gauge: Optional[str] = None
    wire_type: Optional[str] = None
    num_poles: Optional[int] = None
    phase: Optional[str] = None
    wire_insulation: Optional[str] = None
    wire_stranding: Optional[str] = None
    conduit_compatible: Optional[str] = None
    indoor_outdoor: Optional[str] = None
    wet_location_rated: Optional[bool] = None

    # Compliance & Certifications
    ma_code_ref: Optional[str] = None
    nec_ref: Optional[str] = None
    ul_listed: Optional[bool] = None
    certifications: Optional[str] = None
    arc_fault_required: Optional[bool] = None
    gfci_required: Optional[bool] = None
    tamper_resistant: Optional[bool] = None

    # Supply Chain
    primary_vendor_id: Optional[int] = None
    alternate_vendor_id: Optional[int] = None
    vendor_part_number: Optional[str] = None
    lead_time_days: Optional[int] = None
    last_order_date: Optional[date] = None
    last_order_cost: Optional[Decimal] = None
    last_order_vendor_id: Optional[int] = None
    discontinued: Optional[bool] = None
    replacement_item_id: Optional[str] = None

    # Media & Documentation
    image_url: Optional[str] = None
    image_urls: Optional[List[str]] = None
    datasheet_pdf: Optional[str] = None
    installation_guide: Optional[str] = None
    video_url: Optional[str] = None
    qr_code: Optional[str] = None

    # Usage & Analytics
    commonly_used: Optional[bool] = None
    last_used_date: Optional[date] = None
    times_used: Optional[int] = None
    usage_frequency: Optional[str] = None
    seasonal_item: Optional[bool] = None

    # Business & Financial
    taxable: Optional[bool] = None
    serialized: Optional[bool] = None
    warranty_months: Optional[int] = None
    returnable: Optional[bool] = None

    # Metadata
    notes: Optional[str] = None
    estimation_guide: Optional[str] = None
    hazmat: Optional[bool] = None
    active: Optional[bool] = None
    created_by: Optional[str] = None

class StockAdjustment(BaseModel):
    quantity_change: int  # Can be positive or negative
    reason: str

class Vendor(BaseModel):
    id: Optional[int] = None
    vendor_name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = "MA"
    zip: Optional[str] = None
    account_number: Optional[str] = None
    payment_terms: Optional[str] = "Net 30"
    discount_percent: Optional[Decimal] = Decimal("0.00")
    tax_id: Optional[str] = None
    preferred: Optional[bool] = False
    delivery_available: Optional[bool] = True
    will_call_available: Optional[bool] = True
    online_ordering: Optional[bool] = False
    average_lead_time_days: Optional[int] = 2
    reliability_rating: Optional[int] = None
    active: Optional[bool] = True
    notes: Optional[str] = None

class UserSettings(BaseModel):
    theme: Optional[str] = "light"
    textScale: Optional[float] = 1.0
    columnVisibility: Optional[dict] = {}
    default_page: Optional[str] = "/home"

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    license_number: Optional[str] = None
    license_expiration: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)
    
    @validator('new_password')
    def validate_password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        return v

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

class TimeEntryCreate(BaseModel):
    work_order_id: Optional[int] = None
    work_date: date
    hours_worked: Decimal
    notes: Optional[str] = None
    break_minutes: Optional[int] = 0
    time_type: Optional[str] = 'job'  # job, shop, office, training, travel, meeting, other

class TimeEntryUpdate(BaseModel):
    hours_worked: Optional[Decimal] = None
    notes: Optional[str] = None
    break_minutes: Optional[int] = None
    time_type: Optional[str] = None

class TimeEntryBatchCreate(BaseModel):
    entries: List[Dict[str, Any]]  # List of {work_order_id, hours_worked, notes, time_type}
    work_date: date

# ============================================================
# AUTHENTICATION
# ============================================================

def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def hash_password(plain_password):
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(plain_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

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

# Account lockout configuration
ACCOUNT_LOCKOUT_ATTEMPTS = int(os.getenv("ACCOUNT_LOCKOUT_ATTEMPTS", "5"))
ACCOUNT_LOCKOUT_MINUTES = int(os.getenv("ACCOUNT_LOCKOUT_MINUTES", "15"))


@app.post("/login")
@limiter.limit("5/minute")  # Max 5 login attempts per minute per IP
async def login_for_access_token(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    conn = get_db_connection()
    cur = conn.cursor()

    # Get client info for logging
    client_ip = get_remote_address(request)
    user_agent = request.headers.get("User-Agent", "")[:500]  # Limit length

    # Check if account exists (don't filter by active yet - we need to check lockout first)
    cur.execute("""
        SELECT username, password, role, active, failed_login_attempts, locked_until
        FROM users WHERE username = %s
    """, (form_data.username,))
    user = cur.fetchone()

    # SECURITY: Check if account is locked
    if user and user.get('locked_until'):
        locked_until = user['locked_until']
        if locked_until > datetime.now():
            # Account is still locked
            remaining_minutes = int((locked_until - datetime.now()).total_seconds() / 60) + 1
            cur.close()
            conn.close()
            logger.warning(f"Login attempt for locked account: {form_data.username} from {client_ip}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Account is temporarily locked. Try again in {remaining_minutes} minute(s).",
                headers={"WWW-Authenticate": "Bearer"},
            )
        else:
            # Lock has expired, reset it
            cur.execute("""
                UPDATE users SET locked_until = NULL, failed_login_attempts = 0
                WHERE username = %s
            """, (form_data.username,))
            conn.commit()

    # Check if user is inactive
    if user and not user.get('active', True):
        cur.close()
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is deactivated. Contact administrator.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Validate credentials
    if not user or not verify_password(form_data.password, user["password"]):
        # Record failed attempt
        if user:
            failed_attempts = (user.get('failed_login_attempts') or 0) + 1

            # Check if we should lock the account
            if failed_attempts >= ACCOUNT_LOCKOUT_ATTEMPTS:
                lock_until = datetime.now() + timedelta(minutes=ACCOUNT_LOCKOUT_MINUTES)
                cur.execute("""
                    UPDATE users SET
                        failed_login_attempts = %s,
                        locked_until = %s
                    WHERE username = %s
                """, (failed_attempts, lock_until, form_data.username))
                logger.warning(f"Account locked due to {failed_attempts} failed attempts: {form_data.username} from {client_ip}")
            else:
                cur.execute("""
                    UPDATE users SET
                        failed_login_attempts = %s
                    WHERE username = %s
                """, (failed_attempts, form_data.username))

            conn.commit()

            # Log the failed attempt (best effort - don't fail login if table doesn't exist)
            try:
                cur.execute("""
                    INSERT INTO login_attempts (username, ip_address, success, user_agent, failure_reason)
                    VALUES (%s, %s, FALSE, %s, 'Invalid password')
                """, (form_data.username, client_ip, user_agent))
                conn.commit()
            except Exception:
                pass  # Table may not exist yet

        cur.close()
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Successful login - reset failed attempts
    cur.execute("""
        UPDATE users SET failed_login_attempts = 0, locked_until = NULL
        WHERE username = %s
    """, (form_data.username,))

    # Log successful login (best effort)
    try:
        cur.execute("""
            INSERT INTO login_attempts (username, ip_address, success, user_agent)
            VALUES (%s, %s, TRUE, %s)
        """, (form_data.username, client_ip, user_agent))
    except Exception:
        pass  # Table may not exist yet

    conn.commit()
    cur.close()
    conn.close()

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"]}, expires_delta=access_token_expires
    )

    logger.info(f"Successful login: {user['username']} from {client_ip}")
    return {"access_token": access_token, "token_type": "bearer", "username": user["username"], "role": user["role"]}

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

# ============================================================
# ADMIN USER MANAGEMENT ROUTES
# ============================================================

# Valid user roles
VALID_ROLES = Literal['admin', 'manager', 'office', 'technician', 'warehouse']

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    role: VALID_ROLES = "technician"
    
    @validator('password')
    def validate_password_strength(cls, v):
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        return v
    
    @validator('email')
    def validate_email_format(cls, v):
        if v and '@' not in v:
            raise ValueError('Invalid email format')
        return v
    hourly_rate: Optional[float] = 0.00
    overtime_rate: Optional[float] = None
    is_licensed: Optional[bool] = False
    license_number: Optional[str] = None
    license_state: Optional[str] = None
    license_expiration: Optional[str] = None
    hire_date: Optional[str] = None
    employment_type: Optional[str] = "full-time"
    active: Optional[bool] = True
    can_create_quotes: Optional[bool] = False
    can_close_jobs: Optional[bool] = False
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    ssn_last_4: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None

class UserUpdate(BaseModel):
    password: Optional[str] = Field(None, min_length=8)
    full_name: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    role: Optional[VALID_ROLES] = None
    
    @validator('password')
    def validate_password_strength(cls, v):
        if v is None:
            return v
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        return v
    
    @validator('email')
    def validate_email_format(cls, v):
        if v and '@' not in v:
            raise ValueError('Invalid email format')
        return v
    hourly_rate: Optional[float] = None
    overtime_rate: Optional[float] = None
    is_licensed: Optional[bool] = None
    license_number: Optional[str] = None
    license_state: Optional[str] = None
    license_expiration: Optional[str] = None
    hire_date: Optional[str] = None
    employment_type: Optional[str] = None
    active: Optional[bool] = None
    can_create_quotes: Optional[bool] = None
    can_close_jobs: Optional[bool] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    ssn_last_4: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None

@app.get("/users")
async def list_users_public(current_user: dict = Depends(get_current_user)):
    """Get list of active users (for dispatch/assignment) - available to all authenticated users"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT username, full_name, role, active
        FROM users
        WHERE active = true
        ORDER BY full_name, username
    """)
    users = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(user) for user in users]

@app.get("/admin/users")
async def list_users(
    current_user: dict = Depends(require_admin),
    limit: int = 100,
    offset: int = 0,
    search: Optional[str] = None,
    role: Optional[str] = None,
    active_only: bool = False
):
    """Get all users with pagination (admin only)"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    where_clauses = []
    params = []

    if active_only:
        where_clauses.append("active = TRUE")

    if role:
        where_clauses.append("role = %s")
        params.append(role)

    if search:
        where_clauses.append("(username ILIKE %s OR full_name ILIKE %s OR email ILIKE %s)")
        search_param = f"%{search}%"
        params.extend([search_param, search_param, search_param])

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    # Get total count
    cur.execute(f"SELECT COUNT(*) as total FROM users {where_sql}", params)
    total = cur.fetchone()['total']

    # Get paginated results
    params.extend([limit, offset])
    cur.execute(f"""
        SELECT username, full_name, email, phone, role, active, created_at,
               hourly_rate, overtime_rate, is_licensed, license_number,
               license_state, license_expiration, hire_date, employment_type,
               can_create_quotes, can_close_jobs, address, city, state, zip,
               emergency_contact_name, emergency_contact_phone
        FROM users {where_sql}
        ORDER BY username
        LIMIT %s OFFSET %s
    """, params)
    users = cur.fetchall()
    cur.close()
    conn.close()
    return {
        "users": [dict(user) for user in users],
        "total": total,
        "limit": limit,
        "offset": offset
    }

@app.post("/admin/users")
@limiter.limit("10/minute")  # Limit user creation to prevent abuse
async def create_user(request: Request, user: UserCreate, current_user: dict = Depends(require_admin)):
    """Create a new user (admin only)"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Check if user already exists
    cur.execute("SELECT username FROM users WHERE username = %s", (user.username,))
    if cur.fetchone():
        cur.close()
        conn.close()
        raise HTTPException(status_code=400, detail="Username already exists")

    # Hash password
    hashed_password = hash_password(user.password)

    # Calculate overtime rate if not provided (1.5x hourly)
    overtime_rate = user.overtime_rate if user.overtime_rate is not None else (user.hourly_rate * 1.5 if user.hourly_rate else 0)

    try:
        cur.execute("""
            INSERT INTO users (
                username, password, full_name, email, phone, role,
                hourly_rate, overtime_rate, is_licensed, license_number,
                license_state, license_expiration, hire_date, employment_type,
                active, can_create_quotes, can_close_jobs, address, city, state, zip,
                ssn_last_4, emergency_contact_name, emergency_contact_phone
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING username, full_name, email, phone, role, active, created_at,
                      hourly_rate, overtime_rate, is_licensed, license_number,
                      license_state, license_expiration, hire_date, employment_type,
                      can_create_quotes, can_close_jobs
        """, (
            user.username, hashed_password, user.full_name, user.email, user.phone, user.role,
            user.hourly_rate, overtime_rate, user.is_licensed, user.license_number,
            user.license_state, user.license_expiration, user.hire_date, user.employment_type,
            user.active, user.can_create_quotes, user.can_close_jobs, user.address, user.city,
            user.state, user.zip, user.ssn_last_4, user.emergency_contact_name, user.emergency_contact_phone
        ))
        new_user = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return dict(new_user)
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)

@app.put("/admin/users/{username}")
async def update_user(
    username: str,
    user_update: UserUpdate,
    current_user: dict = Depends(require_admin)
):
    """Update a user (admin only)"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Check if user exists
    cur.execute("SELECT username FROM users WHERE username = %s", (username,))
    if not cur.fetchone():
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")

    # Build update query
    update_fields = []
    values = []

    field_mappings = {
        'password': (hash_password(user_update.password) if user_update.password else None, user_update.password is not None),
        'full_name': (user_update.full_name, user_update.full_name is not None),
        'email': (user_update.email, user_update.email is not None),
        'phone': (user_update.phone, user_update.phone is not None),
        'role': (user_update.role, user_update.role is not None),
        'hourly_rate': (user_update.hourly_rate, user_update.hourly_rate is not None),
        'overtime_rate': (user_update.overtime_rate, user_update.overtime_rate is not None),
        'is_licensed': (user_update.is_licensed, user_update.is_licensed is not None),
        'license_number': (user_update.license_number, user_update.license_number is not None),
        'license_state': (user_update.license_state, user_update.license_state is not None),
        'license_expiration': (user_update.license_expiration, user_update.license_expiration is not None),
        'hire_date': (user_update.hire_date, user_update.hire_date is not None),
        'employment_type': (user_update.employment_type, user_update.employment_type is not None),
        'active': (user_update.active, user_update.active is not None),
        'can_create_quotes': (user_update.can_create_quotes, user_update.can_create_quotes is not None),
        'can_close_jobs': (user_update.can_close_jobs, user_update.can_close_jobs is not None),
        'address': (user_update.address, user_update.address is not None),
        'city': (user_update.city, user_update.city is not None),
        'state': (user_update.state, user_update.state is not None),
        'zip': (user_update.zip, user_update.zip is not None),
        'ssn_last_4': (user_update.ssn_last_4, user_update.ssn_last_4 is not None),
        'emergency_contact_name': (user_update.emergency_contact_name, user_update.emergency_contact_name is not None),
        'emergency_contact_phone': (user_update.emergency_contact_phone, user_update.emergency_contact_phone is not None),
    }

    for field, (value, should_update) in field_mappings.items():
        if should_update:
            update_fields.append(f"{field} = %s")
            values.append(value)

    if not update_fields:
        cur.close()
        conn.close()
        return {"message": "No fields to update"}

    values.append(username)
    query = f"""UPDATE users SET {', '.join(update_fields)} WHERE username = %s
                RETURNING username, full_name, email, phone, role, active,
                          hourly_rate, overtime_rate, is_licensed, license_number,
                          license_state, license_expiration, hire_date, employment_type,
                          can_create_quotes, can_close_jobs"""

    try:
        cur.execute(query, values)
        updated_user = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return dict(updated_user)
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)

@app.delete("/admin/users/{username}")
async def delete_user(username: str, current_user: dict = Depends(require_admin)):
    """Soft delete a user (admin only)"""
    conn = get_db_connection()
    cur = conn.cursor()

    # Don't allow deleting yourself
    if username == current_user['username']:
        cur.close()
        conn.close()
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    try:
        cur.execute("UPDATE users SET active = FALSE WHERE username = %s", (username,))
        if cur.rowcount == 0:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="User not found")

        conn.commit()
        cur.close()
        conn.close()
        return {"message": f"User {username} deactivated"}
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)

# ============================================================
# MANAGER-WORKER ASSIGNMENTS (Admin only)
# ============================================================

@app.get("/admin/managers")
async def list_managers(current_user: dict = Depends(require_admin)):
    """Get all users with manager role"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT username, full_name, email, phone
        FROM users
        WHERE role = 'manager' AND active = true
        ORDER BY full_name, username
    """)
    managers = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(m) for m in managers]

@app.get("/admin/workers")
async def list_workers(current_user: dict = Depends(require_admin)):
    """Get all users who can be assigned to managers (technicians, employees, office)"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT username, full_name, email, phone, role
        FROM users
        WHERE role IN ('technician', 'employee', 'office') AND active = true
        ORDER BY full_name, username
    """)
    workers = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(w) for w in workers]

@app.get("/admin/manager-workers")
async def list_all_manager_worker_assignments(current_user: dict = Depends(require_admin)):
    """Get all manager-worker assignments"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT
            mw.id,
            mw.manager_username,
            m.full_name as manager_name,
            mw.worker_username,
            w.full_name as worker_name,
            w.role as worker_role,
            mw.assigned_at,
            mw.assigned_by,
            mw.notes,
            mw.active
        FROM manager_workers mw
        JOIN users m ON mw.manager_username = m.username
        JOIN users w ON mw.worker_username = w.username
        WHERE mw.active = true
        ORDER BY m.full_name, w.full_name
    """)
    assignments = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(a) for a in assignments]

@app.get("/admin/manager-workers/{manager_username}")
async def get_manager_workers(
    manager_username: str,
    current_user: dict = Depends(require_admin)
):
    """Get all workers assigned to a specific manager"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Verify manager exists and is a manager
    cur.execute("SELECT role FROM users WHERE username = %s AND active = true", (manager_username,))
    user = cur.fetchone()
    if not user:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Manager not found")
    if user['role'] != 'manager':
        cur.close()
        conn.close()
        raise HTTPException(status_code=400, detail="User is not a manager")

    cur.execute("""
        SELECT
            mw.id,
            mw.worker_username,
            u.full_name as worker_name,
            u.role as worker_role,
            u.phone,
            u.email,
            mw.assigned_at,
            mw.notes
        FROM manager_workers mw
        JOIN users u ON mw.worker_username = u.username
        WHERE mw.manager_username = %s AND mw.active = true
        ORDER BY u.full_name
    """, (manager_username,))
    workers = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(w) for w in workers]

@app.post("/admin/manager-workers")
async def assign_worker_to_manager(
    assignment: dict,
    current_user: dict = Depends(require_admin)
):
    """Assign a worker to a manager"""
    manager_username = assignment.get('manager_username')
    worker_username = assignment.get('worker_username')
    notes = assignment.get('notes', '')

    if not manager_username or not worker_username:
        raise HTTPException(status_code=400, detail="manager_username and worker_username are required")

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Verify manager exists and is a manager
    cur.execute("SELECT role FROM users WHERE username = %s AND active = true", (manager_username,))
    manager = cur.fetchone()
    if not manager:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Manager not found")
    if manager['role'] != 'manager':
        cur.close()
        conn.close()
        raise HTTPException(status_code=400, detail="User is not a manager")

    # Verify worker exists
    cur.execute("SELECT role FROM users WHERE username = %s AND active = true", (worker_username,))
    worker = cur.fetchone()
    if not worker:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Worker not found")

    try:
        # Check if assignment already exists (active or inactive)
        cur.execute("""
            SELECT id, active FROM manager_workers
            WHERE manager_username = %s AND worker_username = %s
        """, (manager_username, worker_username))
        existing = cur.fetchone()

        if existing:
            if existing['active']:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail="Worker already assigned to this manager")
            else:
                # Reactivate the assignment
                cur.execute("""
                    UPDATE manager_workers
                    SET active = true, assigned_at = CURRENT_TIMESTAMP,
                        assigned_by = %s, notes = %s
                    WHERE id = %s
                    RETURNING id
                """, (current_user['username'], notes, existing['id']))
        else:
            # Create new assignment
            cur.execute("""
                INSERT INTO manager_workers (manager_username, worker_username, assigned_by, notes)
                VALUES (%s, %s, %s, %s)
                RETURNING id
            """, (manager_username, worker_username, current_user['username'], notes))

        result = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return {"message": "Worker assigned to manager", "id": result['id']}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)

@app.delete("/admin/manager-workers/{assignment_id}")
async def remove_worker_from_manager(
    assignment_id: int,
    current_user: dict = Depends(require_admin)
):
    """Remove a worker assignment from a manager"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            UPDATE manager_workers SET active = false
            WHERE id = %s AND active = true
        """, (assignment_id,))

        if cur.rowcount == 0:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Assignment not found")

        conn.commit()
        cur.close()
        conn.close()
        return {"message": "Worker removed from manager"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)

@app.put("/admin/manager-workers/bulk/{manager_username}")
async def bulk_assign_workers_to_manager(
    manager_username: str,
    worker_usernames: List[str] = Body(...),
    current_user: dict = Depends(require_admin)
):
    """Bulk assign workers to a manager (replaces all current assignments)"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Verify manager exists and is a manager
    cur.execute("SELECT role FROM users WHERE username = %s AND active = true", (manager_username,))
    manager = cur.fetchone()
    if not manager:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Manager not found")
    if manager['role'] != 'manager':
        cur.close()
        conn.close()
        raise HTTPException(status_code=400, detail="User is not a manager")

    try:
        # Deactivate all current assignments for this manager
        cur.execute("""
            UPDATE manager_workers SET active = false
            WHERE manager_username = %s AND active = true
        """, (manager_username,))

        # Add new assignments
        for worker_username in worker_usernames:
            # Check if assignment exists (reactivate) or create new
            cur.execute("""
                SELECT id FROM manager_workers
                WHERE manager_username = %s AND worker_username = %s
            """, (manager_username, worker_username))
            existing = cur.fetchone()

            if existing:
                cur.execute("""
                    UPDATE manager_workers
                    SET active = true, assigned_at = CURRENT_TIMESTAMP, assigned_by = %s
                    WHERE id = %s
                """, (current_user['username'], existing['id']))
            else:
                cur.execute("""
                    INSERT INTO manager_workers (manager_username, worker_username, assigned_by)
                    VALUES (%s, %s, %s)
                """, (manager_username, worker_username, current_user['username']))

        conn.commit()
        cur.close()
        conn.close()
        return {"message": f"Assigned {len(worker_usernames)} workers to manager"}
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)

@app.get("/manager/my-workers")
async def get_my_workers(current_user: dict = Depends(get_current_user)):
    """Get workers assigned to the current manager"""
    if current_user.get('role') != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access this endpoint")

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT
            mw.worker_username,
            u.full_name as worker_name,
            u.role as worker_role,
            u.phone,
            u.email
        FROM manager_workers mw
        JOIN users u ON mw.worker_username = u.username
        WHERE mw.manager_username = %s AND mw.active = true AND u.active = true
        ORDER BY u.full_name
    """, (current_user['username'],))
    workers = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(w) for w in workers]


@app.get("/user/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user's information"""
    return current_user

# ============================================================
# INVENTORY ROUTES
# ============================================================

@app.get("/inventory")
async def get_inventory(
    current_user: dict = Depends(get_current_user),
    limit: int = 100,
    offset: int = 0,
    search: Optional[str] = None,
    category: Optional[str] = None,
    active_only: bool = True
):
    conn = get_db_connection()
    cur = conn.cursor()

    # Build query with filters
    where_clauses = []
    params = []

    if active_only:
        where_clauses.append("active = TRUE")

    if search:
        where_clauses.append("(item_id ILIKE %s OR description ILIKE %s OR brand ILIKE %s)")
        search_param = f"%{search}%"
        params.extend([search_param, search_param, search_param])

    if category:
        where_clauses.append("category = %s")
        params.append(category)

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    # Get total count
    cur.execute(f"SELECT COUNT(*) as total FROM inventory {where_sql}", params)
    total = cur.fetchone()['total']

    # Get paginated results
    params.extend([limit, offset])
    cur.execute(f"""
        SELECT * FROM inventory {where_sql}
        ORDER BY item_id ASC
        LIMIT %s OFFSET %s
    """, params)
    items = cur.fetchall()
    cur.close()
    conn.close()
    return {
        "inventory": items,
        "total": total,
        "limit": limit,
        "offset": offset
    }

@app.get("/inventory/low-stock")
async def get_low_stock_items(current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM inventory
        WHERE qty <= min_stock AND active = TRUE
        ORDER BY (min_stock - qty) DESC
    """)
    items = cur.fetchall()
    cur.close()
    conn.close()
    return {"inventory": items}

@app.get("/inventory/stockout-predictions")
async def get_stockout_predictions(current_user: dict = Depends(get_current_user)):
    """
    Predict when items will stock out based on usage velocity.
    Returns items sorted by urgency (days until stockout).
    """
    conn = get_db_connection()
    cur = conn.cursor()

    # Calculate average daily usage from stock_transactions over the last 90 days
    # Only consider negative transactions (usage, allocation, damage)
    cur.execute("""
        WITH usage_stats AS (
            SELECT
                st.inventory_id,
                -- Sum of negative quantity changes (usage) over last 90 days
                ABS(COALESCE(SUM(CASE WHEN st.quantity_change < 0 THEN st.quantity_change ELSE 0 END), 0)) as total_used_90d,
                -- Count distinct days with usage
                COUNT(DISTINCT DATE(st.transaction_date)) as days_with_usage
            FROM stock_transactions st
            WHERE st.transaction_date >= CURRENT_DATE - INTERVAL '90 days'
              AND st.transaction_type IN ('usage', 'allocation', 'adjustment')
              AND st.quantity_change < 0
            GROUP BY st.inventory_id
        ),
        predictions AS (
            SELECT
                i.id, i.item_id, i.description, i.brand, i.category, i.subcategory,
                i.qty, i.qty_available, i.qty_allocated, i.min_stock, i.reorder_qty, i.max_stock,
                i.cost, i.location, i.bin_location, i.abc_class, i.next_count_date,
                COALESCE(us.total_used_90d, 0) as total_used_90d,
                COALESCE(us.days_with_usage, 0) as days_with_usage,
                -- Calculate average daily usage (if used, divide by 90 days for velocity)
                CASE
                    WHEN COALESCE(us.total_used_90d, 0) > 0
                    THEN ROUND(us.total_used_90d::numeric / 90, 4)
                    ELSE 0
                END as calc_avg_daily_usage,
                -- Calculate days until stockout
                CASE
                    WHEN COALESCE(us.total_used_90d, 0) > 0 AND i.qty_available > 0
                    THEN ROUND(i.qty_available::numeric / (us.total_used_90d::numeric / 90))
                    WHEN i.qty_available <= 0 THEN 0
                    ELSE NULL  -- No usage history, can't predict
                END as calc_days_until_stockout,
                -- Risk level
                CASE
                    WHEN i.qty_available <= 0 THEN 'CRITICAL'
                    WHEN i.qty_available <= i.min_stock THEN 'LOW'
                    WHEN COALESCE(us.total_used_90d, 0) > 0
                         AND i.qty_available::numeric / (us.total_used_90d::numeric / 90) <= 14 THEN 'WARNING'
                    WHEN COALESCE(us.total_used_90d, 0) > 0
                         AND i.qty_available::numeric / (us.total_used_90d::numeric / 90) <= 30 THEN 'MONITOR'
                    ELSE 'OK'
                END as risk_level
            FROM inventory i
            LEFT JOIN usage_stats us ON i.id = us.inventory_id
            WHERE i.active = TRUE
        )
        SELECT * FROM predictions
        WHERE risk_level IN ('CRITICAL', 'LOW', 'WARNING', 'MONITOR')
           OR calc_days_until_stockout IS NOT NULL
        ORDER BY
            CASE risk_level
                WHEN 'CRITICAL' THEN 1
                WHEN 'LOW' THEN 2
                WHEN 'WARNING' THEN 3
                WHEN 'MONITOR' THEN 4
                ELSE 5
            END,
            calc_days_until_stockout ASC NULLS LAST
    """)

    items = cur.fetchall()

    # Calculate summary stats
    critical_count = sum(1 for item in items if item.get('risk_level') == 'CRITICAL')
    low_count = sum(1 for item in items if item.get('risk_level') == 'LOW')
    warning_count = sum(1 for item in items if item.get('risk_level') == 'WARNING')

    # Rename fields for frontend compatibility
    results = []
    for item in items:
        item_dict = dict(item)
        item_dict['avg_daily_usage'] = item_dict.pop('calc_avg_daily_usage', 0)
        item_dict['days_until_stockout'] = item_dict.pop('calc_days_until_stockout', None)
        results.append(item_dict)

    cur.close()
    conn.close()

    return {
        "predictions": results,
        "summary": {
            "critical": critical_count,
            "low": low_count,
            "warning": warning_count,
            "total_at_risk": critical_count + low_count + warning_count
        }
    }

@app.get("/inventory/reorder-suggestions")
async def get_reorder_suggestions(current_user: dict = Depends(get_current_user)):
    """
    Get items that need to be reordered based on min_stock and reorder_qty.
    Includes lead time consideration and suggested order quantities.
    """
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        WITH usage_stats AS (
            SELECT
                st.inventory_id,
                ABS(COALESCE(SUM(CASE WHEN st.quantity_change < 0 THEN st.quantity_change ELSE 0 END), 0)) as total_used_90d
            FROM stock_transactions st
            WHERE st.transaction_date >= CURRENT_DATE - INTERVAL '90 days'
              AND st.quantity_change < 0
            GROUP BY st.inventory_id
        )
        SELECT
            i.id,
            i.item_id,
            i.description,
            i.brand,
            i.category,
            i.qty,
            i.qty_available,
            i.qty_on_order,
            i.min_stock,
            i.reorder_qty,
            i.max_stock,
            i.cost,
            i.lead_time_days,
            i.primary_vendor_id,
            v.vendor_name as vendor_name,
            COALESCE(us.total_used_90d, 0) as total_used_90d,
            -- Suggested order quantity: max of reorder_qty or (max_stock - qty)
            GREATEST(
                COALESCE(i.reorder_qty, 0),
                COALESCE(i.max_stock, 0) - i.qty
            ) as suggested_order_qty,
            -- Estimated cost for suggested order
            GREATEST(
                COALESCE(i.reorder_qty, 0),
                COALESCE(i.max_stock, 0) - i.qty
            ) * COALESCE(i.cost, 0) as estimated_order_cost,
            -- Urgency based on lead time
            CASE
                WHEN i.qty_available <= 0 THEN 'IMMEDIATE'
                WHEN i.qty_available <= i.min_stock AND i.lead_time_days > 7 THEN 'URGENT'
                WHEN i.qty_available <= i.min_stock THEN 'SOON'
                ELSE 'PLANNED'
            END as urgency
        FROM inventory i
        LEFT JOIN usage_stats us ON i.id = us.inventory_id
        LEFT JOIN vendors v ON i.primary_vendor_id = v.id
        WHERE i.active = TRUE
          AND i.qty_available <= i.min_stock
          AND i.min_stock > 0
        ORDER BY
            CASE
                WHEN i.qty_available <= 0 THEN 1
                WHEN i.lead_time_days > 7 THEN 2
                ELSE 3
            END,
            i.qty_available ASC
    """)

    items = cur.fetchall()

    # Calculate totals
    total_items = len(items)
    total_estimated_cost = sum(float(item.get('estimated_order_cost', 0) or 0) for item in items)
    immediate_count = sum(1 for item in items if item.get('urgency') == 'IMMEDIATE')
    urgent_count = sum(1 for item in items if item.get('urgency') == 'URGENT')

    cur.close()
    conn.close()

    return {
        "reorder_suggestions": items,
        "summary": {
            "total_items": total_items,
            "immediate_count": immediate_count,
            "urgent_count": urgent_count,
            "total_estimated_cost": round(total_estimated_cost, 2)
        }
    }

# ============================================================
# INVENTORY PROJECTIONS - Based on Scheduled Jobs
# ============================================================

@app.get("/inventory/projections")
async def get_inventory_projections(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    shortage_only: bool = False,
    vendor_id: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get projected inventory levels based on scheduled job start dates.
    Shows current stock, materials needed for scheduled jobs, and shortages.
    """
    require_admin_access(current_user)

    conn = get_db_connection()
    cur = conn.cursor()

    # Default to next 30 days if no dates provided
    if not start_date:
        start_date = date.today()
    if not end_date:
        end_date = start_date + timedelta(days=30)

    try:
        # Build query - vendor filter handled separately
        base_query = """
            WITH scheduled_needs AS (
                SELECT
                    jm.inventory_id,
                    i.item_id,
                    i.description,
                    i.category,
                    i.brand,
                    i.qty as current_stock,
                    i.qty_available,
                    i.qty_allocated as currently_allocated,
                    i.min_stock,
                    i.lead_time_days,
                    i.cost,
                    i.primary_vendor_id,
                    v.vendor_name,
                    MIN(wo.start_date) as first_needed_date,
                    SUM(jm.quantity_needed) as total_needed,
                    SUM(jm.quantity_allocated) as already_allocated,
                    SUM(jm.quantity_needed - jm.quantity_allocated) as still_needed,
                    COUNT(DISTINCT jm.work_order_id) as job_count,
                    array_agg(DISTINCT wo.work_order_number) as work_orders
                FROM job_materials_used jm
                JOIN inventory i ON jm.inventory_id = i.id
                LEFT JOIN vendors v ON i.primary_vendor_id = v.id
                JOIN work_orders wo ON jm.work_order_id = wo.id
                WHERE wo.status IN ('pending', 'scheduled', 'in_progress')
                  AND wo.start_date IS NOT NULL
                  AND wo.start_date BETWEEN %s AND %s
                  AND jm.status IN ('planned', 'allocated')
                  AND i.active = TRUE
        """

        params = [start_date, end_date]

        if vendor_id:
            base_query += " AND i.primary_vendor_id = %s"
            params.append(vendor_id)

        base_query += """
                GROUP BY jm.inventory_id, i.id, i.item_id, i.description, i.category, i.brand,
                         i.qty, i.qty_available, i.qty_allocated, i.min_stock, i.lead_time_days,
                         i.cost, i.primary_vendor_id, v.vendor_name
            )
            SELECT
                *,
                GREATEST(0, still_needed - qty_available) as shortage_qty,
                CASE
                    WHEN still_needed > qty_available
                    THEN first_needed_date - COALESCE(lead_time_days, 3)
                    ELSE NULL
                END as order_by_date,
                CASE
                    WHEN still_needed > qty_available AND first_needed_date - COALESCE(lead_time_days, 3) <= CURRENT_DATE THEN 'critical'
                    WHEN still_needed > qty_available AND first_needed_date - COALESCE(lead_time_days, 3) <= CURRENT_DATE + 7 THEN 'urgent'
                    WHEN still_needed > qty_available THEN 'warning'
                    ELSE 'ok'
                END as urgency
            FROM scheduled_needs
        """

        if shortage_only:
            base_query += " WHERE still_needed > qty_available"

        base_query += """
            ORDER BY
                CASE
                    WHEN still_needed > qty_available AND first_needed_date - COALESCE(lead_time_days, 3) <= CURRENT_DATE THEN 1
                    WHEN still_needed > qty_available AND first_needed_date - COALESCE(lead_time_days, 3) <= CURRENT_DATE + 7 THEN 2
                    WHEN still_needed > qty_available THEN 3
                    ELSE 4
                END,
                first_needed_date ASC
        """

        cur.execute(base_query, params)
        projections = cur.fetchall()

        # Calculate summary
        total_items = len(projections)
        shortage_items = [p for p in projections if p.get('shortage_qty', 0) > 0]
        critical_count = sum(1 for p in projections if p.get('urgency') == 'critical')
        urgent_count = sum(1 for p in projections if p.get('urgency') == 'urgent')
        warning_count = sum(1 for p in projections if p.get('urgency') == 'warning')

        # Convert to list of dicts and handle array/date serialization
        results = []
        for proj in projections:
            p = dict(proj)
            if p.get('work_orders'):
                p['work_orders'] = list(p['work_orders']) if p['work_orders'] else []
            if p.get('first_needed_date'):
                p['first_needed_date'] = str(p['first_needed_date'])
            if p.get('order_by_date'):
                p['order_by_date'] = str(p['order_by_date'])
            results.append(p)

        return {
            "projections": results,
            "summary": {
                "total_items": total_items,
                "shortage_count": len(shortage_items),
                "critical": critical_count,
                "urgent": urgent_count,
                "warning": warning_count
            },
            "date_range": {
                "start": str(start_date),
                "end": str(end_date)
            }
        }
    finally:
        cur.close()
        conn.close()


@app.get("/inventory/shortages")
async def get_inventory_shortages(
    days_ahead: int = 30,
    group_by_vendor: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """
    Get items that will be short based on scheduled jobs.
    Groups by vendor for easy PO creation.
    Includes order-by dates considering lead times.
    """
    require_admin_access(current_user)

    conn = get_db_connection()
    cur = conn.cursor()

    end_date = date.today() + timedelta(days=days_ahead)

    try:
        cur.execute("""
            WITH shortage_items AS (
                SELECT
                    i.id as inventory_id,
                    i.item_id,
                    i.description,
                    i.category,
                    i.brand,
                    i.qty as current_stock,
                    i.qty_available,
                    i.min_stock,
                    i.lead_time_days,
                    i.cost,
                    i.primary_vendor_id,
                    v.vendor_name,
                    v.email as vendor_email,
                    v.phone as vendor_phone,
                    MIN(wo.start_date) as first_needed_date,
                    SUM(jm.quantity_needed - jm.quantity_allocated) as total_needed,
                    GREATEST(0, SUM(jm.quantity_needed - jm.quantity_allocated) - i.qty_available) as shortage_qty,
                    array_agg(DISTINCT wo.work_order_number) as affected_jobs
                FROM job_materials_used jm
                JOIN inventory i ON jm.inventory_id = i.id
                LEFT JOIN vendors v ON i.primary_vendor_id = v.id
                JOIN work_orders wo ON jm.work_order_id = wo.id
                WHERE wo.status IN ('pending', 'scheduled', 'in_progress')
                  AND wo.start_date IS NOT NULL
                  AND wo.start_date BETWEEN CURRENT_DATE AND %s
                  AND jm.status IN ('planned', 'allocated')
                  AND i.active = TRUE
                GROUP BY i.id, i.item_id, i.description, i.category, i.brand,
                         i.qty, i.qty_available, i.min_stock, i.lead_time_days,
                         i.cost, i.primary_vendor_id, v.vendor_name, v.email, v.phone
                HAVING SUM(jm.quantity_needed - jm.quantity_allocated) > i.qty_available
            )
            SELECT
                *,
                first_needed_date - COALESCE(lead_time_days, 3) as order_by_date,
                shortage_qty * cost as estimated_cost,
                CASE
                    WHEN first_needed_date - COALESCE(lead_time_days, 3) <= CURRENT_DATE THEN 'critical'
                    WHEN first_needed_date - COALESCE(lead_time_days, 3) <= CURRENT_DATE + 7 THEN 'urgent'
                    ELSE 'warning'
                END as urgency
            FROM shortage_items
            ORDER BY order_by_date ASC, shortage_qty DESC
        """, (end_date,))

        shortages = cur.fetchall()

        # Convert to list of dicts
        results = []
        for s in shortages:
            item = dict(s)
            if item.get('affected_jobs'):
                item['affected_jobs'] = list(item['affected_jobs']) if item['affected_jobs'] else []
            if item.get('first_needed_date'):
                item['first_needed_date'] = str(item['first_needed_date'])
            if item.get('order_by_date'):
                item['order_by_date'] = str(item['order_by_date'])
            if item.get('estimated_cost'):
                item['estimated_cost'] = float(item['estimated_cost'])
            results.append(item)

        # Group by vendor if requested
        if group_by_vendor:
            vendors = {}
            for item in results:
                vendor_id = item.get('primary_vendor_id') or 0
                vendor_name = item.get('vendor_name') or 'No Vendor Assigned'

                if vendor_id not in vendors:
                    vendors[vendor_id] = {
                        'vendor_id': vendor_id if vendor_id != 0 else None,
                        'vendor_name': vendor_name,
                        'vendor_email': item.get('vendor_email'),
                        'vendor_phone': item.get('vendor_phone'),
                        'items': [],
                        'total_items': 0,
                        'total_estimated_cost': 0
                    }

                vendors[vendor_id]['items'].append(item)
                vendors[vendor_id]['total_items'] += 1
                vendors[vendor_id]['total_estimated_cost'] += item.get('estimated_cost', 0)

            # Convert to list
            vendor_list = list(vendors.values())
            for v in vendor_list:
                v['total_estimated_cost'] = round(v['total_estimated_cost'], 2)

            return {
                "by_vendor": vendor_list,
                "summary": {
                    "total_shortage_items": len(results),
                    "vendors_affected": len(vendor_list),
                    "total_estimated_cost": round(sum(v['total_estimated_cost'] for v in vendor_list), 2),
                    "critical_count": sum(1 for r in results if r['urgency'] == 'critical'),
                    "urgent_count": sum(1 for r in results if r['urgency'] == 'urgent')
                }
            }
        else:
            return {
                "shortages": results,
                "summary": {
                    "total_items": len(results),
                    "total_estimated_cost": round(sum(r.get('estimated_cost', 0) for r in results), 2),
                    "critical_count": sum(1 for r in results if r['urgency'] == 'critical'),
                    "urgent_count": sum(1 for r in results if r['urgency'] == 'urgent')
                }
            }
    finally:
        cur.close()
        conn.close()


# ============================================================
# ORDER PLANNING - Combined Job Materials + Low Stock Items
# ============================================================

@app.get("/inventory/order-planning")
async def get_order_planning(
    days_ahead: int = 30,
    mode: str = "combined",  # "combined", "job_materials", "low_stock"
    vendor_id: Optional[int] = None,
    include_restock: bool = True,  # Smart qty: add restock to target when ordering for jobs
    current_user: dict = Depends(get_current_user)
):
    """
    Unified order planning that combines:
    - Job material shortages (items needed for scheduled jobs)
    - Low stock items (at/below reorder point)

    Smart quantity calculation: When ordering for a job, optionally include
    restock quantity to bring inventory back to target level.

    Modes:
    - combined: Both job materials and low stock (default)
    - job_materials: Only items needed for scheduled jobs
    - low_stock: Only items at/below reorder point
    """
    require_admin_access(current_user)

    if mode not in ("combined", "job_materials", "low_stock"):
        raise HTTPException(status_code=400, detail="Mode must be 'combined', 'job_materials', or 'low_stock'")

    conn = get_db_connection()
    cur = conn.cursor()

    end_date = date.today() + timedelta(days=days_ahead)

    try:
        items_dict = {}  # inventory_id -> item data

        # ========== PART 1: Get Job Material Needs ==========
        if mode in ("combined", "job_materials"):
            job_query = """
                SELECT
                    i.id as inventory_id,
                    i.item_id,
                    i.description,
                    i.category,
                    i.brand,
                    i.qty as current_stock,
                    i.qty_available,
                    i.qty_on_order,
                    i.min_stock,
                    i.reorder_qty,
                    i.max_stock,
                    i.lead_time_days,
                    i.cost,
                    i.primary_vendor_id,
                    v.vendor_name,
                    v.email as vendor_email,
                    v.phone as vendor_phone,
                    MIN(wo.start_date) as first_needed_date,
                    SUM(jm.quantity_needed) as job_qty_needed,
                    SUM(jm.quantity_allocated) as job_qty_allocated,
                    SUM(jm.quantity_needed - jm.quantity_allocated) as job_still_needed,
                    COUNT(DISTINCT jm.work_order_id) as job_count,
                    array_agg(DISTINCT wo.work_order_number) as affected_jobs
                FROM job_materials_used jm
                JOIN inventory i ON jm.inventory_id = i.id
                LEFT JOIN vendors v ON i.primary_vendor_id = v.id
                JOIN work_orders wo ON jm.work_order_id = wo.id
                WHERE wo.status IN ('pending', 'scheduled', 'in_progress')
                  AND wo.start_date IS NOT NULL
                  AND wo.start_date BETWEEN CURRENT_DATE AND %s
                  AND jm.status IN ('planned', 'allocated')
                  AND i.active = TRUE
            """
            params = [end_date]

            if vendor_id:
                job_query += " AND i.primary_vendor_id = %s"
                params.append(vendor_id)

            job_query += """
                GROUP BY i.id, i.item_id, i.description, i.category, i.brand,
                         i.qty, i.qty_available, i.qty_on_order, i.min_stock,
                         i.reorder_qty, i.max_stock, i.lead_time_days,
                         i.cost, i.primary_vendor_id, v.vendor_name, v.email, v.phone
                HAVING SUM(jm.quantity_needed - jm.quantity_allocated) > 0
            """

            cur.execute(job_query, params)
            job_items = cur.fetchall()

            for item in job_items:
                inv_id = item['inventory_id']
                qty_available = item['qty_available'] or 0
                job_still_needed = item['job_still_needed'] or 0
                max_stock = item['max_stock'] or 0
                current_stock = item['current_stock'] or 0

                # Calculate shortage (how much more we need beyond available)
                job_shortage = max(0, job_still_needed - qty_available)

                # Smart quantity: If ordering for job AND include_restock is true,
                # also restock to max_stock level
                if include_restock and job_shortage > 0 and max_stock > 0:
                    # After fulfilling jobs, where will stock be?
                    stock_after_jobs = current_stock - job_still_needed
                    # How much to get back to max?
                    restock_qty = max(0, max_stock - stock_after_jobs)
                    smart_order_qty = restock_qty
                else:
                    smart_order_qty = job_shortage

                items_dict[inv_id] = {
                    'inventory_id': inv_id,
                    'item_id': item['item_id'],
                    'description': item['description'],
                    'category': item['category'],
                    'brand': item['brand'],
                    'current_stock': current_stock,
                    'qty_available': qty_available,
                    'qty_on_order': item['qty_on_order'] or 0,
                    'min_stock': item['min_stock'] or 0,
                    'reorder_qty': item['reorder_qty'] or 0,
                    'max_stock': max_stock,
                    'lead_time_days': item['lead_time_days'],
                    'cost': float(item['cost']) if item['cost'] else 0,
                    'primary_vendor_id': item['primary_vendor_id'],
                    'vendor_name': item['vendor_name'],
                    'vendor_email': item['vendor_email'],
                    'vendor_phone': item['vendor_phone'],
                    'first_needed_date': str(item['first_needed_date']) if item['first_needed_date'] else None,
                    'job_qty_needed': job_still_needed,
                    'job_shortage': job_shortage,
                    'job_count': item['job_count'] or 0,
                    'affected_jobs': list(item['affected_jobs']) if item['affected_jobs'] else [],
                    'low_stock_shortage': 0,
                    'source': 'job_materials',
                    'order_qty': smart_order_qty,
                    'estimated_cost': round(smart_order_qty * (float(item['cost']) if item['cost'] else 0), 2)
                }

        # ========== PART 2: Get Low Stock Items ==========
        if mode in ("combined", "low_stock"):
            low_stock_query = """
                SELECT
                    i.id as inventory_id,
                    i.item_id,
                    i.description,
                    i.category,
                    i.brand,
                    i.qty as current_stock,
                    i.qty_available,
                    i.qty_on_order,
                    i.min_stock,
                    i.reorder_qty,
                    i.max_stock,
                    i.lead_time_days,
                    i.cost,
                    i.primary_vendor_id,
                    v.vendor_name,
                    v.email as vendor_email,
                    v.phone as vendor_phone
                FROM inventory i
                LEFT JOIN vendors v ON i.primary_vendor_id = v.id
                WHERE i.active = TRUE
                  AND i.min_stock > 0
                  AND i.qty_available <= i.min_stock
            """
            params = []

            if vendor_id:
                low_stock_query += " AND i.primary_vendor_id = %s"
                params.append(vendor_id)

            cur.execute(low_stock_query, params if params else None)
            low_stock_items = cur.fetchall()

            for item in low_stock_items:
                inv_id = item['inventory_id']
                qty_available = item['qty_available'] or 0
                min_stock = item['min_stock'] or 0
                max_stock = item['max_stock'] or 0
                current_stock = item['current_stock'] or 0
                reorder_qty = item['reorder_qty'] or 0

                # Low stock order qty: restore to max_stock or at least reorder_qty
                low_stock_order = max(reorder_qty, max_stock - current_stock) if max_stock > 0 else reorder_qty

                if inv_id in items_dict:
                    # Item already exists from job materials - merge
                    existing = items_dict[inv_id]
                    existing['low_stock_shortage'] = max(0, min_stock - qty_available)
                    existing['source'] = 'both'
                    # Order qty is already calculated with smart restock in job materials
                    # But ensure we at least meet low stock reorder
                    existing['order_qty'] = max(existing['order_qty'], low_stock_order)
                    existing['estimated_cost'] = round(existing['order_qty'] * existing['cost'], 2)
                else:
                    # New item - only from low stock
                    items_dict[inv_id] = {
                        'inventory_id': inv_id,
                        'item_id': item['item_id'],
                        'description': item['description'],
                        'category': item['category'],
                        'brand': item['brand'],
                        'current_stock': current_stock,
                        'qty_available': qty_available,
                        'qty_on_order': item['qty_on_order'] or 0,
                        'min_stock': min_stock,
                        'reorder_qty': reorder_qty,
                        'max_stock': max_stock,
                        'lead_time_days': item['lead_time_days'],
                        'cost': float(item['cost']) if item['cost'] else 0,
                        'primary_vendor_id': item['primary_vendor_id'],
                        'vendor_name': item['vendor_name'],
                        'vendor_email': item['vendor_email'],
                        'vendor_phone': item['vendor_phone'],
                        'first_needed_date': None,
                        'job_qty_needed': 0,
                        'job_shortage': 0,
                        'job_count': 0,
                        'affected_jobs': [],
                        'low_stock_shortage': max(0, min_stock - qty_available),
                        'source': 'low_stock',
                        'order_qty': low_stock_order,
                        'estimated_cost': round(low_stock_order * (float(item['cost']) if item['cost'] else 0), 2)
                    }

        # ========== Convert to list and calculate urgency ==========
        results = list(items_dict.values())

        for item in results:
            # Calculate urgency based on source and timing
            if item['source'] in ('job_materials', 'both') and item['first_needed_date']:
                needed_date = datetime.strptime(item['first_needed_date'], '%Y-%m-%d').date()
                lead_days = item['lead_time_days'] or 3
                order_by = needed_date - timedelta(days=lead_days)
                item['order_by_date'] = str(order_by)

                if order_by <= date.today():
                    item['urgency'] = 'critical'
                elif order_by <= date.today() + timedelta(days=7):
                    item['urgency'] = 'urgent'
                else:
                    item['urgency'] = 'warning'
            else:
                # Low stock only - urgency based on how low
                item['order_by_date'] = None
                if item['qty_available'] <= 0:
                    item['urgency'] = 'critical'
                elif item['qty_available'] <= item['min_stock'] * 0.5:
                    item['urgency'] = 'urgent'
                else:
                    item['urgency'] = 'warning'

        # Sort by urgency, then order_by_date
        urgency_order = {'critical': 1, 'urgent': 2, 'warning': 3}
        results.sort(key=lambda x: (
            urgency_order.get(x['urgency'], 4),
            x['order_by_date'] or '9999-99-99'
        ))

        # ========== Group by vendor ==========
        vendors = {}
        for item in results:
            vid = item.get('primary_vendor_id') or 0
            vname = item.get('vendor_name') or 'No Vendor Assigned'

            if vid not in vendors:
                vendors[vid] = {
                    'vendor_id': vid if vid != 0 else None,
                    'vendor_name': vname,
                    'vendor_email': item.get('vendor_email'),
                    'vendor_phone': item.get('vendor_phone'),
                    'items': [],
                    'total_items': 0,
                    'total_order_qty': 0,
                    'total_estimated_cost': 0,
                    'has_critical': False,
                    'has_urgent': False
                }

            vendors[vid]['items'].append(item)
            vendors[vid]['total_items'] += 1
            vendors[vid]['total_order_qty'] += item['order_qty']
            vendors[vid]['total_estimated_cost'] += item['estimated_cost']
            if item['urgency'] == 'critical':
                vendors[vid]['has_critical'] = True
            if item['urgency'] == 'urgent':
                vendors[vid]['has_urgent'] = True

        # Round costs and sort vendors by urgency
        vendor_list = list(vendors.values())
        for v in vendor_list:
            v['total_estimated_cost'] = round(v['total_estimated_cost'], 2)

        vendor_list.sort(key=lambda x: (
            0 if x['has_critical'] else (1 if x['has_urgent'] else 2),
            -x['total_items']
        ))

        # Calculate summary
        summary = {
            'total_items': len(results),
            'job_material_items': sum(1 for r in results if r['source'] in ('job_materials', 'both')),
            'low_stock_items': sum(1 for r in results if r['source'] in ('low_stock', 'both')),
            'combined_items': sum(1 for r in results if r['source'] == 'both'),
            'critical_count': sum(1 for r in results if r['urgency'] == 'critical'),
            'urgent_count': sum(1 for r in results if r['urgency'] == 'urgent'),
            'warning_count': sum(1 for r in results if r['urgency'] == 'warning'),
            'total_order_qty': sum(r['order_qty'] for r in results),
            'total_estimated_cost': round(sum(r['estimated_cost'] for r in results), 2),
            'vendors_affected': len(vendor_list)
        }

        return {
            'by_vendor': vendor_list,
            'all_items': results,
            'summary': summary,
            'parameters': {
                'mode': mode,
                'days_ahead': days_ahead,
                'include_restock': include_restock,
                'date_range': {
                    'start': str(date.today()),
                    'end': str(end_date)
                }
            }
        }

    finally:
        cur.close()
        conn.close()


@app.get("/inventory/abc-analysis")
async def get_abc_analysis(current_user: dict = Depends(get_current_user)):
    """
    Perform ABC analysis on inventory based on value and usage.
    A = High value/turnover (top 20% by value, ~80% of total value)
    B = Medium (next 30%)
    C = Low (remaining 50%)
    """
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        WITH usage_value AS (
            SELECT
                i.id,
                i.item_id,
                i.description,
                i.brand,
                i.category,
                i.qty,
                i.qty_available,
                i.cost,
                i.times_used,
                i.last_used_date,
                i.last_counted_date,
                i.min_stock,
                -- Calculate annual value (inventory value + usage value)
                (i.qty * COALESCE(i.cost, 0)) as inventory_value,
                COALESCE(i.times_used, 0) * COALESCE(i.cost, 0) as usage_value,
                -- Combined score for ranking
                (i.qty * COALESCE(i.cost, 0)) + (COALESCE(i.times_used, 0) * COALESCE(i.cost, 0)) as total_value
            FROM inventory i
            WHERE i.active = TRUE
        ),
        ranked AS (
            SELECT
                *,
                SUM(total_value) OVER () as grand_total,
                SUM(total_value) OVER (ORDER BY total_value DESC) as cumulative_value,
                ROW_NUMBER() OVER (ORDER BY total_value DESC) as rank,
                COUNT(*) OVER () as total_count
            FROM usage_value
        ),
        classified AS (
            SELECT
                *,
                CASE
                    WHEN cumulative_value <= grand_total * 0.8 THEN 'A'
                    WHEN cumulative_value <= grand_total * 0.95 THEN 'B'
                    ELSE 'C'
                END as abc_class,
                -- Suggested count frequency
                CASE
                    WHEN cumulative_value <= grand_total * 0.8 THEN 'Weekly'
                    WHEN cumulative_value <= grand_total * 0.95 THEN 'Monthly'
                    ELSE 'Quarterly'
                END as suggested_count_frequency
            FROM ranked
        )
        SELECT * FROM classified
        ORDER BY abc_class, total_value DESC
    """)

    items = cur.fetchall()

    # Calculate class summaries
    a_items = [i for i in items if i.get('abc_class') == 'A']
    b_items = [i for i in items if i.get('abc_class') == 'B']
    c_items = [i for i in items if i.get('abc_class') == 'C']

    cur.close()
    conn.close()

    return {
        "items": items,
        "summary": {
            "a_class": {
                "count": len(a_items),
                "total_value": sum(float(i.get('total_value', 0) or 0) for i in a_items),
                "suggested_frequency": "Weekly"
            },
            "b_class": {
                "count": len(b_items),
                "total_value": sum(float(i.get('total_value', 0) or 0) for i in b_items),
                "suggested_frequency": "Monthly"
            },
            "c_class": {
                "count": len(c_items),
                "total_value": sum(float(i.get('total_value', 0) or 0) for i in c_items),
                "suggested_frequency": "Quarterly"
            }
        }
    }

@app.post("/inventory/update-abc-classifications")
async def update_abc_classifications(current_user: dict = Depends(require_manager_or_admin)):
    """
    Update ABC classifications and set next count dates for all inventory items.
    Should be run periodically (e.g., monthly) to keep classifications current.
    """
    conn = get_db_connection()
    cur = conn.cursor()

    # Calculate and update ABC class for all items
    cur.execute("""
        WITH usage_value AS (
            SELECT
                i.id,
                (i.qty * COALESCE(i.cost, 0)) + (COALESCE(i.times_used, 0) * COALESCE(i.cost, 0)) as total_value
            FROM inventory i
            WHERE i.active = TRUE
        ),
        ranked AS (
            SELECT
                id,
                total_value,
                SUM(total_value) OVER () as grand_total,
                SUM(total_value) OVER (ORDER BY total_value DESC) as cumulative_value
            FROM usage_value
        ),
        classified AS (
            SELECT
                id,
                CASE
                    WHEN grand_total = 0 THEN 'C'
                    WHEN cumulative_value <= grand_total * 0.8 THEN 'A'
                    WHEN cumulative_value <= grand_total * 0.95 THEN 'B'
                    ELSE 'C'
                END as new_abc_class,
                -- Set next count date based on class
                CASE
                    WHEN grand_total = 0 THEN CURRENT_DATE + INTERVAL '90 days'
                    WHEN cumulative_value <= grand_total * 0.8 THEN CURRENT_DATE + INTERVAL '7 days'
                    WHEN cumulative_value <= grand_total * 0.95 THEN CURRENT_DATE + INTERVAL '30 days'
                    ELSE CURRENT_DATE + INTERVAL '90 days'
                END as new_next_count_date
            FROM ranked
        )
        UPDATE inventory i
        SET
            abc_class = c.new_abc_class,
            next_count_date = c.new_next_count_date::date
        FROM classified c
        WHERE i.id = c.id
    """)

    updated_count = cur.rowcount
    conn.commit()
    cur.close()
    conn.close()

    return {
        "message": f"Updated ABC classifications for {updated_count} items",
        "updated_count": updated_count
    }

@app.get("/inventory/cycle-count-due")
async def get_cycle_count_due(current_user: dict = Depends(get_current_user)):
    """
    Get items that are due for cycle counting based on their ABC class and next_count_date.
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT
                i.*,
                COALESCE(s.tolerance_percent, 5.0) as tolerance_percent,
                CASE
                    WHEN i.next_count_date IS NULL THEN 'Never Scheduled'
                    WHEN i.next_count_date <= CURRENT_DATE THEN 'Overdue'
                    WHEN i.next_count_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'Due This Week'
                    ELSE 'Upcoming'
                END as count_status,
                i.next_count_date - CURRENT_DATE as days_until_due
            FROM inventory i
            LEFT JOIN cycle_count_settings s ON s.abc_class = COALESCE(i.abc_class, 'C')
            WHERE i.active = TRUE
              AND (
                  i.next_count_date IS NULL
                  OR i.next_count_date <= CURRENT_DATE + INTERVAL '14 days'
              )
            ORDER BY
                CASE
                    WHEN i.next_count_date IS NULL THEN 2
                    WHEN i.next_count_date <= CURRENT_DATE THEN 1
                    ELSE 3
                END,
                i.next_count_date ASC NULLS FIRST,
                i.abc_class ASC NULLS LAST
        """)

        items = cur.fetchall()

        overdue = sum(1 for i in items if i.get('count_status') == 'Overdue')
        due_this_week = sum(1 for i in items if i.get('count_status') == 'Due This Week')
        never_scheduled = sum(1 for i in items if i.get('count_status') == 'Never Scheduled')

        return {
            "items": items,
            "summary": {
                "overdue": overdue,
                "due_this_week": due_this_week,
                "never_scheduled": never_scheduled,
                "total": len(items)
            }
        }
    except Exception as e:
        conn.rollback()
        log_and_raise(e, "Failed to get cycle count due items: ...")
    finally:
        cur.close()
        conn.close()

# ============================================================
# CYCLE COUNT SETTINGS & EXECUTION
# ============================================================

@app.get("/inventory/cycle-count-settings")
async def get_cycle_count_settings(current_user: dict = Depends(get_current_user)):
    """Get the current cycle count frequency settings for each ABC class."""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT abc_class, count_frequency_days, tolerance_percent, updated_at, updated_by
            FROM cycle_count_settings
            ORDER BY abc_class
        """)
        settings = cur.fetchall()
        return {"settings": settings}
    except Exception as e:
        conn.rollback()
        log_and_raise(e, "Failed to get cycle count settings: ...")
    finally:
        cur.close()
        conn.close()

class CycleCountSettingsUpdate(BaseModel):
    class_a_days: int = 7
    class_b_days: int = 30
    class_c_days: int = 90
    class_a_tolerance: float = 2.0
    class_b_tolerance: float = 5.0
    class_c_tolerance: float = 10.0

@app.post("/inventory/cycle-count-settings")
async def update_cycle_count_settings(settings: CycleCountSettingsUpdate, current_user: dict = Depends(get_current_user)):
    """Update the cycle count frequency settings and recalculate next_count_dates."""
    # Role-based access control - only admin and manager can update settings
    if current_user.get('role') not in ['admin', 'manager']:
        raise HTTPException(status_code=403, detail="Only administrators and managers can update cycle count settings")

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Update settings for each class
        updates = [
            ('A', settings.class_a_days, settings.class_a_tolerance),
            ('B', settings.class_b_days, settings.class_b_tolerance),
            ('C', settings.class_c_days, settings.class_c_tolerance),
        ]

        for abc_class, days, tolerance in updates:
            cur.execute("""
                UPDATE cycle_count_settings
                SET count_frequency_days = %s,
                    tolerance_percent = %s,
                    updated_at = CURRENT_TIMESTAMP,
                    updated_by = %s
                WHERE abc_class = %s
            """, (days, tolerance, current_user['username'], abc_class))

        # Recalculate next_count_date for all items based on new frequencies
        # Items that have been counted: next_count_date = last_counted_date + frequency
        # Items never counted: next_count_date = today
        cur.execute("""
            UPDATE inventory i
            SET next_count_date = CASE
                WHEN i.last_counted_date IS NOT NULL THEN
                    i.last_counted_date + (
                        SELECT count_frequency_days FROM cycle_count_settings s
                        WHERE s.abc_class = COALESCE(i.abc_class, 'C')
                    ) * INTERVAL '1 day'
                ELSE
                    CURRENT_DATE
            END
            WHERE i.active = TRUE AND i.abc_class IS NOT NULL
        """)

        conn.commit()
        return {"message": "Cycle count settings updated successfully"}
    except Exception as e:
        conn.rollback()
        log_and_raise(e, "Failed to update cycle count settings: ...")
    finally:
        cur.close()
        conn.close()

class CycleCountRecord(BaseModel):
    actual_quantity: int
    notes: Optional[str] = None

class RescheduleCountRequest(BaseModel):
    new_date: date

@app.post("/inventory/{id}/cycle-count")
async def record_cycle_count(id: int, count: CycleCountRecord, current_user: dict = Depends(get_current_user)):
    """
    Record a physical cycle count for an inventory item.
    Updates the inventory quantity, records variance, and sets next count date.
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get current item details
        cur.execute("""
            SELECT i.id, i.item_id, i.description, i.qty, i.cost, i.abc_class,
                   COALESCE(s.count_frequency_days, 30) as count_frequency_days,
                   COALESCE(s.tolerance_percent, 5.0) as tolerance_percent
            FROM inventory i
            LEFT JOIN cycle_count_settings s ON s.abc_class = COALESCE(i.abc_class, 'C')
            WHERE i.id = %s
        """, (id,))
        item = cur.fetchone()

        if not item:
            raise HTTPException(status_code=404, detail=f"Item not found with id: {id}")

        system_qty = item['qty'] or 0
        variance = count.actual_quantity - system_qty
        variance_value = abs(variance) * float(item['cost'] or 0)
        variance_percent = abs(variance / system_qty * 100) if system_qty > 0 else (100 if variance != 0 else 0)
        tolerance_exceeded = variance_percent > float(item['tolerance_percent'])
        count_frequency_days = int(item['count_frequency_days'])

        # Update the inventory item - using parameterized interval calculation
        cur.execute("""
            UPDATE inventory
            SET qty = %s,
                last_counted_date = CURRENT_DATE,
                count_variance = %s,
                next_count_date = CURRENT_DATE + (%s || ' days')::INTERVAL
            WHERE id = %s
        """, (count.actual_quantity, variance, str(count_frequency_days), id))

        # Record the transaction
        reason = f"Cycle count - Counted: {count.actual_quantity}, System: {system_qty}, Variance: {variance:+d}"
        if count.notes:
            reason += f" | Notes: {count.notes}"

        cur.execute("""
            INSERT INTO stock_transactions (
                inventory_id, transaction_type, quantity_change, quantity_before,
                quantity_after, unit_cost, total_cost, reason, performed_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            id, 'cycle_count', variance, system_qty, count.actual_quantity,
            item['cost'], variance_value if variance < 0 else 0, reason, current_user['username']
        ))
        transaction_id = cur.fetchone()['id']

        conn.commit()

        return {
            "message": "Cycle count recorded successfully",
            "item_id": item['item_id'],
            "description": item['description'],
            "system_quantity": system_qty,
            "counted_quantity": count.actual_quantity,
            "variance": variance,
            "variance_value": round(variance_value, 2),
            "variance_percent": round(variance_percent, 2),
            "tolerance_exceeded": tolerance_exceeded,
            "tolerance_percent": float(item['tolerance_percent']),
            "transaction_id": transaction_id,
            "next_count_date": (datetime.now() + timedelta(days=count_frequency_days)).strftime('%Y-%m-%d')
        }
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        log_and_raise(e, "Failed to record cycle count: ...")
    finally:
        cur.close()
        conn.close()

@app.post("/inventory/{id}/reschedule-count")
async def reschedule_cycle_count(id: int, request: RescheduleCountRequest, current_user: dict = Depends(get_current_user)):
    """Manually reschedule the next cycle count date for an item."""
    # Validate date is not in the past
    if request.new_date < date.today():
        raise HTTPException(status_code=400, detail="Cannot schedule count date in the past")

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            UPDATE inventory
            SET next_count_date = %s
            WHERE id = %s AND active = TRUE
            RETURNING item_id
        """, (request.new_date, id))

        result = cur.fetchone()
        if not result:
            raise HTTPException(status_code=404, detail=f"Item not found with id: {id}")

        conn.commit()
        return {"message": f"Cycle count rescheduled to {request.new_date}", "item_id": result['item_id']}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        log_and_raise(e, "Failed to reschedule cycle count: ...")
    finally:
        cur.close()
        conn.close()

@app.get("/inventory/search")
async def search_inventory(query: str, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cur = conn.cursor()
    search_query = f"%{query}%"
    cur.execute("""
        SELECT * FROM inventory
        WHERE description ILIKE %s
        OR category ILIKE %s
        OR subcategory ILIKE %s
        OR brand ILIKE %s
        OR sku ILIKE %s
        OR upc ILIKE %s
        OR item_id ILIKE %s
        ORDER BY item_id ASC
    """, (search_query, search_query, search_query, search_query, search_query, search_query, search_query))
    items = cur.fetchall()
    cur.close()
    conn.close()

    return {"inventory": items}

@app.get("/inventory/{id}")
async def get_inventory_item(id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM inventory WHERE id = %s", (id,))
    item = cur.fetchone()
    cur.close()
    conn.close()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@app.get("/inventory/barcode/{upc}")
async def get_inventory_by_barcode(upc: str, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM inventory WHERE upc = %s", (upc,))
    item = cur.fetchone()
    cur.close()
    conn.close()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found with UPC: " + upc)
    return item

@app.post("/inventory")
async def create_inventory_item(item: InventoryItem, current_user: dict = Depends(require_manager_or_admin)):
    """Create inventory item - requires manager or admin role"""
    conn = get_db_connection()
    cur = conn.cursor()

    # Convert image_urls list to JSONB if provided
    image_urls_json = Json(item.image_urls) if item.image_urls else Json([])

    cur.execute("""
        INSERT INTO inventory (
            item_id, sku, brand, upc, manufacturer_part_number, description,
            category, subcategory,
            cost, list_price, contractor_price, markup_percent, sell_price, discount_price,
            qty, qty_allocated, qty_on_order, min_stock, reorder_qty, max_stock, location, bin_location,
            last_counted_date, count_variance,
            qty_per, package_quantity, weight_lbs, length_inches, dimensions,
            voltage, amperage, wire_gauge, wire_type, num_poles, phase, wire_insulation,
            wire_stranding, conduit_compatible, indoor_outdoor, wet_location_rated,
            ma_code_ref, nec_ref, ul_listed, certifications, arc_fault_required, gfci_required, tamper_resistant,
            primary_vendor_id, alternate_vendor_id, vendor_part_number, lead_time_days,
            last_order_date, last_order_cost, last_order_vendor_id, discontinued, replacement_item_id,
            image_url, image_urls, datasheet_pdf, installation_guide, video_url, qr_code,
            commonly_used, last_used_date, times_used, usage_frequency, seasonal_item,
            taxable, serialized, warranty_months, returnable,
            notes, estimation_guide, hazmat, active, created_by
        ) VALUES (
            %s, %s, %s, %s, %s, %s,
            %s, %s,
            %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s,
            %s, %s, %s, %s, %s
        ) RETURNING id
    """, (
        item.item_id, item.sku, item.brand, item.upc, item.manufacturer_part_number, item.description,
        item.category, item.subcategory,
        item.cost, item.list_price, item.contractor_price, item.markup_percent, item.sell_price, item.discount_price,
        item.qty, item.qty_allocated, item.qty_on_order, item.min_stock, item.reorder_qty, item.max_stock,
        item.location, item.bin_location, item.last_counted_date, item.count_variance,
        item.qty_per, item.package_quantity, item.weight_lbs, item.length_inches, item.dimensions,
        item.voltage, item.amperage, item.wire_gauge, item.wire_type, item.num_poles, item.phase,
        item.wire_insulation, item.wire_stranding, item.conduit_compatible, item.indoor_outdoor, item.wet_location_rated,
        item.ma_code_ref, item.nec_ref, item.ul_listed, item.certifications, item.arc_fault_required,
        item.gfci_required, item.tamper_resistant,
        item.primary_vendor_id, item.alternate_vendor_id, item.vendor_part_number, item.lead_time_days,
        item.last_order_date, item.last_order_cost, item.last_order_vendor_id, item.discontinued, item.replacement_item_id,
        item.image_url, image_urls_json, item.datasheet_pdf, item.installation_guide, item.video_url, item.qr_code,
        item.commonly_used, item.last_used_date, item.times_used, item.usage_frequency, item.seasonal_item,
        item.taxable, item.serialized, item.warranty_months, item.returnable,
        item.notes, item.estimation_guide, item.hazmat, item.active, current_user
    ))

    new_id = cur.fetchone()['id']
    conn.commit()
    cur.close()
    conn.close()

    return {"message": "Item created successfully", "id": new_id, "item_id": item.item_id}

@app.patch("/inventory/{id}")
async def update_inventory_item(id: int, item: InventoryItemUpdate, current_user: dict = Depends(require_manager_or_admin)):
    """Update inventory item - requires manager or admin role"""
    conn = get_db_connection()
    cur = conn.cursor()

    # Allowlist of fields that can be updated (defense in depth)
    allowed_fields = {
        'item_id', 'description', 'brand', 'category', 'location', 'bin_number',
        'qty', 'qty_allocated', 'qty_on_order', 'unit', 'cost', 'sell_price',
        'markup_percent', 'min_stock', 'reorder_qty', 'lead_time_days',
        'primary_vendor_id', 'alternate_vendor_id', 'vendor_part_number',
        'manufacturer', 'manufacturer_part_number', 'barcode', 'last_order_date',
        'last_order_vendor_id', 'last_order_cost', 'commonly_used', 'last_used_date',
        'times_used', 'usage_frequency', 'seasonal_item', 'taxable', 'serialized',
        'warranty_months', 'returnable', 'notes', 'estimation_guide', 'hazmat',
        'active', 'image_urls'
    }

    # Build dynamic update query
    update_fields = []
    values = []

    for field, value in item.dict(exclude_unset=True).items():
        if value is not None:
            # Skip fields not in allowlist or computed fields
            if field not in allowed_fields or field == "qty_available":
                continue

            # Special handling for image_urls (convert to JSONB)
            if field == "image_urls":
                update_fields.append(f"{field} = %s")
                values.append(Json(value))
            else:
                update_fields.append(f"{field} = %s")
                values.append(value)

    if not update_fields:
        cur.close()
        conn.close()
        raise HTTPException(status_code=400, detail="No fields to update")

    values.append(id)
    query = f"UPDATE inventory SET {', '.join(update_fields)} WHERE id = %s"
    cur.execute(query, values)

    if cur.rowcount == 0:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Item not found")

    conn.commit()
    cur.close()
    conn.close()

    return {"message": "Item updated successfully"}

@app.delete("/inventory/{id}")
async def delete_inventory_item(id: int, current_user: dict = Depends(require_manager_or_admin)):
    """Soft delete - sets active=FALSE instead of actually deleting. Requires manager or admin role."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("UPDATE inventory SET active = FALSE WHERE id = %s", (id,))

    if cur.rowcount == 0:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Item not found")

    conn.commit()
    cur.close()
    conn.close()

    return {"message": "Item deactivated successfully"}

# ============================================================
# STOCK MANAGEMENT
# ============================================================

@app.post("/inventory/{item_id}/adjust-stock")
async def adjust_stock(item_id: str, adjustment: StockAdjustment, current_user: dict = Depends(require_manager_or_admin)):
    """Quick stock adjustment endpoint - updates qty and creates transaction record.
    Uses atomic UPDATE to prevent race conditions. Requires manager or admin role."""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get inventory_id first
        cur.execute("SELECT id FROM inventory WHERE item_id = %s", (item_id,))
        result = cur.fetchone()

        if not result:
            raise HTTPException(status_code=404, detail=f"Item not found: {item_id}")

        inventory_id = result['id']

        # Atomic update with check - prevents race conditions and ensures non-negative qty
        cur.execute("""
            UPDATE inventory 
            SET qty = qty + %s 
            WHERE id = %s AND qty + %s >= 0
            RETURNING qty - %s as quantity_before, qty as quantity_after, qty_available
        """, (adjustment.quantity_change, inventory_id, adjustment.quantity_change, adjustment.quantity_change))

        updated = cur.fetchone()

        if not updated:
            raise HTTPException(status_code=400, detail="Insufficient stock - quantity cannot be negative")

        quantity_before = updated['quantity_before']
        quantity_after = updated['quantity_after']

        # Record transaction in stock_transactions
        cur.execute("""
            INSERT INTO stock_transactions (
                inventory_id, transaction_type, quantity_change, quantity_before, quantity_after,
                reason, performed_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            inventory_id, 'adjustment', adjustment.quantity_change, quantity_before,
            quantity_after, adjustment.reason, current_user.get('username', 'unknown')
        ))

        conn.commit()

        return {
            "message": "Stock adjusted successfully",
            "item_id": item_id,
            "quantity_before": quantity_before,
            "quantity_after": quantity_after,
            "qty_available": updated['qty_available']
        }
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Stock adjustment error: {e}")
        raise HTTPException(status_code=500, detail="Failed to adjust stock")
    finally:
        cur.close()
        conn.close()

@app.get("/inventory/{id}/transactions")
async def get_stock_transactions(id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM stock_transactions
        WHERE inventory_id = %s
        ORDER BY transaction_date DESC
        LIMIT 100
    """, (id,))
    transactions = cur.fetchall()
    cur.close()
    conn.close()

    return {"transactions": transactions}

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

# ============================================================
# CSV IMPORT/EXPORT
# ============================================================

@app.post("/inventory/import")
async def import_inventory(file: UploadFile = File(...), current_user: dict = Depends(require_manager_or_admin)):
    """Import inventory from CSV file (manager/admin only)"""
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    try:
        text = contents.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = contents.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))

    if reader.fieldnames is None:
        raise HTTPException(status_code=400, detail="CSV file is missing headers")

    conn = get_db_connection()
    cur = conn.cursor()

    imported_count = 0
    updated_count = 0
    skipped_count = 0
    errors = []

    for row_num, row in enumerate(reader, start=2):  # Start at 2 (header is row 1)
        try:
            # Map CSV columns to database fields (case-insensitive)
            row_lower = {k.lower().strip(): v for k, v in row.items()}

            description = row_lower.get('description', '').strip()
            if not description:
                skipped_count += 1
                continue

            item_id = row_lower.get('item id', row_lower.get('item_id', '')).strip()
            upc = row_lower.get('upc', row_lower.get('barcode', '')).strip()

            # Extract all fields with defaults
            brand = row_lower.get('brand', '').strip()
            manufacturer_part_number = row_lower.get('manufacturer_part_number', row_lower.get('part number', row_lower.get('mpn', ''))).strip()
            category = row_lower.get('category', '').strip()
            subcategory = row_lower.get('subcategory', '').strip()
            voltage = row_lower.get('voltage', '').strip()
            amperage = row_lower.get('amperage', '').strip()
            wire_gauge = row_lower.get('wire_gauge', row_lower.get('wire gauge', '')).strip()
            location = row_lower.get('location', '').strip()
            qty_per = row_lower.get('qty_per', row_lower.get('unit', 'Each')).strip() or 'Each'
            nec_ref = row_lower.get('nec_ref', row_lower.get('nec reference', '')).strip()

            # Parse numeric fields safely
            def parse_decimal(val, default=0):
                if not val or str(val).strip() == '':
                    return default
                try:
                    return float(str(val).replace('$', '').replace(',', '').strip())
                except (ValueError, TypeError):
                    return default

            def parse_int(val, default=0):
                if not val or str(val).strip() == '':
                    return default
                try:
                    return int(float(str(val).strip()))
                except (ValueError, TypeError):
                    return default

            def parse_bool(val, default=True):
                if not val or str(val).strip() == '':
                    return default
                val_str = str(val).strip().lower()
                return val_str in ('true', 'yes', '1', 'y', 't')

            cost = parse_decimal(row_lower.get('cost', row_lower.get('unit cost', '')))
            sell_price = parse_decimal(row_lower.get('sell_price', row_lower.get('price', row_lower.get('sell price', ''))))
            qty = parse_int(row_lower.get('qty', row_lower.get('quantity', row_lower.get('stock', ''))))
            min_stock = parse_int(row_lower.get('min_stock', row_lower.get('minimum stock', row_lower.get('reorder point', ''))))
            num_poles = parse_int(row_lower.get('num_poles', row_lower.get('poles', '')))
            lead_time_days = parse_int(row_lower.get('lead_time_days', row_lower.get('lead time', '')), 1)
            ul_listed = parse_bool(row_lower.get('ul_listed', row_lower.get('ul', '')))
            commonly_used = parse_bool(row_lower.get('commonly_used', row_lower.get('common', '')))
            active = parse_bool(row_lower.get('active', ''), True)

            # Check if item exists (by item_id or UPC)
            cur.execute("""
                SELECT id FROM inventory
                WHERE item_id = %s OR (upc IS NOT NULL AND upc = %s AND upc != '')
                LIMIT 1
            """, (item_id, upc))

            existing = cur.fetchone()

            if existing:
                # Update existing item
                cur.execute("""
                    UPDATE inventory SET
                        description = %s, brand = %s, manufacturer_part_number = %s,
                        category = %s, subcategory = %s, voltage = %s, amperage = %s,
                        wire_gauge = %s, cost = %s, sell_price = %s, qty = %s,
                        min_stock = %s, location = %s, qty_per = %s, nec_ref = %s,
                        ul_listed = %s, commonly_used = %s, lead_time_days = %s, active = %s
                    WHERE id = %s
                """, (
                    description, brand, manufacturer_part_number, category, subcategory,
                    voltage, amperage, wire_gauge, cost, sell_price, qty, min_stock,
                    location, qty_per, nec_ref, ul_listed, commonly_used, lead_time_days,
                    active, existing['id']
                ))
                updated_count += 1
            else:
                # Insert new item
                cur.execute("""
                    INSERT INTO inventory (
                        item_id, upc, description, brand, manufacturer_part_number,
                        category, subcategory, voltage, amperage, wire_gauge, num_poles,
                        cost, sell_price, qty, min_stock, location, qty_per, nec_ref,
                        ul_listed, commonly_used, lead_time_days, active
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    item_id or None, upc or None, description, brand, manufacturer_part_number,
                    category, subcategory, voltage, amperage, wire_gauge, num_poles or None,
                    cost, sell_price, qty, min_stock, location, qty_per, nec_ref,
                    ul_listed, commonly_used, lead_time_days, active
                ))
                imported_count += 1

        except Exception as e:
            errors.append(f"Row {row_num}: {str(e)}")
            if len(errors) > 10:
                errors.append("... additional errors truncated")
                break

    conn.commit()
    cur.close()
    conn.close()

    result = {
        "message": "Import completed",
        "imported": imported_count,
        "updated": updated_count,
        "skipped": skipped_count
    }

    if errors:
        result["errors"] = errors

    return result

# ============================================================
# USER SETTINGS
# ============================================================

@app.get("/user/settings")
async def get_user_settings(current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT settings FROM user_settings WHERE username = %s", (current_user['username'],))
    result = cur.fetchone()
    cur.close()
    conn.close()

    if result:
        return result['settings']
    else:
        return {"theme": "light", "textScale": 1.0, "columnVisibility": {}}

@app.post("/user/settings")
async def update_user_settings(settings: UserSettings, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cur = conn.cursor()

    settings_json = settings.dict()

    cur.execute("""
        INSERT INTO user_settings (username, settings)
        VALUES (%s, %s)
        ON CONFLICT (username) DO UPDATE SET settings = %s, updated_at = CURRENT_TIMESTAMP
    """, (current_user['username'], Json(settings_json), Json(settings_json)))

    conn.commit()
    cur.close()
    conn.close()

    return {"message": "Settings updated successfully"}

@app.put("/user/profile")
async def update_user_profile(profile: UserProfileUpdate, current_user: dict = Depends(get_current_user)):
    """Update current user's profile information"""
    conn = get_db_connection()
    cur = conn.cursor()

    # Build update query dynamically based on provided fields
    updates = []
    params = []

    if profile.full_name is not None:
        updates.append("full_name = %s")
        params.append(profile.full_name)
    if profile.email is not None:
        updates.append("email = %s")
        params.append(profile.email)
    if profile.phone is not None:
        updates.append("phone = %s")
        params.append(profile.phone)
    if profile.license_number is not None:
        updates.append("license_number = %s")
        params.append(profile.license_number)
    if profile.license_expiration is not None:
        if profile.license_expiration == "":
            updates.append("license_expiration = NULL")
        else:
            updates.append("license_expiration = %s")
            params.append(profile.license_expiration)

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    params.append(current_user['username'])

    cur.execute(f"""
        UPDATE users SET {', '.join(updates)}
        WHERE username = %s
    """, params)

    conn.commit()
    cur.close()
    conn.close()

    return {"message": "Profile updated successfully"}

@app.post("/user/change-password")
@limiter.limit("3/minute")  # Strict limit on password changes
async def change_user_password(request: Request, password_data: PasswordChange, current_user: dict = Depends(get_current_user)):
    """Change current user's password"""
    conn = get_db_connection()
    cur = conn.cursor()

    # Get current password hash
    cur.execute("SELECT password FROM users WHERE username = %s", (current_user['username'],))
    result = cur.fetchone()

    if not result:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")

    # Verify current password
    if not bcrypt.checkpw(password_data.current_password.encode('utf-8'), result['password'].encode('utf-8')):
        cur.close()
        conn.close()
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    # Hash new password
    new_hash = bcrypt.hashpw(password_data.new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    # Update password
    cur.execute("UPDATE users SET password = %s WHERE username = %s", (new_hash, current_user['username']))

    conn.commit()
    cur.close()
    conn.close()

    return {"message": "Password changed successfully"}

# ============================================================
# COMMUNICATION SETTINGS (Email/SMS)
# ============================================================

from communication_service import (
    EmailService, SMSService, SMSGatewayService, encrypt_config, decrypt_config, mask_config,
    log_communication, get_email_template, render_template, TWILIO_AVAILABLE, CARRIER_GATEWAYS,
    get_email_service
)

# Import notification service for sending in-app + email notifications
from notification_service import (
    notify_user, notify_admins_and_managers,
    notify_pto_request_submitted, notify_pto_request_approved, notify_pto_request_denied,
    notify_job_assigned, notify_callout
)

class EmailSettingsInput(BaseModel):
    host: str = Field(..., description="SMTP server hostname")
    port: int = Field(587, description="SMTP port")
    username: str = Field(..., description="SMTP username")
    password: Optional[str] = Field(None, description="SMTP password (leave empty to keep existing)")
    use_tls: bool = Field(True, description="Use STARTTLS")
    use_ssl: bool = Field(False, description="Use SSL instead of TLS")
    from_name: str = Field("Pem2 Services", description="Sender display name")
    from_email: str = Field(..., description="Sender email address")
    is_active: bool = Field(True, description="Enable email sending")

class SMSSettingsInput(BaseModel):
    account_sid: str = Field(..., description="Twilio Account SID")
    auth_token: Optional[str] = Field(None, description="Twilio Auth Token (leave empty to keep existing)")
    from_number: str = Field(..., description="Twilio phone number (+1XXXXXXXXXX)")
    is_active: bool = Field(True, description="Enable SMS sending")

class TestEmailInput(BaseModel):
    to_email: str = Field(..., description="Email address to send test to")

class TestSMSInput(BaseModel):
    to_phone: str = Field(..., description="Phone number to send test to")

class SMSGatewaySettingsInput(BaseModel):
    """Settings for Email-to-SMS Gateway (free, uses carrier email gateways)."""
    is_active: bool = Field(True, description="Enable SMS via email gateway")

class TestSMSGatewayInput(BaseModel):
    """Test SMS via carrier email gateway."""
    to_phone: str = Field(..., description="Phone number to send test to (10 digits)")
    carrier: str = Field(..., description="Carrier code (e.g., 'att', 'verizon', 'tmobile')")


def require_admin_or_manager(current_user: dict):
    """Check if user is admin or manager."""
    if current_user['role'] not in ['admin', 'manager']:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")


@app.get("/settings/communication")
async def get_communication_settings(current_user: dict = Depends(get_current_user)):
    """Get all communication settings (passwords masked)."""
    require_admin_or_manager(current_user)

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT id, setting_type, provider, config, is_active,
                   test_status, test_message, last_tested_at,
                   updated_by, updated_at
            FROM communication_settings
            ORDER BY setting_type, provider
        """)
        settings = cur.fetchall()

        result = {
            'email': None,
            'sms_gateway': None,  # Email-to-SMS gateway (free)
            'sms_twilio': None,   # Twilio SMS (paid)
            'twilio_available': TWILIO_AVAILABLE,
            'carriers': [
                {'code': code, 'name': info['name']}
                for code, info in sorted(CARRIER_GATEWAYS.items(), key=lambda x: x[1]['name'])
            ]
        }

        for setting in settings:
            masked_config = mask_config(setting['config'] or {})
            setting_data = {
                'id': setting['id'],
                'provider': setting['provider'],
                'config': masked_config,
                'is_active': setting['is_active'],
                'test_status': setting['test_status'],
                'test_message': setting['test_message'],
                'last_tested_at': setting['last_tested_at'].isoformat() if setting['last_tested_at'] else None,
                'updated_by': setting['updated_by'],
                'updated_at': setting['updated_at'].isoformat() if setting['updated_at'] else None
            }

            if setting['setting_type'] == 'email':
                result['email'] = setting_data
            elif setting['setting_type'] == 'sms':
                if setting['provider'] == 'email_gateway':
                    result['sms_gateway'] = setting_data
                elif setting['provider'] == 'twilio':
                    result['sms_twilio'] = setting_data

        return result

    finally:
        cur.close()
        conn.close()


@app.post("/settings/communication/email")
async def save_email_settings(settings: EmailSettingsInput, current_user: dict = Depends(get_current_user)):
    """Save email (SMTP) settings."""
    require_admin_or_manager(current_user)

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get existing config to preserve password if not provided
        cur.execute("""
            SELECT config FROM communication_settings
            WHERE setting_type = 'email' AND provider = 'smtp'
        """)
        existing = cur.fetchone()

        # Build config
        config = {
            'host': settings.host,
            'port': settings.port,
            'username': settings.username,
            'use_tls': settings.use_tls,
            'use_ssl': settings.use_ssl,
            'from_name': settings.from_name,
            'from_email': settings.from_email
        }

        # Handle password
        if settings.password:
            config['password'] = settings.password
        elif existing and existing['config']:
            # Keep existing password
            existing_config = existing['config']
            if 'password' in existing_config:
                config['password'] = existing_config['password']

        # Encrypt sensitive fields
        encrypted_config = encrypt_config(config)

        # Upsert settings
        cur.execute("""
            INSERT INTO communication_settings (setting_type, provider, config, is_active, updated_by, updated_at)
            VALUES ('email', 'smtp', %s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (setting_type, provider) DO UPDATE SET
                config = EXCLUDED.config,
                is_active = EXCLUDED.is_active,
                updated_by = EXCLUDED.updated_by,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id
        """, (Json(encrypted_config), settings.is_active, current_user['username']))

        setting_id = cur.fetchone()['id']
        conn.commit()

        return {"message": "Email settings saved successfully", "id": setting_id}

    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save email settings: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.post("/settings/communication/email/test")
async def test_email_settings(test_input: TestEmailInput, current_user: dict = Depends(get_current_user)):
    """Test email configuration by sending a test email."""
    require_admin_or_manager(current_user)

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get email settings
        cur.execute("""
            SELECT config FROM communication_settings
            WHERE setting_type = 'email' AND provider = 'smtp'
        """)
        setting = cur.fetchone()

        if not setting or not setting['config']:
            raise HTTPException(status_code=400, detail="Email not configured. Please save settings first.")

        # Create email service and test
        email_service = EmailService(setting['config'])

        # First test connection
        success, message = email_service.test_connection()

        if success:
            # Send test email
            test_html = f"""
            <html>
            <body style="font-family: Arial, sans-serif;">
                <h2 style="color: #1e3a5f;">Email Configuration Test</h2>
                <p>This is a test email from MA Electrical Inventory system.</p>
                <p>If you receive this, your email configuration is working correctly!</p>
                <p style="color: gray; font-size: 12px;">
                    Tested by: {current_user['username']}<br>
                    Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
                </p>
            </body>
            </html>
            """
            send_success, send_message, _ = email_service.send_email(
                test_input.to_email,
                "Test Email from MA Electrical",
                test_html
            )

            if send_success:
                message = f"Test email sent successfully to {test_input.to_email}"
                test_status = 'success'
            else:
                message = send_message
                test_status = 'failed'
                success = False
        else:
            test_status = 'failed'

        # Update test status
        cur.execute("""
            UPDATE communication_settings
            SET test_status = %s, test_message = %s, last_tested_at = CURRENT_TIMESTAMP
            WHERE setting_type = 'email' AND provider = 'smtp'
        """, (test_status, message))
        conn.commit()

        return {"success": success, "message": message}

    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "message": str(e)}
    finally:
        cur.close()
        conn.close()


@app.post("/settings/communication/sms")
async def save_sms_settings(settings: SMSSettingsInput, current_user: dict = Depends(get_current_user)):
    """Save SMS (Twilio) settings."""
    require_admin_or_manager(current_user)

    if not TWILIO_AVAILABLE:
        raise HTTPException(status_code=400, detail="Twilio library not installed on server")

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get existing config to preserve auth_token if not provided
        cur.execute("""
            SELECT config FROM communication_settings
            WHERE setting_type = 'sms' AND provider = 'twilio'
        """)
        existing = cur.fetchone()

        # Build config
        config = {
            'account_sid': settings.account_sid,
            'from_number': settings.from_number
        }

        # Handle auth token
        if settings.auth_token:
            config['auth_token'] = settings.auth_token
        elif existing and existing['config']:
            existing_config = existing['config']
            if 'auth_token' in existing_config:
                config['auth_token'] = existing_config['auth_token']

        # Encrypt sensitive fields
        encrypted_config = encrypt_config(config)

        # Upsert settings
        cur.execute("""
            INSERT INTO communication_settings (setting_type, provider, config, is_active, updated_by, updated_at)
            VALUES ('sms', 'twilio', %s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (setting_type, provider) DO UPDATE SET
                config = EXCLUDED.config,
                is_active = EXCLUDED.is_active,
                updated_by = EXCLUDED.updated_by,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id
        """, (Json(encrypted_config), settings.is_active, current_user['username']))

        setting_id = cur.fetchone()['id']
        conn.commit()

        return {"message": "SMS settings saved successfully", "id": setting_id}

    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save SMS settings: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.post("/settings/communication/sms/test")
async def test_sms_settings(test_input: TestSMSInput, current_user: dict = Depends(get_current_user)):
    """Test SMS configuration by sending a test message."""
    require_admin_or_manager(current_user)

    if not TWILIO_AVAILABLE:
        raise HTTPException(status_code=400, detail="Twilio library not installed on server")

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get SMS settings
        cur.execute("""
            SELECT config FROM communication_settings
            WHERE setting_type = 'sms' AND provider = 'twilio'
        """)
        setting = cur.fetchone()

        if not setting or not setting['config']:
            raise HTTPException(status_code=400, detail="SMS not configured. Please save settings first.")

        # Create SMS service and test
        sms_service = SMSService(setting['config'])

        # Test connection first
        success, message = sms_service.test_connection()

        if success:
            # Send test SMS
            test_message = f"MA Electrical: Test SMS. If you receive this, SMS is configured correctly! Tested by {current_user['username']}"
            send_success, send_message, _ = sms_service.send_sms(
                test_input.to_phone,
                test_message
            )

            if send_success:
                message = f"Test SMS sent successfully to {test_input.to_phone}"
                test_status = 'success'
            else:
                message = send_message
                test_status = 'failed'
                success = False
        else:
            test_status = 'failed'

        # Update test status
        cur.execute("""
            UPDATE communication_settings
            SET test_status = %s, test_message = %s, last_tested_at = CURRENT_TIMESTAMP
            WHERE setting_type = 'sms' AND provider = 'twilio'
        """, (test_status, message))
        conn.commit()

        return {"success": success, "message": message}

    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "message": str(e)}
    finally:
        cur.close()
        conn.close()


# ============================================================
# SMS GATEWAY ENDPOINTS (Free Email-to-SMS via carrier gateways)
# ============================================================

@app.post("/settings/communication/sms-gateway")
async def save_sms_gateway_settings(settings: SMSGatewaySettingsInput, current_user: dict = Depends(get_current_user)):
    """Save SMS Gateway settings (uses email to send SMS - requires email to be configured first)."""
    require_admin_or_manager(current_user)

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Check if email is configured
        cur.execute("""
            SELECT id FROM communication_settings
            WHERE setting_type = 'email' AND provider = 'smtp' AND is_active = true
        """)
        email_setting = cur.fetchone()

        if not email_setting:
            raise HTTPException(
                status_code=400,
                detail="Email must be configured and active before enabling SMS Gateway. Configure your email settings first."
            )

        # Upsert gateway settings (minimal config - just uses email)
        config = {'provider': 'email_gateway'}

        cur.execute("""
            INSERT INTO communication_settings (setting_type, provider, config, is_active, updated_by, updated_at)
            VALUES ('sms', 'email_gateway', %s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (setting_type, provider) DO UPDATE SET
                config = EXCLUDED.config,
                is_active = EXCLUDED.is_active,
                updated_by = EXCLUDED.updated_by,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id
        """, (Json(config), settings.is_active, current_user['username']))

        setting_id = cur.fetchone()['id']
        conn.commit()

        return {"message": "SMS Gateway enabled successfully. SMS will be sent via your email settings.", "id": setting_id}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save SMS Gateway settings: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.post("/settings/communication/sms-gateway/test")
async def test_sms_gateway_settings(test_input: TestSMSGatewayInput, current_user: dict = Depends(get_current_user)):
    """Test SMS Gateway by sending a test message via carrier email gateway."""
    require_admin_or_manager(current_user)

    # Validate carrier
    if test_input.carrier not in CARRIER_GATEWAYS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid carrier: {test_input.carrier}. Valid carriers: {', '.join(CARRIER_GATEWAYS.keys())}"
        )

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get email service
        email_service = get_email_service(conn)
        if not email_service:
            raise HTTPException(
                status_code=400,
                detail="Email not configured. Configure and test email settings first."
            )

        # Create gateway service and test
        gateway_service = SMSGatewayService(email_service)

        # Test connection (email connection)
        success, message = gateway_service.test_connection()

        if success:
            # Send test SMS
            carrier_name = CARRIER_GATEWAYS[test_input.carrier]['name']
            test_message = f"MA Electrical: Test SMS via {carrier_name} gateway. Tested by {current_user['username']}"
            send_success, send_message, _ = gateway_service.send_sms(
                test_input.to_phone,
                test_input.carrier,
                test_message
            )

            if send_success:
                message = f"Test SMS sent to {test_input.to_phone} via {carrier_name} gateway"
                test_status = 'success'
            else:
                message = send_message
                test_status = 'failed'
                success = False
        else:
            test_status = 'failed'

        # Update test status for gateway
        cur.execute("""
            UPDATE communication_settings
            SET test_status = %s, test_message = %s, last_tested_at = CURRENT_TIMESTAMP
            WHERE setting_type = 'sms' AND provider = 'email_gateway'
        """, (test_status, message))
        conn.commit()

        return {"success": success, "message": message}

    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "message": str(e)}
    finally:
        cur.close()
        conn.close()


@app.get("/settings/communication/carriers")
async def get_carriers(current_user: dict = Depends(get_current_user)):
    """Get list of supported mobile carriers for SMS Gateway."""
    require_admin_or_manager(current_user)

    return {
        'carriers': [
            {'code': code, 'name': info['name']}
            for code, info in sorted(CARRIER_GATEWAYS.items(), key=lambda x: x[1]['name'])
        ]
    }


@app.delete("/settings/communication/{setting_type}")
async def delete_communication_setting(setting_type: str, current_user: dict = Depends(get_current_user)):
    """Delete/disable a communication setting."""
    require_admin_or_manager(current_user)

    if setting_type not in ['email', 'sms']:
        raise HTTPException(status_code=400, detail="Invalid setting type. Use 'email' or 'sms'")

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            DELETE FROM communication_settings
            WHERE setting_type = %s
        """, (setting_type,))

        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"{setting_type} settings not found")

        conn.commit()
        return {"message": f"{setting_type} settings deleted successfully"}

    finally:
        cur.close()
        conn.close()


@app.get("/settings/communication/templates")
async def get_email_templates(current_user: dict = Depends(get_current_user)):
    """Get all email templates."""
    require_admin_or_manager(current_user)

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT id, template_key, template_name, subject_template, body_template,
                   description, is_active, updated_by, updated_at
            FROM email_templates
            ORDER BY template_key
        """)
        templates = cur.fetchall()

        return [
            {
                'id': t['id'],
                'key': t['template_key'],
                'name': t['template_name'],
                'subject': t['subject_template'],
                'body': t['body_template'],
                'description': t['description'],
                'is_active': t['is_active'],
                'updated_by': t['updated_by'],
                'updated_at': t['updated_at'].isoformat() if t['updated_at'] else None
            }
            for t in templates
        ]

    finally:
        cur.close()
        conn.close()


@app.get("/settings/communication/log")
async def get_communication_log(
    communication_type: Optional[str] = None,
    status: Optional[str] = None,
    related_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get communication log entries."""
    require_admin_or_manager(current_user)

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        query = "SELECT * FROM communication_log WHERE 1=1"
        params = []

        if communication_type:
            query += " AND communication_type = %s"
            params.append(communication_type)
        if status:
            query += " AND status = %s"
            params.append(status)
        if related_type:
            query += " AND related_type = %s"
            params.append(related_type)

        query += " ORDER BY sent_at DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])

        cur.execute(query, params)
        logs = cur.fetchall()

        return [
            {
                'id': log['id'],
                'type': log['communication_type'],
                'recipient': log['recipient_address'],
                'subject': log['subject'],
                'preview': log['message_preview'],
                'related_type': log['related_type'],
                'related_id': log['related_id'],
                'status': log['status'],
                'error': log['error_message'],
                'sent_by': log['sent_by'],
                'sent_at': log['sent_at'].isoformat() if log['sent_at'] else None
            }
            for log in logs
        ]

    finally:
        cur.close()
        conn.close()


# ============================================================
# NOTIFICATIONS
# ============================================================

@app.get("/notifications")
async def get_notifications(
    unread_only: bool = False,
    notification_type: str = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get notifications for the current user"""
    conn = get_db_connection()
    cur = conn.cursor()

    query = """
        SELECT id, target_username, notification_type, notification_subtype,
               title, message, severity, related_entity_type, related_entity_id,
               action_url, is_read, read_at, created_at, expires_at
        FROM notifications
        WHERE (target_username = %s OR target_username IS NULL)
          AND is_dismissed = FALSE
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    """
    params = [current_user['username']]

    if unread_only:
        query += " AND is_read = FALSE"

    if notification_type:
        query += " AND notification_type = %s"
        params.append(notification_type)

    query += " ORDER BY created_at DESC LIMIT %s"
    params.append(limit)

    cur.execute(query, params)
    notifications = cur.fetchall()

    # Get unread count
    cur.execute("""
        SELECT COUNT(*) as count FROM notifications
        WHERE (target_username = %s OR target_username IS NULL)
          AND is_read = FALSE
          AND is_dismissed = FALSE
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    """, (current_user['username'],))
    unread_count = cur.fetchone()['count']

    cur.close()
    conn.close()

    return {
        "notifications": notifications,
        "unread_count": unread_count
    }

@app.get("/notifications/count")
async def get_notification_count(current_user: dict = Depends(get_current_user)):
    """Get unread notification count (lightweight endpoint for badge)"""
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT COUNT(*) as count FROM notifications
        WHERE (target_username = %s OR target_username IS NULL)
          AND is_read = FALSE
          AND is_dismissed = FALSE
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    """, (current_user['username'],))
    result = cur.fetchone()

    cur.close()
    conn.close()

    return {"unread_count": result['count']}

@app.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Mark a notification as read"""
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        UPDATE notifications
        SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
        WHERE id = %s AND (target_username = %s OR target_username IS NULL)
    """, (notification_id, current_user['username']))

    conn.commit()
    cur.close()
    conn.close()

    return {"message": "Notification marked as read"}

@app.post("/notifications/read-all")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read for the current user"""
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        UPDATE notifications
        SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
        WHERE (target_username = %s OR target_username IS NULL)
          AND is_read = FALSE
    """, (current_user['username'],))

    affected = cur.rowcount
    conn.commit()
    cur.close()
    conn.close()

    return {"message": f"Marked {affected} notifications as read"}

@app.post("/notifications/{notification_id}/dismiss")
async def dismiss_notification(
    notification_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Dismiss a notification (hide it permanently)"""
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        UPDATE notifications
        SET is_dismissed = TRUE, dismissed_at = CURRENT_TIMESTAMP
        WHERE id = %s AND (target_username = %s OR target_username IS NULL)
    """, (notification_id, current_user['username']))

    conn.commit()
    cur.close()
    conn.close()

    return {"message": "Notification dismissed"}

@app.post("/notifications/generate")
async def generate_notifications(current_user: dict = Depends(get_current_user)):
    """
    Generate system notifications (low stock, license expiration, etc.)
    This can be called manually or scheduled via cron.
    Only admins/managers should be able to trigger this.
    """
    if current_user['role'] not in ['admin', 'manager']:
        raise HTTPException(status_code=403, detail="Not authorized")

    conn = get_db_connection()
    cur = conn.cursor()
    notifications_created = 0

    # 1. LOW STOCK NOTIFICATIONS
    cur.execute("""
        SELECT id, item_id, description, qty, min_stock, location
        FROM inventory
        WHERE qty <= min_stock AND active = TRUE
    """)
    low_stock_items = cur.fetchall()

    for item in low_stock_items:
        dedup_key = f"low_stock_{item['id']}"

        # Check if notification already exists and is not dismissed
        cur.execute("""
            SELECT id FROM notifications
            WHERE dedup_key = %s AND is_dismissed = FALSE
        """, (dedup_key,))

        if not cur.fetchone():
            cur.execute("""
                INSERT INTO notifications (
                    target_username, notification_type, notification_subtype,
                    title, message, severity, related_entity_type, related_entity_id,
                    action_url, dedup_key, expires_at
                ) VALUES (
                    NULL, 'inventory', 'low_stock',
                    %s, %s, 'warning', 'inventory', %s,
                    %s, %s, CURRENT_TIMESTAMP + INTERVAL '7 days'
                )
                ON CONFLICT (dedup_key) DO NOTHING
            """, (
                f"Low Stock: {item['description']}",
                f"{item['item_id']} - {item['description']} has {item['qty']} units (min: {item['min_stock']}). Location: {item['location'] or 'N/A'}",
                item['id'],
                f"/inventory?search={item['item_id']}",
                dedup_key
            ))
            if cur.rowcount > 0:
                notifications_created += 1

    # 2. LICENSE EXPIRATION NOTIFICATIONS
    # Alert for licenses expiring in 30, 14, 7 days, or already expired
    cur.execute("""
        SELECT username, full_name, license_number, license_expiration,
               (license_expiration - CURRENT_DATE) as days_until
        FROM users
        WHERE license_expiration IS NOT NULL
          AND active = TRUE
          AND license_expiration <= CURRENT_DATE + INTERVAL '30 days'
    """)
    expiring_licenses = cur.fetchall()

    for user in expiring_licenses:
        days = int(user['days_until']) if user['days_until'] else 0

        if days < 0:
            severity = 'error'
            title = f"License EXPIRED: {user['full_name'] or user['username']}"
            message = f"License #{user['license_number']} expired {abs(days)} days ago!"
            subtype = 'expired'
        elif days <= 7:
            severity = 'error'
            title = f"License Expiring Soon: {user['full_name'] or user['username']}"
            message = f"License #{user['license_number']} expires in {days} days!"
            subtype = 'expiring_urgent'
        elif days <= 14:
            severity = 'warning'
            title = f"License Expiring: {user['full_name'] or user['username']}"
            message = f"License #{user['license_number']} expires in {days} days."
            subtype = 'expiring_soon'
        else:  # 15-30 days
            severity = 'info'
            title = f"License Reminder: {user['full_name'] or user['username']}"
            message = f"License #{user['license_number']} expires in {days} days."
            subtype = 'expiring_notice'

        dedup_key = f"license_{user['username']}_{subtype}"

        cur.execute("""
            SELECT id FROM notifications
            WHERE dedup_key = %s AND is_dismissed = FALSE
        """, (dedup_key,))

        if not cur.fetchone():
            cur.execute("""
                INSERT INTO notifications (
                    target_username, notification_type, notification_subtype,
                    title, message, severity, related_entity_type,
                    action_url, dedup_key, expires_at
                ) VALUES (
                    NULL, 'license', %s,
                    %s, %s, %s, 'user',
                    %s, %s, %s
                )
                ON CONFLICT (dedup_key) DO NOTHING
            """, (
                subtype,
                title,
                message,
                severity,
                '/admin/users',
                dedup_key,
                user['license_expiration']
            ))
            if cur.rowcount > 0:
                notifications_created += 1

    # 3. OVERDUE WORK ORDERS (jobs past scheduled date that aren't completed)
    cur.execute("""
        SELECT wo.id, wo.work_order_number, wo.job_description, wo.scheduled_date,
               c.first_name || ' ' || c.last_name as customer_name
        FROM work_orders wo
        JOIN customers c ON wo.customer_id = c.id
        WHERE wo.status NOT IN ('completed', 'cancelled', 'invoiced')
          AND wo.scheduled_date < CURRENT_DATE
    """)
    overdue_orders = cur.fetchall()

    for wo in overdue_orders:
        dedup_key = f"overdue_wo_{wo['id']}"

        cur.execute("""
            SELECT id FROM notifications
            WHERE dedup_key = %s AND is_dismissed = FALSE
        """, (dedup_key,))

        if not cur.fetchone():
            cur.execute("""
                INSERT INTO notifications (
                    target_username, notification_type, notification_subtype,
                    title, message, severity, related_entity_type, related_entity_id,
                    action_url, dedup_key, expires_at
                ) VALUES (
                    NULL, 'work_order', 'overdue',
                    %s, %s, 'warning', 'work_order', %s,
                    %s, %s, CURRENT_TIMESTAMP + INTERVAL '7 days'
                )
                ON CONFLICT (dedup_key) DO NOTHING
            """, (
                f"Overdue: WO #{wo['work_order_number']}",
                f"Work order for {wo['customer_name']} was scheduled for {wo['scheduled_date']}",
                wo['id'],
                f"/work-orders/{wo['id']}",
                dedup_key
            ))
            if cur.rowcount > 0:
                notifications_created += 1

    # 4. UPCOMING UNSCHEDULED WORK ORDERS
    # Jobs with scheduled_date coming up (within 3 days) but status is still 'pending' (no crew/schedule assigned)
    cur.execute("""
        SELECT wo.id, wo.work_order_number, wo.job_description, wo.scheduled_date,
               c.first_name || ' ' || c.last_name as customer_name,
               (wo.scheduled_date - CURRENT_DATE) as days_until
        FROM work_orders wo
        JOIN customers c ON wo.customer_id = c.id
        WHERE wo.status = 'pending'
          AND wo.scheduled_date IS NOT NULL
          AND wo.scheduled_date <= CURRENT_DATE + INTERVAL '3 days'
          AND wo.scheduled_date >= CURRENT_DATE
    """)
    upcoming_unscheduled = cur.fetchall()

    for wo in upcoming_unscheduled:
        days = int(wo['days_until']) if wo['days_until'] is not None else 0
        dedup_key = f"upcoming_unscheduled_wo_{wo['id']}"

        # Determine severity based on how soon the date is
        if days == 0:
            severity = 'error'
            time_msg = "TODAY"
        elif days == 1:
            severity = 'error'
            time_msg = "TOMORROW"
        else:
            severity = 'warning'
            time_msg = f"in {days} days"

        cur.execute("""
            SELECT id FROM notifications
            WHERE dedup_key = %s AND is_dismissed = FALSE
        """, (dedup_key,))

        if not cur.fetchone():
            cur.execute("""
                INSERT INTO notifications (
                    target_username, notification_type, notification_subtype,
                    title, message, severity, related_entity_type, related_entity_id,
                    action_url, dedup_key, expires_at
                ) VALUES (
                    NULL, 'work_order', 'upcoming_unscheduled',
                    %s, %s, %s, 'work_order', %s,
                    %s, %s, %s::date + INTERVAL '1 day'
                )
                ON CONFLICT (dedup_key) DO NOTHING
            """, (
                f"Unscheduled Job {time_msg}: WO #{wo['work_order_number']}",
                f"Work order for {wo['customer_name']} is scheduled for {wo['scheduled_date']} but has no crew assigned. Please assign crew in the Schedule module.",
                severity,
                wo['id'],
                f"/work-orders/{wo['id']}",
                dedup_key,
                wo['scheduled_date']
            ))
            if cur.rowcount > 0:
                notifications_created += 1

    conn.commit()
    cur.close()
    conn.close()

    return {
        "message": f"Generated {notifications_created} new notifications",
        "notifications_created": notifications_created
    }

# ============================================================
# PURCHASE ORDER MANAGEMENT
# ============================================================

class PurchaseOrderCreate(BaseModel):
    vendor_id: int
    notes: Optional[str] = None
    items: list  # List of {inventory_id, quantity_ordered, unit_cost}

class PurchaseOrderUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None

class ReceiveItemsRequest(BaseModel):
    items: list  # List of {purchase_order_item_id, quantity_received}

@app.get("/purchase-orders")
async def get_purchase_orders(
    status: Optional[str] = None,
    vendor_id: Optional[int] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get all purchase orders with optional filters and pagination"""
    require_admin_access(current_user)

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        base_query = """
            FROM purchase_orders po
            LEFT JOIN vendors v ON po.vendor_id = v.id
            WHERE 1=1
        """
        params = []

        if status:
            base_query += " AND po.status = %s"
            params.append(status)
        if vendor_id:
            base_query += " AND po.vendor_id = %s"
            params.append(vendor_id)
        if search:
            base_query += " AND (po.po_number ILIKE %s OR v.vendor_name ILIKE %s)"
            search_param = f"%{search}%"
            params.extend([search_param, search_param])

        # Get total count
        cur.execute(f"SELECT COUNT(*) as total {base_query}", params)
        total = cur.fetchone()['total']

        # Get paginated results
        select_query = f"""
            SELECT
                po.*,
                v.vendor_name,
                v.email as vendor_email,
                v.phone as vendor_phone,
                (SELECT COUNT(*) FROM purchase_order_items WHERE purchase_order_id = po.id) as item_count,
                (SELECT COALESCE(SUM(quantity_ordered * unit_cost), 0)
                 FROM purchase_order_items WHERE purchase_order_id = po.id) as total_amount,
                (SELECT COALESCE(SUM(quantity_received), 0)
                 FROM purchase_order_items WHERE purchase_order_id = po.id) as total_received
            {base_query}
            ORDER BY po.created_at DESC
            LIMIT %s OFFSET %s
        """
        params.extend([limit, offset])

        cur.execute(select_query, params)
        orders = cur.fetchall()

        # Convert to list of dicts and handle dates
        results = []
        for order in orders:
            o = dict(order)
            if o.get('created_at'):
                o['created_at'] = str(o['created_at'])
            if o.get('updated_at'):
                o['updated_at'] = str(o['updated_at'])
            if o.get('order_date'):
                o['order_date'] = str(o['order_date'])
            if o.get('expected_date'):
                o['expected_date'] = str(o['expected_date'])
            if o.get('received_date'):
                o['received_date'] = str(o['received_date'])
            if o.get('approved_at'):
                o['approved_at'] = str(o['approved_at'])
            if o.get('total_amount'):
                o['total_amount'] = float(o['total_amount'])
            results.append(o)

        return {
            "purchase_orders": results,
            "total": total,
            "limit": limit,
            "offset": offset
        }
    finally:
        cur.close()
        conn.close()


@app.get("/purchase-orders/{po_id}")
async def get_purchase_order(
    po_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get single purchase order with line items"""
    require_admin_access(current_user)

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get PO header
        cur.execute("""
            SELECT
                po.*,
                v.vendor_name,
                v.email as vendor_email,
                v.phone as vendor_phone,
                CONCAT(v.street, ', ', v.city, ', ', v.state, ' ', v.zip) as vendor_address
            FROM purchase_orders po
            LEFT JOIN vendors v ON po.vendor_id = v.id
            WHERE po.id = %s
        """, (po_id,))

        po = cur.fetchone()
        if not po:
            raise HTTPException(status_code=404, detail="Purchase order not found")

        po_dict = dict(po)

        # Get line items
        cur.execute("""
            SELECT
                poi.*,
                i.item_id,
                i.description,
                i.brand,
                i.category,
                i.qty as current_stock
            FROM purchase_order_items poi
            JOIN inventory i ON poi.inventory_id = i.id
            WHERE poi.purchase_order_id = %s
            ORDER BY poi.id
        """, (po_id,))

        items = cur.fetchall()

        # Convert items
        item_list = []
        for item in items:
            i = dict(item)
            if i.get('received_date'):
                i['received_date'] = str(i['received_date'])
            if i.get('created_at'):
                i['created_at'] = str(i['created_at'])
            if i.get('unit_cost'):
                i['unit_cost'] = float(i['unit_cost'])
            if i.get('line_total'):
                i['line_total'] = float(i['line_total'])
            if i.get('linked_work_order_ids'):
                i['linked_work_order_ids'] = list(i['linked_work_order_ids']) if i['linked_work_order_ids'] else []
            item_list.append(i)

        po_dict['items'] = item_list
        po_dict['total_amount'] = sum(i.get('line_total', 0) or 0 for i in item_list)

        # Handle dates
        for key in ['created_at', 'updated_at', 'order_date', 'expected_date', 'received_date', 'approved_at']:
            if po_dict.get(key):
                po_dict[key] = str(po_dict[key])

        return po_dict
    finally:
        cur.close()
        conn.close()


@app.post("/purchase-orders")
async def create_purchase_order(
    po_data: PurchaseOrderCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new purchase order with line items"""
    require_admin_access(current_user)

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Generate PO number
        year = date.today().year
        cur.execute("""
            SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 'PO-[0-9]{4}-([0-9]+)') AS INTEGER)), 0) + 1 AS next_num
            FROM purchase_orders
            WHERE po_number LIKE %s
        """, (f'PO-{year}-%',))
        result = cur.fetchone()
        next_num = result['next_num'] if result else 1
        po_number = f"PO-{year}-{next_num:04d}"

        # Create PO header
        cur.execute("""
            INSERT INTO purchase_orders (po_number, vendor_id, status, notes, created_by)
            VALUES (%s, %s, 'draft', %s, %s)
            RETURNING id
        """, (po_number, po_data.vendor_id, po_data.notes, current_user.get('username')))

        result = cur.fetchone()
        po_id = result['id']

        # Add line items
        for item in po_data.items:
            cur.execute("""
                INSERT INTO purchase_order_items (
                    purchase_order_id, inventory_id, quantity_ordered, unit_cost
                ) VALUES (%s, %s, %s, %s)
            """, (po_id, item['inventory_id'], item['quantity_ordered'], item['unit_cost']))

        conn.commit()

        return {
            "message": "Purchase order created successfully",
            "id": po_id,
            "po_number": po_number
        }
    except Exception as e:
        conn.rollback()
        log_and_raise(e, "Failed to create PO: ...")
    finally:
        cur.close()
        conn.close()


@app.post("/purchase-orders/from-shortages")
async def create_po_from_shortages(
    vendor_id: int,
    days_ahead: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """
    Auto-generate a purchase order from shortage report for a specific vendor.
    Creates PO with all items that are short and assigned to this vendor.
    """
    require_admin_access(current_user)

    conn = get_db_connection()
    cur = conn.cursor()

    end_date = date.today() + timedelta(days=days_ahead)

    try:
        # Get shortage items for this vendor
        cur.execute("""
            WITH shortage_items AS (
                SELECT
                    i.id as inventory_id,
                    i.item_id,
                    i.description,
                    i.cost,
                    i.qty_available,
                    MIN(wo.start_date) as first_needed_date,
                    SUM(jm.quantity_needed - jm.quantity_allocated) as total_needed,
                    GREATEST(0, SUM(jm.quantity_needed - jm.quantity_allocated) - i.qty_available) as shortage_qty,
                    array_agg(DISTINCT wo.id) as work_order_ids
                FROM job_materials_used jm
                JOIN inventory i ON jm.inventory_id = i.id
                JOIN work_orders wo ON jm.work_order_id = wo.id
                WHERE wo.status IN ('pending', 'scheduled', 'in_progress')
                  AND wo.start_date IS NOT NULL
                  AND wo.start_date BETWEEN CURRENT_DATE AND %s
                  AND jm.status IN ('planned', 'allocated')
                  AND i.active = TRUE
                  AND i.primary_vendor_id = %s
                GROUP BY i.id, i.item_id, i.description, i.cost, i.qty_available
                HAVING SUM(jm.quantity_needed - jm.quantity_allocated) > i.qty_available
            )
            SELECT * FROM shortage_items
            ORDER BY first_needed_date ASC
        """, (end_date, vendor_id))

        shortages = cur.fetchall()

        if not shortages:
            return {
                "message": "No shortages found for this vendor",
                "created": False
            }

        # Generate PO number
        year = date.today().year
        cur.execute("""
            SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 'PO-[0-9]{4}-([0-9]+)') AS INTEGER)), 0) + 1 AS next_num
            FROM purchase_orders
            WHERE po_number LIKE %s
        """, (f'PO-{year}-%',))
        result = cur.fetchone()
        next_num = result['next_num'] if result else 1
        po_number = f"PO-{year}-{next_num:04d}"

        # Create PO header
        cur.execute("""
            INSERT INTO purchase_orders (
                po_number, vendor_id, status, notes, created_by,
                triggered_by_projection, projection_end_date
            )
            VALUES (%s, %s, 'draft', %s, %s, TRUE, %s)
            RETURNING id
        """, (
            po_number,
            vendor_id,
            f"Auto-generated from shortage report for next {days_ahead} days",
            current_user.get('username'),
            end_date
        ))

        result = cur.fetchone()
        po_id = result['id']

        # Add line items
        total_items = 0
        total_cost = 0
        for item in shortages:
            shortage_qty = item['shortage_qty']
            unit_cost = float(item['cost']) if item['cost'] else 0
            work_order_ids = list(item['work_order_ids']) if item['work_order_ids'] else []

            cur.execute("""
                INSERT INTO purchase_order_items (
                    purchase_order_id, inventory_id, quantity_ordered,
                    unit_cost, linked_work_order_ids
                ) VALUES (%s, %s, %s, %s, %s::jsonb)
            """, (po_id, item['inventory_id'], shortage_qty, unit_cost, json.dumps(work_order_ids)))

            total_items += 1
            total_cost += shortage_qty * unit_cost

        conn.commit()

        return {
            "message": "Purchase order created from shortages",
            "created": True,
            "id": po_id,
            "po_number": po_number,
            "item_count": total_items,
            "total_estimated_cost": round(total_cost, 2)
        }
    except Exception as e:
        conn.rollback()
        log_and_raise(e, "Failed to create PO: ...")
    finally:
        cur.close()
        conn.close()


@app.patch("/purchase-orders/{po_id}")
async def update_purchase_order(
    po_id: int,
    update_data: PurchaseOrderUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update purchase order status or notes"""
    require_admin_access(current_user)

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get current PO
        cur.execute("SELECT * FROM purchase_orders WHERE id = %s", (po_id,))
        po = cur.fetchone()

        if not po:
            raise HTTPException(status_code=404, detail="Purchase order not found")

        updates = []
        params = []

        if update_data.status:
            valid_statuses = ['draft', 'pending_approval', 'approved', 'ordered', 'partial', 'received', 'cancelled']
            if update_data.status not in valid_statuses:
                raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

            updates.append("status = %s")
            params.append(update_data.status)

            # Set additional fields based on status
            if update_data.status == 'approved':
                updates.append("approved_by = %s")
                params.append(current_user.get('username'))
                updates.append("approved_at = CURRENT_TIMESTAMP")
            elif update_data.status == 'ordered':
                updates.append("order_date = CURRENT_DATE")
            elif update_data.status == 'received':
                updates.append("received_date = CURRENT_TIMESTAMP")

        if update_data.notes is not None:
            updates.append("notes = %s")
            params.append(update_data.notes)

        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.append(po_id)

            cur.execute(f"""
                UPDATE purchase_orders
                SET {', '.join(updates)}
                WHERE id = %s
            """, params)

            conn.commit()

        return {"message": "Purchase order updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        log_and_raise(e, "Failed to update PO: ...")
    finally:
        cur.close()
        conn.close()


@app.post("/purchase-orders/{po_id}/receive")
async def receive_items(
    po_id: int,
    receive_data: ReceiveItemsRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Record receipt of items from a purchase order.
    Updates inventory quantities and marks items as received.
    """
    require_admin_access(current_user)

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Verify PO exists and is in valid state
        cur.execute("SELECT * FROM purchase_orders WHERE id = %s", (po_id,))
        po = cur.fetchone()

        if not po:
            raise HTTPException(status_code=404, detail="Purchase order not found")

        if po['status'] not in ['ordered', 'partial']:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot receive items - PO status is '{po['status']}'. Must be 'ordered' or 'partial'."
            )

        received_items = []
        for item in receive_data.items:
            poi_id = item['purchase_order_item_id']
            qty_received = item['quantity_received']

            # Get PO item and linked inventory
            cur.execute("""
                SELECT poi.*, i.id as inv_id, i.qty as current_qty
                FROM purchase_order_items poi
                JOIN inventory i ON poi.inventory_id = i.id
                WHERE poi.id = %s AND poi.purchase_order_id = %s
            """, (poi_id, po_id))

            poi = cur.fetchone()
            if not poi:
                raise HTTPException(status_code=404, detail=f"PO item {poi_id} not found")

            # Calculate new received total
            already_received = poi['quantity_received'] or 0
            new_total_received = already_received + qty_received

            if new_total_received > poi['quantity_ordered']:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot receive {qty_received} - would exceed ordered quantity of {poi['quantity_ordered']}"
                )

            # Update PO item
            cur.execute("""
                UPDATE purchase_order_items
                SET quantity_received = %s,
                    received_date = CURRENT_TIMESTAMP,
                    received_by = %s
                WHERE id = %s
            """, (new_total_received, current_user.get('username'), poi_id))

            # Update inventory quantity atomically
            cur.execute("""
                UPDATE inventory SET qty = qty + %s WHERE id = %s
                RETURNING qty - %s as qty_before, qty as qty_after
            """, (qty_received, poi['inv_id'], qty_received))
            inv_result = cur.fetchone()
            qty_before = inv_result['qty_before']
            new_inv_qty = inv_result['qty_after']

            # Record stock transaction
            cur.execute("""
                INSERT INTO stock_transactions (
                    inventory_id, transaction_type, quantity_change,
                    quantity_before, quantity_after, reason, performed_by
                ) VALUES (%s, 'purchase_received', %s, %s, %s, %s, %s)
            """, (
                poi['inv_id'], qty_received, qty_before, new_inv_qty,
                f"Received from PO {po['po_number']}", current_user.get('username')
            ))

            received_items.append({
                "poi_id": poi_id,
                "inventory_id": poi['inv_id'],
                "quantity_received": qty_received,
                "new_inventory_qty": new_inv_qty
            })

        # Check if all items are fully received
        cur.execute("""
            SELECT
                COUNT(*) as total_items,
                SUM(CASE WHEN quantity_received >= quantity_ordered THEN 1 ELSE 0 END) as complete_items
            FROM purchase_order_items
            WHERE purchase_order_id = %s
        """, (po_id,))

        status_check = cur.fetchone()

        if status_check['total_items'] == status_check['complete_items']:
            # All items received - mark PO as received
            cur.execute("""
                UPDATE purchase_orders
                SET status = 'received', received_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (po_id,))
            new_po_status = 'received'
        else:
            # Partial receipt
            cur.execute("""
                UPDATE purchase_orders
                SET status = 'partial', updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (po_id,))
            new_po_status = 'partial'

        conn.commit()

        return {
            "message": "Items received successfully",
            "received_items": received_items,
            "po_status": new_po_status
        }
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        log_and_raise(e, "Failed to receive items: ...")
    finally:
        cur.close()
        conn.close()


@app.delete("/purchase-orders/{po_id}")
async def delete_purchase_order(
    po_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Delete a draft purchase order"""
    require_admin_access(current_user)

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("SELECT status FROM purchase_orders WHERE id = %s", (po_id,))
        po = cur.fetchone()

        if not po:
            raise HTTPException(status_code=404, detail="Purchase order not found")

        if po['status'] != 'draft':
            raise HTTPException(
                status_code=400,
                detail="Only draft purchase orders can be deleted"
            )

        cur.execute("DELETE FROM purchase_orders WHERE id = %s", (po_id,))
        conn.commit()

        return {"message": "Purchase order deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        log_and_raise(e, "Failed to delete PO: ...")
    finally:
        cur.close()
        conn.close()


@app.post("/purchase-orders/{po_id}/items")
async def add_po_item(
    po_id: int,
    inventory_id: int,
    quantity_ordered: int,
    unit_cost: float,
    current_user: dict = Depends(get_current_user)
):
    """Add an item to an existing draft purchase order"""
    require_admin_access(current_user)

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("SELECT status FROM purchase_orders WHERE id = %s", (po_id,))
        po = cur.fetchone()

        if not po:
            raise HTTPException(status_code=404, detail="Purchase order not found")

        if po['status'] != 'draft':
            raise HTTPException(status_code=400, detail="Can only add items to draft POs")

        cur.execute("""
            INSERT INTO purchase_order_items (
                purchase_order_id, inventory_id, quantity_ordered, unit_cost
            ) VALUES (%s, %s, %s, %s)
            RETURNING id
        """, (po_id, inventory_id, quantity_ordered, unit_cost))

        new_id = cur.fetchone()['id']
        conn.commit()

        return {"message": "Item added successfully", "id": new_id}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        log_and_raise(e, "Failed to add item: ...")
    finally:
        cur.close()
        conn.close()


@app.delete("/purchase-orders/{po_id}/items/{item_id}")
async def remove_po_item(
    po_id: int,
    item_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Remove an item from a draft purchase order"""
    require_admin_access(current_user)

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("SELECT status FROM purchase_orders WHERE id = %s", (po_id,))
        po = cur.fetchone()

        if not po:
            raise HTTPException(status_code=404, detail="Purchase order not found")

        if po['status'] != 'draft':
            raise HTTPException(status_code=400, detail="Can only remove items from draft POs")

        cur.execute("""
            DELETE FROM purchase_order_items
            WHERE id = %s AND purchase_order_id = %s
        """, (item_id, po_id))

        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Item not found in this PO")

        conn.commit()

        return {"message": "Item removed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        log_and_raise(e, "Failed to remove item: ...")
    finally:
        cur.close()
        conn.close()


# ============================================================
# VENDOR MANAGEMENT
# ============================================================

@app.get("/vendors")
async def get_vendors(
    current_user: dict = Depends(get_current_user),
    limit: int = 100,
    offset: int = 0,
    search: Optional[str] = None
):
    """Get all vendors with pagination"""
    conn = get_db_connection()
    cur = conn.cursor()

    where_clauses = []
    params = []

    if search:
        where_clauses.append("(vendor_name ILIKE %s OR email ILIKE %s OR phone ILIKE %s)")
        search_param = f"%{search}%"
        params.extend([search_param, search_param, search_param])

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    # Get total count
    cur.execute(f"SELECT COUNT(*) as total FROM vendors {where_sql}", params)
    total = cur.fetchone()['total']

    # Get paginated results
    params.extend([limit, offset])
    cur.execute(f"""
        SELECT * FROM vendors {where_sql}
        ORDER BY vendor_name ASC
        LIMIT %s OFFSET %s
    """, params)
    vendors = cur.fetchall()
    cur.close()
    conn.close()
    return {
        "vendors": vendors,
        "total": total,
        "limit": limit,
        "offset": offset
    }

@app.get("/vendors/{vendor_id}")
async def get_vendor(vendor_id: int, current_user: dict = Depends(get_current_user)):
    """Get single vendor by ID"""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM vendors WHERE id = %s", (vendor_id,))
    vendor = cur.fetchone()
    cur.close()
    conn.close()

    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor

# ============================================================
# DASHBOARD - Role-based job views
# ============================================================

@app.get("/dashboard/my-jobs")
async def get_my_dashboard_jobs(
    current_user: dict = Depends(get_current_user)
):
    """
    Get jobs for the current user's dashboard based on their role.
    """
    conn = get_db_connection()
    cur = conn.cursor()

    username = current_user.get('username')
    role = current_user.get('role')
    today = datetime.now().date().isoformat()

    if role == 'admin':
        cur.execute("""
            SELECT wo.id, wo.work_order_number, wo.job_description, wo.status,
                wo.job_type, wo.priority, wo.emergency_call, wo.scheduled_date,
                wo.assigned_to, wo.service_address, c.service_city, c.service_state,
                c.service_zip, c.first_name || ' ' || c.last_name as customer_name,
                c.phone_primary as customer_phone,
                COALESCE(jsd.start_time, '08:00') as scheduled_start_time,
                COALESCE(jsd.end_time, '16:30') as scheduled_end_time
            FROM work_orders wo
            JOIN customers c ON wo.customer_id = c.id
            LEFT JOIN job_schedule_dates jsd ON wo.id = jsd.work_order_id AND jsd.scheduled_date = %s
            WHERE wo.scheduled_date <= %s
              AND wo.status NOT IN ('completed', 'cancelled', 'invoiced', 'paid')
              AND wo.job_type != 'Service Call' AND wo.emergency_call IS NOT TRUE
            ORDER BY wo.scheduled_date ASC, COALESCE(jsd.start_time, '08:00') ASC
        """, (today, today))
    elif role == 'manager':
        # First, get the list of workers assigned to this manager
        cur.execute("""
            SELECT worker_username FROM manager_workers
            WHERE manager_username = %s AND active = true
        """, (username,))
        assigned_workers = [row['worker_username'] for row in cur.fetchall()]

        # If manager has assigned workers, filter by them; otherwise show all scheduled jobs
        if assigned_workers:
            # Manager sees jobs where they are assigned_to OR their workers are scheduled
            cur.execute("""
                SELECT DISTINCT ON (wo.id) wo.id, wo.work_order_number, wo.job_description,
                    wo.status, wo.job_type, wo.priority, wo.emergency_call, wo.scheduled_date,
                    wo.assigned_to, wo.service_address, c.service_city, c.service_state,
                    c.service_zip, c.first_name || ' ' || c.last_name as customer_name,
                    c.phone_primary as customer_phone,
                    COALESCE(jsd.start_time, '08:00') as scheduled_start_time,
                    COALESCE(jsd.end_time, '16:30') as scheduled_end_time
                FROM work_orders wo
                JOIN customers c ON wo.customer_id = c.id
                LEFT JOIN job_schedule_dates jsd ON wo.id = jsd.work_order_id AND jsd.scheduled_date = %s
                LEFT JOIN job_schedule_crew jsc ON jsd.id = jsc.job_schedule_date_id
                WHERE wo.scheduled_date <= %s
                  AND wo.status NOT IN ('completed', 'cancelled', 'invoiced', 'paid')
                  AND wo.job_type != 'Service Call' AND wo.emergency_call IS NOT TRUE
                  AND (wo.assigned_to = %s OR jsc.employee_username = ANY(%s))
                ORDER BY wo.id, wo.scheduled_date ASC
            """, (today, today, username, assigned_workers))
        else:
            # No workers assigned yet - show jobs they're assigned to + all scheduled jobs
            cur.execute("""
                SELECT DISTINCT ON (wo.id) wo.id, wo.work_order_number, wo.job_description,
                    wo.status, wo.job_type, wo.priority, wo.emergency_call, wo.scheduled_date,
                    wo.assigned_to, wo.service_address, c.service_city, c.service_state,
                    c.service_zip, c.first_name || ' ' || c.last_name as customer_name,
                    c.phone_primary as customer_phone,
                    COALESCE(jsd.start_time, '08:00') as scheduled_start_time,
                    COALESCE(jsd.end_time, '16:30') as scheduled_end_time
                FROM work_orders wo
                JOIN customers c ON wo.customer_id = c.id
                LEFT JOIN job_schedule_dates jsd ON wo.id = jsd.work_order_id AND jsd.scheduled_date = %s
                LEFT JOIN job_schedule_crew jsc ON jsd.id = jsc.job_schedule_date_id
                WHERE wo.scheduled_date <= %s
                  AND wo.status NOT IN ('completed', 'cancelled', 'invoiced', 'paid')
                  AND wo.job_type != 'Service Call' AND wo.emergency_call IS NOT TRUE
                  AND (wo.assigned_to = %s OR jsc.employee_username IS NOT NULL)
                ORDER BY wo.id, wo.scheduled_date ASC
            """, (today, today, username))
    else:
        cur.execute("""
            SELECT DISTINCT ON (wo.id) wo.id, wo.work_order_number, wo.job_description,
                wo.status, wo.job_type, wo.priority, wo.emergency_call, wo.scheduled_date,
                wo.assigned_to, wo.service_address, c.service_city, c.service_state,
                c.service_zip, c.first_name || ' ' || c.last_name as customer_name,
                c.phone_primary as customer_phone,
                COALESCE(jsd.start_time, '08:00') as scheduled_start_time,
                COALESCE(jsd.end_time, '16:30') as scheduled_end_time
            FROM work_orders wo
            JOIN customers c ON wo.customer_id = c.id
            LEFT JOIN job_schedule_dates jsd ON wo.id = jsd.work_order_id AND jsd.scheduled_date = %s
            LEFT JOIN job_schedule_crew jsc ON jsd.id = jsc.job_schedule_date_id
            WHERE wo.scheduled_date <= %s
              AND wo.status NOT IN ('completed', 'cancelled', 'invoiced', 'paid')
              AND wo.job_type != 'Service Call' AND wo.emergency_call IS NOT TRUE
              AND (wo.assigned_to = %s OR jsc.employee_username = %s)
            ORDER BY wo.id, wo.scheduled_date ASC
        """, (today, today, username, username))

    my_jobs = cur.fetchall()

    job_ids = [job['id'] for job in my_jobs]
    job_crew = {}
    if job_ids:
        cur.execute("""
            SELECT jsd.work_order_id, jsc.employee_username, u.full_name, jsc.role, jsc.is_lead_for_day
            FROM job_schedule_crew jsc
            JOIN job_schedule_dates jsd ON jsc.job_schedule_date_id = jsd.id
            JOIN users u ON jsc.employee_username = u.username
            WHERE jsd.work_order_id = ANY(%s) AND jsd.scheduled_date = %s
        """, (job_ids, today))
        for crew in cur.fetchall():
            wo_id = crew['work_order_id']
            if wo_id not in job_crew:
                job_crew[wo_id] = []
            job_crew[wo_id].append({
                'username': crew['employee_username'],
                'full_name': crew['full_name'],
                'role': crew['role'],
                'is_lead': crew['is_lead_for_day']
            })

    for job in my_jobs:
        job['crew'] = job_crew.get(job['id'], [])

    cur.execute("""
        SELECT wo.id, wo.work_order_number, wo.job_description, wo.status, wo.job_type,
            wo.priority, wo.emergency_call, wo.scheduled_date, wo.assigned_to, wo.service_address,
            c.service_city, c.service_state, c.service_zip,
            c.first_name || ' ' || c.last_name as customer_name, c.phone_primary as customer_phone
        FROM work_orders wo
        JOIN customers c ON wo.customer_id = c.id
        WHERE wo.scheduled_date <= %s
          AND wo.status NOT IN ('completed', 'cancelled', 'invoiced', 'paid')
          AND (wo.job_type = 'Service Call' OR wo.emergency_call = TRUE)
        ORDER BY CASE wo.priority
            WHEN 'emergency' THEN 0
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 3
            WHEN 'low' THEN 4
            ELSE 3
        END, wo.scheduled_date ASC
    """, (today,))
    service_calls = cur.fetchall()

    sc_ids = [sc['id'] for sc in service_calls]
    sc_crew = {}
    if sc_ids:
        cur.execute("""
            SELECT jsd.work_order_id, jsc.employee_username, u.full_name, jsc.role, jsc.is_lead_for_day
            FROM job_schedule_crew jsc
            JOIN job_schedule_dates jsd ON jsc.job_schedule_date_id = jsd.id
            JOIN users u ON jsc.employee_username = u.username
            WHERE jsd.work_order_id = ANY(%s) AND jsd.scheduled_date = %s
        """, (sc_ids, today))
        for crew in cur.fetchall():
            wo_id = crew['work_order_id']
            if wo_id not in sc_crew:
                sc_crew[wo_id] = []
            sc_crew[wo_id].append({
                'username': crew['employee_username'],
                'full_name': crew['full_name'],
                'role': crew['role'],
                'is_lead': crew['is_lead_for_day']
            })
    for sc in service_calls:
        sc['crew'] = sc_crew.get(sc['id'], [])

    cur.close()
    conn.close()

    return {
        'my_jobs': my_jobs,
        'service_calls': service_calls,
        'user_role': role,
        'today': today
    }


# ============================================================
# WORK ORDERS (Future Phase - Placeholder)
# ============================================================

def auto_update_work_order_status(conn, work_order_id: int, current_status: str, scheduled_date, username: str = "system") -> str:
    """
    Automatically update work order status based on scheduled_date.

    Rules:
    - If status is 'scheduled' and scheduled_date <= today -> change to 'in_progress'
    - Returns the (potentially updated) status

    This function does NOT change statuses that are already: in_progress, completed, cancelled, delayed
    """
    from datetime import date

    # Only auto-transition from 'scheduled' to 'in_progress'
    if current_status != 'scheduled':
        return current_status

    # If no scheduled_date, keep as is
    if not scheduled_date:
        return current_status

    today = date.today()

    # Convert scheduled_date to date if it's a string
    if isinstance(scheduled_date, str):
        try:
            scheduled_date = date.fromisoformat(scheduled_date)
        except ValueError:
            return current_status

    # If scheduled_date has arrived (today or past), change to in_progress
    if scheduled_date <= today:
        cur = conn.cursor()
        try:
            cur.execute("""
                UPDATE work_orders
                SET status = 'in_progress', last_updated = CURRENT_TIMESTAMP, last_updated_by = %s
                WHERE id = %s AND status = 'scheduled'
            """, (username, work_order_id))

            if cur.rowcount > 0:
                # Log the auto status change
                cur.execute("""
                    INSERT INTO work_order_activity
                    (work_order_id, activity_type, description, performed_by, created_at)
                    VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
                """, (
                    work_order_id,
                    'status_change',
                    f"Status automatically changed from 'scheduled' to 'in_progress' (scheduled date {scheduled_date} has arrived)",
                    username
                ))
                conn.commit()
                return 'in_progress'
        except Exception as e:
            logger.error(f"Error auto-updating work order {work_order_id} status: {e}")
            conn.rollback()
        finally:
            cur.close()

    return current_status


def batch_auto_update_work_order_statuses(conn, work_orders: list, username: str = "system") -> list:
    """
    Process a list of work orders and auto-update statuses where needed.
    Returns the updated list with corrected statuses.
    """
    from datetime import date
    today = date.today()

    # Find work orders that need status update (scheduled and date has arrived)
    ids_to_update = []
    for wo in work_orders:
        if wo.get('status') == 'scheduled' and wo.get('scheduled_date'):
            sched_date = wo['scheduled_date']
            if isinstance(sched_date, str):
                try:
                    sched_date = date.fromisoformat(sched_date)
                except ValueError:
                    continue
            if sched_date <= today:
                ids_to_update.append(wo['id'])

    if not ids_to_update:
        return work_orders

    # Batch update all at once
    cur = conn.cursor()
    try:
        # Update statuses
        cur.execute("""
            UPDATE work_orders
            SET status = 'in_progress', last_updated = CURRENT_TIMESTAMP, last_updated_by = %s
            WHERE id = ANY(%s) AND status = 'scheduled'
            RETURNING id
        """, (username, ids_to_update))
        updated_ids = [row['id'] for row in cur.fetchall()]

        # Log activity for each updated work order
        for wo_id in updated_ids:
            cur.execute("""
                INSERT INTO work_order_activity
                (work_order_id, activity_type, description, performed_by, created_at)
                VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
            """, (
                wo_id,
                'status_change',
                "Status automatically changed from 'scheduled' to 'in_progress' (scheduled date has arrived)",
                username
            ))

        conn.commit()

        # Update the work_orders list in memory
        updated_set = set(updated_ids)
        for wo in work_orders:
            if wo['id'] in updated_set:
                wo['status'] = 'in_progress'

    except Exception as e:
        logger.error(f"Error batch auto-updating work order statuses: {e}")
        conn.rollback()
    finally:
        cur.close()

    return work_orders


@app.get("/work-orders")
async def get_work_orders(
    status: str = None,
    assigned_to: str = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get all work orders with optional filtering and pagination"""
    conn = get_db_connection()
    cur = conn.cursor()

    base_query = """
        FROM work_orders wo
        JOIN customers c ON wo.customer_id = c.id
        WHERE 1=1
    """
    params = []

    if status:
        base_query += " AND wo.status = %s"
        params.append(status)

    if assigned_to:
        base_query += " AND wo.assigned_to = %s"
        params.append(assigned_to)

    if search:
        base_query += """ AND (
            wo.work_order_number ILIKE %s OR
            wo.job_description ILIKE %s OR
            c.first_name ILIKE %s OR c.last_name ILIKE %s OR
            c.company_name ILIKE %s
        )"""
        search_param = f"%{search}%"
        params.extend([search_param, search_param, search_param, search_param, search_param])

    # Get total count
    cur.execute(f"SELECT COUNT(*) as total {base_query}", params)
    total = cur.fetchone()['total']

    # Get paginated results
    select_query = f"""
        SELECT
            wo.*,
            c.first_name || ' ' || c.last_name as customer_name,
            c.phone_primary as customer_phone,
            c.email as customer_email,
            (SELECT COUNT(*) FROM job_materials_used WHERE work_order_id = wo.id) as material_count,
            (SELECT SUM(quantity_needed) FROM job_materials_used WHERE work_order_id = wo.id) as total_items
        {base_query}
        ORDER BY wo.scheduled_date DESC, wo.created_at DESC
        LIMIT %s OFFSET %s
    """
    params.extend([limit, offset])

    cur.execute(select_query, params)
    work_orders = [dict(row) for row in cur.fetchall()]
    cur.close()

    # Auto-update statuses for work orders where scheduled_date has arrived
    work_orders = batch_auto_update_work_order_statuses(conn, work_orders, current_user.get('username', 'system'))

    conn.close()

    return {
        "work_orders": work_orders,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@app.get("/work-orders/{work_order_id}")
async def get_work_order(
    work_order_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed work order information including materials"""
    conn = get_db_connection()
    cur = conn.cursor()

    # Get work order details
    cur.execute("""
        SELECT
            wo.*,
            c.first_name,
            c.last_name,
            c.company_name,
            c.phone_primary,
            c.phone_secondary,
            c.email,
            c.customer_type
        FROM work_orders wo
        JOIN customers c ON wo.customer_id = c.id
        WHERE wo.id = %s
    """, (work_order_id,))
    work_order = cur.fetchone()

    if not work_order:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Work order not found")

    # Auto-update status if scheduled_date has arrived
    work_order = dict(work_order)
    if work_order.get('status') == 'scheduled' and work_order.get('scheduled_date'):
        new_status = auto_update_work_order_status(
            conn,
            work_order_id,
            work_order['status'],
            work_order['scheduled_date'],
            current_user.get('username', 'system')
        )
        work_order['status'] = new_status

    # Get materials for this work order
    cur.execute("""
        SELECT
            jm.*,
            i.item_id,
            i.brand,
            i.description,
            i.category,
            i.subcategory,
            i.qty as warehouse_qty,
            i.qty_available as available_qty,
            i.location,
            i.qty_per
        FROM job_materials_used jm
        JOIN inventory i ON jm.inventory_id = i.id
        WHERE jm.work_order_id = %s
        ORDER BY i.category, i.item_id
    """, (work_order_id,))
    materials = cur.fetchall()

    cur.close()
    conn.close()

    work_order['materials'] = materials
    return work_order


@app.patch("/work-orders/{work_order_id}/status")
async def update_work_order_status(
    work_order_id: int,
    status_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update work order status - accessible to all roles"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        new_status = status_data.get('status')
        if not new_status:
            raise HTTPException(status_code=400, detail="Status is required")

        # Validate status
        valid_statuses = ['pending', 'scheduled', 'in_progress', 'completed', 'cancelled', 'delayed']
        if new_status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")

        # Check if work order exists
        cur.execute("SELECT status FROM work_orders WHERE id = %s", (work_order_id,))
        work_order = cur.fetchone()

        if not work_order:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Work order not found")

        old_status = work_order['status']

        # Track schedule changes for delayed status
        employees_removed = []
        schedule_dates_removed = 0

        # If changing to 'delayed', clear all schedule entries first
        if new_status == 'delayed':
            # Get list of employees who were scheduled
            cur.execute("""
                SELECT DISTINCT jsc.employee_username, u.full_name
                FROM job_schedule_crew jsc
                JOIN job_schedule_dates jsd ON jsc.job_schedule_date_id = jsd.id
                JOIN users u ON jsc.employee_username = u.username
                WHERE jsd.work_order_id = %s
            """, (work_order_id,))
            employees_removed = [{'username': row['employee_username'], 'full_name': row['full_name']} for row in cur.fetchall()]

            # Count schedule dates being removed
            cur.execute("""
                SELECT COUNT(*) as count FROM job_schedule_dates WHERE work_order_id = %s
            """, (work_order_id,))
            schedule_dates_removed = cur.fetchone()['count']

            # Delete crew entries for this work order
            cur.execute("""
                DELETE FROM job_schedule_crew
                WHERE job_schedule_date_id IN (
                    SELECT id FROM job_schedule_dates WHERE work_order_id = %s
                )
            """, (work_order_id,))

            # Delete schedule dates
            cur.execute("""
                DELETE FROM job_schedule_dates WHERE work_order_id = %s
            """, (work_order_id,))

            # Clear work order assignments
            cur.execute("""
                DELETE FROM work_order_assignments WHERE work_order_id = %s
            """, (work_order_id,))

            # Reset work order schedule fields
            cur.execute("""
                UPDATE work_orders
                SET crew_size = 0,
                    start_date = NULL,
                    end_date = NULL,
                    total_scheduled_days = 0,
                    is_multi_day = FALSE
                WHERE id = %s
            """, (work_order_id,))

        # Update the status
        cur.execute("""
            UPDATE work_orders
            SET status = %s,
                last_updated = CURRENT_TIMESTAMP,
                last_updated_by = %s
            WHERE id = %s
            RETURNING *
        """, (new_status, current_user['username'], work_order_id))

        updated_work_order = cur.fetchone()
        conn.commit()

        # Build activity description
        activity_description = f"Status changed from '{old_status}' to '{new_status}'"
        if new_status == 'delayed' and employees_removed:
            employee_names = ', '.join([e['full_name'] for e in employees_removed])
            activity_description += f". Removed {len(employees_removed)} employee(s) from schedule: {employee_names}"

        # Log the activity
        cur.execute("""
            INSERT INTO work_order_activity
            (work_order_id, activity_type, description, performed_by, created_at)
            VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
        """, (
            work_order_id,
            'status_change',
            activity_description,
            current_user['username']
        ))
        conn.commit()

        cur.close()
        conn.close()

        # Build response message
        message = f"Status updated to {new_status}"
        if new_status == 'delayed' and employees_removed:
            message = f"Job delayed. Removed {len(employees_removed)} employee(s) from schedule ({schedule_dates_removed} day(s) cleared)"

        return {
            "success": True,
            "work_order": dict(updated_work_order),
            "message": message,
            "employees_removed": employees_removed if new_status == 'delayed' else [],
            "schedule_dates_removed": schedule_dates_removed if new_status == 'delayed' else 0
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@app.post("/work-orders/{work_order_id}/allocate-materials")
async def allocate_materials(
    work_order_id: int,
    material_ids: List[int],  # List of job_materials_used IDs to allocate
    current_user: dict = Depends(get_current_user)
):
    """Allocate materials to a work order - reserves inventory"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        allocated = []
        insufficient_stock = []

        for material_id in material_ids:
            # Get material details
            cur.execute("""
                SELECT jm.*, i.qty, i.qty_available, i.item_id, i.description
                FROM job_materials_used jm
                JOIN inventory i ON jm.inventory_id = i.id
                WHERE jm.id = %s AND jm.work_order_id = %s
            """, (material_id, work_order_id))
            material = cur.fetchone()

            if not material:
                continue

            qty_to_allocate = material['quantity_needed'] - material['quantity_allocated']

            # Atomic update with check - prevents race conditions
            # qty_available is computed as (qty - qty_allocated), so we check:
            # (qty - qty_allocated) >= qty_to_allocate before allowing update
            cur.execute("""
                UPDATE inventory
                SET qty_allocated = qty_allocated + %s
                WHERE id = %s AND (qty - qty_allocated) >= %s
                RETURNING qty_available
            """, (qty_to_allocate, material['inventory_id'], qty_to_allocate))
            
            result = cur.fetchone()
            if not result:
                # Insufficient stock - atomic check failed
                insufficient_stock.append({
                    'item_id': material['item_id'],
                    'description': material['description'],
                    'needed': qty_to_allocate,
                    'available': material['qty_available']
                })
                continue

            # Update job material - mark as allocated
            cur.execute("""
                UPDATE job_materials_used
                SET quantity_allocated = quantity_allocated + %s,
                    stock_status = CASE
                        WHEN quantity_allocated + %s >= quantity_needed THEN 'in_stock'
                        ELSE 'partial'
                    END,
                    status = 'allocated'
                WHERE id = %s
            """, (qty_to_allocate, qty_to_allocate, material_id))

            allocated.append({
                'item_id': material['item_id'],
                'description': material['description'],
                'allocated': qty_to_allocate
            })

        conn.commit()
        cur.close()
        conn.close()

        return {
            'success': len(allocated) > 0,
            'allocated': allocated,
            'insufficient_stock': insufficient_stock
        }

    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@app.post("/work-orders/{work_order_id}/deallocate-materials")
async def deallocate_materials(
    work_order_id: int,
    material_ids: List[int],
    current_user: dict = Depends(get_current_user)
):
    """Deallocate materials from a work order - returns to available inventory"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        deallocated = []

        for material_id in material_ids:
            cur.execute("""
                SELECT jm.*, i.item_id, i.description
                FROM job_materials_used jm
                JOIN inventory i ON jm.inventory_id = i.id
                WHERE jm.id = %s AND jm.work_order_id = %s
            """, (material_id, work_order_id))
            material = cur.fetchone()

            if not material or material['quantity_allocated'] == 0:
                continue

            qty_to_deallocate = material['quantity_allocated']

            # Update inventory - decrease qty_allocated
            cur.execute("""
                UPDATE inventory
                SET qty_allocated = qty_allocated - %s
                WHERE id = %s
            """, (qty_to_deallocate, material['inventory_id']))

            # Update job material - mark as planned
            cur.execute("""
                UPDATE job_materials_used
                SET quantity_allocated = 0,
                    stock_status = 'checking',
                    status = 'planned'
                WHERE id = %s
            """, (material_id,))

            deallocated.append({
                'item_id': material['item_id'],
                'description': material['description'],
                'deallocated': qty_to_deallocate
            })

        conn.commit()
        cur.close()
        conn.close()

        return {
            'success': True,
            'deallocated': deallocated
        }

    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


# ============================================================
# MATERIAL LOADING (PULLING FROM STOCK) & RETURNS
# ============================================================

class LoadMaterialsRequest(BaseModel):
    """Request to load/pull materials from stock for a job"""
    material_ids: List[int]  # job_materials_used IDs


class ReturnMaterialsRequest(BaseModel):
    """Request to return unused materials from a job"""
    returns: List[dict]  # [{"material_id": int, "quantity": int}]


class ExternalPurchaseRequest(BaseModel):
    """Request to add materials purchased externally (not from inventory)"""
    inventory_id: Optional[int] = None  # Link to inventory item if exists
    description: str
    quantity: int
    unit_cost: float
    unit_price: float
    external_vendor: str  # e.g., "Home Depot", "Lowes", "Graybar"
    receipt_number: Optional[str] = None
    notes: Optional[str] = None


@app.post("/work-orders/{work_order_id}/load-materials")
async def load_materials(
    work_order_id: int,
    request: LoadMaterialsRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Load/pull materials from stock for a work order.
    This physically removes items from inventory and marks them as loaded on the truck.
    Materials must be allocated first before they can be loaded.
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        loaded = []
        errors = []

        for material_id in request.material_ids:
            # Get material details
            cur.execute("""
                SELECT jm.*, i.qty, i.qty_available, i.item_id, i.description
                FROM job_materials_used jm
                JOIN inventory i ON jm.inventory_id = i.id
                WHERE jm.id = %s AND jm.work_order_id = %s
            """, (material_id, work_order_id))
            material = cur.fetchone()

            if not material:
                errors.append({'material_id': material_id, 'error': 'Material not found'})
                continue

            # Can only load allocated materials from inventory
            if material['source_type'] != 'inventory':
                errors.append({'material_id': material_id, 'error': 'Not from inventory'})
                continue

            if material['quantity_allocated'] == 0:
                errors.append({
                    'material_id': material_id,
                    'item_id': material['item_id'],
                    'error': 'Material must be allocated before loading'
                })
                continue

            # Calculate how much to load (what's allocated but not yet loaded)
            qty_to_load = material['quantity_allocated'] - material['quantity_loaded']

            if qty_to_load <= 0:
                errors.append({
                    'material_id': material_id,
                    'item_id': material['item_id'],
                    'error': 'Already fully loaded'
                })
                continue

            # Update job material - mark as loaded
            # The trigger will handle deducting from inventory.qty
            cur.execute("""
                UPDATE job_materials_used
                SET quantity_loaded = quantity_allocated,
                    status = 'loaded',
                    loaded_by = %s,
                    loaded_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (current_user['username'], material_id))

            loaded.append({
                'item_id': material['item_id'],
                'description': material['description'],
                'quantity_loaded': qty_to_load
            })

        conn.commit()
        cur.close()
        conn.close()

        return {
            'success': len(loaded) > 0,
            'loaded': loaded,
            'errors': errors,
            'message': f"Loaded {len(loaded)} materials, removed from stock"
        }

    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@app.post("/work-orders/{work_order_id}/return-materials")
async def return_materials(
    work_order_id: int,
    request: ReturnMaterialsRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Return unused materials from a work order back to inventory.
    This adds items back to stock and updates the job material record.
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        returned = []
        errors = []

        for item in request.returns:
            material_id = item.get('material_id')
            qty_to_return = item.get('quantity', 0)

            if qty_to_return <= 0:
                continue

            # Get material details
            cur.execute("""
                SELECT jm.*, i.item_id, i.description
                FROM job_materials_used jm
                JOIN inventory i ON jm.inventory_id = i.id
                WHERE jm.id = %s AND jm.work_order_id = %s
            """, (material_id, work_order_id))
            material = cur.fetchone()

            if not material:
                errors.append({'material_id': material_id, 'error': 'Material not found'})
                continue

            # Can only return inventory-sourced materials
            if material['source_type'] != 'inventory':
                errors.append({'material_id': material_id, 'error': 'Cannot return external purchase'})
                continue

            # Can only return what was loaded minus what was used
            max_returnable = material['quantity_loaded'] - material['quantity_used'] - material['quantity_returned']
            if qty_to_return > max_returnable:
                errors.append({
                    'material_id': material_id,
                    'item_id': material['item_id'],
                    'error': f'Can only return up to {max_returnable} units'
                })
                continue

            # Update job material with returned quantity
            # The trigger will handle adding back to inventory.qty
            cur.execute("""
                UPDATE job_materials_used
                SET quantity_returned = quantity_returned + %s,
                    returned_by = %s,
                    returned_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (qty_to_return, current_user['username'], material_id))

            # Also release the allocation
            cur.execute("""
                UPDATE inventory
                SET qty_allocated = qty_allocated - %s
                WHERE id = %s
            """, (qty_to_return, material['inventory_id']))

            returned.append({
                'item_id': material['item_id'],
                'description': material['description'],
                'quantity_returned': qty_to_return
            })

        conn.commit()
        cur.close()
        conn.close()

        return {
            'success': len(returned) > 0,
            'returned': returned,
            'errors': errors,
            'message': f"Returned {len(returned)} materials to stock"
        }

    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@app.post("/work-orders/{work_order_id}/add-external-material")
async def add_external_material(
    work_order_id: int,
    material: ExternalPurchaseRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Add materials purchased externally (not from company inventory).
    Use this when workers purchase materials from external vendors like
    Home Depot, supply houses, etc. for unexpected needs or rare items.
    These materials are NOT deducted from inventory since they weren't in stock.
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # If inventory_id provided, verify it exists and get additional info
        inventory_id = material.inventory_id
        if inventory_id:
            cur.execute("SELECT id FROM inventory WHERE id = %s", (inventory_id,))
            if not cur.fetchone():
                inventory_id = None  # Item doesn't exist, treat as custom item

        cur.execute("""
            INSERT INTO job_materials_used (
                work_order_id, inventory_id, quantity_needed, quantity_loaded, quantity_used,
                unit_cost, unit_price, source_type, external_vendor, external_receipt_number,
                stock_status, status, notes, loaded_by, loaded_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, 'external_purchase', %s, %s,
                'external', 'used', %s, %s, CURRENT_TIMESTAMP
            )
            RETURNING id
        """, (
            work_order_id,
            inventory_id,
            material.quantity,
            material.quantity,  # Already loaded (purchased)
            material.quantity,  # Already used
            material.unit_cost,
            material.unit_price,
            material.external_vendor,
            material.receipt_number,
            material.notes or f"External purchase: {material.description}",
            current_user['username']
        ))

        material_id = cur.fetchone()['id']
        conn.commit()
        cur.close()
        conn.close()

        return {
            'success': True,
            'material_id': material_id,
            'message': f"Added external purchase from {material.external_vendor}"
        }

    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@app.post("/work-orders/{work_order_id}/add-material")
async def add_material_to_work_order(
    work_order_id: int,
    material: dict,
    current_user: dict = Depends(get_current_user)
):
    """Add a material line item to a work order"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            INSERT INTO job_materials_used (
                work_order_id, inventory_id, quantity_needed,
                unit_cost, unit_price, stock_status, status
            ) VALUES (%s, %s, %s, %s, %s, 'checking', 'planned')
            RETURNING id
        """, (
            work_order_id,
            material['inventory_id'],
            material['quantity_needed'],
            material['unit_cost'],
            material['unit_price']
        ))

        material_id = cur.fetchone()['id']
        conn.commit()
        cur.close()
        conn.close()

        return {
            'success': True,
            'material_id': material_id
        }

    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@app.delete("/work-orders/{work_order_id}/materials/{material_id}")
async def remove_material_from_work_order(
    work_order_id: int,
    material_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Remove a material from a work order (deallocates if allocated)"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get material info
        cur.execute("""
            SELECT jm.*, i.item_id, i.description
            FROM job_materials_used jm
            JOIN inventory i ON jm.inventory_id = i.id
            WHERE jm.id = %s AND jm.work_order_id = %s
        """, (material_id, work_order_id))
        material = cur.fetchone()

        if not material:
            raise HTTPException(status_code=404, detail="Material not found")

        # If material was allocated, return it to inventory
        if material['quantity_allocated'] > 0:
            cur.execute("""
                UPDATE inventory
                SET qty_allocated = qty_allocated - %s
                WHERE id = %s
            """, (material['quantity_allocated'], material['inventory_id']))

        # Delete the material line
        cur.execute("""
            DELETE FROM job_materials_used
            WHERE id = %s AND work_order_id = %s
        """, (material_id, work_order_id))

        conn.commit()
        cur.close()
        conn.close()

        return {
            'success': True,
            'item_id': material['item_id'],
            'description': material['description']
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@app.post("/work-orders")
async def create_work_order(
    work_order: dict,
    current_user: dict = Depends(require_manager_or_admin)
):
    """Create a new work order"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Generate work order number
        cur.execute("SELECT work_order_number FROM work_orders ORDER BY id DESC LIMIT 1")
        last_wo = cur.fetchone()
        if last_wo:
            last_num = int(last_wo['work_order_number'].split('-')[-1])
            new_num = f"WO-2024-{str(last_num + 1).zfill(4)}"
        else:
            new_num = "WO-2024-0001"

        # Convert empty strings to None for date/time fields and assigned_to
        scheduled_date = work_order.get('scheduled_date') or None
        if scheduled_date == '':
            scheduled_date = None

        scheduled_start_time = work_order.get('scheduled_start_time') or None
        if scheduled_start_time == '':
            scheduled_start_time = None

        assigned_to = work_order.get('assigned_to') or None
        if assigned_to == '':
            assigned_to = None

        # Insert work order
        cur.execute("""
            INSERT INTO work_orders (
                work_order_number, customer_id, service_address,
                job_type, job_description, scope_of_work,
                scheduled_date, scheduled_start_time, estimated_duration_hours,
                assigned_to, status, priority,
                quoted_labor_hours, quoted_labor_rate, quoted_labor_cost,
                quoted_material_cost, quoted_subtotal,
                created_by
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            ) RETURNING id
        """, (
            new_num,
            work_order['customer_id'],
            work_order['service_address'],
            work_order.get('job_type', 'Service Call'),
            work_order['job_description'],
            work_order.get('scope_of_work', ''),
            scheduled_date,
            scheduled_start_time,
            work_order.get('estimated_duration_hours', 0) or None,
            assigned_to,
            work_order.get('status', 'pending'),
            work_order.get('priority', 'normal'),
            work_order.get('quoted_labor_hours', 0),
            work_order.get('quoted_labor_rate', 0),
            work_order.get('quoted_labor_cost', 0),
            work_order.get('quoted_material_cost', 0),
            work_order.get('quoted_subtotal', 0),
            current_user['username']
        ))

        work_order_id = cur.fetchone()['id']

        # Add materials if provided
        materials = work_order.get('materials', [])
        if materials:
            for material in materials:
                # Check current inventory availability
                cur.execute("""
                    SELECT qty, qty_allocated, (qty - qty_allocated) as qty_available
                    FROM inventory
                    WHERE id = %s
                """, (material['inventory_id'],))

                inv = cur.fetchone()
                if not inv:
                    continue

                # Determine stock status
                qty_available = inv['qty_available']
                qty_needed = material['quantity_needed']
                if qty_available >= qty_needed:
                    stock_status = 'in_stock'
                elif qty_available > 0:
                    stock_status = 'partial'
                else:
                    stock_status = 'out_of_stock'

                # Insert material (planned, not allocated)
                cur.execute("""
                    INSERT INTO job_materials_used (
                        work_order_id, inventory_id, quantity_needed,
                        unit_cost, unit_price, stock_status, status
                    ) VALUES (%s, %s, %s, %s, %s, %s, 'planned')
                """, (
                    work_order_id,
                    material['inventory_id'],
                    material['quantity_needed'],
                    material.get('unit_cost', 0),
                    material.get('unit_price', 0),
                    stock_status
                ))

        conn.commit()

        cur.close()
        conn.close()

        return {
            'success': True,
            'work_order_id': work_order_id,
            'work_order_number': new_num,
            'materials_added': len(materials)
        }

    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@app.patch("/work-orders/{work_order_id}")
async def update_work_order(
    work_order_id: int,
    work_order: dict,
    current_user: dict = Depends(require_manager_or_admin)
):
    """Update an existing work order - requires manager or admin"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Build UPDATE query dynamically based on provided fields
        update_fields = []
        update_values = []

        allowed_fields = [
            'job_type', 'job_description', 'scope_of_work',
            'scheduled_date', 'scheduled_start_time', 'scheduled_end_time', 'estimated_duration_hours',
            'assigned_to', 'helper_1', 'helper_2', 'status', 'priority',
            'quoted_labor_hours', 'quoted_labor_rate', 'quoted_labor_cost',
            'quoted_material_cost', 'quoted_subtotal',
            'permit_required', 'permit_number', 'inspection_required',
            'service_address'
        ]

        # Fields that are foreign keys and should be NULL instead of empty string
        fk_fields = ['assigned_to', 'helper_1', 'helper_2']
        # Fields that are time/date types and should be NULL instead of empty string
        time_fields = ['scheduled_start_time', 'scheduled_end_time']
        date_fields = ['scheduled_date', 'completion_date']

        for field in allowed_fields:
            if field in work_order:
                value = work_order[field]
                # Convert empty strings to NULL for foreign key fields
                if field in fk_fields and value == '':
                    value = None
                # Convert empty strings to NULL for time fields
                elif field in time_fields and value == '':
                    value = None
                # Convert empty strings to NULL for date fields
                elif field in date_fields and value == '':
                    value = None
                update_fields.append(f"{field} = %s")
                update_values.append(value)

        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")

        # Add work_order_id for WHERE clause
        update_values.append(work_order_id)

        query = f"""
            UPDATE work_orders
            SET {', '.join(update_fields)}
            WHERE id = %s
            RETURNING *
        """

        cur.execute(query, tuple(update_values))
        updated_wo = cur.fetchone()

        if not updated_wo:
            raise HTTPException(status_code=404, detail="Work order not found")

        conn.commit()
        cur.close()
        conn.close()

        return {
            'success': True,
            'work_order': updated_wo
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@app.get("/customers")
async def get_customers(
    current_user: dict = Depends(get_current_user),
    limit: int = 100,
    offset: int = 0,
    search: Optional[str] = None,
    active_only: bool = True
):
    """Get all customers with pagination"""
    conn = get_db_connection()
    cur = conn.cursor()

    where_clauses = []
    params = []

    if active_only:
        where_clauses.append("active = TRUE")

    if search:
        where_clauses.append("""(
            first_name ILIKE %s OR last_name ILIKE %s OR
            company_name ILIKE %s OR email ILIKE %s OR phone_primary ILIKE %s
        )""")
        search_param = f"%{search}%"
        params.extend([search_param, search_param, search_param, search_param, search_param])

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    # Get total count
    cur.execute(f"SELECT COUNT(*) as total FROM customers {where_sql}", params)
    total = cur.fetchone()['total']

    # Get paginated results
    params.extend([limit, offset])
    cur.execute(f"""
        SELECT * FROM customers {where_sql}
        ORDER BY last_name, first_name
        LIMIT %s OFFSET %s
    """, params)
    customers = cur.fetchall()
    cur.close()
    conn.close()
    return {
        "customers": customers,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@app.post("/customers")
async def create_customer(
    customer: dict,
    current_user: dict = Depends(get_current_user)
):
    """Create a new customer"""
    conn = get_db_connection()
    cur = conn.cursor()

    max_retries = 5
    retry_count = 0

    while retry_count < max_retries:
        try:
            # Generate unique customer number
            # Lock the table briefly to ensure uniqueness
            cur.execute("LOCK TABLE customers IN SHARE ROW EXCLUSIVE MODE")
            cur.execute("""
                SELECT COALESCE(
                    MAX(CAST(SUBSTRING(customer_number FROM 6) AS INTEGER)),
                    0
                ) + 1 as next_num
                FROM customers
                WHERE customer_number ~ '^CUST-[0-9]+$'
            """)
            next_num = cur.fetchone()['next_num']
            new_num = f"CUST-{str(next_num).zfill(4)}"

            # Insert customer
            cur.execute("""
                INSERT INTO customers (
                    customer_number, first_name, last_name, company_name,
                    customer_type, phone_primary, phone_secondary, email,
                    preferred_contact, service_street, service_city, service_state, service_zip,
                    service_notes, billing_same_as_service,
                    billing_street, billing_city, billing_state, billing_zip,
                    payment_terms, active, customer_since
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                ) RETURNING id, customer_number
            """, (
                new_num,
                customer['first_name'],
                customer['last_name'],
                customer.get('company_name'),
                customer.get('customer_type', 'residential'),
                customer['phone_primary'],
                customer.get('phone_secondary'),
                customer.get('email'),
                customer.get('preferred_contact', 'phone'),
                customer['service_street'],
                customer['service_city'],
                customer['service_state'],
                customer['service_zip'],
                customer.get('service_notes'),
                customer.get('billing_same_as_service', True),
                customer.get('billing_street'),
                customer.get('billing_city'),
                customer.get('billing_state'),
                customer.get('billing_zip'),
                customer.get('payment_terms', 'due_on_receipt'),
                True,  # active
                datetime.now().date()  # customer_since
            ))

            result = cur.fetchone()
            customer_id = result['id']
            conn.commit()

            # Geocode the customer address in background (non-blocking)
            address_parts = [
                customer.get('service_street'),
                customer.get('service_city'),
                customer.get('service_state'),
                customer.get('service_zip')
            ]
            full_address = ", ".join(filter(None, address_parts))

            if full_address.strip():
                try:
                    geo_result = await geocode_address(full_address)
                    if geo_result.get("success"):
                        cur.execute("""
                            UPDATE customers
                            SET service_latitude = %s, service_longitude = %s, geocoded_at = NOW()
                            WHERE id = %s
                        """, (geo_result["latitude"], geo_result["longitude"], customer_id))
                        conn.commit()
                except Exception:
                    pass  # Don't fail customer creation if geocoding fails

            # Fetch the full customer record
            cur.execute("SELECT * FROM customers WHERE id = %s", (customer_id,))
            new_customer = cur.fetchone()

            cur.close()
            conn.close()

            return {
                'success': True,
                'customer_id': customer_id,
                'customer_number': result['customer_number'],
                'customer': new_customer
            }

        except Exception as e:
            conn.rollback()
            error_msg = str(e)

            # Check if it's a duplicate key error
            if 'duplicate key value violates unique constraint' in error_msg and retry_count < max_retries - 1:
                retry_count += 1
                # Small delay before retry (use asyncio for non-blocking)
                import asyncio
                await asyncio.sleep(0.1 * retry_count)
                continue
            else:
                # Not a duplicate error or out of retries
                cur.close()
                conn.close()
                raise HTTPException(status_code=500, detail=error_msg)

    # Should never reach here, but just in case
    cur.close()
    conn.close()
    raise HTTPException(status_code=500, detail="Failed to create customer after multiple retries")


@app.get("/customers/{customer_id}")
async def get_customer(
    customer_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get a single customer by ID"""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM customers WHERE id = %s", (customer_id,))
    customer = cur.fetchone()
    cur.close()
    conn.close()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    return {"customer": customer}


@app.put("/customers/{customer_id}")
async def update_customer(
    customer_id: int,
    customer: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update an existing customer"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Check if customer exists
        cur.execute("SELECT id FROM customers WHERE id = %s", (customer_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Customer not found")

        # Build update query dynamically based on provided fields
        update_fields = []
        values = []

        allowed_fields = [
            'first_name', 'last_name', 'company_name', 'customer_type',
            'phone_primary', 'phone_secondary', 'email', 'preferred_contact',
            'service_street', 'service_city', 'service_state', 'service_zip',
            'service_notes', 'billing_same_as_service',
            'billing_street', 'billing_city', 'billing_state', 'billing_zip',
            'payment_terms', 'active'
        ]

        for field in allowed_fields:
            if field in customer:
                update_fields.append(f"{field} = %s")
                values.append(customer[field])

        if not update_fields:
            raise HTTPException(status_code=400, detail="No valid fields to update")

        values.append(customer_id)

        cur.execute(f"""
            UPDATE customers
            SET {', '.join(update_fields)}, updated_at = NOW()
            WHERE id = %s
            RETURNING *
        """, values)

        updated_customer = cur.fetchone()
        conn.commit()

        # Re-geocode if address fields were updated
        address_fields = ['service_street', 'service_city', 'service_state', 'service_zip']
        if any(field in customer for field in address_fields):
            address_parts = [
                updated_customer.get('service_street'),
                updated_customer.get('service_city'),
                updated_customer.get('service_state'),
                updated_customer.get('service_zip')
            ]
            full_address = ", ".join(filter(None, address_parts))

            if full_address.strip():
                try:
                    geo_result = await geocode_address(full_address)
                    if geo_result.get("success"):
                        cur.execute("""
                            UPDATE customers
                            SET service_latitude = %s, service_longitude = %s, geocoded_at = NOW()
                            WHERE id = %s
                        """, (geo_result["latitude"], geo_result["longitude"], customer_id))
                        conn.commit()
                        # Refresh customer data
                        cur.execute("SELECT * FROM customers WHERE id = %s", (customer_id,))
                        updated_customer = cur.fetchone()
                except Exception:
                    pass  # Don't fail update if geocoding fails

        cur.close()
        conn.close()

        return {
            'success': True,
            'customer': updated_customer
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@app.delete("/customers/{customer_id}")
async def delete_customer(
    customer_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Soft delete a customer (set active = false)"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Check if customer has any work orders
        cur.execute("""
            SELECT COUNT(*) as count FROM work_orders WHERE customer_id = %s
        """, (customer_id,))
        work_order_count = cur.fetchone()['count']

        if work_order_count > 0:
            # Soft delete - just mark as inactive
            cur.execute("""
                UPDATE customers SET active = FALSE, updated_at = NOW() WHERE id = %s
            """, (customer_id,))
        else:
            # No work orders, can hard delete
            cur.execute("DELETE FROM customers WHERE id = %s", (customer_id,))

        conn.commit()
        cur.close()
        conn.close()

        return {
            'success': True,
            'message': 'Customer deactivated' if work_order_count > 0 else 'Customer deleted'
        }

    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


# ============================================================
# WORK ORDER NOTES & PHOTOS
# ============================================================

class WorkOrderNote(BaseModel):
    note: str

@app.get("/work-orders/{work_order_id}/photos")
async def get_work_order_photos(
    work_order_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get all photos for a work order"""
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, filename, original_filename, caption, notes, photo_type, uploaded_by, uploaded_at, file_size, mime_type
        FROM work_order_photos
        WHERE work_order_id = %s
        ORDER BY uploaded_at DESC
    """, (work_order_id,))

    photos = cur.fetchall()
    cur.close()
    conn.close()

    return {"photos": photos}

@app.post("/work-orders/{work_order_id}/photos")
async def upload_work_order_photo(
    work_order_id: int,
    file: UploadFile = File(...),
    caption: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    photo_type: Optional[str] = Form("general"),
    current_user: dict = Depends(get_current_user)
):
    """Upload a photo for a work order with optional notes

    photo_type options: before, after, progress, issue, general
    """
    import uuid
    from pathlib import Path

    # Create upload directory if it doesn't exist
    upload_dir = Path("uploads/work_orders")
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Generate unique filename
    file_extension = Path(file.filename).suffix
    unique_filename = f"{work_order_id}_{uuid.uuid4()}{file_extension}"
    file_path = upload_dir / unique_filename

    # Save file
    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    # Save to database
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            INSERT INTO work_order_photos
            (work_order_id, filename, original_filename, file_size, mime_type, caption, notes, photo_type, uploaded_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, filename, original_filename, caption, notes, photo_type, uploaded_by, uploaded_at, file_size, mime_type
        """, (
            work_order_id,
            unique_filename,
            file.filename,
            len(contents),
            file.content_type,
            caption,
            notes,
            photo_type,
            current_user['username']
        ))
        
        new_photo = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        
        return new_photo
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        # Clean up file if database insert fails
        if file_path.exists():
            file_path.unlink()
        log_and_raise(e)

@app.delete("/work-orders/{work_order_id}/photos/{photo_id}")
async def delete_work_order_photo(
    work_order_id: int,
    photo_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Delete a photo from a work order"""
    from pathlib import Path
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Get filename before deleting
        cur.execute("""
            SELECT filename FROM work_order_photos
            WHERE id = %s AND work_order_id = %s
        """, (photo_id, work_order_id))
        
        photo = cur.fetchone()
        if not photo:
            raise HTTPException(status_code=404, detail="Photo not found")
        
        # Delete from database
        cur.execute("""
            DELETE FROM work_order_photos
            WHERE id = %s AND work_order_id = %s
        """, (photo_id, work_order_id))
        
        conn.commit()
        
        # Delete file
        file_path = Path("uploads/work_orders") / photo['filename']
        if file_path.exists():
            file_path.unlink()
        
        cur.close()
        conn.close()
        
        return {"message": "Photo deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)

@app.get("/work-orders/photos/{filename}")
async def serve_work_order_photo(filename: str, current_user: dict = Depends(get_current_user)):
    """Serve a work order photo - requires authentication"""
    from fastapi.responses import FileResponse
    from pathlib import Path
    import os

    # Sanitize filename to prevent path traversal attacks
    safe_filename = os.path.basename(filename)
    if safe_filename != filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    file_path = Path("uploads/work_orders") / safe_filename

    # Ensure the resolved path is within the uploads directory
    try:
        file_path = file_path.resolve()
        upload_dir = Path("uploads/work_orders").resolve()
        if not str(file_path).startswith(str(upload_dir)):
            raise HTTPException(status_code=403, detail="Access denied")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Photo not found")

    return FileResponse(file_path)

# ============================================================
# JOB TASKS ENDPOINTS
# ============================================================

@app.post("/work-orders/{work_order_id}/convert-scope-to-tasks")
async def convert_scope_to_tasks(
    work_order_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Convert scope_of_work text into individual tasks"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get the work order
        cur.execute("""
            SELECT scope_of_work, scope_converted_to_tasks, original_scope_of_work
            FROM work_orders
            WHERE id = %s
        """, (work_order_id,))

        wo = cur.fetchone()
        if not wo:
            conn.close()
            raise HTTPException(status_code=404, detail="Work order not found")

        # If already converted, return existing tasks
        if wo['scope_converted_to_tasks']:
            cur.execute("""
                SELECT id, work_order_id, task_description, task_order, is_completed,
                       completed_by, completed_at, created_by, created_at
                FROM job_tasks
                WHERE work_order_id = %s
                ORDER BY task_order ASC
            """, (work_order_id,))
            tasks = cur.fetchall()
            cur.close()
            conn.close()
            return {"message": "Already converted", "tasks": tasks}

        scope_text = wo['scope_of_work']
        if not scope_text or not scope_text.strip():
            conn.close()
            raise HTTPException(status_code=400, detail="No scope of work to convert")

        # Parse scope into tasks (split by newlines, bullet points, or numbered lists)
        import re
        lines = scope_text.split('\n')
        tasks = []
        task_order = 0

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Remove common list markers (-, *, •, numbers)
            cleaned = re.sub(r'^[\d]+[\.\)]\s*', '', line)  # Remove "1." or "1)"
            cleaned = re.sub(r'^[-*•]\s*', '', cleaned)     # Remove "- " or "* " or "• "
            cleaned = cleaned.strip()

            if cleaned:
                tasks.append({
                    'description': cleaned,
                    'order': task_order
                })
                task_order += 1

        # If no tasks parsed, treat entire scope as one task
        if not tasks:
            tasks = [{'description': scope_text.strip(), 'order': 0}]

        # Insert tasks
        created_tasks = []
        for task in tasks:
            cur.execute("""
                INSERT INTO job_tasks (work_order_id, task_description, task_order, created_by)
                VALUES (%s, %s, %s, %s)
                RETURNING id, work_order_id, task_description, task_order, is_completed,
                          completed_by, completed_at, created_by, created_at
            """, (work_order_id, task['description'], task['order'], current_user['username']))
            created_tasks.append(cur.fetchone())

        # Archive original scope and mark as converted
        cur.execute("""
            UPDATE work_orders
            SET scope_converted_to_tasks = TRUE,
                original_scope_of_work = scope_of_work,
                scope_of_work = NULL
            WHERE id = %s
        """, (work_order_id,))

        conn.commit()
        cur.close()
        conn.close()

        return {
            "message": f"Converted scope to {len(created_tasks)} tasks",
            "tasks": created_tasks
        }
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)

@app.post("/work-orders/{work_order_id}/tasks")
async def create_job_task(
    work_order_id: int,
    task: JobTaskCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new task for a work order"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            INSERT INTO job_tasks (work_order_id, task_description, task_order, created_by)
            VALUES (%s, %s, %s, %s)
            RETURNING id, work_order_id, task_description, task_order, is_completed,
                      completed_by, completed_at, created_by, created_at
        """, (work_order_id, task.task_description, task.task_order, current_user['username']))

        new_task = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        return new_task
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)

@app.get("/work-orders/{work_order_id}/tasks")
async def get_job_tasks(
    work_order_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get all tasks for a work order"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT id, work_order_id, task_description, task_order, is_completed,
                   completed_by, completed_at, created_by, created_at
            FROM job_tasks
            WHERE work_order_id = %s
            ORDER BY task_order ASC, created_at ASC
        """, (work_order_id,))

        tasks = cur.fetchall()
        cur.close()
        conn.close()

        return tasks
    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)

@app.put("/work-orders/{work_order_id}/tasks/{task_id}")
async def update_job_task(
    work_order_id: int,
    task_id: int,
    task_update: JobTaskUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a task (e.g., mark as completed)"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Build dynamic update query
        update_fields = []
        update_values = []

        if task_update.task_description is not None:
            update_fields.append("task_description = %s")
            update_values.append(task_update.task_description)

        if task_update.task_order is not None:
            update_fields.append("task_order = %s")
            update_values.append(task_update.task_order)

        if task_update.is_completed is not None:
            update_fields.append("is_completed = %s")
            update_values.append(task_update.is_completed)
            if task_update.is_completed:
                update_fields.append("completed_by = %s")
                update_values.append(current_user['username'])
                update_fields.append("completed_at = CURRENT_TIMESTAMP")
            else:
                update_fields.append("completed_by = NULL")
                update_fields.append("completed_at = NULL")

        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")

        update_values.extend([task_id, work_order_id])

        cur.execute(f"""
            UPDATE job_tasks
            SET {', '.join(update_fields)}
            WHERE id = %s AND work_order_id = %s
            RETURNING id, work_order_id, task_description, task_order, is_completed,
                      completed_by, completed_at, created_by, created_at
        """, update_values)

        updated_task = cur.fetchone()

        if not updated_task:
            conn.rollback()
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Task not found")

        conn.commit()
        cur.close()
        conn.close()

        return updated_task
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)

@app.delete("/work-orders/{work_order_id}/tasks/{task_id}")
async def delete_job_task(
    work_order_id: int,
    task_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Delete a task"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            DELETE FROM job_tasks
            WHERE id = %s AND work_order_id = %s
        """, (task_id, work_order_id))

        if cur.rowcount == 0:
            conn.rollback()
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Task not found")

        conn.commit()
        cur.close()
        conn.close()

        return {"message": "Task deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)

# ============================================================
# JOB NOTES ENDPOINTS
# ============================================================

@app.post("/work-orders/{work_order_id}/notes")
async def create_job_note(
    work_order_id: int,
    note: JobNoteCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new note for a work order"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            INSERT INTO job_notes (work_order_id, note_text, note_type, related_task_id, created_by)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, work_order_id, note_text, note_type, related_task_id, created_by, created_at
        """, (work_order_id, note.note_text, note.note_type, note.related_task_id, current_user['username']))

        new_note = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        return new_note
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)

@app.get("/work-orders/{work_order_id}/notes")
async def get_job_notes(
    work_order_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get all notes for a work order"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT id, work_order_id, note_text, note_type, related_task_id, created_by, created_at
            FROM job_notes
            WHERE work_order_id = %s
            ORDER BY created_at DESC
        """, (work_order_id,))

        notes = cur.fetchall()
        cur.close()
        conn.close()

        return notes
    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)

@app.delete("/work-orders/{work_order_id}/notes/{note_id}")
async def delete_job_note(
    work_order_id: int,
    note_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Delete a note"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Only allow deletion of own notes, or if user is admin/manager
        cur.execute("""
            DELETE FROM job_notes
            WHERE id = %s AND work_order_id = %s
            AND (created_by = %s OR %s IN ('admin', 'manager'))
        """, (note_id, work_order_id, current_user['username'], current_user['role']))

        if cur.rowcount == 0:
            conn.rollback()
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Note not found or insufficient permissions")

        conn.commit()
        cur.close()
        conn.close()

        return {"message": "Note deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)

# ============================================================
# ACTIVITY LOG ENDPOINTS
# ============================================================

@app.get("/work-orders/{work_order_id}/activity")
async def get_activity_log(
    work_order_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get activity log for a work order"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT id, work_order_id, activity_type, activity_description,
                   related_item_type, related_item_id, performed_by, performed_at, metadata
            FROM activity_log
            WHERE work_order_id = %s
            ORDER BY performed_at DESC
        """, (work_order_id,))

        activities = cur.fetchall()
        cur.close()
        conn.close()

        return activities
    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)

# ============================================================
# TIME TRACKING ENDPOINTS
# ============================================================

@app.get("/time-entries/my-week")
async def get_my_week_timecard(
    week_ending: Optional[str] = None,  # Format: YYYY-MM-DD (Sunday)
    current_user: dict = Depends(get_current_user)
):
    """Get the current user's timecard for a specific week"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # If no week_ending provided, calculate current week's Sunday
        if not week_ending:
            cur.execute("SELECT calculate_week_ending(CURRENT_DATE) as week_ending")
            week_ending_date = cur.fetchone()['week_ending']
        else:
            week_ending_date = week_ending

        # Get all time entries for this user for this week
        cur.execute("""
            SELECT
                te.id,
                te.work_order_id,
                te.work_date,
                te.hours_worked,
                te.billable_rate,
                te.pay_rate,
                te.billable_amount,
                te.pay_amount,
                te.notes,
                te.break_minutes,
                te.is_locked,
                te.week_ending_date,
                te.created_at,
                te.last_modified_at,
                wo.work_order_number,
                c.first_name || ' ' || c.last_name as customer_name,
                wo.service_address as customer_address,
                wo.job_type,
                wo.status as work_order_status
            FROM time_entries te
            JOIN work_orders wo ON te.work_order_id = wo.id
            JOIN customers c ON wo.customer_id = c.id
            WHERE te.employee_username = %s
              AND te.week_ending_date = %s
            ORDER BY te.work_date DESC, c.last_name, c.first_name
        """, (current_user['username'], week_ending_date))

        entries = cur.fetchall()

        # Calculate totals
        cur.execute("""
            SELECT
                COUNT(*) as entry_count,
                COALESCE(SUM(hours_worked), 0) as total_hours,
                COALESCE(SUM(billable_amount), 0) as total_billable,
                COALESCE(SUM(pay_amount), 0) as total_pay,
                bool_or(is_locked) as is_locked
            FROM time_entries
            WHERE employee_username = %s
              AND week_ending_date = %s
        """, (current_user['username'], week_ending_date))

        totals = cur.fetchone()

        cur.close()
        conn.close()

        return {
            "week_ending": week_ending_date,
            "employee": current_user['username'],
            "entries": entries,
            "totals": totals
        }
    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)

@app.get("/time-entries/available-jobs")
async def get_available_jobs_for_timecard(
    work_date: str,  # Format: YYYY-MM-DD
    current_user: dict = Depends(get_current_user)
):
    """Get list of jobs available for time entry, prioritized by assignment and status"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get jobs ordered by: 1) Assigned to user, 2) Active, 3) Scheduled
        cur.execute("""
            WITH job_priority AS (
                SELECT
                    wo.id,
                    wo.work_order_number,
                    c.first_name || ' ' || c.last_name as customer_name,
                    wo.service_address as customer_address,
                    wo.job_type,
                    wo.status,
                    wo.assigned_to,
                    wo.scheduled_date,
                    CASE
                        WHEN wo.assigned_to = %s THEN 1
                        WHEN wo.status = 'in_progress' THEN 2
                        WHEN wo.status = 'scheduled' THEN 3
                        WHEN wo.status = 'pending' THEN 4
                        ELSE 5
                    END as priority,
                    EXISTS (
                        SELECT 1 FROM time_entries te
                        WHERE te.work_order_id = wo.id
                          AND te.employee_username = %s
                          AND te.work_date = %s
                    ) as has_entry_today
                FROM work_orders wo
                JOIN customers c ON wo.customer_id = c.id
                WHERE wo.status IN ('pending', 'scheduled', 'in_progress')
            )
            SELECT
                id,
                work_order_number,
                customer_name,
                customer_address,
                job_type,
                status,
                assigned_to,
                scheduled_date,
                has_entry_today,
                CASE priority
                    WHEN 1 THEN 'Assigned to You'
                    WHEN 2 THEN 'Active Jobs'
                    WHEN 3 THEN 'Scheduled Jobs'
                    ELSE 'Other Jobs'
                END as section
            FROM job_priority
            ORDER BY priority, customer_name
        """, (current_user['username'], current_user['username'], work_date))

        jobs = cur.fetchall()
        cur.close()
        conn.close()

        # Group by section
        grouped = {
            'Assigned to You': [],
            'Active Jobs': [],
            'Scheduled Jobs': [],
            'Other Jobs': []
        }

        for job in jobs:
            section = job['section']
            grouped[section].append(job)

        return grouped
    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)

@app.post("/time-entries/batch")
async def create_time_entries_batch(
    batch: TimeEntryBatchCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create multiple time entries at once (for submitting a day's work)"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Check if week is locked
        cur.execute("""
            SELECT calculate_week_ending(%s::date) as week_ending
        """, (batch.work_date,))
        week_ending = cur.fetchone()['week_ending']

        cur.execute("""
            SELECT EXTRACT(DOW FROM CURRENT_TIMESTAMP) = 1
               AND %s::date < CURRENT_DATE as is_locked
        """, (week_ending,))
        is_locked = cur.fetchone()['is_locked']

        if is_locked:
            raise HTTPException(
                status_code=400,
                detail="This week has been locked for payroll. Cannot add or modify entries."
            )

        valid_time_types = ['job', 'shop', 'office', 'training', 'travel', 'meeting', 'other']
        created_entries = []
        for entry_data in batch.entries:
            work_order_id = entry_data.get('work_order_id')
            hours_worked = entry_data.get('hours_worked')
            notes = entry_data.get('notes', '')
            break_minutes = entry_data.get('break_minutes', 0)
            time_type = entry_data.get('time_type', 'job')

            # Validate time_type
            if time_type not in valid_time_types:
                time_type = 'job'

            # Skip entries with no hours
            if not hours_worked or float(hours_worked) <= 0:
                continue

            # For job entries, work_order_id is required
            if time_type == 'job' and not work_order_id:
                continue

            billable_rate = 0
            pay_rate = 0

            if work_order_id:
                # Get billable and pay rates from work order
                cur.execute("""
                    SELECT
                        wo.job_type,
                        wo.customer_id,
                        get_job_billable_rate(wo.job_type, wo.customer_id) as billable_rate,
                        get_current_pay_rate(%s) as pay_rate
                    FROM work_orders wo
                    WHERE wo.id = %s
                """, (current_user['username'], work_order_id))

                rates = cur.fetchone()
                billable_rate = rates['billable_rate'] if rates else 0
                pay_rate = rates['pay_rate'] if rates else 0
            else:
                # For non-job time, just get the employee's pay rate (not billable)
                cur.execute("""
                    SELECT get_current_pay_rate(%s) as pay_rate
                """, (current_user['username'],))
                rates = cur.fetchone()
                pay_rate = rates['pay_rate'] if rates else 0
                billable_rate = 0  # Non-job time is not billable

            # Insert time entry (different handling for job vs non-job)
            if work_order_id:
                # Job entry - use ON CONFLICT for work_order_id based uniqueness
                cur.execute("""
                    INSERT INTO time_entries (
                        work_order_id,
                        employee_username,
                        work_date,
                        hours_worked,
                        billable_rate,
                        pay_rate,
                        notes,
                        break_minutes,
                        time_type,
                        created_by,
                        last_modified_by
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (work_order_id, employee_username, work_date)
                    DO UPDATE SET
                        hours_worked = EXCLUDED.hours_worked,
                        notes = EXCLUDED.notes,
                        break_minutes = EXCLUDED.break_minutes,
                        time_type = EXCLUDED.time_type,
                        last_modified_by = EXCLUDED.last_modified_by,
                        last_modified_at = CURRENT_TIMESTAMP
                    RETURNING id, work_order_id, work_date, hours_worked, billable_amount, pay_amount, time_type
                """, (
                    work_order_id,
                    current_user['username'],
                    batch.work_date,
                    hours_worked,
                    billable_rate,
                    pay_rate,
                    notes,
                    break_minutes,
                    time_type,
                    current_user['username'],
                    current_user['username']
                ))
            else:
                # Non-job entry - check for existing entry by time_type
                cur.execute("""
                    SELECT id FROM time_entries
                    WHERE work_order_id IS NULL
                    AND employee_username = %s
                    AND work_date = %s
                    AND time_type = %s
                """, (current_user['username'], batch.work_date, time_type))

                existing = cur.fetchone()
                if existing:
                    # Update existing non-job entry
                    cur.execute("""
                        UPDATE time_entries SET
                            hours_worked = %s,
                            notes = %s,
                            break_minutes = %s,
                            pay_rate = %s,
                            last_modified_by = %s,
                            last_modified_at = CURRENT_TIMESTAMP
                        WHERE id = %s
                        RETURNING id, work_order_id, work_date, hours_worked, billable_amount, pay_amount, time_type
                    """, (
                        hours_worked,
                        notes,
                        break_minutes,
                        pay_rate,
                        current_user['username'],
                        existing['id']
                    ))
                else:
                    # Insert new non-job entry
                    cur.execute("""
                        INSERT INTO time_entries (
                            work_order_id,
                            employee_username,
                            work_date,
                            hours_worked,
                            billable_rate,
                            pay_rate,
                            notes,
                            break_minutes,
                            time_type,
                            created_by,
                            last_modified_by
                        )
                        VALUES (NULL, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id, work_order_id, work_date, hours_worked, billable_amount, pay_amount, time_type
                    """, (
                        current_user['username'],
                        batch.work_date,
                        hours_worked,
                        billable_rate,
                        pay_rate,
                        notes,
                        break_minutes,
                        time_type,
                        current_user['username'],
                        current_user['username']
                    ))

            created_entry = cur.fetchone()
            created_entries.append(created_entry)

        conn.commit()
        cur.close()
        conn.close()

        return {
            "message": f"Successfully saved {len(created_entries)} time entries",
            "entries": created_entries
        }
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)

@app.get("/time-entries")
async def get_time_entries(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get time entries for the current user within a date range with pagination"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        base_query = """
            FROM time_entries te
            LEFT JOIN work_orders wo ON te.work_order_id = wo.id
            LEFT JOIN customers c ON wo.customer_id = c.id
            WHERE te.employee_username = %s
        """
        params = [current_user['username']]

        if start_date:
            base_query += " AND te.work_date >= %s"
            params.append(start_date)

        if end_date:
            base_query += " AND te.work_date <= %s"
            params.append(end_date)

        # Get total count
        cur.execute(f"SELECT COUNT(*) as total {base_query}", params)
        total = cur.fetchone()['total']

        # Get paginated results
        select_query = f"""
            SELECT
                te.id,
                te.work_order_id,
                te.work_date,
                te.hours_worked,
                te.is_locked,
                te.week_ending_date,
                te.time_type,
                te.notes,
                wo.work_order_number,
                COALESCE(c.company_name, c.first_name || ' ' || c.last_name) as customer_name
            {base_query}
            ORDER BY te.work_date ASC, te.time_type, wo.work_order_number
            LIMIT %s OFFSET %s
        """
        params.extend([limit, offset])

        cur.execute(select_query, params)
        entries = cur.fetchall()

        cur.close()
        conn.close()

        return {
            "time_entries": entries,
            "total": total,
            "limit": limit,
            "offset": offset
        }

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)

@app.post("/time-entries")
async def create_time_entry(
    entry: TimeEntryCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a single time entry (job or non-job time)"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Validate time_type
        valid_time_types = ['job', 'shop', 'office', 'training', 'travel', 'meeting', 'other']
        time_type = entry.time_type or 'job'
        if time_type not in valid_time_types:
            raise HTTPException(status_code=400, detail=f"Invalid time_type. Must be one of: {', '.join(valid_time_types)}")

        # For job time, work_order_id is required
        if time_type == 'job' and not entry.work_order_id:
            raise HTTPException(status_code=400, detail="work_order_id is required for job time entries")

        # Check if week is locked
        cur.execute("""
            SELECT calculate_week_ending(%s::date) as week_ending
        """, (entry.work_date,))
        week_ending = cur.fetchone()['week_ending']

        cur.execute("""
            SELECT EXTRACT(DOW FROM CURRENT_TIMESTAMP) = 1
               AND %s::date < CURRENT_DATE as is_locked
        """, (week_ending,))
        is_locked = cur.fetchone()['is_locked']

        if is_locked:
            raise HTTPException(
                status_code=400,
                detail="This week has been locked for payroll. Cannot add or modify entries."
            )

        billable_rate = 0
        pay_rate = 0

        if entry.work_order_id:
            # Get billable and pay rates from work order
            cur.execute("""
                SELECT
                    wo.job_type,
                    wo.customer_id,
                    get_job_billable_rate(wo.job_type, wo.customer_id) as billable_rate,
                    get_current_pay_rate(%s) as pay_rate
                FROM work_orders wo
                WHERE wo.id = %s
            """, (current_user['username'], entry.work_order_id))

            rates = cur.fetchone()
            if not rates:
                raise HTTPException(status_code=404, detail="Work order not found")

            billable_rate = rates['billable_rate']
            pay_rate = rates['pay_rate']
        else:
            # For non-job time, just get the employee's pay rate (not billable)
            cur.execute("""
                SELECT get_current_pay_rate(%s) as pay_rate
            """, (current_user['username'],))
            rates = cur.fetchone()
            pay_rate = rates['pay_rate'] if rates else 0
            billable_rate = 0  # Non-job time is not billable

        # Insert time entry
        cur.execute("""
            INSERT INTO time_entries (
                work_order_id,
                employee_username,
                work_date,
                hours_worked,
                billable_rate,
                pay_rate,
                notes,
                break_minutes,
                time_type,
                created_by,
                last_modified_by
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, work_order_id, work_date, hours_worked, billable_amount, pay_amount, is_locked, time_type
        """, (
            entry.work_order_id,
            current_user['username'],
            entry.work_date,
            entry.hours_worked,
            billable_rate,
            pay_rate,
            entry.notes,
            entry.break_minutes,
            time_type,
            current_user['username'],
            current_user['username']
        ))

        new_entry = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        return new_entry
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)

@app.put("/time-entries/{entry_id}")
async def update_time_entry(
    entry_id: int,
    entry: TimeEntryUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an existing time entry"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Check if entry exists and user owns it
        cur.execute("""
            SELECT id, is_locked, employee_username
            FROM time_entries
            WHERE id = %s
        """, (entry_id,))

        existing = cur.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Time entry not found")

        if existing['is_locked']:
            raise HTTPException(
                status_code=400,
                detail="This time entry is locked for payroll. Cannot modify."
            )

        if existing['employee_username'] != current_user['username'] and current_user['role'] not in ['admin', 'manager']:
            raise HTTPException(
                status_code=403,
                detail="You can only modify your own time entries"
            )

        # Build update query dynamically
        update_fields = []
        params = []

        if entry.hours_worked is not None:
            update_fields.append("hours_worked = %s")
            params.append(entry.hours_worked)

        if entry.notes is not None:
            update_fields.append("notes = %s")
            params.append(entry.notes)

        if entry.break_minutes is not None:
            update_fields.append("break_minutes = %s")
            params.append(entry.break_minutes)

        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")

        update_fields.append("last_modified_by = %s")
        params.append(current_user['username'])

        params.append(entry_id)

        cur.execute(f"""
            UPDATE time_entries
            SET {', '.join(update_fields)}
            WHERE id = %s
            RETURNING id, work_order_id, work_date, hours_worked, billable_amount, pay_amount, notes, break_minutes
        """, params)

        updated_entry = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        return updated_entry
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)

@app.delete("/time-entries/{entry_id}")
async def delete_time_entry(
    entry_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Delete a time entry (only if not locked)"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Check if entry exists and user owns it
        cur.execute("""
            SELECT id, is_locked, employee_username
            FROM time_entries
            WHERE id = %s
        """, (entry_id,))

        existing = cur.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Time entry not found")

        if existing['is_locked']:
            raise HTTPException(
                status_code=400,
                detail="This time entry is locked for payroll. Cannot delete."
            )

        if existing['employee_username'] != current_user['username'] and current_user['role'] not in ['admin', 'manager']:
            raise HTTPException(
                status_code=403,
                detail="You can only delete your own time entries"
            )

        cur.execute("DELETE FROM time_entries WHERE id = %s", (entry_id,))
        conn.commit()
        cur.close()
        conn.close()

        return {"message": "Time entry deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)

@app.get("/time-entries/work-order/{work_order_id}")
async def get_time_entries_for_work_order(
    work_order_id: int,
    current_user: dict = Depends(require_manager_or_admin)
):
    """Get all time entries for a specific work order (managers/admins only)"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT
                te.id,
                te.work_date,
                te.employee_username,
                u.full_name as employee_name,
                te.hours_worked,
                te.billable_rate,
                te.pay_rate,
                te.billable_amount,
                te.pay_amount,
                te.notes,
                te.is_locked,
                te.created_at
            FROM time_entries te
            JOIN users u ON te.employee_username = u.username
            WHERE te.work_order_id = %s
            ORDER BY te.work_date DESC, u.full_name
        """, (work_order_id,))

        entries = cur.fetchall()

        # Calculate totals
        cur.execute("""
            SELECT
                COUNT(DISTINCT employee_username) as employee_count,
                COALESCE(SUM(hours_worked), 0) as total_hours,
                COALESCE(SUM(billable_amount), 0) as total_billable,
                COALESCE(SUM(pay_amount), 0) as total_labor_cost
            FROM time_entries
            WHERE work_order_id = %s
        """, (work_order_id,))

        totals = cur.fetchone()

        cur.close()
        conn.close()

        return {
            "work_order_id": work_order_id,
            "entries": entries,
            "totals": totals
        }
    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)

@app.post("/time-entries/lock-week")
async def lock_week_for_payroll(
    week_ending: str,  # Format: YYYY-MM-DD (Sunday)
    current_user: dict = Depends(require_admin)
):
    """Lock a week's time entries for payroll processing (admin only)"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            UPDATE time_entries
            SET is_locked = TRUE
            WHERE week_ending_date = %s
              AND is_locked = FALSE
        """, (week_ending,))

        rows_locked = cur.rowcount
        conn.commit()
        cur.close()
        conn.close()

        return {
            "message": f"Successfully locked {rows_locked} time entries for week ending {week_ending}",
            "entries_locked": rows_locked
        }
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


class SubmitWeekRequest(BaseModel):
    week_ending_date: date


@app.post("/time-entries/submit-week")
async def submit_timecard_week(
    request: SubmitWeekRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Submit a week's timecard with retroactive schedule sync and contradiction detection.

    This endpoint:
    1. Gets all time entries for the employee for the week
    2. For each time entry:
       - Check if matching job_schedule_dates + job_schedule_crew exists
       - If not, create them (retroactive schedule entry)
       - If exists but hours differ, update actual_hours
    3. Check for scheduled jobs where employee didn't log time
    4. Create schedule_contradictions records for any discrepancies
    5. Mark the week as "submitted"
    """
    conn = get_db_connection()
    cur = conn.cursor()

    username = current_user['username']
    week_ending = request.week_ending_date

    # Calculate week start (Sunday - 6 days)
    week_start = week_ending - timedelta(days=6)

    try:
        created_schedules = []
        updated_schedules = []
        contradictions = []

        # 1. Get all time entries for this employee for the week
        cur.execute("""
            SELECT
                te.id,
                te.work_order_id,
                te.work_date,
                te.hours_worked,
                te.time_type,
                te.notes,
                wo.work_order_number
            FROM time_entries te
            LEFT JOIN work_orders wo ON te.work_order_id = wo.id
            WHERE te.employee_username = %s
              AND te.work_date BETWEEN %s AND %s
              AND te.work_order_id IS NOT NULL
        """, (username, week_start, week_ending))

        time_entries = cur.fetchall()

        # 2. Process each time entry
        for entry in time_entries:
            work_order_id = entry['work_order_id']
            work_date = entry['work_date']
            hours_logged = float(entry['hours_worked'])

            # Check if job_schedule_dates entry exists for this job/date
            cur.execute("""
                SELECT id, start_time, end_time
                FROM job_schedule_dates
                WHERE work_order_id = %s AND scheduled_date = %s
            """, (work_order_id, work_date))

            schedule_date = cur.fetchone()

            if schedule_date:
                schedule_date_id = schedule_date['id']

                # Check if crew entry exists
                cur.execute("""
                    SELECT id, scheduled_hours, actual_hours
                    FROM job_schedule_crew
                    WHERE job_schedule_date_id = %s AND employee_username = %s
                """, (schedule_date_id, username))

                crew_entry = cur.fetchone()

                if crew_entry:
                    scheduled_hours = float(crew_entry['scheduled_hours'] or 0)

                    # Update actual hours
                    cur.execute("""
                        UPDATE job_schedule_crew
                        SET actual_hours = %s
                        WHERE id = %s
                    """, (hours_logged, crew_entry['id']))

                    updated_schedules.append({
                        "work_order_id": work_order_id,
                        "date": str(work_date),
                        "actual_hours": hours_logged
                    })

                    # Check for hours mismatch
                    if scheduled_hours > 0 and abs(scheduled_hours - hours_logged) > 0.25:
                        contradictions.append({
                            "type": "hours_mismatch",
                            "work_order_id": work_order_id,
                            "work_order_number": entry['work_order_number'],
                            "date": str(work_date),
                            "scheduled_hours": scheduled_hours,
                            "actual_hours": hours_logged,
                            "difference": round(hours_logged - scheduled_hours, 2)
                        })
                else:
                    # Create crew entry retroactively - employee wasn't scheduled
                    cur.execute("""
                        INSERT INTO job_schedule_crew (
                            job_schedule_date_id,
                            employee_username,
                            scheduled_hours,
                            actual_hours,
                            role
                        ) VALUES (%s, %s, %s, %s, 'technician')
                    """, (schedule_date_id, username, hours_logged, hours_logged))

                    created_schedules.append({
                        "work_order_id": work_order_id,
                        "date": str(work_date),
                        "hours": hours_logged,
                        "note": "Created from timecard (date existed)"
                    })

                    contradictions.append({
                        "type": "missing_schedule",
                        "work_order_id": work_order_id,
                        "work_order_number": entry['work_order_number'],
                        "date": str(work_date),
                        "scheduled_hours": 0,
                        "actual_hours": hours_logged,
                        "note": "Employee logged time but was not scheduled"
                    })
            else:
                # Create both schedule_date and crew entry retroactively
                cur.execute("""
                    INSERT INTO job_schedule_dates (
                        work_order_id,
                        scheduled_date,
                        start_time,
                        end_time,
                        status
                    ) VALUES (%s, %s, '08:00', '16:30', 'completed')
                    RETURNING id
                """, (work_order_id, work_date))

                new_schedule_date_id = cur.fetchone()['id']

                cur.execute("""
                    INSERT INTO job_schedule_crew (
                        job_schedule_date_id,
                        employee_username,
                        scheduled_hours,
                        actual_hours,
                        role
                    ) VALUES (%s, %s, %s, %s, 'technician')
                """, (new_schedule_date_id, username, hours_logged, hours_logged))

                created_schedules.append({
                    "work_order_id": work_order_id,
                    "date": str(work_date),
                    "hours": hours_logged,
                    "note": "Created from timecard (new date)"
                })

                contradictions.append({
                    "type": "missing_schedule",
                    "work_order_id": work_order_id,
                    "work_order_number": entry['work_order_number'],
                    "date": str(work_date),
                    "scheduled_hours": 0,
                    "actual_hours": hours_logged,
                    "note": "Employee logged time but job was not scheduled for this date"
                })

        # 3. Check for scheduled work without time entries
        cur.execute("""
            SELECT
                jsd.work_order_id,
                jsd.scheduled_date,
                jsc.scheduled_hours,
                wo.work_order_number
            FROM job_schedule_crew jsc
            JOIN job_schedule_dates jsd ON jsc.job_schedule_date_id = jsd.id
            JOIN work_orders wo ON jsd.work_order_id = wo.id
            WHERE jsc.employee_username = %s
              AND jsd.scheduled_date BETWEEN %s AND %s
              AND jsd.status NOT IN ('skipped', 'rescheduled')
              AND NOT EXISTS (
                  SELECT 1 FROM time_entries te
                  WHERE te.work_order_id = jsd.work_order_id
                    AND te.employee_username = %s
                    AND te.work_date = jsd.scheduled_date
              )
        """, (username, week_start, week_ending, username))

        missing_entries = cur.fetchall()

        for missing in missing_entries:
            contradictions.append({
                "type": "missing_time_entry",
                "work_order_id": missing['work_order_id'],
                "work_order_number": missing['work_order_number'],
                "date": str(missing['scheduled_date']),
                "scheduled_hours": float(missing['scheduled_hours'] or 0),
                "actual_hours": 0,
                "note": "Employee was scheduled but did not log time"
            })

        # 4. Store contradictions in schedule_contradictions table (if it exists)
        try:
            for c in contradictions:
                cur.execute("""
                    INSERT INTO schedule_contradictions (
                        week_ending_date,
                        employee_username,
                        work_order_id,
                        scheduled_date,
                        contradiction_type,
                        scheduled_hours,
                        actual_hours,
                        notes
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (employee_username, work_order_id, scheduled_date)
                    DO UPDATE SET
                        contradiction_type = EXCLUDED.contradiction_type,
                        scheduled_hours = EXCLUDED.scheduled_hours,
                        actual_hours = EXCLUDED.actual_hours,
                        notes = EXCLUDED.notes,
                        resolved = FALSE,
                        created_at = CURRENT_TIMESTAMP
                """, (
                    week_ending,
                    username,
                    c['work_order_id'],
                    c['date'],
                    c['type'],
                    c.get('scheduled_hours', 0),
                    c.get('actual_hours', 0),
                    c.get('note', '')
                ))
        except Exception as e:
            # Table might not exist yet, that's okay
            print(f"Could not store contradictions: {e}")

        # 5. Mark time entries as submitted
        cur.execute("""
            UPDATE time_entries
            SET notes = CASE
                WHEN notes IS NULL OR notes = '' THEN '[Submitted]'
                ELSE notes || ' [Submitted]'
            END
            WHERE employee_username = %s
              AND week_ending_date = %s
              AND notes NOT LIKE '%%[Submitted]%%'
        """, (username, week_ending))

        conn.commit()
        cur.close()
        conn.close()

        return {
            "success": True,
            "week_ending": str(week_ending),
            "employee": username,
            "time_entries_processed": len(time_entries),
            "schedules_created": len(created_schedules),
            "schedules_updated": len(updated_schedules),
            "contradictions_found": len(contradictions),
            "contradictions": contradictions,
            "created_schedules": created_schedules,
            "updated_schedules": updated_schedules
        }

    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@app.get("/schedule-contradictions")
async def get_schedule_contradictions(
    week_ending: Optional[date] = None,
    employee_username: Optional[str] = None,
    resolved: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get schedule contradictions with optional filters (admin/manager only)"""
    if current_user.get('role') not in ['admin', 'manager']:
        raise HTTPException(status_code=403, detail="Only admins/managers can view contradictions")

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        query = """
            SELECT
                sc.*,
                wo.work_order_number,
                u.full_name as employee_name,
                c.first_name || ' ' || c.last_name as customer_name
            FROM schedule_contradictions sc
            JOIN work_orders wo ON sc.work_order_id = wo.id
            JOIN users u ON sc.employee_username = u.username
            LEFT JOIN customers c ON wo.customer_id = c.id
            WHERE 1=1
        """
        params = []

        if week_ending:
            query += " AND sc.week_ending_date = %s"
            params.append(week_ending)

        if employee_username:
            query += " AND sc.employee_username = %s"
            params.append(employee_username)

        if resolved is not None:
            query += " AND sc.resolved = %s"
            params.append(resolved)

        query += " ORDER BY sc.created_at DESC"

        cur.execute(query, params)
        contradictions = cur.fetchall()

        cur.close()
        conn.close()

        return {
            "contradictions": contradictions,
            "total": len(contradictions)
        }

    except Exception as e:
        cur.close()
        conn.close()
        # Table might not exist
        if "does not exist" in str(e):
            return {"contradictions": [], "total": 0, "note": "Table not created yet"}
        log_and_raise(e)


class ResolveContradictionRequest(BaseModel):
    resolution_notes: Optional[str] = None


@app.patch("/schedule-contradictions/{contradiction_id}/resolve")
async def resolve_contradiction(
    contradiction_id: int,
    request: ResolveContradictionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Mark a contradiction as resolved (admin/manager only)"""
    if current_user.get('role') not in ['admin', 'manager']:
        raise HTTPException(status_code=403, detail="Only admins/managers can resolve contradictions")

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            UPDATE schedule_contradictions
            SET resolved = TRUE,
                resolved_by = %s,
                resolved_at = CURRENT_TIMESTAMP,
                resolution_notes = %s
            WHERE id = %s
            RETURNING id
        """, (current_user['username'], request.resolution_notes, contradiction_id))

        if cur.fetchone() is None:
            raise HTTPException(status_code=404, detail="Contradiction not found")

        conn.commit()
        cur.close()
        conn.close()

        return {"success": True, "message": "Contradiction marked as resolved"}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


# ============================================================================
# FINANCIAL REPORTS ENDPOINTS
# ============================================================================

@app.get("/reports/financial-snapshot")
async def get_financial_snapshot(
    period: Optional[str] = 'all-time',
    current_user: dict = Depends(get_current_user)
):
    """Get overall financial snapshot with optional time period filter"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # Calculate date range based on period
        date_filter = ""
        if period == 'weekly':
            date_filter = "AND wo.scheduled_date >= CURRENT_DATE - INTERVAL '7 days'"
        elif period == 'monthly':
            date_filter = "AND wo.scheduled_date >= CURRENT_DATE - INTERVAL '30 days'"
        elif period == 'quarterly':
            date_filter = "AND wo.scheduled_date >= CURRENT_DATE - INTERVAL '90 days'"
        elif period == 'annually':
            date_filter = "AND wo.scheduled_date >= CURRENT_DATE - INTERVAL '1 year'"
        # all-time has no filter

        # Get filtered financial data
        query = f"""
            SELECT
                -- Revenue metrics
                COALESCE(SUM(CASE WHEN jfd.status = 'completed' THEN jfd.final_price ELSE 0 END), 0) as completed_revenue,
                COALESCE(SUM(jfd.final_price), 0) as total_revenue_pipeline,

                -- Cost metrics
                COALESCE(SUM(CASE WHEN jfd.status = 'completed' THEN jfd.total_material_cost ELSE 0 END), 0) as completed_material_cost,
                COALESCE(SUM(CASE WHEN jfd.status = 'completed' THEN jfd.total_labor_cost ELSE 0 END), 0) as completed_labor_cost,

                -- Profit metrics
                COALESCE(SUM(CASE WHEN jfd.status = 'completed' THEN jfd.gross_profit ELSE 0 END), 0) as completed_gross_profit,

                -- Job counts
                COUNT(*) as total_jobs,
                COUNT(CASE WHEN jfd.status IN ('in_progress', 'scheduled') THEN 1 END) as active_jobs,
                COUNT(CASE WHEN jfd.status = 'completed' THEN 1 END) as completed_jobs,

                -- Labor totals
                COALESCE(SUM(jfd.total_labor_hours), 0) as total_labor_hours,
                COALESCE(SUM(jfd.total_labor_cost), 0) as total_labor_cost,
                COALESCE(SUM(jfd.total_labor_revenue), 0) as total_labor_revenue
            FROM job_financial_detail jfd
            WHERE 1=1 {date_filter.replace('wo.', 'jfd.')}
        """

        cur.execute(query)
        snapshot = cur.fetchone()

        # Get inventory value (not time-filtered)
        cur.execute("""
            SELECT COALESCE(SUM(qty * cost), 0) as inventory_value
            FROM inventory
        """)
        inventory = cur.fetchone()

        # Get invoice totals (filtered by same period)
        invoice_query = f"""
            SELECT
                COALESCE(SUM(i.total_amount), 0) as total_invoiced,
                COALESCE(SUM(i.amount_paid), 0) as total_paid,
                COALESCE(SUM(i.total_amount - i.amount_paid), 0) as outstanding_invoices
            FROM invoices i
            JOIN work_orders wo ON i.work_order_id = wo.id
            WHERE 1=1 {date_filter}
        """
        cur.execute(invoice_query)
        invoices = cur.fetchone()

        result = dict(snapshot) if snapshot else {}
        if inventory:
            result['inventory_value'] = float(inventory['inventory_value'])
        if invoices:
            result['total_invoiced'] = float(invoices['total_invoiced'])
            result['total_paid'] = float(invoices['total_paid'])
            result['outstanding_invoices'] = float(invoices['outstanding_invoices'])

        cur.close()
        conn.close()

        return result

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


# ============================================================
# PROFIT & LOSS REPORT (P&L) - For Accountants
# ============================================================

@app.get("/reports/profit-loss")
async def get_profit_loss_report(
    period: Optional[str] = 'monthly',  # weekly, monthly, quarterly, annually, all-time, custom
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    view: Optional[str] = 'summary',  # summary or itemized
    group_by: Optional[str] = None,  # job, customer, job_type, month
    current_user: dict = Depends(get_current_user)
):
    """
    Comprehensive Profit & Loss Report for accountants.

    Returns revenue, costs, and profit metrics with optional itemization.
    - summary: Shows totals only (default, quick view)
    - itemized: Shows breakdown by jobs with all line items

    Grouping options:
    - job: Each job as a line item
    - customer: Aggregate by customer
    - job_type: Aggregate by job type (Service Call, Panel Upgrade, etc.)
    - month: Aggregate by month (for trend analysis)
    - employee: Aggregate by employee (for payroll/labor analysis)
    - material_category: Aggregate by material category
    """
    require_admin_access(current_user)

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # Calculate date range based on period
        if not end_date:
            end_date = date.today()

        if not start_date:
            if period == 'weekly':
                start_date = end_date - timedelta(days=7)
            elif period == 'monthly':
                start_date = end_date - timedelta(days=30)
            elif period == 'quarterly':
                start_date = end_date - timedelta(days=90)
            elif period == 'annually':
                start_date = end_date - timedelta(days=365)
            elif period == 'all-time':
                start_date = None

        # Build date filter
        date_filter = ""
        params = []
        if start_date:
            date_filter += " AND jfd.scheduled_date >= %s"
            params.append(start_date)
        if end_date:
            date_filter += " AND jfd.scheduled_date <= %s"
            params.append(end_date)

        # SUMMARY VIEW - Quick totals
        summary_query = f"""
            SELECT
                -- REVENUE
                COALESCE(SUM(CASE WHEN jfd.status = 'completed' THEN jfd.total_labor_revenue ELSE 0 END), 0) as labor_revenue,
                COALESCE(SUM(CASE WHEN jfd.status = 'completed' THEN jfd.total_material_revenue ELSE 0 END), 0) as material_revenue,
                COALESCE(SUM(CASE WHEN jfd.status = 'completed' THEN jfd.final_price ELSE 0 END), 0) as total_revenue,

                -- COST OF GOODS SOLD (COGS) / DIRECT COSTS
                COALESCE(SUM(CASE WHEN jfd.status = 'completed' THEN jfd.total_material_cost ELSE 0 END), 0) as material_cost,
                COALESCE(SUM(CASE WHEN jfd.status = 'completed' THEN jfd.total_labor_cost ELSE 0 END), 0) as labor_cost,
                COALESCE(SUM(CASE WHEN jfd.status = 'completed' THEN COALESCE(jfd.total_material_cost, 0) + COALESCE(jfd.total_labor_cost, 0) ELSE 0 END), 0) as total_cogs,

                -- GROSS PROFIT
                COALESCE(SUM(CASE WHEN jfd.status = 'completed' THEN jfd.gross_profit ELSE 0 END), 0) as gross_profit,

                -- JOB COUNTS
                COUNT(CASE WHEN jfd.status = 'completed' THEN 1 END) as completed_jobs,
                COUNT(CASE WHEN jfd.status IN ('in_progress', 'scheduled', 'pending') THEN 1 END) as active_jobs,
                COUNT(*) as total_jobs,

                -- HOURS
                COALESCE(SUM(CASE WHEN jfd.status = 'completed' THEN jfd.total_labor_hours ELSE 0 END), 0) as total_hours

            FROM job_financial_detail jfd
            WHERE 1=1 {date_filter}
        """

        cur.execute(summary_query, params)
        summary_row = cur.fetchone()

        summary = {
            "revenue": {
                "labor": float(summary_row['labor_revenue'] or 0),
                "materials": float(summary_row['material_revenue'] or 0),
                "total": float(summary_row['total_revenue'] or 0)
            },
            "cost_of_goods_sold": {
                "materials": float(summary_row['material_cost'] or 0),
                "labor": float(summary_row['labor_cost'] or 0),
                "total": float(summary_row['total_cogs'] or 0)
            },
            "gross_profit": float(summary_row['gross_profit'] or 0),
            "gross_margin_percent": round(
                (float(summary_row['gross_profit'] or 0) / float(summary_row['total_revenue'] or 1)) * 100, 2
            ) if float(summary_row['total_revenue'] or 0) > 0 else 0,
            "job_counts": {
                "completed": summary_row['completed_jobs'] or 0,
                "active": summary_row['active_jobs'] or 0,
                "total": summary_row['total_jobs'] or 0
            },
            "total_hours": float(summary_row['total_hours'] or 0)
        }

        # Get invoice collection data for the period
        invoice_filter = ""
        invoice_params = []
        if start_date:
            invoice_filter += " AND i.invoice_date >= %s"
            invoice_params.append(start_date)
        if end_date:
            invoice_filter += " AND i.invoice_date <= %s"
            invoice_params.append(end_date)

        cur.execute(f"""
            SELECT
                COALESCE(SUM(i.total_amount), 0) as invoiced,
                COALESCE(SUM(i.amount_paid), 0) as collected,
                COALESCE(SUM(i.total_amount - i.amount_paid), 0) as outstanding
            FROM invoices i
            WHERE 1=1 {invoice_filter}
        """, invoice_params)
        invoice_row = cur.fetchone()

        summary["collections"] = {
            "invoiced": float(invoice_row['invoiced'] or 0),
            "collected": float(invoice_row['collected'] or 0),
            "outstanding": float(invoice_row['outstanding'] or 0)
        }

        # Get inventory value (current snapshot, not time-filtered)
        cur.execute("""
            SELECT COALESCE(SUM(qty * cost), 0) as inventory_value
            FROM inventory
            WHERE active = true
        """)
        inventory_row = cur.fetchone()
        summary["inventory_value"] = float(inventory_row['inventory_value'] or 0)

        result = {
            "report_type": "profit_loss",
            "period": period,
            "start_date": str(start_date) if start_date else None,
            "end_date": str(end_date) if end_date else None,
            "view": view,
            "summary": summary
        }

        # ITEMIZED VIEW - Detailed breakdown
        if view == 'itemized':
            if group_by == 'customer':
                # Group by customer
                cur.execute(f"""
                    SELECT
                        jfd.customer_id,
                        jfd.customer_name,
                        COUNT(*) as job_count,
                        SUM(CASE WHEN jfd.status = 'completed' THEN jfd.final_price ELSE 0 END) as revenue,
                        SUM(CASE WHEN jfd.status = 'completed' THEN jfd.total_material_cost + jfd.total_labor_cost ELSE 0 END) as costs,
                        SUM(CASE WHEN jfd.status = 'completed' THEN jfd.gross_profit ELSE 0 END) as profit,
                        SUM(CASE WHEN jfd.status = 'completed' THEN jfd.total_labor_hours ELSE 0 END) as hours
                    FROM job_financial_detail jfd
                    WHERE 1=1 {date_filter}
                    GROUP BY jfd.customer_id, jfd.customer_name
                    ORDER BY profit DESC
                """, params)
                result["items"] = [dict(row) for row in cur.fetchall()]

            elif group_by == 'job_type':
                # Group by job type
                cur.execute(f"""
                    SELECT
                        jfd.job_type,
                        COUNT(*) as job_count,
                        SUM(CASE WHEN jfd.status = 'completed' THEN jfd.final_price ELSE 0 END) as revenue,
                        SUM(CASE WHEN jfd.status = 'completed' THEN jfd.total_material_cost + jfd.total_labor_cost ELSE 0 END) as costs,
                        SUM(CASE WHEN jfd.status = 'completed' THEN jfd.gross_profit ELSE 0 END) as profit,
                        SUM(CASE WHEN jfd.status = 'completed' THEN jfd.total_labor_hours ELSE 0 END) as hours
                    FROM job_financial_detail jfd
                    WHERE 1=1 {date_filter}
                    GROUP BY jfd.job_type
                    ORDER BY profit DESC
                """, params)
                result["items"] = [dict(row) for row in cur.fetchall()]

            elif group_by == 'month':
                # Group by month for trend analysis
                cur.execute(f"""
                    SELECT
                        TO_CHAR(jfd.scheduled_date, 'YYYY-MM') as month,
                        TO_CHAR(jfd.scheduled_date, 'Mon YYYY') as month_label,
                        COUNT(*) as job_count,
                        SUM(CASE WHEN jfd.status = 'completed' THEN jfd.final_price ELSE 0 END) as revenue,
                        SUM(CASE WHEN jfd.status = 'completed' THEN jfd.total_material_cost ELSE 0 END) as material_cost,
                        SUM(CASE WHEN jfd.status = 'completed' THEN jfd.total_labor_cost ELSE 0 END) as labor_cost,
                        SUM(CASE WHEN jfd.status = 'completed' THEN jfd.gross_profit ELSE 0 END) as profit,
                        SUM(CASE WHEN jfd.status = 'completed' THEN jfd.total_labor_hours ELSE 0 END) as hours
                    FROM job_financial_detail jfd
                    WHERE jfd.scheduled_date IS NOT NULL {date_filter}
                    GROUP BY TO_CHAR(jfd.scheduled_date, 'YYYY-MM'), TO_CHAR(jfd.scheduled_date, 'Mon YYYY')
                    ORDER BY month ASC
                """, params)
                result["items"] = [dict(row) for row in cur.fetchall()]

            elif group_by == 'employee':
                # Group by employee for payroll/labor analysis
                # Build date filter for time_entries
                te_date_filter = ""
                te_params = []
                if start_date:
                    te_date_filter += " AND te.work_date >= %s"
                    te_params.append(start_date)
                if end_date:
                    te_date_filter += " AND te.work_date <= %s"
                    te_params.append(end_date)

                cur.execute(f"""
                    SELECT
                        te.employee_username,
                        COALESCE(u.full_name, te.employee_username) as employee_name,
                        u.role as employee_role,
                        COUNT(DISTINCT te.work_order_id) as job_count,
                        SUM(te.hours_worked) as total_hours,
                        SUM(te.pay_amount) as labor_cost,
                        SUM(te.billable_amount) as labor_revenue,
                        SUM(te.billable_amount) - SUM(te.pay_amount) as profit,
                        CASE
                            WHEN SUM(te.billable_amount) > 0
                            THEN ROUND(((SUM(te.billable_amount) - SUM(te.pay_amount)) / SUM(te.billable_amount) * 100)::numeric, 2)
                            ELSE 0
                        END as margin_percent,
                        AVG(te.pay_rate) as avg_pay_rate,
                        AVG(te.billable_rate) as avg_bill_rate
                    FROM time_entries te
                    LEFT JOIN users u ON te.employee_username = u.username
                    WHERE te.work_order_id IS NOT NULL {te_date_filter}
                    GROUP BY te.employee_username, u.full_name, u.role
                    ORDER BY labor_cost DESC
                """, te_params)
                result["items"] = [dict(row) for row in cur.fetchall()]

            elif group_by == 'material_category':
                # Group by material category
                # Build date filter for job_materials_used
                jm_date_filter = ""
                jm_params = []
                if start_date:
                    jm_date_filter += " AND wo.scheduled_date >= %s"
                    jm_params.append(start_date)
                if end_date:
                    jm_date_filter += " AND wo.scheduled_date <= %s"
                    jm_params.append(end_date)

                cur.execute(f"""
                    SELECT
                        COALESCE(i.category, 'Uncategorized') as category,
                        COUNT(DISTINCT jm.work_order_id) as job_count,
                        COUNT(DISTINCT jm.inventory_id) as unique_items,
                        SUM(jm.quantity_used) as total_quantity,
                        SUM(jm.line_cost) as material_cost,
                        SUM(jm.line_total) as material_revenue,
                        SUM(jm.line_total) - SUM(jm.line_cost) as profit,
                        CASE
                            WHEN SUM(jm.line_total) > 0
                            THEN ROUND(((SUM(jm.line_total) - SUM(jm.line_cost)) / SUM(jm.line_total) * 100)::numeric, 2)
                            ELSE 0
                        END as margin_percent
                    FROM job_materials_used jm
                    JOIN inventory i ON jm.inventory_id = i.id
                    JOIN work_orders wo ON jm.work_order_id = wo.id
                    WHERE wo.status = 'completed' {jm_date_filter}
                    GROUP BY i.category
                    ORDER BY material_cost DESC
                """, jm_params)
                result["items"] = [dict(row) for row in cur.fetchall()]

            else:
                # Default: Group by job (each job is a line item)
                cur.execute(f"""
                    SELECT
                        jfd.work_order_id,
                        jfd.work_order_number,
                        jfd.job_type,
                        jfd.status,
                        jfd.customer_name,
                        jfd.scheduled_date,
                        COALESCE(jfd.total_labor_revenue, 0) as labor_revenue,
                        COALESCE(jfd.total_material_revenue, 0) as material_revenue,
                        COALESCE(jfd.final_price, 0) as total_revenue,
                        COALESCE(jfd.total_material_cost, 0) as material_cost,
                        COALESCE(jfd.total_labor_cost, 0) as labor_cost,
                        COALESCE(jfd.gross_profit, 0) as profit,
                        COALESCE(jfd.total_labor_hours, 0) as hours,
                        COALESCE(jfd.profit_margin_percent, 0) as margin_percent
                    FROM job_financial_detail jfd
                    WHERE 1=1 {date_filter}
                    ORDER BY jfd.scheduled_date DESC, jfd.work_order_number DESC
                """, params)
                result["items"] = [dict(row) for row in cur.fetchall()]

        cur.close()
        conn.close()

        return result

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


@app.get("/reports/profit-loss/compare")
async def get_profit_loss_comparison(
    period1_start: date,
    period1_end: date,
    period2_start: date,
    period2_end: date,
    current_user: dict = Depends(get_current_user)
):
    """
    Compare P&L between two time periods.
    Useful for month-over-month or year-over-year analysis.
    """
    require_admin_access(current_user)

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        def get_period_data(start, end):
            cur.execute("""
                SELECT
                    COALESCE(SUM(CASE WHEN status = 'completed' THEN final_price ELSE 0 END), 0) as revenue,
                    COALESCE(SUM(CASE WHEN status = 'completed' THEN total_material_cost + total_labor_cost ELSE 0 END), 0) as costs,
                    COALESCE(SUM(CASE WHEN status = 'completed' THEN gross_profit ELSE 0 END), 0) as profit,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs,
                    COALESCE(SUM(CASE WHEN status = 'completed' THEN total_labor_hours ELSE 0 END), 0) as hours
                FROM job_financial_detail
                WHERE scheduled_date >= %s AND scheduled_date <= %s
            """, (start, end))
            return dict(cur.fetchone())

        period1 = get_period_data(period1_start, period1_end)
        period2 = get_period_data(period2_start, period2_end)

        # Calculate changes
        def calc_change(new, old):
            if old == 0:
                return 100.0 if new > 0 else 0.0
            return round(((new - old) / old) * 100, 2)

        comparison = {
            "period1": {
                "start": str(period1_start),
                "end": str(period1_end),
                "revenue": float(period1['revenue']),
                "costs": float(period1['costs']),
                "profit": float(period1['profit']),
                "jobs": period1['completed_jobs'],
                "hours": float(period1['hours'])
            },
            "period2": {
                "start": str(period2_start),
                "end": str(period2_end),
                "revenue": float(period2['revenue']),
                "costs": float(period2['costs']),
                "profit": float(period2['profit']),
                "jobs": period2['completed_jobs'],
                "hours": float(period2['hours'])
            },
            "change": {
                "revenue": calc_change(period1['revenue'], period2['revenue']),
                "costs": calc_change(period1['costs'], period2['costs']),
                "profit": calc_change(period1['profit'], period2['profit']),
                "jobs": calc_change(period1['completed_jobs'], period2['completed_jobs']),
                "hours": calc_change(period1['hours'], period2['hours'])
            }
        }

        cur.close()
        conn.close()

        return comparison

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


@app.get("/reports/job-financial-detail")
async def get_job_financial_detail(
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed financial breakdown for jobs with optional filters"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        query = "SELECT * FROM job_financial_detail WHERE 1=1"
        params = []

        if status:
            query += " AND status = %s"
            params.append(status)

        if customer_id:
            query += " AND customer_id = %s"
            params.append(customer_id)

        if start_date:
            query += " AND scheduled_date >= %s"
            params.append(start_date)

        if end_date:
            query += " AND scheduled_date <= %s"
            params.append(end_date)

        query += " ORDER BY created_at DESC"

        cur.execute(query, params)
        jobs = cur.fetchall()

        cur.close()
        conn.close()

        return [dict(job) for job in jobs]
    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


@app.get("/reports/monthly-summary")
async def get_monthly_summary(
    months: int = 12,
    current_user: dict = Depends(get_current_user)
):
    """Get monthly financial summary for the last N months"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        cur.execute("""
            SELECT * FROM monthly_financial_summary
            ORDER BY month DESC
            LIMIT %s
        """, (months,))

        summary = cur.fetchall()

        cur.close()
        conn.close()

        return [dict(row) for row in summary]
    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


@app.get("/reports/customer-summary")
async def get_customer_summary(
    limit: int = 100,
    min_lifetime_value: float = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get customer financial summary sorted by lifetime value"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        cur.execute("""
            SELECT * FROM customer_financial_summary
            WHERE lifetime_value >= %s
            ORDER BY lifetime_value DESC
            LIMIT %s
        """, (min_lifetime_value, limit))

        customers = cur.fetchall()

        cur.close()
        conn.close()

        return [dict(row) for row in customers]
    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


@app.get("/reports/inventory-valuation")
async def get_inventory_valuation(
    category: Optional[str] = None,
    low_stock_only: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get inventory valuation and turnover metrics"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        query = "SELECT * FROM inventory_valuation WHERE 1=1"
        params = []

        if category:
            query += " AND category = %s"
            params.append(category)

        if low_stock_only:
            query += " AND is_low_stock = true"

        query += " ORDER BY inventory_value DESC"

        cur.execute(query, params)
        inventory = cur.fetchall()

        cur.close()
        conn.close()

        return [dict(row) for row in inventory]
    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


@app.get("/reports/dead-stock")
async def get_dead_stock_report(
    months_inactive: int = 6,
    current_user: dict = Depends(get_current_user)
):
    """
    Get dead/slow-moving stock report.
    Identifies items with no usage in the specified period (default 6 months).
    """
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        cur.execute("""
            WITH usage_check AS (
                SELECT
                    i.id,
                    i.item_id,
                    i.description,
                    i.brand,
                    i.category,
                    i.qty,
                    i.qty_available,
                    i.cost,
                    i.sell_price,
                    i.location,
                    i.last_used_date,
                    i.times_used,
                    i.discontinued,
                    -- Calculate inventory value
                    (i.qty * COALESCE(i.cost, 0)) as inventory_value,
                    -- Days since last used
                    CASE
                        WHEN i.last_used_date IS NOT NULL
                        THEN CURRENT_DATE - i.last_used_date
                        ELSE NULL
                    END as days_since_used,
                    -- Check for any transactions in the period
                    (
                        SELECT COUNT(*)
                        FROM stock_transactions st
                        WHERE st.inventory_id = i.id
                          AND st.quantity_change < 0
                          AND st.transaction_date >= CURRENT_DATE - (%(months)s * INTERVAL '1 month')
                    ) as transactions_in_period,
                    -- Recommendation
                    CASE
                        WHEN i.discontinued = TRUE THEN 'Return to Vendor or Dispose'
                        WHEN i.qty > 0 AND i.cost > 50 THEN 'Consider Returning to Vendor'
                        WHEN i.qty > 0 AND i.cost <= 50 THEN 'Discount Sale or Dispose'
                        ELSE 'Monitor'
                    END as recommendation
                FROM inventory i
                WHERE i.active = TRUE
                  AND i.qty > 0
            )
            SELECT * FROM usage_check
            WHERE (
                last_used_date IS NULL
                OR last_used_date < CURRENT_DATE - (%(months)s * INTERVAL '1 month')
            )
            AND transactions_in_period = 0
            ORDER BY inventory_value DESC
        """, {'months': months_inactive})

        items = cur.fetchall()

        # Calculate summary
        total_value = sum(float(i.get('inventory_value', 0) or 0) for i in items)
        discontinued_count = sum(1 for i in items if i.get('discontinued'))
        high_value_items = [i for i in items if float(i.get('inventory_value', 0) or 0) > 100]

        cur.close()
        conn.close()

        return {
            "dead_stock": [dict(row) for row in items],
            "summary": {
                "total_items": len(items),
                "total_value": round(total_value, 2),
                "discontinued_count": discontinued_count,
                "high_value_count": len(high_value_items),
                "months_inactive_threshold": months_inactive
            }
        }
    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)

@app.get("/reports/shrinkage-analysis")
async def get_shrinkage_analysis(
    current_user: dict = Depends(get_current_user)
):
    """
    Analyze inventory shrinkage by comparing count variances.
    Identifies potential theft, damage, or process problems.
    """
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # Overall shrinkage by location
        cur.execute("""
            WITH location_shrinkage AS (
                SELECT
                    COALESCE(i.location, 'Unassigned') as location,
                    COUNT(*) as item_count,
                    SUM(CASE WHEN i.count_variance < 0 THEN 1 ELSE 0 END) as items_with_shortage,
                    SUM(CASE WHEN i.count_variance > 0 THEN 1 ELSE 0 END) as items_with_overage,
                    SUM(i.count_variance) as total_variance_units,
                    SUM(i.count_variance * COALESCE(i.cost, 0)) as total_variance_value,
                    SUM(CASE WHEN i.count_variance < 0 THEN i.count_variance * COALESCE(i.cost, 0) ELSE 0 END) as shrinkage_value,
                    SUM(CASE WHEN i.count_variance > 0 THEN i.count_variance * COALESCE(i.cost, 0) ELSE 0 END) as overage_value
                FROM inventory i
                WHERE i.active = TRUE
                  AND i.count_variance != 0
                GROUP BY i.location
                ORDER BY shrinkage_value ASC
            )
            SELECT * FROM location_shrinkage
        """)
        by_location = cur.fetchall()

        # Items with significant negative variance
        cur.execute("""
            SELECT
                i.id,
                i.item_id,
                i.description,
                i.brand,
                i.category,
                i.location,
                i.bin_location,
                i.qty,
                i.count_variance,
                i.last_counted_date,
                i.cost,
                (i.count_variance * COALESCE(i.cost, 0)) as variance_value,
                -- Risk assessment
                CASE
                    WHEN i.count_variance <= -10 THEN 'HIGH'
                    WHEN i.count_variance <= -5 THEN 'MEDIUM'
                    ELSE 'LOW'
                END as risk_level
            FROM inventory i
            WHERE i.active = TRUE
              AND i.count_variance < 0
            ORDER BY (i.count_variance * COALESCE(i.cost, 0)) ASC
            LIMIT 50
        """)
        worst_items = cur.fetchall()

        # Adjustment transactions by user (to identify patterns)
        cur.execute("""
            SELECT
                st.performed_by as username,
                COUNT(*) as total_adjustments,
                SUM(CASE WHEN st.quantity_change < 0 THEN 1 ELSE 0 END) as negative_adjustments,
                SUM(CASE WHEN st.quantity_change > 0 THEN 1 ELSE 0 END) as positive_adjustments,
                SUM(st.quantity_change) as net_change,
                SUM(
                    CASE
                        WHEN st.quantity_change < 0
                        THEN st.quantity_change * COALESCE((SELECT cost FROM inventory WHERE id = st.inventory_id), 0)
                        ELSE 0
                    END
                ) as total_removed_value
            FROM stock_transactions st
            WHERE st.transaction_type = 'adjustment'
              AND st.transaction_date >= CURRENT_DATE - INTERVAL '90 days'
              AND st.performed_by IS NOT NULL
            GROUP BY st.performed_by
            ORDER BY total_removed_value ASC
        """)
        by_user = cur.fetchall()

        # Calculate overall summary
        total_shrinkage = sum(float(l.get('shrinkage_value', 0) or 0) for l in by_location)
        total_overage = sum(float(l.get('overage_value', 0) or 0) for l in by_location)
        locations_with_shrinkage = sum(1 for l in by_location if float(l.get('shrinkage_value', 0) or 0) < 0)

        cur.close()
        conn.close()

        return {
            "by_location": [dict(row) for row in by_location],
            "worst_items": [dict(row) for row in worst_items],
            "by_user": [dict(row) for row in by_user],
            "summary": {
                "total_shrinkage_value": round(abs(total_shrinkage), 2),
                "total_overage_value": round(total_overage, 2),
                "net_variance_value": round(total_overage + total_shrinkage, 2),
                "locations_with_shrinkage": locations_with_shrinkage,
                "items_with_shortage": len(worst_items)
            }
        }
    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)

@app.get("/reports/employee-productivity")
async def get_employee_productivity(
    current_user: dict = Depends(get_current_user)
):
    """Get employee productivity and time tracking metrics"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        cur.execute("SELECT * FROM employee_productivity ORDER BY revenue_30days DESC")
        employees = cur.fetchall()

        cur.close()
        conn.close()

        return [dict(row) for row in employees]
    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


@app.get("/reports/date-range")
async def get_financial_report_date_range(
    start_date: date,
    end_date: date,
    current_user: dict = Depends(get_current_user)
):
    """Get financial report for a specific date range"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        cur.execute("""
            SELECT * FROM get_financial_report(%s, %s)
        """, (start_date, end_date))

        report = cur.fetchall()

        cur.close()
        conn.close()

        # Group by category for easier frontend consumption
        grouped = {}
        for row in report:
            category = row['metric_category']
            if category not in grouped:
                grouped[category] = []
            grouped[category].append(dict(row))

        return grouped
    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


# ============================================================
# COMPREHENSIVE REPORTING ENDPOINTS
# ============================================================
# These endpoints provide detailed reporting for materials, labor,
# and profitability analysis across various time periods.
# Access is restricted to admin/manager roles only.

# Helper function to require admin access
def require_admin_access(current_user: dict):
    """Ensure user has admin or manager role"""
    if current_user['role'] not in ['admin', 'manager']:
        raise HTTPException(
            status_code=403,
            detail="Access denied. This report requires admin or manager privileges."
        )

# ============================================================
# JOB PROFITABILITY REPORTS
# ============================================================

@app.get("/reports/profitability/job/{work_order_id}")
async def get_job_profitability(
    work_order_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Get complete profitability report for a specific job
    Includes materials, labor, revenue, costs, and profit margins
    """
    require_admin_access(current_user)

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # Get job profitability summary
        cur.execute("""
            SELECT * FROM job_profitability_view
            WHERE work_order_id = %s
        """, (work_order_id,))

        profitability = cur.fetchone()

        if not profitability:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Job not found")

        # Get material details
        cur.execute("""
            SELECT
                jm.id,
                jm.work_order_id,
                i.description as item_name,
                i.sku,
                i.category,
                jm.quantity_used,
                jm.quantity_returned,
                jm.unit_cost,
                jm.unit_price,
                jm.line_cost,
                jm.line_total,
                (jm.line_total - jm.line_cost) as line_profit,
                jm.installed_date,
                jm.status
            FROM job_materials_used jm
            JOIN inventory i ON jm.inventory_id = i.id
            WHERE jm.work_order_id = %s
            ORDER BY i.category, i.description
        """, (work_order_id,))

        materials = cur.fetchall()

        # Get labor details
        cur.execute("""
            SELECT * FROM job_labor_detail_view
            WHERE work_order_id = %s
            ORDER BY work_date, employee_name
        """, (work_order_id,))

        labor = cur.fetchall()

        cur.close()
        conn.close()

        return {
            "profitability": dict(profitability),
            "materials": [dict(m) for m in materials],
            "labor": [dict(l) for l in labor]
        }

    except HTTPException:
        raise
    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


@app.get("/reports/profitability/summary")
async def get_profitability_summary(
    period: Optional[str] = 'monthly',  # daily, weekly, monthly, quarterly, annually, all-time
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    job_type: Optional[str] = None,
    customer_id: Optional[int] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get profitability summary across multiple jobs
    Supports various time periods and filters
    """
    require_admin_access(current_user)

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # Build query with filters
        query = "SELECT * FROM job_profitability_view WHERE 1=1"
        params = []

        # Date filtering based on period
        if period != 'all-time':
            if not end_date:
                end_date = date.today()

            if not start_date:
                if period == 'daily':
                    start_date = end_date
                elif period == 'weekly':
                    start_date = end_date - timedelta(days=7)
                elif period == 'monthly':
                    start_date = end_date - timedelta(days=30)
                elif period == 'quarterly':
                    start_date = end_date - timedelta(days=90)
                elif period == 'annually':
                    start_date = end_date - timedelta(days=365)

        if start_date:
            query += " AND scheduled_date >= %s"
            params.append(start_date)

        if end_date:
            query += " AND scheduled_date <= %s"
            params.append(end_date)

        if job_type:
            query += " AND job_type = %s"
            params.append(job_type)

        if customer_id:
            query += " AND customer_id = %s"
            params.append(customer_id)

        if status:
            query += " AND status = %s"
            params.append(status)

        query += " ORDER BY scheduled_date DESC, work_order_number DESC"

        cur.execute(query, params)
        jobs = cur.fetchall()

        cur.close()
        conn.close()

        return {
            "period": period,
            "start_date": str(start_date) if start_date else None,
            "end_date": str(end_date) if end_date else None,
            "jobs": [dict(job) for job in jobs],
            "summary": {
                "total_jobs": len(jobs),
                "total_revenue": float(sum(Decimal(str(j['total_revenue'] or 0)) for j in jobs)),
                "total_costs": float(sum(Decimal(str(j['total_costs'] or 0)) for j in jobs)),
                "gross_profit": float(sum(Decimal(str(j['gross_profit'] or 0)) for j in jobs)),
                "total_hours": float(sum(Decimal(str(j['total_hours_worked'] or 0)) for j in jobs)),
            }
        }

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


# ============================================================
# MATERIAL REPORTS
# ============================================================

@app.get("/reports/materials/job/{work_order_id}")
async def get_job_materials(
    work_order_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get all materials used on a specific job"""
    require_admin_access(current_user)

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        cur.execute("""
            SELECT * FROM job_material_detail_view
            WHERE work_order_id = %s
            ORDER BY category, item_name
        """, (work_order_id,))

        materials = cur.fetchall()

        cur.close()
        conn.close()

        if not materials:
            return {"work_order_id": work_order_id, "materials": []}

        return {
            "work_order_id": work_order_id,
            "work_order_number": materials[0]['work_order_number'],
            "customer_name": materials[0]['customer_name'],
            "materials": [dict(m) for m in materials],
            "summary": {
                "total_items": len(materials),
                "total_quantity_used": float(sum(Decimal(str(m['quantity_used'] or 0)) for m in materials)),
                "total_cost": float(sum(Decimal(str(m['line_cost'] or 0)) for m in materials)),
                "total_revenue": float(sum(Decimal(str(m['line_total'] or 0)) for m in materials)),
                "total_profit": float(sum(Decimal(str(m['line_profit'] or 0)) for m in materials)),
            }
        }

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


@app.get("/reports/materials/summary")
async def get_material_usage_summary(
    period: Optional[str] = 'monthly',
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get material usage aggregates by item or category"""
    require_admin_access(current_user)

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # Build date range filter for materials
        date_filter = ""
        params = []

        if period != 'all-time':
            if not end_date:
                end_date = date.today()

            if not start_date:
                if period == 'weekly':
                    start_date = end_date - timedelta(days=7)
                elif period == 'monthly':
                    start_date = end_date - timedelta(days=30)
                elif period == 'quarterly':
                    start_date = end_date - timedelta(days=90)
                elif period == 'annually':
                    start_date = end_date - timedelta(days=365)

            if start_date and end_date:
                date_filter = """
                    AND jm.installed_date >= %s
                    AND jm.installed_date <= %s
                """
                params.extend([start_date, end_date])

        # Get category summary
        category_query = f"""
            SELECT
                i.category,
                COUNT(DISTINCT jm.inventory_id) as unique_materials,
                SUM(jm.quantity_used) as total_quantity,
                SUM(jm.line_cost) as total_cost,
                SUM(jm.line_total) as total_revenue,
                SUM(jm.line_total - jm.line_cost) as total_profit
            FROM job_materials_used jm
            JOIN inventory i ON jm.inventory_id = i.id
            WHERE jm.status IN ('used', 'billed')
            {date_filter}
            GROUP BY i.category
            ORDER BY total_revenue DESC
        """

        cur.execute(category_query, params)
        categories = cur.fetchall()

        # Get top materials
        top_materials_query = f"""
            SELECT
                i.description as item_name,
                i.sku,
                i.category,
                SUM(jm.quantity_used) as total_quantity,
                SUM(jm.line_cost) as total_cost,
                SUM(jm.line_total) as total_revenue,
                COUNT(DISTINCT jm.work_order_id) as jobs_used_on
            FROM job_materials_used jm
            JOIN inventory i ON jm.inventory_id = i.id
            WHERE jm.status IN ('used', 'billed')
            {date_filter}
            GROUP BY i.description, i.sku, i.category
            ORDER BY total_revenue DESC
            LIMIT 20
        """

        cur.execute(top_materials_query, params)
        top_materials = cur.fetchall()

        cur.close()
        conn.close()

        return {
            "period": period,
            "start_date": str(start_date) if start_date else None,
            "end_date": str(end_date) if end_date else None,
            "categories": [dict(c) for c in categories],
            "top_materials": [dict(m) for m in top_materials]
        }

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


# ============================================================
# LABOR REPORTS
# ============================================================

@app.get("/reports/labor/job/{work_order_id}")
async def get_job_labor(
    work_order_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get all labor hours for a specific job"""
    require_admin_access(current_user)

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        cur.execute("""
            SELECT * FROM job_labor_detail_view
            WHERE work_order_id = %s
            ORDER BY work_date, employee_name
        """, (work_order_id,))

        labor_entries = cur.fetchall()

        cur.close()
        conn.close()

        if not labor_entries:
            return {"work_order_id": work_order_id, "labor_entries": []}

        return {
            "work_order_id": work_order_id,
            "work_order_number": labor_entries[0]['work_order_number'],
            "customer_name": labor_entries[0]['customer_name'],
            "labor_entries": [dict(l) for l in labor_entries],
            "summary": {
                "total_hours": float(sum(Decimal(str(l['hours_worked'] or 0)) for l in labor_entries)),
                "total_employees": len(set(l['employee_username'] for l in labor_entries)),
                "total_labor_cost": float(sum(Decimal(str(l['pay_amount'] or 0)) for l in labor_entries)),
                "total_billable": float(sum(Decimal(str(l['billable_amount'] or 0)) for l in labor_entries)),
                "total_margin": float(sum(Decimal(str(l['labor_margin'] or 0)) for l in labor_entries)),
            }
        }

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


@app.get("/reports/labor/timecard/{username}")
async def get_employee_timecard(
    username: str,
    week_ending: Optional[date] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get employee timecard for a specific week
    Employees can view their own, admins can view any
    """
    # Allow employees to see their own timecard
    if current_user['username'] != username and current_user['role'] not in ['admin', 'manager']:
        raise HTTPException(status_code=403, detail="Access denied")

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # If no week ending specified, use current week
        if not week_ending:
            today = date.today()
            days_until_sunday = (6 - today.weekday()) % 7
            week_ending = today + timedelta(days=days_until_sunday)

        # Get time entries for the week
        cur.execute("""
            SELECT
                te.*,
                wo.work_order_number,
                wo.job_description
            FROM time_entries te
            JOIN work_orders wo ON te.work_order_id = wo.id
            WHERE te.employee_username = %s
              AND te.week_ending_date = %s
            ORDER BY te.work_date, wo.work_order_number
        """, (username, week_ending))

        entries = cur.fetchall()

        # Get user info
        cur.execute("""
            SELECT full_name, role, hourly_rate
            FROM users
            WHERE username = %s
        """, (username,))

        user_info = cur.fetchone()

        cur.close()
        conn.close()

        if not user_info:
            raise HTTPException(status_code=404, detail="Employee not found")

        total_hours = sum(Decimal(str(e['hours_worked'] or 0)) for e in entries)
        is_locked = entries[0]['is_locked'] if entries else False

        return {
            "employee": {
                "username": username,
                "full_name": user_info['full_name'],
                "role": user_info['role'],
                "hourly_rate": float(user_info['hourly_rate']) if user_info['hourly_rate'] else None
            },
            "week_ending": str(week_ending),
            "is_locked": is_locked,
            "entries": [dict(e) for e in entries],
            "summary": {
                "total_hours": float(total_hours),
                "regular_hours": min(float(total_hours), 40.0),
                "overtime_hours": max(0.0, float(total_hours) - 40.0),
                "days_worked": len(set(e['work_date'] for e in entries)),
                "jobs_worked": len(set(e['work_order_id'] for e in entries))
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


@app.get("/reports/labor/summary")
async def get_labor_summary(
    period: Optional[str] = 'weekly',
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    employee_username: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get labor summary across time periods and employees"""
    require_admin_access(current_user)

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # Build date filter
        date_filter = ""
        params = []

        if period != 'all-time':
            if not end_date:
                end_date = date.today()

            if not start_date:
                if period == 'weekly':
                    start_date = end_date - timedelta(days=7)
                elif period == 'monthly':
                    start_date = end_date - timedelta(days=30)
                elif period == 'quarterly':
                    start_date = end_date - timedelta(days=90)
                elif period == 'annually':
                    start_date = end_date - timedelta(days=365)

            date_filter = "AND te.work_date >= %s AND te.work_date <= %s"
            params.extend([start_date, end_date])

        employee_filter = ""
        if employee_username:
            employee_filter = "AND te.employee_username = %s"
            params.append(employee_username)

        # Get summary by employee
        query = f"""
            SELECT
                u.username,
                u.full_name as employee_name,
                u.role,
                COUNT(DISTINCT te.work_date) as days_worked,
                COUNT(DISTINCT te.work_order_id) as jobs_worked,
                COALESCE(SUM(te.hours_worked), 0) as total_hours,
                COALESCE(SUM(te.pay_amount), 0) as total_labor_cost,
                COALESCE(SUM(te.billable_amount), 0) as total_labor_revenue,
                COALESCE(SUM(te.billable_amount - te.pay_amount), 0) as total_margin
            FROM users u
            LEFT JOIN time_entries te ON u.username = te.employee_username
            WHERE u.role IN ('technician', 'admin', 'manager')
              {date_filter}
              {employee_filter}
            GROUP BY u.username, u.full_name, u.role
            HAVING COALESCE(SUM(te.hours_worked), 0) > 0
            ORDER BY total_labor_revenue DESC NULLS LAST
        """

        cur.execute(query, params)
        employees = cur.fetchall()

        # Calculate summary totals
        total_hours = sum(float(e['total_hours'] or 0) for e in employees)
        total_labor_cost = sum(float(e['total_labor_cost'] or 0) for e in employees)
        total_labor_revenue = sum(float(e['total_labor_revenue'] or 0) for e in employees)

        # Get recent timecards
        timecard_params = []
        timecard_date_filter = ""
        if period != 'all-time' and start_date and end_date:
            timecard_date_filter = "AND te.work_date >= %s AND te.work_date <= %s"
            timecard_params.extend([start_date, end_date])

        timecard_query = f"""
            SELECT
                te.work_date,
                u.full_name as employee_name,
                wo.work_order_number,
                te.hours_worked,
                te.pay_rate,
                te.billable_rate as bill_rate,
                te.pay_amount,
                te.billable_amount as bill_amount
            FROM time_entries te
            JOIN users u ON te.employee_username = u.username
            LEFT JOIN work_orders wo ON te.work_order_id = wo.id
            WHERE 1=1
            {timecard_date_filter}
            ORDER BY te.work_date DESC
            LIMIT 50
        """

        cur.execute(timecard_query, timecard_params)
        recent_timecards = cur.fetchall()

        cur.close()
        conn.close()

        return {
            "period": period,
            "start_date": str(start_date) if start_date else None,
            "end_date": str(end_date) if end_date else None,
            "summary": {
                "total_hours": total_hours,
                "billable_hours": total_hours,
                "total_labor_cost": total_labor_cost,
                "total_labor_revenue": total_labor_revenue
            },
            "employees": [dict(e) for e in employees],
            "recent_timecards": [dict(t) for t in recent_timecards]
        }

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


# ============================================================
# DAILY ACTIVITY REPORT
# ============================================================

@app.get("/reports/daily-activity")
async def get_daily_activity(
    activity_date: Optional[date] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get activity summary for a specific date"""
    require_admin_access(current_user)

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        if not activity_date:
            activity_date = date.today()

        cur.execute("""
            SELECT * FROM daily_activity_summary_view
            WHERE activity_date = %s
        """, (activity_date,))

        summary = cur.fetchone()

        if not summary:
            # Return empty summary if no activity
            summary = {
                "activity_date": activity_date,
                "jobs_with_labor": 0,
                "jobs_with_materials": 0,
                "unique_jobs_worked": 0,
                "employees_worked": 0,
                "total_labor_hours": 0,
                "materials_used_count": 0,
                "total_material_quantity": 0,
                "labor_cost": 0,
                "labor_revenue": 0,
                "material_cost": 0,
                "material_revenue": 0,
                "total_cost": 0,
                "total_revenue": 0,
                "gross_profit": 0,
                "profit_margin_percent": 0
            }
        else:
            summary = dict(summary)

        # Get job details for the day
        cur.execute("""
            SELECT DISTINCT
                wo.id,
                wo.work_order_number,
                wo.job_type,
                wo.status,
                c.first_name || ' ' || c.last_name as customer_name
            FROM work_orders wo
            JOIN customers c ON wo.customer_id = c.id
            LEFT JOIN time_entries te ON wo.id = te.work_order_id AND te.work_date = %s
            LEFT JOIN job_materials_used jm ON wo.id = jm.work_order_id AND DATE(jm.installed_date) = %s
            WHERE te.id IS NOT NULL OR jm.id IS NOT NULL
            ORDER BY wo.work_order_number
        """, (activity_date, activity_date))

        jobs = cur.fetchall()

        cur.close()
        conn.close()

        return {
            "summary": summary,
            "jobs": [dict(j) for j in jobs]
        }

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


# ============================================================
# VARIANCE REPORTS (Projected vs Actual)
# ============================================================

class MaterialUsageUpdate(BaseModel):
    quantity_used: int
    installed_location: Optional[str] = None
    notes: Optional[str] = None

class BulkMaterialUsageUpdate(BaseModel):
    materials: list  # List of {material_id: int, quantity_used: int}


@app.get("/reports/variance/job/{work_order_id}")
async def get_job_variance(
    work_order_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Get projected vs actual variance report for a specific job.
    Shows side-by-side comparison of hours, labor, and materials.
    """
    require_admin_access(current_user)

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # Get variance summary from view
        cur.execute("""
            SELECT * FROM job_variance_view
            WHERE work_order_id = %s
        """, (work_order_id,))

        variance = cur.fetchone()

        if not variance:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Job not found")

        # Get material-level details
        cur.execute("""
            SELECT
                jm.id,
                i.description as item_name,
                i.sku,
                i.category,
                jm.quantity_needed as projected_qty,
                COALESCE(jm.quantity_used, 0) as actual_qty,
                (COALESCE(jm.quantity_used, 0) - jm.quantity_needed) as qty_variance,
                jm.unit_cost,
                jm.unit_price,
                (jm.quantity_needed * COALESCE(jm.unit_cost, 0)) as projected_cost,
                COALESCE(jm.line_cost, 0) as actual_cost,
                (jm.quantity_needed * COALESCE(jm.unit_price, 0)) as projected_revenue,
                COALESCE(jm.line_total, 0) as actual_revenue,
                jm.status
            FROM job_materials_used jm
            JOIN inventory i ON jm.inventory_id = i.id
            WHERE jm.work_order_id = %s
            ORDER BY i.category, i.description
        """, (work_order_id,))

        materials = cur.fetchall()

        # Get labor-level details (by employee)
        cur.execute("""
            SELECT
                te.employee_username,
                u.full_name as employee_name,
                SUM(te.hours_worked) as actual_hours,
                SUM(COALESCE(te.pay_amount, 0)) as actual_pay,
                SUM(COALESCE(te.billable_amount, 0)) as actual_billable
            FROM time_entries te
            JOIN users u ON te.employee_username = u.username
            WHERE te.work_order_id = %s
            GROUP BY te.employee_username, u.full_name
            ORDER BY u.full_name
        """, (work_order_id,))

        labor = cur.fetchall()

        # Get scheduled hours by phase/date
        cur.execute("""
            SELECT
                jsd.scheduled_date,
                jsd.phase_name,
                jsd.estimated_hours as projected_hours,
                COALESCE(te_sum.actual_hours, 0) as actual_hours,
                jsd.status
            FROM job_schedule_dates jsd
            LEFT JOIN (
                SELECT work_date, work_order_id, SUM(hours_worked) as actual_hours
                FROM time_entries
                GROUP BY work_date, work_order_id
            ) te_sum ON jsd.work_order_id = te_sum.work_order_id
                AND te_sum.work_date = jsd.scheduled_date
            WHERE jsd.work_order_id = %s
            ORDER BY jsd.scheduled_date
        """, (work_order_id,))

        schedule = cur.fetchall()

        # Get material change history
        cur.execute("""
            SELECT
                mcl.changed_at,
                mcl.change_type,
                mcl.field_changed,
                mcl.old_value,
                mcl.new_value,
                mcl.change_reason,
                mcl.changed_by,
                i.description as item_name
            FROM material_change_log mcl
            JOIN inventory i ON mcl.inventory_id = i.id
            WHERE mcl.work_order_id = %s
            ORDER BY mcl.changed_at DESC
            LIMIT 50
        """, (work_order_id,))

        material_history = cur.fetchall()

        cur.close()
        conn.close()

        return {
            "summary": dict(variance),
            "materials": [dict(m) for m in materials],
            "labor": [dict(l) for l in labor],
            "schedule": [dict(s) for s in schedule],
            "material_history": [dict(h) for h in material_history]
        }

    except HTTPException:
        raise
    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


@app.get("/reports/variance/summary")
async def get_variance_summary(
    period: Optional[str] = 'monthly',
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    job_type: Optional[str] = None,
    customer_id: Optional[int] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get projected vs actual variance summary across multiple jobs.
    Supports weekly, monthly, quarterly, annually, and all-time views.
    """
    require_admin_access(current_user)

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # Build date filters
        if period != 'all-time':
            if not end_date:
                end_date = date.today()

            if not start_date:
                if period == 'daily':
                    start_date = end_date
                elif period == 'weekly':
                    start_date = end_date - timedelta(days=7)
                elif period == 'monthly':
                    start_date = end_date - timedelta(days=30)
                elif period == 'quarterly':
                    start_date = end_date - timedelta(days=90)
                elif period == 'annually':
                    start_date = end_date - timedelta(days=365)

        # Build query with filters
        query = "SELECT * FROM job_variance_view WHERE 1=1"
        params = []

        if start_date:
            query += " AND scheduled_date >= %s"
            params.append(start_date)

        if end_date:
            query += " AND scheduled_date <= %s"
            params.append(end_date)

        if job_type:
            query += " AND job_type = %s"
            params.append(job_type)

        if customer_id:
            query += " AND customer_id = %s"
            params.append(customer_id)

        if status:
            query += " AND status = %s"
            params.append(status)

        query += " ORDER BY scheduled_date DESC, work_order_number DESC"

        cur.execute(query, params)
        jobs = cur.fetchall()

        # Calculate aggregate summary
        from decimal import Decimal
        summary = {
            "total_jobs": len(jobs),

            # Hours
            "projected_hours": float(sum(Decimal(str(j['projected_hours'] or 0)) for j in jobs)),
            "actual_hours": float(sum(Decimal(str(j['actual_hours'] or 0)) for j in jobs)),
            "hours_variance": float(sum(Decimal(str(j['hours_variance'] or 0)) for j in jobs)),

            # Labor Cost
            "projected_labor_cost": float(sum(Decimal(str(j['projected_labor_cost'] or 0)) for j in jobs)),
            "actual_labor_cost": float(sum(Decimal(str(j['actual_labor_cost'] or 0)) for j in jobs)),
            "labor_cost_variance": float(sum(Decimal(str(j['labor_cost_variance'] or 0)) for j in jobs)),

            # Labor Revenue
            "projected_labor_revenue": float(sum(Decimal(str(j['projected_labor_revenue'] or 0)) for j in jobs)),
            "actual_labor_revenue": float(sum(Decimal(str(j['actual_labor_revenue'] or 0)) for j in jobs)),
            "labor_revenue_variance": float(sum(Decimal(str(j['labor_revenue_variance'] or 0)) for j in jobs)),

            # Material Cost
            "projected_material_cost": float(sum(Decimal(str(j['projected_material_cost'] or 0)) for j in jobs)),
            "actual_material_cost": float(sum(Decimal(str(j['actual_material_cost'] or 0)) for j in jobs)),
            "material_cost_variance": float(sum(Decimal(str(j['material_cost_variance'] or 0)) for j in jobs)),

            # Material Revenue
            "projected_material_revenue": float(sum(Decimal(str(j['projected_material_revenue'] or 0)) for j in jobs)),
            "actual_material_revenue": float(sum(Decimal(str(j['actual_material_revenue'] or 0)) for j in jobs)),
            "material_revenue_variance": float(sum(Decimal(str(j['material_revenue_variance'] or 0)) for j in jobs)),

            # Totals
            "projected_total_cost": float(sum(Decimal(str(j['projected_total_cost'] or 0)) for j in jobs)),
            "actual_total_cost": float(sum(Decimal(str(j['actual_total_cost'] or 0)) for j in jobs)),
            "projected_total_revenue": float(sum(Decimal(str(j['projected_total_revenue'] or 0)) for j in jobs)),
            "actual_total_revenue": float(sum(Decimal(str(j['actual_total_revenue'] or 0)) for j in jobs)),
        }

        # Calculate variance percentages
        if summary["projected_hours"] > 0:
            summary["hours_variance_percent"] = round((summary["hours_variance"] / summary["projected_hours"]) * 100, 2)
        else:
            summary["hours_variance_percent"] = 0

        if summary["projected_total_cost"] > 0:
            summary["cost_variance_percent"] = round(((summary["actual_total_cost"] - summary["projected_total_cost"]) / summary["projected_total_cost"]) * 100, 2)
        else:
            summary["cost_variance_percent"] = 0

        cur.close()
        conn.close()

        return {
            "period": period,
            "start_date": str(start_date) if start_date else None,
            "end_date": str(end_date) if end_date else None,
            "summary": summary,
            "jobs": [dict(j) for j in jobs]
        }

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


@app.put("/work-orders/{work_order_id}/materials/{material_id}/mark-used")
async def mark_material_used(
    work_order_id: int,
    material_id: int,
    update: MaterialUsageUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Update quantity_used for a material on a job.
    This is called when completing a job or manually updating usage.
    """
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # Verify material belongs to work order
        cur.execute("""
            SELECT * FROM job_materials_used
            WHERE id = %s AND work_order_id = %s
        """, (material_id, work_order_id))

        material = cur.fetchone()
        if not material:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Material not found for this job")

        # Update quantity_used and status
        new_status = 'used' if update.quantity_used > 0 else material['status']

        cur.execute("""
            UPDATE job_materials_used
            SET
                quantity_used = %s,
                status = %s,
                installed_location = COALESCE(%s, installed_location),
                installed_by = %s,
                installed_date = CURRENT_TIMESTAMP,
                notes = COALESCE(%s, notes)
            WHERE id = %s
            RETURNING *
        """, (
            update.quantity_used,
            new_status,
            update.installed_location,
            current_user['username'],
            update.notes,
            material_id
        ))

        updated = cur.fetchone()
        conn.commit()

        cur.close()
        conn.close()

        return {
            "message": "Material usage updated",
            "material": dict(updated)
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@app.put("/work-orders/{work_order_id}/materials/mark-all-used")
async def mark_all_materials_used(
    work_order_id: int,
    update: BulkMaterialUsageUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Bulk update quantity_used for all materials on a job.
    Typically called when completing a job.
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        updated_count = 0

        for item in update.materials:
            cur.execute("""
                UPDATE job_materials_used
                SET
                    quantity_used = %s,
                    status = CASE WHEN %s > 0 THEN 'used' ELSE status END,
                    installed_by = %s,
                    installed_date = CURRENT_TIMESTAMP
                WHERE id = %s AND work_order_id = %s
            """, (
                item['quantity_used'],
                item['quantity_used'],
                current_user['username'],
                item['material_id'],
                work_order_id
            ))
            updated_count += cur.rowcount

        conn.commit()
        cur.close()
        conn.close()

        return {
            "message": f"Updated {updated_count} materials",
            "updated_count": updated_count
        }

    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@app.get("/work-orders/{work_order_id}/materials/history")
async def get_material_change_history(
    work_order_id: int,
    material_id: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get material change audit trail for a job.
    Optionally filter by specific material.
    """
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        query = """
            SELECT
                mcl.*,
                i.description as item_name,
                i.sku,
                u.full_name as changed_by_name
            FROM material_change_log mcl
            JOIN inventory i ON mcl.inventory_id = i.id
            LEFT JOIN users u ON mcl.changed_by = u.username
            WHERE mcl.work_order_id = %s
        """
        params = [work_order_id]

        if material_id:
            query += " AND mcl.job_material_id = %s"
            params.append(material_id)

        query += " ORDER BY mcl.changed_at DESC"

        cur.execute(query, params)
        history = cur.fetchall()

        cur.close()
        conn.close()

        return {
            "work_order_id": work_order_id,
            "history": [dict(h) for h in history]
        }

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


# ============================================================
# INVOICES
# ============================================================

class InvoiceCreate(BaseModel):
    work_order_id: int
    due_days: Optional[int] = 30
    tax_rate: Optional[float] = 0.0
    permit_cost: Optional[float] = 0.0
    travel_charge: Optional[float] = 0.0
    emergency_surcharge: Optional[float] = 0.0
    discount_amount: Optional[float] = 0.0
    notes: Optional[str] = None
    terms: Optional[str] = "Payment due within 30 days. Late payments subject to 1.5% monthly interest."

class InvoiceUpdate(BaseModel):
    due_date: Optional[str] = None
    tax_rate: Optional[float] = None
    permit_cost: Optional[float] = None
    travel_charge: Optional[float] = None
    emergency_surcharge: Optional[float] = None
    discount_amount: Optional[float] = None
    notes: Optional[str] = None
    terms: Optional[str] = None

class PaymentCreate(BaseModel):
    amount: float
    payment_method: str  # cash, check, credit_card, debit_card, ach, other
    check_number: Optional[str] = None
    card_last_four: Optional[str] = None
    card_type: Optional[str] = None
    transaction_id: Optional[str] = None
    notes: Optional[str] = None


def generate_invoice_number(cur):
    """Generate next invoice number in format INV-YYYY-NNNN"""
    year = datetime.now().year
    cur.execute("""
        SELECT invoice_number FROM invoices
        WHERE invoice_number LIKE %s
        ORDER BY invoice_number DESC LIMIT 1
    """, (f"INV-{year}-%",))

    result = cur.fetchone()
    if result:
        last_num = int(result['invoice_number'].split('-')[2])
        next_num = last_num + 1
    else:
        next_num = 1

    return f"INV-{year}-{next_num:04d}"


@app.get("/invoices")
async def get_invoices(
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get all invoices with optional filtering and pagination"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        base_query = """
            FROM invoices i
            JOIN work_orders wo ON i.work_order_id = wo.id
            JOIN customers c ON i.customer_id = c.id
            WHERE 1=1
        """
        params = []

        if status:
            base_query += " AND i.payment_status = %s"
            params.append(status)

        if customer_id:
            base_query += " AND i.customer_id = %s"
            params.append(customer_id)

        if search:
            base_query += """ AND (
                i.invoice_number ILIKE %s OR
                wo.work_order_number ILIKE %s OR
                c.first_name ILIKE %s OR c.last_name ILIKE %s OR
                c.company_name ILIKE %s
            )"""
            search_param = f"%{search}%"
            params.extend([search_param, search_param, search_param, search_param, search_param])

        # Get total count
        cur.execute(f"SELECT COUNT(*) as total {base_query}", params)
        total = cur.fetchone()['total']

        # Get paginated results
        select_query = f"""
            SELECT
                i.*,
                wo.work_order_number,
                wo.job_description,
                c.first_name || ' ' || c.last_name as customer_name,
                c.email as customer_email,
                c.phone_primary as customer_phone,
                c.service_street as customer_address,
                c.service_city as customer_city,
                c.service_state as customer_state,
                c.service_zip as customer_zip
            {base_query}
            ORDER BY i.created_at DESC
            LIMIT %s OFFSET %s
        """
        params.extend([limit, offset])

        cur.execute(select_query, params)
        invoices = cur.fetchall()

        # Convert to list of dicts with proper decimal handling
        result = []
        for inv in invoices:
            inv_dict = dict(inv)
            # Convert Decimal to float for JSON serialization
            for key in ['labor_cost', 'material_cost', 'permit_cost', 'travel_charge',
                       'emergency_surcharge', 'subtotal', 'discount_amount', 'tax_rate',
                       'tax_amount', 'total_amount', 'amount_paid', 'balance_due', 'late_fee_amount']:
                if key in inv_dict and inv_dict[key] is not None:
                    inv_dict[key] = float(inv_dict[key])
            result.append(inv_dict)

        cur.close()
        conn.close()

        return {
            "invoices": result,
            "total": total,
            "limit": limit,
            "offset": offset
        }

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


@app.get("/invoices/summary/stats")
async def get_invoice_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get invoice summary statistics"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT
                COUNT(*) as total_invoices,
                COUNT(*) FILTER (WHERE payment_status = 'unpaid') as unpaid_count,
                COUNT(*) FILTER (WHERE payment_status = 'partial') as partial_count,
                COUNT(*) FILTER (WHERE payment_status = 'paid') as paid_count,
                COALESCE(SUM(total_amount), 0) as total_invoiced,
                COALESCE(SUM(amount_paid), 0) as total_collected,
                COALESCE(SUM(balance_due), 0) as total_outstanding,
                COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND payment_status != 'paid') as overdue_count,
                COALESCE(SUM(balance_due) FILTER (WHERE due_date < CURRENT_DATE AND payment_status != 'paid'), 0) as overdue_amount
            FROM invoices
        """)

        stats = cur.fetchone()
        stats_dict = dict(stats)

        # Convert Decimal to float
        for key in ['total_invoiced', 'total_collected', 'total_outstanding', 'overdue_amount']:
            if key in stats_dict and stats_dict[key] is not None:
                stats_dict[key] = float(stats_dict[key])

        cur.close()
        conn.close()

        return stats_dict

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


@app.get("/invoices/{invoice_id}")
async def get_invoice(
    invoice_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get a single invoice with all details"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get invoice with customer and work order info
        cur.execute("""
            SELECT
                i.*,
                wo.work_order_number,
                wo.job_description,
                wo.job_type,
                wo.service_address,
                wo.scheduled_date,
                wo.completed_date,
                c.first_name || ' ' || c.last_name as customer_name,
                c.company_name,
                c.email as customer_email,
                c.phone_primary as customer_phone,
                c.service_street as customer_address,
                c.service_city as customer_city,
                c.service_state as customer_state,
                c.service_zip as customer_zip
            FROM invoices i
            JOIN work_orders wo ON i.work_order_id = wo.id
            JOIN customers c ON i.customer_id = c.id
            WHERE i.id = %s
        """, (invoice_id,))

        invoice = cur.fetchone()
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

        invoice_dict = dict(invoice)

        # Convert Decimal to float
        for key in ['labor_cost', 'material_cost', 'permit_cost', 'travel_charge',
                   'emergency_surcharge', 'subtotal', 'discount_amount', 'tax_rate',
                   'tax_amount', 'total_amount', 'amount_paid', 'balance_due', 'late_fee_amount']:
            if key in invoice_dict and invoice_dict[key] is not None:
                invoice_dict[key] = float(invoice_dict[key])

        # Get line items (materials used on the work order)
        cur.execute("""
            SELECT
                jm.id,
                jm.inventory_id,
                inv.item_id,
                inv.description,
                inv.brand,
                jm.quantity_used as quantity,
                jm.unit_cost,
                jm.unit_price,
                (jm.quantity_used * jm.unit_price) as line_total
            FROM job_materials_used jm
            JOIN inventory inv ON jm.inventory_id = inv.id
            WHERE jm.work_order_id = %s
            ORDER BY jm.installed_date
        """, (invoice_dict['work_order_id'],))

        materials = cur.fetchall()
        invoice_dict['line_items'] = []
        for mat in materials:
            mat_dict = dict(mat)
            for key in ['unit_cost', 'unit_price', 'line_total']:
                if key in mat_dict and mat_dict[key] is not None:
                    mat_dict[key] = float(mat_dict[key])
            invoice_dict['line_items'].append(mat_dict)

        # Get labor entries
        cur.execute("""
            SELECT
                te.id,
                te.work_date,
                te.hours_worked,
                te.billable_rate,
                te.billable_amount as line_total,
                te.notes as work_description,
                u.full_name as employee_name
            FROM time_entries te
            JOIN users u ON te.employee_username = u.username
            WHERE te.work_order_id = %s
            ORDER BY te.work_date
        """, (invoice_dict['work_order_id'],))

        labor = cur.fetchall()
        invoice_dict['labor_entries'] = []
        for lab in labor:
            lab_dict = dict(lab)
            for key in ['hours_worked', 'billable_rate', 'line_total']:
                if key in lab_dict and lab_dict[key] is not None:
                    lab_dict[key] = float(lab_dict[key])
            invoice_dict['labor_entries'].append(lab_dict)

        # Get payment history
        cur.execute("""
            SELECT
                ip.*,
                u.full_name as recorded_by_name
            FROM invoice_payments ip
            LEFT JOIN users u ON ip.recorded_by = u.username
            WHERE ip.invoice_id = %s
            ORDER BY ip.payment_date DESC
        """, (invoice_id,))

        payments = cur.fetchall()
        invoice_dict['payments'] = []
        for pay in payments:
            pay_dict = dict(pay)
            if 'amount' in pay_dict and pay_dict['amount'] is not None:
                pay_dict['amount'] = float(pay_dict['amount'])
            invoice_dict['payments'].append(pay_dict)

        cur.close()
        conn.close()

        return invoice_dict

    except HTTPException:
        raise
    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


@app.post("/invoices")
async def create_invoice(
    invoice: InvoiceCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create an invoice from a work order"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get work order details
        cur.execute("""
            SELECT wo.*, c.id as cust_id
            FROM work_orders wo
            JOIN customers c ON wo.customer_id = c.id
            WHERE wo.id = %s
        """, (invoice.work_order_id,))

        wo = cur.fetchone()
        if not wo:
            raise HTTPException(status_code=404, detail="Work order not found")

        # Check if invoice already exists for this work order
        cur.execute("SELECT id FROM invoices WHERE work_order_id = %s", (invoice.work_order_id,))
        existing = cur.fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Invoice already exists for this work order")

        # Calculate labor cost from time entries
        cur.execute("""
            SELECT COALESCE(SUM(billable_amount), 0) as total_labor
            FROM time_entries
            WHERE work_order_id = %s
        """, (invoice.work_order_id,))
        labor_result = cur.fetchone()
        labor_cost = float(labor_result['total_labor']) if labor_result else 0.0

        # Calculate material cost from job_materials_used
        cur.execute("""
            SELECT COALESCE(SUM(quantity_used * unit_price), 0) as total_materials
            FROM job_materials_used
            WHERE work_order_id = %s
        """, (invoice.work_order_id,))
        material_result = cur.fetchone()
        material_cost = float(material_result['total_materials']) if material_result else 0.0

        # Generate invoice number
        invoice_number = generate_invoice_number(cur)

        # Calculate totals
        subtotal = labor_cost + material_cost + invoice.permit_cost + invoice.travel_charge + invoice.emergency_surcharge
        tax_amount = (subtotal - invoice.discount_amount) * (invoice.tax_rate / 100)
        total_amount = subtotal - invoice.discount_amount + tax_amount

        # Calculate due date
        due_date = datetime.now() + timedelta(days=invoice.due_days)

        # Insert invoice
        cur.execute("""
            INSERT INTO invoices (
                invoice_number, work_order_id, customer_id,
                invoice_date, due_date, labor_cost, material_cost,
                permit_cost, travel_charge, emergency_surcharge,
                subtotal, discount_amount, tax_rate, tax_amount,
                total_amount, notes, terms, created_by
            ) VALUES (
                %s, %s, %s, CURRENT_DATE, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            ) RETURNING id
        """, (
            invoice_number, invoice.work_order_id, wo['cust_id'],
            due_date.date(), labor_cost, material_cost,
            invoice.permit_cost, invoice.travel_charge, invoice.emergency_surcharge,
            subtotal, invoice.discount_amount, invoice.tax_rate, tax_amount,
            total_amount, invoice.notes, invoice.terms, current_user['username']
        ))

        new_id = cur.fetchone()['id']

        # Update work order status to invoiced
        cur.execute("""
            UPDATE work_orders SET status = 'invoiced', last_updated = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (invoice.work_order_id,))

        conn.commit()
        cur.close()
        conn.close()

        return {
            "message": "Invoice created successfully",
            "invoice_id": new_id,
            "invoice_number": invoice_number,
            "total_amount": total_amount
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@app.put("/invoices/{invoice_id}")
async def update_invoice(
    invoice_id: int,
    invoice: InvoiceUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an invoice"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get current invoice
        cur.execute("SELECT * FROM invoices WHERE id = %s", (invoice_id,))
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Invoice not found")

        # Build update query dynamically
        updates = []
        params = []

        if invoice.due_date is not None:
            updates.append("due_date = %s")
            params.append(invoice.due_date)

        if invoice.tax_rate is not None:
            updates.append("tax_rate = %s")
            params.append(invoice.tax_rate)

        if invoice.permit_cost is not None:
            updates.append("permit_cost = %s")
            params.append(invoice.permit_cost)

        if invoice.travel_charge is not None:
            updates.append("travel_charge = %s")
            params.append(invoice.travel_charge)

        if invoice.emergency_surcharge is not None:
            updates.append("emergency_surcharge = %s")
            params.append(invoice.emergency_surcharge)

        if invoice.discount_amount is not None:
            updates.append("discount_amount = %s")
            params.append(invoice.discount_amount)

        if invoice.notes is not None:
            updates.append("notes = %s")
            params.append(invoice.notes)

        if invoice.terms is not None:
            updates.append("terms = %s")
            params.append(invoice.terms)

        if updates:
            # Recalculate totals
            labor_cost = float(existing['labor_cost'])
            material_cost = float(existing['material_cost'])
            permit_cost = invoice.permit_cost if invoice.permit_cost is not None else float(existing['permit_cost'] or 0)
            travel_charge = invoice.travel_charge if invoice.travel_charge is not None else float(existing['travel_charge'] or 0)
            emergency_surcharge = invoice.emergency_surcharge if invoice.emergency_surcharge is not None else float(existing['emergency_surcharge'] or 0)
            discount_amount = invoice.discount_amount if invoice.discount_amount is not None else float(existing['discount_amount'] or 0)
            tax_rate = invoice.tax_rate if invoice.tax_rate is not None else float(existing['tax_rate'])

            subtotal = labor_cost + material_cost + permit_cost + travel_charge + emergency_surcharge
            tax_amount = (subtotal - discount_amount) * (tax_rate / 100)
            total_amount = subtotal - discount_amount + tax_amount

            updates.extend(["subtotal = %s", "tax_amount = %s", "total_amount = %s"])
            params.extend([subtotal, tax_amount, total_amount])

            params.append(invoice_id)
            query = f"UPDATE invoices SET {', '.join(updates)} WHERE id = %s"
            cur.execute(query, params)

            conn.commit()

        cur.close()
        conn.close()

        return {"message": "Invoice updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@app.delete("/invoices/{invoice_id}")
async def delete_invoice(
    invoice_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Delete an invoice (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get work order id before deleting
        cur.execute("SELECT work_order_id FROM invoices WHERE id = %s", (invoice_id,))
        invoice = cur.fetchone()
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

        work_order_id = invoice['work_order_id']

        # Delete invoice (payments cascade)
        cur.execute("DELETE FROM invoices WHERE id = %s", (invoice_id,))

        # Revert work order status
        cur.execute("""
            UPDATE work_orders SET status = 'completed', last_updated = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (work_order_id,))

        conn.commit()
        cur.close()
        conn.close()

        return {"message": "Invoice deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@app.post("/invoices/{invoice_id}/payments")
async def record_payment(
    invoice_id: int,
    payment: PaymentCreate,
    current_user: dict = Depends(get_current_user)
):
    """Record a payment against an invoice"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get current invoice
        cur.execute("SELECT * FROM invoices WHERE id = %s", (invoice_id,))
        invoice = cur.fetchone()
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

        # Insert payment
        cur.execute("""
            INSERT INTO invoice_payments (
                invoice_id, payment_date, amount, payment_method,
                check_number, card_last_four, card_type, transaction_id,
                notes, recorded_by
            ) VALUES (
                %s, CURRENT_DATE, %s, %s, %s, %s, %s, %s, %s, %s
            ) RETURNING id
        """, (
            invoice_id, payment.amount, payment.payment_method,
            payment.check_number, payment.card_last_four, payment.card_type,
            payment.transaction_id, payment.notes, current_user['username']
        ))

        payment_id = cur.fetchone()['id']

        # Update invoice amount_paid
        new_amount_paid = float(invoice['amount_paid'] or 0) + payment.amount

        # Determine payment status
        total_amount = float(invoice['total_amount'])
        if new_amount_paid >= total_amount:
            payment_status = 'paid'
        elif new_amount_paid > 0:
            payment_status = 'partial'
        else:
            payment_status = 'unpaid'

        cur.execute("""
            UPDATE invoices SET amount_paid = %s, payment_status = %s
            WHERE id = %s
        """, (new_amount_paid, payment_status, invoice_id))

        # If fully paid, update work order status
        if payment_status == 'paid':
            cur.execute("""
                UPDATE work_orders SET status = 'paid', last_updated = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (invoice['work_order_id'],))

        conn.commit()
        cur.close()
        conn.close()

        return {
            "message": "Payment recorded successfully",
            "payment_id": payment_id,
            "new_balance": total_amount - new_amount_paid,
            "payment_status": payment_status
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@app.post("/invoices/{invoice_id}/send")
async def mark_invoice_sent(
    invoice_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Mark an invoice as sent to customer"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            UPDATE invoices SET sent_to_customer = TRUE, sent_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (invoice_id,))

        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Invoice not found")

        conn.commit()
        cur.close()
        conn.close()

        return {"message": "Invoice marked as sent"}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


# ============================================================
# WORK ORDER ASSIGNMENTS (Multi-Worker Support)
# ============================================================

class WorkOrderAssignmentCreate(BaseModel):
    work_order_id: int
    employee_username: str
    assignment_role: str = 'technician'  # lead, technician, helper, apprentice
    is_lead: bool = False
    notes: Optional[str] = None

class WorkOrderAssignmentUpdate(BaseModel):
    assignment_role: Optional[str] = None
    is_lead: Optional[bool] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class BulkAssignmentCreate(BaseModel):
    work_order_id: int
    employee_usernames: List[str]
    lead_username: Optional[str] = None


@app.get("/work-orders/{work_order_id}/assignments")
async def get_work_order_assignments(
    work_order_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get all worker assignments for a work order"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT
                woa.id,
                woa.work_order_id,
                woa.employee_username,
                u.full_name as employee_name,
                u.phone as employee_phone,
                u.hourly_rate as current_hourly_rate,
                woa.assignment_role,
                woa.is_lead,
                woa.hourly_rate as assigned_hourly_rate,
                woa.billable_rate,
                woa.status,
                woa.confirmed_at,
                woa.notes,
                woa.assigned_date,
                woa.assigned_by
            FROM work_order_assignments woa
            JOIN users u ON woa.employee_username = u.username
            WHERE woa.work_order_id = %s
            ORDER BY woa.is_lead DESC, woa.assignment_role, u.full_name
        """, (work_order_id,))

        assignments = cur.fetchall()
        cur.close()
        conn.close()

        return {"assignments": assignments}

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


@app.post("/work-orders/{work_order_id}/assignments")
async def add_work_order_assignment(
    work_order_id: int,
    assignment: WorkOrderAssignmentCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a worker to a work order"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get employee's current hourly rate
        cur.execute("SELECT hourly_rate FROM users WHERE username = %s", (assignment.employee_username,))
        employee = cur.fetchone()
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")

        # If this is the lead, unset any existing lead
        if assignment.is_lead:
            cur.execute("""
                UPDATE work_order_assignments
                SET is_lead = FALSE
                WHERE work_order_id = %s AND is_lead = TRUE
            """, (work_order_id,))

        cur.execute("""
            INSERT INTO work_order_assignments (
                work_order_id, employee_username, assignment_role, is_lead,
                hourly_rate, assigned_by, notes
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (work_order_id, employee_username)
            DO UPDATE SET
                assignment_role = EXCLUDED.assignment_role,
                is_lead = EXCLUDED.is_lead,
                notes = EXCLUDED.notes,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id
        """, (
            work_order_id,
            assignment.employee_username,
            assignment.assignment_role,
            assignment.is_lead,
            employee['hourly_rate'],
            current_user['username'],
            assignment.notes
        ))

        assignment_id = cur.fetchone()['id']

        # Update crew_size on work_orders table
        cur.execute("""
            UPDATE work_orders
            SET crew_size = (
                SELECT COUNT(*) FROM work_order_assignments WHERE work_order_id = %s
            )
            WHERE id = %s
        """, (work_order_id, work_order_id))

        conn.commit()
        cur.close()
        conn.close()

        return {"success": True, "assignment_id": assignment_id}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@app.post("/work-orders/{work_order_id}/assignments/bulk")
async def bulk_assign_workers(
    work_order_id: int,
    bulk: BulkAssignmentCreate,
    current_user: dict = Depends(get_current_user)
):
    """Assign multiple workers to a work order at once"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        assigned_count = 0

        for username in bulk.employee_usernames:
            # Get employee's hourly rate
            cur.execute("SELECT hourly_rate FROM users WHERE username = %s", (username,))
            employee = cur.fetchone()
            if not employee:
                continue

            is_lead = (username == bulk.lead_username)
            role = 'lead' if is_lead else 'technician'

            cur.execute("""
                INSERT INTO work_order_assignments (
                    work_order_id, employee_username, assignment_role, is_lead,
                    hourly_rate, assigned_by
                ) VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (work_order_id, employee_username)
                DO UPDATE SET
                    assignment_role = EXCLUDED.assignment_role,
                    is_lead = EXCLUDED.is_lead,
                    updated_at = CURRENT_TIMESTAMP
            """, (
                work_order_id,
                username,
                role,
                is_lead,
                employee['hourly_rate'],
                current_user['username']
            ))
            assigned_count += 1

        # Update crew_size
        cur.execute("""
            UPDATE work_orders
            SET crew_size = (SELECT COUNT(*) FROM work_order_assignments WHERE work_order_id = %s)
            WHERE id = %s
        """, (work_order_id, work_order_id))

        conn.commit()
        cur.close()
        conn.close()

        return {"success": True, "assigned_count": assigned_count}

    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@app.delete("/work-orders/{work_order_id}/assignments/{employee_username}")
async def remove_work_order_assignment(
    work_order_id: int,
    employee_username: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a worker from a work order"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            DELETE FROM work_order_assignments
            WHERE work_order_id = %s AND employee_username = %s
        """, (work_order_id, employee_username))

        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Assignment not found")

        # Update crew_size
        cur.execute("""
            UPDATE work_orders
            SET crew_size = (SELECT COUNT(*) FROM work_order_assignments WHERE work_order_id = %s)
            WHERE id = %s
        """, (work_order_id, work_order_id))

        conn.commit()
        cur.close()
        conn.close()

        return {"success": True, "message": "Assignment removed"}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


# ============================================================
# JOB SCHEDULE DATES (Multi-Date Support)
# ============================================================

class JobScheduleDateCreate(BaseModel):
    work_order_id: int
    scheduled_date: date
    start_time: Optional[str] = '08:00'
    end_time: Optional[str] = '16:30'
    estimated_hours: Optional[float] = 8.0
    phase_name: Optional[str] = None
    day_description: Optional[str] = None

class JobScheduleDateUpdate(BaseModel):
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    estimated_hours: Optional[float] = None
    phase_name: Optional[str] = None
    day_description: Optional[str] = None
    status: Optional[str] = None

class BulkScheduleDatesCreate(BaseModel):
    work_order_id: int
    dates: List[date]
    start_time: Optional[str] = '08:00'
    end_time: Optional[str] = '16:30'
    estimated_hours_per_day: Optional[float] = 8.0
    copy_crew_from_assignments: Optional[bool] = True


@app.get("/work-orders/{work_order_id}/schedule-dates")
async def get_job_schedule_dates(
    work_order_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get all scheduled dates for a work order"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT
                jsd.id,
                jsd.work_order_id,
                jsd.scheduled_date,
                jsd.start_time,
                jsd.end_time,
                jsd.estimated_hours,
                jsd.phase_name,
                jsd.phase_order,
                jsd.day_description,
                jsd.status,
                jsd.actual_start_time,
                jsd.actual_end_time,
                jsd.notes
            FROM job_schedule_dates jsd
            WHERE jsd.work_order_id = %s
            ORDER BY jsd.scheduled_date, jsd.phase_order
        """, (work_order_id,))

        schedule_dates = cur.fetchall()

        # Get crew for each date
        for sd in schedule_dates:
            cur.execute("""
                SELECT
                    jsc.id,
                    jsc.employee_username,
                    u.full_name as employee_name,
                    jsc.role,
                    jsc.is_lead_for_day,
                    jsc.scheduled_hours,
                    jsc.status,
                    jsc.actual_hours
                FROM job_schedule_crew jsc
                JOIN users u ON jsc.employee_username = u.username
                WHERE jsc.job_schedule_date_id = %s
                ORDER BY jsc.is_lead_for_day DESC, u.full_name
            """, (sd['id'],))
            sd['crew'] = cur.fetchall()

        cur.close()
        conn.close()

        return {"schedule_dates": schedule_dates}

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


@app.post("/work-orders/{work_order_id}/schedule-dates")
async def add_job_schedule_date(
    work_order_id: int,
    schedule_date: JobScheduleDateCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a scheduled date to a work order"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get next phase order
        cur.execute("""
            SELECT COALESCE(MAX(phase_order), 0) + 1 as next_order
            FROM job_schedule_dates WHERE work_order_id = %s
        """, (work_order_id,))
        next_order = cur.fetchone()['next_order']

        cur.execute("""
            INSERT INTO job_schedule_dates (
                work_order_id, scheduled_date, start_time, end_time,
                estimated_hours, phase_name, phase_order, day_description
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (work_order_id, scheduled_date)
            DO UPDATE SET
                start_time = EXCLUDED.start_time,
                end_time = EXCLUDED.end_time,
                estimated_hours = EXCLUDED.estimated_hours,
                phase_name = EXCLUDED.phase_name,
                day_description = EXCLUDED.day_description,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id
        """, (
            work_order_id,
            schedule_date.scheduled_date,
            schedule_date.start_time,
            schedule_date.end_time,
            schedule_date.estimated_hours,
            schedule_date.phase_name,
            next_order,
            schedule_date.day_description
        ))

        schedule_date_id = cur.fetchone()['id']

        # Update work_orders date range
        cur.execute("""
            UPDATE work_orders SET
                start_date = (SELECT MIN(scheduled_date) FROM job_schedule_dates WHERE work_order_id = %s),
                end_date = (SELECT MAX(scheduled_date) FROM job_schedule_dates WHERE work_order_id = %s),
                total_scheduled_days = (SELECT COUNT(*) FROM job_schedule_dates WHERE work_order_id = %s),
                is_multi_day = (SELECT COUNT(*) > 1 FROM job_schedule_dates WHERE work_order_id = %s)
            WHERE id = %s
        """, (work_order_id, work_order_id, work_order_id, work_order_id, work_order_id))

        conn.commit()
        cur.close()
        conn.close()

        return {"success": True, "schedule_date_id": schedule_date_id}

    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@app.post("/work-orders/{work_order_id}/schedule-dates/bulk")
async def bulk_add_schedule_dates(
    work_order_id: int,
    bulk: BulkScheduleDatesCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add multiple scheduled dates to a work order at once"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        added_count = 0
        schedule_date_ids = []

        for idx, sched_date in enumerate(bulk.dates):
            cur.execute("""
                INSERT INTO job_schedule_dates (
                    work_order_id, scheduled_date, start_time, end_time,
                    estimated_hours, phase_order
                ) VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (work_order_id, scheduled_date) DO NOTHING
                RETURNING id
            """, (
                work_order_id,
                sched_date,
                bulk.start_time,
                bulk.end_time,
                bulk.estimated_hours_per_day,
                idx + 1
            ))

            result = cur.fetchone()
            if result:
                schedule_date_ids.append(result['id'])
                added_count += 1

        # Copy crew from work_order_assignments if requested
        if bulk.copy_crew_from_assignments and schedule_date_ids:
            cur.execute("""
                SELECT employee_username, assignment_role, is_lead
                FROM work_order_assignments
                WHERE work_order_id = %s
            """, (work_order_id,))
            assignments = cur.fetchall()

            for sd_id in schedule_date_ids:
                for assignment in assignments:
                    cur.execute("""
                        INSERT INTO job_schedule_crew (
                            job_schedule_date_id, employee_username, role,
                            is_lead_for_day, scheduled_hours
                        ) VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (job_schedule_date_id, employee_username) DO NOTHING
                    """, (
                        sd_id,
                        assignment['employee_username'],
                        assignment['assignment_role'],
                        assignment['is_lead'],
                        bulk.estimated_hours_per_day
                    ))

        # Update work_orders date range
        cur.execute("""
            UPDATE work_orders SET
                start_date = (SELECT MIN(scheduled_date) FROM job_schedule_dates WHERE work_order_id = %s),
                end_date = (SELECT MAX(scheduled_date) FROM job_schedule_dates WHERE work_order_id = %s),
                total_scheduled_days = (SELECT COUNT(*) FROM job_schedule_dates WHERE work_order_id = %s),
                is_multi_day = (SELECT COUNT(*) > 1 FROM job_schedule_dates WHERE work_order_id = %s)
            WHERE id = %s
        """, (work_order_id, work_order_id, work_order_id, work_order_id, work_order_id))

        conn.commit()
        cur.close()
        conn.close()

        return {"success": True, "added_count": added_count, "schedule_date_ids": schedule_date_ids}

    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@app.delete("/work-orders/{work_order_id}/schedule-dates/{scheduled_date}")
async def remove_job_schedule_date(
    work_order_id: int,
    scheduled_date: date,
    current_user: dict = Depends(get_current_user)
):
    """Remove a scheduled date from a work order"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            DELETE FROM job_schedule_dates
            WHERE work_order_id = %s AND scheduled_date = %s
        """, (work_order_id, scheduled_date))

        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Schedule date not found")

        # Update work_orders date range
        cur.execute("""
            UPDATE work_orders SET
                start_date = (SELECT MIN(scheduled_date) FROM job_schedule_dates WHERE work_order_id = %s),
                end_date = (SELECT MAX(scheduled_date) FROM job_schedule_dates WHERE work_order_id = %s),
                total_scheduled_days = (SELECT COUNT(*) FROM job_schedule_dates WHERE work_order_id = %s),
                is_multi_day = (SELECT COUNT(*) > 1 FROM job_schedule_dates WHERE work_order_id = %s)
            WHERE id = %s
        """, (work_order_id, work_order_id, work_order_id, work_order_id, work_order_id))

        conn.commit()
        cur.close()
        conn.close()

        return {"success": True, "message": "Schedule date removed"}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


# ============================================================
# JOB SCHEDULE CREW (Per-Date Crew Assignment)
# ============================================================

class ScheduleCrewAssign(BaseModel):
    employee_username: str
    role: Optional[str] = 'technician'
    is_lead_for_day: Optional[bool] = False
    scheduled_hours: Optional[float] = 8.0


@app.post("/schedule-dates/{schedule_date_id}/crew")
async def assign_crew_to_date(
    schedule_date_id: int,
    crew: ScheduleCrewAssign,
    current_user: dict = Depends(get_current_user)
):
    """Assign a worker to a specific scheduled date"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Auto-set is_lead_for_day=true when role is 'lead' for consistency
        is_lead = crew.is_lead_for_day or crew.role == 'lead'

        # If this is the lead, unset any existing lead for this date
        if is_lead:
            cur.execute("""
                UPDATE job_schedule_crew
                SET is_lead_for_day = FALSE
                WHERE job_schedule_date_id = %s AND is_lead_for_day = TRUE
            """, (schedule_date_id,))

        cur.execute("""
            INSERT INTO job_schedule_crew (
                job_schedule_date_id, employee_username, role,
                is_lead_for_day, scheduled_hours
            ) VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (job_schedule_date_id, employee_username)
            DO UPDATE SET
                role = EXCLUDED.role,
                is_lead_for_day = EXCLUDED.is_lead_for_day,
                scheduled_hours = EXCLUDED.scheduled_hours
            RETURNING id
        """, (
            schedule_date_id,
            crew.employee_username,
            crew.role,
            is_lead,
            crew.scheduled_hours
        ))

        crew_id = cur.fetchone()['id']
        conn.commit()
        cur.close()
        conn.close()

        return {"success": True, "crew_id": crew_id}

    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@app.delete("/schedule-dates/{schedule_date_id}/crew/{employee_username}")
async def remove_crew_from_date(
    schedule_date_id: int,
    employee_username: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a worker from a specific scheduled date"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            DELETE FROM job_schedule_crew
            WHERE job_schedule_date_id = %s AND employee_username = %s
        """, (schedule_date_id, employee_username))

        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Crew assignment not found")

        conn.commit()
        cur.close()
        conn.close()

        return {"success": True, "message": "Crew removed from date"}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


# ============================================================
# CREW SYNC - Unified Crew Management Endpoint
# ============================================================

class CrewSyncRequest(BaseModel):
    """
    Unified crew management endpoint.

    action: 'set' replaces entire crew, 'add' adds workers, 'remove' removes workers
    employees: list of usernames to add/remove/set
    dates: optional list of dates - if null, applies to all scheduled dates (or creates single-day entry)
    lead_username: optional - designate a lead worker
    sync_to_dates: if True, also syncs the crew to job_schedule_dates/job_schedule_crew tables
    employee_hours: optional dict mapping username to scheduled hours (e.g., {"john": 4.0, "jane": 8.0})
    start_time: optional start time for the schedule entry (e.g., "07:00")
    end_time: optional end time for the schedule entry (e.g., "15:30")
    """
    action: str  # 'set', 'add', 'remove'
    employees: List[str]
    dates: Optional[List[date]] = None
    lead_username: Optional[str] = None
    sync_to_dates: bool = True
    employee_hours: Optional[Dict[str, float]] = None  # {username: scheduled_hours}
    start_time: Optional[str] = None  # e.g., "07:00"
    end_time: Optional[str] = None  # e.g., "15:30"


@app.patch("/work-orders/{work_order_id}/crew")
async def sync_work_order_crew(
    work_order_id: int,
    request: CrewSyncRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Unified crew management endpoint for work orders.

    This endpoint:
    1. Updates work_order_assignments (the roster of who CAN work on this job)
    2. Optionally syncs to job_schedule_dates and job_schedule_crew tables
    3. Updates crew_size on the work order

    The assigned_to field is NOT automatically updated - that remains under manual control.
    """
    if request.action not in ['set', 'add', 'remove']:
        raise HTTPException(status_code=400, detail="Action must be 'set', 'add', or 'remove'")

    if not request.employees and request.action != 'set':
        raise HTTPException(status_code=400, detail="Employees list required for add/remove actions")

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Verify work order exists and get current status
        cur.execute("SELECT id, scheduled_date, status FROM work_orders WHERE id = %s", (work_order_id,))
        work_order = cur.fetchone()
        if not work_order:
            raise HTTPException(status_code=404, detail="Work order not found")

        # Validate all employees exist
        if request.employees:
            placeholders = ','.join(['%s'] * len(request.employees))
            cur.execute(f"SELECT username, hourly_rate FROM users WHERE username IN ({placeholders})",
                       tuple(request.employees))
            found_users = {row['username']: row['hourly_rate'] for row in cur.fetchall()}
            missing = set(request.employees) - set(found_users.keys())
            if missing:
                raise HTTPException(status_code=404, detail=f"Users not found: {', '.join(missing)}")
        else:
            found_users = {}

        results = {
            "work_order_id": work_order_id,
            "action": request.action,
            "assignments_updated": 0,
            "schedule_dates_created": 0,
            "crew_entries_created": 0
        }

        # ============================================================
        # STEP 1: Update work_order_assignments
        # ============================================================

        if request.action == 'set':
            # Remove all existing assignments
            cur.execute("DELETE FROM work_order_assignments WHERE work_order_id = %s", (work_order_id,))

            # Add new assignments
            for username in request.employees:
                is_lead = (username == request.lead_username)
                cur.execute("""
                    INSERT INTO work_order_assignments (
                        work_order_id, employee_username, assignment_role, is_lead,
                        hourly_rate, assigned_by
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                """, (
                    work_order_id, username,
                    'lead' if is_lead else 'technician',
                    is_lead, found_users.get(username, 0),
                    current_user['username']
                ))
                results["assignments_updated"] += 1

        elif request.action == 'add':
            for username in request.employees:
                is_lead = (username == request.lead_username)
                # If setting a new lead, unset existing lead first
                if is_lead:
                    cur.execute("""
                        UPDATE work_order_assignments SET is_lead = FALSE
                        WHERE work_order_id = %s AND is_lead = TRUE
                    """, (work_order_id,))

                cur.execute("""
                    INSERT INTO work_order_assignments (
                        work_order_id, employee_username, assignment_role, is_lead,
                        hourly_rate, assigned_by
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (work_order_id, employee_username)
                    DO UPDATE SET
                        is_lead = EXCLUDED.is_lead,
                        updated_at = CURRENT_TIMESTAMP
                """, (
                    work_order_id, username,
                    'lead' if is_lead else 'technician',
                    is_lead, found_users.get(username, 0),
                    current_user['username']
                ))
                results["assignments_updated"] += 1

        elif request.action == 'remove':
            for username in request.employees:
                cur.execute("""
                    DELETE FROM work_order_assignments
                    WHERE work_order_id = %s AND employee_username = %s
                """, (work_order_id, username))
                if cur.rowcount > 0:
                    results["assignments_updated"] += 1

        # Update crew_size
        cur.execute("""
            UPDATE work_orders SET crew_size = (
                SELECT COUNT(*) FROM work_order_assignments WHERE work_order_id = %s
            ) WHERE id = %s
        """, (work_order_id, work_order_id))

        # ============================================================
        # STEP 2: Sync to job_schedule_dates and job_schedule_crew
        # ============================================================

        if request.sync_to_dates:
            # Determine which dates to sync
            target_dates = request.dates

            if not target_dates:
                # Get existing scheduled dates, or use work order's scheduled_date
                cur.execute("""
                    SELECT id, scheduled_date FROM job_schedule_dates
                    WHERE work_order_id = %s ORDER BY scheduled_date
                """, (work_order_id,))
                existing_dates = cur.fetchall()

                if existing_dates:
                    target_dates = [row['scheduled_date'] for row in existing_dates]
                elif work_order['scheduled_date']:
                    # Create a single schedule date entry for the work order's scheduled_date
                    target_dates = [work_order['scheduled_date']]

            if target_dates:
                for sched_date in target_dates:
                    # Ensure job_schedule_dates entry exists
                    # Include start_time and end_time if provided
                    if request.start_time and request.end_time:
                        cur.execute("""
                            INSERT INTO job_schedule_dates (work_order_id, scheduled_date, start_time, end_time)
                            VALUES (%s, %s, %s, %s)
                            ON CONFLICT (work_order_id, scheduled_date) DO UPDATE SET
                                start_time = EXCLUDED.start_time,
                                end_time = EXCLUDED.end_time
                            RETURNING id
                        """, (work_order_id, sched_date, request.start_time, request.end_time))
                    else:
                        cur.execute("""
                            INSERT INTO job_schedule_dates (work_order_id, scheduled_date)
                            VALUES (%s, %s)
                            ON CONFLICT (work_order_id, scheduled_date) DO NOTHING
                            RETURNING id
                        """, (work_order_id, sched_date))

                    result = cur.fetchone()
                    if result:
                        schedule_date_id = result['id']
                        results["schedule_dates_created"] += 1
                    else:
                        # Get existing id
                        cur.execute("""
                            SELECT id FROM job_schedule_dates
                            WHERE work_order_id = %s AND scheduled_date = %s
                        """, (work_order_id, sched_date))
                        schedule_date_id = cur.fetchone()['id']

                    # Now sync crew for this date based on action
                    if request.action == 'set':
                        # Remove all crew for this date
                        cur.execute("""
                            DELETE FROM job_schedule_crew WHERE job_schedule_date_id = %s
                        """, (schedule_date_id,))

                        # Add new crew
                        for username in request.employees:
                            is_lead = (username == request.lead_username)
                            # Get scheduled hours for this employee (default to 8.0)
                            emp_hours = 8.0
                            if request.employee_hours and username in request.employee_hours:
                                emp_hours = request.employee_hours[username]
                            cur.execute("""
                                INSERT INTO job_schedule_crew (
                                    job_schedule_date_id, employee_username, role, is_lead_for_day, scheduled_hours
                                ) VALUES (%s, %s, %s, %s, %s)
                            """, (schedule_date_id, username,
                                  'lead' if is_lead else 'technician', is_lead, emp_hours))
                            results["crew_entries_created"] += 1

                    elif request.action == 'add':
                        for username in request.employees:
                            is_lead = (username == request.lead_username)
                            if is_lead:
                                cur.execute("""
                                    UPDATE job_schedule_crew SET is_lead_for_day = FALSE
                                    WHERE job_schedule_date_id = %s AND is_lead_for_day = TRUE
                                """, (schedule_date_id,))

                            # Get scheduled hours for this employee (default to 8.0)
                            emp_hours = 8.0
                            if request.employee_hours and username in request.employee_hours:
                                emp_hours = request.employee_hours[username]
                            cur.execute("""
                                INSERT INTO job_schedule_crew (
                                    job_schedule_date_id, employee_username, role, is_lead_for_day, scheduled_hours
                                ) VALUES (%s, %s, %s, %s, %s)
                                ON CONFLICT (job_schedule_date_id, employee_username) DO UPDATE SET
                                    is_lead_for_day = EXCLUDED.is_lead_for_day,
                                    scheduled_hours = EXCLUDED.scheduled_hours
                            """, (schedule_date_id, username,
                                  'lead' if is_lead else 'technician', is_lead, emp_hours))
                            results["crew_entries_created"] += 1

                    elif request.action == 'remove':
                        for username in request.employees:
                            cur.execute("""
                                DELETE FROM job_schedule_crew
                                WHERE job_schedule_date_id = %s AND employee_username = %s
                            """, (schedule_date_id, username))

                # Update work_orders date range if we created new schedule dates
                if results["schedule_dates_created"] > 0:
                    cur.execute("""
                        UPDATE work_orders SET
                            start_date = (SELECT MIN(scheduled_date) FROM job_schedule_dates WHERE work_order_id = %s),
                            end_date = (SELECT MAX(scheduled_date) FROM job_schedule_dates WHERE work_order_id = %s),
                            total_scheduled_days = (SELECT COUNT(*) FROM job_schedule_dates WHERE work_order_id = %s),
                            is_multi_day = (SELECT COUNT(*) > 1 FROM job_schedule_dates WHERE work_order_id = %s)
                        WHERE id = %s
                    """, (work_order_id, work_order_id, work_order_id, work_order_id, work_order_id))

        # Get final crew list
        cur.execute("""
            SELECT woa.employee_username, u.full_name, woa.is_lead, woa.assignment_role
            FROM work_order_assignments woa
            JOIN users u ON woa.employee_username = u.username
            WHERE woa.work_order_id = %s
            ORDER BY woa.is_lead DESC, u.full_name
        """, (work_order_id,))
        results["current_crew"] = cur.fetchall()

        # ============================================================
        # STEP 3: Auto-status change to 'scheduled' if pending and crew assigned
        # ============================================================
        old_status = work_order['status']

        # Check if we now have crew assigned AND schedule dates
        cur.execute("""
            SELECT
                (SELECT COUNT(*) FROM work_order_assignments WHERE work_order_id = %s) as crew_count,
                (SELECT COUNT(*) FROM job_schedule_dates WHERE work_order_id = %s) as schedule_count
        """, (work_order_id, work_order_id))
        counts = cur.fetchone()

        has_crew = counts['crew_count'] > 0
        has_schedule = counts['schedule_count'] > 0

        # Auto-transition: pending -> scheduled when both crew and dates exist
        if old_status == 'pending' and has_crew and has_schedule:
            cur.execute("""
                UPDATE work_orders
                SET status = 'scheduled', last_updated = CURRENT_TIMESTAMP, last_updated_by = %s
                WHERE id = %s
            """, (current_user['username'], work_order_id))

            # Log the auto status change
            cur.execute("""
                INSERT INTO work_order_activity
                (work_order_id, activity_type, description, performed_by, created_at)
                VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
            """, (
                work_order_id,
                'status_change',
                "Status automatically changed from 'pending' to 'scheduled' (crew and dates assigned)",
                current_user['username']
            ))
            results["status_changed"] = True
            results["new_status"] = "scheduled"

        # Auto-transition: scheduled -> pending when no crew OR no dates
        elif old_status == 'scheduled' and (not has_crew or not has_schedule):
            cur.execute("""
                UPDATE work_orders
                SET status = 'pending', last_updated = CURRENT_TIMESTAMP, last_updated_by = %s
                WHERE id = %s
            """, (current_user['username'], work_order_id))

            # Log the auto status change
            cur.execute("""
                INSERT INTO work_order_activity
                (work_order_id, activity_type, description, performed_by, created_at)
                VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
            """, (
                work_order_id,
                'status_change',
                "Status automatically changed from 'scheduled' to 'pending' (crew or schedule removed)",
                current_user['username']
            ))
            results["status_changed"] = True
            results["new_status"] = "pending"

        conn.commit()
        cur.close()
        conn.close()

        return {"success": True, **results}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@app.get("/work-orders/{work_order_id}/crew")
async def get_work_order_crew(
    work_order_id: int,
    include_schedule: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """
    Get the complete crew information for a work order.

    Returns:
    - assignments: the roster from work_order_assignments
    - schedule_dates: if include_schedule=True, includes per-date crew info
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get assignments
        cur.execute("""
            SELECT
                woa.id, woa.employee_username, u.full_name as employee_name,
                woa.assignment_role, woa.is_lead, woa.status, woa.notes
            FROM work_order_assignments woa
            JOIN users u ON woa.employee_username = u.username
            WHERE woa.work_order_id = %s
            ORDER BY woa.is_lead DESC, u.full_name
        """, (work_order_id,))
        assignments = cur.fetchall()

        result = {
            "work_order_id": work_order_id,
            "assignments": assignments,
            "crew_count": len(assignments)
        }

        if include_schedule:
            cur.execute("""
                SELECT id, scheduled_date, start_time, end_time, status
                FROM job_schedule_dates
                WHERE work_order_id = %s
                ORDER BY scheduled_date
            """, (work_order_id,))
            schedule_dates = cur.fetchall()

            for sd in schedule_dates:
                cur.execute("""
                    SELECT
                        jsc.employee_username, u.full_name as employee_name,
                        jsc.role, jsc.is_lead_for_day, jsc.status
                    FROM job_schedule_crew jsc
                    JOIN users u ON jsc.employee_username = u.username
                    WHERE jsc.job_schedule_date_id = %s
                    ORDER BY jsc.is_lead_for_day DESC, u.full_name
                """, (sd['id'],))
                sd['crew'] = cur.fetchall()

            result["schedule_dates"] = schedule_dates

        cur.close()
        conn.close()

        return result

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


# ============================================================
# JOB TEMPLATES
# ============================================================

@app.get("/job-templates")
async def get_job_templates(
    current_user: dict = Depends(get_current_user),
    limit: int = 100,
    offset: int = 0,
    search: Optional[str] = None,
    category: Optional[str] = None
):
    """Get all job templates with pagination"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        where_clauses = ["active = TRUE"]
        params = []

        if search:
            where_clauses.append("(template_name ILIKE %s OR description ILIKE %s)")
            search_param = f"%{search}%"
            params.extend([search_param, search_param])

        if category:
            where_clauses.append("category = %s")
            params.append(category)

        where_sql = f"WHERE {' AND '.join(where_clauses)}"

        # Get total count
        cur.execute(f"SELECT COUNT(*) as total FROM job_templates {where_sql}", params)
        total = cur.fetchone()['total']

        # Get paginated results
        params.extend([limit, offset])
        cur.execute(f"""
            SELECT * FROM job_templates {where_sql}
            ORDER BY template_name
            LIMIT %s OFFSET %s
        """, params)

        templates = cur.fetchall()
        cur.close()
        conn.close()

        return {
            "templates": templates,
            "total": total,
            "limit": limit,
            "offset": offset
        }

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


@app.get("/job-templates/{template_id}")
async def get_job_template(
    template_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific job template"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("SELECT * FROM job_templates WHERE id = %s", (template_id,))
        template = cur.fetchone()

        if not template:
            raise HTTPException(status_code=404, detail="Template not found")

        cur.close()
        conn.close()

        return {"template": template}

    except HTTPException:
        raise
    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


# ============================================================
# EMPLOYEE AVAILABILITY
# ============================================================

class EmployeeAvailabilityCreate(BaseModel):
    employee_username: str
    start_date: date
    end_date: date
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    availability_type: str  # available, unavailable, vacation, sick, training, on_call
    reason: Optional[str] = None

@app.get("/employees/{username}/availability")
async def get_employee_availability(
    username: str,
    start_date: date = None,
    end_date: date = None,
    current_user: dict = Depends(get_current_user)
):
    """Get employee availability for a date range"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        query = """
            SELECT * FROM employee_availability
            WHERE employee_username = %s
        """
        params = [username]

        if start_date and end_date:
            query += " AND start_date <= %s AND end_date >= %s"
            params.extend([end_date, start_date])

        query += " ORDER BY start_date"

        cur.execute(query, params)
        availability = cur.fetchall()

        cur.close()
        conn.close()

        return {"availability": availability}

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


@app.post("/employees/{username}/availability")
async def set_employee_availability(
    username: str,
    availability: EmployeeAvailabilityCreate,
    current_user: dict = Depends(get_current_user)
):
    """Set employee availability"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            INSERT INTO employee_availability (
                employee_username, start_date, end_date, start_time, end_time,
                availability_type, reason, approved_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            username,
            availability.start_date,
            availability.end_date,
            availability.start_time,
            availability.end_time,
            availability.availability_type,
            availability.reason,
            current_user['username']
        ))

        availability_id = cur.fetchone()['id']
        conn.commit()
        cur.close()
        conn.close()

        return {"success": True, "availability_id": availability_id}

    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


# ============================================================
# CALENDAR VIEW ENDPOINTS
# ============================================================

@app.get("/calendar/schedule")
async def get_calendar_schedule(
    start_date: date,
    end_date: date,
    employee_username: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get calendar schedule view with jobs and crew for a date range"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        query = """
            SELECT
                jsd.id as schedule_id,
                jsd.scheduled_date,
                jsd.start_time,
                jsd.end_time,
                jsd.status as day_status,
                jsd.phase_name,
                wo.id as work_order_id,
                wo.work_order_number,
                wo.job_description,
                wo.job_type,
                wo.status as job_status,
                wo.priority,
                wo.service_address,
                c.first_name || ' ' || c.last_name as customer_name,
                c.phone_primary as customer_phone,
                (
                    SELECT json_agg(json_build_object(
                        'username', jsc.employee_username,
                        'full_name', u.full_name,
                        'role', jsc.role,
                        'is_lead', jsc.is_lead_for_day,
                        'scheduled_hours', jsc.scheduled_hours
                    ))
                    FROM job_schedule_crew jsc
                    JOIN users u ON jsc.employee_username = u.username
                    WHERE jsc.job_schedule_date_id = jsd.id
                ) as crew
            FROM job_schedule_dates jsd
            JOIN work_orders wo ON jsd.work_order_id = wo.id
            JOIN customers c ON wo.customer_id = c.id
            WHERE jsd.scheduled_date BETWEEN %s AND %s
              AND wo.status NOT IN ('canceled', 'invoiced', 'paid')
        """
        params = [start_date, end_date]

        if employee_username:
            query += """
                AND EXISTS (
                    SELECT 1 FROM job_schedule_crew jsc2
                    WHERE jsc2.job_schedule_date_id = jsd.id
                    AND jsc2.employee_username = %s
                )
            """
            params.append(employee_username)

        query += " ORDER BY jsd.scheduled_date, jsd.start_time"

        cur.execute(query, params)
        schedule = cur.fetchall()

        # Also get employee availability for the range (only approved unavailability)
        avail_query = """
            SELECT
                ea.id,
                ea.employee_username,
                u.full_name,
                ea.start_date,
                ea.end_date,
                ea.availability_type,
                ea.reason,
                ea.approved,
                ea.approved_by
            FROM employee_availability ea
            JOIN users u ON ea.employee_username = u.username
            WHERE ea.start_date <= %s AND ea.end_date >= %s
              AND ea.approved = TRUE
        """
        avail_params = [end_date, start_date]

        if employee_username:
            avail_query += " AND ea.employee_username = %s"
            avail_params.append(employee_username)

        cur.execute(avail_query, avail_params)
        availability = cur.fetchall()

        cur.close()
        conn.close()

        return {
            "schedule": schedule,
            "availability": availability
        }

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


@app.get("/calendar/employee/{username}")
async def get_employee_calendar(
    username: str,
    start_date: date,
    end_date: date,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific employee's schedule for a date range"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get scheduled jobs
        cur.execute("""
            SELECT
                jsd.scheduled_date,
                jsd.start_time,
                jsd.end_time,
                jsc.scheduled_hours,
                jsc.role,
                jsc.is_lead_for_day,
                wo.work_order_number,
                wo.job_description,
                wo.service_address,
                wo.status as job_status,
                c.first_name || ' ' || c.last_name as customer_name
            FROM job_schedule_crew jsc
            JOIN job_schedule_dates jsd ON jsc.job_schedule_date_id = jsd.id
            JOIN work_orders wo ON jsd.work_order_id = wo.id
            JOIN customers c ON wo.customer_id = c.id
            WHERE jsc.employee_username = %s
              AND jsd.scheduled_date BETWEEN %s AND %s
              AND jsd.status NOT IN ('skipped', 'rescheduled')
            ORDER BY jsd.scheduled_date, jsd.start_time
        """, (username, start_date, end_date))

        jobs = cur.fetchall()

        # Get availability
        cur.execute("""
            SELECT * FROM employee_availability
            WHERE employee_username = %s
              AND start_date <= %s AND end_date >= %s
            ORDER BY start_date
        """, (username, end_date, start_date))

        availability = cur.fetchall()

        # Calculate daily totals
        daily_hours = {}
        for job in jobs:
            date_str = str(job['scheduled_date'])
            if date_str not in daily_hours:
                daily_hours[date_str] = 0
            daily_hours[date_str] += float(job['scheduled_hours'] or 0)

        cur.close()
        conn.close()

        return {
            "jobs": jobs,
            "availability": availability,
            "daily_hours": daily_hours
        }

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


# ============================================================
# SCHEDULE CONFLICT DETECTION
# ============================================================

class ConflictCheckRequest(BaseModel):
    dates: List[date]
    start_time: str = "07:00"
    end_time: str = "15:30"
    except_work_order_id: Optional[int] = None


@app.post("/employees/{username}/schedule-conflicts")
async def check_schedule_conflicts(
    username: str,
    request: ConflictCheckRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Check if an employee has scheduling conflicts on given dates/times.
    Returns list of conflicting jobs with their time slots.
    Also checks for approved PTO/unavailability that would prevent scheduling.
    15-minute granularity is used for conflict detection.
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        conflicts = []
        unavailability_conflicts = []

        for check_date in request.dates:
            # ============================================================
            # CHECK 1: Approved PTO/Unavailability
            # ============================================================
            cur.execute("""
                SELECT
                    id,
                    start_date,
                    end_date,
                    availability_type,
                    reason,
                    all_day,
                    start_time,
                    end_time
                FROM employee_availability
                WHERE employee_username = %s
                  AND %s BETWEEN start_date AND end_date
                  AND approved = TRUE
                  AND availability_type IN ('vacation', 'sick', 'personal', 'emergency', 'pto', 'unavailable')
            """, (username, check_date))

            unavail_records = cur.fetchall()

            for unavail in unavail_records:
                # Check if this is an all-day unavailability or time-specific
                if unavail['all_day'] or (not unavail['start_time'] and not unavail['end_time']):
                    # All-day unavailability - any scheduling conflicts
                    unavailability_conflicts.append({
                        "date": str(check_date),
                        "conflict_type": "unavailability",
                        "availability_type": unavail['availability_type'],
                        "reason": unavail['reason'] or f"Approved {unavail['availability_type']}",
                        "all_day": True,
                        "unavailable_start": str(unavail['start_date']),
                        "unavailable_end": str(unavail['end_date']),
                        "proposed_start_time": request.start_time,
                        "proposed_end_time": request.end_time,
                        "availability_id": unavail['id']
                    })
                else:
                    # Time-specific unavailability - check for overlap
                    unavail_start = unavail['start_time']
                    unavail_end = unavail['end_time']

                    # Parse proposed time slot
                    start_time_str = request.start_time[:5] if len(request.start_time) > 5 else request.start_time
                    end_time_str = request.end_time[:5] if len(request.end_time) > 5 else request.end_time
                    prop_start = datetime.strptime(start_time_str, "%H:%M").time()
                    prop_end = datetime.strptime(end_time_str, "%H:%M").time()

                    # Check for time overlap
                    if prop_start < unavail_end and prop_end > unavail_start:
                        unavailability_conflicts.append({
                            "date": str(check_date),
                            "conflict_type": "unavailability",
                            "availability_type": unavail['availability_type'],
                            "reason": unavail['reason'] or f"Approved {unavail['availability_type']}",
                            "all_day": False,
                            "unavailable_start_time": str(unavail_start),
                            "unavailable_end_time": str(unavail_end),
                            "proposed_start_time": request.start_time,
                            "proposed_end_time": request.end_time,
                            "availability_id": unavail['id']
                        })

            # ============================================================
            # CHECK 2: Existing Job Schedule Conflicts
            # ============================================================
            query = """
                SELECT
                    jsd.id as schedule_id,
                    jsd.scheduled_date,
                    jsd.start_time,
                    jsd.end_time,
                    jsd.work_order_id,
                    wo.work_order_number,
                    wo.job_description,
                    c.first_name || ' ' || c.last_name as customer_name,
                    jsc.scheduled_hours
                FROM job_schedule_crew jsc
                JOIN job_schedule_dates jsd ON jsc.job_schedule_date_id = jsd.id
                JOIN work_orders wo ON jsd.work_order_id = wo.id
                LEFT JOIN customers c ON wo.customer_id = c.id
                WHERE jsc.employee_username = %s
                  AND jsd.scheduled_date = %s
                  AND jsd.status NOT IN ('skipped', 'rescheduled', 'completed')
            """
            params = [username, check_date]

            if request.except_work_order_id:
                query += " AND jsd.work_order_id != %s"
                params.append(request.except_work_order_id)

            cur.execute(query, params)
            existing_jobs = cur.fetchall()

            # Parse proposed time slot (handle both HH:MM and HH:MM:SS formats)
            start_time_str = request.start_time[:5] if len(request.start_time) > 5 else request.start_time
            end_time_str = request.end_time[:5] if len(request.end_time) > 5 else request.end_time
            prop_start = datetime.strptime(start_time_str, "%H:%M").time()
            prop_end = datetime.strptime(end_time_str, "%H:%M").time()

            for job in existing_jobs:
                # Parse existing time slot
                exist_start = job['start_time'] if job['start_time'] else datetime.strptime("00:00", "%H:%M").time()
                exist_end = job['end_time'] if job['end_time'] else datetime.strptime("23:59", "%H:%M").time()

                # Check for time overlap
                # Overlap if: prop_start < exist_end AND prop_end > exist_start
                if prop_start < exist_end and prop_end > exist_start:
                    # Calculate overlapping hours
                    overlap_start = max(prop_start, exist_start)
                    overlap_end = min(prop_end, exist_end)

                    overlap_minutes = (
                        datetime.combine(check_date, overlap_end) -
                        datetime.combine(check_date, overlap_start)
                    ).seconds / 60

                    conflicts.append({
                        "date": str(check_date),
                        "conflict_type": "schedule",
                        "work_order_id": job['work_order_id'],
                        "work_order_number": job['work_order_number'],
                        "job_description": job['job_description'],
                        "customer_name": job['customer_name'],
                        "existing_start_time": str(job['start_time']) if job['start_time'] else None,
                        "existing_end_time": str(job['end_time']) if job['end_time'] else None,
                        "proposed_start_time": request.start_time,
                        "proposed_end_time": request.end_time,
                        "overlap_minutes": int(overlap_minutes),
                        "overlap_hours": round(overlap_minutes / 60, 2),
                        "schedule_id": job['schedule_id']
                    })

        cur.close()
        conn.close()

        # Combine all conflicts - unavailability conflicts are more severe (blocking)
        all_conflicts = unavailability_conflicts + conflicts

        return {
            "has_conflicts": len(all_conflicts) > 0,
            "has_unavailability": len(unavailability_conflicts) > 0,
            "conflicts": all_conflicts,
            "unavailability_conflicts": unavailability_conflicts,
            "schedule_conflicts": conflicts,
            "employee_username": username,
            "dates_checked": [str(d) for d in request.dates]
        }

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


class ClearConflictsRequest(BaseModel):
    dates: List[date]
    start_time: str = "07:00"
    end_time: str = "15:30"
    except_work_order_id: Optional[int] = None  # Don't clear this job


@app.post("/employees/{username}/clear-schedule-conflicts")
async def clear_schedule_conflicts(
    username: str,
    request: ClearConflictsRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Clear conflicting schedule entries for an employee.
    This modifies existing job schedules to free up the requested time slot.
    Only the overlapping hours are removed/adjusted.
    """
    if current_user.get('role') not in ['admin', 'manager']:
        raise HTTPException(status_code=403, detail="Only admins/managers can clear schedule conflicts")

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cleared_entries = []

        for clear_date in request.dates:
            # Get conflicting schedule entries
            query = """
                SELECT
                    jsc.id as crew_id,
                    jsd.id as schedule_id,
                    jsd.scheduled_date,
                    jsd.start_time,
                    jsd.end_time,
                    jsd.work_order_id,
                    wo.work_order_number
                FROM job_schedule_crew jsc
                JOIN job_schedule_dates jsd ON jsc.job_schedule_date_id = jsd.id
                JOIN work_orders wo ON jsd.work_order_id = wo.id
                WHERE jsc.employee_username = %s
                  AND jsd.scheduled_date = %s
                  AND jsd.status NOT IN ('skipped', 'rescheduled', 'completed')
            """
            params = [username, clear_date]

            if request.except_work_order_id:
                query += " AND jsd.work_order_id != %s"
                params.append(request.except_work_order_id)

            cur.execute(query, params)
            existing_jobs = cur.fetchall()

            # Parse proposed time slot (handle both HH:MM and HH:MM:SS formats)
            start_time_str = request.start_time[:5] if len(request.start_time) > 5 else request.start_time
            end_time_str = request.end_time[:5] if len(request.end_time) > 5 else request.end_time
            prop_start = datetime.strptime(start_time_str, "%H:%M").time()
            prop_end = datetime.strptime(end_time_str, "%H:%M").time()

            for job in existing_jobs:
                exist_start = job['start_time'] if job['start_time'] else datetime.strptime("00:00", "%H:%M").time()
                exist_end = job['end_time'] if job['end_time'] else datetime.strptime("23:59", "%H:%M").time()

                # Check for overlap
                if prop_start < exist_end and prop_end > exist_start:
                    # Determine what to do with the existing entry
                    # Case 1: New slot completely covers existing -> remove employee from that day
                    if prop_start <= exist_start and prop_end >= exist_end:
                        cur.execute("DELETE FROM job_schedule_crew WHERE id = %s", (job['crew_id'],))
                        cleared_entries.append({
                            "action": "removed",
                            "date": str(clear_date),
                            "work_order_number": job['work_order_number'],
                            "work_order_id": job['work_order_id']
                        })

                    # Case 2: New slot overlaps start -> shorten existing to start later
                    elif prop_start <= exist_start and prop_end < exist_end:
                        new_start = prop_end
                        cur.execute("""
                            UPDATE job_schedule_dates SET start_time = %s WHERE id = %s
                        """, (new_start, job['schedule_id']))
                        cleared_entries.append({
                            "action": "shortened_start",
                            "date": str(clear_date),
                            "work_order_number": job['work_order_number'],
                            "work_order_id": job['work_order_id'],
                            "new_start_time": str(new_start)
                        })

                    # Case 3: New slot overlaps end -> shorten existing to end earlier
                    elif prop_start > exist_start and prop_end >= exist_end:
                        new_end = prop_start
                        cur.execute("""
                            UPDATE job_schedule_dates SET end_time = %s WHERE id = %s
                        """, (new_end, job['schedule_id']))
                        cleared_entries.append({
                            "action": "shortened_end",
                            "date": str(clear_date),
                            "work_order_number": job['work_order_number'],
                            "work_order_id": job['work_order_id'],
                            "new_end_time": str(new_end)
                        })

                    # Case 4: New slot in middle -> can't easily split, just remove employee
                    else:
                        cur.execute("DELETE FROM job_schedule_crew WHERE id = %s", (job['crew_id'],))
                        cleared_entries.append({
                            "action": "removed_for_split",
                            "date": str(clear_date),
                            "work_order_number": job['work_order_number'],
                            "work_order_id": job['work_order_id'],
                            "reason": "Time slot in middle of existing schedule - employee removed"
                        })

        conn.commit()
        cur.close()
        conn.close()

        return {
            "success": True,
            "cleared_entries": cleared_entries,
            "employee_username": username
        }

    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


# ============================================================
# BATCH TIMESHEET ENTRY (For filling timesheets in bulk)
# ============================================================

class BatchTimesheetEntry(BaseModel):
    work_order_id: int
    employee_usernames: List[str]
    dates: List[date]
    hours_per_day: float = 8.0
    notes: Optional[str] = None

@app.post("/time-entries/batch-fill")
async def batch_fill_timesheets(
    batch: BatchTimesheetEntry,
    current_user: dict = Depends(get_current_user)
):
    """Fill timesheets for multiple employees on multiple dates for the same job"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        entries_created = 0

        for username in batch.employee_usernames:
            # Get employee pay rate
            cur.execute("""
                SELECT hourly_rate FROM users WHERE username = %s
            """, (username,))
            employee = cur.fetchone()
            if not employee:
                continue

            pay_rate = employee['hourly_rate'] or 0

            for work_date in batch.dates:
                # Calculate week ending (Saturday)
                days_until_saturday = (5 - work_date.weekday()) % 7
                week_ending = work_date + timedelta(days=days_until_saturday)

                # Insert or update time entry (pay_amount is generated, so exclude it)
                cur.execute("""
                    INSERT INTO time_entries (
                        work_order_id, employee_username, work_date,
                        hours_worked, pay_rate,
                        week_ending_date, notes, time_type
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, 'job')
                    ON CONFLICT (work_order_id, employee_username, work_date)
                    WHERE work_order_id IS NOT NULL
                    DO UPDATE SET
                        hours_worked = EXCLUDED.hours_worked,
                        pay_rate = EXCLUDED.pay_rate,
                        notes = EXCLUDED.notes
                    RETURNING id
                """, (
                    batch.work_order_id,
                    username,
                    work_date,
                    batch.hours_per_day,
                    pay_rate,
                    week_ending,
                    batch.notes
                ))

                entries_created += 1

        conn.commit()
        cur.close()
        conn.close()

        return {
            "success": True,
            "entries_created": entries_created,
            "employees": len(batch.employee_usernames),
            "dates": len(batch.dates)
        }

    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)

# ============================================================================
# GEOCODING AND MAP ENDPOINTS
# ============================================================================

# Rate limiting for Nominatim (1 request per second)
geocode_semaphore = asyncio.Semaphore(1)
last_geocode_time = 0

async def geocode_address(address: str) -> dict:
    """Geocode an address using OpenStreetMap Nominatim API"""
    global last_geocode_time

    async with geocode_semaphore:
        # Ensure at least 1 second between requests (Nominatim requirement)
        current_time = time.time()
        time_since_last = current_time - last_geocode_time
        if time_since_last < 1.0:
            await asyncio.sleep(1.0 - time_since_last)

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={
                        "q": address,
                        "format": "json",
                        "limit": 1,
                        "countrycodes": "us"
                    },
                    headers={
                        "User-Agent": "MA-Electrical-Inventory/1.0"
                    },
                    timeout=10.0
                )
                last_geocode_time = time.time()

                if response.status_code == 200:
                    data = response.json()
                    if data:
                        return {
                            "success": True,
                            "latitude": float(data[0]["lat"]),
                            "longitude": float(data[0]["lon"]),
                            "display_name": data[0].get("display_name", "")
                        }
                    return {"success": False, "error": "Address not found"}
                return {"success": False, "error": f"API error: {response.status_code}"}
            except Exception as e:
                return {"success": False, "error": str(e)}

class GeocodeRequest(BaseModel):
    address: str

@app.post("/geocode")
async def geocode_single_address(request: GeocodeRequest, current_user: dict = Depends(get_current_user)):
    """Geocode a single address"""
    result = await geocode_address(request.address)
    return result

@app.post("/customers/{customer_id}/geocode")
async def geocode_customer(customer_id: int, current_user: dict = Depends(get_current_user)):
    """Geocode a customer's service address and store in database"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get customer address
        cur.execute("""
            SELECT service_street, service_city, service_state, service_zip
            FROM customers WHERE id = %s
        """, (customer_id,))
        customer = cur.fetchone()

        if not customer:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Customer not found")

        # Build full address
        address_parts = [
            customer["service_street"],
            customer["service_city"],
            customer["service_state"],
            customer["service_zip"]
        ]
        full_address = ", ".join(filter(None, address_parts))

        if not full_address.strip():
            cur.close()
            conn.close()
            return {"success": False, "error": "No address to geocode"}

        # Geocode
        result = await geocode_address(full_address)

        if result["success"]:
            # Update customer with coordinates
            cur.execute("""
                UPDATE customers
                SET service_latitude = %s, service_longitude = %s, geocoded_at = NOW()
                WHERE id = %s
            """, (result["latitude"], result["longitude"], customer_id))
            conn.commit()

        cur.close()
        conn.close()
        return result

    except HTTPException:
        raise
    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)

@app.post("/geocode/batch-customers")
async def batch_geocode_customers(current_user: dict = Depends(get_current_user)):
    """Geocode all customers that don't have coordinates yet"""
    if current_user["role"] not in ["admin", "office"]:
        raise HTTPException(status_code=403, detail="Admin or office access required")

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get customers without coordinates
        cur.execute("""
            SELECT id, service_street, service_city, service_state, service_zip
            FROM customers
            WHERE service_latitude IS NULL
            AND (service_street IS NOT NULL AND service_street != '')
            LIMIT 50
        """)
        customers = cur.fetchall()

        results = {
            "total": len(customers),
            "success": 0,
            "failed": 0,
            "errors": []
        }

        for customer in customers:
            customer_id = customer["id"]
            address_parts = [
                customer["service_street"],
                customer["service_city"],
                customer["service_state"],
                customer["service_zip"]
            ]
            full_address = ", ".join(filter(None, address_parts))

            if not full_address.strip():
                results["failed"] += 1
                results["errors"].append({"id": customer_id, "error": "Empty address"})
                continue

            result = await geocode_address(full_address)

            if result["success"]:
                cur.execute("""
                    UPDATE customers
                    SET service_latitude = %s, service_longitude = %s, geocoded_at = NOW()
                    WHERE id = %s
                """, (result["latitude"], result["longitude"], customer_id))
                conn.commit()
                results["success"] += 1
            else:
                results["failed"] += 1
                results["errors"].append({"id": customer_id, "error": result.get("error", "Unknown error")})

        cur.close()
        conn.close()
        return results

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)

@app.post("/users/{username}/geocode")
async def geocode_user_home(username: str, current_user: dict = Depends(get_current_user)):
    """Geocode a user's home address"""
    if current_user["role"] not in ["admin", "office"] and current_user["sub"] != username:
        raise HTTPException(status_code=403, detail="Access denied")

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT address, city, state, zip
            FROM users WHERE username = %s
        """, (username,))
        user = cur.fetchone()

        if not user:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="User not found")

        address_parts = [
            user["address"],
            user["city"],
            user["state"],
            user["zip"]
        ]
        full_address = ", ".join(filter(None, address_parts))

        if not full_address.strip():
            cur.close()
            conn.close()
            return {"success": False, "error": "No home address to geocode"}

        result = await geocode_address(full_address)

        if result["success"]:
            cur.execute("""
                UPDATE users
                SET home_latitude = %s, home_longitude = %s, home_geocoded_at = NOW()
                WHERE username = %s
            """, (result["latitude"], result["longitude"], username))
            conn.commit()

        cur.close()
        conn.close()
        return result

    except HTTPException:
        raise
    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)

@app.get("/map/jobs")
async def get_map_jobs(
    date: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get jobs with coordinates for map display"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        query = """
            SELECT
                wo.id,
                wo.status,
                wo.scheduled_date,
                wo.scheduled_start_time,
                wo.job_description,
                wo.emergency_call,
                c.company_name,
                c.service_street,
                c.service_city,
                c.service_state,
                c.service_zip,
                c.service_latitude,
                c.service_longitude,
                wo.assigned_to
            FROM work_orders wo
            JOIN customers c ON wo.customer_id = c.id
            WHERE c.service_latitude IS NOT NULL
        """
        params = []

        if date:
            query += " AND wo.scheduled_date = %s"
            params.append(date)

        if status:
            query += " AND wo.status = %s"
            params.append(status)

        query += " ORDER BY wo.scheduled_date, wo.scheduled_start_time"

        cur.execute(query, params)
        rows = cur.fetchall()

        jobs = []
        for row in rows:
            jobs.append({
                "id": row["id"],
                "status": row["status"],
                "scheduled_date": str(row["scheduled_date"]) if row["scheduled_date"] else None,
                "scheduled_time": str(row["scheduled_start_time"]) if row["scheduled_start_time"] else None,
                "description": row["job_description"],
                "emergency": row["emergency_call"],
                "customer_name": row["company_name"],
                "address": row["service_street"],
                "city": row["service_city"],
                "state": row["service_state"],
                "zip": row["service_zip"],
                "latitude": float(row["service_latitude"]) if row["service_latitude"] else None,
                "longitude": float(row["service_longitude"]) if row["service_longitude"] else None,
                "assigned_to": row["assigned_to"]
            })

        cur.close()
        conn.close()
        return {"jobs": jobs}

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)

@app.get("/map/technicians")
async def get_map_technicians(current_user: dict = Depends(get_current_user)):
    """Get technicians with home coordinates for map display"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT
                username,
                full_name,
                address,
                city,
                state,
                zip,
                home_latitude,
                home_longitude,
                role
            FROM users
            WHERE role IN ('technician', 'admin')
            AND home_latitude IS NOT NULL
        """)
        rows = cur.fetchall()

        technicians = []
        for row in rows:
            technicians.append({
                "username": row["username"],
                "name": row["full_name"],
                "address": row["address"],
                "city": row["city"],
                "state": row["state"],
                "zip": row["zip"],
                "latitude": float(row["home_latitude"]) if row["home_latitude"] else None,
                "longitude": float(row["home_longitude"]) if row["home_longitude"] else None,
                "role": row["role"]
            })

        cur.close()
        conn.close()
        return {"technicians": technicians}

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


# ============================================================
# EMPLOYEE UNAVAILABILITY MANAGEMENT (Call-Out Feature)
# ============================================================

@app.delete("/employees/{username}/availability/{availability_id}")
async def delete_employee_availability(
    username: str,
    availability_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Delete an availability record"""
    # Only admins/managers or the employee themselves can delete
    if current_user.get('role') not in ['admin', 'manager'] and current_user['username'] != username:
        raise HTTPException(status_code=403, detail="Not authorized to delete this availability record")

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Verify the record exists and belongs to this employee
        cur.execute("""
            SELECT id FROM employee_availability
            WHERE id = %s AND employee_username = %s
        """, (availability_id, username))

        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Availability record not found")

        cur.execute("""
            DELETE FROM employee_availability
            WHERE id = %s AND employee_username = %s
        """, (availability_id, username))

        conn.commit()
        cur.close()
        conn.close()

        return {"success": True, "message": "Availability record deleted"}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


class EmployeeCallOutRequest(BaseModel):
    start_date: date
    end_date: date
    availability_type: str = "sick"  # sick, personal, emergency, other
    reason: Optional[str] = None
    remove_from_schedule: bool = True  # Whether to remove from scheduled jobs


@app.post("/employees/{username}/call-out")
async def employee_call_out(
    username: str,
    request: EmployeeCallOutRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Mark an employee as called out (sick, emergency, etc.) and optionally
    remove them from scheduled jobs for that period.
    Returns the list of affected jobs that need reassignment.
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Verify employee exists
        cur.execute("SELECT username, full_name FROM users WHERE username = %s", (username,))
        employee = cur.fetchone()
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")

        # Create unavailability record
        cur.execute("""
            INSERT INTO employee_availability (
                employee_username, start_date, end_date,
                availability_type, reason, approved, approved_by
            ) VALUES (%s, %s, %s, %s, %s, TRUE, %s)
            RETURNING id
        """, (
            username,
            request.start_date,
            request.end_date,
            request.availability_type,
            request.reason,
            current_user['username']
        ))
        availability_id = cur.fetchone()['id']

        affected_jobs = []

        if request.remove_from_schedule:
            # Get all jobs this employee is scheduled for in the date range
            cur.execute("""
                SELECT
                    jsc.id as crew_id,
                    jsd.id as schedule_id,
                    jsd.scheduled_date,
                    jsd.start_time,
                    jsd.end_time,
                    jsd.work_order_id,
                    wo.work_order_number,
                    wo.job_description,
                    wo.job_type,
                    wo.service_address,
                    wo.status as job_status,
                    wo.priority,
                    c.first_name || ' ' || c.last_name as customer_name,
                    c.phone_primary as customer_phone,
                    jsc.is_lead_for_day,
                    jsc.role,
                    (
                        SELECT COUNT(*) FROM job_schedule_crew jsc2
                        WHERE jsc2.job_schedule_date_id = jsd.id
                        AND jsc2.employee_username != %s
                    ) as other_crew_count
                FROM job_schedule_crew jsc
                JOIN job_schedule_dates jsd ON jsc.job_schedule_date_id = jsd.id
                JOIN work_orders wo ON jsd.work_order_id = wo.id
                LEFT JOIN customers c ON wo.customer_id = c.id
                WHERE jsc.employee_username = %s
                  AND jsd.scheduled_date BETWEEN %s AND %s
                  AND jsd.status NOT IN ('completed', 'skipped')
                ORDER BY jsd.scheduled_date, jsd.start_time
            """, (username, username, request.start_date, request.end_date))

            scheduled_jobs = cur.fetchall()

            for job in scheduled_jobs:
                # Remove employee from this scheduled date
                cur.execute("""
                    DELETE FROM job_schedule_crew
                    WHERE id = %s
                """, (job['crew_id'],))

                # If this was the lead, check if we need to promote someone else
                new_lead = None
                if job['is_lead_for_day'] and job['other_crew_count'] > 0:
                    # Try to promote another crew member to lead
                    cur.execute("""
                        UPDATE job_schedule_crew
                        SET is_lead_for_day = TRUE
                        WHERE job_schedule_date_id = %s
                        AND id = (
                            SELECT id FROM job_schedule_crew
                            WHERE job_schedule_date_id = %s
                            ORDER BY
                                CASE role
                                    WHEN 'lead' THEN 1
                                    WHEN 'technician' THEN 2
                                    WHEN 'helper' THEN 3
                                    WHEN 'apprentice' THEN 4
                                    ELSE 5
                                END
                            LIMIT 1
                        )
                        RETURNING employee_username
                    """, (job['schedule_id'], job['schedule_id']))
                    result = cur.fetchone()
                    if result:
                        new_lead = result['employee_username']

                # Get remaining crew for this job date
                cur.execute("""
                    SELECT
                        jsc.employee_username,
                        u.full_name,
                        jsc.role,
                        jsc.is_lead_for_day
                    FROM job_schedule_crew jsc
                    JOIN users u ON jsc.employee_username = u.username
                    WHERE jsc.job_schedule_date_id = %s
                """, (job['schedule_id'],))
                remaining_crew = cur.fetchall()

                affected_jobs.append({
                    "work_order_id": job['work_order_id'],
                    "work_order_number": job['work_order_number'],
                    "job_description": job['job_description'],
                    "job_type": job['job_type'],
                    "service_address": job['service_address'],
                    "job_status": job['job_status'],
                    "priority": job['priority'],
                    "customer_name": job['customer_name'],
                    "customer_phone": job['customer_phone'],
                    "scheduled_date": str(job['scheduled_date']),
                    "start_time": str(job['start_time']) if job['start_time'] else None,
                    "end_time": str(job['end_time']) if job['end_time'] else None,
                    "was_lead": job['is_lead_for_day'],
                    "role": job['role'],
                    "remaining_crew_count": len(remaining_crew),
                    "remaining_crew": [dict(c) for c in remaining_crew],
                    "new_lead_assigned": new_lead,
                    "needs_reassignment": len(remaining_crew) == 0  # No crew left
                })

            # Also remove from work_order_assignments if they're the primary assigned_to
            cur.execute("""
                UPDATE work_orders
                SET assigned_to = NULL
                WHERE assigned_to = %s
                  AND id IN (
                      SELECT DISTINCT jsd.work_order_id
                      FROM job_schedule_dates jsd
                      WHERE jsd.scheduled_date BETWEEN %s AND %s
                  )
            """, (username, request.start_date, request.end_date))

        conn.commit()

        # Send email notification to admins/managers about the call-out
        try:
            callout_info = {
                'full_name': employee['full_name'],
                'date': f"{request.start_date}" if request.start_date == request.end_date else f"{request.start_date} to {request.end_date}",
                'type': request.availability_type.capitalize(),
                'reason': request.reason or 'Not specified'
            }
            notify_callout(conn, callout_info, username)
        except Exception as notif_error:
            # Don't fail the request if notification fails
            print(f"Warning: Failed to send call-out notification: {notif_error}")

        cur.close()
        conn.close()

        return {
            "success": True,
            "availability_id": availability_id,
            "employee_username": username,
            "employee_name": employee['full_name'],
            "unavailable_from": str(request.start_date),
            "unavailable_to": str(request.end_date),
            "availability_type": request.availability_type,
            "affected_jobs": affected_jobs,
            "total_affected_jobs": len(affected_jobs),
            "jobs_needing_full_reassignment": sum(1 for j in affected_jobs if j['needs_reassignment'])
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@app.get("/employees/unavailable-today")
async def get_employees_unavailable_today(
    current_user: dict = Depends(get_current_user)
):
    """Get list of employees who are marked unavailable for today"""
    today = date.today()
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT
                ea.id as availability_id,
                ea.employee_username,
                u.full_name,
                ea.start_date,
                ea.end_date,
                ea.availability_type,
                ea.reason,
                ea.approved_by,
                ea.created_at
            FROM employee_availability ea
            JOIN users u ON ea.employee_username = u.username
            WHERE %s BETWEEN ea.start_date AND ea.end_date
              AND ea.availability_type IN ('unavailable', 'sick', 'vacation', 'personal', 'emergency')
            ORDER BY u.full_name
        """, (today,))

        unavailable = cur.fetchall()

        cur.close()
        conn.close()

        return {
            "date": str(today),
            "unavailable_employees": [dict(e) for e in unavailable],
            "count": len(unavailable)
        }

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


@app.get("/employees/available-for-date")
async def get_employees_available_for_date(
    target_date: date,
    start_time: str = "07:00",
    end_time: str = "15:30",
    current_user: dict = Depends(get_current_user)
):
    """
    Get list of employees who are available on a specific date/time.
    Useful for finding replacement workers when someone calls out.
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get all active technicians
        cur.execute("""
            SELECT
                u.username,
                u.full_name,
                u.role,
                u.phone
            FROM users u
            WHERE u.active = TRUE
              AND u.role IN ('technician', 'admin', 'manager')
        """)
        all_employees = cur.fetchall()

        available_employees = []

        for emp in all_employees:
            # Check if employee has any unavailability for this date
            cur.execute("""
                SELECT COUNT(*) as unavail_count
                FROM employee_availability ea
                WHERE ea.employee_username = %s
                  AND %s BETWEEN ea.start_date AND ea.end_date
                  AND ea.availability_type IN ('unavailable', 'sick', 'vacation', 'personal', 'emergency')
            """, (emp['username'], target_date))

            if cur.fetchone()['unavail_count'] > 0:
                continue  # Skip unavailable employees

            # Get their scheduled hours for this date
            cur.execute("""
                SELECT COALESCE(SUM(jsc.scheduled_hours), 0) as scheduled_hours
                FROM job_schedule_crew jsc
                JOIN job_schedule_dates jsd ON jsc.job_schedule_date_id = jsd.id
                WHERE jsc.employee_username = %s
                  AND jsd.scheduled_date = %s
                  AND jsd.status NOT IN ('completed', 'skipped', 'rescheduled')
            """, (emp['username'], target_date))

            scheduled_hours = float(cur.fetchone()['scheduled_hours'])

            # Get their scheduled jobs for context
            cur.execute("""
                SELECT
                    wo.work_order_number,
                    jsd.start_time,
                    jsd.end_time
                FROM job_schedule_crew jsc
                JOIN job_schedule_dates jsd ON jsc.job_schedule_date_id = jsd.id
                JOIN work_orders wo ON jsd.work_order_id = wo.id
                WHERE jsc.employee_username = %s
                  AND jsd.scheduled_date = %s
                  AND jsd.status NOT IN ('completed', 'skipped', 'rescheduled')
                ORDER BY jsd.start_time
            """, (emp['username'], target_date))

            scheduled_jobs = cur.fetchall()

            available_employees.append({
                "username": emp['username'],
                "full_name": emp['full_name'],
                "role": emp['role'],
                "phone": emp['phone'],
                "scheduled_hours": scheduled_hours,
                "is_free": scheduled_hours == 0,
                "scheduled_jobs": [dict(j) for j in scheduled_jobs]
            })

        # Sort: free employees first, then by scheduled hours
        available_employees.sort(key=lambda x: (not x['is_free'], x['scheduled_hours']))

        cur.close()
        conn.close()

        return {
            "date": str(target_date),
            "available_employees": available_employees,
            "total_available": len(available_employees),
            "totally_free": sum(1 for e in available_employees if e['is_free'])
        }

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


# ============================================================
# PTO REQUEST AND APPROVAL SYSTEM
# ============================================================

class PTORequest(BaseModel):
    start_date: date
    end_date: date
    availability_type: str = "vacation"  # vacation, personal, other
    reason: Optional[str] = None


@app.post("/employees/{username}/request-pto")
async def request_pto(
    username: str,
    request: PTORequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Employee submits a PTO request that requires admin approval.
    Unlike call-out which is immediate (sick/emergency), PTO requires approval
    before it takes effect on the schedule.
    """
    # Only the employee themselves or admin/manager can request on their behalf
    if current_user['username'] != username and current_user.get('role') not in ['admin', 'manager']:
        raise HTTPException(status_code=403, detail="Not authorized to request PTO for this employee")

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Verify employee exists
        cur.execute("SELECT username, full_name FROM users WHERE username = %s", (username,))
        employee = cur.fetchone()
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")

        # Create PTO request with approved=FALSE (pending approval)
        cur.execute("""
            INSERT INTO employee_availability (
                employee_username, start_date, end_date,
                availability_type, reason, approved, approved_by, notes
            ) VALUES (%s, %s, %s, %s, %s, FALSE, NULL, 'Pending approval')
            RETURNING id
        """, (
            username,
            request.start_date,
            request.end_date,
            request.availability_type,
            request.reason
        ))
        pto_id = cur.fetchone()['id']

        # Calculate days requested
        days_requested = (request.end_date - request.start_date).days + 1

        # Create notifications for all admins and managers
        cur.execute("""
            SELECT username FROM users
            WHERE role IN ('admin', 'manager') AND active = TRUE AND username != %s
        """, (username,))
        approvers = cur.fetchall()

        type_label = request.availability_type.capitalize()
        for approver in approvers:
            dedup_key = f"pto_request_{pto_id}_{approver['username']}"
            cur.execute("""
                INSERT INTO notifications (
                    target_username, notification_type, notification_subtype,
                    title, message, severity, related_entity_type, related_entity_id,
                    action_url, dedup_key, expires_at
                ) VALUES (
                    %s, 'pto', 'request',
                    %s, %s, 'warning', 'pto_request', %s,
                    '/admin/pto-approval', %s, CURRENT_TIMESTAMP + INTERVAL '30 days'
                )
                ON CONFLICT (dedup_key) DO NOTHING
            """, (
                approver['username'],
                f"PTO Request: {employee['full_name']}",
                f"{employee['full_name']} requested {days_requested} day(s) of {type_label} from {request.start_date} to {request.end_date}.",
                pto_id,
                dedup_key
            ))

        conn.commit()

        # Send email notifications to admins/managers
        try:
            pto_data = {
                'id': pto_id,
                'username': username,
                'full_name': employee['full_name'],
                'pto_type': type_label,
                'date_display': f"{request.start_date} to {request.end_date}",
                'hours': days_requested * 8,
                'reason': request.reason or 'Not specified'
            }
            notify_pto_request_submitted(conn, pto_data, current_user['username'])
        except Exception as notif_error:
            # Don't fail the request if notification fails
            print(f"Warning: Failed to send PTO request notification: {notif_error}")

        cur.close()
        conn.close()

        return {
            "success": True,
            "pto_id": pto_id,
            "employee_username": username,
            "employee_name": employee['full_name'],
            "start_date": str(request.start_date),
            "end_date": str(request.end_date),
            "availability_type": request.availability_type,
            "status": "pending_approval",
            "message": "PTO request submitted for approval"
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@app.get("/pto/pending")
async def get_pending_pto_requests(
    current_user: dict = Depends(get_current_user)
):
    """Get all pending PTO requests awaiting approval. Admin/Manager only."""
    if current_user.get('role') not in ['admin', 'manager']:
        raise HTTPException(status_code=403, detail="Admin or manager access required")

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT
                ea.id,
                ea.employee_username,
                u.full_name as employee_name,
                ea.start_date,
                ea.end_date,
                ea.availability_type,
                ea.reason,
                ea.created_at,
                ea.notes,
                -- Calculate days requested
                (ea.end_date - ea.start_date + 1) as days_requested,
                -- Check for schedule conflicts
                (
                    SELECT COUNT(*) FROM job_schedule_crew jsc
                    JOIN job_schedule_dates jsd ON jsc.job_schedule_date_id = jsd.id
                    WHERE jsc.employee_username = ea.employee_username
                      AND jsd.scheduled_date BETWEEN ea.start_date AND ea.end_date
                      AND jsd.status NOT IN ('completed', 'cancelled')
                ) as scheduled_jobs_affected
            FROM employee_availability ea
            JOIN users u ON ea.employee_username = u.username
            WHERE ea.approved = FALSE
              AND ea.availability_type IN ('vacation', 'personal', 'other')
            ORDER BY ea.created_at DESC
        """)

        pending = cur.fetchall()

        cur.close()
        conn.close()

        return {
            "pending_requests": [dict(p) for p in pending],
            "count": len(pending)
        }

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


class PTOApprovalRequest(BaseModel):
    approved: bool
    admin_notes: Optional[str] = None
    remove_from_schedule: bool = True  # If approved, remove from scheduled jobs


@app.post("/pto/{pto_id}/approve")
async def approve_pto_request(
    pto_id: int,
    request: PTOApprovalRequest,
    current_user: dict = Depends(get_current_user)
):
    """Approve or deny a PTO request. Admin/Manager only."""
    if current_user.get('role') not in ['admin', 'manager']:
        raise HTTPException(status_code=403, detail="Admin or manager access required")

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get the PTO request
        cur.execute("""
            SELECT ea.*, u.full_name as employee_name
            FROM employee_availability ea
            JOIN users u ON ea.employee_username = u.username
            WHERE ea.id = %s
        """, (pto_id,))
        pto = cur.fetchone()

        if not pto:
            raise HTTPException(status_code=404, detail="PTO request not found")

        if pto['approved']:
            raise HTTPException(status_code=400, detail="This PTO request has already been processed")

        affected_jobs = []

        if request.approved:
            # Approve the PTO
            cur.execute("""
                UPDATE employee_availability
                SET approved = TRUE,
                    approved_by = %s,
                    notes = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (
                current_user['username'],
                request.admin_notes or f"Approved by {current_user['username']}",
                pto_id
            ))

            # If remove_from_schedule is True, remove employee from scheduled jobs
            if request.remove_from_schedule:
                # Get all jobs this employee is scheduled for in the PTO date range
                cur.execute("""
                    SELECT
                        jsc.id as crew_id,
                        jsd.id as schedule_id,
                        jsd.scheduled_date,
                        jsd.work_order_id,
                        wo.work_order_number,
                        wo.job_description,
                        wo.priority,
                        c.first_name || ' ' || c.last_name as customer_name,
                        jsc.is_lead_for_day,
                        (
                            SELECT COUNT(*) FROM job_schedule_crew jsc2
                            WHERE jsc2.job_schedule_date_id = jsd.id
                            AND jsc2.employee_username != %s
                        ) as other_crew_count
                    FROM job_schedule_crew jsc
                    JOIN job_schedule_dates jsd ON jsc.job_schedule_date_id = jsd.id
                    JOIN work_orders wo ON jsd.work_order_id = wo.id
                    LEFT JOIN customers c ON wo.customer_id = c.id
                    WHERE jsc.employee_username = %s
                      AND jsd.scheduled_date BETWEEN %s AND %s
                      AND jsd.status NOT IN ('completed', 'cancelled')
                    ORDER BY jsd.scheduled_date
                """, (pto['employee_username'], pto['employee_username'], pto['start_date'], pto['end_date']))

                scheduled_jobs = cur.fetchall()

                for job in scheduled_jobs:
                    # Remove employee from this scheduled date
                    cur.execute("""
                        DELETE FROM job_schedule_crew
                        WHERE id = %s
                    """, (job['crew_id'],))

                    # If this was the lead, promote someone else
                    new_lead = None
                    if job['is_lead_for_day'] and job['other_crew_count'] > 0:
                        cur.execute("""
                            UPDATE job_schedule_crew
                            SET is_lead_for_day = TRUE
                            WHERE job_schedule_date_id = %s
                            AND id = (
                                SELECT id FROM job_schedule_crew
                                WHERE job_schedule_date_id = %s
                                ORDER BY CASE role
                                    WHEN 'lead' THEN 1
                                    WHEN 'technician' THEN 2
                                    ELSE 3
                                END
                                LIMIT 1
                            )
                            RETURNING employee_username
                        """, (job['schedule_id'], job['schedule_id']))
                        result = cur.fetchone()
                        if result:
                            new_lead = result['employee_username']

                    affected_jobs.append({
                        "work_order_id": job['work_order_id'],
                        "work_order_number": job['work_order_number'],
                        "job_description": job['job_description'],
                        "scheduled_date": str(job['scheduled_date']),
                        "priority": job['priority'],
                        "customer_name": job['customer_name'],
                        "was_lead": job['is_lead_for_day'],
                        "new_lead_assigned": new_lead,
                        "needs_reassignment": job['other_crew_count'] == 0
                    })

            status_msg = "approved"
        else:
            # Deny the PTO - delete the record or mark as denied
            cur.execute("""
                UPDATE employee_availability
                SET notes = %s,
                    approved_by = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (
                f"DENIED: {request.admin_notes or 'Request denied by ' + current_user['username']}",
                current_user['username'],
                pto_id
            ))
            # Delete the denied PTO request so it doesn't block scheduling
            cur.execute("DELETE FROM employee_availability WHERE id = %s", (pto_id,))
            status_msg = "denied"

        conn.commit()

        # Send email notification to employee about the decision
        try:
            pto_data = {
                'id': pto_id,
                'username': pto['employee_username'],
                'full_name': pto['employee_name'],
                'pto_type': pto['availability_type'],
                'date_display': f"{pto['start_date']} to {pto['end_date']}",
                'hours': (pto['end_date'] - pto['start_date']).days * 8 + 8  # Rough estimate
            }
            if request.approved:
                notify_pto_request_approved(conn, pto_data, current_user['username'])
            else:
                notify_pto_request_denied(conn, pto_data, current_user['username'], request.admin_notes or '')
        except Exception as notif_error:
            # Don't fail the request if notification fails
            print(f"Warning: Failed to send PTO notification: {notif_error}")

        cur.close()
        conn.close()

        return {
            "success": True,
            "pto_id": pto_id,
            "employee_username": pto['employee_username'],
            "employee_name": pto['employee_name'],
            "start_date": str(pto['start_date']),
            "end_date": str(pto['end_date']),
            "status": status_msg,
            "approved_by": current_user['username'],
            "affected_jobs": affected_jobs,
            "total_affected_jobs": len(affected_jobs),
            "jobs_needing_reassignment": sum(1 for j in affected_jobs if j.get('needs_reassignment'))
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@app.get("/pto/all")
async def get_all_pto_records(
    start_date: date = None,
    end_date: date = None,
    employee_username: str = None,
    include_pending: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """Get all PTO records with optional filters. Admin/Manager only."""
    if current_user.get('role') not in ['admin', 'manager']:
        raise HTTPException(status_code=403, detail="Admin or manager access required")

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        query = """
            SELECT
                ea.id,
                ea.employee_username,
                u.full_name as employee_name,
                ea.start_date,
                ea.end_date,
                ea.availability_type,
                ea.reason,
                ea.approved,
                ea.approved_by,
                ea.notes,
                ea.created_at,
                ea.updated_at,
                (ea.end_date - ea.start_date + 1) as days_requested
            FROM employee_availability ea
            JOIN users u ON ea.employee_username = u.username
            WHERE ea.availability_type IN ('vacation', 'personal', 'sick', 'emergency', 'other')
        """
        params = []

        if not include_pending:
            query += " AND ea.approved = TRUE"

        if start_date:
            query += " AND ea.end_date >= %s"
            params.append(start_date)

        if end_date:
            query += " AND ea.start_date <= %s"
            params.append(end_date)

        if employee_username:
            query += " AND ea.employee_username = %s"
            params.append(employee_username)

        query += " ORDER BY ea.start_date DESC, ea.created_at DESC"

        cur.execute(query, params)
        records = cur.fetchall()

        cur.close()
        conn.close()

        return {
            "pto_records": [dict(r) for r in records],
            "count": len(records)
        }

    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


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
