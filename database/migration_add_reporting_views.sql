-- Migration: Add Comprehensive Reporting Views
-- Created: 2025-12-06
-- Purpose: Enable detailed material, labor, and profitability reporting across time periods

-- ============================================================
-- DROP EXISTING VIEWS IF RERUNNING
-- ============================================================
DROP VIEW IF EXISTS job_material_detail_view CASCADE;
DROP VIEW IF EXISTS job_labor_detail_view CASCADE;
DROP VIEW IF EXISTS job_profitability_view CASCADE;
DROP VIEW IF EXISTS material_usage_summary_view CASCADE;
DROP VIEW IF EXISTS employee_productivity_view CASCADE;
DROP VIEW IF EXISTS daily_activity_summary_view CASCADE;
DROP VIEW IF EXISTS material_category_summary_view CASCADE;

-- ============================================================
-- 1. JOB MATERIAL DETAIL VIEW
-- ============================================================
CREATE OR REPLACE VIEW job_material_detail_view AS
SELECT
    jm.id,
    jm.work_order_id,
    wo.work_order_number,
    wo.job_type,
    wo.status as job_status,
    wo.scheduled_date,

    -- Customer info
    c.id as customer_id,
    c.first_name || ' ' || c.last_name as customer_name,
    c.company_name,
    wo.service_address,

    -- Material info
    jm.inventory_id,
    i.description as item_name,
    i.sku,
    i.category,
    i.brand as manufacturer,

    -- Quantities
    jm.quantity_needed,
    jm.quantity_allocated,
    jm.quantity_loaded,
    jm.quantity_used,
    jm.quantity_returned,
    (jm.quantity_needed - jm.quantity_used) as quantity_variance,
    CASE
        WHEN jm.quantity_needed > 0
        THEN ROUND(((jm.quantity_needed - jm.quantity_used)::DECIMAL / jm.quantity_needed) * 100, 2)
        ELSE 0
    END as variance_percentage,

    -- Costs and pricing
    jm.unit_cost,
    jm.unit_price,
    jm.line_cost,
    jm.line_total,
    (jm.line_total - jm.line_cost) as line_profit,
    CASE
        WHEN jm.line_total > 0
        THEN ROUND(((jm.line_total - jm.line_cost) / jm.line_total) * 100, 2)
        ELSE 0
    END as profit_margin_percent,

    -- Installation details
    jm.installed_location,
    jm.installed_by,
    jm.installed_date,

    -- Status
    jm.status,
    jm.stock_status,
    jm.notes,
    jm.allocated_by,
    jm.allocated_at

FROM job_materials_used jm
JOIN work_orders wo ON jm.work_order_id = wo.id
JOIN customers c ON wo.customer_id = c.id
JOIN inventory i ON jm.inventory_id = i.id
ORDER BY wo.work_order_number, i.category, i.item_name;

-- ============================================================
-- 2. JOB LABOR DETAIL VIEW
-- ============================================================
CREATE OR REPLACE VIEW job_labor_detail_view AS
SELECT
    te.id,
    te.work_order_id,
    wo.work_order_number,
    wo.job_type,
    wo.status as job_status,
    wo.scheduled_date,

    -- Customer info
    c.id as customer_id,
    c.first_name || ' ' || c.last_name as customer_name,
    c.company_name,
    wo.service_address,

    -- Employee info
    te.employee_username,
    u.full_name as employee_name,
    u.role as employee_role,

    -- Time tracking
    te.work_date,
    te.hours_worked,
    te.break_minutes,
    te.week_ending_date,
    te.is_locked,

    -- Rates and costs
    te.pay_rate,
    te.billable_rate,
    te.pay_amount,
    te.billable_amount,
    (te.billable_amount - te.pay_amount) as labor_margin,
    CASE
        WHEN te.billable_amount > 0
        THEN ROUND(((te.billable_amount - te.pay_amount) / te.billable_amount) * 100, 2)
        ELSE 0
    END as margin_percent,

    -- Notes
    te.notes,
    te.created_at,
    te.last_modified_at

FROM time_entries te
JOIN work_orders wo ON te.work_order_id = wo.id
JOIN customers c ON wo.customer_id = c.id
JOIN users u ON te.employee_username = u.username
ORDER BY wo.work_order_number, te.work_date, u.full_name;

