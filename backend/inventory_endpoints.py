"""
Inventory Management Module API Endpoints
Handles inventory CRUD, stock adjustments, cycle counting, ABC analysis,
stockout predictions, reorder suggestions, and CSV import.
"""

import csv
import io
import logging
from datetime import datetime, timedelta, date
from typing import Optional, List
from decimal import Decimal

from fastapi import APIRouter, HTTPException, status, Request, UploadFile, File
from pydantic import BaseModel, Field
from psycopg2.extras import Json
import psycopg2

logger = logging.getLogger(__name__)

router = APIRouter(tags=["inventory"])

# ============================================================
# MODULE INITIALIZATION
# ============================================================

# These will be set by main.py when registering the router
_get_db_connection = None
_get_current_user_func = None
_log_and_raise = None
_require_manager_or_admin_func = None
_require_admin_func = None


def init_inventory_module(
    db_func,
    auth_func,
    log_raise_func,
    require_mgr_admin_func,
    require_admin_func
):
    """Initialize the module with dependencies from main.py"""
    global _get_db_connection, _get_current_user_func, _log_and_raise
    global _require_manager_or_admin_func, _require_admin_func

    _get_db_connection = db_func
    _get_current_user_func = auth_func
    _log_and_raise = log_raise_func
    _require_manager_or_admin_func = require_mgr_admin_func
    _require_admin_func = require_admin_func


def get_db():
    """Get database connection"""
    return _get_db_connection()


async def get_current_user_from_request(request: Request):
    """Extract token from request and get current user"""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    return await _get_current_user_func(token)


def require_manager_or_admin(current_user: dict):
    """Check that requires manager or admin role"""
    if current_user.get('role') not in ['admin', 'manager']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager or admin access required"
        )
    return current_user


def require_admin_access(current_user: dict):
    """Ensure user has admin role only (for Reports, Purchase Orders, etc.)"""
    if current_user['role'] != 'admin':
        raise HTTPException(
            status_code=403,
            detail="Access denied. Admin privileges required."
        )
    return current_user


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


class CycleCountSettingsUpdate(BaseModel):
    class_a_days: int = 7
    class_b_days: int = 30
    class_c_days: int = 90
    class_a_tolerance: float = 2.0
    class_b_tolerance: float = 5.0
    class_c_tolerance: float = 10.0


class CycleCountRecord(BaseModel):
    actual_quantity: int
    notes: Optional[str] = None


class RescheduleCountRequest(BaseModel):
    new_date: date


# ============================================================
# INVENTORY ROUTES
# ============================================================

@router.get("/inventory")
async def get_inventory(
    request: Request,
    limit: int = 100,
    offset: int = 0,
    search: Optional[str] = None,
    category: Optional[str] = None,
    active_only: bool = True
):
    current_user = await get_current_user_from_request(request)

    conn = get_db()
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


@router.get("/inventory/low-stock")
async def get_low_stock_items(request: Request):
    current_user = await get_current_user_from_request(request)

    conn = get_db()
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


@router.get("/inventory/stockout-predictions")
async def get_stockout_predictions(request: Request):
    """
    Predict when items will stock out based on usage velocity.
    Returns items sorted by urgency (days until stockout).
    """
    current_user = await get_current_user_from_request(request)

    conn = get_db()
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


@router.get("/inventory/reorder-suggestions")
async def get_reorder_suggestions(request: Request):
    """
    Get items that need to be reordered based on min_stock and reorder_qty.
    Includes lead time consideration and suggested order quantities.
    """
    current_user = await get_current_user_from_request(request)

    conn = get_db()
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

@router.get("/inventory/projections")
async def get_inventory_projections(
    request: Request,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    shortage_only: bool = False,
    vendor_id: Optional[int] = None
):
    """
    Get projected inventory levels based on scheduled job start dates.
    Shows current stock, materials needed for scheduled jobs, and shortages.
    """
    current_user = await get_current_user_from_request(request)
    require_admin_access(current_user)

    conn = get_db()
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


