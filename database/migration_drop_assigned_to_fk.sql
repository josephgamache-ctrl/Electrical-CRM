-- Migration: Drop FK constraint on work_orders.assigned_to
-- This allows storing comma-separated usernames for multiple crew members
-- Date: 2025-12-13

-- Drop the foreign key constraint
ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_assigned_to_fkey;

-- Add a comment to explain the change
COMMENT ON COLUMN work_orders.assigned_to IS 'Comma-separated list of assigned technician usernames (no longer FK constrained)';
