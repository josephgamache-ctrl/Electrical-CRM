"""
Schedule Management Module API Endpoints
Handles work order assignments, job schedule dates, crew management,
calendar views, employee availability, PTO requests, and schedule conflicts.
"""

import logging
from datetime import datetime, timedelta, date
from typing import Optional, List, Dict

from fastapi import APIRouter, HTTPException, status, Request
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(tags=["schedule"])

# ============================================================
# MODULE INITIALIZATION
# ============================================================

# These will be set by main.py when registering the router
_get_db_connection = None
_get_current_user_func = None
_log_and_raise = None
_notify_callout = None
_notify_pto_request_submitted = None
_notify_pto_request_approved = None
_notify_pto_request_denied = None


def init_schedule_module(
    db_func,
    auth_func,
    log_raise_func,
    notify_callout_func=None,
    notify_pto_submitted_func=None,
    notify_pto_approved_func=None,
    notify_pto_denied_func=None
):
    """Initialize the module with dependencies from main.py"""
    global _get_db_connection, _get_current_user_func, _log_and_raise
    global _notify_callout, _notify_pto_request_submitted
    global _notify_pto_request_approved, _notify_pto_request_denied

    _get_db_connection = db_func
    _get_current_user_func = auth_func
    _log_and_raise = log_raise_func
    _notify_callout = notify_callout_func
    _notify_pto_request_submitted = notify_pto_submitted_func
    _notify_pto_request_approved = notify_pto_approved_func
    _notify_pto_request_denied = notify_pto_denied_func


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


class ScheduleCrewAssign(BaseModel):
    employee_username: str
    role: Optional[str] = 'technician'
    is_lead_for_day: Optional[bool] = False
    scheduled_hours: Optional[float] = 8.0


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


class EmployeeAvailabilityCreate(BaseModel):
    employee_username: str
    start_date: date
    end_date: date
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    availability_type: str  # available, unavailable, vacation, sick, training, on_call
    reason: Optional[str] = None


class ConflictCheckRequest(BaseModel):
    dates: List[date]
    start_time: str = "07:00"
    end_time: str = "15:30"
    except_work_order_id: Optional[int] = None


class ClearConflictsRequest(BaseModel):
    dates: List[date]
    start_time: str = "07:00"
    end_time: str = "15:30"
    except_work_order_id: Optional[int] = None  # Don't clear this job


class EmployeeCallOutRequest(BaseModel):
    start_date: date
    end_date: date
    availability_type: str = "sick"  # sick, personal, emergency, other
    reason: Optional[str] = None
    remove_from_schedule: bool = True  # Whether to remove from scheduled jobs


class PTORequest(BaseModel):
    start_date: date
    end_date: date
    availability_type: str = "vacation"  # vacation, personal, other
    reason: Optional[str] = None


class PTOApprovalRequest(BaseModel):
    approved: bool
    admin_notes: Optional[str] = None
    remove_from_schedule: bool = True


# ============================================================
# WORK ORDER ASSIGNMENTS (Multi-Worker Support)
# ============================================================

@router.get("/work-orders/{work_order_id}/assignments")
async def get_work_order_assignments(
    work_order_id: int,
    request: Request
):
    """Get all worker assignments for a work order"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


@router.post("/work-orders/{work_order_id}/assignments")
async def add_work_order_assignment(
    work_order_id: int,
    assignment: WorkOrderAssignmentCreate,
    request: Request
):
    """Add a worker to a work order"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


@router.post("/work-orders/{work_order_id}/assignments/bulk")
async def bulk_assign_workers(
    work_order_id: int,
    bulk: BulkAssignmentCreate,
    request: Request
):
    """Assign multiple workers to a work order at once"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


@router.delete("/work-orders/{work_order_id}/assignments/{employee_username}")
async def remove_work_order_assignment(
    work_order_id: int,
    employee_username: str,
    request: Request
):
    """Remove a worker from a work order"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


# ============================================================
# JOB SCHEDULE DATES (Multi-Date Support)
# ============================================================

@router.get("/work-orders/{work_order_id}/schedule-dates")
async def get_job_schedule_dates(
    work_order_id: int,
    request: Request
):
    """Get all scheduled dates for a work order"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


@router.post("/work-orders/{work_order_id}/schedule-dates")
async def add_job_schedule_date(
    work_order_id: int,
    schedule_date: JobScheduleDateCreate,
    request: Request
):
    """Add a scheduled date to a work order"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


