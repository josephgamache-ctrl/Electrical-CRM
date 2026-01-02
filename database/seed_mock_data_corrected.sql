-- Mock Data Population Script (Corrected for actual schema)
-- This script adds realistic test data for employees, jobs, time entries, and materials

-- ============================================================
-- 1. CREATE MOCK EMPLOYEES
-- ============================================================

-- Tyler Fisher (Technician)
INSERT INTO users (username, password, full_name, role, hourly_rate, overtime_rate, hire_date, active, created_at)
VALUES (
    'tfisher',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYfTRpqUQ9S', -- password: <not included>
    'Tyler Fisher',
    'technician',
    28.50,
    42.75,
    CURRENT_DATE - INTERVAL '6 months',
    true,
    NOW() - INTERVAL '6 months'
) ON CONFLICT (username) DO UPDATE SET
    full_name = 'Tyler Fisher',
    hourly_rate = 28.50,
    overtime_rate = 42.75;

-- Nick Raffery (Technician)
INSERT INTO users (username, password, full_name, role, hourly_rate, overtime_rate, hire_date, active, created_at)
VALUES (
    'nraffery',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYfTRpqUQ9S', -- password: <not included>
    'Nick Raffery',
    'technician',
    32.00,
    48.00,
    CURRENT_DATE - INTERVAL '8 months',
    true,
    NOW() - INTERVAL '8 months'
) ON CONFLICT (username) DO UPDATE SET
    full_name = 'Nick Raffery',
    hourly_rate = 32.00,
    overtime_rate = 48.00;

-- Set pay rate history for employees
INSERT INTO employee_pay_rates (employee_username, hourly_rate, overtime_rate, effective_date, created_by)
SELECT 'tfisher', 28.50, 42.75, CURRENT_DATE - INTERVAL '6 months',
    (SELECT username FROM users WHERE role = 'admin' LIMIT 1)
FROM users WHERE username = 'tfisher'
ON CONFLICT (employee_username, effective_date) DO NOTHING;

INSERT INTO employee_pay_rates (employee_username, hourly_rate, overtime_rate, effective_date, created_by)
SELECT 'nraffery', 32.00, 48.00, CURRENT_DATE - INTERVAL '8 months',
    (SELECT username FROM users WHERE role = 'admin' LIMIT 1)
FROM users WHERE username = 'nraffery'
ON CONFLICT (employee_username, effective_date) DO NOTHING;

-- ============================================================
-- 2. CREATE MOCK CUSTOMERS
-- ============================================================

DO $$
DECLARE
    next_cust_num INT;
