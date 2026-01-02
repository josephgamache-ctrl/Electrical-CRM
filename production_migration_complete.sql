-- Complete Production Migration - Add all missing structures without dropping existing data
-- Created: 2024-12-29

-- ============================================================
-- EMPLOYEE PAY RATES TABLE (new)
-- ============================================================
CREATE TABLE IF NOT EXISTS employee_pay_rates (
    id SERIAL PRIMARY KEY,
    employee_username VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    hourly_rate DECIMAL(10, 2) NOT NULL CHECK (hourly_rate >= 0),
    overtime_rate DECIMAL(10, 2),
    effective_from DATE NOT NULL,
    effective_to DATE,
    job_title VARCHAR(100),
    rate_type VARCHAR(50) DEFAULT 'hourly',
    created_by VARCHAR(50) REFERENCES users(username),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_employee_pay_rates_employee ON employee_pay_rates(employee_username);
CREATE INDEX IF NOT EXISTS idx_employee_pay_rates_effective ON employee_pay_rates(effective_from, effective_to);

-- ============================================================
-- JOB BILLING RATES TABLE (new)
-- ============================================================
CREATE TABLE IF NOT EXISTS job_billing_rates (
    id SERIAL PRIMARY KEY,
    rate_name VARCHAR(100) NOT NULL,
    rate_type VARCHAR(50) NOT NULL DEFAULT 'default',
    hourly_billable_rate DECIMAL(10, 2) NOT NULL CHECK (hourly_billable_rate >= 0),
    customer_id INTEGER REFERENCES customers(id),
    job_type VARCHAR(50),
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_by VARCHAR(50) REFERENCES users(username),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_job_billing_rates_type ON job_billing_rates(rate_type);
CREATE INDEX IF NOT EXISTS idx_job_billing_rates_customer ON job_billing_rates(customer_id);
CREATE INDEX IF NOT EXISTS idx_job_billing_rates_job_type ON job_billing_rates(job_type);

-- ============================================================
-- PURCHASE ORDER ITEMS TABLE (new)
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id SERIAL PRIMARY KEY,
    purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    inventory_id INTEGER NOT NULL REFERENCES inventory(id),
    quantity_ordered INTEGER NOT NULL,
    unit_cost DECIMAL(10,2) NOT NULL,
    line_total DECIMAL(10,2),
    quantity_received INTEGER DEFAULT 0,
    received_date TIMESTAMP,
    received_by VARCHAR(50) REFERENCES users(username),
    linked_work_order_ids JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_poi_purchase_order ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_poi_inventory ON purchase_order_items(inventory_id);

-- ============================================================
-- ADD MISSING COLUMNS TO TIME_ENTRIES
-- ============================================================
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS billable_rate DECIMAL(10, 2);
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS pay_rate DECIMAL(10, 2);
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS billable_amount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS pay_amount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS break_minutes INTEGER DEFAULT 0;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS last_modified_by VARCHAR(50);
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMP;

-- ============================================================
-- ADD MISSING COLUMNS TO PURCHASE_ORDERS
-- ============================================================
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS needs_approval BOOLEAN DEFAULT FALSE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_by VARCHAR(50);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS triggered_by_projection BOOLEAN DEFAULT FALSE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS projection_start_date DATE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS projection_end_date DATE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS created_by VARCHAR(50);

-- ============================================================
-- ADD MISSING COLUMNS TO INVOICES
-- ============================================================
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS balance_due DECIMAL(12,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS days_overdue INTEGER DEFAULT 0;

-- ============================================================
-- ADD MISSING COLUMNS TO WORK_ORDERS
-- ============================================================
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS quoted_subtotal DECIMAL(12,2) DEFAULT 0;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS actual_hours DECIMAL(5,2) DEFAULT 0;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS completed_date TIMESTAMP;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS actual_start_time TIMESTAMP;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS actual_end_time TIMESTAMP;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS start_date DATE;

-- ============================================================
-- ADD MISSING COLUMNS TO CUSTOMERS
-- ============================================================
ALTER TABLE customers ADD COLUMN IF NOT EXISTS vip BOOLEAN DEFAULT FALSE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_since DATE;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to calculate week ending date (next Sunday)
CREATE OR REPLACE FUNCTION calculate_week_ending(input_date DATE)
RETURNS DATE AS $$
BEGIN
    RETURN input_date + (7 - EXTRACT(DOW FROM input_date)::INTEGER) % 7;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get current pay rate for an employee
CREATE OR REPLACE FUNCTION get_current_pay_rate(emp_username VARCHAR)
RETURNS DECIMAL AS $$
DECLARE
    current_rate DECIMAL(10, 2);
BEGIN
    SELECT hourly_rate INTO current_rate
    FROM employee_pay_rates
    WHERE employee_username = emp_username
      AND effective_from <= CURRENT_DATE
      AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
    ORDER BY effective_from DESC
    LIMIT 1;

    RETURN COALESCE(current_rate, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to get current billable rate for a job
CREATE OR REPLACE FUNCTION get_job_billable_rate(job_type_param VARCHAR, cust_id INTEGER)
RETURNS DECIMAL AS $$
DECLARE
    billable_rate DECIMAL(10, 2);
BEGIN
    SELECT hourly_billable_rate INTO billable_rate
    FROM job_billing_rates
    WHERE is_active = TRUE
      AND effective_from <= CURRENT_DATE
      AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
      AND (
          (rate_type = 'customer' AND customer_id = cust_id)
          OR (rate_type = 'job_type' AND job_type = job_type_param)
          OR (rate_type = 'default')
      )
    ORDER BY
        CASE rate_type
            WHEN 'customer' THEN 1
            WHEN 'job_type' THEN 2
            WHEN 'default' THEN 3
        END,
        effective_from DESC
    LIMIT 1;

    RETURN COALESCE(billable_rate, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SEED DEFAULT BILLING RATES
-- ============================================================
INSERT INTO job_billing_rates (rate_name, rate_type, hourly_billable_rate, notes) VALUES
    ('Standard Residential', 'default', 95.00, 'Default billable rate for residential work'),
    ('Commercial', 'job_type', 125.00, 'Commercial/industrial work rate'),
    ('Emergency Service', 'job_type', 150.00, 'After-hours and emergency calls'),
    ('Service Call', 'job_type', 85.00, 'Simple service calls and repairs')
ON CONFLICT DO NOTHING;

-- ============================================================
-- ADDITIONAL INDEXES FOR REPORTING
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_time_entries_employee_week ON time_entries(employee_username, week_ending_date);
CREATE INDEX IF NOT EXISTS idx_jmu_status_inventory ON job_materials_used(status, inventory_id);
CREATE INDEX IF NOT EXISTS idx_wo_start_date_status ON work_orders(start_date, status);
CREATE INDEX IF NOT EXISTS idx_work_orders_scheduled_status ON work_orders(scheduled_date, status);
CREATE INDEX IF NOT EXISTS idx_work_orders_customer ON work_orders(customer_id, status);

SELECT 'Production migration complete!' as status;
