-- Migration: Add leftover tracking to job_materials_used
-- Date: 2026-01-09
-- Purpose: Track where leftover materials went when job is completed

-- Add leftover_destination column to track where unused materials went
ALTER TABLE job_materials_used
ADD COLUMN IF NOT EXISTS leftover_destination VARCHAR(20) DEFAULT NULL;
-- Values: 'van', 'warehouse', NULL (no leftover)

-- Add leftover_van_id to track which van received leftover (if applicable)
ALTER TABLE job_materials_used
ADD COLUMN IF NOT EXISTS leftover_van_id INTEGER REFERENCES work_vans(id);

-- Add leftover_notes for any notes about the leftover
ALTER TABLE job_materials_used
ADD COLUMN IF NOT EXISTS leftover_notes TEXT;

-- Add reconciled_at timestamp to track when material was reconciled
ALTER TABLE job_materials_used
ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP;

-- Add reconciled_by to track who reconciled the material
ALTER TABLE job_materials_used
ADD COLUMN IF NOT EXISTS reconciled_by VARCHAR(50) REFERENCES users(username);

-- Create index for querying reconciliation status
CREATE INDEX IF NOT EXISTS idx_job_materials_reconciled ON job_materials_used(reconciled_at) WHERE reconciled_at IS NOT NULL;

COMMENT ON COLUMN job_materials_used.leftover_destination IS 'Where leftover materials went: van, warehouse, or NULL if all used';
COMMENT ON COLUMN job_materials_used.leftover_van_id IS 'If leftover went to van, which van received it';
COMMENT ON COLUMN job_materials_used.leftover_notes IS 'Notes about why material was not fully used';
COMMENT ON COLUMN job_materials_used.reconciled_at IS 'When material was reconciled at job completion';
COMMENT ON COLUMN job_materials_used.reconciled_by IS 'Who reconciled the material';
