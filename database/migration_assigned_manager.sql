-- Migration: Add assigned_manager to work_orders
-- Purpose: Allow jobs to be assigned to specific managers
-- Date: January 17, 2026

-- Add assigned_manager column to work_orders
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS assigned_manager VARCHAR(50) REFERENCES users(username);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_manager ON work_orders(assigned_manager);

-- Add comment
COMMENT ON COLUMN work_orders.assigned_manager IS 'Manager responsible for this job - job appears in their views regardless of crew';