-- ============================================================
-- 3. JOB PROFITABILITY VIEW
-- ============================================================
CREATE OR REPLACE VIEW job_profitability_view AS
SELECT
    wo.id as work_order_id,
    wo.work_order_number,
    wo.job_type,
    wo.status,
    wo.scheduled_date,
    wo.actual_start_time,
    wo.actual_end_time,

    -- Customer info
    c.id as customer_id,
    c.first_name || ' ' || c.last_name as customer_name,
    c.company_name,
    wo.service_address,

    -- Material costs
    COALESCE(SUM(jm.line_cost), 0) as total_material_cost,
    COALESCE(SUM(jm.line_total), 0) as total_material_revenue,
    COALESCE(SUM(jm.line_total - jm.line_cost), 0) as material_profit,
    COALESCE(COUNT(DISTINCT jm.inventory_id), 0) as unique_materials_used,
    COALESCE(SUM(jm.quantity_used), 0) as total_quantity_used,

    -- Labor costs
    COALESCE(SUM(te.pay_amount), 0) as total_labor_cost,
    COALESCE(SUM(te.billable_amount), 0) as total_labor_revenue,
    COALESCE(SUM(te.billable_amount - te.pay_amount), 0) as labor_profit,
    COALESCE(SUM(te.hours_worked), 0) as total_hours_worked,
    COALESCE(COUNT(DISTINCT te.employee_username), 0) as employees_count,

    -- Combined totals
    COALESCE(SUM(jm.line_cost), 0) + COALESCE(SUM(te.pay_amount), 0) as total_costs,
    COALESCE(SUM(jm.line_total), 0) + COALESCE(SUM(te.billable_amount), 0) as total_revenue,
    COALESCE(SUM(jm.line_total - jm.line_cost), 0) + COALESCE(SUM(te.billable_amount - te.pay_amount), 0) as gross_profit,

    -- Profit margin
    CASE
        WHEN (COALESCE(SUM(jm.line_total), 0) + COALESCE(SUM(te.billable_amount), 0)) > 0
        THEN ROUND(((COALESCE(SUM(jm.line_total - jm.line_cost), 0) + COALESCE(SUM(te.billable_amount - te.pay_amount), 0)) /
                     (COALESCE(SUM(jm.line_total), 0) + COALESCE(SUM(te.billable_amount), 0))) * 100, 2)
        ELSE 0
    END as profit_margin_percent,

    -- Metadata
    wo.created_at,
    wo.created_by,
    wo.assigned_to

FROM work_orders wo
JOIN customers c ON wo.customer_id = c.id
LEFT JOIN job_materials_used jm ON wo.id = jm.work_order_id AND jm.status IN ('used', 'billed')
LEFT JOIN time_entries te ON wo.id = te.work_order_id
GROUP BY
    wo.id, wo.work_order_number, wo.job_type, wo.status, wo.scheduled_date,
    wo.actual_start_time, wo.actual_end_time,
    c.id, c.first_name, c.last_name, c.company_name, wo.service_address,
    wo.created_at, wo.created_by, wo.assigned_to
ORDER BY wo.work_order_number DESC;

-- ============================================================
-- 4. MATERIAL USAGE SUMMARY VIEW
-- ============================================================
CREATE OR REPLACE VIEW material_usage_summary_view AS
SELECT
    i.id as inventory_id,
    i.description as item_name,
    i.sku,
    i.category,
    i.brand as manufacturer,
    i.qty_per as unit,

    -- Aggregated quantities
    COALESCE(SUM(jm.quantity_used), 0) as total_quantity_used,
    COALESCE(SUM(jm.quantity_returned), 0) as total_quantity_returned,
    COALESCE(COUNT(DISTINCT jm.work_order_id), 0) as jobs_used_on,

    -- Cost aggregates
    COALESCE(SUM(jm.line_cost), 0) as total_cost,
    COALESCE(SUM(jm.line_total), 0) as total_revenue,
    COALESCE(SUM(jm.line_total - jm.line_cost), 0) as total_profit,

    -- Averages
    CASE
        WHEN SUM(jm.quantity_used) > 0
        THEN ROUND(AVG(jm.unit_cost), 2)
        ELSE 0
    END as avg_unit_cost,
    CASE
        WHEN SUM(jm.quantity_used) > 0
        THEN ROUND(AVG(jm.unit_price), 2)
        ELSE 0
    END as avg_unit_price,

    -- Profit margin
    CASE
        WHEN SUM(jm.line_total) > 0
        THEN ROUND((SUM(jm.line_total - jm.line_cost) / SUM(jm.line_total)) * 100, 2)
        ELSE 0
    END as avg_profit_margin_percent,

    -- Most recent usage
    MAX(jm.installed_date) as last_used_date,
    MAX(jm.allocated_at) as last_allocated_date

FROM inventory i
LEFT JOIN job_materials_used jm ON i.id = jm.inventory_id AND jm.status IN ('used', 'billed')
GROUP BY i.id, i.description, i.sku, i.category, i.brand, i.qty_per
ORDER BY total_revenue DESC;

