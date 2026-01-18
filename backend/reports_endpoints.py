"""
Reports Module API Endpoints
Comprehensive financial, labor, material, and variance reporting.
"""

from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from datetime import date, datetime, timedelta
import logging
import psycopg2.extras

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Reports"])

# Module-level variables set by init function
_get_db_connection = None
_get_current_user = None
_log_and_raise = None


def init_reports_module(db_func, auth_func, log_raise_func):
    """Initialize the module with database and auth functions from main.py"""
    global _get_db_connection, _get_current_user, _log_and_raise
    _get_db_connection = db_func
    _get_current_user = auth_func
    _log_and_raise = log_raise_func


def get_db():
    """Get database connection"""
    return _get_db_connection()


async def get_current_user_from_request(request: Request):
    """Extract token from request and get current user."""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    return await _get_current_user(token)


def require_admin_access(current_user: dict):
    """Ensure user has admin role only (for Reports, Purchase Orders, etc.)"""
    if current_user['role'] != 'admin':
        raise HTTPException(
            status_code=403,
            detail="Access denied. Admin privileges required."
        )


# ============================================================
# PYDANTIC MODELS
# ============================================================

class MaterialUsageUpdate(BaseModel):
    quantity_used: int
    installed_location: Optional[str] = None
    notes: Optional[str] = None


class BulkMaterialUsageUpdate(BaseModel):
    materials: list  # List of {material_id: int, quantity_used: int}


# ============================================================================
# FINANCIAL REPORTS ENDPOINTS
# ============================================================================

@router.get("/reports/financial-snapshot")
async def get_financial_snapshot(
    request: Request,
    period: Optional[str] = 'all-time'
):
    """Get overall financial snapshot with optional time period filter"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


# ============================================================
# PROFIT & LOSS REPORT (P&L) - For Accountants
# ============================================================

@router.get("/reports/profit-loss")
async def get_profit_loss_report(
    request: Request,
    period: Optional[str] = 'monthly',  # weekly, monthly, quarterly, annually, all-time, custom
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    view: Optional[str] = 'summary',  # summary or itemized
    group_by: Optional[str] = None  # job, customer, job_type, month
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
    current_user = await get_current_user_from_request(request)
    require_admin_access(current_user)

    conn = get_db()
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
        _log_and_raise(e)


@router.get("/reports/profit-loss/compare")
async def get_profit_loss_comparison(
    request: Request,
    period1_start: date,
    period1_end: date,
    period2_start: date,
    period2_end: date
):
    """
    Compare P&L between two time periods.
    Useful for month-over-month or year-over-year analysis.
    """
    current_user = await get_current_user_from_request(request)
    require_admin_access(current_user)

    conn = get_db()
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
        _log_and_raise(e)


@router.get("/reports/job-financial-detail")
async def get_job_financial_detail(
    request: Request,
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
):
    """Get detailed financial breakdown for jobs with optional filters"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


@router.get("/reports/monthly-summary")
async def get_monthly_summary(
    request: Request,
    months: int = 12
):
    """Get monthly financial summary for the last N months"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


@router.get("/reports/customer-summary")
async def get_customer_summary(
    request: Request,
    limit: int = 100,
    min_lifetime_value: float = 0
):
    """Get customer financial summary sorted by lifetime value"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


@router.get("/reports/inventory-valuation")
async def get_inventory_valuation(
    request: Request,
    category: Optional[str] = None,
    low_stock_only: bool = False
):
    """Get inventory valuation and turnover metrics"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


@router.get("/reports/dead-stock")
async def get_dead_stock_report(
    request: Request,
    months_inactive: int = 6
):
    """
    Get dead/slow-moving stock report.
    Identifies items with no usage in the specified period (default 6 months).
    """
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


@router.get("/reports/shrinkage-analysis")
async def get_shrinkage_analysis(request: Request):
    """
    Analyze inventory shrinkage by comparing count variances.
    Identifies potential theft, damage, or process problems.
    """
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


@router.get("/reports/employee-productivity")
async def get_employee_productivity(request: Request):
    """Get employee productivity and time tracking metrics"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


