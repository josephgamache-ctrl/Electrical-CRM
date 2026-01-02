-- MA Electrical Inventory - Multi-Worker & Multi-Date Enhancement Migration
-- Created: 2024-12-11
-- Purpose: Allow unlimited workers per job and multiple scheduled dates per job
-- Based on industry best practices from ServiceTitan, Jobber, Housecall Pro

-- ============================================================
-- 1. WORK ORDER ASSIGNMENTS (Dynamic N-Worker Assignment)
-- ============================================================
-- Replaces the limited assigned_to, helper_1, helper_2 columns
-- Allows unlimited workers with role-based assignment

CREATE TABLE IF NOT EXISTS work_order_assignments (
    id SERIAL PRIMARY KEY,
    work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    employee_username VARCHAR(50) NOT NULL REFERENCES users(username),

    -- Role on this job
    assignment_role VARCHAR(30) DEFAULT 'technician',  -- lead, technician, helper, apprentice, supervisor
    is_lead BOOLEAN DEFAULT FALSE,  -- Primary responsible technician

    -- Assignment details
    assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by VARCHAR(50) REFERENCES users(username),

    -- Pay rates (snapshot at assignment time for billing)
    hourly_rate DECIMAL(8,2),  -- Employee's rate at time of assignment
    billable_rate DECIMAL(8,2),  -- What we charge customer for this employee

    -- Status
    status VARCHAR(20) DEFAULT 'assigned',  -- assigned, confirmed, declined, completed
    confirmed_at TIMESTAMP,

    -- Notes
    notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Each employee can only be assigned once per work order
    UNIQUE(work_order_id, employee_username)
);

CREATE INDEX idx_wo_assignments_work_order ON work_order_assignments(work_order_id);
CREATE INDEX idx_wo_assignments_employee ON work_order_assignments(employee_username);
CREATE INDEX idx_wo_assignments_status ON work_order_assignments(status);
CREATE INDEX idx_wo_assignments_lead ON work_order_assignments(work_order_id) WHERE is_lead = TRUE;

-- ============================================================
-- 2. JOB SCHEDULE DATES (Multi-Date Scheduling)
-- ============================================================
-- Allows jobs to span multiple days (consecutive or not)
-- Each date can have different crew assignments and time windows

CREATE TABLE IF NOT EXISTS job_schedule_dates (
    id SERIAL PRIMARY KEY,
    work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,

    -- Schedule Date & Time
    scheduled_date DATE NOT NULL,
    start_time TIME DEFAULT '08:00',
    end_time TIME DEFAULT '16:30',
    estimated_hours DECIMAL(5,2) DEFAULT 8.0,

    -- Phase/Stage (for multi-phase projects)
    phase_name VARCHAR(100),  -- "Rough-In", "Trim-Out", "Final", "Inspection"
    phase_order INTEGER DEFAULT 1,  -- Sequence order

    -- Day-specific details
    day_description TEXT,  -- What's planned for this specific day

    -- Status for this specific date
    status VARCHAR(20) DEFAULT 'scheduled',  -- scheduled, in_progress, completed, skipped, rescheduled

    -- Actual times
    actual_start_time TIMESTAMP,
    actual_end_time TIMESTAMP,

    -- Weather/conditions (for outdoor work)
    weather_conditions VARCHAR(100),
    work_conditions TEXT,

    -- Notes
    notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Each work order can only have one entry per date
    UNIQUE(work_order_id, scheduled_date)
);

CREATE INDEX idx_job_schedule_dates_work_order ON job_schedule_dates(work_order_id);
CREATE INDEX idx_job_schedule_dates_date ON job_schedule_dates(scheduled_date);
CREATE INDEX idx_job_schedule_dates_status ON job_schedule_dates(status);
CREATE INDEX idx_job_schedule_dates_phase ON job_schedule_dates(work_order_id, phase_order);

-- ============================================================
-- 3. SCHEDULE DATE CREW (Crew per scheduled date)
-- ============================================================
-- Links specific workers to specific dates on a job
-- Allows different crews on different days of the same job

