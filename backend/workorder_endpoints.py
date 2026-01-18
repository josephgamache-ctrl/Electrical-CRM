"""
Work Order Module API Endpoints
Handles work order CRUD, materials, photos, tasks, notes, and activity.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from pathlib import Path
import logging
import uuid
import os
import re

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Work Orders"])

# Module-level variables set by init function
_get_db_connection = None
_get_current_user_func = None
_log_and_raise = None

def init_workorder_module(get_db_func, get_user_func, log_raise_func):
    """Initialize the module with functions from main.py"""
    global _get_db_connection, _get_current_user_func, _log_and_raise
    _get_db_connection = get_db_func
    _get_current_user_func = get_user_func
    _log_and_raise = log_raise_func

def get_db():
    """Get database connection"""
    return _get_db_connection()

def log_and_raise(e):
    """Log and raise error"""
    return _log_and_raise(e)

async def get_current_user_from_request(request: Request):
    """Extract token from request and get current user"""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    return await _get_current_user_func(token)

async def require_manager_or_admin_from_request(request: Request):
    """Get current user and verify they are manager or admin"""
    user = await get_current_user_from_request(request)
    if user.get('role') not in ('admin', 'manager'):
        raise HTTPException(status_code=403, detail="Manager or admin role required")
    return user


# ============================================================
# PYDANTIC MODELS
# ============================================================

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

class AllocateMaterialsRequest(BaseModel):
    material_ids: List[int]
    quantity: Optional[int] = None  # If specified, allocate this quantity for first material

class FieldAcquisitionData(BaseModel):
    material_id: int
    quantity: Optional[int] = None  # If not specified, acquires remaining needed
    cost: Optional[float] = None
    notes: Optional[str] = None

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
    external_vendor: str  # e.g., "Home Depot", "Lowes", "CED", "Graybar"
    external_receipt_number: Optional[str] = None  # Receipt/invoice number from vendor
    notes: Optional[str] = None


class CustomMaterialRequest(BaseModel):
    """Request to add a custom/special order material not in inventory.
    Used for designer fixtures, special orders, customer-supplied items, etc."""
    description: str
    quantity: int
    unit_cost: float
    unit_price: float
    vendor: Optional[str] = None  # Where it will be ordered from
    manufacturer: Optional[str] = None  # Brand/manufacturer
    model_number: Optional[str] = None  # Part/model number
    notes: Optional[str] = None
    needs_ordering: bool = True  # Flag for purchasing to order this item
    customer_provided: bool = False  # True if customer is providing this item (no cost to job)

class WorkOrderNote(BaseModel):
    note: str


class DelayJobRequest(BaseModel):
    """Request to delay a job - either for a date range or indefinitely"""
    delay_start_date: Optional[date] = None  # Defaults to today if not specified
    delay_end_date: Optional[date] = None    # NULL = indefinite delay
    delay_reason: Optional[str] = None


class UndelayJobRequest(BaseModel):
    """Request to remove delay from a job"""
    clear_delay_history: bool = False  # If true, clears delay_reason too


class MaterialDisposition(BaseModel):
    """Disposition of a single material when completing a job"""
    material_id: int
    quantity_used: int
    leftover_qty: int = 0
    leftover_destination: Optional[str] = None  # 'van' or 'warehouse'
    leftover_van_id: Optional[int] = None
    notes: Optional[str] = None


class ReconcileMaterialsRequest(BaseModel):
    """Request to reconcile all materials when completing a job"""
    materials: List[MaterialDisposition]


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def auto_update_work_order_status(conn, work_order_id: int, current_status: str, scheduled_date, username: str = "system") -> str:
    """
    Automatically update work order status based on scheduled_date.

    Rules:
    - If status is 'scheduled' and scheduled_date <= today -> change to 'in_progress'
    - Returns the (potentially updated) status

    This function does NOT change statuses that are already: in_progress, completed, cancelled, delayed
    """
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


# ============================================================
# WORK ORDER CRUD ENDPOINTS
# ============================================================

@router.get("/work-orders/managers")
async def get_available_managers(request: Request = None):
    """Get list of managers available for job assignment"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT username, full_name
            FROM users
            WHERE role = 'manager' AND active = true
            ORDER BY full_name
        """)
        managers = [dict(row) for row in cur.fetchall()]
        cur.close()
        conn.close()
        return managers
    except Exception as e:
        cur.close()
        conn.close()
        log_and_raise(e)


@router.get("/work-orders")
async def get_work_orders(
    status: str = None,
    assigned_to: str = None,
    assigned_manager: str = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    request: Request = None
):
    """Get all work orders with optional filtering and pagination"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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

    if assigned_manager:
        base_query += " AND wo.assigned_manager = %s"
        params.append(assigned_manager)

    # For managers: filter to show only jobs assigned to them OR with their workers on crew
    user_role = current_user.get('role')
    if user_role == 'manager':
        manager_username = current_user['username']
        base_query += """ AND (
            wo.assigned_manager = %s
            OR EXISTS (
                SELECT 1 FROM job_schedule_crew jsc
                JOIN job_schedule_dates jsd ON jsc.job_schedule_date_id = jsd.id
                JOIN manager_workers mw ON jsc.employee_username = mw.worker_username
                WHERE jsd.work_order_id = wo.id
                AND mw.manager_username = %s
                AND mw.active = true
            )
        )"""
        params.extend([manager_username, manager_username])

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