BEGIN
    -- Get next customer number
    SELECT COALESCE(MAX(CAST(SUBSTRING(customer_number FROM 2) AS INTEGER)), 1000) + 1
    INTO next_cust_num
    FROM customers;

    -- Johnson Residence
    INSERT INTO customers (customer_number, first_name, last_name, customer_type, phone_primary, email,
                          service_street, service_city, service_state, service_zip, customer_since, created_at)
    VALUES (
        'C' || next_cust_num,
        'Michael',
        'Johnson',
        'residential',
        '(555) 234-5678',
        'mjohnson@email.com',
        '1234 Oak Street',
        'Boston',
        'MA',
        '02101',
        CURRENT_DATE - INTERVAL '3 months',
        NOW() - INTERVAL '3 months'
    ) ON CONFLICT (customer_number) DO NOTHING;

    next_cust_num := next_cust_num + 1;

    -- Davis Commercial Plaza
    INSERT INTO customers (customer_number, company_name, customer_type, phone_primary, email,
                          service_street, service_city, service_state, service_zip, customer_since, created_at)
    VALUES (
        'C' || next_cust_num,
        'Davis Commercial Plaza',
        'commercial',
        '(555) 345-6789',
        'facilities@davisplaza.com',
        '5678 Commerce Drive',
        'Cambridge',
        'MA',
        '02139',
        CURRENT_DATE - INTERVAL '4 months',
        NOW() - INTERVAL '4 months'
    ) ON CONFLICT (customer_number) DO NOTHING;

    next_cust_num := next_cust_num + 1;

    -- Smith Family Home
    INSERT INTO customers (customer_number, first_name, last_name, customer_type, phone_primary, email,
                          service_street, service_city, service_state, service_zip, customer_since, created_at)
    VALUES (
        'C' || next_cust_num,
        'Sarah',
        'Smith',
        'residential',
        '(555) 456-7890',
        'smith.family@email.com',
        '9012 Maple Avenue',
        'Somerville',
        'MA',
        '02144',
        CURRENT_DATE - INTERVAL '2 months',
        NOW() - INTERVAL '2 months'
    ) ON CONFLICT (customer_number) DO NOTHING;

    next_cust_num := next_cust_num + 1;

    -- Brown Manufacturing
    INSERT INTO customers (customer_number, company_name, customer_type, phone_primary, email,
                          service_street, service_city, service_state, service_zip, customer_since, created_at)
    VALUES (
        'C' || next_cust_num,
        'Brown Manufacturing',
        'commercial',
        '(555) 567-8901',
        'maintenance@brownmfg.com',
        '3456 Industrial Way',
        'Quincy',
        'MA',
        '02169',
        CURRENT_DATE - INTERVAL '5 months',
        NOW() - INTERVAL '5 months'
    ) ON CONFLICT (customer_number) DO NOTHING;

    next_cust_num := next_cust_num + 1;

    -- Martinez Apartment Complex
    INSERT INTO customers (customer_number, company_name, customer_type, phone_primary, email,
                          service_street, service_city, service_state, service_zip, customer_since, created_at)
    VALUES (
        'C' || next_cust_num,
        'Martinez Apartment Complex',
        'commercial',
        '(555) 678-9012',
        'super@martinezapts.com',
        '7890 Park Boulevard',
        'Brookline',
        'MA',
        '02445',
        CURRENT_DATE - INTERVAL '1 month',
        NOW() - INTERVAL '1 month'
    ) ON CONFLICT (customer_number) DO NOTHING;

    next_cust_num := next_cust_num + 1;

    -- Wilson Residence
    INSERT INTO customers (customer_number, first_name, last_name, customer_type, phone_primary, email,
                          service_street, service_city, service_state, service_zip, customer_since, created_at)
    VALUES (
        'C' || next_cust_num,
        'Robert',
        'Wilson',
        'residential',
        '(555) 789-0123',
        'rwilson@email.com',
        '2345 Pine Street',
        'Newton',
        'MA',
        '02458',
        CURRENT_DATE - INTERVAL '2 weeks',
        NOW() - INTERVAL '2 weeks'
    ) ON CONFLICT (customer_number) DO NOTHING;

    next_cust_num := next_cust_num + 1;

    -- Green Valley Office Park
    INSERT INTO customers (customer_number, company_name, customer_type, phone_primary, email,
                          service_street, service_city, service_state, service_zip, customer_since, created_at)
    VALUES (
        'C' || next_cust_num,
        'Green Valley Office Park',
        'commercial',
        '(555) 890-1234',
        'admin@greenvalley.com',
        '6789 Valley Road',
        'Waltham',
        'MA',
        '02451',
        CURRENT_DATE - INTERVAL '3 days',
        NOW() - INTERVAL '3 days'
    ) ON CONFLICT (customer_number) DO NOTHING;
END $$;

-- ============================================================
-- 3. CREATE MOCK WORK ORDERS AT VARIOUS STAGES
-- ============================================================

DO $$
DECLARE
    johnson_id INT;
    davis_id INT;
    smith_id INT;
    brown_id INT;
    martinez_id INT;
    wilson_id INT;
    greenvalley_id INT;
    tyler_user VARCHAR;
    nick_user VARCHAR;
    admin_user VARCHAR;
    next_wo_num INT;
