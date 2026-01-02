# ============================================================
# COMPREHENSIVE REPORTING ENDPOINTS
# ============================================================
# These endpoints provide detailed reporting for materials, labor,
# and profitability analysis across various time periods.
# Access is restricted to admin/manager roles only.

# NOTE: Import this module in main.py after defining app, get_db_connection, and get_current_user

from fastapi import HTTPException, Depends
from typing import Optional
from datetime import date, datetime, timedelta
from decimal import Decimal

# These will be set by main.py
app = None
get_db_connection = None
get_current_user = None

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
    cur = conn.cursor()

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
            SELECT * FROM job_material_detail_view
            WHERE work_order_id = %s
            ORDER BY category, item_name
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
        raise HTTPException(status_code=500, detail=str(e))


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
    cur = conn.cursor()

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
                "total_revenue": sum(Decimal(str(j['total_revenue'] or 0)) for j in jobs),
                "total_costs": sum(Decimal(str(j['total_costs'] or 0)) for j in jobs),
                "gross_profit": sum(Decimal(str(j['gross_profit'] or 0)) for j in jobs),
                "total_hours": sum(Decimal(str(j['total_hours_worked'] or 0)) for j in jobs),
            }
        }

    except Exception as e:
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))


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
    cur = conn.cursor()

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
                "total_quantity_used": sum(Decimal(str(m['quantity_used'] or 0)) for m in materials),
                "total_cost": sum(Decimal(str(m['line_cost'] or 0)) for m in materials),
                "total_revenue": sum(Decimal(str(m['line_total'] or 0)) for m in materials),
                "total_profit": sum(Decimal(str(m['line_profit'] or 0)) for m in materials),
            }
        }

    except Exception as e:
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))


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
    cur = conn.cursor()

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
                i.item_name,
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
            GROUP BY i.item_name, i.sku, i.category
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
        raise HTTPException(status_code=500, detail=str(e))


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
    cur = conn.cursor()

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
                "total_hours": sum(Decimal(str(l['hours_worked'] or 0)) for l in labor_entries),
                "total_employees": len(set(l['employee_username'] for l in labor_entries)),
                "total_labor_cost": sum(Decimal(str(l['pay_amount'] or 0)) for l in labor_entries),
                "total_billable": sum(Decimal(str(l['billable_amount'] or 0)) for l in labor_entries),
                "total_margin": sum(Decimal(str(l['labor_margin'] or 0)) for l in labor_entries),
            }
        }

    except Exception as e:
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))


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
    cur = conn.cursor()

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
        raise HTTPException(status_code=500, detail=str(e))


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
    cur = conn.cursor()

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
                "billable_hours": total_hours,  # For now, assume all hours are billable
                "total_labor_cost": total_labor_cost,
                "total_labor_revenue": total_labor_revenue
            },
            "employees": [dict(e) for e in employees],
            "recent_timecards": [dict(t) for t in recent_timecards]
        }

    except Exception as e:
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))


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
    cur = conn.cursor()

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
        raise HTTPException(status_code=500, detail=str(e))