CREATE TABLE IF NOT EXISTS job_schedule_crew (
    id SERIAL PRIMARY KEY,
    job_schedule_date_id INTEGER NOT NULL REFERENCES job_schedule_dates(id) ON DELETE CASCADE,
    employee_username VARCHAR(50) NOT NULL REFERENCES users(username),

    -- Role for this specific date
    role VARCHAR(30) DEFAULT 'technician',  -- lead, technician, helper, apprentice
    is_lead_for_day BOOLEAN DEFAULT FALSE,

    -- Scheduled hours for this date
    scheduled_hours DECIMAL(5,2) DEFAULT 8.0,

    -- Status
    status VARCHAR(20) DEFAULT 'scheduled',  -- scheduled, confirmed, checked_in, completed, no_show
    checked_in_at TIMESTAMP,
    checked_out_at TIMESTAMP,

    -- Actual hours worked this date
    actual_hours DECIMAL(5,2),
    break_minutes INTEGER DEFAULT 0,

    notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Each employee can only be scheduled once per job-date
    UNIQUE(job_schedule_date_id, employee_username)
);

CREATE INDEX idx_job_schedule_crew_date ON job_schedule_crew(job_schedule_date_id);
CREATE INDEX idx_job_schedule_crew_employee ON job_schedule_crew(employee_username);
CREATE INDEX idx_job_schedule_crew_status ON job_schedule_crew(status);

-- ============================================================
-- 4. EMPLOYEE SKILLS (For skill-based assignment)
-- ============================================================
-- Track what each technician is qualified to do

CREATE TABLE IF NOT EXISTS employee_skills (
    id SERIAL PRIMARY KEY,
    employee_username VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,

    -- Skill/Certification
    skill_name VARCHAR(100) NOT NULL,  -- "Panel Upgrades", "EV Charger Install", "Generator Install"
    skill_category VARCHAR(50),  -- electrical, low_voltage, specialty, safety

    -- Certification details
    certification_number VARCHAR(100),
    certified_date DATE,
    expiration_date DATE,
    issuing_authority VARCHAR(200),  -- "MA Division of Professional Licensure"

    -- Proficiency
    proficiency_level VARCHAR(20) DEFAULT 'intermediate',  -- beginner, intermediate, expert, master

    -- Status
    active BOOLEAN DEFAULT TRUE,
    verified BOOLEAN DEFAULT FALSE,
    verified_by VARCHAR(50) REFERENCES users(username),
    verified_date DATE,

    notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(employee_username, skill_name)
);

CREATE INDEX idx_employee_skills_employee ON employee_skills(employee_username);
CREATE INDEX idx_employee_skills_skill ON employee_skills(skill_name);
CREATE INDEX idx_employee_skills_expiration ON employee_skills(expiration_date) WHERE active = TRUE;

-- Seed common electrical skills
DO $$
DECLARE
    seed_user TEXT;
BEGIN
    SELECT username INTO seed_user
    FROM users
    ORDER BY created_at ASC
    LIMIT 1;

    IF seed_user IS NULL THEN
        RAISE NOTICE 'Skipping employee_skills seed data (no users found).';
        RETURN;
    END IF;

    INSERT INTO employee_skills (employee_username, skill_name, skill_category, proficiency_level, active)
    SELECT seed_user, skill_name, skill_category, 'master', TRUE
    FROM (VALUES
        ('Residential Wiring', 'electrical'),
        ('Panel Upgrades', 'electrical'),
        ('EV Charger Installation', 'specialty'),
        ('Generator Installation', 'specialty'),
        ('Low Voltage/Data', 'low_voltage'),
        ('Emergency Service', 'electrical'),
        ('Troubleshooting', 'electrical')
    ) AS skills(skill_name, skill_category)
    WHERE NOT EXISTS (
        SELECT 1
        FROM employee_skills
        WHERE employee_username = seed_user AND skill_name = skills.skill_name
    );
END $$;

-- ============================================================
-- 5. EMPLOYEE AVAILABILITY (Calendar-based availability)
-- ============================================================
-- Track when employees are available or unavailable