@router.get("/reports/date-range")
async def get_financial_report_date_range(
    request: Request,
    start_date: date,
    end_date: date
):
    """Get financial report for a specific date range"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


# ============================================================
# JOB PROFITABILITY REPORTS
# ============================================================

@router.get("/reports/profitability/job/{work_order_id}")
async def get_job_profitability(
    work_order_id: int,
    request: Request
):
    """
    Get complete profitability report for a specific job
    Includes materials, labor, revenue, costs, and profit margins
    """
    current_user = await get_current_user_from_request(request)
    require_admin_access(current_user)

    conn = get_db()
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
        _log_and_raise(e)


@router.get("/reports/profitability/summary")
async def get_profitability_summary(
    request: Request,
    period: Optional[str] = 'monthly',  # daily, weekly, monthly, quarterly, annually, all-time
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    job_type: Optional[str] = None,
    customer_id: Optional[int] = None,
    status: Optional[str] = None
):
    """
    Get profitability summary across multiple jobs
    Supports various time periods and filters
    """
    current_user = await get_current_user_from_request(request)
    require_admin_access(current_user)

    conn = get_db()
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
        _log_and_raise(e)


# ============================================================
# MATERIAL REPORTS
# ============================================================

@router.get("/reports/materials/job/{work_order_id}")
async def get_job_materials(
    work_order_id: int,
    request: Request
):
    """Get all materials used on a specific job"""
    current_user = await get_current_user_from_request(request)
    require_admin_access(current_user)

    conn = get_db()
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
        _log_and_raise(e)


@router.get("/reports/materials/summary")
async def get_material_usage_summary(
    request: Request,
    period: Optional[str] = 'monthly',
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    category: Optional[str] = None
):
    """Get material usage aggregates by item or category"""
    current_user = await get_current_user_from_request(request)
    require_admin_access(current_user)

    conn = get_db()
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
        _log_and_raise(e)


# ============================================================
# LABOR REPORTS
# ============================================================

@router.get("/reports/labor/job/{work_order_id}")
async def get_job_labor(
    work_order_id: int,
    request: Request
):
    """Get all labor hours for a specific job"""
    current_user = await get_current_user_from_request(request)
    require_admin_access(current_user)

    conn = get_db()
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
        _log_and_raise(e)


@router.get("/reports/labor/timecard/{username}")
async def get_employee_timecard(
    username: str,
    request: Request,
    week_ending: Optional[date] = None
):
    """
    Get employee timecard for a specific week
    Employees can view their own, admins can view any
    """
    current_user = await get_current_user_from_request(request)
    # Allow employees to see their own timecard
    if current_user['username'] != username and current_user['role'] not in ['admin', 'manager']:
        raise HTTPException(status_code=403, detail="Access denied")

    conn = get_db()
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
        _log_and_raise(e)


@router.get("/reports/labor/summary")
async def get_labor_summary(
    request: Request,
    period: Optional[str] = 'weekly',
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    employee_username: Optional[str] = None
):
    """Get labor summary across time periods and employees"""
    current_user = await get_current_user_from_request(request)
    require_admin_access(current_user)

    conn = get_db()
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
        _log_and_raise(e)


# ============================================================
# DAILY ACTIVITY REPORT
# ============================================================

@router.get("/reports/daily-activity")
async def get_daily_activity(
    request: Request,
    activity_date: Optional[date] = None
):
    """Get activity summary for a specific date"""
    current_user = await get_current_user_from_request(request)
    require_admin_access(current_user)

    conn = get_db()
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
        _log_and_raise(e)


# ============================================================
# VARIANCE REPORTS (Projected vs Actual)
# ============================================================

@router.get("/reports/variance/job/{work_order_id}")
async def get_job_variance(
    work_order_id: int,
    request: Request
):
    """
    Get projected vs actual variance report for a specific job.
    Shows side-by-side comparison of hours, labor, and materials.
    """
    current_user = await get_current_user_from_request(request)
    require_admin_access(current_user)

    conn = get_db()
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
        _log_and_raise(e)


@router.get("/reports/variance/summary")
async def get_variance_summary(
    request: Request,
    period: Optional[str] = 'monthly',
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    job_type: Optional[str] = None,
    customer_id: Optional[int] = None,
    status: Optional[str] = None
):
    """
    Get projected vs actual variance summary across multiple jobs.
    Supports weekly, monthly, quarterly, annually, and all-time views.
    """
    current_user = await get_current_user_from_request(request)
    require_admin_access(current_user)

    conn = get_db()
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
        _log_and_raise(e)


# ============================================================
# MATERIAL MARK-USED ENDPOINTS
# ============================================================

@router.put("/work-orders/{work_order_id}/materials/{material_id}/mark-used")
async def mark_material_used(
    work_order_id: int,
    material_id: int,
    update: MaterialUsageUpdate,
    request: Request
):
    """
    Update quantity_used for a material on a job.
    This is called when completing a job or manually updating usage.
    """
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


@router.put("/work-orders/{work_order_id}/materials/mark-all-used")
async def mark_all_materials_used(
    work_order_id: int,
    update: BulkMaterialUsageUpdate,
    request: Request
):
    """
    Bulk update quantity_used for all materials on a job.
    Typically called when completing a job.
    """
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


@router.get("/work-orders/{work_order_id}/materials/history")
async def get_material_change_history(
    work_order_id: int,
    request: Request,
    material_id: Optional[int] = None
):
    """
    Get material change audit trail for a job.
    Optionally filter by specific material.
    """
    current_user = await get_current_user_from_request(request)
    conn = get_db()
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
        _log_and_raise(e)


# ============================================================
# INVENTORY MOVEMENT REPORT
# ============================================================

@router.get("/reports/inventory-movement")
async def get_inventory_movement_report(
    request: Request,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    transaction_type: Optional[str] = None,
    vendor_id: Optional[int] = None,
    inventory_id: Optional[int] = None,
    work_order_id: Optional[int] = None,
    limit: int = 500
):
    """
    Comprehensive inventory movement report.
    Tracks all stock transactions with filtering by date, vendor, type.

    Transaction types:
    - job_usage: Materials consumed on jobs
    - job_return: Leftover returned to warehouse from job
    - job_to_van: Leftover transferred to van from job
    - allocation_release: Reserved stock released
    - transfer: Warehouse <-> Van movements
    - adjustment: Manual corrections
    - got_it: Field acquisition
    - return_rack: Placed on vendor return rack
    - vendor_return: Returned to vendor
    """
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # Default to last 30 days if no date range specified
        if not start_date:
            start_date = date.today() - timedelta(days=30)
        if not end_date:
            end_date = date.today()

        # Build the main query for transactions
        query = """
            SELECT
                st.id,
                st.transaction_date,
                st.transaction_type,
                st.quantity_change,
                st.quantity_before,
                st.quantity_after,
                st.unit_cost,
                st.total_cost,
                st.reason,
                st.performed_by,
                st.work_order_id,
                st.job_material_id,
                -- Inventory details
                i.id as inventory_id,
                i.item_id,
                i.description,
                i.brand,
                i.category,
                i.cost as current_cost,
                i.primary_vendor_id as vendor_id,
                -- Vendor details
                v.vendor_name,
                -- Work order details
                wo.work_order_number,
                wo.service_address as job_address
            FROM stock_transactions st
            JOIN inventory i ON st.inventory_id = i.id
            LEFT JOIN vendors v ON i.primary_vendor_id = v.id
            LEFT JOIN work_orders wo ON st.work_order_id = wo.id
            WHERE st.transaction_date >= %s
              AND st.transaction_date < %s + INTERVAL '1 day'
        """
        params = [start_date, end_date]

        if transaction_type:
            query += " AND st.transaction_type = %s"
            params.append(transaction_type)

        if vendor_id:
            query += " AND i.vendor_id = %s"
            params.append(vendor_id)

        if inventory_id:
            query += " AND st.inventory_id = %s"
            params.append(inventory_id)

        if work_order_id:
            query += " AND st.work_order_id = %s"
            params.append(work_order_id)

        query += " ORDER BY st.transaction_date DESC, st.id DESC LIMIT %s"
        params.append(limit)

        cur.execute(query, params)
        transactions = cur.fetchall()

        # Get summary statistics for the period
        summary_query = """
            SELECT
                transaction_type,
                COUNT(*) as transaction_count,
                SUM(CASE WHEN quantity_change > 0 THEN quantity_change ELSE 0 END) as total_in,
                SUM(CASE WHEN quantity_change < 0 THEN ABS(quantity_change) ELSE 0 END) as total_out,
                SUM(quantity_change) as net_change,
                SUM(COALESCE(total_cost, 0)) as total_value
            FROM stock_transactions st
            JOIN inventory i ON st.inventory_id = i.id
            WHERE st.transaction_date >= %s
              AND st.transaction_date < %s + INTERVAL '1 day'
        """
        summary_params = [start_date, end_date]

        if vendor_id:
            summary_query += " AND i.primary_vendor_id = %s"
            summary_params.append(vendor_id)

        summary_query += " GROUP BY transaction_type ORDER BY transaction_count DESC"

        cur.execute(summary_query, summary_params)
        type_summary = cur.fetchall()

        # Get top moving items
        top_items_query = """
            SELECT
                i.id,
                i.item_id,
                i.description,
                i.brand,
                v.vendor_name,
                COUNT(*) as transaction_count,
                SUM(CASE WHEN st.quantity_change < 0 THEN ABS(st.quantity_change) ELSE 0 END) as total_out,
                SUM(CASE WHEN st.quantity_change > 0 THEN st.quantity_change ELSE 0 END) as total_in,
                SUM(ABS(COALESCE(st.total_cost, 0))) as total_value_moved
            FROM stock_transactions st
            JOIN inventory i ON st.inventory_id = i.id
            LEFT JOIN vendors v ON i.primary_vendor_id = v.id
            WHERE st.transaction_date >= %s
              AND st.transaction_date < %s + INTERVAL '1 day'
        """
        top_params = [start_date, end_date]

        if vendor_id:
            top_items_query += " AND i.primary_vendor_id = %s"
            top_params.append(vendor_id)

        top_items_query += """
            GROUP BY i.id, i.item_id, i.description, i.brand, v.vendor_name
            ORDER BY transaction_count DESC
            LIMIT 20
        """

        cur.execute(top_items_query, top_params)
        top_items = cur.fetchall()

        # Get job usage summary (materials used per job)
        job_summary_query = """
            SELECT
                wo.id as work_order_id,
                wo.work_order_number,
                wo.service_address,
                wo.status,
                COUNT(DISTINCT st.inventory_id) as unique_items,
                SUM(CASE WHEN st.transaction_type = 'job_usage' THEN ABS(st.quantity_change) ELSE 0 END) as items_used,
                SUM(CASE
                    WHEN st.transaction_type = 'job_usage'
                    THEN ABS(COALESCE(st.total_cost, st.quantity_change * COALESCE(i.cost, 0)))
                    ELSE 0
                END) as material_cost
            FROM stock_transactions st
            JOIN inventory i ON st.inventory_id = i.id
            JOIN work_orders wo ON st.work_order_id = wo.id
            WHERE st.transaction_date >= %s
              AND st.transaction_date < %s + INTERVAL '1 day'
              AND st.work_order_id IS NOT NULL
            GROUP BY wo.id, wo.work_order_number, wo.service_address, wo.status
            ORDER BY material_cost DESC
            LIMIT 20
        """

        cur.execute(job_summary_query, [start_date, end_date])
        job_summary = cur.fetchall()

        # Get vendors for filter dropdown
        cur.execute("""
            SELECT DISTINCT v.id, v.vendor_name
            FROM vendors v
            JOIN inventory i ON i.primary_vendor_id = v.id
            WHERE v.active = TRUE
            ORDER BY v.vendor_name
        """)
        vendors = cur.fetchall()

        # Calculate overall totals
        total_in = sum(float(t.get('total_in', 0) or 0) for t in type_summary)
        total_out = sum(float(t.get('total_out', 0) or 0) for t in type_summary)
        total_value = sum(abs(float(t.get('total_value', 0) or 0)) for t in type_summary)

        cur.close()
        conn.close()

        return {
            "transactions": [dict(t) for t in transactions],
            "summary": {
                "date_range": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat()
                },
                "total_transactions": len(transactions),
                "total_items_in": int(total_in),
                "total_items_out": int(total_out),
                "net_change": int(total_in - total_out),
                "total_value_moved": round(total_value, 2),
                "by_type": [dict(t) for t in type_summary]
            },
            "top_items": [dict(t) for t in top_items],
            "job_summary": [dict(j) for j in job_summary],
            "filters": {
                "vendors": [dict(v) for v in vendors],
                "transaction_types": [
                    {"value": "job_usage", "label": "Job Usage (Materials Used)"},
                    {"value": "job_return", "label": "Job Return (To Warehouse)"},
                    {"value": "job_to_van", "label": "Job to Van Transfer"},
                    {"value": "allocation_release", "label": "Allocation Released"},
                    {"value": "transfer", "label": "Warehouse/Van Transfer"},
                    {"value": "adjustment", "label": "Manual Adjustment"},
                    {"value": "got_it", "label": "Field Acquisition"},
                    {"value": "return_rack", "label": "Placed on Return Rack"},
                    {"value": "vendor_return", "label": "Returned to Vendor"}
                ]
            }
        }

    except Exception as e:
        cur.close()
        conn.close()
        _log_and_raise(e)


@router.get("/reports/vendor-returns-summary")
async def get_vendor_returns_summary(
    request: Request,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    vendor_id: Optional[int] = None,
    status: Optional[str] = None
):
    """
    Summary report for vendor returns (return rack items).
    Shows pending returns, completed returns, and value by vendor.
    """
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # Default to last 90 days
        if not start_date:
            start_date = date.today() - timedelta(days=90)
        if not end_date:
            end_date = date.today()

        # Get vendor returns with details
        query = """
            SELECT
                vr.id,
                vr.inventory_id,
                vr.vendor_id,
                vr.work_order_id,
                vr.quantity,
                vr.reason,
                vr.status,
                vr.created_at,
                vr.created_by,
                vr.returned_at,
                vr.returned_by,
                vr.credit_received,
                vr.credit_amount,
                vr.notes,
                -- Inventory details
                i.item_id,
                i.description,
                i.cost as unit_cost,
                (vr.quantity * COALESCE(i.cost, 0)) as total_value,
                -- Vendor details
                v.vendor_name,
                v.contact_name as vendor_contact,
                v.phone as vendor_phone,
                -- Work order details
                wo.work_order_number,
                wo.service_address
            FROM vendor_returns vr
            JOIN inventory i ON vr.inventory_id = i.id
            LEFT JOIN vendors v ON vr.vendor_id = v.id
            LEFT JOIN work_orders wo ON vr.work_order_id = wo.id
            WHERE vr.created_at >= %s
              AND vr.created_at < %s + INTERVAL '1 day'
        """
        params = [start_date, end_date]

        if vendor_id:
            query += " AND vr.vendor_id = %s"
            params.append(vendor_id)

        if status:
            query += " AND vr.status = %s"
            params.append(status)

        query += " ORDER BY vr.created_at DESC"

        cur.execute(query, params)
        returns = cur.fetchall()

        # Summary by vendor
        vendor_summary_query = """
            SELECT
                v.id as vendor_id,
                v.vendor_name,
                COUNT(*) as total_items,
                SUM(CASE WHEN vr.status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN vr.status = 'returned' THEN 1 ELSE 0 END) as returned_count,
                SUM(CASE WHEN vr.status = 'credited' THEN 1 ELSE 0 END) as credited_count,
                SUM(vr.quantity) as total_quantity,
                SUM(vr.quantity * COALESCE(i.cost, 0)) as total_value,
                SUM(CASE WHEN vr.status = 'pending' THEN vr.quantity * COALESCE(i.cost, 0) ELSE 0 END) as pending_value,
                SUM(COALESCE(vr.credit_amount, 0)) as total_credits_received
            FROM vendor_returns vr
            JOIN inventory i ON vr.inventory_id = i.id
            LEFT JOIN vendors v ON vr.vendor_id = v.id
            WHERE vr.created_at >= %s
              AND vr.created_at < %s + INTERVAL '1 day'
            GROUP BY v.id, v.vendor_name
            ORDER BY total_value DESC
        """

        cur.execute(vendor_summary_query, [start_date, end_date])
        vendor_summary = cur.fetchall()

        # Summary by reason
        reason_summary_query = """
            SELECT
                vr.reason,
                COUNT(*) as count,
                SUM(vr.quantity) as total_quantity,
                SUM(vr.quantity * COALESCE(i.cost, 0)) as total_value
            FROM vendor_returns vr
            JOIN inventory i ON vr.inventory_id = i.id
            WHERE vr.created_at >= %s
              AND vr.created_at < %s + INTERVAL '1 day'
            GROUP BY vr.reason
            ORDER BY total_value DESC
        """

        cur.execute(reason_summary_query, [start_date, end_date])
        reason_summary = cur.fetchall()

        # Overall totals
        total_pending = sum(float(v.get('pending_value', 0) or 0) for v in vendor_summary)
        total_returned = sum(float(v.get('total_value', 0) or 0) - float(v.get('pending_value', 0) or 0) for v in vendor_summary)
        total_credits = sum(float(v.get('total_credits_received', 0) or 0) for v in vendor_summary)

        cur.close()
        conn.close()

        return {
            "returns": [dict(r) for r in returns],
            "by_vendor": [dict(v) for v in vendor_summary],
            "by_reason": [dict(r) for r in reason_summary],
            "summary": {
                "date_range": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat()
                },
                "total_items": len(returns),
                "pending_value": round(total_pending, 2),
                "returned_value": round(total_returned, 2),
                "credits_received": round(total_credits, 2)
            }
        }

    except Exception as e:
        cur.close()
        conn.close()
        _log_and_raise(e)
