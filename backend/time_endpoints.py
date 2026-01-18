"""
Time Entry Module API Endpoints
Handles employee time tracking, timecards, and schedule contradiction detection.
"""

from fastapi import APIRouter, HTTPException, Depends, Request, status
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import date, timedelta
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Time Entries"])

# Module-level variables set by init function
_get_db_connection = None
_get_current_user_func = None
_log_and_raise = None


def init_time_module(db_func, auth_func, log_raise_func):
    """Initialize the module with database, auth, and logging functions from main.py"""
    global _get_db_connection, _get_current_user_func, _log_and_raise
    _get_db_connection = db_func
    _get_current_user_func = auth_func
    _log_and_raise = log_raise_func


def get_db():
    """Get database connection"""
    return _get_db_connection()


async def get_current_user_from_request(request: Request):
    """Extract token from request and get current user"""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    return await _get_current_user_func(token)


def require_manager_or_admin_check(user: dict):
    """Check that user has manager or admin role"""
    if user.get('role') not in ['admin', 'manager']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager or admin access required"
        )
    return user


def require_admin_check(user: dict):
    """Check that user has admin role"""
    if user.get('role') != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return user


# ============================================================
# PYDANTIC MODELS
# ============================================================

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


class SubmitWeekRequest(BaseModel):
    week_ending_date: date


# ============================================================
# TIME TRACKING ENDPOINTS
# ============================================================

@router.get("/time-entries/my-week")
async def get_my_week_timecard(
    request: Request,
    week_ending: Optional[str] = None  # Format: YYYY-MM-DD (Sunday)
):
    """Get the current user's timecard for a specific week"""
    current_user = await get_current_user_from_request(request)

    conn = get_db()
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
        _log_and_raise(e)


@router.get("/time-entries/available-jobs")
async def get_available_jobs_for_timecard(
    request: Request,
    work_date: str  # Format: YYYY-MM-DD
):
    """Get list of jobs available for time entry, prioritized by assignment and status"""
    current_user = await get_current_user_from_request(request)

    conn = get_db()
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
        _log_and_raise(e)