BEGIN
    -- Get customer IDs
    SELECT id INTO johnson_id FROM customers WHERE last_name = 'Johnson' AND first_name = 'Michael' LIMIT 1;
    SELECT id INTO davis_id FROM customers WHERE company_name = 'Davis Commercial Plaza' LIMIT 1;
    SELECT id INTO smith_id FROM customers WHERE last_name = 'Smith' AND first_name = 'Sarah' LIMIT 1;
    SELECT id INTO brown_id FROM customers WHERE company_name = 'Brown Manufacturing' LIMIT 1;
    SELECT id INTO martinez_id FROM customers WHERE company_name = 'Martinez Apartment Complex' LIMIT 1;
    SELECT id INTO wilson_id FROM customers WHERE last_name = 'Wilson' AND first_name = 'Robert' LIMIT 1;
    SELECT id INTO greenvalley_id FROM customers WHERE company_name = 'Green Valley Office Park' LIMIT 1;

    -- Get employee usernames
    tyler_user := 'tfisher';
    nick_user := 'nraffery';
    SELECT username INTO admin_user FROM users WHERE role = 'admin' LIMIT 1;

    -- Get next work order number
    SELECT COALESCE(MAX(CAST(SUBSTRING(work_order_number FROM 8) AS INTEGER)), 100) + 1
    INTO next_wo_num
    FROM work_orders;

    -- ============================================================
    -- COMPLETED JOBS (from past weeks)
    -- ============================================================

    -- Job 1: Electrical Panel Upgrade (Completed 2 weeks ago)
    IF johnson_id IS NOT NULL THEN
        INSERT INTO work_orders (work_order_number, customer_id, description, status, priority,
                                scheduled_date, assigned_to, created_by, created_at, last_updated)
        VALUES (
            'WO-2024-' || LPAD(next_wo_num::TEXT, 3, '0'),
            johnson_id,
            'Electrical Panel Upgrade - 200A Service',
            'completed',
            'high',
            CURRENT_DATE - INTERVAL '14 days',
            tyler_user,
            admin_user,
            NOW() - INTERVAL '21 days',
            NOW() - INTERVAL '14 days'
        );
        next_wo_num := next_wo_num + 1;
    END IF;

    -- Job 2: Outlet Installation (Completed 1 week ago)
    IF smith_id IS NOT NULL THEN
        INSERT INTO work_orders (work_order_number, customer_id, description, status, priority,
                                scheduled_date, assigned_to, created_by, created_at, last_updated)
        VALUES (
            'WO-2024-' || LPAD(next_wo_num::TEXT, 3, '0'),
            smith_id,
            'Install 8 New Outlets in Basement',
            'completed',
            'medium',
            CURRENT_DATE - INTERVAL '7 days',
            tyler_user,
            admin_user,
            NOW() - INTERVAL '10 days',
            NOW() - INTERVAL '7 days'
        );
        next_wo_num := next_wo_num + 1;
    END IF;

    -- Job 3: Light Fixture Replacement (Completed 3 days ago)
    IF davis_id IS NOT NULL THEN
        INSERT INTO work_orders (work_order_number, customer_id, description, status, priority,
                                scheduled_date, assigned_to, created_by, created_at, last_updated)
        VALUES (
            'WO-2024-' || LPAD(next_wo_num::TEXT, 3, '0'),
            davis_id,
            'Replace Parking Lot Light Fixtures',
            'completed',
            'medium',
            CURRENT_DATE - INTERVAL '3 days',
            nick_user,
            admin_user,
            NOW() - INTERVAL '5 days',
            NOW() - INTERVAL '3 days'
        );
        next_wo_num := next_wo_num + 1;
    END IF;

    -- ============================================================
    -- IN PROGRESS JOBS (today or recent)
    -- ============================================================

    -- Job 4: Emergency Service Call (In Progress - started today)
    IF brown_id IS NOT NULL THEN
        INSERT INTO work_orders (work_order_number, customer_id, description, status, priority,
                                scheduled_date, assigned_to, created_by, created_at, last_updated)
        VALUES (
            'WO-2024-' || LPAD(next_wo_num::TEXT, 3, '0'),
            brown_id,
            'Emergency - No Power in Building A',
            'in_progress',
            'emergency',
            CURRENT_DATE,
            tyler_user,
            admin_user,
            NOW() - INTERVAL '2 hours',
            NOW()
        );
        next_wo_num := next_wo_num + 1;
    END IF;

    -- Job 5: Circuit Rewiring (In Progress - started yesterday)
    IF martinez_id IS NOT NULL THEN
        INSERT INTO work_orders (work_order_number, customer_id, description, status, priority,
                                scheduled_date, assigned_to, created_by, created_at, last_updated)
        VALUES (
            'WO-2024-' || LPAD(next_wo_num::TEXT, 3, '0'),
            martinez_id,
            'Rewire Circuits in Units 101-105',
            'in_progress',
            'high',
            CURRENT_DATE - INTERVAL '1 day',
            nick_user,
            admin_user,
            NOW() - INTERVAL '2 days',
            NOW()
        );
        next_wo_num := next_wo_num + 1;
    END IF;

    -- ============================================================
    -- SCHEDULED JOBS (upcoming)
    -- ============================================================

    -- Job 6: Scheduled for today (not started yet)
    IF wilson_id IS NOT NULL THEN
        INSERT INTO work_orders (work_order_number, customer_id, description, status, priority,
                                scheduled_date, assigned_to, created_by, created_at, last_updated)
        VALUES (
            'WO-2024-' || LPAD(next_wo_num::TEXT, 3, '0'),
            wilson_id,
            'Install Ceiling Fans in 3 Bedrooms',
            'scheduled',
            'medium',
            CURRENT_DATE,
            tyler_user,
            admin_user,
            NOW() - INTERVAL '3 days',
            NOW() - INTERVAL '3 days'
        );
        next_wo_num := next_wo_num + 1;
    END IF;

    -- Job 7: Scheduled for tomorrow
    IF greenvalley_id IS NOT NULL THEN
        INSERT INTO work_orders (work_order_number, customer_id, description, status, priority,
                                scheduled_date, assigned_to, created_by, created_at, last_updated)
        VALUES (
            'WO-2024-' || LPAD(next_wo_num::TEXT, 3, '0'),
            greenvalley_id,
            'Install Security Lighting System',
            'scheduled',
            'medium',
            CURRENT_DATE + INTERVAL '1 day',
            nick_user,
            admin_user,
            NOW() - INTERVAL '1 day',
            NOW() - INTERVAL '1 day'
        );
        next_wo_num := next_wo_num + 1;
    END IF;

    -- Job 8: Scheduled for next week
    IF johnson_id IS NOT NULL THEN
        INSERT INTO work_orders (work_order_number, customer_id, description, status, priority,
                                scheduled_date, assigned_to, created_by, created_at, last_updated)
        VALUES (
            'WO-2024-' || LPAD(next_wo_num::TEXT, 3, '0'),
            johnson_id,
            'Install EV Charger in Garage',
            'scheduled',
            'low',
            CURRENT_DATE + INTERVAL '5 days',
            tyler_user,
            admin_user,
            NOW(),
            NOW()
        );
        next_wo_num := next_wo_num + 1;
    END IF;

    -- ============================================================
    -- PENDING JOBS (not yet scheduled)
    -- ============================================================

    -- Job 9: Pending - Quote Requested
    IF davis_id IS NOT NULL THEN
        INSERT INTO work_orders (work_order_number, customer_id, description, status, priority,
                                created_by, created_at, last_updated)
        VALUES (
            'WO-2024-' || LPAD(next_wo_num::TEXT, 3, '0'),
            davis_id,
            'Upgrade LED Lighting Throughout Building',
            'pending',
            'low',
            admin_user,
            NOW() - INTERVAL '2 days',
            NOW() - INTERVAL '2 days'
        );
        next_wo_num := next_wo_num + 1;
    END IF;

    -- Job 10: Pending - Customer Callback Needed
    IF smith_id IS NOT NULL THEN
        INSERT INTO work_orders (work_order_number, customer_id, description, status, priority,
                                created_by, created_at, last_updated)
        VALUES (
            'WO-2024-' || LPAD(next_wo_num::TEXT, 3, '0'),
            smith_id,
            'Install Outdoor Security Cameras with Electrical',
            'pending',
            'medium',
            admin_user,
            NOW() - INTERVAL '1 day',
            NOW() - INTERVAL '1 day'
        );
    END IF;

