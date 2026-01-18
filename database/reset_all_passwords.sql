-- Password Reset Script for Pem2 Services
-- Generated: January 16, 2026
-- New password for ALL users: Pem2Services2026
--
-- IMPORTANT: This password should be changed by each user after first login
-- Document this in the USER_MANUAL.md for reference

-- Reset ALL user passwords to: Pem2Services2026
-- BCrypt hash generated with salt rounds = 12
UPDATE users
SET password = '$2b$12$XotXVaRkZKWVvCizgq82AuiyodWoHQF0rtNi1unNPyYPPyacW8RLW',
    failed_login_attempts = 0,
    locked_until = NULL
WHERE active = true;

-- Show results
SELECT username, full_name, role, active, 'Pem2Services2026' as temp_password
FROM users
WHERE active = true
ORDER BY role, full_name;
