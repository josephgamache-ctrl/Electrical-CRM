-- Migration: Add Time Tracking System (FIXED FOR ACTUAL SCHEMA)
-- Created: 2025-12-06
-- Purpose: Enable employees to track hours worked per job with week-based locking

-- ============================================================
-- DROP EXISTING OBJECTS IF RERUNNING
-- ============================================================
DROP VIEW IF EXISTS daily_time_detail CASCADE;
DROP VIEW IF EXISTS job_labor_summary CASCADE;
DROP VIEW IF EXISTS weekly_timecard_summary CASCADE;
DROP TABLE IF EXISTS time_entries CASCADE;
DROP TABLE IF EXISTS employee_pay_rates CASCADE;
DROP TABLE IF EXISTS job_billing_rates CASCADE;
DROP FUNCTION IF EXISTS calculate_week_ending(DATE);
DROP FUNCTION IF EXISTS set_week_ending_date();
DROP FUNCTION IF EXISTS prevent_locked_time_entry_changes();
DROP FUNCTION IF EXISTS lock_completed_weeks();
DROP FUNCTION IF EXISTS update_time_entry_modified();
DROP FUNCTION IF EXISTS get_current_pay_rate(VARCHAR);
DROP FUNCTION IF EXISTS get_job_billable_rate(VARCHAR, VARCHAR);

-- ============================================================
-- TIME ENTRIES TABLE
-- ============================================================
CREATE TABLE time_entries (
    id SERIAL PRIMARY KEY,

    -- Foreign Keys
    work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    employee_username VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,

    -- Time Tracking
    work_date DATE NOT NULL,
    hours_worked DECIMAL(5, 2) NOT NULL CHECK (hours_worked > 0 AND hours_worked <= 24),

    -- Billing & Payroll Rates (captured at time of entry)
    billable_rate DECIMAL(10, 2),  -- Rate charged to customer ($/hr)
    pay_rate DECIMAL(10, 2),       -- Rate paid to employee ($/hr)

    -- Calculated fields
    billable_amount DECIMAL(10, 2) GENERATED ALWAYS AS (hours_worked * COALESCE(billable_rate, 0)) STORED,
    pay_amount DECIMAL(10, 2) GENERATED ALWAYS AS (hours_worked * COALESCE(pay_rate, 0)) STORED,

    -- Week locking
    week_ending_date DATE NOT NULL,
    is_locked BOOLEAN DEFAULT FALSE,

    -- Optional fields
    notes TEXT,
    break_minutes INTEGER DEFAULT 0,

    -- Audit trail
    created_by VARCHAR(50) REFERENCES users(username),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_modified_by VARCHAR(50) REFERENCES users(username),
    last_modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Prevent duplicate entries
    UNIQUE(work_order_id, employee_username, work_date)
);

-- Indexes for performance
CREATE INDEX idx_time_entries_employee ON time_entries(employee_username);
CREATE INDEX idx_time_entries_work_order ON time_entries(work_order_id);
CREATE INDEX idx_time_entries_work_date ON time_entries(work_date);
CREATE INDEX idx_time_entries_week_ending ON time_entries(week_ending_date);
CREATE INDEX idx_time_entries_employee_week ON time_entries(employee_username, week_ending_date);
CREATE INDEX idx_time_entries_locked ON time_entries(is_locked);
CREATE INDEX idx_time_entries_employee_week_date ON time_entries(employee_username, week_ending_date, work_date);

