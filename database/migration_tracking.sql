-- Migration Tracking System
-- Date: 2025-12-23
-- Purpose: Track which database migrations have been applied

-- Create schema_migrations table to track applied migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checksum VARCHAR(64),
    execution_time_ms INTEGER,
    success BOOLEAN DEFAULT TRUE,
    rolled_back BOOLEAN DEFAULT FALSE,
    rolled_back_at TIMESTAMP,
    notes TEXT
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON schema_migrations(version);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON schema_migrations(applied_at);

-- Function to check if a migration has been applied
CREATE OR REPLACE FUNCTION migration_exists(p_version VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM schema_migrations
        WHERE version = p_version AND success = TRUE AND rolled_back = FALSE
    );
END;
$$ LANGUAGE plpgsql;

-- Function to record a migration
CREATE OR REPLACE FUNCTION record_migration(
    p_version VARCHAR,
    p_name VARCHAR,
    p_checksum VARCHAR DEFAULT NULL,
    p_execution_time_ms INTEGER DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO schema_migrations (version, name, checksum, execution_time_ms, success, notes)
    VALUES (p_version, p_name, p_checksum, p_execution_time_ms, TRUE, p_notes)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark a migration as rolled back
CREATE OR REPLACE FUNCTION rollback_migration(p_version VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE schema_migrations
    SET rolled_back = TRUE, rolled_back_at = CURRENT_TIMESTAMP
    WHERE version = p_version;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- View to show migration status
CREATE OR REPLACE VIEW migration_status AS
SELECT
    version,
    name,
    applied_at,
    execution_time_ms,
    CASE
        WHEN rolled_back THEN 'ROLLED_BACK'
        WHEN success THEN 'APPLIED'
        ELSE 'FAILED'
    END AS status,
    notes
FROM schema_migrations
ORDER BY applied_at DESC;

-- Record existing migrations (for systems that have already run them)
-- This is idempotent - will not duplicate if already recorded
DO $$
BEGIN
    -- Core schema
    IF NOT migration_exists('001_schema_v3_final') THEN
        PERFORM record_migration('001_schema_v3_final', 'Base schema v3 with all core tables', NULL, NULL,
            'Initial schema with users, customers, vendors, inventory, work_orders, invoices');
    END IF;

    -- Activity tracking
    IF NOT migration_exists('002_activity_tracking') THEN
        PERFORM record_migration('002_activity_tracking', 'Add activity tracking tables', NULL, NULL,
            'Adds work_order_activity for timeline tracking');
    END IF;

    -- Multi-worker and dates
    IF NOT migration_exists('003_multi_worker_dates') THEN
        PERFORM record_migration('003_multi_worker_dates', 'Multi-worker scheduling and dates', NULL, NULL,
            'Work order assignments, crew teams, scheduling');
    END IF;

    -- Time tracking
    IF NOT migration_exists('004_time_tracking') THEN
        PERFORM record_migration('004_time_tracking', 'Employee time tracking', NULL, NULL,
            'Time entries, timecards, payroll integration');
    END IF;

    -- Financial reports
    IF NOT migration_exists('005_financial_reports') THEN
        PERFORM record_migration('005_financial_reports', 'Financial reporting views', NULL, NULL,
            'Job profitability, customer revenue, employee productivity');
    END IF;

    -- Schedule contradictions
    IF NOT migration_exists('006_schedule_contradictions') THEN
        PERFORM record_migration('006_schedule_contradictions', 'Schedule contradiction detection', NULL, NULL,
            'Detect double-bookings and conflicts');
    END IF;

    -- Reporting views
    IF NOT migration_exists('007_reporting_views') THEN
        PERFORM record_migration('007_reporting_views', 'Additional reporting views', NULL, NULL,
            'Dashboard and report views');
    END IF;

    -- Scope to tasks
    IF NOT migration_exists('008_scope_to_tasks') THEN
        PERFORM record_migration('008_scope_to_tasks', 'Convert scope to tasks', NULL, NULL,
            'Work order task management');
    END IF;

    -- Work order photos compat
    IF NOT migration_exists('009_work_order_photos') THEN
        PERFORM record_migration('009_work_order_photos', 'Work order photos compatibility', NULL, NULL,
            'Photo storage and management');
    END IF;

    -- Missing core tables
    IF NOT migration_exists('010_missing_core_tables') THEN
        PERFORM record_migration('010_missing_core_tables', 'Add missing core tables', NULL, NULL,
            'Tables that were missing from initial schema');
    END IF;

    -- Photo notes
    IF NOT migration_exists('011_photo_notes') THEN
        PERFORM record_migration('011_photo_notes', 'Photo notes and captions', NULL, NULL,
            'Notes and descriptions for work order photos');
    END IF;

    -- Notifications
    IF NOT migration_exists('012_notifications') THEN
        PERFORM record_migration('012_notifications', 'Notification system', NULL, NULL,
            'User notifications and alerts');
    END IF;

    -- Purchase order items
    IF NOT migration_exists('013_purchase_order_items') THEN
        PERFORM record_migration('013_purchase_order_items', 'Purchase order line items', NULL, NULL,
            'Proper PO items table instead of JSONB');
    END IF;

    -- Quotes system
    IF NOT migration_exists('014_quotes_system') THEN
        PERFORM record_migration('014_quotes_system', 'Quotes and estimates', NULL, NULL,
            'Quote management with Good/Better/Best tiers');
    END IF;

    -- Communication settings
    IF NOT migration_exists('015_communication_settings') THEN
        PERFORM record_migration('015_communication_settings', 'Email/SMS configuration', NULL, NULL,
            'SMTP and Twilio settings storage');
    END IF;

    -- Variance reporting
    IF NOT migration_exists('016_variance_reporting') THEN
        PERFORM record_migration('016_variance_reporting', 'Job cost variance reporting', NULL, NULL,
            'Track estimated vs actual costs');
    END IF;

    -- Account lockout (new)
    IF NOT migration_exists('017_account_lockout') THEN
        PERFORM record_migration('017_account_lockout', 'Account lockout security', NULL, NULL,
            'Failed login tracking and account lockout');
    END IF;
END $$;

COMMENT ON TABLE schema_migrations IS 'Tracks all database migrations that have been applied';
