#!/usr/bin/env python3
"""Script to add inventory projection endpoints to main.py"""

with open('main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the location to insert after reorder-suggestions
insertion_marker = '''    return {
        "reorder_suggestions": items,
        "summary": {
            "total_items": total_items,
            "immediate_count": immediate_count,
            "urgent_count": urgent_count,
            "total_estimated_cost": round(total_estimated_cost, 2)
        }
    }

@app.get("/inventory/abc-analysis")'''

new_endpoints = '''    return {
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
                    v.contact_email as vendor_email,
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
                         i.cost, i.primary_vendor_id, v.vendor_name, v.contact_email, v.phone
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

@app.get("/inventory/abc-analysis")'''

if insertion_marker in content:
    content = content.replace(insertion_marker, new_endpoints)
    with open('main.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Successfully added inventory projection endpoints')
else:
    print('ERROR: Could not find insertion marker')
