"""
Vendors and Dashboard Module API Endpoints
Handles vendor management and role-based dashboard job views.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Vendors & Dashboard"])

# Module-level variables set by init function
_get_db_connection = None
_get_current_user = None


def init_vendors_dashboard_module(db_func, auth_func):
    """Initialize the module with database and auth functions from main.py"""
    global _get_db_connection, _get_current_user
    _get_db_connection = db_func
    _get_current_user = auth_func


def get_db():
    """Get database connection"""
    return _get_db_connection()


async def get_current_user_from_request(request: Request):
    """Extract token from request and get current user."""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    return await _get_current_user(token)


# ============================================================
# PYDANTIC MODELS
# ============================================================

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


# ============================================================
# VENDOR ENDPOINTS
# ============================================================

@router.get("/vendors")
async def get_vendors(
    request: Request,
    limit: int = 100,
    offset: int = 0,
    search: Optional[str] = None
):
    """Get all vendors with pagination"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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


@router.get("/vendors/{vendor_id}")
async def get_vendor(vendor_id: int, request: Request):
    """Get single vendor by ID"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM vendors WHERE id = %s", (vendor_id,))
    vendor = cur.fetchone()
    cur.close()
    conn.close()

    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor


# ============================================================
# DASHBOARD ENDPOINTS - Role-based job views
# ============================================================

@router.get("/dashboard/my-jobs")
async def get_my_dashboard_jobs(request: Request):
    """
    Get jobs for the current user's dashboard based on their role.
    """
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    username = current_user.get('username')
    role = current_user.get('role')
    today = datetime.now().date().isoformat()

    if role == 'admin':
        # Admin sees all jobs that are due today (via scheduled_date, start_date, or job_schedule_dates)
        cur.execute("""
            SELECT DISTINCT ON (wo.id) wo.id, wo.work_order_number, wo.job_description, wo.status,
                wo.job_type, wo.priority, wo.emergency_call, wo.scheduled_date, wo.start_date,
                wo.assigned_to, wo.service_address, c.service_city, c.service_state,
                c.service_zip, c.first_name || ' ' || c.last_name as customer_name,
                c.phone_primary as customer_phone,
                COALESCE(jsd.start_time, '08:00') as scheduled_start_time,
                COALESCE(jsd.end_time, '16:30') as scheduled_end_time
            FROM work_orders wo
            JOIN customers c ON wo.customer_id = c.id
            LEFT JOIN job_schedule_dates jsd ON wo.id = jsd.work_order_id AND jsd.scheduled_date = %s
            WHERE wo.status NOT IN ('completed', 'cancelled', 'invoiced', 'paid')
              AND wo.job_type != 'Service Call' AND wo.emergency_call IS NOT TRUE
              AND (wo.scheduled_date <= %s OR wo.start_date <= %s OR jsd.scheduled_date = %s)
            ORDER BY wo.id, COALESCE(wo.start_date, wo.scheduled_date) ASC, COALESCE(jsd.start_time, '08:00') ASC
        """, (today, today, today, today))
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
                    wo.status, wo.job_type, wo.priority, wo.emergency_call, wo.scheduled_date, wo.start_date,
                    wo.assigned_to, wo.service_address, c.service_city, c.service_state,
                    c.service_zip, c.first_name || ' ' || c.last_name as customer_name,
                    c.phone_primary as customer_phone,
                    COALESCE(jsd.start_time, '08:00') as scheduled_start_time,
                    COALESCE(jsd.end_time, '16:30') as scheduled_end_time
                FROM work_orders wo
                JOIN customers c ON wo.customer_id = c.id
                LEFT JOIN job_schedule_dates jsd ON wo.id = jsd.work_order_id AND jsd.scheduled_date = %s
                LEFT JOIN job_schedule_crew jsc ON jsd.id = jsc.job_schedule_date_id
                WHERE wo.status NOT IN ('completed', 'cancelled', 'invoiced', 'paid')
                  AND wo.job_type != 'Service Call' AND wo.emergency_call IS NOT TRUE
                  AND (wo.scheduled_date <= %s OR wo.start_date <= %s OR jsd.scheduled_date = %s)
                  AND (wo.assigned_to = %s OR jsc.employee_username = ANY(%s))
                ORDER BY wo.id, COALESCE(wo.start_date, wo.scheduled_date) ASC
            """, (today, today, today, today, username, assigned_workers))
        else:
            # No workers assigned yet - show jobs they're assigned to + all scheduled jobs
            cur.execute("""
                SELECT DISTINCT ON (wo.id) wo.id, wo.work_order_number, wo.job_description,
                    wo.status, wo.job_type, wo.priority, wo.emergency_call, wo.scheduled_date, wo.start_date,
                    wo.assigned_to, wo.service_address, c.service_city, c.service_state,
                    c.service_zip, c.first_name || ' ' || c.last_name as customer_name,
                    c.phone_primary as customer_phone,
                    COALESCE(jsd.start_time, '08:00') as scheduled_start_time,
                    COALESCE(jsd.end_time, '16:30') as scheduled_end_time
                FROM work_orders wo
                JOIN customers c ON wo.customer_id = c.id
                LEFT JOIN job_schedule_dates jsd ON wo.id = jsd.work_order_id AND jsd.scheduled_date = %s
                LEFT JOIN job_schedule_crew jsc ON jsd.id = jsc.job_schedule_date_id
                WHERE wo.status NOT IN ('completed', 'cancelled', 'invoiced', 'paid')
                  AND wo.job_type != 'Service Call' AND wo.emergency_call IS NOT TRUE
                  AND (wo.scheduled_date <= %s OR wo.start_date <= %s OR jsd.scheduled_date = %s)
                  AND (wo.assigned_to = %s OR jsc.employee_username IS NOT NULL)
                ORDER BY wo.id, COALESCE(wo.start_date, wo.scheduled_date) ASC
            """, (today, today, today, today, username))
    else:
        # Technician sees jobs they're assigned to OR scheduled on via job_schedule_crew
        cur.execute("""
            SELECT DISTINCT ON (wo.id) wo.id, wo.work_order_number, wo.job_description,
                wo.status, wo.job_type, wo.priority, wo.emergency_call, wo.scheduled_date, wo.start_date,
                wo.assigned_to, wo.service_address, c.service_city, c.service_state,
                c.service_zip, c.first_name || ' ' || c.last_name as customer_name,
                c.phone_primary as customer_phone,
                COALESCE(jsd.start_time, '08:00') as scheduled_start_time,
                COALESCE(jsd.end_time, '16:30') as scheduled_end_time
            FROM work_orders wo
            JOIN customers c ON wo.customer_id = c.id
            LEFT JOIN job_schedule_dates jsd ON wo.id = jsd.work_order_id AND jsd.scheduled_date = %s
            LEFT JOIN job_schedule_crew jsc ON jsd.id = jsc.job_schedule_date_id
            WHERE wo.status NOT IN ('completed', 'cancelled', 'invoiced', 'paid')
              AND wo.job_type != 'Service Call' AND wo.emergency_call IS NOT TRUE
              AND (wo.scheduled_date <= %s OR wo.start_date <= %s OR jsd.scheduled_date = %s)
              AND (wo.assigned_to = %s OR jsc.employee_username = %s)
            ORDER BY wo.id, COALESCE(wo.start_date, wo.scheduled_date) ASC
        """, (today, today, today, today, username, username))

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

    # Service calls - check both scheduled_date and start_date, plus job_schedule_dates
    cur.execute("""
        SELECT DISTINCT ON (wo.id) wo.id, wo.work_order_number, wo.job_description, wo.status, wo.job_type,
            wo.priority, wo.emergency_call, wo.scheduled_date, wo.start_date, wo.assigned_to, wo.service_address,
            c.service_city, c.service_state, c.service_zip,
            c.first_name || ' ' || c.last_name as customer_name, c.phone_primary as customer_phone
        FROM work_orders wo
        JOIN customers c ON wo.customer_id = c.id
        LEFT JOIN job_schedule_dates jsd ON wo.id = jsd.work_order_id AND jsd.scheduled_date = %s
        WHERE wo.status NOT IN ('completed', 'cancelled', 'invoiced', 'paid')
          AND (wo.job_type = 'Service Call' OR wo.emergency_call = TRUE)
          AND (wo.scheduled_date <= %s OR wo.start_date <= %s OR jsd.scheduled_date = %s)
        ORDER BY wo.id, CASE wo.priority
            WHEN 'emergency' THEN 0
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 3
            WHEN 'low' THEN 4
            ELSE 3
        END, COALESCE(wo.start_date, wo.scheduled_date) ASC
    """, (today, today, today, today))
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