@router.post("/work-orders/{work_order_id}/schedule-dates/bulk")
async def bulk_add_schedule_dates(
    work_order_id: int,
    bulk: BulkScheduleDatesCreate,
    request: Request
):
    """Add multiple scheduled dates to a work order at once"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


@router.delete("/work-orders/{work_order_id}/schedule-dates/{scheduled_date}")
async def remove_job_schedule_date(
    work_order_id: int,
    scheduled_date: date,
    request: Request
):
    """Remove a scheduled date from a work order"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


# ============================================================
# JOB SCHEDULE CREW (Per-Date Crew Assignment)
# ============================================================

@router.post("/schedule-dates/{schedule_date_id}/crew")
async def assign_crew_to_date(
    schedule_date_id: int,
    crew: ScheduleCrewAssign,
    request: Request
):
    """Assign a worker to a specific scheduled date"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


@router.delete("/schedule-dates/{schedule_date_id}/crew/{employee_username}")
async def remove_crew_from_date(
    schedule_date_id: int,
    employee_username: str,
    request: Request
):
    """Remove a worker from a specific scheduled date"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


# ============================================================
# CREW SYNC - Unified Crew Management Endpoint
# ============================================================

@router.patch("/work-orders/{work_order_id}/crew")
async def sync_work_order_crew(
    work_order_id: int,
    crew_request: CrewSyncRequest,
    request: Request
):
    """
    Unified crew management endpoint for work orders.

    This endpoint:
    1. Updates work_order_assignments (the roster of who CAN work on this job)
    2. Optionally syncs to job_schedule_dates and job_schedule_crew tables
    3. Updates crew_size on the work order

    The assigned_to field is NOT automatically updated - that remains under manual control.
    """
    current_user = await get_current_user_from_request(request)

    if crew_request.action not in ['set', 'add', 'remove']:
        raise HTTPException(status_code=400, detail="Action must be 'set', 'add', or 'remove'")

    if not crew_request.employees and crew_request.action != 'set':
        raise HTTPException(status_code=400, detail="Employees list required for add/remove actions")

    conn = get_db()
    cur = conn.cursor()

    try:
        # Verify work order exists and get current status
        cur.execute("SELECT id, scheduled_date, status FROM work_orders WHERE id = %s", (work_order_id,))
        work_order = cur.fetchone()
        if not work_order:
            raise HTTPException(status_code=404, detail="Work order not found")

        # Validate all employees exist
        if crew_request.employees:
            placeholders = ','.join(['%s'] * len(crew_request.employees))
            cur.execute(f"SELECT username, hourly_rate FROM users WHERE username IN ({placeholders})",
                       tuple(crew_request.employees))
            found_users = {row['username']: row['hourly_rate'] for row in cur.fetchall()}
            missing = set(crew_request.employees) - set(found_users.keys())
            if missing:
                raise HTTPException(status_code=404, detail=f"Users not found: {', '.join(missing)}")
        else:
            found_users = {}

        results = {
            "work_order_id": work_order_id,
            "action": crew_request.action,
            "assignments_updated": 0,
            "schedule_dates_created": 0,
            "crew_entries_created": 0
        }

        # ============================================================
        # STEP 1: Update work_order_assignments
        # ============================================================

        if crew_request.action == 'set':
            # Remove all existing assignments
            cur.execute("DELETE FROM work_order_assignments WHERE work_order_id = %s", (work_order_id,))

            # Add new assignments
            for username in crew_request.employees:
                is_lead = (username == crew_request.lead_username)
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

        elif crew_request.action == 'add':
            for username in crew_request.employees:
                is_lead = (username == crew_request.lead_username)
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

        elif crew_request.action == 'remove':
            for username in crew_request.employees:
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

        if crew_request.sync_to_dates:
            # Determine which dates to sync
            target_dates = crew_request.dates

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
                    if crew_request.start_time and crew_request.end_time:
                        cur.execute("""
                            INSERT INTO job_schedule_dates (work_order_id, scheduled_date, start_time, end_time)
                            VALUES (%s, %s, %s, %s)
                            ON CONFLICT (work_order_id, scheduled_date) DO UPDATE SET
                                start_time = EXCLUDED.start_time,
                                end_time = EXCLUDED.end_time
                            RETURNING id
                        """, (work_order_id, sched_date, crew_request.start_time, crew_request.end_time))
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
                    if crew_request.action == 'set':
                        # Remove all crew for this date
                        cur.execute("""
                            DELETE FROM job_schedule_crew WHERE job_schedule_date_id = %s
                        """, (schedule_date_id,))

                        # Add new crew
                        for username in crew_request.employees:
                            is_lead = (username == crew_request.lead_username)
                            # Get scheduled hours for this employee (default to 8.0)
                            emp_hours = 8.0
                            if crew_request.employee_hours and username in crew_request.employee_hours:
                                emp_hours = crew_request.employee_hours[username]
                            cur.execute("""
                                INSERT INTO job_schedule_crew (
                                    job_schedule_date_id, employee_username, role, is_lead_for_day, scheduled_hours
                                ) VALUES (%s, %s, %s, %s, %s)
                            """, (schedule_date_id, username,
                                  'lead' if is_lead else 'technician', is_lead, emp_hours))
                            results["crew_entries_created"] += 1

                    elif crew_request.action == 'add':
                        for username in crew_request.employees:
                            is_lead = (username == crew_request.lead_username)
                            if is_lead:
                                cur.execute("""
                                    UPDATE job_schedule_crew SET is_lead_for_day = FALSE
                                    WHERE job_schedule_date_id = %s AND is_lead_for_day = TRUE
                                """, (schedule_date_id,))

                            # Get scheduled hours for this employee (default to 8.0)
                            emp_hours = 8.0
                            if crew_request.employee_hours and username in crew_request.employee_hours:
                                emp_hours = crew_request.employee_hours[username]
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

                    elif crew_request.action == 'remove':
                        for username in crew_request.employees:
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
        _log_and_raise(e)


