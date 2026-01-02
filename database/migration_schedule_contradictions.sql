-- Migration: Add schedule_contradictions table for tracking discrepancies
-- Between scheduled work and actual time entries

-- Create the schedule_contradictions table
CREATE TABLE IF NOT EXISTS schedule_contradictions (
    id SERIAL PRIMARY KEY,
    week_ending_date DATE NOT NULL,
    employee_username VARCHAR(50) NOT NULL REFERENCES users(username),
    work_order_id INTEGER NOT NULL REFERENCES work_orders(id),
    scheduled_date DATE NOT NULL,
    contradiction_type VARCHAR(50) NOT NULL, -- 'missing_time_entry', 'missing_schedule', 'hours_mismatch'
    scheduled_hours DECIMAL(5,2) DEFAULT 0,
    actual_hours DECIMAL(5,2) DEFAULT 0,
    notes TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_by VARCHAR(50) REFERENCES users(username),
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Unique constraint for upsert operations
    CONSTRAINT unique_contradiction UNIQUE (employee_username, work_order_id, scheduled_date)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_contradictions_week ON schedule_contradictions(week_ending_date);
CREATE INDEX IF NOT EXISTS idx_contradictions_employee ON schedule_contradictions(employee_username);
CREATE INDEX IF NOT EXISTS idx_contradictions_resolved ON schedule_contradictions(resolved);
CREATE INDEX IF NOT EXISTS idx_contradictions_type ON schedule_contradictions(contradiction_type);

-- Add comments
COMMENT ON TABLE schedule_contradictions IS 'Tracks discrepancies between scheduled work and actual time entries';
COMMENT ON COLUMN schedule_contradictions.contradiction_type IS 'Type of discrepancy: missing_time_entry (scheduled but not logged), missing_schedule (logged but not scheduled), hours_mismatch (different hours)';
