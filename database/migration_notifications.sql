-- Migration: Add notifications system
-- Date: 2025-12-17
-- Description: Creates notifications table and related infrastructure

-- Notifications table
-- notification_type field allows easy permission-based filtering later
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,

    -- Who this notification is for (NULL = system-wide/broadcast)
    target_username VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE,

    -- Notification categorization (for permissions and filtering)
    notification_type VARCHAR(50) NOT NULL,  -- 'inventory', 'work_order', 'schedule', 'license', 'invoice', 'timesheet', 'system'
    notification_subtype VARCHAR(50),         -- 'low_stock', 'assignment', 'expiring', etc.

    -- Content
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,

    -- Severity/Priority
    severity VARCHAR(20) DEFAULT 'info',      -- 'info', 'warning', 'error', 'success'

    -- Related entity (for click-through navigation)
    related_entity_type VARCHAR(50),          -- 'inventory', 'work_order', 'user', 'invoice', etc.
    related_entity_id INTEGER,
    action_url VARCHAR(255),                  -- Direct URL to navigate to

    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    is_dismissed BOOLEAN DEFAULT FALSE,
    dismissed_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,                     -- Auto-dismiss after this date

    -- For preventing duplicate notifications
    dedup_key VARCHAR(255),                   -- Unique key to prevent duplicates (e.g., 'low_stock_item_123')

    -- Index for efficient queries
    CONSTRAINT unique_dedup_key UNIQUE (dedup_key)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_notifications_target ON notifications(target_username);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(target_username, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- User notification preferences table (for future use)
-- This will control which notification types each user wants to receive
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    delivery_method VARCHAR(20) DEFAULT 'in_app',  -- 'in_app', 'email', 'both', 'none'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_user_notification_pref UNIQUE (username, notification_type)
);

-- Insert default notification preferences for existing users
INSERT INTO user_notification_preferences (username, notification_type, enabled, delivery_method)
SELECT u.username, nt.type, TRUE, 'in_app'
FROM users u
CROSS JOIN (
    VALUES
        ('inventory'),
        ('work_order'),
        ('schedule'),
        ('license'),
        ('invoice'),
        ('timesheet'),
        ('system')
) AS nt(type)
ON CONFLICT (username, notification_type) DO NOTHING;

-- Function to clean up expired notifications
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM notifications
    WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE notifications IS 'System notifications for users - supports role-based filtering via notification_type';
COMMENT ON COLUMN notifications.notification_type IS 'Category for permission filtering: inventory, work_order, schedule, license, invoice, timesheet, system';
COMMENT ON COLUMN notifications.target_username IS 'NULL means broadcast to all users with permission for this notification_type';
COMMENT ON COLUMN notifications.dedup_key IS 'Prevents duplicate notifications, e.g., only one low_stock alert per item';
