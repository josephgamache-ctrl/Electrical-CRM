-- Migration: Missing core tables required by backend
-- Purpose: Ensure fresh installs have tables referenced by API endpoints.

-- ============================================================
-- 1) CYCLE COUNT SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS cycle_count_settings (
    abc_class VARCHAR(1) PRIMARY KEY CHECK (abc_class IN ('A', 'B', 'C')),
    count_frequency_days INTEGER NOT NULL CHECK (count_frequency_days > 0),
    tolerance_percent DECIMAL(5, 2) NOT NULL CHECK (tolerance_percent >= 0),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(50) REFERENCES users(username)
);

-- Reasonable defaults; safe to seed (not customer-specific).
INSERT INTO cycle_count_settings (abc_class, count_frequency_days, tolerance_percent)
VALUES
    ('A', 7, 2.0),
    ('B', 30, 5.0),
    ('C', 90, 10.0)
ON CONFLICT (abc_class) DO NOTHING;

-- ============================================================
-- 2) WORK ORDER ACTIVITY (status changes, notes, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS work_order_activity (
    id SERIAL PRIMARY KEY,
    work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    performed_by VARCHAR(50) REFERENCES users(username),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_work_order_activity_wo ON work_order_activity(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_activity_type ON work_order_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_work_order_activity_created_at ON work_order_activity(created_at);