@router.get("/work-orders/{work_order_id}/crew")
async def get_work_order_crew(
    work_order_id: int,
    include_schedule: bool = True,
    request: Request = None
):
    """
    Get the complete crew information for a work order.

    Returns:
    - assignments: the roster from work_order_assignments
    - schedule_dates: if include_schedule=True, includes per-date crew info
    """
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


# ============================================================
# JOB TEMPLATES
# ============================================================

@router.get("/job-templates")
async def get_job_templates(
    request: Request,
    limit: int = 100,
    offset: int = 0,
    search: Optional[str] = None,
    category: Optional[str] = None
):
    """Get all job templates with pagination"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


@router.get("/job-templates/{template_id}")
async def get_job_template(
    template_id: int,
    request: Request
):
    """Get a specific job template"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


# ============================================================
# EMPLOYEE AVAILABILITY
# ============================================================

@router.get("/employees/{username}/availability")
async def get_employee_availability(
    username: str,
    request: Request,
    start_date: date = None,
    end_date: date = None
):
    """Get employee availability for a date range"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


@router.post("/employees/{username}/availability")
async def set_employee_availability(
    username: str,
    availability: EmployeeAvailabilityCreate,
    request: Request
):
    """Set employee availability"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


# ============================================================
# CALENDAR VIEW ENDPOINTS
# ============================================================

