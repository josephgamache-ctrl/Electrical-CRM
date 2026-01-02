-- Migration: Add notes column to job_photos
-- Purpose: Allow detailed notes to be attached to photos (separate from short caption)
-- Also ensures the view includes all needed columns for photo management

-- Add notes column to job_photos table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'job_photos' AND column_name = 'notes'
    ) THEN
        ALTER TABLE job_photos ADD COLUMN notes TEXT;
        RAISE NOTICE 'Added notes column to job_photos';
    ELSE
        RAISE NOTICE 'notes column already exists in job_photos';
    END IF;

    -- Also ensure file_size and mime_type columns exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'job_photos' AND column_name = 'file_size'
    ) THEN
        ALTER TABLE job_photos ADD COLUMN file_size INTEGER DEFAULT 0;
        RAISE NOTICE 'Added file_size column to job_photos';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'job_photos' AND column_name = 'mime_type'
    ) THEN
        ALTER TABLE job_photos ADD COLUMN mime_type VARCHAR(100) DEFAULT 'image/jpeg';
        RAISE NOTICE 'Added mime_type column to job_photos';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'job_photos' AND column_name = 'original_filename'
    ) THEN
        ALTER TABLE job_photos ADD COLUMN original_filename TEXT;
        RAISE NOTICE 'Added original_filename column to job_photos';
    END IF;
END $$;

-- Update the view to include notes and other columns properly
DROP VIEW IF EXISTS work_order_photos;

CREATE VIEW work_order_photos AS
SELECT
    id,
    work_order_id,
    photo_url AS filename,
    COALESCE(original_filename, photo_url) AS original_filename,
    photo_type,
    caption,
    notes,
    uploaded_by,
    uploaded_at,
    COALESCE(file_size, 0) AS file_size,
    COALESCE(mime_type, 'image/jpeg') AS mime_type
FROM job_photos;

-- Create a rule to allow inserts through the view
CREATE OR REPLACE RULE work_order_photos_insert AS ON INSERT TO work_order_photos
DO INSTEAD
INSERT INTO job_photos (work_order_id, photo_url, original_filename, photo_type, caption, notes, uploaded_by, uploaded_at, file_size, mime_type)
VALUES (NEW.work_order_id, NEW.filename, NEW.original_filename, NEW.photo_type, NEW.caption, NEW.notes, NEW.uploaded_by, COALESCE(NEW.uploaded_at, CURRENT_TIMESTAMP), NEW.file_size, NEW.mime_type)
RETURNING id, work_order_id, photo_url AS filename, COALESCE(original_filename, photo_url) AS original_filename, photo_type, caption, notes, uploaded_by, uploaded_at, COALESCE(file_size, 0) AS file_size, COALESCE(mime_type, 'image/jpeg') AS mime_type;

-- Create a rule to allow deletes through the view
CREATE OR REPLACE RULE work_order_photos_delete AS ON DELETE TO work_order_photos
DO INSTEAD
DELETE FROM job_photos WHERE id = OLD.id;
