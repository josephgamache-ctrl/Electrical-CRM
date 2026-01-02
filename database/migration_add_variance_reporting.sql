-- ============================================================
-- MIGRATION: Add Variance Reporting (Projected vs Actual)
-- ============================================================
-- This migration adds:
-- 1. material_change_log table for auditing material changes
-- 2. Trigger to automatically log material changes
-- 3. job_variance_view for calculating projected vs actual variance
-- ============================================================

-- ============================================================
-- 1. MATERIAL CHANGE LOG TABLE (Audit Trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS material_change_log (
    id SERIAL PRIMARY KEY,

    -- References
    job_material_id INTEGER NOT NULL REFERENCES job_materials_used(id) ON DELETE CASCADE,
    work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    inventory_id INTEGER NOT NULL REFERENCES inventory(id),

    -- Change Details
    change_type VARCHAR(50) NOT NULL,  -- 'created', 'quantity_needed_changed', 'quantity_allocated_changed',
                                        -- 'quantity_used_changed', 'returned', 'status_changed', 'price_changed'
    field_changed VARCHAR(50),          -- 'quantity_needed', 'quantity_allocated', 'quantity_used', 'status', etc.

    -- Values (stored as text for flexibility)
    old_value TEXT,
    new_value TEXT,

    -- Context
    change_reason TEXT,                  -- Optional reason for the change

    -- Audit Fields
    changed_by VARCHAR(50) NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Additional context
    source VARCHAR(50) DEFAULT 'manual'  -- 'manual', 'api', 'job_completion', 'return_process'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_material_change_log_job_material ON material_change_log(job_material_id);
CREATE INDEX IF NOT EXISTS idx_material_change_log_work_order ON material_change_log(work_order_id);
CREATE INDEX IF NOT EXISTS idx_material_change_log_changed_at ON material_change_log(changed_at);
CREATE INDEX IF NOT EXISTS idx_material_change_log_type ON material_change_log(change_type);

-- ============================================================
-- 2. TRIGGER FUNCTION: Log Material Changes
-- ============================================================
CREATE OR REPLACE FUNCTION log_material_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_changed_by VARCHAR(50);
BEGIN
    -- Determine who made the change
    v_changed_by := COALESCE(NEW.installed_by, NEW.allocated_by, 'system');

    -- Log creation
    IF TG_OP = 'INSERT' THEN
        INSERT INTO material_change_log (
            job_material_id, work_order_id, inventory_id,
            change_type, field_changed, old_value, new_value, changed_by, source
        ) VALUES (
            NEW.id, NEW.work_order_id, NEW.inventory_id,
            'created', 'all',
            NULL,
            'qty_needed=' || NEW.quantity_needed::TEXT || ', unit_cost=' || COALESCE(NEW.unit_cost::TEXT, '0') || ', unit_price=' || COALESCE(NEW.unit_price::TEXT, '0'),
            v_changed_by,
            'api'
        );
        RETURN NEW;
    END IF;

    -- Log quantity_needed changes
    IF TG_OP = 'UPDATE' AND COALESCE(OLD.quantity_needed, 0) != COALESCE(NEW.quantity_needed, 0) THEN
        INSERT INTO material_change_log (
            job_material_id, work_order_id, inventory_id,
            change_type, field_changed, old_value, new_value, changed_by, source
        ) VALUES (
            NEW.id, NEW.work_order_id, NEW.inventory_id,
            'quantity_needed_changed', 'quantity_needed',
            OLD.quantity_needed::TEXT, NEW.quantity_needed::TEXT,
            v_changed_by,
            'api'
        );
    END IF;

    -- Log quantity_allocated changes
    IF TG_OP = 'UPDATE' AND COALESCE(OLD.quantity_allocated, 0) != COALESCE(NEW.quantity_allocated, 0) THEN
        INSERT INTO material_change_log (
            job_material_id, work_order_id, inventory_id,
            change_type, field_changed, old_value, new_value, changed_by, source
        ) VALUES (
            NEW.id, NEW.work_order_id, NEW.inventory_id,
            'quantity_allocated_changed', 'quantity_allocated',
            COALESCE(OLD.quantity_allocated, 0)::TEXT, COALESCE(NEW.quantity_allocated, 0)::TEXT,
            v_changed_by,
            'api'
        );
    END IF;

    -- Log quantity_used changes
    IF TG_OP = 'UPDATE' AND COALESCE(OLD.quantity_used, 0) != COALESCE(NEW.quantity_used, 0) THEN
        INSERT INTO material_change_log (
            job_material_id, work_order_id, inventory_id,
            change_type, field_changed, old_value, new_value, changed_by, source
        ) VALUES (
            NEW.id, NEW.work_order_id, NEW.inventory_id,
            'quantity_used_changed', 'quantity_used',
            COALESCE(OLD.quantity_used, 0)::TEXT, COALESCE(NEW.quantity_used, 0)::TEXT,
            v_changed_by,
            'api'
        );
    END IF;

    -- Log status changes
    IF TG_OP = 'UPDATE' AND COALESCE(OLD.status, '') != COALESCE(NEW.status, '') THEN
        INSERT INTO material_change_log (
            job_material_id, work_order_id, inventory_id,
            change_type, field_changed, old_value, new_value, changed_by, source
        ) VALUES (
            NEW.id, NEW.work_order_id, NEW.inventory_id,
            'status_changed', 'status',
            OLD.status, NEW.status,
            v_changed_by,
            'api'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (drop first if exists to allow re-running)
DROP TRIGGER IF EXISTS trigger_log_material_changes ON job_materials_used;
CREATE TRIGGER trigger_log_material_changes
    AFTER INSERT OR UPDATE ON job_materials_used
    FOR EACH ROW
    EXECUTE FUNCTION log_material_changes();

-- ============================================================
-- 3. JOB VARIANCE VIEW (Projected vs Actual)
-- ============================================================
CREATE OR REPLACE VIEW job_variance_view AS
SELECT
    wo.id AS work_order_id,
    wo.work_order_number,
    wo.job_type,
    wo.status,
    wo.scheduled_date,
    wo.completed_at AS completed_date,

    -- Customer Info
    c.id AS customer_id,
    COALESCE(c.company_name, c.first_name || ' ' || c.last_name) AS customer_name,
    wo.service_address,

    -- ============================================================
    -- HOURS COMPARISON
    -- ============================================================
    -- Projected Hours: Sum from job_schedule_dates, fallback to estimated_duration_hours
    COALESCE(hours_proj.total_projected_hours, wo.estimated_duration_hours, 0) AS projected_hours,
    -- Actual Hours: Sum from time_entries
    COALESCE(hours_act.total_actual_hours, 0) AS actual_hours,
    -- Hours Variance (positive = over, negative = under)
    COALESCE(hours_act.total_actual_hours, 0) - COALESCE(hours_proj.total_projected_hours, wo.estimated_duration_hours, 0) AS hours_variance,
    -- Hours Variance Percentage
    CASE
        WHEN COALESCE(hours_proj.total_projected_hours, wo.estimated_duration_hours, 0) > 0
        THEN ROUND(((COALESCE(hours_act.total_actual_hours, 0) - COALESCE(hours_proj.total_projected_hours, wo.estimated_duration_hours, 0))
                    / COALESCE(hours_proj.total_projected_hours, wo.estimated_duration_hours, 1)) * 100, 2)
        ELSE 0
    END AS hours_variance_percent,

    -- ============================================================
    -- LABOR COST COMPARISON
    -- ============================================================
    -- Projected Labor Cost: quoted_labor_cost from work_orders
    COALESCE(wo.quoted_labor_cost, 0) AS projected_labor_cost,
    -- Actual Labor Cost: Sum of pay_amount from time_entries
    COALESCE(labor_act.total_pay_amount, 0) AS actual_labor_cost,
    -- Labor Cost Variance
    COALESCE(labor_act.total_pay_amount, 0) - COALESCE(wo.quoted_labor_cost, 0) AS labor_cost_variance,
    -- Labor Cost Variance Percentage
    CASE
        WHEN COALESCE(wo.quoted_labor_cost, 0) > 0
        THEN ROUND(((COALESCE(labor_act.total_pay_amount, 0) - COALESCE(wo.quoted_labor_cost, 0))
                    / wo.quoted_labor_cost) * 100, 2)
        ELSE 0
    END AS labor_cost_variance_percent,

    -- ============================================================
    -- LABOR REVENUE COMPARISON
    -- ============================================================
    -- Projected Labor Revenue (using quoted hours * standard rate estimate)
    COALESCE(wo.quoted_labor_cost, 0) * 1.5 AS projected_labor_revenue, -- Assuming ~50% markup
    -- Actual Labor Revenue: Sum of billable_amount from time_entries
    COALESCE(labor_act.total_billable_amount, 0) AS actual_labor_revenue,
    -- Labor Revenue Variance
    COALESCE(labor_act.total_billable_amount, 0) - (COALESCE(wo.quoted_labor_cost, 0) * 1.5) AS labor_revenue_variance,

    -- ============================================================
    -- MATERIAL COST COMPARISON
    -- ============================================================
    -- Projected Material Cost: quoted_material_cost OR sum of (quantity_needed * unit_cost)
    COALESCE(wo.quoted_material_cost, mat_proj.projected_material_cost, 0) AS projected_material_cost,
    -- Actual Material Cost: Sum of line_cost (quantity_used * unit_cost)
    COALESCE(mat_act.actual_material_cost, 0) AS actual_material_cost,
    -- Material Cost Variance
    COALESCE(mat_act.actual_material_cost, 0) - COALESCE(wo.quoted_material_cost, mat_proj.projected_material_cost, 0) AS material_cost_variance,
    -- Material Cost Variance Percentage
    CASE
        WHEN COALESCE(wo.quoted_material_cost, mat_proj.projected_material_cost, 0) > 0
        THEN ROUND(((COALESCE(mat_act.actual_material_cost, 0) - COALESCE(wo.quoted_material_cost, mat_proj.projected_material_cost, 0))
                    / COALESCE(wo.quoted_material_cost, mat_proj.projected_material_cost, 1)) * 100, 2)
        ELSE 0
    END AS material_cost_variance_percent,

    -- ============================================================
    -- MATERIAL REVENUE COMPARISON
    -- ============================================================
    -- Projected Material Revenue: sum of (quantity_needed * unit_price)
    COALESCE(mat_proj.projected_material_revenue, 0) AS projected_material_revenue,
    -- Actual Material Revenue: Sum of line_total (quantity_used * unit_price)
    COALESCE(mat_act.actual_material_revenue, 0) AS actual_material_revenue,
    -- Material Revenue Variance
    COALESCE(mat_act.actual_material_revenue, 0) - COALESCE(mat_proj.projected_material_revenue, 0) AS material_revenue_variance,

    -- ============================================================
    -- MATERIAL QUANTITY COMPARISON
    -- ============================================================
    COALESCE(mat_proj.total_quantity_needed, 0) AS projected_material_qty,
    COALESCE(mat_act.total_quantity_used, 0) AS actual_material_qty,
    COALESCE(mat_act.total_quantity_used, 0) - COALESCE(mat_proj.total_quantity_needed, 0) AS material_qty_variance,

    -- ============================================================
    -- TOTAL COMPARISONS
    -- ============================================================
    -- Projected Total Cost
    COALESCE(wo.quoted_labor_cost, 0) + COALESCE(wo.quoted_material_cost, mat_proj.projected_material_cost, 0) AS projected_total_cost,
    -- Actual Total Cost
    COALESCE(labor_act.total_pay_amount, 0) + COALESCE(mat_act.actual_material_cost, 0) AS actual_total_cost,
    -- Total Cost Variance
    (COALESCE(labor_act.total_pay_amount, 0) + COALESCE(mat_act.actual_material_cost, 0)) -
    (COALESCE(wo.quoted_labor_cost, 0) + COALESCE(wo.quoted_material_cost, mat_proj.projected_material_cost, 0)) AS total_cost_variance,

    -- Projected Total Revenue
    (COALESCE(wo.quoted_labor_cost, 0) * 1.5) + COALESCE(mat_proj.projected_material_revenue, 0) AS projected_total_revenue,
    -- Actual Total Revenue
    COALESCE(labor_act.total_billable_amount, 0) + COALESCE(mat_act.actual_material_revenue, 0) AS actual_total_revenue,
    -- Total Revenue Variance
    (COALESCE(labor_act.total_billable_amount, 0) + COALESCE(mat_act.actual_material_revenue, 0)) -
    ((COALESCE(wo.quoted_labor_cost, 0) * 1.5) + COALESCE(mat_proj.projected_material_revenue, 0)) AS total_revenue_variance,

    -- Metadata
    wo.created_at,
    wo.assigned_to

FROM work_orders wo
LEFT JOIN customers c ON wo.customer_id = c.id

-- Projected Hours from job_schedule_dates
LEFT JOIN (
    SELECT
        work_order_id,
        SUM(estimated_hours) AS total_projected_hours
    FROM job_schedule_dates
    GROUP BY work_order_id
) hours_proj ON wo.id = hours_proj.work_order_id

-- Actual Hours from time_entries
LEFT JOIN (
    SELECT
        work_order_id,
        SUM(hours_worked) AS total_actual_hours
    FROM time_entries
    WHERE work_order_id IS NOT NULL
    GROUP BY work_order_id
) hours_act ON wo.id = hours_act.work_order_id

-- Actual Labor from time_entries
LEFT JOIN (
    SELECT
        work_order_id,
        SUM(COALESCE(pay_amount, 0)) AS total_pay_amount,
        SUM(COALESCE(billable_amount, 0)) AS total_billable_amount
    FROM time_entries
    WHERE work_order_id IS NOT NULL
    GROUP BY work_order_id
) labor_act ON wo.id = labor_act.work_order_id

-- Projected Materials from job_materials_used (using quantity_needed)
LEFT JOIN (
    SELECT
        work_order_id,
        SUM(quantity_needed) AS total_quantity_needed,
        SUM(quantity_needed * COALESCE(unit_cost, 0)) AS projected_material_cost,
        SUM(quantity_needed * COALESCE(unit_price, 0)) AS projected_material_revenue
    FROM job_materials_used
    GROUP BY work_order_id
) mat_proj ON wo.id = mat_proj.work_order_id

-- Actual Materials from job_materials_used (using quantity_used)
LEFT JOIN (
    SELECT
        work_order_id,
        SUM(COALESCE(quantity_used, 0)) AS total_quantity_used,
        SUM(COALESCE(line_cost, 0)) AS actual_material_cost,
        SUM(COALESCE(line_total, 0)) AS actual_material_revenue
    FROM job_materials_used
    WHERE status IN ('used', 'billed')
    GROUP BY work_order_id
) mat_act ON wo.id = mat_act.work_order_id

ORDER BY wo.scheduled_date DESC NULLS LAST, wo.work_order_number DESC;

-- ============================================================
-- 4. INDEXES FOR VARIANCE VIEW PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_job_schedule_dates_work_order ON job_schedule_dates(work_order_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_work_order_id ON time_entries(work_order_id);
CREATE INDEX IF NOT EXISTS idx_job_materials_work_order_status ON job_materials_used(work_order_id, status);
