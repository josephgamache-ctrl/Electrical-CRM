"""
Authentication and User Management Module API Endpoints
Handles login, user CRUD, manager-worker assignments, and role-based access control.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, List, Literal

from fastapi import APIRouter, HTTPException, status, Request, Body, Depends
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field, validator
import psycopg2.extras
import jwt
import bcrypt
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)

router = APIRouter(tags=["auth"])

# ============================================================
# MODULE INITIALIZATION
# ============================================================

# These will be set by main.py when registering the router
_get_db_connection = None
_get_current_user_func = None
_log_and_raise = None
_SECRET_KEY = None
_ALGORITHM = None
_ACCESS_TOKEN_EXPIRE_MINUTES = None
_ACCOUNT_LOCKOUT_ATTEMPTS = None
_ACCOUNT_LOCKOUT_MINUTES = None


def init_auth_module(
    db_func,
    auth_func,
    log_raise_func,
    secret_key: str,
    algorithm: str,
    token_expire_minutes: int,
    lockout_attempts: int,
    lockout_minutes: int
):
    """Initialize the module with dependencies from main.py"""
    global _get_db_connection, _get_current_user_func, _log_and_raise
    global _SECRET_KEY, _ALGORITHM, _ACCESS_TOKEN_EXPIRE_MINUTES
    global _ACCOUNT_LOCKOUT_ATTEMPTS, _ACCOUNT_LOCKOUT_MINUTES

    _get_db_connection = db_func
    _get_current_user_func = auth_func
    _log_and_raise = log_raise_func
    _SECRET_KEY = secret_key
    _ALGORITHM = algorithm
    _ACCESS_TOKEN_EXPIRE_MINUTES = token_expire_minutes
    _ACCOUNT_LOCKOUT_ATTEMPTS = lockout_attempts
    _ACCOUNT_LOCKOUT_MINUTES = lockout_minutes


def get_db():
    """Get database connection"""
    return _get_db_connection()


async def get_current_user_from_request(request: Request):
    """Extract token from request and get current user"""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    return await _get_current_user_func(token)


# ============================================================
# PYDANTIC MODELS
# ============================================================

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


# ============================================================
# AUTHENTICATION FUNCTIONS
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
    encoded_jwt = jwt.encode(to_encode, _SECRET_KEY, algorithm=_ALGORITHM)
    return encoded_jwt


# ============================================================
# ROLE-BASED ACCESS CONTROL HELPERS
# ============================================================

def require_admin(current_user: dict):
    """Check that requires admin role"""
    if current_user.get('role') != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


def require_manager_or_admin(current_user: dict):
    """Check that requires manager or admin role"""
    if current_user.get('role') not in ['admin', 'manager']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager or admin access required"
        )
    return current_user


def require_admin_or_office(current_user: dict):
    """Check that requires admin or office role (for invoice access)"""
    if current_user.get('role') not in ['admin', 'office']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or office access required"
        )
    return current_user


# ============================================================
# LOGIN ENDPOINT
# ============================================================

@router.post("/login")
async def login_for_access_token(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    conn = get_db()
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
            # Account is still locked - log remaining time server-side only
            remaining_minutes = int((locked_until - datetime.now()).total_seconds() / 60) + 1
            cur.close()
            conn.close()
            logger.warning(f"Login attempt for locked account: {form_data.username} from {client_ip} (locked for {remaining_minutes} more minutes)")
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
            if failed_attempts >= _ACCOUNT_LOCKOUT_ATTEMPTS:
                lock_until = datetime.now() + timedelta(minutes=_ACCOUNT_LOCKOUT_MINUTES)
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

    access_token_expires = timedelta(minutes=_ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"]}, expires_delta=access_token_expires
    )

    logger.info(f"Successful login: {user['username']} from {client_ip}")
    return {"access_token": access_token, "token_type": "bearer", "username": user["username"], "role": user["role"]}


# ============================================================
# USER MANAGEMENT ENDPOINTS
# ============================================================

@router.get("/users")
async def list_users_public(request: Request):
    """Get list of active users (for dispatch/assignment) - available to all authenticated users"""
    current_user = await get_current_user_from_request(request)

    conn = get_db()
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


@router.get("/admin/users")
async def list_users(
    request: Request,
    limit: int = 100,
    offset: int = 0,
    search: Optional[str] = None,
    role: Optional[str] = None,
    active_only: bool = False
):
    """Get all users with pagination (admin only)"""
    current_user = await get_current_user_from_request(request)
    require_admin(current_user)

    conn = get_db()
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


@router.post("/admin/users")
async def create_user(request: Request, user: UserCreate):
    """Create a new user (admin only)"""
    current_user = await get_current_user_from_request(request)
    require_admin(current_user)

    conn = get_db()
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
        _log_and_raise(e, "create_user")


@router.put("/admin/users/{username}")
async def update_user(
    username: str,
    user_update: UserUpdate,
    request: Request
):
    """Update a user (admin only)"""
    current_user = await get_current_user_from_request(request)
    require_admin(current_user)

    conn = get_db()
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
        _log_and_raise(e, "update_user")


@router.delete("/admin/users/{username}")
async def delete_user(username: str, request: Request):
    """Soft delete a user (admin only)"""
    current_user = await get_current_user_from_request(request)
    require_admin(current_user)

    conn = get_db()
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
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        _log_and_raise(e, "delete_user")


# ============================================================
# MANAGER-WORKER ASSIGNMENTS (Admin only)
# ============================================================

@router.get("/admin/managers")
async def list_managers(request: Request):
    """Get all users with manager role"""
    current_user = await get_current_user_from_request(request)
    require_admin(current_user)

    conn = get_db()
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


@router.get("/admin/workers")
async def list_workers(request: Request):
    """Get all users who can be assigned to managers (technicians, employees, office)"""
    current_user = await get_current_user_from_request(request)
    require_admin(current_user)

    conn = get_db()
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


@router.get("/admin/manager-workers")
async def list_all_manager_worker_assignments(request: Request):
    """Get all manager-worker assignments"""
    current_user = await get_current_user_from_request(request)
    require_admin(current_user)

    conn = get_db()
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


@router.get("/admin/manager-workers/{manager_username}")
async def get_manager_workers(manager_username: str, request: Request):
    """Get all workers assigned to a specific manager"""
    current_user = await get_current_user_from_request(request)
    require_admin(current_user)

    conn = get_db()
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


@router.post("/admin/manager-workers")
async def assign_worker_to_manager(assignment: dict, request: Request):
    """Assign a worker to a manager"""
    current_user = await get_current_user_from_request(request)
    require_admin(current_user)

    manager_username = assignment.get('manager_username')
    worker_username = assignment.get('worker_username')
    notes = assignment.get('notes', '')

    if not manager_username or not worker_username:
        raise HTTPException(status_code=400, detail="manager_username and worker_username are required")

    conn = get_db()
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
        _log_and_raise(e, "assign_worker_to_manager")


@router.delete("/admin/manager-workers/{assignment_id}")
async def remove_worker_from_manager(assignment_id: int, request: Request):
    """Remove a worker assignment from a manager"""
    current_user = await get_current_user_from_request(request)
    require_admin(current_user)

    conn = get_db()
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
        _log_and_raise(e, "remove_worker_from_manager")


@router.put("/admin/manager-workers/bulk/{manager_username}")
async def bulk_assign_workers_to_manager(
    manager_username: str,
    request: Request,
    worker_usernames: List[str] = Body(...)
):
    """Bulk assign workers to a manager (replaces all current assignments)"""
    current_user = await get_current_user_from_request(request)
    require_admin(current_user)

    conn = get_db()
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
        _log_and_raise(e, "bulk_assign_workers")


@router.get("/manager/my-workers")
async def get_my_workers(request: Request):
    """Get workers assigned to the current manager"""
    current_user = await get_current_user_from_request(request)

    if current_user.get('role') != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access this endpoint")

    conn = get_db()
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


@router.get("/user/me")
async def get_current_user_info(request: Request):
    """Get current user's information"""
    current_user = await get_current_user_from_request(request)
    return current_user