END $$;

-- ============================================================
-- 4. ADD TIME ENTRIES FOR EMPLOYEES
-- ============================================================

DO $$
DECLARE
    tyler_user VARCHAR := 'tfisher';
    nick_user VARCHAR := 'nraffery';
    wo1_id INT;
    wo2_id INT;
    wo3_id INT;
    wo4_id INT;
    wo5_id INT;
BEGIN
    -- Get work order IDs (get the most recent ones we just created)
    SELECT id INTO wo1_id FROM work_orders WHERE description LIKE '%Panel Upgrade%' ORDER BY created_at DESC LIMIT 1;
    SELECT id INTO wo2_id FROM work_orders WHERE description LIKE '%8 New Outlets%' ORDER BY created_at DESC LIMIT 1;
    SELECT id INTO wo3_id FROM work_orders WHERE description LIKE '%Parking Lot Light%' ORDER BY created_at DESC LIMIT 1;
    SELECT id INTO wo4_id FROM work_orders WHERE description LIKE '%No Power in Building%' ORDER BY created_at DESC LIMIT 1;
    SELECT id INTO wo5_id FROM work_orders WHERE description LIKE '%Rewire Circuits%' ORDER BY created_at DESC LIMIT 1;

    -- Time entries for Tyler Fisher

    -- Job 1 (Completed 2 weeks ago) - Tyler worked 6.5 hours
    IF wo1_id IS NOT NULL THEN
        INSERT INTO time_entries (employee_username, work_order_id, work_date, clock_in, clock_out, total_hours, notes, created_by)
        VALUES (tyler_user, wo1_id, CURRENT_DATE - INTERVAL '14 days', '08:00:00', '14:30:00', 6.5,
                'Panel upgrade completed, tested all circuits', tyler_user);
    END IF;

    -- Job 2 (Completed 1 week ago) - Tyler worked 4 hours
    IF wo2_id IS NOT NULL THEN
        INSERT INTO time_entries (employee_username, work_order_id, work_date, clock_in, clock_out, total_hours, notes, created_by)
        VALUES (tyler_user, wo2_id, CURRENT_DATE - INTERVAL '7 days', '09:00:00', '13:00:00', 4.0,
                'Installed all 8 outlets, tested and labeled', tyler_user);
    END IF;

    -- Job 4 (In Progress today) - Tyler working now (4 hours so far)
    IF wo4_id IS NOT NULL THEN
        INSERT INTO time_entries (employee_username, work_order_id, work_date, clock_in, clock_out, total_hours, notes, created_by)
        VALUES (tyler_user, wo4_id, CURRENT_DATE, '07:30:00', NULL, NULL,
                'Troubleshooting power issue in Building A', tyler_user);
    END IF;

    -- Time entries for Nick Raffery

    -- Job 1 (Completed 2 weeks ago) - Nick worked 5 hours (assisted Tyler)
    IF wo1_id IS NOT NULL THEN
        INSERT INTO time_entries (employee_username, work_order_id, work_date, clock_in, clock_out, total_hours, notes, created_by)
        VALUES (nick_user, wo1_id, CURRENT_DATE - INTERVAL '14 days', '08:30:00', '13:30:00', 5.0,
                'Assisted with panel installation', nick_user);
    END IF;

    -- Job 3 (Completed 3 days ago) - Nick worked 8 hours
    IF wo3_id IS NOT NULL THEN
        INSERT INTO time_entries (employee_username, work_order_id, work_date, clock_in, clock_out, total_hours, notes, created_by)
        VALUES (nick_user, wo3_id, CURRENT_DATE - INTERVAL '3 days', '08:00:00', '16:00:00', 8.0,
                'Replaced 12 parking lot fixtures, all working', nick_user);
    END IF;

    -- Job 5 (In Progress yesterday) - Nick worked 7 hours yesterday
    IF wo5_id IS NOT NULL THEN
        INSERT INTO time_entries (employee_username, work_order_id, work_date, clock_in, clock_out, total_hours, notes, created_by)
        VALUES (nick_user, wo5_id, CURRENT_DATE - INTERVAL '1 day', '08:00:00', '15:00:00', 7.0,
                'Completed rewiring units 101-103', nick_user);

        -- Job 5 (In Progress today) - Nick working now (3 hours so far)
        INSERT INTO time_entries (employee_username, work_order_id, work_date, clock_in, clock_out, total_hours, notes, created_by)
        VALUES (nick_user, wo5_id, CURRENT_DATE, '08:00:00', NULL, NULL,
                'Working on units 104-105', nick_user);
    END IF;

