-- Fix passwords for all users with a freshly generated hash (replace password value before use)
UPDATE users SET password = '$2b$12$VPaED/9/auCk4jJ4fwEPx.78VmFCstvkj6YyO4YwKXzLxCt1P5pf6';