@router.get("/inventory/shortages")
async def get_inventory_shortages(
    request: Request,
    days_ahead: int = 30,
    group_by_vendor: bool = True
):
    """
    Get items that will be short based on scheduled jobs.
    Groups by vendor for easy PO creation.
    Includes order-by dates considering lead times.
    """
    current_user = await get_current_user_from_request(request)
    require_admin_access(current_user)

    conn = get_db()
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

@router.get("/inventory/order-planning")
async def get_order_planning(
    request: Request,
    days_ahead: int = 30,
    mode: str = "combined",  # "combined", "job_materials", "low_stock"
    vendor_id: Optional[int] = None,
    include_restock: bool = True  # Smart qty: add restock to target when ordering for jobs
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
    current_user = await get_current_user_from_request(request)
    require_admin_access(current_user)

    if mode not in ("combined", "job_materials", "low_stock"):
        raise HTTPException(status_code=400, detail="Mode must be 'combined', 'job_materials', or 'low_stock'")

    conn = get_db()
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


@router.get("/inventory/abc-analysis")
async def get_abc_analysis(request: Request):
    """
    Perform ABC analysis on inventory based on value and usage.
    A = High value/turnover (top 20% by value, ~80% of total value)
    B = Medium (next 30%)
    C = Low (remaining 50%)
    """
    current_user = await get_current_user_from_request(request)

    conn = get_db()
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


@router.post("/inventory/update-abc-classifications")
async def update_abc_classifications(request: Request):
    """
    Update ABC classifications and set next count dates for all inventory items.
    Should be run periodically (e.g., monthly) to keep classifications current.
    """
    current_user = await get_current_user_from_request(request)
    require_manager_or_admin(current_user)

    conn = get_db()
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


@router.get("/inventory/cycle-count-due")
async def get_cycle_count_due(request: Request):
    """
    Get items that are due for cycle counting based on their ABC class and next_count_date.
    """
    current_user = await get_current_user_from_request(request)

    conn = get_db()
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
        _log_and_raise(e, "Failed to get cycle count due items")
    finally:
        cur.close()
        conn.close()


# ============================================================
# CYCLE COUNT SETTINGS & EXECUTION
# ============================================================

@router.get("/inventory/cycle-count-settings")
async def get_cycle_count_settings(request: Request):
    """Get the current cycle count frequency settings for each ABC class."""
    current_user = await get_current_user_from_request(request)

    conn = get_db()
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
        _log_and_raise(e, "Failed to get cycle count settings")
    finally:
        cur.close()
        conn.close()


@router.post("/inventory/cycle-count-settings")
async def update_cycle_count_settings(settings: CycleCountSettingsUpdate, request: Request):
    """Update the cycle count frequency settings and recalculate next_count_dates."""
    current_user = await get_current_user_from_request(request)

    # Role-based access control - only admin and manager can update settings
    if current_user.get('role') not in ['admin', 'manager']:
        raise HTTPException(status_code=403, detail="Only administrators and managers can update cycle count settings")

    conn = get_db()
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
        _log_and_raise(e, "Failed to update cycle count settings")
    finally:
        cur.close()
        conn.close()


@router.post("/inventory/{id}/cycle-count")
async def record_cycle_count(id: int, count: CycleCountRecord, request: Request):
    """
    Record a physical cycle count for an inventory item.
    Updates the inventory quantity, records variance, and sets next count date.
    """
    current_user = await get_current_user_from_request(request)

    conn = get_db()
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
        _log_and_raise(e, "Failed to record cycle count")
    finally:
        cur.close()
        conn.close()


@router.post("/inventory/{id}/reschedule-count")
async def reschedule_cycle_count(id: int, reschedule_request: RescheduleCountRequest, request: Request):
    """Manually reschedule the next cycle count date for an item."""
    current_user = await get_current_user_from_request(request)

    # Validate date is not in the past
    if reschedule_request.new_date < date.today():
        raise HTTPException(status_code=400, detail="Cannot schedule count date in the past")

    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute("""
            UPDATE inventory
            SET next_count_date = %s
            WHERE id = %s AND active = TRUE
            RETURNING item_id
        """, (reschedule_request.new_date, id))

        result = cur.fetchone()
        if not result:
            raise HTTPException(status_code=404, detail=f"Item not found with id: {id}")

        conn.commit()
        return {"message": f"Cycle count rescheduled to {reschedule_request.new_date}", "item_id": result['item_id']}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        _log_and_raise(e, "Failed to reschedule cycle count")
    finally:
        cur.close()
        conn.close()


@router.get("/inventory/search")
async def search_inventory(query: str, request: Request):
    current_user = await get_current_user_from_request(request)

    conn = get_db()
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


@router.get("/inventory/{id}")
async def get_inventory_item(id: int, request: Request):
    current_user = await get_current_user_from_request(request)

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM inventory WHERE id = %s", (id,))
    item = cur.fetchone()
    cur.close()
    conn.close()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.get("/inventory/barcode/{upc}")
async def get_inventory_by_barcode(upc: str, request: Request):
    current_user = await get_current_user_from_request(request)

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM inventory WHERE upc = %s", (upc,))
    item = cur.fetchone()
    cur.close()
    conn.close()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found with UPC: " + upc)
    return item


@router.post("/inventory")
async def create_inventory_item(item: InventoryItem, request: Request):
    """Create inventory item - requires manager or admin role"""
    current_user = await get_current_user_from_request(request)
    require_manager_or_admin(current_user)

    conn = get_db()
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
        item.notes, item.estimation_guide, item.hazmat, item.active, current_user.get('username')
    ))

    new_id = cur.fetchone()['id']
    conn.commit()
    cur.close()
    conn.close()

    return {"message": "Item created successfully", "id": new_id, "item_id": item.item_id}