CREATE TABLE IF NOT EXISTS employee_availability (
    id SERIAL PRIMARY KEY,
    employee_username VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,

    -- Date range
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    -- Time (NULL means all day)
    start_time TIME,
    end_time TIME,

    -- Type
    availability_type VARCHAR(30) NOT NULL,  -- available, unavailable, vacation, sick, training, on_call

    -- Details
    reason TEXT,

    -- Recurrence (for regular schedules)
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern VARCHAR(50),  -- daily, weekly, monthly, yearly
    recurrence_days VARCHAR(20),  -- For weekly: "mon,tue,wed,thu,fri"
    recurrence_end_date DATE,

    -- Status
    approved BOOLEAN DEFAULT TRUE,
    approved_by VARCHAR(50) REFERENCES users(username),

    notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_employee_availability_employee ON employee_availability(employee_username);
CREATE INDEX idx_employee_availability_dates ON employee_availability(start_date, end_date);
CREATE INDEX idx_employee_availability_type ON employee_availability(availability_type);

-- ============================================================
-- 6. JOB TEMPLATES (For quick job creation)
-- ============================================================
-- Pre-defined templates for common job types

CREATE TABLE IF NOT EXISTS job_templates (
    id SERIAL PRIMARY KEY,
    template_name VARCHAR(100) NOT NULL UNIQUE,

    -- Job details
    job_type VARCHAR(50),
    job_description TEXT,
    scope_of_work TEXT,

    -- Estimated values
    estimated_hours DECIMAL(5,2),
    estimated_days INTEGER DEFAULT 1,

    -- Default crew size
    min_crew_size INTEGER DEFAULT 1,
    max_crew_size INTEGER DEFAULT 4,
    recommended_crew_size INTEGER DEFAULT 2,

    -- Required skills
    required_skills JSONB DEFAULT '[]'::jsonb,  -- ["Panel Upgrades", "Troubleshooting"]

    -- Default materials (links to inventory)
    default_materials JSONB DEFAULT '[]'::jsonb,  -- [{inventory_id, quantity}]

    -- Pricing defaults
    base_labor_rate DECIMAL(8,2),
    estimated_material_cost DECIMAL(10,2),

    -- Compliance
    typically_requires_permit BOOLEAN DEFAULT FALSE,
    typically_requires_inspection BOOLEAN DEFAULT FALSE,

    -- Checklist items
    checklist_items JSONB DEFAULT '[]'::jsonb,  -- ["Turn off main breaker", "Test all circuits"]

    -- Status
    active BOOLEAN DEFAULT TRUE,

    created_by VARCHAR(50) REFERENCES users(username),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed common job templates
INSERT INTO job_templates (template_name, job_type, job_description, estimated_hours, estimated_days, min_crew_size, recommended_crew_size, typically_requires_permit, typically_requires_inspection) VALUES
    ('200A Panel Upgrade', 'Panel Upgrade', 'Upgrade existing electrical panel to 200 amp service', 8, 1, 1, 2, TRUE, TRUE),
    ('EV Charger Installation', 'EV Charger', 'Install Level 2 EV charging station with dedicated circuit', 4, 1, 1, 1, TRUE, TRUE),
    ('Generator Install - Portable', 'Generator', 'Install manual transfer switch and inlet for portable generator', 4, 1, 1, 2, TRUE, TRUE),
    ('Generator Install - Standby', 'Generator', 'Install automatic standby generator with transfer switch', 16, 2, 2, 3, TRUE, TRUE),
    ('Outlet/Switch Replacement', 'Service Call', 'Replace faulty outlets or switches', 1, 1, 1, 1, FALSE, FALSE),
    ('Troubleshooting', 'Service Call', 'Diagnose and repair electrical issues', 2, 1, 1, 1, FALSE, FALSE),
    ('Whole House Rewire', 'Rewire', 'Complete rewire of residential home', 40, 5, 2, 3, TRUE, TRUE),
    ('Kitchen Remodel Electric', 'Remodel', 'Electrical work for kitchen renovation', 16, 2, 1, 2, TRUE, TRUE),
    ('Bathroom GFCI Install', 'Service Call', 'Install GFCI outlets in bathroom per code', 2, 1, 1, 1, FALSE, FALSE),
    ('Ceiling Fan Installation', 'Service Call', 'Install ceiling fan with existing wiring', 1, 1, 1, 1, FALSE, FALSE)
ON CONFLICT (template_name) DO NOTHING;

-- ============================================================
-- 7. CREW TEAMS (Pre-defined crew configurations)
-- ============================================================
-- Save common crew combinations for quick assignment

CREATE TABLE IF NOT EXISTS crew_teams (
    id SERIAL PRIMARY KEY,
    team_name VARCHAR(100) NOT NULL UNIQUE,

    -- Team details
    team_description TEXT,
    team_lead VARCHAR(50) REFERENCES users(username),

    -- Team members (JSONB array)
    members JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{username, role}]

    -- Specialization
    specialization VARCHAR(100),  -- "Panel Work", "New Construction", "Service Calls"

    -- Status
    active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 8. UPDATE work_orders TABLE
-- ============================================================
-- Add new columns for multi-date job support

-- Add date range columns (keep scheduled_date for backwards compatibility)
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS is_multi_day BOOLEAN DEFAULT FALSE;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS total_scheduled_days INTEGER DEFAULT 1;

-- Add crew size tracking
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS crew_size INTEGER DEFAULT 1;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS min_crew_size INTEGER DEFAULT 1;

-- Add template reference
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES job_templates(id);

-- Add phase tracking for complex jobs
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS current_phase VARCHAR(100);
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS total_phases INTEGER DEFAULT 1;

-- ============================================================
-- 9. MIGRATE EXISTING ASSIGNMENTS
-- ============================================================
-- Move data from assigned_to, helper_1, helper_2 to new table

-- Migrate primary technician assignments
INSERT INTO work_order_assignments (work_order_id, employee_username, assignment_role, is_lead)
SELECT id, assigned_to, 'lead', TRUE
FROM work_orders
WHERE assigned_to IS NOT NULL
ON CONFLICT (work_order_id, employee_username) DO NOTHING;

-- Migrate helper_1 assignments
INSERT INTO work_order_assignments (work_order_id, employee_username, assignment_role, is_lead)
SELECT id, helper_1, 'helper', FALSE
FROM work_orders
WHERE helper_1 IS NOT NULL
ON CONFLICT (work_order_id, employee_username) DO NOTHING;

-- Migrate helper_2 assignments
INSERT INTO work_order_assignments (work_order_id, employee_username, assignment_role, is_lead)
SELECT id, helper_2, 'helper', FALSE
FROM work_orders
WHERE helper_2 IS NOT NULL
ON CONFLICT (work_order_id, employee_username) DO NOTHING;

-- ============================================================
-- 10. MIGRATE EXISTING SCHEDULED DATES
-- ============================================================
-- Create job_schedule_dates entries from existing scheduled_date

INSERT INTO job_schedule_dates (work_order_id, scheduled_date, start_time, end_time, estimated_hours, status)
SELECT
    id,
    scheduled_date,
    COALESCE(scheduled_start_time, '08:00'::TIME),
    COALESCE(scheduled_end_time, '16:30'::TIME),
    COALESCE(estimated_duration_hours, 8.0),
    CASE
        WHEN status = 'completed' THEN 'completed'
        WHEN status = 'in_progress' THEN 'in_progress'
        ELSE 'scheduled'
    END
FROM work_orders
WHERE scheduled_date IS NOT NULL
ON CONFLICT (work_order_id, scheduled_date) DO NOTHING;

-- Update work_orders with start_date/end_date from scheduled_date
UPDATE work_orders
SET start_date = scheduled_date, end_date = scheduled_date
WHERE scheduled_date IS NOT NULL AND start_date IS NULL;

-- ============================================================
-- 11. VIEWS FOR CONVENIENCE
-- ============================================================

-- View: Work orders with crew list
CREATE OR REPLACE VIEW vw_work_order_crew AS
SELECT
    wo.id AS work_order_id,
    wo.work_order_number,
    wo.job_description,
    wo.status,
    woa.employee_username,
    u.full_name AS employee_name,
    woa.assignment_role,
    woa.is_lead,
    woa.status AS assignment_status
FROM work_orders wo
LEFT JOIN work_order_assignments woa ON wo.id = woa.work_order_id
LEFT JOIN users u ON woa.employee_username = u.username
ORDER BY wo.id, woa.is_lead DESC, woa.assignment_role;

-- View: Job schedule with crew for each date
CREATE OR REPLACE VIEW vw_job_schedule_with_crew AS
SELECT
    jsd.id AS schedule_id,
    wo.id AS work_order_id,
    wo.work_order_number,
    wo.job_description,
    jsd.scheduled_date,
    jsd.start_time,
    jsd.end_time,
    jsd.phase_name,
    jsd.status AS date_status,
    jsc.employee_username,
    u.full_name AS employee_name,
    jsc.role,
    jsc.is_lead_for_day,
    jsc.scheduled_hours,
    jsc.status AS crew_status
FROM job_schedule_dates jsd
JOIN work_orders wo ON jsd.work_order_id = wo.id
LEFT JOIN job_schedule_crew jsc ON jsd.id = jsc.job_schedule_date_id
LEFT JOIN users u ON jsc.employee_username = u.username
ORDER BY jsd.scheduled_date, wo.id, jsc.is_lead_for_day DESC;

-- View: Employee daily schedule
CREATE OR REPLACE VIEW vw_employee_daily_schedule AS
SELECT
    u.username,
    u.full_name,
    jsd.scheduled_date,
    wo.work_order_number,
    wo.job_description,
    c.first_name || ' ' || c.last_name AS customer_name,
    wo.service_address,
    jsd.start_time,
    jsd.end_time,
    jsc.role,
    jsc.is_lead_for_day,
    jsc.scheduled_hours,
    wo.status AS job_status,
    jsd.status AS day_status
FROM users u
JOIN job_schedule_crew jsc ON u.username = jsc.employee_username
JOIN job_schedule_dates jsd ON jsc.job_schedule_date_id = jsd.id
JOIN work_orders wo ON jsd.work_order_id = wo.id
JOIN customers c ON wo.customer_id = c.id
WHERE u.active = TRUE
ORDER BY u.username, jsd.scheduled_date, jsd.start_time;

-- ============================================================
-- 12. FUNCTIONS FOR CONVENIENCE
-- ============================================================

-- Function: Check if employee is available on a date
CREATE OR REPLACE FUNCTION is_employee_available(
    p_username VARCHAR(50),
    p_date DATE,
    p_start_time TIME DEFAULT '08:00',
    p_end_time TIME DEFAULT '16:30'
) RETURNS BOOLEAN AS $$
DECLARE
    v_unavailable_count INTEGER;
BEGIN
    -- Check if there's any unavailability entry for this date
    SELECT COUNT(*) INTO v_unavailable_count
    FROM employee_availability
    WHERE employee_username = p_username
      AND availability_type IN ('unavailable', 'vacation', 'sick')
      AND p_date BETWEEN start_date AND end_date
      AND (
          (start_time IS NULL AND end_time IS NULL)  -- All day unavailable
          OR (start_time <= p_end_time AND end_time >= p_start_time)  -- Time overlap
      );

    RETURN v_unavailable_count = 0;
END;
$$ LANGUAGE plpgsql;

-- Function: Get employee scheduled hours for a date
CREATE OR REPLACE FUNCTION get_employee_scheduled_hours(
    p_username VARCHAR(50),
    p_date DATE
) RETURNS DECIMAL AS $$
DECLARE
    v_total_hours DECIMAL;
BEGIN
    SELECT COALESCE(SUM(jsc.scheduled_hours), 0) INTO v_total_hours
    FROM job_schedule_crew jsc
    JOIN job_schedule_dates jsd ON jsc.job_schedule_date_id = jsd.id
    WHERE jsc.employee_username = p_username
      AND jsd.scheduled_date = p_date
      AND jsd.status NOT IN ('skipped', 'rescheduled');

    RETURN v_total_hours;
END;
$$ LANGUAGE plpgsql;

-- Function: Assign crew to all dates of a job
CREATE OR REPLACE FUNCTION assign_crew_to_job_dates(
    p_work_order_id INTEGER,
    p_employee_usernames VARCHAR(50)[],
    p_is_lead_username VARCHAR(50) DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_schedule_date RECORD;
    v_username VARCHAR(50);
    v_count INTEGER := 0;
BEGIN
    -- Loop through all scheduled dates for this work order
    FOR v_schedule_date IN
        SELECT id FROM job_schedule_dates WHERE work_order_id = p_work_order_id
    LOOP
        -- Loop through all employees
        FOREACH v_username IN ARRAY p_employee_usernames
        LOOP
            INSERT INTO job_schedule_crew (job_schedule_date_id, employee_username, is_lead_for_day)
            VALUES (v_schedule_date.id, v_username, v_username = p_is_lead_username)
            ON CONFLICT (job_schedule_date_id, employee_username) DO UPDATE
            SET is_lead_for_day = EXCLUDED.is_lead_for_day;

            v_count := v_count + 1;
        END LOOP;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 13. GRANT PERMISSIONS (if needed)
-- ============================================================
-- GRANT SELECT, INSERT, UPDATE, DELETE ON work_order_assignments TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON job_schedule_dates TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON job_schedule_crew TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON employee_skills TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON employee_availability TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON job_templates TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON crew_teams TO app_user;

COMMENT ON TABLE work_order_assignments IS 'Tracks all worker assignments to jobs - replaces limited helper columns';
COMMENT ON TABLE job_schedule_dates IS 'Allows jobs to span multiple dates with different crews each day';
COMMENT ON TABLE job_schedule_crew IS 'Links workers to specific scheduled dates on a job';
COMMENT ON TABLE employee_skills IS 'Tracks certifications and skills for skill-based assignment';
COMMENT ON TABLE employee_availability IS 'Calendar-based availability tracking for scheduling';
COMMENT ON TABLE job_templates IS 'Pre-defined templates for common job types';
COMMENT ON TABLE crew_teams IS 'Saved crew configurations for quick assignment';