-- ============================================================
-- 5. MATERIAL CATEGORY SUMMARY VIEW
-- ============================================================
CREATE OR REPLACE VIEW material_category_summary_view AS
SELECT
    i.category,

    -- Quantity aggregates
    COALESCE(SUM(jm.quantity_used), 0) as total_quantity_used,
    COALESCE(COUNT(DISTINCT i.id), 0) as unique_materials,
    COALESCE(COUNT(DISTINCT jm.work_order_id), 0) as jobs_count,

    -- Cost aggregates
    COALESCE(SUM(jm.line_cost), 0) as total_cost,
    COALESCE(SUM(jm.line_total), 0) as total_revenue,
    COALESCE(SUM(jm.line_total - jm.line_cost), 0) as total_profit,

    -- Profit margin
    CASE
        WHEN SUM(jm.line_total) > 0
        THEN ROUND((SUM(jm.line_total - jm.line_cost) / SUM(jm.line_total)) * 100, 2)
        ELSE 0
    END as profit_margin_percent,

    -- Recent activity
    MAX(jm.installed_date) as last_used_date

FROM inventory i
LEFT JOIN job_materials_used jm ON i.id = jm.inventory_id AND jm.status IN ('used', 'billed')
WHERE i.category IS NOT NULL
GROUP BY i.category
ORDER BY total_revenue DESC;

-- ============================================================
-- 6. EMPLOYEE PRODUCTIVITY VIEW
-- ============================================================
CREATE OR REPLACE VIEW employee_productivity_view AS
SELECT
    u.username,
    u.full_name,
    u.role,
    u.hourly_rate,

    -- Time aggregates
    COALESCE(SUM(te.hours_worked), 0) as total_hours_worked,
    COALESCE(COUNT(DISTINCT te.work_date), 0) as days_worked,
    COALESCE(COUNT(DISTINCT te.work_order_id), 0) as jobs_worked,

    -- Financial aggregates
    COALESCE(SUM(te.pay_amount), 0) as total_pay_cost,
    COALESCE(SUM(te.billable_amount), 0) as total_billable_revenue,
    COALESCE(SUM(te.billable_amount - te.pay_amount), 0) as total_margin,

    -- Efficiency metrics
    CASE
        WHEN COUNT(DISTINCT te.work_order_id) > 0
        THEN ROUND(SUM(te.hours_worked) / COUNT(DISTINCT te.work_order_id), 2)
        ELSE 0
    END as avg_hours_per_job,

    CASE
        WHEN SUM(te.billable_amount) > 0
        THEN ROUND((SUM(te.billable_amount - te.pay_amount) / SUM(te.billable_amount)) * 100, 2)
        ELSE 0
    END as avg_margin_percent,

    CASE
        WHEN SUM(te.hours_worked) > 0
        THEN ROUND(SUM(te.billable_amount) / SUM(te.hours_worked), 2)
        ELSE 0
    END as revenue_per_hour,

    -- Recent activity
    MAX(te.work_date) as last_work_date,
    MIN(te.work_date) as first_work_date

FROM users u
LEFT JOIN time_entries te ON u.username = te.employee_username
WHERE u.role IN ('technician', 'admin', 'manager')
GROUP BY u.username, u.full_name, u.role, u.hourly_rate
ORDER BY total_billable_revenue DESC;

-- ============================================================
-- 7. DAILY ACTIVITY SUMMARY VIEW
-- ============================================================
CREATE OR REPLACE VIEW daily_activity_summary_view AS
SELECT
    activity_date,

    -- Job counts
    jobs_with_labor,
    jobs_with_materials,
    unique_jobs_worked,

    -- Employee activity
    employees_worked,
    total_labor_hours,

    -- Material activity
    materials_used_count,
    total_material_quantity,

    -- Financial summary
    labor_cost,
    labor_revenue,
    material_cost,
    material_revenue,
    total_cost,
    total_revenue,
    gross_profit,

    -- Profit margin
    CASE
        WHEN total_revenue > 0
        THEN ROUND((gross_profit / total_revenue) * 100, 2)
        ELSE 0
    END as profit_margin_percent