@router.patch("/inventory/{id}")
async def update_inventory_item(id: int, item: InventoryItemUpdate, request: Request):
    """Update inventory item - requires manager or admin role"""
    current_user = await get_current_user_from_request(request)
    require_manager_or_admin(current_user)

    conn = get_db()
    cur = conn.cursor()

    # Allowlist of fields that can be updated (defense in depth)
    # Complete list matching database schema_v3_final.sql
    allowed_fields = {
        # Identification (6 fields)
        'item_id', 'sku', 'brand', 'upc', 'manufacturer_part_number', 'description',
        # Category & Classification (2 fields)
        'category', 'subcategory',
        # Pricing (6 fields)
        'cost', 'list_price', 'contractor_price', 'markup_percent', 'sell_price', 'discount_price',
        # Inventory Management (10 fields - qty_available is computed, skip it)
        'qty', 'qty_allocated', 'qty_on_order', 'min_stock', 'reorder_qty', 'max_stock',
        'location', 'bin_location', 'last_counted_date', 'count_variance',
        # Physical Properties (5 fields)
        'qty_per', 'package_quantity', 'weight_lbs', 'length_inches', 'dimensions',
        # Electrical Specifications (11 fields)
        'voltage', 'amperage', 'wire_gauge', 'wire_type', 'num_poles',
        'phase', 'wire_insulation', 'wire_stranding', 'conduit_compatible',
        'indoor_outdoor', 'wet_location_rated',
        # Compliance & Certifications (7 fields)
        'ma_code_ref', 'nec_ref', 'ul_listed', 'certifications',
        'arc_fault_required', 'gfci_required', 'tamper_resistant',
        # Supply Chain (8 fields)
        'primary_vendor_id', 'alternate_vendor_id', 'vendor_part_number',
        'lead_time_days', 'last_order_date', 'last_order_cost', 'last_order_vendor_id',
        'discontinued', 'replacement_item_id',
        # Media & Documentation (6 fields)
        'image_url', 'image_urls', 'datasheet_pdf', 'installation_guide', 'video_url', 'qr_code',
        # Usage & Analytics (5 fields)
        'commonly_used', 'last_used_date', 'times_used', 'usage_frequency', 'seasonal_item',
        # Business & Financial (4 fields)
        'taxable', 'serialized', 'warranty_months', 'returnable',
        # Metadata (4 fields - created_by, date_added, last_updated are auto-managed)
        'notes', 'estimation_guide', 'hazmat', 'active',
        # Legacy field names for backwards compatibility
        'bin_number', 'barcode', 'manufacturer', 'unit'
    }

    # Build dynamic update query
    update_fields = []
    values = []

    for field, value in item.dict(exclude_unset=True).items():
        # Skip computed fields
        if field == "qty_available":
            continue

        # Skip fields not in allowlist
        if field not in allowed_fields:
            continue

        # Special handling for image_urls (convert to JSONB)
        if field == "image_urls":
            update_fields.append(f"{field} = %s")
            values.append(Json(value) if value is not None else None)
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