@router.get("/work-orders/{work_order_id}")
async def get_work_order(
    work_order_id: int,
    request: Request = None
):
    """Get detailed work order information including materials"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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

    # Get materials for this work order (including custom materials with no inventory_id)
    cur.execute("""
        SELECT
            jm.*,
            COALESCE(i.item_id, 'CUSTOM') as item_id,
            COALESCE(i.brand, jm.custom_manufacturer) as brand,
            COALESCE(i.description, jm.custom_description) as description,
            COALESCE(i.category, 'Custom/Special Order') as category,
            i.subcategory,
            COALESCE(i.qty, 0) as warehouse_qty,
            COALESCE(i.qty_available, 0) as available_qty,
            COALESCE(i.location, 'N/A') as location,
            i.qty_per,
            CASE WHEN jm.inventory_id IS NULL THEN true ELSE false END as is_custom,
            jm.custom_description,
            jm.custom_vendor,
            jm.custom_manufacturer,
            jm.custom_model_number,
            jm.needs_ordering,
            COALESCE(jm.customer_provided, false) as customer_provided
        FROM job_materials_used jm
        LEFT JOIN inventory i ON jm.inventory_id = i.id
        WHERE jm.work_order_id = %s
        ORDER BY COALESCE(i.category, 'ZZZ'), COALESCE(i.item_id, jm.custom_description)
    """, (work_order_id,))
    materials = cur.fetchall()

    cur.close()
    conn.close()

    work_order['materials'] = materials
    return work_order


@router.delete("/work-orders/{work_order_id}")
async def delete_work_order(
    work_order_id: int,
    request: Request = None
):
    """Delete a work order and all related data (admin only)"""
    current_user = await get_current_user_from_request(request)
    # Only admins can delete work orders
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Only administrators can delete work orders")

    conn = get_db()
    cur = conn.cursor()

    try:
        # Check if work order exists
        cur.execute("SELECT id, work_order_number FROM work_orders WHERE id = %s", (work_order_id,))
        work_order = cur.fetchone()
        if not work_order:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Work order not found")

        wo_number = work_order['work_order_number']

        # Delete related data in correct order (foreign key dependencies)
        cur.execute("DELETE FROM time_entries WHERE work_order_id = %s", (work_order_id,))
        cur.execute("""
            DELETE FROM job_schedule_crew
            WHERE job_schedule_date_id IN (
                SELECT id FROM job_schedule_dates WHERE work_order_id = %s
            )
        """, (work_order_id,))
        cur.execute("DELETE FROM job_schedule_dates WHERE work_order_id = %s", (work_order_id,))
        cur.execute("DELETE FROM work_order_assignments WHERE work_order_id = %s", (work_order_id,))
        cur.execute("DELETE FROM job_materials_used WHERE work_order_id = %s", (work_order_id,))
        cur.execute("DELETE FROM work_order_tasks WHERE work_order_id = %s", (work_order_id,))
        cur.execute("DELETE FROM work_order_notes WHERE work_order_id = %s", (work_order_id,))
        cur.execute("DELETE FROM work_order_photos WHERE work_order_id = %s", (work_order_id,))
        cur.execute("DELETE FROM activity_log WHERE work_order_id = %s", (work_order_id,))
        cur.execute("DELETE FROM schedule_contradictions WHERE %s = ANY(work_order_ids)", (work_order_id,))
        cur.execute("DELETE FROM work_orders WHERE id = %s", (work_order_id,))

        conn.commit()
        cur.close()
        conn.close()

        return {"success": True, "message": f"Work order {wo_number} deleted successfully"}

    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=f"Failed to delete work order: {str(e)}")


@router.patch("/work-orders/{work_order_id}/status")
async def update_work_order_status(
    work_order_id: int,
    status_data: dict,
    request: Request = None
):
    """Update work order status - accessible to all roles"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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

        # For 'delayed' status, redirect to the dedicated delay endpoint
        # The /delay endpoint handles date ranges and proper crew removal
        if new_status == 'delayed':
            cur.close()
            conn.close()
            raise HTTPException(
                status_code=400,
                detail="Use POST /work-orders/{id}/delay endpoint to delay a job. This allows specifying date range or indefinite delay."
            )

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

        return {
            "success": True,
            "work_order": dict(updated_work_order),
            "message": f"Status updated to {new_status}"
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@router.post("/work-orders/{work_order_id}/delay")
async def delay_work_order(
    work_order_id: int,
    delay_data: DelayJobRequest,
    request: Request = None
):
    """
    Delay a work order - either for a specific date range or indefinitely.

    - Date range delay: Only removes crew from dates within the range
    - Indefinite delay (delay_end_date=NULL): Removes ALL crew from future dates

    In both cases, job_schedule_dates records are preserved (dates remembered).
    """
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    try:
        # Check if work order exists and get current state
        cur.execute("""
            SELECT id, status, work_order_number, delay_start_date
            FROM work_orders WHERE id = %s
        """, (work_order_id,))
        work_order = cur.fetchone()

        if not work_order:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Work order not found")

        # Set delay start date (defaults to today)
        delay_start = delay_data.delay_start_date or date.today()
        delay_end = delay_data.delay_end_date
        is_indefinite = delay_end is None

        # Track removed crew for response
        employees_removed = []
        crew_entries_removed = 0

        if is_indefinite:
            # Indefinite delay: Remove ALL crew from ALL future dates
            # First, get list of employees being removed
            cur.execute("""
                SELECT DISTINCT jsc.employee_username, u.full_name
                FROM job_schedule_crew jsc
                JOIN job_schedule_dates jsd ON jsc.job_schedule_date_id = jsd.id
                JOIN users u ON jsc.employee_username = u.username
                WHERE jsd.work_order_id = %s
                  AND jsd.scheduled_date >= CURRENT_DATE
            """, (work_order_id,))
            employees_removed = [{'username': row['employee_username'], 'full_name': row['full_name']} for row in cur.fetchall()]

            # Delete crew from all future dates (but keep schedule_dates records)
            cur.execute("""
                DELETE FROM job_schedule_crew
                WHERE job_schedule_date_id IN (
                    SELECT id FROM job_schedule_dates
                    WHERE work_order_id = %s AND scheduled_date >= CURRENT_DATE
                )
            """, (work_order_id,))
            crew_entries_removed = cur.rowcount

        else:
            # Date range delay: Only remove crew from dates within the range
            cur.execute("""
                SELECT DISTINCT jsc.employee_username, u.full_name
                FROM job_schedule_crew jsc
                JOIN job_schedule_dates jsd ON jsc.job_schedule_date_id = jsd.id
                JOIN users u ON jsc.employee_username = u.username
                WHERE jsd.work_order_id = %s
                  AND jsd.scheduled_date >= %s
                  AND jsd.scheduled_date <= %s
            """, (work_order_id, delay_start, delay_end))
            employees_removed = [{'username': row['employee_username'], 'full_name': row['full_name']} for row in cur.fetchall()]

            # Delete crew only from the specified date range
            cur.execute("""
                DELETE FROM job_schedule_crew
                WHERE job_schedule_date_id IN (
                    SELECT id FROM job_schedule_dates
                    WHERE work_order_id = %s
                      AND scheduled_date >= %s
                      AND scheduled_date <= %s
                )
            """, (work_order_id, delay_start, delay_end))
            crew_entries_removed = cur.rowcount

        # Update work order with delay info
        cur.execute("""
            UPDATE work_orders
            SET status = 'delayed',
                delay_start_date = %s,
                delay_end_date = %s,
                delay_reason = %s,
                delayed_by = %s,
                delayed_at = CURRENT_TIMESTAMP,
                last_updated = CURRENT_TIMESTAMP,
                last_updated_by = %s
            WHERE id = %s
            RETURNING *
        """, (
            delay_start,
            delay_end,
            delay_data.delay_reason,
            current_user['username'],
            current_user['username'],
            work_order_id
        ))
        updated_work_order = cur.fetchone()

        # Log activity
        if is_indefinite:
            description = f"Job delayed indefinitely starting {delay_start}"
        else:
            description = f"Job delayed from {delay_start} to {delay_end}"

        if delay_data.delay_reason:
            description += f". Reason: {delay_data.delay_reason}"

        if employees_removed:
            employee_names = ', '.join([e['full_name'] for e in employees_removed])
            description += f". Removed {len(employees_removed)} employee(s) from {crew_entries_removed} schedule entries: {employee_names}"

        cur.execute("""
            INSERT INTO work_order_activity
            (work_order_id, activity_type, description, performed_by, created_at)
            VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
        """, (work_order_id, 'delay', description, current_user['username']))

        conn.commit()
        cur.close()
        conn.close()

        return {
            "success": True,
            "work_order": dict(updated_work_order),
            "message": f"Job delayed {'indefinitely' if is_indefinite else f'until {delay_end}'}",
            "delay_type": "indefinite" if is_indefinite else "date_range",
            "delay_start_date": str(delay_start),
            "delay_end_date": str(delay_end) if delay_end else None,
            "employees_removed": employees_removed,
            "crew_entries_removed": crew_entries_removed
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@router.post("/work-orders/{work_order_id}/undelay")
async def undelay_work_order(
    work_order_id: int,
    undelay_data: UndelayJobRequest = None,
    request: Request = None
):
    """
    Remove delay from a work order, returning it to normal scheduling.

    The job will show up as 'unassigned' in dispatch if it has start_date
    and no crew assigned for upcoming dates.
    """
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    try:
        # Check if work order exists
        cur.execute("""
            SELECT id, status, work_order_number, delay_start_date, delay_end_date, delay_reason
            FROM work_orders WHERE id = %s
        """, (work_order_id,))
        work_order = cur.fetchone()

        if not work_order:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Work order not found")

        if work_order['delay_start_date'] is None:
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail="Work order is not currently delayed")

        # Determine what status to return to
        # Check if the job has crew scheduled for future dates
        cur.execute("""
            SELECT COUNT(*) as crew_count
            FROM job_schedule_crew jsc
            JOIN job_schedule_dates jsd ON jsc.job_schedule_date_id = jsd.id
            WHERE jsd.work_order_id = %s AND jsd.scheduled_date >= CURRENT_DATE
        """, (work_order_id,))
        crew_count = cur.fetchone()['crew_count']

        # If it has crew scheduled, set to 'scheduled', otherwise 'pending'
        # (The job will appear as unassigned in dispatch based on the new logic)
        new_status = 'scheduled' if crew_count > 0 else 'pending'

        # Clear delay fields
        clear_reason = undelay_data.clear_delay_history if undelay_data else False

        cur.execute("""
            UPDATE work_orders
            SET status = %s,
                delay_start_date = NULL,
                delay_end_date = NULL,
                delay_reason = CASE WHEN %s THEN NULL ELSE delay_reason END,
                delayed_by = CASE WHEN %s THEN NULL ELSE delayed_by END,
                delayed_at = CASE WHEN %s THEN NULL ELSE delayed_at END,
                last_updated = CURRENT_TIMESTAMP,
                last_updated_by = %s
            WHERE id = %s
            RETURNING *
        """, (
            new_status,
            clear_reason, clear_reason, clear_reason,
            current_user['username'],
            work_order_id
        ))
        updated_work_order = cur.fetchone()

        # Log activity
        description = f"Job delay removed. Status changed to '{new_status}'"
        if work_order['delay_reason']:
            description += f". Previous delay reason was: {work_order['delay_reason']}"

        cur.execute("""
            INSERT INTO work_order_activity
            (work_order_id, activity_type, description, performed_by, created_at)
            VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
        """, (work_order_id, 'undelay', description, current_user['username']))

        conn.commit()
        cur.close()
        conn.close()

        return {
            "success": True,
            "work_order": dict(updated_work_order),
            "message": f"Delay removed. Job status set to '{new_status}'",
            "new_status": new_status,
            "has_scheduled_crew": crew_count > 0
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@router.post("/work-orders")
async def create_work_order(
    work_order: dict,
    request: Request = None
):
    """Create a new work order"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    try:
        # Generate work order number using current year
        current_year = datetime.now().year
        year_prefix = f"WO-{current_year}-"

        # Get the max number for current year
        cur.execute("""
            SELECT work_order_number FROM work_orders
            WHERE work_order_number LIKE %s
            ORDER BY work_order_number DESC LIMIT 1
        """, (f"{year_prefix}%",))
        last_wo = cur.fetchone()

        if last_wo:
            last_num = int(last_wo['work_order_number'].split('-')[-1])
            new_num = f"{year_prefix}{str(last_num + 1).zfill(4)}"
        else:
            new_num = f"{year_prefix}0001"

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

        assigned_manager = work_order.get('assigned_manager') or None
        if assigned_manager == '':
            assigned_manager = None

        # Insert work order
        cur.execute("""
            INSERT INTO work_orders (
                work_order_number, customer_id, service_address,
                job_type, job_description, scope_of_work,
                scheduled_date, scheduled_start_time, estimated_duration_hours,
                assigned_to, assigned_manager, status, priority,
                quoted_labor_hours, quoted_labor_rate, quoted_labor_cost,
                quoted_material_cost, quoted_subtotal,
                created_by
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
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
            assigned_manager,
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


@router.patch("/work-orders/{work_order_id}")
async def update_work_order(
    work_order_id: int,
    work_order: dict,
    request: Request = None
):
    """Update an existing work order - requires manager or admin"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
            'service_address', 'assigned_manager'
        ]

        # Fields that are foreign keys and should be NULL instead of empty string
        fk_fields = ['assigned_to', 'helper_1', 'helper_2', 'assigned_manager']
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


# ============================================================
# MATERIAL ALLOCATION ENDPOINTS
# ============================================================

@router.post("/work-orders/{work_order_id}/allocate-materials")
async def allocate_materials(
    work_order_id: int,
    alloc_request: AllocateMaterialsRequest,
    request: Request = None
):
    """Allocate materials to a work order - reserves inventory"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    try:
        allocated = []
        insufficient_stock = []

        for idx, material_id in enumerate(alloc_request.material_ids):
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

            # For single material with quantity specified, use that quantity
            # Otherwise, allocate the full remaining amount
            if alloc_request.quantity is not None and idx == 0 and len(alloc_request.material_ids) == 1:
                qty_to_allocate = min(
                    alloc_request.quantity,
                    material['quantity_needed'] - material['quantity_allocated'],
                    material['qty_available']
                )
            else:
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


@router.post("/work-orders/{work_order_id}/field-acquisition")
async def mark_field_acquisition(
    work_order_id: int,
    data: FieldAcquisitionData,
    request: Request = None
):
    """
    Mark a material as acquired in the field (technician bought it on-site).
    This does NOT affect warehouse inventory - it's tracked separately.
    Cost and quantity are optional - accountant can fill in cost later.
    """
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    try:
        # Verify the material belongs to this work order
        cur.execute("""
            SELECT jm.*, i.item_id, i.description
            FROM job_materials_used jm
            JOIN inventory i ON jm.inventory_id = i.id
            WHERE jm.id = %s AND jm.work_order_id = %s
        """, (data.material_id, work_order_id))
        material = cur.fetchone()

        if not material:
            raise HTTPException(status_code=404, detail="Material not found for this work order")

        # Calculate quantity to acquire
        remaining_needed = material['quantity_needed'] - (material['quantity_allocated'] or 0)
        qty_to_acquire = data.quantity if data.quantity is not None else remaining_needed
        qty_to_acquire = min(qty_to_acquire, remaining_needed)  # Don't exceed what's needed

        if qty_to_acquire <= 0:
            raise HTTPException(status_code=400, detail="Material already fully allocated")

        new_allocated = (material['quantity_allocated'] or 0) + qty_to_acquire
        is_fully_allocated = new_allocated >= material['quantity_needed']

        # Mark as acquired in field and update allocated quantity
        cur.execute("""
            UPDATE job_materials_used
            SET acquired_in_field = TRUE,
                field_purchase_cost = COALESCE(field_purchase_cost, 0) + COALESCE(%s, 0),
                field_purchase_notes = CASE
                    WHEN field_purchase_notes IS NULL THEN %s
                    WHEN %s IS NOT NULL THEN field_purchase_notes || '; ' || %s
                    ELSE field_purchase_notes
                END,
                quantity_allocated = %s,
                status = CASE WHEN %s THEN 'allocated' ELSE status END,
                stock_status = 'field_acquired',
                allocated_by = %s,
                allocated_at = NOW()
            WHERE id = %s
            RETURNING *
        """, (
            data.cost,
            data.notes,
            data.notes,
            data.notes,
            new_allocated,
            is_fully_allocated,
            current_user['username'],
            data.material_id
        ))

        updated = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        return {
            'success': True,
            'message': f"Acquired {qty_to_acquire} x '{material['description']}' in field",
            'material': {
                'id': updated['id'],
                'item_id': material['item_id'],
                'description': material['description'],
                'quantity_acquired': qty_to_acquire,
                'quantity_allocated': new_allocated,
                'quantity_needed': material['quantity_needed'],
                'cost': float(updated['field_purchase_cost']) if updated['field_purchase_cost'] else None,
                'acquired_by': current_user['username']
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@router.post("/work-orders/{work_order_id}/deallocate-materials")
async def deallocate_materials(
    work_order_id: int,
    material_ids: List[int],
    request: Request = None
):
    """Deallocate materials from a work order - returns to available inventory"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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

@router.post("/work-orders/{work_order_id}/load-materials")
async def load_materials(
    work_order_id: int,
    load_request: LoadMaterialsRequest,
    request: Request = None
):
    """
    Load/pull materials from stock for a work order.
    This physically removes items from inventory and marks them as loaded on the truck.
    Materials must be allocated first before they can be loaded.
    """
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    try:
        loaded = []
        errors = []

        for material_id in load_request.material_ids:
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

            # source_type indicates origin: 'inventory' (default) or 'external_purchase'
            # Field acquisitions have acquired_in_field=true

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


@router.post("/work-orders/{work_order_id}/return-materials")
async def return_materials(
    work_order_id: int,
    return_request: ReturnMaterialsRequest,
    request: Request = None
):
    """
    Return unused materials from a work order back to inventory.
    This adds items back to stock and updates the job material record.
    """
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    try:
        returned = []
        errors = []

        for item in return_request.returns:
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

            # Calculate max returnable based on source type
            # For inventory items: loaded - used - already_returned
            # For external purchases: loaded - already_returned (they start with used=loaded)
            if material['source_type'] == 'external_purchase':
                max_returnable = material['quantity_loaded'] - material['quantity_returned']
            else:
                max_returnable = material['quantity_loaded'] - material['quantity_used'] - material['quantity_returned']

            if qty_to_return > max_returnable:
                errors.append({
                    'material_id': material_id,
                    'item_id': material['item_id'],
                    'error': f'Can only return up to {max_returnable} units'
                })
                continue

            # Update job material with returned quantity
            # For external purchases, also reduce quantity_used since they start with used=loaded
            if material['source_type'] == 'external_purchase':
                cur.execute("""
                    UPDATE job_materials_used
                    SET quantity_returned = quantity_returned + %s,
                        quantity_used = quantity_used - %s,
                        returned_by = %s,
                        returned_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                """, (qty_to_return, qty_to_return, current_user['username'], material_id))
            else:
                cur.execute("""
                    UPDATE job_materials_used
                    SET quantity_returned = quantity_returned + %s,
                        returned_by = %s,
                        returned_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                """, (qty_to_return, current_user['username'], material_id))

                # Release allocation for inventory-sourced materials
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


@router.post("/work-orders/{work_order_id}/add-external-material")
async def add_external_material(
    work_order_id: int,
    material: ExternalPurchaseRequest,
    request: Request = None
):
    """
    Add materials purchased externally (not from company inventory).
    Use this when workers purchase materials from external vendors like
    Home Depot, supply houses, etc. for unexpected needs or rare items.
    These materials are NOT deducted from inventory since they weren't in stock.
    """
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
            material.external_receipt_number,
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


@router.post("/work-orders/{work_order_id}/add-custom-material")
async def add_custom_material(
    work_order_id: int,
    material: CustomMaterialRequest,
    request: Request = None
):
    """
    Add a custom/special order material not in inventory.
    Use this for designer fixtures, special orders, customer-supplied items,
    or any material that isn't in the standard inventory catalog.
    """
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    try:
        # Verify work order exists
        cur.execute("SELECT id FROM work_orders WHERE id = %s", (work_order_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Work order not found")

        # Build notes with all custom material details
        notes_parts = []
        if material.manufacturer:
            notes_parts.append(f"Manufacturer: {material.manufacturer}")
        if material.model_number:
            notes_parts.append(f"Model: {material.model_number}")
        if material.vendor:
            notes_parts.append(f"Order from: {material.vendor}")
        if material.notes:
            notes_parts.append(material.notes)

        full_notes = " | ".join(notes_parts) if notes_parts else None

        # Add "Customer Provided" indicator to notes if applicable
        if material.customer_provided:
            full_notes = ("CUSTOMER PROVIDED" + (" | " + full_notes if full_notes else ""))

        cur.execute("""
            INSERT INTO job_materials_used (
                work_order_id, inventory_id, quantity_needed,
                unit_cost, unit_price, stock_status, status,
                source_type, custom_description, custom_vendor,
                custom_manufacturer, custom_model_number, needs_ordering, notes,
                customer_provided
            ) VALUES (
                %s, NULL, %s, %s, %s, 'special_order', 'planned',
                'custom', %s, %s, %s, %s, %s, %s, %s
            )
            RETURNING id
        """, (
            work_order_id,
            material.quantity,
            material.unit_cost,
            material.unit_price,
            material.description,
            material.vendor,
            material.manufacturer,
            material.model_number,
            material.needs_ordering,
            full_notes,
            material.customer_provided
        ))

        material_id = cur.fetchone()['id']
        conn.commit()
        cur.close()
        conn.close()

        logger.info(f"Custom material '{material.description}' added to WO {work_order_id} by {current_user['username']}")

        return {
            'success': True,
            'material_id': material_id,
            'message': f"Added custom material: {material.description}"
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)


@router.post("/work-orders/{work_order_id}/add-material")
async def add_material_to_work_order(
    work_order_id: int,
    material: dict,
    request: Request = None
):
    """Add a material line item to a work order"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    try:
        # Get unit_cost and unit_price from inventory if not provided
        inventory_id = material['inventory_id']
        unit_cost = material.get('unit_cost')
        unit_price = material.get('unit_price')

        if unit_cost is None or unit_price is None:
            cur.execute("SELECT cost, sell_price FROM inventory WHERE id = %s", (inventory_id,))
            inv_row = cur.fetchone()
            if inv_row:
                unit_cost = unit_cost if unit_cost is not None else (float(inv_row['cost']) if inv_row['cost'] else 0)
                unit_price = unit_price if unit_price is not None else (float(inv_row['sell_price']) if inv_row['sell_price'] else 0)
            else:
                unit_cost = unit_cost or 0
                unit_price = unit_price or 0

        cur.execute("""
            INSERT INTO job_materials_used (
                work_order_id, inventory_id, quantity_needed,
                unit_cost, unit_price, stock_status, status
            ) VALUES (%s, %s, %s, %s, %s, 'checking', 'planned')
            RETURNING id
        """, (
            work_order_id,
            inventory_id,
            material['quantity_needed'],
            unit_cost,
            unit_price
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


@router.delete("/work-orders/{work_order_id}/materials/{material_id}")
async def remove_material_from_work_order(
    work_order_id: int,
    material_id: int,
    request: Request = None
):
    """Remove a material from a work order (deallocates if allocated)"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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


# ============================================================
# WORK ORDER PHOTOS
# ============================================================

# File upload security constants
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'}
ALLOWED_IMAGE_MIME_TYPES = {'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'}
ALLOWED_VIDEO_EXTENSIONS = {'.mp4', '.mov', '.webm', '.m4v', '.3gp'}
ALLOWED_VIDEO_MIME_TYPES = {'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/3gpp'}
ALLOWED_MEDIA_EXTENSIONS = ALLOWED_IMAGE_EXTENSIONS | ALLOWED_VIDEO_EXTENSIONS
ALLOWED_MEDIA_MIME_TYPES = ALLOWED_IMAGE_MIME_TYPES | ALLOWED_VIDEO_MIME_TYPES
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB for images
MAX_VIDEO_SIZE = 200 * 1024 * 1024  # 200MB for videos


@router.get("/work-orders/{work_order_id}/photos")
async def get_work_order_photos(
    work_order_id: int,
    request: Request = None
):
    """Get all photos for a work order"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, filename, original_filename, caption, notes, photo_type, uploaded_by, uploaded_at, file_size, mime_type, COALESCE(media_type, 'photo') as media_type
        FROM work_order_photos
        WHERE work_order_id = %s
        ORDER BY uploaded_at DESC
    """, (work_order_id,))

    photos = cur.fetchall()
    cur.close()
    conn.close()

    return {"photos": photos}


@router.post("/work-orders/{work_order_id}/photos")
async def upload_work_order_photo(
    work_order_id: int,
    file: UploadFile = File(...),
    caption: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    photo_type: Optional[str] = Form("general"),
    request: Request = None
):
    """Upload a photo or video for a work order with optional notes

    photo_type options: before, after, progress, issue, general
    Accepts images (JPG, PNG, HEIC, etc.) up to 10MB
    Accepts videos (MP4, MOV, WebM) up to 200MB
    """
    current_user = await get_current_user_from_request(request)

    # Validate file extension
    file_extension = Path(file.filename).suffix.lower() if file.filename else ''
    if file_extension not in ALLOWED_MEDIA_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed images: {', '.join(sorted(ALLOWED_IMAGE_EXTENSIONS))}. Allowed videos: {', '.join(sorted(ALLOWED_VIDEO_EXTENSIONS))}"
        )

    # Determine if this is a video or image
    is_video = file_extension in ALLOWED_VIDEO_EXTENSIONS
    media_type = 'video' if is_video else 'photo'

    # Validate MIME type
    mime_type = file.content_type.lower() if file.content_type else ''
    if mime_type and mime_type not in ALLOWED_MEDIA_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only images and videos are allowed."
        )

    # Read and validate file size (different limits for images vs videos)
    contents = await file.read()
    max_size = MAX_VIDEO_SIZE if is_video else MAX_IMAGE_SIZE
    if len(contents) > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size for {'videos' if is_video else 'images'} is {max_size // (1024*1024)}MB"
        )

    # Create upload directory if it doesn't exist
    upload_dir = Path("uploads/work_orders")
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Generate unique filename
    unique_filename = f"{work_order_id}_{uuid.uuid4()}{file_extension}"
    file_path = upload_dir / unique_filename
    with open(file_path, "wb") as f:
        f.write(contents)

    # Save to database
    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute("""
            INSERT INTO work_order_photos
            (work_order_id, filename, original_filename, file_size, mime_type, media_type, caption, notes, photo_type, uploaded_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, filename, original_filename, caption, notes, photo_type, uploaded_by, uploaded_at, file_size, mime_type, media_type
        """, (
            work_order_id,
            unique_filename,
            file.filename,
            len(contents),
            file.content_type,
            media_type,
            caption,
            notes,
            photo_type,
            current_user['username']
        ))

        new_media = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        return new_media
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        # Clean up file if database insert fails
        if file_path.exists():
            file_path.unlink()
        log_and_raise(e)


@router.delete("/work-orders/{work_order_id}/photos/{photo_id}")
async def delete_work_order_photo(
    work_order_id: int,
    photo_id: int,
    request: Request = None
):
    """Delete a photo from a work order"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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


@router.get("/work-orders/photos/{filename}")
async def serve_work_order_photo(filename: str, request: Request = None):
    """Serve a work order photo - requires authentication"""
    current_user = await get_current_user_from_request(request)
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

@router.post("/work-orders/{work_order_id}/convert-scope-to-tasks")
async def convert_scope_to_tasks(
    work_order_id: int,
    request: Request = None
):
    """Convert scope_of_work text into individual tasks"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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


@router.post("/work-orders/{work_order_id}/tasks")
async def create_job_task(
    work_order_id: int,
    task: JobTaskCreate,
    request: Request = None
):
    """Create a new task for a work order"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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


@router.get("/work-orders/{work_order_id}/tasks")
async def get_job_tasks(
    work_order_id: int,
    request: Request = None
):
    """Get all tasks for a work order"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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


@router.put("/work-orders/{work_order_id}/tasks/{task_id}")
async def update_job_task(
    work_order_id: int,
    task_id: int,
    task_update: JobTaskUpdate,
    request: Request = None
):
    """Update a task (e.g., mark as completed)"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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


@router.delete("/work-orders/{work_order_id}/tasks/{task_id}")
async def delete_job_task(
    work_order_id: int,
    task_id: int,
    request: Request = None
):
    """Delete a task"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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

@router.post("/work-orders/{work_order_id}/notes")
async def create_job_note(
    work_order_id: int,
    note: JobNoteCreate,
    request: Request = None
):
    """Create a new note for a work order"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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


@router.get("/work-orders/{work_order_id}/notes")
async def get_job_notes(
    work_order_id: int,
    request: Request = None
):
    """Get all notes for a work order"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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


@router.delete("/work-orders/{work_order_id}/notes/{note_id}")
async def delete_job_note(
    work_order_id: int,
    note_id: int,
    request: Request = None
):
    """Delete a note"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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

@router.get("/work-orders/{work_order_id}/activity")
async def get_activity_log(
    work_order_id: int,
    request: Request = None
):
    """Get activity log for a work order"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
# MATERIAL RECONCILIATION ENDPOINTS
# ============================================================

@router.post("/work-orders/{work_order_id}/reconcile-materials")
async def reconcile_materials(
    work_order_id: int,
    reconciliation: ReconcileMaterialsRequest,
    request: Request = None
):
    """
    Reconcile materials when completing a job.
    Records quantity_used and what happened to any leftover materials.
    """
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    try:
        # Verify work order exists
        cur.execute("SELECT id, work_order_number FROM work_orders WHERE id = %s", (work_order_id,))
        work_order = cur.fetchone()
        if not work_order:
            raise HTTPException(status_code=404, detail="Work order not found")

        reconciled = []
        errors = []

        for mat in reconciliation.materials:
            try:
                # Get material details including current inventory qty for transaction logging
                cur.execute("""
                    SELECT jm.*, i.item_id, i.description, i.qty as warehouse_qty, i.cost as unit_cost
                    FROM job_materials_used jm
                    JOIN inventory i ON jm.inventory_id = i.id
                    WHERE jm.id = %s AND jm.work_order_id = %s
                """, (mat.material_id, work_order_id))
                material = cur.fetchone()

                if not material:
                    errors.append({'material_id': mat.material_id, 'error': 'Material not found'})
                    continue

                # Update the material with reconciliation data
                cur.execute("""
                    UPDATE job_materials_used
                    SET quantity_used = %s,
                        leftover_destination = %s,
                        leftover_van_id = %s,
                        leftover_notes = %s,
                        reconciled_at = CURRENT_TIMESTAMP,
                        reconciled_by = %s,
                        status = CASE WHEN %s > 0 THEN 'used' ELSE status END
                    WHERE id = %s
                    RETURNING id, quantity_used, leftover_destination, leftover_van_id
                """, (
                    mat.quantity_used,
                    mat.leftover_destination if mat.leftover_qty > 0 else None,
                    mat.leftover_van_id if mat.leftover_destination == 'van' else None,
                    mat.notes,
                    current_user['username'],
                    mat.quantity_used,
                    mat.material_id
                ))

                updated = cur.fetchone()

                # Log stock transaction for materials USED on the job
                if mat.quantity_used > 0:
                    cur.execute("""
                        INSERT INTO stock_transactions (
                            inventory_id, transaction_type, quantity_change,
                            quantity_before, quantity_after, work_order_id, job_material_id,
                            unit_cost, total_cost, reason, performed_by
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        material['inventory_id'],
                        'job_usage',  # New transaction type for materials consumed on jobs
                        -mat.quantity_used,  # Negative because stock is consumed
                        material['warehouse_qty'],
                        material['warehouse_qty'],  # Warehouse qty doesn't change (was already allocated)
                        work_order_id,
                        mat.material_id,
                        material.get('unit_cost') or 0,
                        (material.get('unit_cost') or 0) * mat.quantity_used,
                        f"Used on job {work_order['work_order_number']}: {material['item_id']} x{mat.quantity_used}",
                        current_user['username']
                    ))

                # Handle leftover transfer if needed
                if mat.leftover_qty > 0:
                    # Determine where materials originally came from
                    loaded_from_van = material.get('loaded_from_van_id')
                    quantity_loaded = material.get('quantity_loaded', 0) or 0
                    quantity_allocated = material.get('quantity_allocated', 0) or 0

                    if mat.leftover_destination == 'warehouse':
                        # Return to warehouse - update quantity_returned
                        cur.execute("""
                            UPDATE job_materials_used
                            SET quantity_returned = quantity_returned + %s
                            WHERE id = %s
                        """, (mat.leftover_qty, mat.material_id))

                        if loaded_from_van:
                            # Materials came from van - return to warehouse means:
                            # 1. Add to warehouse inventory
                            # 2. Subtract from van inventory
                            cur.execute("""
                                UPDATE inventory
                                SET qty = qty + %s
                                WHERE id = %s
                            """, (mat.leftover_qty, material['inventory_id']))

                            cur.execute("""
                                UPDATE van_inventory
                                SET quantity = GREATEST(0, quantity - %s),
                                    last_updated = CURRENT_TIMESTAMP
                                WHERE van_id = %s AND inventory_id = %s
                            """, (mat.leftover_qty, loaded_from_van, material['inventory_id']))

                            # Log stock transaction for return from van to warehouse
                            cur.execute("""
                                INSERT INTO stock_transactions (
                                    inventory_id, transaction_type, quantity_change,
                                    quantity_before, quantity_after, work_order_id, job_material_id,
                                    from_van_id, reason, performed_by
                                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """, (
                                material['inventory_id'],
                                'job_return',  # Leftover returned to warehouse from job
                                mat.leftover_qty,  # Positive - adding back to warehouse
                                material['warehouse_qty'],
                                material['warehouse_qty'] + mat.leftover_qty,
                                work_order_id,
                                mat.material_id,
                                loaded_from_van,
                                f"Leftover from job {work_order['work_order_number']} returned to warehouse: {material['item_id']} x{mat.leftover_qty}",
                                current_user['username']
                            ))

                            logger.info(f"Returned {mat.leftover_qty}x {material['item_id']} from van {loaded_from_van} to warehouse")

                        elif quantity_loaded > 0:
                            # Materials were loaded from warehouse and are still physically at warehouse
                            # Just release the allocation, no qty change needed
                            cur.execute("""
                                UPDATE inventory
                                SET qty_allocated = GREATEST(0, qty_allocated - %s)
                                WHERE id = %s
                            """, (mat.leftover_qty, material['inventory_id']))

                            # Log stock transaction for allocation release
                            cur.execute("""
                                INSERT INTO stock_transactions (
                                    inventory_id, transaction_type, quantity_change,
                                    quantity_before, quantity_after, work_order_id, job_material_id,
                                    reason, performed_by
                                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """, (
                                material['inventory_id'],
                                'allocation_release',  # Allocation released, materials never left warehouse
                                0,  # No actual qty change to warehouse
                                material['warehouse_qty'],
                                material['warehouse_qty'],
                                work_order_id,
                                mat.material_id,
                                f"Allocation released from job {work_order['work_order_number']}: {material['item_id']} x{mat.leftover_qty} (never loaded)",
                                current_user['username']
                            ))

                            logger.info(f"Released allocation of {mat.leftover_qty}x {material['item_id']} back to warehouse")

                        elif quantity_allocated > 0:
                            # Materials were allocated but never loaded - release the allocation
                            cur.execute("""
                                UPDATE inventory
                                SET qty_allocated = GREATEST(0, qty_allocated - %s)
                                WHERE id = %s
                            """, (mat.leftover_qty, material['inventory_id']))

                            # Log stock transaction for allocation release
                            cur.execute("""
                                INSERT INTO stock_transactions (
                                    inventory_id, transaction_type, quantity_change,
                                    quantity_before, quantity_after, work_order_id, job_material_id,
                                    reason, performed_by
                                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """, (
                                material['inventory_id'],
                                'allocation_release',
                                0,
                                material['warehouse_qty'],
                                material['warehouse_qty'],
                                work_order_id,
                                mat.material_id,
                                f"Allocation released from job {work_order['work_order_number']}: {material['item_id']} x{mat.leftover_qty} (never loaded)",
                                current_user['username']
                            ))

                            logger.info(f"Released allocation of {mat.leftover_qty}x {material['item_id']} - materials never loaded")

                        else:
                            # No allocation or load record - just log for tracking
                            logger.info(f"Recorded return of {mat.leftover_qty}x {material['item_id']} to warehouse (no inventory adjustment needed)")

                    elif mat.leftover_destination == 'van' and mat.leftover_van_id:
                        # Transfer to van
                        cur.execute("""
                            INSERT INTO van_inventory (van_id, inventory_id, quantity, last_restocked_date, last_restocked_by)
                            VALUES (%s, %s, %s, CURRENT_DATE, %s)
                            ON CONFLICT (van_id, inventory_id)
                            DO UPDATE SET
                                quantity = van_inventory.quantity + EXCLUDED.quantity,
                                last_restocked_date = CURRENT_DATE,
                                last_restocked_by = EXCLUDED.last_restocked_by,
                                last_updated = CURRENT_TIMESTAMP
                        """, (mat.leftover_van_id, material['inventory_id'], mat.leftover_qty, current_user['username']))

                        # If materials were allocated from warehouse, release the allocation
                        if quantity_allocated > 0 and not loaded_from_van:
                            cur.execute("""
                                UPDATE inventory
                                SET qty_allocated = GREATEST(0, qty_allocated - %s)
                                WHERE id = %s
                            """, (mat.leftover_qty, material['inventory_id']))

                        # Log stock transaction for leftover transferred to van
                        cur.execute("""
                            INSERT INTO stock_transactions (
                                inventory_id, transaction_type, quantity_change,
                                quantity_before, quantity_after, work_order_id, job_material_id,
                                to_van_id, from_van_id, reason, performed_by
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """, (
                            material['inventory_id'],
                            'job_to_van',  # Leftover from job transferred to van
                            0,  # Net warehouse change is 0 (allocation released, not actual stock)
                            material['warehouse_qty'],
                            material['warehouse_qty'],
                            work_order_id,
                            mat.material_id,
                            mat.leftover_van_id,
                            loaded_from_van,  # May be None if came from warehouse allocation
                            f"Leftover from job {work_order['work_order_number']} to van: {material['item_id']} x{mat.leftover_qty}",
                            current_user['username']
                        ))

                        logger.info(f"Transferred {mat.leftover_qty}x {material['item_id']} to van {mat.leftover_van_id} from job {work_order['work_order_number']}")

                reconciled.append({
                    'material_id': mat.material_id,
                    'item_id': material['item_id'],
                    'quantity_used': mat.quantity_used,
                    'leftover_qty': mat.leftover_qty,
                    'leftover_destination': mat.leftover_destination
                })

            except Exception as e:
                errors.append({'material_id': mat.material_id, 'error': str(e)})
                logger.error(f"Error reconciling material {mat.material_id}: {e}")

        # Log activity
        cur.execute("""
            INSERT INTO activity_log (work_order_id, activity_type, activity_description, performed_by)
            VALUES (%s, 'materials_reconciled', %s, %s)
        """, (
            work_order_id,
            f"Reconciled {len(reconciled)} materials at job completion",
            current_user['username']
        ))

        conn.commit()
        cur.close()
        conn.close()

        return {
            'message': f'Reconciled {len(reconciled)} materials',
            'reconciled': reconciled,
            'errors': errors if errors else None
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        log_and_raise(e)
