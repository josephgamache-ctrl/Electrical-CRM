-- Migration: Add Activity Tracking, Job Tasks, and Enhanced Notes
-- Purpose: Track who did what, add task management to jobs, improve notes system

-- ============================================================
-- JOB TASKS (Scope of Work with checkboxes)
-- ============================================================

CREATE TABLE IF NOT EXISTS job_tasks (
    id SERIAL PRIMARY KEY,
    work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    task_description TEXT NOT NULL,
    task_order INTEGER DEFAULT 0,  -- For sorting tasks in order
    is_completed BOOLEAN DEFAULT FALSE,
    completed_by VARCHAR(50) REFERENCES users(username),
    completed_at TIMESTAMP,
    created_by VARCHAR(50) REFERENCES users(username),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_job_tasks_wo ON job_tasks(work_order_id);
CREATE INDEX idx_job_tasks_completed ON job_tasks(is_completed);

-- ============================================================
-- JOB NOTES (Enhanced with author tracking)
-- ============================================================

CREATE TABLE IF NOT EXISTS job_notes (
    id SERIAL PRIMARY KEY,
    work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    note_text TEXT NOT NULL,
    note_type VARCHAR(20) DEFAULT 'general',  -- general, task, issue, resolution
    related_task_id INTEGER REFERENCES job_tasks(id) ON DELETE SET NULL,
    created_by VARCHAR(50) NOT NULL REFERENCES users(username),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_job_notes_wo ON job_notes(work_order_id);
CREATE INDEX idx_job_notes_created_at ON job_notes(created_at);
CREATE INDEX idx_job_notes_type ON job_notes(note_type);

-- ============================================================
-- JOB PHOTOS (With author tracking)
-- ============================================================

CREATE TABLE IF NOT EXISTS job_photos (
    id SERIAL PRIMARY KEY,
    work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    photo_type VARCHAR(20) DEFAULT 'general',  -- before, during, after, issue, completed
    caption TEXT,
    uploaded_by VARCHAR(50) NOT NULL REFERENCES users(username),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_job_photos_wo ON job_photos(work_order_id);
CREATE INDEX idx_job_photos_uploaded_at ON job_photos(uploaded_at);
CREATE INDEX idx_job_photos_type ON job_photos(photo_type);

-- ============================================================
-- ACTIVITY LOG (Comprehensive tracking)
-- ============================================================

CREATE TABLE IF NOT EXISTS activity_log (
    id SERIAL PRIMARY KEY,
    work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    -- Types: task_added, task_completed, note_added, photo_added,
    --        material_assigned, material_returned, status_changed, job_created
    activity_description TEXT NOT NULL,
    related_item_type VARCHAR(20),  -- task, note, photo, material
    related_item_id INTEGER,
    performed_by VARCHAR(50) NOT NULL REFERENCES users(username),
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB  -- Flexible field for additional data
);

CREATE INDEX idx_activity_log_wo ON activity_log(work_order_id);
CREATE INDEX idx_activity_log_type ON activity_log(activity_type);
CREATE INDEX idx_activity_log_performed_at ON activity_log(performed_at);
CREATE INDEX idx_activity_log_user ON activity_log(performed_by);

-- ============================================================
-- MIGRATE EXISTING DATA
-- ============================================================

-- Add created_by and updated_by columns to work_orders if they don't exist
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS updated_by VARCHAR(50) REFERENCES users(username);

-- Add created_by column to work_order_items if it doesn't exist
ALTER TABLE work_order_items ADD COLUMN IF NOT EXISTS added_by VARCHAR(50) REFERENCES users(username);

-- ============================================================
-- TRIGGERS FOR AUTOMATIC ACTIVITY LOGGING
-- ============================================================

-- Function to log activity
CREATE OR REPLACE FUNCTION log_activity()
RETURNS TRIGGER AS $$
DECLARE
    action_desc TEXT;
    action_type VARCHAR(50);
BEGIN
    -- Determine activity type and description based on table
    IF TG_TABLE_NAME = 'job_tasks' THEN
        IF TG_OP = 'INSERT' THEN
            action_type := 'task_added';
            action_desc := 'Added task: ' || NEW.task_description;
            INSERT INTO activity_log (work_order_id, activity_type, activity_description, related_item_type, related_item_id, performed_by)
            VALUES (NEW.work_order_id, action_type, action_desc, 'task', NEW.id, NEW.created_by);
        ELSIF TG_OP = 'UPDATE' AND OLD.is_completed = FALSE AND NEW.is_completed = TRUE THEN
            action_type := 'task_completed';
            action_desc := 'Completed task: ' || NEW.task_description;
            INSERT INTO activity_log (work_order_id, activity_type, activity_description, related_item_type, related_item_id, performed_by)
            VALUES (NEW.work_order_id, action_type, action_desc, 'task', NEW.id, NEW.completed_by);
        END IF;
    ELSIF TG_TABLE_NAME = 'job_notes' THEN
        action_type := 'note_added';
        action_desc := 'Added note';
        INSERT INTO activity_log (work_order_id, activity_type, activity_description, related_item_type, related_item_id, performed_by)
        VALUES (NEW.work_order_id, action_type, action_desc, 'note', NEW.id, NEW.created_by);
    ELSIF TG_TABLE_NAME = 'job_photos' THEN
        action_type := 'photo_added';
        action_desc := 'Added photo' || COALESCE(': ' || NEW.caption, '');
        INSERT INTO activity_log (work_order_id, activity_type, activity_description, related_item_type, related_item_id, performed_by)
        VALUES (NEW.work_order_id, action_type, action_desc, 'photo', NEW.id, NEW.uploaded_by);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS log_task_activity ON job_tasks;
CREATE TRIGGER log_task_activity
    AFTER INSERT OR UPDATE ON job_tasks
    FOR EACH ROW EXECUTE FUNCTION log_activity();

DROP TRIGGER IF EXISTS log_note_activity ON job_notes;
CREATE TRIGGER log_note_activity
    AFTER INSERT ON job_notes
    FOR EACH ROW EXECUTE FUNCTION log_activity();

DROP TRIGGER IF EXISTS log_photo_activity ON job_photos;
CREATE TRIGGER log_photo_activity
    AFTER INSERT ON job_photos
    FOR EACH ROW EXECUTE FUNCTION log_activity();

-- Grant permissions
GRANT ALL PRIVILEGES ON job_tasks TO postgres;
GRANT ALL PRIVILEGES ON job_notes TO postgres;
GRANT ALL PRIVILEGES ON job_photos TO postgres;
GRANT ALL PRIVILEGES ON activity_log TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Add helpful comments
COMMENT ON TABLE job_tasks IS 'Individual tasks within a job scope of work, can be checked off as completed';
COMMENT ON TABLE job_notes IS 'Notes added to jobs with author tracking and timestamps';
COMMENT ON TABLE job_photos IS 'Photos uploaded to jobs with metadata and author tracking';
COMMENT ON TABLE activity_log IS 'Comprehensive audit trail of all activities on work orders';