@router.post("/time-entries/batch")
async def create_time_entries_batch(
    request: Request,
    batch: TimeEntryBatchCreate
):
    """Create multiple time entries at once (for submitting a day's work)"""
    current_user = await get_current_user_from_request(request)

    conn = get_db()
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

            # Calculate billable and pay amounts
            billable_amount = float(hours_worked) * float(billable_rate or 0)
            pay_amount = float(hours_worked) * float(pay_rate or 0)

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
                        billable_amount,
                        pay_amount,
                        notes,
                        break_minutes,
                        time_type,
                        created_by,
                        last_modified_by
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (work_order_id, employee_username, work_date)
                    DO UPDATE SET
                        hours_worked = EXCLUDED.hours_worked,
                        billable_rate = EXCLUDED.billable_rate,
                        pay_rate = EXCLUDED.pay_rate,
                        billable_amount = EXCLUDED.billable_amount,
                        pay_amount = EXCLUDED.pay_amount,
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
                    billable_amount,
                    pay_amount,
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
                            pay_amount = %s,
                            billable_amount = %s,
                            last_modified_by = %s,
                            last_modified_at = CURRENT_TIMESTAMP
                        WHERE id = %s
                        RETURNING id, work_order_id, work_date, hours_worked, billable_amount, pay_amount, time_type
                    """, (
                        hours_worked,
                        notes,
                        break_minutes,
                        pay_rate,
                        pay_amount,
                        billable_amount,
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
                            billable_amount,
                            pay_amount,
                            notes,
                            break_minutes,
                            time_type,
                            created_by,
                            last_modified_by
                        )
                        VALUES (NULL, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id, work_order_id, work_date, hours_worked, billable_amount, pay_amount, time_type
                    """, (
                        current_user['username'],
                        batch.work_date,
                        hours_worked,
                        billable_rate,
                        pay_rate,
                        billable_amount,
                        pay_amount,
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
        _log_and_raise(e)


@router.get("/time-entries")
async def get_time_entries(
    request: Request,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    """Get time entries for the current user within a date range with pagination"""
    current_user = await get_current_user_from_request(request)

    conn = get_db()
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
        _log_and_raise(e)


@router.post("/time-entries")
async def create_time_entry(
    request: Request,
    entry: TimeEntryCreate
):
    """Create a single time entry (job or non-job time)"""
    current_user = await get_current_user_from_request(request)

    conn = get_db()
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

        # Calculate billable and pay amounts
        billable_amount = float(entry.hours_worked) * float(billable_rate or 0)
        pay_amount_calc = float(entry.hours_worked) * float(pay_rate or 0)

        # Insert time entry
        cur.execute("""
            INSERT INTO time_entries (
                work_order_id,
                employee_username,
                work_date,
                hours_worked,
                billable_rate,
                pay_rate,
                billable_amount,
                pay_amount,
                notes,
                break_minutes,
                time_type,
                created_by,
                last_modified_by
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, work_order_id, work_date, hours_worked, billable_amount, pay_amount, is_locked, time_type
        """, (
            entry.work_order_id,
            current_user['username'],
            entry.work_date,
            entry.hours_worked,
            billable_rate,
            pay_rate,
            billable_amount,
            pay_amount_calc,
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
        _log_and_raise(e)


@router.put("/time-entries/{entry_id}")
async def update_time_entry(
    request: Request,
    entry_id: int,
    entry: TimeEntryUpdate
):
    """Update an existing time entry"""
    current_user = await get_current_user_from_request(request)

    conn = get_db()
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

        # Get existing entry rates for recalculation
        cur.execute("""
            SELECT hours_worked, billable_rate, pay_rate
            FROM time_entries WHERE id = %s
        """, (entry_id,))
        current_entry = cur.fetchone()

        # Build update query dynamically
        update_fields = []
        params = []

        # Track if hours changed to recalculate amounts
        new_hours = entry.hours_worked if entry.hours_worked is not None else float(current_entry['hours_worked'])

        if entry.hours_worked is not None:
            update_fields.append("hours_worked = %s")
            params.append(entry.hours_worked)
            # Recalculate billable_amount and pay_amount
            billable_rate = float(current_entry['billable_rate'] or 0)
            pay_rate = float(current_entry['pay_rate'] or 0)
            update_fields.append("billable_amount = %s")
            params.append(new_hours * billable_rate)
            update_fields.append("pay_amount = %s")
            params.append(new_hours * pay_rate)

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
        _log_and_raise(e)


@router.delete("/time-entries/{entry_id}")
async def delete_time_entry(
    request: Request,
    entry_id: int
):
    """Delete a time entry (only if not locked)"""
    current_user = await get_current_user_from_request(request)

    conn = get_db()
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
        _log_and_raise(e)


@router.get("/time-entries/work-order/{work_order_id}")
async def get_time_entries_for_work_order(
    request: Request,
    work_order_id: int
):
    """Get all time entries for a specific work order (managers/admins only)"""
    current_user = await get_current_user_from_request(request)
    require_manager_or_admin_check(current_user)

    conn = get_db()
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
        _log_and_raise(e)


@router.post("/time-entries/lock-week")
async def lock_week_for_payroll(
    request: Request,
    week_ending: str  # Format: YYYY-MM-DD (Sunday)
):
    """Lock a week's time entries for payroll processing (admin only)"""
    current_user = await get_current_user_from_request(request)
    require_admin_check(current_user)

    conn = get_db()
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
        _log_and_raise(e)


@router.post("/time-entries/submit-week")
async def submit_timecard_week(
    request: Request,
    submit_request: SubmitWeekRequest
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
    current_user = await get_current_user_from_request(request)

    conn = get_db()
    cur = conn.cursor()

    username = current_user['username']
    week_ending = submit_request.week_ending_date

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
            logger.warning(f"Could not store contradictions: {e}")

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
        _log_and_raise(e)


# ============================================================
# SCHEDULE CONTRADICTIONS ENDPOINTS
# ============================================================

@router.get("/schedule-contradictions")
async def get_schedule_contradictions(
    request: Request,
    week_ending: Optional[date] = None,
    employee_username: Optional[str] = None,
    resolved: Optional[bool] = None
):
    """Get schedule contradictions with optional filters (admin/manager only)"""
    current_user = await get_current_user_from_request(request)

    if current_user.get('role') not in ['admin', 'manager']:
        raise HTTPException(status_code=403, detail="Only admins/managers can view contradictions")

    conn = get_db()
    cur = conn.cursor()

    try:
        query = """
            SELECT
                sc.id,
                sc.employee_username,
                sc.conflict_date,
                sc.work_order_ids,
                sc.total_scheduled_hours,
                sc.resolution_status,
                sc.resolved_by,
                sc.resolved_at,
                sc.resolution_notes,
                sc.detected_at,
                u.full_name as employee_name
            FROM schedule_contradictions sc
            JOIN users u ON sc.employee_username = u.username
            WHERE 1=1
        """
        params = []

        if week_ending:
            query += " AND sc.conflict_date = %s"
            params.append(week_ending)

        if employee_username:
            query += " AND sc.employee_username = %s"
            params.append(employee_username)

        if resolved is not None:
            if resolved:
                query += " AND sc.resolution_status = 'resolved'"
            else:
                query += " AND sc.resolution_status != 'resolved'"

        query += " ORDER BY sc.detected_at DESC"

        cur.execute(query, params)
        contradictions = cur.fetchall()

        cur.close()
        conn.close()

        return {"contradictions": contradictions}

    except Exception as e:
        cur.close()
        conn.close()
        _log_and_raise(e)


@router.patch("/schedule-contradictions/{contradiction_id}/resolve")
async def resolve_contradiction(
    request: Request,
    contradiction_id: int,
    resolution_notes: Optional[str] = None
):
    """Mark a schedule contradiction as resolved (admin/manager only)"""
    current_user = await get_current_user_from_request(request)

    if current_user.get('role') not in ['admin', 'manager']:
        raise HTTPException(status_code=403, detail="Only admins/managers can resolve contradictions")

    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute("""
            UPDATE schedule_contradictions
            SET resolution_status = 'resolved',
                resolved_by = %s,
                resolved_at = CURRENT_TIMESTAMP,
                resolution_notes = COALESCE(%s, resolution_notes)
            WHERE id = %s
            RETURNING id
        """, (current_user['username'], resolution_notes, contradiction_id))

        result = cur.fetchone()
        if not result:
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
        _log_and_raise(e)
