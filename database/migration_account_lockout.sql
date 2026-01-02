-- Migration: Account Lockout Security
-- Date: 2025-12-23
-- Purpose: Track failed login attempts and implement account lockout

-- Add columns to users table for tracking login attempts
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_failed_login TIMESTAMP DEFAULT NULL;

-- Create index for efficient lockout checks
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until) WHERE locked_until IS NOT NULL;

-- Create login_attempts table for detailed tracking
CREATE TABLE IF NOT EXISTS login_attempts (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50),
    ip_address VARCHAR(45),  -- IPv6 max length
    attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN NOT NULL,
    user_agent TEXT,
    failure_reason VARCHAR(100)
);

-- Index for finding recent attempts by username
CREATE INDEX IF NOT EXISTS idx_login_attempts_username_time ON login_attempts(username, attempt_time DESC);

-- Index for finding recent attempts by IP
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts(ip_address, attempt_time DESC);

-- Function to check if account is locked
CREATE OR REPLACE FUNCTION is_account_locked(p_username VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    v_locked_until TIMESTAMP;
BEGIN
    SELECT locked_until INTO v_locked_until FROM users WHERE username = p_username;

    IF v_locked_until IS NULL THEN
        RETURN FALSE;
    END IF;

    IF v_locked_until > CURRENT_TIMESTAMP THEN
        RETURN TRUE;
    END IF;

    -- Lock has expired, reset it
    UPDATE users SET locked_until = NULL, failed_login_attempts = 0 WHERE username = p_username;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to record failed login attempt
CREATE OR REPLACE FUNCTION record_failed_login(
    p_username VARCHAR,
    p_ip_address VARCHAR,
    p_user_agent TEXT DEFAULT NULL,
    p_max_attempts INTEGER DEFAULT 5,
    p_lockout_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN AS $$
DECLARE
    v_attempts INTEGER;
    v_should_lock BOOLEAN := FALSE;
BEGIN
    -- Record the attempt
    INSERT INTO login_attempts (username, ip_address, success, user_agent, failure_reason)
    VALUES (p_username, p_ip_address, FALSE, p_user_agent, 'Invalid credentials');

    -- Update user's failed attempts counter
    UPDATE users
    SET
        failed_login_attempts = failed_login_attempts + 1,
        last_failed_login = CURRENT_TIMESTAMP
    WHERE username = p_username
    RETURNING failed_login_attempts INTO v_attempts;

    -- If user doesn't exist, v_attempts will be null
    IF v_attempts IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check if we should lock the account
    IF v_attempts >= p_max_attempts THEN
        UPDATE users
        SET locked_until = CURRENT_TIMESTAMP + (p_lockout_minutes || ' minutes')::interval
        WHERE username = p_username;
        v_should_lock := TRUE;
    END IF;

    RETURN v_should_lock;
END;
$$ LANGUAGE plpgsql;

-- Function to record successful login (resets failed attempts)
CREATE OR REPLACE FUNCTION record_successful_login(
    p_username VARCHAR,
    p_ip_address VARCHAR,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    -- Record the successful attempt
    INSERT INTO login_attempts (username, ip_address, success, user_agent)
    VALUES (p_username, p_ip_address, TRUE, p_user_agent);

    -- Reset failed attempts counter
    UPDATE users
    SET
        failed_login_attempts = 0,
        locked_until = NULL,
        last_failed_login = NULL
    WHERE username = p_username;
END;
$$ LANGUAGE plpgsql;

-- Admin function to unlock an account
CREATE OR REPLACE FUNCTION unlock_account(p_username VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE users
    SET
        failed_login_attempts = 0,
        locked_until = NULL,
        last_failed_login = NULL
    WHERE username = p_username;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE login_attempts IS 'Tracks all login attempts for security auditing and rate limiting';
COMMENT ON COLUMN users.failed_login_attempts IS 'Number of consecutive failed login attempts';
COMMENT ON COLUMN users.locked_until IS 'Account is locked until this timestamp (NULL = not locked)';