-- ============================================================
-- EMPLOYEE PAY RATES TABLE
-- ============================================================
CREATE TABLE employee_pay_rates (
    id SERIAL PRIMARY KEY,
    employee_username VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,

    -- Rate information
    hourly_rate DECIMAL(10, 2) NOT NULL CHECK (hourly_rate >= 0),
    overtime_rate DECIMAL(10, 2),

    -- Effective date range
    effective_from DATE NOT NULL,
    effective_to DATE,  -- NULL means current rate

    -- Job/role based rates (optional)
    job_title VARCHAR(100),
    rate_type VARCHAR(50) DEFAULT 'hourly',

    -- Audit
    created_by VARCHAR(50) REFERENCES users(username),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

CREATE INDEX idx_employee_pay_rates_employee ON employee_pay_rates(employee_username);
CREATE INDEX idx_employee_pay_rates_effective ON employee_pay_rates(effective_from, effective_to);

-- ============================================================
-- JOB BILLING RATES TABLE
-- ============================================================
CREATE TABLE job_billing_rates (
    id SERIAL PRIMARY KEY,

    -- Rate scope
    rate_name VARCHAR(100) NOT NULL,
    rate_type VARCHAR(50) NOT NULL DEFAULT 'default',  -- default, customer, job_type, custom

    -- Rates
    hourly_billable_rate DECIMAL(10, 2) NOT NULL CHECK (hourly_billable_rate >= 0),

    -- Optional overrides (customer_id instead of customer_name)
    customer_id INTEGER REFERENCES customers(id),
    job_type VARCHAR(50),

    -- Effective date range
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,

    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_by VARCHAR(50) REFERENCES users(username),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_job_billing_rates_type ON job_billing_rates(rate_type);
CREATE INDEX idx_job_billing_rates_customer ON job_billing_rates(customer_id);
CREATE INDEX idx_job_billing_rates_job_type ON job_billing_rates(job_type);
CREATE INDEX idx_job_billing_rates_effective ON job_billing_rates(effective_from, effective_to);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Function to calculate week ending date (next Sunday)
CREATE OR REPLACE FUNCTION calculate_week_ending(input_date DATE)
RETURNS DATE AS $$
BEGIN
    RETURN input_date + (7 - EXTRACT(DOW FROM input_date)::INTEGER) % 7;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to auto-set week_ending_date on insert/update
CREATE OR REPLACE FUNCTION set_week_ending_date()
RETURNS TRIGGER AS $$
BEGIN
    NEW.week_ending_date := calculate_week_ending(NEW.work_date);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_week_ending_date
    BEFORE INSERT OR UPDATE OF work_date ON time_entries
    FOR EACH ROW
    EXECUTE FUNCTION set_week_ending_date();

-- Function to prevent editing locked time entries
CREATE OR REPLACE FUNCTION prevent_locked_time_entry_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_locked = TRUE THEN
        RAISE EXCEPTION 'Cannot modify locked time entry. Week has been closed for payroll.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_locked_changes
    BEFORE UPDATE ON time_entries
    FOR EACH ROW
    WHEN (OLD.is_locked = TRUE)
    EXECUTE FUNCTION prevent_locked_time_entry_changes();

-- Function to auto-lock time entries after week ends
CREATE OR REPLACE FUNCTION lock_completed_weeks()
RETURNS INTEGER AS $$
DECLARE
    rows_locked INTEGER;
BEGIN
    UPDATE time_entries
    SET is_locked = TRUE
    WHERE is_locked = FALSE
      AND week_ending_date < CURRENT_DATE
      AND EXTRACT(DOW FROM CURRENT_DATE) = 1;

    GET DIAGNOSTICS rows_locked = ROW_COUNT;
    RETURN rows_locked;
END;
$$ LANGUAGE plpgsql;

-- Function to update last_modified timestamp
CREATE OR REPLACE FUNCTION update_time_entry_modified()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_modified_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_time_entry_modified
    BEFORE UPDATE ON time_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_time_entry_modified();

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

-- Function to get current billable rate for a job (using customer_id)
CREATE OR REPLACE FUNCTION get_job_billable_rate(job_type_param VARCHAR, cust_id INTEGER)
RETURNS DECIMAL AS $$
DECLARE
    billable_rate DECIMAL(10, 2);
BEGIN
    -- Priority: 1) Customer-specific, 2) Job-type-specific, 3) Default
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
-- SEED DATA FOR DEFAULT BILLING RATES
-- ============================================================

DO $$
DECLARE
    seed_user TEXT;
BEGIN
    SELECT username INTO seed_user
    FROM users
    ORDER BY created_at ASC
    LIMIT 1;

    IF seed_user IS NULL THEN
        RAISE NOTICE 'Skipping time tracking seed data (no users found).';
        RETURN;
    END IF;

    INSERT INTO job_billing_rates (rate_name, rate_type, hourly_billable_rate, notes, created_by) VALUES
        ('Standard Residential', 'default', 95.00, 'Default billable rate for residential work', seed_user),
        ('Commercial', 'job_type', 125.00, 'Commercial/industrial work rate', seed_user),
        ('Emergency Service', 'job_type', 150.00, 'After-hours and emergency calls', seed_user),
        ('Service Call', 'job_type', 85.00, 'Simple service calls and repairs', seed_user)
    ON CONFLICT DO NOTHING;

    -- ============================================================
    -- SEED DATA FOR EMPLOYEE PAY RATES
    -- ============================================================

    INSERT INTO employee_pay_rates (employee_username, hourly_rate, overtime_rate, job_title, effective_from, created_by, notes) VALUES
        (seed_user, 0.00, 0.00, 'Owner/Admin', '2024-01-01', seed_user, 'Initial placeholder rate - update in UI')
    ON CONFLICT DO NOTHING;