@router.delete("/inventory/{id}")
async def delete_inventory_item(id: int, request: Request):
    """Soft delete - sets active=FALSE instead of actually deleting. Requires manager or admin role."""
    current_user = await get_current_user_from_request(request)
    require_manager_or_admin(current_user)

    conn = get_db()
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

@router.post("/inventory/{item_id}/adjust-stock")
async def adjust_stock(item_id: str, adjustment: StockAdjustment, request: Request):
    """Quick stock adjustment endpoint - updates qty and creates transaction record.
    Uses atomic UPDATE to prevent race conditions. Requires manager or admin role.
    Accepts either numeric ID or string item_id."""
    current_user = await get_current_user_from_request(request)
    require_manager_or_admin(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        # Try to find by numeric ID first, then by item_id string
        if item_id.isdigit():
            cur.execute("SELECT id, item_id FROM inventory WHERE id = %s", (int(item_id),))
        else:
            cur.execute("SELECT id, item_id FROM inventory WHERE item_id = %s", (item_id,))
        result = cur.fetchone()

        if not result:
            raise HTTPException(status_code=404, detail=f"Item not found: {item_id}")

        inventory_id = result['id']
        actual_item_id = result['item_id']

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
            "item_id": actual_item_id,
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


@router.get("/inventory/{id}/transactions")
async def get_stock_transactions(id: int, request: Request):
    current_user = await get_current_user_from_request(request)

    conn = get_db()
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
# CSV IMPORT/EXPORT
# ============================================================

@router.post("/inventory/import")
async def import_inventory(request: Request, file: UploadFile = File(...)):
    """Import inventory from CSV file (manager/admin only)"""
    current_user = await get_current_user_from_request(request)
    require_manager_or_admin(current_user)

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

    conn = get_db()
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

        except psycopg2.Error as e:
            # Database errors - don't expose details
            logger.error(f"CSV import row {row_num} database error: {str(e)}")
            errors.append(f"Row {row_num}: Database error processing row")
            if len(errors) > 10:
                errors.append("... additional errors truncated")
                break
        except ValueError as e:
            # Value conversion errors - safe to show
            errors.append(f"Row {row_num}: Invalid data format")
            if len(errors) > 10:
                errors.append("... additional errors truncated")
                break
        except Exception as e:
            # Unexpected errors - don't expose details
            logger.error(f"CSV import row {row_num} unexpected error: {type(e).__name__}: {str(e)}")
            errors.append(f"Row {row_num}: Processing failed")
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
# VENDOR RETURNS (Return-to-Vendor Rack)
# ============================================================

class VendorReturnCreate(BaseModel):
    """Model for placing an item on the return rack"""
    inventory_id: int
    quantity: int = Field(..., gt=0)
    return_reason: str = Field(..., pattern="^(defective|overstock|wrong_item|damaged|expired)$")
    return_reason_notes: Optional[str] = None
    source_location: Optional[str] = None  # 'warehouse', 'van_101', etc.
    vendor_id: Optional[int] = None  # Override primary vendor if needed
    notes: Optional[str] = None


class VendorReturnUpdate(BaseModel):
    """Model for updating a return item"""
    status: Optional[str] = Field(None, pattern="^(pending|approved|returned|credited|cancelled)$")
    return_authorization: Optional[str] = None
    credit_amount: Optional[Decimal] = None
    credited_date: Optional[date] = None
    notes: Optional[str] = None


@router.get("/vendor-returns")
async def get_vendor_returns(
    request: Request,
    status: Optional[str] = None,
    vendor_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0
):
    """
    Get all items on the return rack.
    Filterable by status and vendor.
    """
    current_user = await get_current_user_from_request(request)

    conn = get_db()
    cur = conn.cursor()

    try:
        where_clauses = []
        params = []

        if status:
            where_clauses.append("vr.status = %s")
            params.append(status)

        if vendor_id:
            where_clauses.append("vr.vendor_id = %s")
            params.append(vendor_id)

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        # Get total count
        cur.execute(f"""
            SELECT COUNT(*) as total FROM vendor_returns vr {where_sql}
        """, params if params else None)
        total = cur.fetchone()['total']

        # Get paginated results with item and vendor details
        params.extend([limit, offset])
        cur.execute(f"""
            SELECT
                vr.*,
                i.item_id,
                i.description as item_description,
                i.brand,
                i.category,
                i.cost as unit_cost,
                v.vendor_name,
                v.email as vendor_email,
                v.phone as vendor_phone,
                u.full_name as placed_by_name
            FROM vendor_returns vr
            LEFT JOIN inventory i ON vr.inventory_id = i.id
            LEFT JOIN vendors v ON vr.vendor_id = v.id
            LEFT JOIN users u ON vr.placed_by = u.username
            {where_sql}
            ORDER BY vr.placed_on_rack_date DESC
            LIMIT %s OFFSET %s
        """, params)

        returns = cur.fetchall()

        # Convert to list of dicts with proper serialization
        results = []
        for r in returns:
            item = dict(r)
            if item.get('placed_on_rack_date'):
                item['placed_on_rack_date'] = str(item['placed_on_rack_date'])
            if item.get('credited_date'):
                item['credited_date'] = str(item['credited_date'])
            if item.get('created_at'):
                item['created_at'] = str(item['created_at'])
            if item.get('updated_at'):
                item['updated_at'] = str(item['updated_at'])
            if item.get('unit_cost'):
                item['unit_cost'] = float(item['unit_cost'])
            if item.get('credit_amount'):
                item['credit_amount'] = float(item['credit_amount'])
            # Calculate total value for this return
            item['total_value'] = round((item.get('unit_cost') or 0) * (item.get('quantity') or 0), 2)
            results.append(item)

        return {
            "returns": results,
            "total": total,
            "limit": limit,
            "offset": offset
        }
    finally:
        cur.close()
        conn.close()


@router.get("/vendor-returns/summary")
async def get_vendor_returns_summary(request: Request):
    """
    Get summary of items on return rack grouped by vendor.
    Useful for seeing what needs to go back to each vendor.
    """
    current_user = await get_current_user_from_request(request)

    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT
                v.id as vendor_id,
                v.vendor_name,
                v.email as vendor_email,
                v.phone as vendor_phone,
                COUNT(*) as item_count,
                SUM(vr.quantity) as total_quantity,
                SUM(vr.quantity * COALESCE(i.cost, 0)) as total_value,
                COUNT(CASE WHEN vr.status = 'pending' THEN 1 END) as pending_count,
                COUNT(CASE WHEN vr.status = 'approved' THEN 1 END) as approved_count
            FROM vendor_returns vr
            LEFT JOIN vendors v ON vr.vendor_id = v.id
            LEFT JOIN inventory i ON vr.inventory_id = i.id
            WHERE vr.status IN ('pending', 'approved')
            GROUP BY v.id, v.vendor_name, v.email, v.phone
            ORDER BY total_value DESC NULLS LAST
        """)

        vendors = cur.fetchall()

        # Get overall totals
        cur.execute("""
            SELECT
                COUNT(*) as total_items,
                SUM(quantity) as total_quantity,
                SUM(quantity * COALESCE(i.cost, 0)) as total_value,
                COUNT(CASE WHEN vr.status = 'pending' THEN 1 END) as pending_count,
                COUNT(CASE WHEN vr.status = 'approved' THEN 1 END) as approved_count,
                COUNT(CASE WHEN vr.status = 'returned' THEN 1 END) as returned_count,
                COUNT(CASE WHEN vr.status = 'credited' THEN 1 END) as credited_count
            FROM vendor_returns vr
            LEFT JOIN inventory i ON vr.inventory_id = i.id
            WHERE vr.status NOT IN ('cancelled')
        """)
        totals = cur.fetchone()

        # Convert vendor results
        vendor_list = []
        for v in vendors:
            vendor = dict(v)
            vendor['total_value'] = round(float(vendor['total_value'] or 0), 2)
            vendor_list.append(vendor)

        return {
            "by_vendor": vendor_list,
            "summary": {
                "total_items": totals['total_items'] or 0,
                "total_quantity": totals['total_quantity'] or 0,
                "total_value": round(float(totals['total_value'] or 0), 2),
                "pending": totals['pending_count'] or 0,
                "approved": totals['approved_count'] or 0,
                "returned": totals['returned_count'] or 0,
                "credited": totals['credited_count'] or 0
            }
        }
    finally:
        cur.close()
        conn.close()


@router.get("/vendor-returns/report/{vendor_id}")
async def get_vendor_return_list(vendor_id: int, request: Request):
    """
    Generate a printable return list for a specific vendor.
    Shows all pending/approved items ready to return.
    """
    current_user = await get_current_user_from_request(request)

    conn = get_db()
    cur = conn.cursor()

    try:
        # Get vendor info
        cur.execute("SELECT * FROM vendors WHERE id = %s", (vendor_id,))
        vendor = cur.fetchone()
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")

        # Get all pending/approved items for this vendor
        cur.execute("""
            SELECT
                vr.id,
                vr.quantity,
                vr.return_reason,
                vr.return_reason_notes,
                vr.return_authorization,
                vr.status,
                vr.placed_on_rack_date,
                vr.notes,
                i.item_id,
                i.description,
                i.brand,
                i.upc,
                i.manufacturer_part_number,
                i.cost as unit_cost
            FROM vendor_returns vr
            JOIN inventory i ON vr.inventory_id = i.id
            WHERE vr.vendor_id = %s
              AND vr.status IN ('pending', 'approved')
            ORDER BY vr.placed_on_rack_date DESC
        """, (vendor_id,))

        items = cur.fetchall()

        # Calculate totals and format
        results = []
        total_value = 0
        total_quantity = 0

        for item in items:
            i = dict(item)
            unit_cost = float(i.get('unit_cost') or 0)
            qty = i.get('quantity') or 0
            i['unit_cost'] = unit_cost
            i['line_total'] = round(unit_cost * qty, 2)
            i['placed_on_rack_date'] = str(i['placed_on_rack_date']) if i.get('placed_on_rack_date') else None
            total_value += i['line_total']
            total_quantity += qty
            results.append(i)

        return {
            "vendor": {
                "id": vendor['id'],
                "name": vendor['vendor_name'],
                "email": vendor.get('email'),
                "phone": vendor.get('phone'),
                "address": vendor.get('address')
            },
            "items": results,
            "summary": {
                "item_count": len(results),
                "total_quantity": total_quantity,
                "total_value": round(total_value, 2)
            },
            "generated_at": datetime.now().isoformat(),
            "generated_by": current_user.get('full_name') or current_user.get('username')
        }
    finally:
        cur.close()
        conn.close()


@router.get("/vendor-returns/{id}")
async def get_vendor_return(id: int, request: Request):
    """Get a single vendor return item by ID"""
    current_user = await get_current_user_from_request(request)

    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT
                vr.*,
                i.item_id,
                i.description as item_description,
                i.brand,
                i.category,
                i.cost as unit_cost,
                i.upc,
                v.vendor_name,
                v.email as vendor_email,
                v.phone as vendor_phone
            FROM vendor_returns vr
            LEFT JOIN inventory i ON vr.inventory_id = i.id
            LEFT JOIN vendors v ON vr.vendor_id = v.id
            WHERE vr.id = %s
        """, (id,))

        result = cur.fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Vendor return not found")

        item = dict(result)
        if item.get('placed_on_rack_date'):
            item['placed_on_rack_date'] = str(item['placed_on_rack_date'])
        if item.get('credited_date'):
            item['credited_date'] = str(item['credited_date'])
        if item.get('unit_cost'):
            item['unit_cost'] = float(item['unit_cost'])
        if item.get('credit_amount'):
            item['credit_amount'] = float(item['credit_amount'])

        return item
    finally:
        cur.close()
        conn.close()


