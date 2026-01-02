-- Migration: Work Order Photos Compatibility
-- Purpose: Create work_order_photos table that backend expects
-- Note: A view may already exist mapping job_photos -> work_order_photos
-- This migration only creates the table if nothing exists with that name

DO $$
BEGIN
    -- Only create table if no relation (table or view) exists with this name
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'work_order_photos') THEN
        CREATE TABLE work_order_photos (
            id SERIAL PRIMARY KEY,
            work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
            filename TEXT NOT NULL,
            original_filename TEXT,
            caption TEXT,
            uploaded_by VARCHAR(50) NOT NULL REFERENCES users(username),
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            file_size INTEGER,
            mime_type VARCHAR(100)
        );

        CREATE INDEX idx_work_order_photos_wo ON work_order_photos(work_order_id);
        CREATE INDEX idx_work_order_photos_uploaded_at ON work_order_photos(uploaded_at);

        RAISE NOTICE 'Created work_order_photos table';
    ELSE
        RAISE NOTICE 'work_order_photos already exists (table or view), skipping';
    END IF;
END $$;
