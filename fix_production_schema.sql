-- Fix production schema - add missing tables

-- Labor Tracking (without GENERATED columns for compatibility)
CREATE TABLE IF NOT EXISTS labor_tracking (
    id SERIAL PRIMARY KEY,
    work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    technician VARCHAR(50) NOT NULL REFERENCES users(username),
    clock_in_time TIMESTAMP NOT NULL,
    clock_out_time TIMESTAMP,
    hours_worked DECIMAL(5,2) DEFAULT 0,
    break_minutes INTEGER DEFAULT 0,
    billable_hours DECIMAL(5,2) DEFAULT 0,
    hourly_rate DECIMAL(8,2) NOT NULL DEFAULT 0,
    overtime_hours DECIMAL(5,2) DEFAULT 0.00,
    overtime_rate DECIMAL(8,2) DEFAULT 0.00,
    labor_cost DECIMAL(10,2) DEFAULT 0,
    clock_in_latitude DECIMAL(10, 8),
    clock_in_longitude DECIMAL(11, 8),
    clock_out_latitude DECIMAL(10, 8),
    clock_out_longitude DECIMAL(11, 8),
    work_performed TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by VARCHAR(50) REFERENCES users(username),
    approved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_labor_tracking_work_order ON labor_tracking(work_order_id);
CREATE INDEX IF NOT EXISTS idx_labor_tracking_technician ON labor_tracking(technician);
CREATE INDEX IF NOT EXISTS idx_labor_tracking_clock_in ON labor_tracking(clock_in_time);

-- Time entries table (used by backend)
CREATE TABLE IF NOT EXISTS time_entries (
    id SERIAL PRIMARY KEY,
    work_order_id INTEGER REFERENCES work_orders(id) ON DELETE CASCADE,
    employee_username VARCHAR(50) NOT NULL REFERENCES users(username),
    work_date DATE NOT NULL,
    hours_worked DECIMAL(5,2) NOT NULL DEFAULT 0,
    overtime_hours DECIMAL(5,2) DEFAULT 0,
    week_ending_date DATE,
    notes TEXT,
    created_by VARCHAR(50) REFERENCES users(username),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    locked BOOLEAN DEFAULT FALSE,
    submitted BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_time_entries_employee ON time_entries(employee_username);
CREATE INDEX IF NOT EXISTS idx_time_entries_work_date ON time_entries(work_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_week_ending ON time_entries(week_ending_date);

-- Work Order Activity
CREATE TABLE IF NOT EXISTS work_order_activity (
    id SERIAL PRIMARY KEY,
    work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    performed_by VARCHAR(50) REFERENCES users(username),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_work_order_activity_wo ON work_order_activity(work_order_id);

-- Cycle Count Settings
CREATE TABLE IF NOT EXISTS cycle_count_settings (
    abc_class VARCHAR(1) PRIMARY KEY CHECK (abc_class IN ('A', 'B', 'C')),
    count_frequency_days INTEGER NOT NULL CHECK (count_frequency_days > 0),
    tolerance_percent DECIMAL(5, 2) NOT NULL CHECK (tolerance_percent >= 0),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(50) REFERENCES users(username)
);

INSERT INTO cycle_count_settings (abc_class, count_frequency_days, tolerance_percent)
VALUES ('A', 7, 2.0), ('B', 30, 5.0), ('C', 90, 10.0)
ON CONFLICT (abc_class) DO NOTHING;

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_username VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT,
    related_type VARCHAR(50),
    related_id INTEGER,
    is_read BOOLEAN DEFAULT FALSE,
    is_dismissed BOOLEAN DEFAULT FALSE,
    priority VARCHAR(20) DEFAULT 'normal',
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_username);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_username, is_read) WHERE is_read = FALSE;

-- Work Order Photos
CREATE TABLE IF NOT EXISTS work_order_photos (
    id SERIAL PRIMARY KEY,
    work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    file_path TEXT,
    photo_type VARCHAR(50) DEFAULT 'general',
    caption TEXT,
    uploaded_by VARCHAR(50) REFERENCES users(username),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_work_order_photos_wo ON work_order_photos(work_order_id);

-- Work Order Notes
CREATE TABLE IF NOT EXISTS work_order_notes (
    id SERIAL PRIMARY KEY,
    work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    note_type VARCHAR(50) DEFAULT 'internal',
    content TEXT NOT NULL,
    created_by VARCHAR(50) REFERENCES users(username),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_work_order_notes_wo ON work_order_notes(work_order_id);

-- Work Order Tasks
CREATE TABLE IF NOT EXISTS work_order_tasks (
    id SERIAL PRIMARY KEY,
    work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_by VARCHAR(50) REFERENCES users(username),
    completed_at TIMESTAMP,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_work_order_tasks_wo ON work_order_tasks(work_order_id);

-- Quotes System
CREATE TABLE IF NOT EXISTS quotes (
    id SERIAL PRIMARY KEY,
    quote_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id),
    customer_site_id INTEGER REFERENCES customer_sites(id),
    title VARCHAR(200),
    job_description TEXT,
    scope_of_work TEXT,
    service_address TEXT,
    job_type VARCHAR(50),
    quote_date DATE DEFAULT CURRENT_DATE,
    valid_until DATE,
    estimated_start_date DATE,
    estimated_duration_days INTEGER,
    labor_cost DECIMAL(12,2) DEFAULT 0,
    material_cost DECIMAL(12,2) DEFAULT 0,
    equipment_cost DECIMAL(12,2) DEFAULT 0,
    other_cost DECIMAL(12,2) DEFAULT 0,
    subtotal DECIMAL(12,2) DEFAULT 0,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 6.25,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft',
    customer_approved BOOLEAN DEFAULT FALSE,
    customer_approved_at TIMESTAMP,
    customer_signature TEXT,
    selected_tier VARCHAR(20),
    converted_to_work_order_id INTEGER REFERENCES work_orders(id),
    converted_at TIMESTAMP,
    notes TEXT,
    internal_notes TEXT,
    created_by VARCHAR(50) REFERENCES users(username),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(50) REFERENCES users(username),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,
    viewed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_number ON quotes(quote_number);

-- Quote Line Items
CREATE TABLE IF NOT EXISTS quote_line_items (
    id SERIAL PRIMARY KEY,
    quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL,
    inventory_id INTEGER REFERENCES inventory(id),
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) DEFAULT 1,
    unit VARCHAR(20) DEFAULT 'each',
    unit_cost DECIMAL(12,2) DEFAULT 0,
    unit_price DECIMAL(12,2) DEFAULT 0,
    markup_percent DECIMAL(5,2) DEFAULT 0,
    tier_basic BOOLEAN DEFAULT TRUE,
    tier_standard BOOLEAN DEFAULT TRUE,
    tier_premium BOOLEAN DEFAULT TRUE,
    is_optional BOOLEAN DEFAULT FALSE,
    line_order INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quote_line_items_quote ON quote_line_items(quote_id);

-- Communication Settings
CREATE TABLE IF NOT EXISTS communication_settings (
    id SERIAL PRIMARY KEY,
    setting_type VARCHAR(20) NOT NULL UNIQUE,
    provider VARCHAR(50),
    config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT FALSE,
    test_status VARCHAR(20),
    test_message TEXT,
    last_tested_at TIMESTAMP,
    updated_by VARCHAR(50) REFERENCES users(username),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Communication Log
CREATE TABLE IF NOT EXISTS communication_log (
    id SERIAL PRIMARY KEY,
    communication_type VARCHAR(20) NOT NULL,
    recipient_type VARCHAR(50),
    recipient_id INTEGER,
    recipient_address VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    body TEXT,
    related_type VARCHAR(50),
    related_id INTEGER,
    status VARCHAR(20) DEFAULT 'pending',
    provider_message_id VARCHAR(255),
    error_message TEXT,
    sent_by VARCHAR(50) REFERENCES users(username),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_communication_log_type ON communication_log(communication_type);
CREATE INDEX IF NOT EXISTS idx_communication_log_status ON communication_log(status);

-- Email Templates
CREATE TABLE IF NOT EXISTS email_templates (
    id SERIAL PRIMARY KEY,
    template_name VARCHAR(100) UNIQUE NOT NULL,
    subject_template TEXT,
    body_template TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    updated_by VARCHAR(50) REFERENCES users(username),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Manager-Worker Assignments
CREATE TABLE IF NOT EXISTS manager_worker_assignments (
    id SERIAL PRIMARY KEY,
    manager_username VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    worker_username VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by VARCHAR(50) REFERENCES users(username),
    UNIQUE(manager_username, worker_username)
);

-- Job Schedule Dates
CREATE TABLE IF NOT EXISTS job_schedule_dates (
    id SERIAL PRIMARY KEY,
    work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    status VARCHAR(20) DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_job_schedule_dates_wo ON job_schedule_dates(work_order_id);
CREATE INDEX IF NOT EXISTS idx_job_schedule_dates_date ON job_schedule_dates(scheduled_date);

-- Job Schedule Crew
CREATE TABLE IF NOT EXISTS job_schedule_crew (
    id SERIAL PRIMARY KEY,
    job_schedule_date_id INTEGER NOT NULL REFERENCES job_schedule_dates(id) ON DELETE CASCADE,
    employee_username VARCHAR(50) NOT NULL REFERENCES users(username),
    is_lead_for_day BOOLEAN DEFAULT FALSE,
    scheduled_hours DECIMAL(5,2) DEFAULT 8.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(job_schedule_date_id, employee_username)
);

-- Employee Availability
CREATE TABLE IF NOT EXISTS employee_availability (
    id SERIAL PRIMARY KEY,
    employee_username VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    unavailable_date DATE NOT NULL,
    reason VARCHAR(100),
    all_day BOOLEAN DEFAULT TRUE,
    start_time TIME,
    end_time TIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employee_availability_emp ON employee_availability(employee_username);
CREATE INDEX IF NOT EXISTS idx_employee_availability_date ON employee_availability(unavailable_date);

-- Schedule Contradictions
CREATE TABLE IF NOT EXISTS schedule_contradictions (
    id SERIAL PRIMARY KEY,
    employee_username VARCHAR(50) NOT NULL REFERENCES users(username),
    conflict_date DATE NOT NULL,
    work_order_ids INTEGER[] NOT NULL,
    total_scheduled_hours DECIMAL(5,2),
    resolution_status VARCHAR(20) DEFAULT 'unresolved',
    resolved_by VARCHAR(50) REFERENCES users(username),
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job Templates
CREATE TABLE IF NOT EXISTS job_templates (
    id SERIAL PRIMARY KEY,
    template_name VARCHAR(100) NOT NULL,
    job_type VARCHAR(50),
    description TEXT,
    scope_of_work TEXT,
    estimated_hours DECIMAL(5,2),
    default_materials JSONB DEFAULT '[]',
    created_by VARCHAR(50) REFERENCES users(username),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT TRUE
);

-- Schema Migrations tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200),
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INTEGER,
    rolled_back BOOLEAN DEFAULT FALSE,
    rolled_back_at TIMESTAMP
);

-- Add missing columns to work_orders if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'emergency_call') THEN
        ALTER TABLE work_orders ADD COLUMN emergency_call BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'assigned_to') THEN
        ALTER TABLE work_orders ADD COLUMN assigned_to VARCHAR(50) REFERENCES users(username);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'helper_1') THEN
        ALTER TABLE work_orders ADD COLUMN helper_1 VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'helper_2') THEN
        ALTER TABLE work_orders ADD COLUMN helper_2 VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'scheduled_date') THEN
        ALTER TABLE work_orders ADD COLUMN scheduled_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'customer_id') THEN
        ALTER TABLE work_orders ADD COLUMN customer_id INTEGER REFERENCES customers(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'service_address') THEN
        ALTER TABLE work_orders ADD COLUMN service_address TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'job_description') THEN
        ALTER TABLE work_orders ADD COLUMN job_description TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'created_by') THEN
        ALTER TABLE work_orders ADD COLUMN created_by VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'total_amount') THEN
        ALTER TABLE work_orders ADD COLUMN total_amount DECIMAL(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'actual_labor_cost') THEN
        ALTER TABLE work_orders ADD COLUMN actual_labor_cost DECIMAL(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'actual_material_cost') THEN
        ALTER TABLE work_orders ADD COLUMN actual_material_cost DECIMAL(12,2) DEFAULT 0;
    END IF;
END $$;

-- Add missing columns to inventory if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'abc_class') THEN
        ALTER TABLE inventory ADD COLUMN abc_class VARCHAR(1) DEFAULT 'C';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'next_count_date') THEN
        ALTER TABLE inventory ADD COLUMN next_count_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'avg_daily_usage') THEN
        ALTER TABLE inventory ADD COLUMN avg_daily_usage DECIMAL(10,4) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'commonly_used') THEN
        ALTER TABLE inventory ADD COLUMN commonly_used BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add vendors seed data
INSERT INTO vendors (vendor_name, city, state, payment_terms, preferred, active)
VALUES
    ('Granite City Electric', 'Quincy', 'MA', 'Net 30', TRUE, TRUE),
    ('Concord Electrical Supply', 'Concord', 'MA', 'Net 30', TRUE, TRUE)
ON CONFLICT (vendor_name) DO NOTHING;

SELECT 'Schema fix completed successfully' as status;