@router.post("/vendor-returns")
async def create_vendor_return(return_item: VendorReturnCreate, request: Request):
    """
    Place an item on the return rack.
    Automatically uses the item's primary vendor if vendor_id not specified.
    """
    current_user = await get_current_user_from_request(request)

    conn = get_db()
    cur = conn.cursor()

    try:
        # Get inventory item info and primary vendor
        cur.execute("""
            SELECT id, item_id, description, primary_vendor_id, qty
            FROM inventory WHERE id = %s
        """, (return_item.inventory_id,))
        inv_item = cur.fetchone()

        if not inv_item:
            raise HTTPException(status_code=404, detail="Inventory item not found")

        # Determine vendor (use override or default to primary vendor)
        vendor_id = return_item.vendor_id or inv_item.get('primary_vendor_id')

        if not vendor_id:
            raise HTTPException(
                status_code=400,
                detail="No vendor specified and item has no primary vendor assigned"
            )

        # Verify vendor exists
        cur.execute("SELECT id, vendor_name FROM vendors WHERE id = %s", (vendor_id,))
        vendor = cur.fetchone()
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")

        # Create the return record
        cur.execute("""
            INSERT INTO vendor_returns (
                inventory_id, vendor_id, quantity, return_reason,
                return_reason_notes, source_location, placed_by, notes
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            return_item.inventory_id,
            vendor_id,
            return_item.quantity,
            return_item.return_reason,
            return_item.return_reason_notes,
            return_item.source_location,
            current_user.get('username'),
            return_item.notes
        ))

        new_id = cur.fetchone()['id']

        # Log a stock transaction for audit trail (no qty change - just placed on rack)
        cur.execute("""
            INSERT INTO stock_transactions (
                inventory_id, transaction_type, quantity_change, quantity_before,
                quantity_after, reason, performed_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            return_item.inventory_id,
            'return_rack',
            0,  # Not changing qty yet - just placing on return rack
            inv_item['qty'],
            inv_item['qty'],
            f"Placed on return rack (ID:{new_id}) - {return_item.return_reason}: {return_item.return_reason_notes or 'No notes'}",
            current_user.get('username')
        ))

        conn.commit()

        return {
            "message": "Item placed on return rack",
            "id": new_id,
            "item_id": inv_item['item_id'],
            "description": inv_item['description'],
            "vendor_name": vendor['vendor_name'],
            "quantity": return_item.quantity,
            "return_reason": return_item.return_reason
        }
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Failed to create vendor return: {e}")
        raise HTTPException(status_code=500, detail="Failed to place item on return rack")
    finally:
        cur.close()
        conn.close()


