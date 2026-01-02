-- Add missing columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE users ADD COLUMN IF NOT EXISTS overtime_rate DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_create_quotes BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_close_jobs BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS employment_type VARCHAR(20) DEFAULT 'full-time';

-- Delete existing joey user and recreate with all users
DELETE FROM users WHERE username = 'joey';

-- Insert all users from backup (password is 'password123' for all technicians)
INSERT INTO users (username, password, full_name, email, phone, role, hire_date, hourly_rate, overtime_rate, active, can_create_quotes, can_close_jobs, employment_type, failed_login_attempts) VALUES
('eanzivino', '$2b$12$55g6hQnAboeZHWfCQdUVheH3LP3I3hT.KvMLBx.hs6VFNU7q6Z5mK', 'Eric Anzivino', NULL, NULL, 'technician', NULL, 0.00, 0.00, true, false, false, 'full-time', 0),
('vdonnelly', '$2b$12$ilTFW0v2MQuKh/AdPRYEsOPzdgdCSSJcBiEa7tMJGOvgPAptnFzxO', 'Van Donnelly', NULL, NULL, 'technician', NULL, 0.00, 0.00, true, false, false, 'full-time', 0),
('jfisher', '$2b$12$cWWsg8exfOnqdcPYGWWTpe9neCHXeoYlTPaYUyN//hw8Sp2ZQBQ7u', 'Jamieson Fisher', NULL, NULL, 'technician', NULL, 0.00, 0.00, true, false, false, 'full-time', 0),
('jforget', '$2b$12$DUwhPpDyctgVe.064HpNwuvvVuPjrFd5UAm0ienC.4BWiCf3.SsgC', 'John Forget', NULL, NULL, 'technician', NULL, 0.00, 0.00, true, false, false, 'full-time', 0),
('jfrates', '$2b$12$jhB/.F44Y2KwN.2/Z48nfedH05UWFetFLEDxIpKkAdp/bqJ/Idloq', 'Jonathan Frates', NULL, NULL, 'technician', NULL, 0.00, 0.00, true, false, false, 'full-time', 0),
('sfuertes', '$2b$12$7hHzyMbxXELL15r3IUXo9.n5ycAVgastg.PqX6sHHxRnE6UhGbuWe', 'Shea Fuertes', NULL, NULL, 'technician', NULL, 0.00, 0.00, true, false, false, 'full-time', 0),
('bgalvin', '$2b$12$GYSsqaAwzGBRU1z8BmBCQet1vQ6NReWCYzhXnErK3DBpBfxx6yWkm', 'Brad Galvin', NULL, NULL, 'technician', NULL, 0.00, 0.00, true, false, false, 'full-time', 0),
('dgamache', '$2b$12$jK3T8WKBaUH/8GW7etpd8exKc0vQp91Vb6tgFwOwFeRRR1QDBhvpq', 'Daniel Gamache', NULL, NULL, 'technician', NULL, 0.00, 0.00, true, false, false, 'full-time', 0),
('cgonclaves', '$2b$12$Bha6yfEOZqgZGZAna3nzuO7T1Aufq7pBs5SkLAdcam4eA9.jOr4kO', 'Christian Gonclaves', NULL, NULL, 'technician', NULL, 0.00, 0.00, true, false, false, 'full-time', 0),
('fjoseph', '$2b$12$RISxXwjI/uTYnAnJKk.x6uaJWiZQptENBI3ef/FK3SgFnQnpXD0Ca', 'Frantzy Joseph', NULL, NULL, 'technician', NULL, 0.00, 0.00, true, false, false, 'full-time', 0),
('rkeyes', '$2b$12$VBmippW150zuQ8KKCMMD/OBAl4W2PUo2DGQEeQd8ETr5OaxRECfn2', 'Ryan Keyes', NULL, NULL, 'technician', NULL, 0.00, 0.00, true, false, false, 'full-time', 0),
('cmelanson', '$2b$12$SQnbJcezJV89OGN9A7k75eqkfUIBttZPtYi9FdsGoEP95k.Q1E5i2', 'Cam Melanson', NULL, NULL, 'technician', NULL, 0.00, 0.00, true, false, false, 'full-time', 0),
('nmelanson', '$2b$12$9RzSPoyndm4mucQFxfpbY.UbY/FFsoz4innP3ZufbS7PffliuS8BS', 'Nicolas Melanson', NULL, NULL, 'technician', NULL, 0.00, 0.00, true, false, false, 'full-time', 0),
('lmoloney', '$2b$12$PFtK1WGmDYIpjK8iZrUnduB5GDT93yl/SjRYwFTSwTTPCCEbMjyPi', 'Liam Moloney', NULL, NULL, 'technician', NULL, 0.00, 0.00, true, false, false, 'full-time', 0),
('spatel', '$2b$12$m9iYaWPZzlgXt6N/NzeIeebZVmBaErMwYap5oTkf5H4QjSJkvR6Yy', 'Shiv Patel', NULL, NULL, 'technician', NULL, 0.00, 0.00, true, false, false, 'full-time', 0),
('jpetrilli', '$2b$12$wIO.jv9JtTyB.t/chNG1.eaXrBG3dMpZjyB1QIGyZ2VsAy0o9kI26', 'Jared Petrilli', NULL, NULL, 'technician', NULL, 0.00, 0.00, true, false, false, 'full-time', 0),
('nrafferty', '$2b$12$TtoQunwmON3gpIdW8LEnk.M6jZkNUxMCKdsWEjm2QjmFaqUpKibcK', 'Nicholas Rafferty', NULL, NULL, 'technician', NULL, 0.00, 0.00, true, false, false, 'full-time', 0),
('arothwell', '$2b$12$kIPuwgZAXLDIOvtfeGUrSei43eBUqnkI4CMnp1JD.RJuuToP62bZm', 'Andrew Rothwell', NULL, NULL, 'technician', NULL, 0.00, 0.00, true, false, false, 'full-time', 0),
('stully', '$2b$12$1fB9NYcx1DU29i.n.GN7rOncs5NAQ4SiDPUkysMi5f/t7EWnLZiwe', 'Sean Tully', NULL, NULL, 'technician', NULL, 0.00, 0.00, true, false, false, 'full-time', 0),
('averspyck', '$2b$12$8b.JFxxN4BUcfXWvZlGRwOfJFlWLYFzPwPrQjvSMFhIIahLbsEu86', 'Alex Verspyck', NULL, NULL, 'technician', NULL, 0.00, 0.00, true, false, false, 'full-time', 0),
('khiggins', '$2b$12$k6MYNOS9uW/39zO.9XIg1OITDj4RLqfyBVry4SYx8q2r1t7iVKxUS', 'Ken Higgins', NULL, NULL, 'manager', NULL, 0.00, 0.00, true, false, false, 'full-time', 0),
('jcurrie', '$2b$12$8W6IzveztIXFSzjmYf8.s.6u0nHBjYZnoQJtyKZ3BrGYYbRanxWVq', 'Janis Currie', NULL, NULL, 'admin', NULL, 0.00, 0.00, true, false, false, 'full-time', 0),
('cemerson', '$2b$12$mxo7FTL2kvVkYqC867rgtOOqU93OJaVMoLSXRvYE6Og3Obv.T1zb2', 'Curtis Emerson', NULL, NULL, 'admin', NULL, 0.00, 0.00, true, false, false, 'full-time', 0),
('zabouzeid', '$2b$12$DqadWc0siZxYzaWVlFbYauoUB1YJydsa/n.mn0xeU6JV6sTAlynXG', 'Zachary Abouzeid', NULL, NULL, 'technician', NULL, 0.00, 0.00, true, false, false, 'full-time', 0),
('sanderson', '$2b$12$1Ofr.UO5H.clzHDt7CGEPe1XiENFSSKxHCcxmgEIpGxFdoIURlGFS', 'Scott Anderson', NULL, NULL, 'technician', NULL, 0.00, 0.00, true, false, false, 'full-time', 0),
('jgamache', '$2b$12$sC8zm9d9JS/OdnNouYhtOO1LqwDR3cY0gt0HVYURfikVYrEhbwaE.', 'Joseph Gamache', NULL, NULL, 'admin', NULL, 0.00, 0.00, true, false, false, 'full-time', 0),
('tfisher', '$2b$12$ZVyW9qHJO2bMhub10ePQOOilADfbZqC9w.gbCSL.UVo/WE3FZ3MBK', 'Tyler Fisher', NULL, NULL, 'manager', '2025-06-10', 50.00, 42.75, true, false, false, 'full-time', 0)
ON CONFLICT (username) DO UPDATE SET
    password = EXCLUDED.password,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    active = EXCLUDED.active;

-- Show results
SELECT username, full_name, role, active FROM users ORDER BY role, full_name;
