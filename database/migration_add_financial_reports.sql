-- Financial and Job Reporting Views and Functions
-- This migration adds comprehensive reporting capabilities for accounting

-- ============================================================================
-- 1. FINANCIAL SNAPSHOT VIEW
-- ============================================================================
-- Provides a complete financial overview including revenue, costs, and profit

CREATE OR REPLACE VIEW financial_snapshot AS
SELECT
    -- Job Financial Metrics
    COUNT(DISTINCT wo.id) as total_jobs,
    COUNT(DISTINCT CASE WHEN wo.status IN ('in_progress', 'scheduled') THEN wo.id END) as active_jobs,
    COUNT(DISTINCT CASE WHEN wo.status = 'completed' THEN wo.id END) as completed_jobs,

    -- Revenue Metrics
    COALESCE(SUM(CASE WHEN wo.status = 'completed' THEN wo.total_price END), 0) as completed_revenue,
    COALESCE(SUM(CASE WHEN wo.status IN ('in_progress', 'scheduled') THEN wo.total_price END), 0) as projected_revenue,
    COALESCE(SUM(wo.total_price), 0) as total_revenue_pipeline,

    -- Material Costs
    COALESCE(SUM(jmu.quantity * jmu.unit_cost), 0) as total_material_cost,
    COALESCE(SUM(CASE WHEN wo.status = 'completed' THEN jmu.quantity * jmu.unit_cost END), 0) as completed_material_cost,

    -- Labor Costs (from time entries)
    COALESCE(SUM(te.pay_amount), 0) as total_labor_cost,
    COALESCE(SUM(CASE WHEN wo.status = 'completed' THEN te.pay_amount END), 0) as completed_labor_cost,

    -- Labor Revenue (billable to customer)
    COALESCE(SUM(te.billable_amount), 0) as total_labor_revenue,
    COALESCE(SUM(CASE WHEN wo.status = 'completed' THEN te.billable_amount END), 0) as completed_labor_revenue,

    -- Profit Calculations
    COALESCE(SUM(CASE WHEN wo.status = 'completed'
        THEN wo.total_price END), 0) -
    COALESCE(SUM(CASE WHEN wo.status = 'completed'
        THEN jmu.quantity * jmu.unit_cost END), 0) -
    COALESCE(SUM(CASE WHEN wo.status = 'completed'
        THEN te.pay_amount END), 0) as completed_gross_profit,

    -- Invoice Metrics
    COALESCE(SUM(inv.total_amount), 0) as total_invoiced,
    COALESCE(SUM(CASE WHEN inv.status = 'paid' THEN inv.total_amount END), 0) as total_paid,
    COALESCE(SUM(CASE WHEN inv.status IN ('pending', 'sent') THEN inv.total_amount END), 0) as outstanding_invoices,

    -- Inventory Value
    (SELECT COALESCE(SUM(qty * cost), 0) FROM inventory) as inventory_value,

    -- Current timestamp for report generation
    CURRENT_TIMESTAMP as report_generated_at
FROM work_orders wo
LEFT JOIN job_materials_used jmu ON wo.id = jmu.work_order_id
LEFT JOIN time_entries te ON wo.id = te.work_order_id
LEFT JOIN invoices inv ON wo.id = inv.work_order_id;


-- ============================================================================
-- 2. JOB DETAILED FINANCIAL VIEW
-- ============================================================================
-- Detailed financial breakdown for each job

