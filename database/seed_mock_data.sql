-- Mock Data Population Script
-- This script adds realistic test data for employees, jobs, time entries, and materials

-- ============================================================
-- 1. CREATE MOCK EMPLOYEES
-- ============================================================

-- Tyler Fisher (Technician)
INSERT INTO users (username, hashed_password, full_name, role, created_at)
VALUES (
    'tfisher',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYfTRpqUQ9S', -- password: <not included>
    'Tyler Fisher',
    'technician',
    NOW() - INTERVAL '6 months'
) ON CONFLICT (username) DO NOTHING;

-- Nick Raffery (Technician)
INSERT INTO users (username, hashed_password, full_name, role, created_at)
VALUES (
    'nraffery',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYfTRpqUQ9S', -- password: <not included>
    'Nick Raffery',
    'technician',
    NOW() - INTERVAL '8 months'
) ON CONFLICT (username) DO NOTHING;

-- Set pay rates for employees
INSERT INTO employee_pay_rates (user_id, hourly_rate, effective_date)
SELECT id, 28.50, NOW() - INTERVAL '6 months'
FROM users WHERE username = 'tfisher'
ON CONFLICT (user_id, effective_date) DO NOTHING;

INSERT INTO employee_pay_rates (user_id, hourly_rate, effective_date)
SELECT id, 32.00, NOW() - INTERVAL '8 months'
FROM users WHERE username = 'nraffery'
ON CONFLICT (user_id, effective_date) DO NOTHING;

-- ============================================================
-- 2. CREATE MOCK CUSTOMERS
-- ============================================================

INSERT INTO customers (name, phone, email, address, city, state, zip, customer_type, created_at)
VALUES
    ('Johnson Residence', '(555) 234-5678', 'mjohnson@email.com', '1234 Oak Street', 'Boston', 'MA', '02101', 'Residential', NOW() - INTERVAL '3 months'),
    ('Davis Commercial Plaza', '(555) 345-6789', 'facilities@davisplaza.com', '5678 Commerce Drive', 'Cambridge', 'MA', '02139', 'Commercial', NOW() - INTERVAL '4 months'),
    ('Smith Family Home', '(555) 456-7890', 'smith.family@email.com', '9012 Maple Avenue', 'Somerville', 'MA', '02144', 'Residential', NOW() - INTERVAL '2 months'),
    ('Brown Manufacturing', '(555) 567-8901', 'maintenance@brownmfg.com', '3456 Industrial Way', 'Quincy', 'MA', '02169', 'Commercial', NOW() - INTERVAL '5 months'),
    ('Martinez Apartment Complex', '(555) 678-9012', 'super@martinezapts.com', '7890 Park Boulevard', 'Brookline', 'MA', '02445', 'Commercial', NOW() - INTERVAL '1 month'),
    ('Wilson Residence', '(555) 789-0123', 'rwilson@email.com', '2345 Pine Street', 'Newton', 'MA', '02458', 'Residential', NOW() - INTERVAL '2 weeks'),
    ('Green Valley Office Park', '(555) 890-1234', 'admin@greenvalley.com', '6789 Valley Road', 'Waltham', 'MA', '02451', 'Commercial', NOW() - INTERVAL '3 days')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. CREATE MOCK WORK ORDERS AT VARIOUS STAGES
-- ============================================================

-- Get customer IDs for reference
DO $$
DECLARE
    johnson_id INT;
    davis_id INT;
    smith_id INT;
    brown_id INT;
    martinez_id INT;
    wilson_id INT;
    greenvalley_id INT;
    tyler_id INT;
    nick_id INT;
    admin_id INT;