END $$;

-- ============================================================
-- VIEWS FOR COMMON QUERIES (FIXED FOR ACTUAL SCHEMA)
-- ============================================================

-- View: Weekly timecard summary per employee
CREATE OR REPLACE VIEW weekly_timecard_summary AS
SELECT
    te.employee_username,
    u.full_name,
    te.week_ending_date,
    COUNT(DISTINCT te.work_date) as days_worked,
    SUM(te.hours_worked) as total_hours,
    SUM(te.billable_amount) as total_billable,
    SUM(te.pay_amount) as total_pay,
    te.is_locked
FROM time_entries te
JOIN users u ON te.employee_username = u.username
GROUP BY te.employee_username, u.full_name, te.week_ending_date, te.is_locked
ORDER BY te.week_ending_date DESC, u.full_name;

-- View: Job labor cost summary (FIXED for customer_id)
CREATE OR REPLACE VIEW job_labor_summary AS
SELECT
    wo.id as work_order_id,
    wo.work_order_number,
    c.first_name || ' ' || c.last_name as customer_name,
    c.company_name,
    wo.service_address,
    wo.job_type,
    wo.status,
    COUNT(DISTINCT te.employee_username) as employee_count,
    COUNT(DISTINCT te.work_date) as work_days,
    SUM(te.hours_worked) as total_hours,
    SUM(te.billable_amount) as total_labor_billable,
    SUM(te.pay_amount) as total_labor_cost,
    SUM(te.billable_amount) - SUM(te.pay_amount) as labor_margin
FROM work_orders wo
LEFT JOIN time_entries te ON wo.id = te.work_order_id
LEFT JOIN customers c ON wo.customer_id = c.id
GROUP BY wo.id, wo.work_order_number, c.first_name, c.last_name, c.company_name, wo.service_address, wo.job_type, wo.status
ORDER BY wo.work_order_number;

-- View: Daily time entry detail (FIXED for customer_id)
CREATE OR REPLACE VIEW daily_time_detail AS
SELECT
    te.id,
    te.work_date,
    te.employee_username,
    u.full_name as employee_name,
    wo.work_order_number,
    c.first_name || ' ' || c.last_name as customer_name,
    c.company_name,
    wo.service_address,
    wo.job_type,
    te.hours_worked,
    te.billable_rate,
    te.pay_rate,
    te.billable_amount,
    te.pay_amount,
    te.notes,
    te.is_locked,
    te.week_ending_date
FROM time_entries te
JOIN users u ON te.employee_username = u.username
JOIN work_orders wo ON te.work_order_id = wo.id
JOIN customers c ON wo.customer_id = c.id
ORDER BY te.work_date DESC, u.full_name, wo.work_order_number;

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

GRANT ALL PRIVILEGES ON TABLE time_entries TO postgres;
GRANT ALL PRIVILEGES ON TABLE employee_pay_rates TO postgres;
GRANT ALL PRIVILEGES ON TABLE job_billing_rates TO postgres;
GRANT ALL PRIVILEGES ON SEQUENCE time_entries_id_seq TO postgres;
GRANT ALL PRIVILEGES ON SEQUENCE employee_pay_rates_id_seq TO postgres;
GRANT ALL PRIVILEGES ON SEQUENCE job_billing_rates_id_seq TO postgres;

-- Grant SELECT on views
GRANT SELECT ON weekly_timecard_summary TO postgres;
GRANT SELECT ON job_labor_summary TO postgres;
GRANT SELECT ON daily_time_detail TO postgres;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Time Tracking Migration Complete!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Created:';
    RAISE NOTICE '  - time_entries table';
    RAISE NOTICE '  - employee_pay_rates table';
    RAISE NOTICE '  - job_billing_rates table';
    RAISE NOTICE '  - Helper functions for rate lookups';
    RAISE NOTICE '  - Views for reporting';
    RAISE NOTICE '';
    RAISE NOTICE 'Seeded:';
    RAISE NOTICE '  - 4 default billing rates';
    RAISE NOTICE '  - 1 placeholder employee pay rate';
    RAISE NOTICE '========================================';
END $$;