CREATE OR REPLACE VIEW job_financial_detail AS
SELECT
    wo.id as work_order_id,
    wo.work_order_number,
    wo.job_type,
    wo.status,
    wo.start_date,
    wo.completion_date,

    -- Customer Info
    c.first_name || ' ' || c.last_name as customer_name,
    c.email as customer_email,
    c.phone as customer_phone,
    wo.site_address,

    -- Pricing
    wo.total_price as job_price,
    wo.deposit_amount,
    wo.payment_terms,

    -- Material Costs
    COALESCE(SUM(jmu.quantity * jmu.unit_cost), 0) as total_material_cost,
    COUNT(DISTINCT jmu.id) as material_line_items,

    -- Labor Metrics
    COALESCE(SUM(te.hours_worked), 0) as total_labor_hours,
    COALESCE(SUM(te.pay_amount), 0) as total_labor_cost,
    COALESCE(SUM(te.billable_amount), 0) as total_labor_revenue,
    COUNT(DISTINCT te.employee_username) as employees_worked,

    -- Profit Calculations
    wo.total_price - COALESCE(SUM(jmu.quantity * jmu.unit_cost), 0) - COALESCE(SUM(te.pay_amount), 0) as gross_profit,
    CASE
        WHEN wo.total_price > 0 THEN
            ((wo.total_price - COALESCE(SUM(jmu.quantity * jmu.unit_cost), 0) - COALESCE(SUM(te.pay_amount), 0)) / wo.total_price * 100)
        ELSE 0
    END as profit_margin_percent,

    -- Invoice Status
    inv.invoice_number,
    inv.status as invoice_status,
    inv.total_amount as invoice_amount,
    inv.due_date as invoice_due_date,

    -- Days metrics
    CASE
        WHEN wo.completion_date IS NOT NULL THEN
            wo.completion_date - wo.start_date
        ELSE
            CURRENT_DATE - wo.start_date
    END as days_duration,

    CASE
        WHEN inv.due_date IS NOT NULL AND inv.status != 'paid' THEN
            CURRENT_DATE - inv.due_date
        ELSE 0
    END as days_overdue

FROM work_orders wo
JOIN customers c ON wo.customer_id = c.id
LEFT JOIN job_materials_used jmu ON wo.id = jmu.work_order_id
LEFT JOIN time_entries te ON wo.id = te.work_order_id
LEFT JOIN invoices inv ON wo.id = inv.work_order_id
GROUP BY
    wo.id, wo.work_order_number, wo.job_type, wo.status, wo.start_date,
    wo.completion_date, c.first_name, c.last_name, c.email, c.phone,
    wo.site_address, wo.total_price, wo.deposit_amount, wo.payment_terms,
    inv.invoice_number, inv.status, inv.total_amount, inv.due_date;


-- ============================================================================
-- 3. MONTHLY FINANCIAL SUMMARY VIEW
-- ============================================================================
-- Month-by-month financial breakdown

CREATE OR REPLACE VIEW monthly_financial_summary AS
SELECT
    DATE_TRUNC('month', COALESCE(wo.completion_date, wo.start_date)) as month,
    TO_CHAR(DATE_TRUNC('month', COALESCE(wo.completion_date, wo.start_date)), 'YYYY-MM') as month_label,

    -- Job counts
    COUNT(DISTINCT wo.id) as jobs_count,
    COUNT(DISTINCT CASE WHEN wo.status = 'completed' THEN wo.id END) as completed_jobs,

    -- Revenue
    COALESCE(SUM(CASE WHEN wo.status = 'completed' THEN wo.total_price END), 0) as revenue,

    -- Costs
    COALESCE(SUM(jmu.quantity * jmu.unit_cost), 0) as material_costs,
    COALESCE(SUM(te.pay_amount), 0) as labor_costs,

    -- Profit
    COALESCE(SUM(CASE WHEN wo.status = 'completed' THEN wo.total_price END), 0) -
    COALESCE(SUM(jmu.quantity * jmu.unit_cost), 0) -
    COALESCE(SUM(te.pay_amount), 0) as gross_profit,

    -- Invoice metrics
    COALESCE(SUM(CASE WHEN inv.status = 'paid' THEN inv.total_amount END), 0) as collected_revenue,
    COALESCE(SUM(CASE WHEN inv.status IN ('pending', 'sent') THEN inv.total_amount END), 0) as outstanding_invoices

FROM work_orders wo
LEFT JOIN job_materials_used jmu ON wo.id = jmu.work_order_id
LEFT JOIN time_entries te ON wo.id = te.work_order_id
LEFT JOIN invoices inv ON wo.id = inv.work_order_id
WHERE COALESCE(wo.completion_date, wo.start_date) IS NOT NULL
GROUP BY DATE_TRUNC('month', COALESCE(wo.completion_date, wo.start_date))
ORDER BY month DESC;


-- ============================================================================
-- 4. CUSTOMER FINANCIAL SUMMARY VIEW
-- ============================================================================
-- Financial summary by customer