@router.patch("/vendor-returns/{id}")
async def update_vendor_return(id: int, update: VendorReturnUpdate, request: Request):
    """
    Update a vendor return item (status, RA number, credit info, notes).
    Only managers and admins can update returns.

    When status changes to 'returned', the quantity is deducted from inventory
    since the item has been physically returned to the vendor.
    """
    current_user = await get_current_user_from_request(request)
    require_manager_or_admin(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        # Verify the return exists and get current details
        cur.execute("""
            SELECT id, inventory_id, quantity, status, vendor_id
            FROM vendor_returns WHERE id = %s
        """, (id,))
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Vendor return not found")

        existing_status = existing['status']
        inventory_id = existing['inventory_id']
        return_quantity = existing['quantity']

        # Build dynamic update query
        update_fields = []
        values = []

        if update.status is not None:
            update_fields.append("status = %s")
            values.append(update.status)

        if update.return_authorization is not None:
            update_fields.append("return_authorization = %s")
            values.append(update.return_authorization)

        if update.credit_amount is not None:
            update_fields.append("credit_amount = %s")
            values.append(update.credit_amount)

        if update.credited_date is not None:
            update_fields.append("credited_date = %s")
            values.append(update.credited_date)

        if update.notes is not None:
            update_fields.append("notes = %s")
            values.append(update.notes)

        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")

        # Add updated_at timestamp
        update_fields.append("updated_at = NOW()")

        values.append(id)
        query = f"UPDATE vendor_returns SET {', '.join(update_fields)} WHERE id = %s"
        cur.execute(query, values)

        # If status is changing TO 'returned' (and wasn't already 'returned'),
        # deduct the quantity from inventory - the item is no longer in our possession
        if update.status == 'returned' and existing_status != 'returned' and inventory_id:
            # Get current inventory quantity and cost
            cur.execute("SELECT qty, cost FROM inventory WHERE id = %s", (inventory_id,))
            inv_row = cur.fetchone()
            qty_before = inv_row['qty'] if inv_row else 0
            unit_cost = float(inv_row['cost']) if inv_row and inv_row['cost'] else 0
            qty_after = qty_before - return_quantity

            # Deduct from inventory
            cur.execute("""
                UPDATE inventory
                SET qty = %s
                WHERE id = %s
            """, (qty_after, inventory_id))

            # Log the stock transaction
            cur.execute("""
                INSERT INTO stock_transactions
                (inventory_id, transaction_type, quantity_change, quantity_before, quantity_after,
                 unit_cost, total_cost, reason, performed_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                inventory_id,
                'vendor_return',
                -return_quantity,  # Negative because we're removing stock
                qty_before,
                qty_after,
                unit_cost,
                round(unit_cost * return_quantity, 2),
                f"Returned to vendor - Vendor Return #{id}",
                current_user['username']
            ))

            logger.info(f"Deducted {return_quantity} from inventory {inventory_id} for vendor return {id}")

        conn.commit()

        return {"message": "Vendor return updated successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        import traceback
        logger.error(f"Failed to update vendor return {id}: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to update vendor return: {str(e)}")
    finally:
        cur.close()
        conn.close()


@router.delete("/vendor-returns/{id}")
async def delete_vendor_return(id: int, request: Request):
    """
    Remove an item from the return rack (soft delete by setting status to 'cancelled').
    Only managers and admins can remove items.
    """
    current_user = await get_current_user_from_request(request)
    require_manager_or_admin(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute("""
            UPDATE vendor_returns
            SET status = 'cancelled', notes = COALESCE(notes || ' | ', '') || %s
            WHERE id = %s AND status NOT IN ('returned', 'credited')
            RETURNING id
        """, (
            f"Cancelled by {current_user.get('username')} on {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            id
        ))

        result = cur.fetchone()
        if not result:
            raise HTTPException(
                status_code=400,
                detail="Return not found or already processed (returned/credited)"
            )

        conn.commit()
        return {"message": "Item removed from return rack", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Failed to delete vendor return: {e}")
        raise HTTPException(status_code=500, detail="Failed to remove item from return rack")
    finally:
        cur.close()
        conn.close()