BEGIN
    -- Get customer IDs
    SELECT id INTO johnson_id FROM customers WHERE name = 'Johnson Residence' LIMIT 1;
    SELECT id INTO davis_id FROM customers WHERE name = 'Davis Commercial Plaza' LIMIT 1;
    SELECT id INTO smith_id FROM customers WHERE name = 'Smith Family Home' LIMIT 1;
    SELECT id INTO brown_id FROM customers WHERE name = 'Brown Manufacturing' LIMIT 1;
    SELECT id INTO martinez_id FROM customers WHERE name = 'Martinez Apartment Complex' LIMIT 1;
    SELECT id INTO wilson_id FROM customers WHERE name = 'Wilson Residence' LIMIT 1;
    SELECT id INTO greenvalley_id FROM customers WHERE name = 'Green Valley Office Park' LIMIT 1;

    -- Get employee IDs
    SELECT id INTO tyler_id FROM users WHERE username = 'tfisher' LIMIT 1;
    SELECT id INTO nick_id FROM users WHERE username = 'nraffery' LIMIT 1;
    SELECT id INTO admin_id FROM users WHERE role = 'admin' LIMIT 1;

    -- COMPLETED JOBS (from past weeks)

    -- Job 1: Electrical Panel Upgrade (Completed 2 weeks ago)
    INSERT INTO work_orders (work_order_number, customer_id, description, status, priority, scheduled_date, created_by, created_at, updated_at)
    VALUES ('WO-2024-001', johnson_id, 'Electrical Panel Upgrade - 200A Service', 'Completed', 'High',
            CURRENT_DATE - INTERVAL '14 days', admin_id, NOW() - INTERVAL '21 days', NOW() - INTERVAL '14 days');

    -- Job 2: Outlet Installation (Completed 1 week ago)
    INSERT INTO work_orders (work_order_number, customer_id, description, status, priority, scheduled_date, created_by, created_at, updated_at)
    VALUES ('WO-2024-002', smith_id, 'Install 8 New Outlets in Basement', 'Completed', 'Medium',
            CURRENT_DATE - INTERVAL '7 days', admin_id, NOW() - INTERVAL '10 days', NOW() - INTERVAL '7 days');

    -- Job 3: Light Fixture Replacement (Completed 3 days ago)
    INSERT INTO work_orders (work_order_number, customer_id, description, status, priority, scheduled_date, created_by, created_at, updated_at)
    VALUES ('WO-2024-003', davis_id, 'Replace Parking Lot Light Fixtures', 'Completed', 'Medium',
            CURRENT_DATE - INTERVAL '3 days', admin_id, NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 days');

    -- IN PROGRESS JOBS (today or recent)

    -- Job 4: Emergency Service Call (In Progress - started today)
    INSERT INTO work_orders (work_order_number, customer_id, description, status, priority, scheduled_date, created_by, created_at, updated_at)
    VALUES ('WO-2024-004', brown_id, 'Emergency - No Power in Building A', 'In Progress', 'Emergency',
            CURRENT_DATE, admin_id, NOW() - INTERVAL '2 hours', NOW());

    -- Job 5: Circuit Rewiring (In Progress - started yesterday)
    INSERT INTO work_orders (work_order_number, customer_id, description, status, priority, scheduled_date, created_by, created_at, updated_at)
    VALUES ('WO-2024-005', martinez_id, 'Rewire Circuits in Units 101-105', 'In Progress', 'High',
            CURRENT_DATE - INTERVAL '1 day', admin_id, NOW() - INTERVAL '2 days', NOW());

    -- SCHEDULED JOBS (upcoming)

    -- Job 6: Scheduled for today (not started yet)
    INSERT INTO work_orders (work_order_number, customer_id, description, status, priority, scheduled_date, created_by, created_at, updated_at)
    VALUES ('WO-2024-006', wilson_id, 'Install Ceiling Fans in 3 Bedrooms', 'Scheduled', 'Medium',
            CURRENT_DATE, admin_id, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days');

    -- Job 7: Scheduled for tomorrow
    INSERT INTO work_orders (work_order_number, customer_id, description, status, priority, scheduled_date, created_by, created_at, updated_at)
    VALUES ('WO-2024-007', greenvalley_id, 'Install Security Lighting System', 'Scheduled', 'Medium',
            CURRENT_DATE + INTERVAL '1 day', admin_id, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');

    -- Job 8: Scheduled for next week
    INSERT INTO work_orders (work_order_number, customer_id, description, status, priority, scheduled_date, created_by, created_at, updated_at)
    VALUES ('WO-2024-008', johnson_id, 'Install EV Charger in Garage', 'Scheduled', 'Low',
            CURRENT_DATE + INTERVAL '5 days', admin_id, NOW(), NOW());

    -- PENDING JOBS (not yet scheduled)

    -- Job 9: Pending - Quote Requested
    INSERT INTO work_orders (work_order_number, customer_id, description, status, priority, created_by, created_at, updated_at)
    VALUES ('WO-2024-009', davis_id, 'Upgrade LED Lighting Throughout Building', 'Pending', 'Low',
            admin_id, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days');

    -- Job 10: Pending - Customer Callback Needed
    INSERT INTO work_orders (work_order_number, customer_id, description, status, priority, created_by, created_at, updated_at)
    VALUES ('WO-2024-010', smith_id, 'Install Outdoor Security Cameras with Electrical', 'Pending', 'Medium',
            admin_id, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');

    -- ============================================================
    -- 4. ADD TIME ENTRIES FOR EMPLOYEES
    -- ============================================================

    -- Time entries for Tyler Fisher

    -- Job 1 (Completed 2 weeks ago) - Tyler worked 6 hours
    INSERT INTO time_entries (user_id, work_order_id, work_date, clock_in, clock_out, total_hours, notes)
    VALUES (tyler_id, (SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-001'),
            CURRENT_DATE - INTERVAL '14 days', '08:00:00', '14:30:00', 6.5,
            'Panel upgrade completed, tested all circuits');

    -- Job 2 (Completed 1 week ago) - Tyler worked 4 hours
    INSERT INTO time_entries (user_id, work_order_id, work_date, clock_in, clock_out, total_hours, notes)
    VALUES (tyler_id, (SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-002'),
            CURRENT_DATE - INTERVAL '7 days', '09:00:00', '13:00:00', 4.0,
            'Installed all 8 outlets, tested and labeled');

    -- Job 4 (In Progress today) - Tyler working now (4 hours so far)
    INSERT INTO time_entries (user_id, work_order_id, work_date, clock_in, clock_out, total_hours, notes)
    VALUES (tyler_id, (SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-004'),
            CURRENT_DATE, '07:30:00', NULL, NULL,
            'Troubleshooting power issue in Building A');

    -- Time entries for Nick Raffery

    -- Job 1 (Completed 2 weeks ago) - Nick worked 5 hours (assisted Tyler)
    INSERT INTO time_entries (user_id, work_order_id, work_date, clock_in, clock_out, total_hours, notes)
    VALUES (nick_id, (SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-001'),
            CURRENT_DATE - INTERVAL '14 days', '08:30:00', '13:30:00', 5.0,
            'Assisted with panel installation');

    -- Job 3 (Completed 3 days ago) - Nick worked 8 hours
    INSERT INTO time_entries (user_id, work_order_id, work_date, clock_in, clock_out, total_hours, notes)
    VALUES (nick_id, (SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-003'),
            CURRENT_DATE - INTERVAL '3 days', '08:00:00', '16:00:00', 8.0,
            'Replaced 12 parking lot fixtures, all working');

    -- Job 5 (In Progress yesterday) - Nick worked 7 hours yesterday
    INSERT INTO time_entries (user_id, work_order_id, work_date, clock_in, clock_out, total_hours, notes)
    VALUES (nick_id, (SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-005'),
            CURRENT_DATE - INTERVAL '1 day', '08:00:00', '15:00:00', 7.0,
            'Completed rewiring units 101-103');

    -- Job 5 (In Progress today) - Nick working now (3 hours so far)
    INSERT INTO time_entries (user_id, work_order_id, work_date, clock_in, clock_out, total_hours, notes)
    VALUES (nick_id, (SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-005'),
            CURRENT_DATE, '08:00:00', NULL, NULL,
            'Working on units 104-105');

    -- ============================================================
    -- 5. ADD JOB BILLING RATES
    -- ============================================================

    -- Set billing rates for jobs
    INSERT INTO job_billing_rates (work_order_id, hourly_rate, effective_date)
    SELECT id, 85.00, created_at
    FROM work_orders
    WHERE work_order_number IN ('WO-2024-001', 'WO-2024-002', 'WO-2024-003', 'WO-2024-004', 'WO-2024-005')
    ON CONFLICT DO NOTHING;

    -- ============================================================
    -- 6. ADD MATERIALS USED ON JOBS
    -- ============================================================

    -- Materials for Job 1 (Panel Upgrade)
    INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, quantity_allocated, quantity_loaded, quantity_used, quantity_returned, unit_cost, unit_price, line_cost, line_total)
    SELECT
        (SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-001'),
        i.id,
        CASE
            WHEN i.description LIKE '%Panel%' THEN 1
            WHEN i.description LIKE '%Breaker%' THEN 8
            WHEN i.description LIKE '%Wire%' THEN 150
            ELSE 20
        END,
        CASE
            WHEN i.description LIKE '%Panel%' THEN 1
            WHEN i.description LIKE '%Breaker%' THEN 8
            WHEN i.description LIKE '%Wire%' THEN 150
            ELSE 20
        END,
        CASE
            WHEN i.description LIKE '%Panel%' THEN 1
            WHEN i.description LIKE '%Breaker%' THEN 8
            WHEN i.description LIKE '%Wire%' THEN 150
            ELSE 20
        END,
        CASE
            WHEN i.description LIKE '%Panel%' THEN 1
            WHEN i.description LIKE '%Breaker%' THEN 8
            WHEN i.description LIKE '%Wire%' THEN 145
            ELSE 18
        END,
        CASE
            WHEN i.description LIKE '%Wire%' THEN 5
            ELSE 2
        END,
        i.cost,
        i.cost * 1.5, -- 50% markup
        i.cost * CASE WHEN i.description LIKE '%Panel%' THEN 1 WHEN i.description LIKE '%Breaker%' THEN 8 WHEN i.description LIKE '%Wire%' THEN 145 ELSE 18 END,
        i.cost * 1.5 * CASE WHEN i.description LIKE '%Panel%' THEN 1 WHEN i.description LIKE '%Breaker%' THEN 8 WHEN i.description LIKE '%Wire%' THEN 145 ELSE 18 END
    FROM inventory i
    WHERE i.description LIKE '%Panel%' OR i.description LIKE '%Breaker%' OR i.description LIKE '%Wire%'
    LIMIT 4;

    -- Materials for Job 2 (Outlet Installation)
    INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, quantity_allocated, quantity_loaded, quantity_used, quantity_returned, unit_cost, unit_price, line_cost, line_total)
    SELECT
        (SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-002'),
        i.id,
        CASE
            WHEN i.description LIKE '%Outlet%' OR i.description LIKE '%Receptacle%' THEN 8
            WHEN i.description LIKE '%Wire%' THEN 100
            WHEN i.description LIKE '%Box%' THEN 8
            ELSE 16
        END,
        CASE
            WHEN i.description LIKE '%Outlet%' OR i.description LIKE '%Receptacle%' THEN 8
            WHEN i.description LIKE '%Wire%' THEN 100
            WHEN i.description LIKE '%Box%' THEN 8
            ELSE 16
        END,
        CASE
            WHEN i.description LIKE '%Outlet%' OR i.description LIKE '%Receptacle%' THEN 8
            WHEN i.description LIKE '%Wire%' THEN 100
            WHEN i.description LIKE '%Box%' THEN 8
            ELSE 16
        END,
        CASE
            WHEN i.description LIKE '%Outlet%' OR i.description LIKE '%Receptacle%' THEN 8
            WHEN i.description LIKE '%Wire%' THEN 95
            WHEN i.description LIKE '%Box%' THEN 8
            ELSE 16
        END,
        CASE
            WHEN i.description LIKE '%Wire%' THEN 5
            ELSE 0
        END,
        i.cost,
        i.cost * 1.5,
        i.cost * CASE WHEN i.description LIKE '%Outlet%' OR i.description LIKE '%Receptacle%' THEN 8 WHEN i.description LIKE '%Wire%' THEN 95 WHEN i.description LIKE '%Box%' THEN 8 ELSE 16 END,
        i.cost * 1.5 * CASE WHEN i.description LIKE '%Outlet%' OR i.description LIKE '%Receptacle%' THEN 8 WHEN i.description LIKE '%Wire%' THEN 95 WHEN i.description LIKE '%Box%' THEN 8 ELSE 16 END
    FROM inventory i
    WHERE i.description LIKE '%Outlet%' OR i.description LIKE '%Receptacle%' OR i.description LIKE '%Wire%' OR i.description LIKE '%Box%'
    LIMIT 3;

    -- Materials for Job 3 (Light Fixtures)
    INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, quantity_allocated, quantity_loaded, quantity_used, quantity_returned, unit_cost, unit_price, line_cost, line_total)
    SELECT
        (SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-003'),
        i.id,
        12,
        12,
        13,
        12,
        1,
        i.cost,
        i.cost * 1.5,
        i.cost * 12,
        i.cost * 1.5 * 12
    FROM inventory i
    WHERE i.description LIKE '%Light%' OR i.description LIKE '%Fixture%' OR i.description LIKE '%LED%'
    LIMIT 2;

END $$;

-- ============================================================
-- SUMMARY
-- ============================================================
SELECT 'Mock data populated successfully!' AS status;
SELECT 'Employees created: Tyler Fisher, Nick Raffery' AS employees;
SELECT COUNT(*) || ' customers created' AS customers FROM customers;
SELECT COUNT(*) || ' work orders created' AS work_orders FROM work_orders;
SELECT COUNT(*) || ' time entries created' AS time_entries FROM time_entries;
SELECT
    status,
    COUNT(*) as count
FROM work_orders
GROUP BY status
ORDER BY status;
