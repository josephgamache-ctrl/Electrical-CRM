-- Add column to track if scope_of_work has been converted to tasks
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS scope_converted_to_tasks BOOLEAN DEFAULT FALSE;

-- Add column to archive original scope
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS original_scope_of_work TEXT;