FROM (
    SELECT
        COALESCE(labor.work_date, materials.installed_date) as activity_date,

        -- Counts
        COALESCE(labor.jobs_count, 0) as jobs_with_labor,
        COALESCE(materials.jobs_count, 0) as jobs_with_materials,
        COALESCE(labor.jobs_count, 0) + COALESCE(materials.jobs_count, 0) -
            COALESCE(overlap.overlap_count, 0) as unique_jobs_worked,

        -- Labor
        COALESCE(labor.employees_count, 0) as employees_worked,
        COALESCE(labor.total_hours, 0) as total_labor_hours,
        COALESCE(labor.pay_total, 0) as labor_cost,
        COALESCE(labor.billable_total, 0) as labor_revenue,

        -- Materials
        COALESCE(materials.materials_count, 0) as materials_used_count,
        COALESCE(materials.quantity_total, 0) as total_material_quantity,
        COALESCE(materials.cost_total, 0) as material_cost,
        COALESCE(materials.revenue_total, 0) as material_revenue,

        -- Totals
        COALESCE(labor.pay_total, 0) + COALESCE(materials.cost_total, 0) as total_cost,
        COALESCE(labor.billable_total, 0) + COALESCE(materials.revenue_total, 0) as total_revenue,
        COALESCE(labor.billable_total, 0) - COALESCE(labor.pay_total, 0) +
            COALESCE(materials.revenue_total, 0) - COALESCE(materials.cost_total, 0) as gross_profit

    FROM (
        -- Labor by date
        SELECT
            work_date,
            COUNT(DISTINCT work_order_id) as jobs_count,
            COUNT(DISTINCT employee_username) as employees_count,
            SUM(hours_worked) as total_hours,
            SUM(pay_amount) as pay_total,
            SUM(billable_amount) as billable_total
        FROM time_entries
        GROUP BY work_date
    ) labor

    FULL OUTER JOIN (
        -- Materials by date
        SELECT
            DATE(installed_date) as installed_date,
            COUNT(DISTINCT work_order_id) as jobs_count,
            COUNT(DISTINCT inventory_id) as materials_count,
            SUM(quantity_used) as quantity_total,
            SUM(line_cost) as cost_total,
            SUM(line_total) as revenue_total
        FROM job_materials_used
        WHERE status IN ('used', 'billed')
          AND installed_date IS NOT NULL
        GROUP BY DATE(installed_date)
    ) materials ON labor.work_date = materials.installed_date

    LEFT JOIN (
        -- Count overlapping jobs (jobs with both labor and materials on same day)
        SELECT
            te.work_date,
            COUNT(DISTINCT te.work_order_id) as overlap_count
        FROM time_entries te
        JOIN job_materials_used jm ON te.work_order_id = jm.work_order_id
            AND DATE(jm.installed_date) = te.work_date
        GROUP BY te.work_date
    ) overlap ON COALESCE(labor.work_date, materials.installed_date) = overlap.work_date
) daily_summary
ORDER BY activity_date DESC;

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

-- Time entries indexes
CREATE INDEX IF NOT EXISTS idx_time_entries_work_date_range
    ON time_entries(work_date) WHERE is_locked = false;

CREATE INDEX IF NOT EXISTS idx_time_entries_employee_date
    ON time_entries(employee_username, work_date);

-- Job materials indexes
CREATE INDEX IF NOT EXISTS idx_job_materials_installed_date
    ON job_materials_used(installed_date) WHERE status IN ('used', 'billed');

CREATE INDEX IF NOT EXISTS idx_job_materials_work_order_status
    ON job_materials_used(work_order_id, status);

-- Work orders indexes
CREATE INDEX IF NOT EXISTS idx_work_orders_scheduled_status
    ON work_orders(scheduled_date, status);

CREATE INDEX IF NOT EXISTS idx_work_orders_customer
    ON work_orders(customer_id, status);

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

-- Grant SELECT on all new views
GRANT SELECT ON job_material_detail_view TO postgres;
GRANT SELECT ON job_labor_detail_view TO postgres;
GRANT SELECT ON job_profitability_view TO postgres;
GRANT SELECT ON material_usage_summary_view TO postgres;
GRANT SELECT ON material_category_summary_view TO postgres;
GRANT SELECT ON employee_productivity_view TO postgres;
GRANT SELECT ON daily_activity_summary_view TO postgres;

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Reporting Views Migration Complete!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Created Views:';
    RAISE NOTICE '  1. job_material_detail_view - Material usage per job';
    RAISE NOTICE '  2. job_labor_detail_view - Labor hours per job';
    RAISE NOTICE '  3. job_profitability_view - Complete job P&L';
    RAISE NOTICE '  4. material_usage_summary_view - Material aggregates';
    RAISE NOTICE '  5. material_category_summary_view - Category aggregates';
    RAISE NOTICE '  6. employee_productivity_view - Employee metrics';
    RAISE NOTICE '  7. daily_activity_summary_view - Daily snapshots';
    RAISE NOTICE '';
    RAISE NOTICE 'Created Indexes:';
    RAISE NOTICE '  - Performance indexes for reporting queries';
    RAISE NOTICE '========================================';
END $$;