@router.get("/calendar/schedule")
async def get_calendar_schedule(
    start_date: date,
    end_date: date,
    request: Request,
    employee_username: str = None
):
    """Get calendar schedule view with jobs and crew for a date range"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


@router.get("/calendar/employee/{username}")
async def get_employee_calendar(
    username: str,
    start_date: date,
    end_date: date,
    request: Request
):
    """Get a specific employee's schedule for a date range"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
              AND wo.status NOT IN ('canceled', 'invoiced', 'paid')
            ORDER BY jsd.scheduled_date, jsd.start_time
        """, (username, start_date, end_date))
        jobs = cur.fetchall()

        # Get availability
        cur.execute("""
            SELECT *
            FROM employee_availability
            WHERE employee_username = %s
              AND start_date <= %s AND end_date >= %s
        """, (username, end_date, start_date))
        availability = cur.fetchall()

        cur.close()
        conn.close()

        return {
            "employee_username": username,
            "jobs": jobs,
            "availability": availability
        }

    except Exception as e:
        cur.close()
        conn.close()
        _log_and_raise(e)


# ============================================================
# SCHEDULE CONFLICT DETECTION
# ============================================================

@router.post("/employees/{username}/schedule-conflicts")
async def check_schedule_conflicts(
    username: str,
    conflict_request: ConflictCheckRequest,
    request: Request
):
    """
    Check if an employee has scheduling conflicts on given dates/times.
    Returns list of conflicting jobs with their time slots.
    Also checks for approved PTO/unavailability that would prevent scheduling.
    15-minute granularity is used for conflict detection.
    """
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    try:
        conflicts = []
        unavailability_conflicts = []

        for check_date in conflict_request.dates:
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
                        "proposed_start_time": conflict_request.start_time,
                        "proposed_end_time": conflict_request.end_time,
                        "availability_id": unavail['id']
                    })
                else:
                    # Time-specific unavailability - check for overlap
                    unavail_start = unavail['start_time']
                    unavail_end = unavail['end_time']

                    # Parse proposed time slot
                    start_time_str = conflict_request.start_time[:5] if len(conflict_request.start_time) > 5 else conflict_request.start_time
                    end_time_str = conflict_request.end_time[:5] if len(conflict_request.end_time) > 5 else conflict_request.end_time
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
                            "proposed_start_time": conflict_request.start_time,
                            "proposed_end_time": conflict_request.end_time,
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

            if conflict_request.except_work_order_id:
                query += " AND jsd.work_order_id != %s"
                params.append(conflict_request.except_work_order_id)

            cur.execute(query, params)
            existing_jobs = cur.fetchall()

            # Parse proposed time slot (handle both HH:MM and HH:MM:SS formats)
            start_time_str = conflict_request.start_time[:5] if len(conflict_request.start_time) > 5 else conflict_request.start_time
            end_time_str = conflict_request.end_time[:5] if len(conflict_request.end_time) > 5 else conflict_request.end_time
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
                        "conflict_type": "job_overlap",
                        "work_order_id": job['work_order_id'],
                        "work_order_number": job['work_order_number'],
                        "job_description": job['job_description'],
                        "customer_name": job['customer_name'],
                        "existing_start_time": str(exist_start),
                        "existing_end_time": str(exist_end),
                        "proposed_start_time": conflict_request.start_time,
                        "proposed_end_time": conflict_request.end_time,
                        "overlap_minutes": overlap_minutes
                    })

        cur.close()
        conn.close()

        return {
            "employee_username": username,
            "has_conflicts": len(conflicts) > 0 or len(unavailability_conflicts) > 0,
            "job_conflicts": conflicts,
            "unavailability_conflicts": unavailability_conflicts,
            "total_conflicts": len(conflicts) + len(unavailability_conflicts)
        }

    except Exception as e:
        cur.close()
        conn.close()
        _log_and_raise(e)


@router.post("/employees/{username}/clear-schedule-conflicts")
async def clear_schedule_conflicts(
    username: str,
    clear_request: ClearConflictsRequest,
    request: Request
):
    """
    Clear conflicting schedule entries for an employee.
    This modifies existing job schedules to free up the requested time slot.
    Only the overlapping hours are removed/adjusted.
    """
    current_user = await get_current_user_from_request(request)

    if current_user.get('role') not in ['admin', 'manager']:
        raise HTTPException(status_code=403, detail="Only admins/managers can clear schedule conflicts")

    conn = get_db()
    cur = conn.cursor()

    try:
        cleared_entries = []

        for clear_date in clear_request.dates:
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

            if clear_request.except_work_order_id:
                query += " AND jsd.work_order_id != %s"
                params.append(clear_request.except_work_order_id)

            cur.execute(query, params)
            existing_jobs = cur.fetchall()

            # Parse proposed time slot (handle both HH:MM and HH:MM:SS formats)
            start_time_str = clear_request.start_time[:5] if len(clear_request.start_time) > 5 else clear_request.start_time
            end_time_str = clear_request.end_time[:5] if len(clear_request.end_time) > 5 else clear_request.end_time
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
        _log_and_raise(e)


# ============================================================
# EMPLOYEE CALL-OUT AND UNAVAILABILITY
# ============================================================

@router.post("/employees/{username}/call-out")
async def employee_call_out(
    username: str,
    callout_request: EmployeeCallOutRequest,
    request: Request
):
    """
    Mark an employee as called out (sick, emergency, etc.) and optionally
    remove them from scheduled jobs for that period.
    Returns the list of affected jobs that need reassignment.
    """
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    try:
        # Verify employee exists
        cur.execute("SELECT username, full_name FROM users WHERE username = %s", (username,))
        employee = cur.fetchone()
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")

        # Permission check:
        # - Admins can call out anyone
        # - Managers can call out their assigned workers or themselves
        # - Regular users can only call out themselves
        user_role = current_user.get('role')
        if user_role != 'admin':
            if username != current_user['username']:
                if user_role == 'manager':
                    # Check if this worker is assigned to this manager
                    cur.execute("""
                        SELECT 1 FROM manager_workers
                        WHERE manager_username = %s AND worker_username = %s AND active = true
                    """, (current_user['username'], username))
                    if not cur.fetchone():
                        raise HTTPException(
                            status_code=403,
                            detail="You can only mark your assigned workers as unavailable"
                        )
                else:
                    raise HTTPException(
                        status_code=403,
                        detail="You can only mark yourself as unavailable"
                    )

        # Create unavailability record
        cur.execute("""
            INSERT INTO employee_availability (
                employee_username, start_date, end_date,
                availability_type, reason, approved, approved_by
            ) VALUES (%s, %s, %s, %s, %s, TRUE, %s)
            RETURNING id
        """, (
            username,
            callout_request.start_date,
            callout_request.end_date,
            callout_request.availability_type,
            callout_request.reason,
            current_user['username']
        ))
        availability_id = cur.fetchone()['id']

        affected_jobs = []

        if callout_request.remove_from_schedule:
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
            """, (username, username, callout_request.start_date, callout_request.end_date))

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
            """, (username, callout_request.start_date, callout_request.end_date))

        conn.commit()

        # Send email notification to admins/managers about the call-out
        if _notify_callout:
            try:
                callout_info = {
                    'full_name': employee['full_name'],
                    'date': f"{callout_request.start_date}" if callout_request.start_date == callout_request.end_date else f"{callout_request.start_date} to {callout_request.end_date}",
                    'type': callout_request.availability_type.capitalize(),
                    'reason': callout_request.reason or 'Not specified'
                }
                _notify_callout(conn, callout_info, username)
            except Exception as notif_error:
                # Don't fail the request if notification fails
                print(f"Warning: Failed to send call-out notification: {notif_error}")

        # Notify managers who have this worker assigned
        try:
            from notification_service import notify_worker_managers
            date_str = f"{callout_request.start_date}" if callout_request.start_date == callout_request.end_date else f"{callout_request.start_date} to {callout_request.end_date}"
            notify_worker_managers(
                conn=conn,
                worker_username=username,
                notification_type='worker_callout',
                title=f"{employee['full_name']} called out",
                message=f"{employee['full_name']} is unavailable ({callout_request.availability_type}) on {date_str}. {len(affected_jobs)} job(s) affected.",
                severity='warning',
                action_url='/schedule'
            )
        except Exception as manager_notif_error:
            logger.warning(f"Failed to notify worker's managers: {manager_notif_error}")

        cur.close()
        conn.close()

        return {
            "success": True,
            "availability_id": availability_id,
            "employee_username": username,
            "employee_name": employee['full_name'],
            "unavailable_from": str(callout_request.start_date),
            "unavailable_to": str(callout_request.end_date),
            "availability_type": callout_request.availability_type,
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
        _log_and_raise(e)


@router.get("/employees/unavailable-today")
async def get_employees_unavailable_today(
    request: Request
):
    """Get list of employees who are marked unavailable for today"""
    current_user = await get_current_user_from_request(request)
    today = date.today()
    conn = get_db()
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
        _log_and_raise(e)


@router.get("/employees/available-for-date")
async def get_employees_available_for_date(
    target_date: date,
    request: Request,
    start_time: str = "07:00",
    end_time: str = "15:30"
):
    """
    Get list of employees who are available on a specific date/time.
    Useful for finding replacement workers when someone calls out.
    """
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


# ============================================================
# PTO REQUEST AND APPROVAL SYSTEM
# ============================================================

@router.post("/employees/{username}/request-pto")
async def request_pto(
    username: str,
    pto_request: PTORequest,
    request: Request
):
    """
    Employee submits a PTO request that requires admin approval.
    Unlike call-out which is immediate (sick/emergency), PTO requires approval
    before it takes effect on the schedule.
    """
    current_user = await get_current_user_from_request(request)

    # Only the employee themselves or admin/manager can request on their behalf
    if current_user['username'] != username and current_user.get('role') not in ['admin', 'manager']:
        raise HTTPException(status_code=403, detail="Not authorized to request PTO for this employee")

    conn = get_db()
    cur = conn.cursor()

    try:
        # Verify employee exists
        cur.execute("SELECT username, full_name FROM users WHERE username = %s", (username,))
        employee = cur.fetchone()
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")

        # Create PTO request (approved=FALSE, needs admin approval)
        cur.execute("""
            INSERT INTO employee_availability (
                employee_username, start_date, end_date,
                availability_type, reason, approved, notes
            ) VALUES (%s, %s, %s, %s, %s, FALSE, %s)
            RETURNING id
        """, (
            username,
            pto_request.start_date,
            pto_request.end_date,
            pto_request.availability_type,
            pto_request.reason,
            f"Requested by {current_user['username']}"
        ))
        pto_id = cur.fetchone()['id']

        conn.commit()

        # Send notification to admins/managers about the PTO request
        if _notify_pto_request_submitted:
            try:
                pto_data = {
                    'id': pto_id,
                    'username': username,
                    'full_name': employee['full_name'],
                    'pto_type': pto_request.availability_type,
                    'date_display': f"{pto_request.start_date} to {pto_request.end_date}",
                    'reason': pto_request.reason or 'Not specified'
                }
                _notify_pto_request_submitted(conn, pto_data, current_user['username'])
            except Exception as notif_error:
                print(f"Warning: Failed to send PTO notification: {notif_error}")

        cur.close()
        conn.close()

        return {
            "success": True,
            "pto_id": pto_id,
            "employee_username": username,
            "employee_name": employee['full_name'],
            "start_date": str(pto_request.start_date),
            "end_date": str(pto_request.end_date),
            "availability_type": pto_request.availability_type,
            "status": "pending_approval",
            "message": "PTO request submitted. Awaiting admin approval."
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        _log_and_raise(e)


@router.get("/pto/pending")
async def get_pending_pto_requests(
    request: Request
):
    """Get all pending PTO requests (admin/manager only)"""
    current_user = await get_current_user_from_request(request)

    if current_user.get('role') not in ['admin', 'manager']:
        raise HTTPException(status_code=403, detail="Admin or manager access required")

    conn = get_db()
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
                ea.notes,
                ea.created_at,
                (ea.end_date - ea.start_date + 1) as days_requested
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
        _log_and_raise(e)


@router.patch("/pto/{pto_id}/approve")
async def approve_or_deny_pto(
    pto_id: int,
    approval: PTOApprovalRequest,
    request: Request
):
    """Approve or deny a PTO request (admin/manager only)"""
    current_user = await get_current_user_from_request(request)

    if current_user.get('role') not in ['admin', 'manager']:
        raise HTTPException(status_code=403, detail="Admin or manager access required")

    conn = get_db()
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

        if approval.approved:
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
                approval.admin_notes or f"Approved by {current_user['username']}",
                pto_id
            ))

            # If remove_from_schedule is True, remove employee from scheduled jobs
            if approval.remove_from_schedule:
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
                f"DENIED: {approval.admin_notes or 'Request denied by ' + current_user['username']}",
                current_user['username'],
                pto_id
            ))
            # Delete the denied PTO request so it doesn't block scheduling
            cur.execute("DELETE FROM employee_availability WHERE id = %s", (pto_id,))
            status_msg = "denied"

        conn.commit()

        # Send email notification to employee about the decision
        if approval.approved and _notify_pto_request_approved:
            try:
                pto_data = {
                    'id': pto_id,
                    'username': pto['employee_username'],
                    'full_name': pto['employee_name'],
                    'pto_type': pto['availability_type'],
                    'date_display': f"{pto['start_date']} to {pto['end_date']}",
                    'hours': (pto['end_date'] - pto['start_date']).days * 8 + 8  # Rough estimate
                }
                _notify_pto_request_approved(conn, pto_data, current_user['username'])
            except Exception as notif_error:
                print(f"Warning: Failed to send PTO notification: {notif_error}")
        elif not approval.approved and _notify_pto_request_denied:
            try:
                pto_data = {
                    'id': pto_id,
                    'username': pto['employee_username'],
                    'full_name': pto['employee_name'],
                    'pto_type': pto['availability_type'],
                    'date_display': f"{pto['start_date']} to {pto['end_date']}",
                    'hours': (pto['end_date'] - pto['start_date']).days * 8 + 8
                }
                _notify_pto_request_denied(conn, pto_data, current_user['username'], approval.admin_notes or '')
            except Exception as notif_error:
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
        _log_and_raise(e)


@router.get("/pto/all")
async def get_all_pto_records(
    request: Request,
    start_date: date = None,
    end_date: date = None,
    employee_username: str = None,
    include_pending: bool = True
):
    """Get all PTO records with optional filters. Admin/Manager only."""
    current_user = await get_current_user_from_request(request)

    if current_user.get('role') not in ['admin', 'manager']:
        raise HTTPException(status_code=403, detail="Admin or manager access required")

    conn = get_db()
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
        _log_and_raise(e)