CREATE OR REPLACE VIEW customer_financial_summary AS
SELECT
    c.id as customer_id,
    c.first_name || ' ' || c.last_name as customer_name,
    c.email,
    c.phone,

    -- Job metrics
    COUNT(DISTINCT wo.id) as total_jobs,
    COUNT(DISTINCT CASE WHEN wo.status = 'completed' THEN wo.id END) as completed_jobs,
    COUNT(DISTINCT CASE WHEN wo.status IN ('in_progress', 'scheduled') THEN wo.id END) as active_jobs,

    -- Financial metrics
    COALESCE(SUM(wo.total_price), 0) as lifetime_value,
    COALESCE(SUM(CASE WHEN wo.status = 'completed' THEN wo.total_price END), 0) as completed_revenue,
    COALESCE(AVG(CASE WHEN wo.status = 'completed' THEN wo.total_price END), 0) as avg_job_value,

    -- Invoice metrics
    COALESCE(SUM(inv.total_amount), 0) as total_invoiced,
    COALESCE(SUM(CASE WHEN inv.status = 'paid' THEN inv.total_amount END), 0) as total_paid,
    COALESCE(SUM(CASE WHEN inv.status IN ('pending', 'sent') THEN inv.total_amount END), 0) as outstanding_balance,

    -- Last activity
    MAX(wo.start_date) as last_job_date,
    MAX(CASE WHEN wo.status = 'completed' THEN wo.completion_date END) as last_completion_date

FROM customers c
LEFT JOIN work_orders wo ON c.id = wo.customer_id
LEFT JOIN invoices inv ON wo.id = inv.work_order_id
GROUP BY c.id, c.first_name, c.last_name, c.email, c.phone
HAVING COUNT(wo.id) > 0
ORDER BY lifetime_value DESC;


-- ============================================================================
-- 5. INVENTORY VALUATION VIEW
-- ============================================================================
-- Current inventory value and turnover metrics

CREATE OR REPLACE VIEW inventory_valuation AS
SELECT
    i.id as item_id,
    i.item_id as item_code,
    i.description,
    i.brand,
    i.category,

    -- Quantity metrics
    i.qty as current_stock,
    i.qty_available as available_stock,
    i.min_stock,
    CASE WHEN i.qty <= i.min_stock THEN true ELSE false END as is_low_stock,

    -- Value metrics
    i.cost as unit_cost,
    i.sell_price as unit_price,
    i.qty * i.cost as inventory_value,
    i.qty_available * i.cost as available_value,

    -- Markup
    i.sell_price - i.cost as unit_markup,
    CASE
        WHEN i.cost > 0 THEN ((i.sell_price - i.cost) / i.cost * 100)
        ELSE 0
    END as markup_percent,

    -- Usage metrics (last 90 days)
    COALESCE(SUM(CASE
        WHEN jmu.created_at > CURRENT_DATE - INTERVAL '90 days'
        THEN jmu.quantity
    END), 0) as qty_used_90days,

    COUNT(DISTINCT CASE
        WHEN jmu.created_at > CURRENT_DATE - INTERVAL '90 days'
        THEN jmu.work_order_id
    END) as jobs_used_in_90days,

    i.location,
    i.commonly_used

FROM inventory i
LEFT JOIN job_materials_used jmu ON i.id = jmu.inventory_id
GROUP BY
    i.id, i.item_id, i.description, i.brand, i.category,
    i.qty, i.qty_available, i.min_stock, i.cost, i.sell_price, i.location, i.commonly_used
ORDER BY inventory_value DESC;


-- ============================================================================
-- 6. EMPLOYEE PRODUCTIVITY VIEW
-- ============================================================================
-- Employee time and productivity metrics

CREATE OR REPLACE VIEW employee_productivity AS
SELECT
    te.employee_username,
    u.full_name as employee_name,

    -- Time metrics (last 30 days)
    COALESCE(SUM(CASE
        WHEN te.work_date > CURRENT_DATE - INTERVAL '30 days'
        THEN te.hours_worked
    END), 0) as hours_30days,

    -- Revenue generated (last 30 days)
    COALESCE(SUM(CASE
        WHEN te.work_date > CURRENT_DATE - INTERVAL '30 days'
        THEN te.billable_amount
    END), 0) as revenue_30days,

    -- Jobs worked on (last 30 days)
    COUNT(DISTINCT CASE
        WHEN te.work_date > CURRENT_DATE - INTERVAL '30 days'
        THEN te.work_order_id
    END) as jobs_30days,

    -- All-time metrics
    COALESCE(SUM(te.hours_worked), 0) as total_hours,
    COALESCE(SUM(te.billable_amount), 0) as total_revenue_generated,
    COUNT(DISTINCT te.work_order_id) as total_jobs_worked,

    -- Current pay rate
    epr.hourly_rate as current_hourly_rate,
    epr.job_title,

    -- Efficiency (revenue per hour)
    CASE
        WHEN SUM(te.hours_worked) > 0 THEN
            SUM(te.billable_amount) / SUM(te.hours_worked)
        ELSE 0
    END as avg_revenue_per_hour

