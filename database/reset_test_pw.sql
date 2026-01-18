-- Reset password for jgamache to Test123!
-- The bcrypt hash below is for password: Test123!
UPDATE users SET password = '$2b$12$YM4S4hatUDuSX3UOstaSK.B3A7EtkbGnLno1NwD/m1QZnaLgpVq0u' WHERE username = 'jgamache';
SELECT username, length(password) as pwd_len, password FROM users WHERE username = 'jgamache';