END $$;

-- ============================================================
-- SUMMARY
-- ============================================================
SELECT '=== MOCK DATA POPULATED SUCCESSFULLY ===' AS status;
SELECT '' AS blank_line;
SELECT 'EMPLOYEES CREATED:' AS section;
SELECT username, full_name, role, hourly_rate FROM users WHERE username IN ('tfisher', 'nraffery');
SELECT '' AS blank_line;
SELECT 'CUSTOMERS CREATED:' AS section;
SELECT COUNT(*) || ' total customers' AS count FROM customers;
SELECT '' AS blank_line;
SELECT 'WORK ORDERS BY STATUS:' AS section;
SELECT status, COUNT(*) as count FROM work_orders GROUP BY status ORDER BY status;
SELECT '' AS blank_line;
SELECT 'TIME ENTRIES CREATED:' AS section;
SELECT COUNT(*) || ' total time entries' AS count FROM time_entries;
SELECT '' AS blank_line;
SELECT 'TIME SUMMARY BY EMPLOYEE:' AS section;
SELECT
    u.full_name,
    COUNT(te.id) as entries,
    SUM(COALESCE(te.total_hours, 0)) as total_hours
FROM users u
LEFT JOIN time_entries te ON u.username = te.employee_username
WHERE u.username IN ('tfisher', 'nraffery')
GROUP BY u.full_name;