FROM time_entries te
JOIN users u ON te.employee_username = u.username
LEFT JOIN LATERAL (
    SELECT hourly_rate, job_title
    FROM employee_pay_rates
    WHERE employee_username = te.employee_username
    AND effective_from <= CURRENT_DATE
    AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
    ORDER BY effective_from DESC
    LIMIT 1
) epr ON true
GROUP BY te.employee_username, u.full_name, epr.hourly_rate, epr.job_title
ORDER BY revenue_30days DESC;


-- ============================================================================
-- 7. FUNCTION: Generate Financial Report for Date Range
-- ============================================================================

CREATE OR REPLACE FUNCTION get_financial_report(
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    metric_category VARCHAR,
    metric_name VARCHAR,
    metric_value NUMERIC,
    metric_formatted TEXT
) AS $$
BEGIN
    RETURN QUERY

    -- Revenue Metrics
    SELECT
        'Revenue'::VARCHAR,
        'Total Revenue'::VARCHAR,
        COALESCE(SUM(wo.total_price), 0),
        '$' || TO_CHAR(COALESCE(SUM(wo.total_price), 0), 'FM999,999,990.00')
    FROM work_orders wo
    WHERE wo.start_date BETWEEN p_start_date AND p_end_date

    UNION ALL

    SELECT
        'Revenue'::VARCHAR,
        'Completed Revenue'::VARCHAR,
        COALESCE(SUM(wo.total_price), 0),
        '$' || TO_CHAR(COALESCE(SUM(wo.total_price), 0), 'FM999,999,990.00')
    FROM work_orders wo
    WHERE wo.status = 'completed'
    AND wo.completion_date BETWEEN p_start_date AND p_end_date

    UNION ALL

    -- Cost Metrics
    SELECT
        'Costs'::VARCHAR,
        'Material Costs'::VARCHAR,
        COALESCE(SUM(jmu.quantity * jmu.unit_cost), 0),
        '$' || TO_CHAR(COALESCE(SUM(jmu.quantity * jmu.unit_cost), 0), 'FM999,999,990.00')
    FROM job_materials_used jmu
    WHERE jmu.created_at::DATE BETWEEN p_start_date AND p_end_date

    UNION ALL

    SELECT
        'Costs'::VARCHAR,
        'Labor Costs'::VARCHAR,
        COALESCE(SUM(te.pay_amount), 0),
        '$' || TO_CHAR(COALESCE(SUM(te.pay_amount), 0), 'FM999,999,990.00')
    FROM time_entries te
    WHERE te.work_date BETWEEN p_start_date AND p_end_date

    UNION ALL

    -- Job Metrics
    SELECT
        'Jobs'::VARCHAR,
        'Total Jobs'::VARCHAR,
        COUNT(*)::NUMERIC,
        COUNT(*)::TEXT
    FROM work_orders wo
    WHERE wo.start_date BETWEEN p_start_date AND p_end_date;

END;
$$ LANGUAGE plpgsql;


-- Grant permissions
GRANT SELECT ON financial_snapshot TO postgres;
GRANT SELECT ON job_financial_detail TO postgres;
GRANT SELECT ON monthly_financial_summary TO postgres;
GRANT SELECT ON customer_financial_summary TO postgres;
GRANT SELECT ON inventory_valuation TO postgres;
GRANT SELECT ON employee_productivity TO postgres;

-- Refresh materialized views if they exist (for future optimization)
-- Note: These are regular views now, but can be converted to materialized views for better performance

COMMENT ON VIEW financial_snapshot IS 'Overall financial snapshot including revenue, costs, profit, and invoices';
COMMENT ON VIEW job_financial_detail IS 'Detailed financial breakdown for each job including materials, labor, and profit';
COMMENT ON VIEW monthly_financial_summary IS 'Month-by-month financial performance metrics';
COMMENT ON VIEW customer_financial_summary IS 'Customer lifetime value and financial metrics';
COMMENT ON VIEW inventory_valuation IS 'Current inventory value and turnover metrics';
COMMENT ON VIEW employee_productivity IS 'Employee time tracking and productivity metrics';
