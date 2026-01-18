-- Migration: Create manager_workers table
-- Purpose: Track which workers are assigned to which managers
-- Date: January 17, 2026

-- Create the manager_workers table
CREATE TABLE IF NOT EXISTS manager_workers (
    id SERIAL PRIMARY KEY,
    manager_username VARCHAR(50) NOT NULL REFERENCES users(username),
    worker_username VARCHAR(50) NOT NULL REFERENCES users(username),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by VARCHAR(50) REFERENCES users(username),
    notes TEXT,
    active BOOLEAN DEFAULT TRUE,

    -- Ensure a worker can only be assigned to one manager at a time (when active)
    CONSTRAINT unique_active_worker_assignment UNIQUE (worker_username, active)
        DEFERRABLE INITIALLY DEFERRED
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_manager_workers_manager ON manager_workers(manager_username) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_manager_workers_worker ON manager_workers(worker_username) WHERE active = true;

-- Add comment
COMMENT ON TABLE manager_workers IS 'Tracks which technicians/workers are assigned to which managers for crew management';
