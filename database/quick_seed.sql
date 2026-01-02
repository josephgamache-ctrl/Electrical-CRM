-- Quick mock data seeding script
DO $$
DECLARE
    admin_user VARCHAR;
    cust1_id INT;
    cust2_id INT;
    cust3_id INT;
    cust4_id INT;
    cust5_id INT;
    wo1_id INT;
    wo2_id INT;
    wo3_id INT;
    wo4_id INT;
    wo5_id INT;
BEGIN
    SELECT username INTO admin_user FROM users WHERE role = 'admin' LIMIT 1;

    -- Insert customers
    INSERT INTO customers (customer_number, first_name, last_name, customer_type, phone_primary, email,
                          service_street, service_city, service_state, service_zip)
    VALUES ('CUST-1001', 'Michael', 'Johnson', 'residential', '(555) 234-5678', 'mjohnson@email.com',
            '1234 Oak Street', 'Boston', 'MA', '02101')
    ON CONFLICT (customer_number) DO NOTHING
    RETURNING id INTO cust1_id;
    IF cust1_id IS NULL THEN
        SELECT id INTO cust1_id FROM customers WHERE customer_number = 'CUST-1001';
    END IF;

    INSERT INTO customers (customer_number, company_name, customer_type, phone_primary, email,
                          service_street, service_city, service_state, service_zip)
    VALUES ('CUST-1002', 'Davis Commercial Plaza', 'commercial', '(555) 345-6789', 'facilities@davisplaza.com',
            '5678 Commerce Drive', 'Cambridge', 'MA', '02139')
    ON CONFLICT (customer_number) DO NOTHING
    RETURNING id INTO cust2_id;
    IF cust2_id IS NULL THEN
        SELECT id INTO cust2_id FROM customers WHERE customer_number = 'CUST-1002';
    END IF;

    INSERT INTO customers (customer_number, first_name, last_name, customer_type, phone_primary, email,
                          service_street, service_city, service_state, service_zip)
    VALUES ('CUST-1003', 'Sarah', 'Smith', 'residential', '(555) 456-7890', 'smith.family@email.com',
            '9012 Maple Avenue', 'Somerville', 'MA', '02144')
    ON CONFLICT (customer_number) DO NOTHING
    RETURNING id INTO cust3_id;
    IF cust3_id IS NULL THEN
        SELECT id INTO cust3_id FROM customers WHERE customer_number = 'CUST-1003';
    END IF;

    INSERT INTO customers (customer_number, company_name, customer_type, phone_primary, email,
                          service_street, service_city, service_state, service_zip)
    VALUES ('CUST-1004', 'Brown Manufacturing', 'commercial', '(555) 567-8901', 'maintenance@brownmfg.com',
            '3456 Industrial Way', 'Quincy', 'MA', '02169')
    ON CONFLICT (customer_number) DO NOTHING
    RETURNING id INTO cust4_id;
    IF cust4_id IS NULL THEN
        SELECT id INTO cust4_id FROM customers WHERE customer_number = 'CUST-1004';
    END IF;

    INSERT INTO customers (customer_number, first_name, last_name, customer_type, phone_primary, email,
                          service_street, service_city, service_state, service_zip)
    VALUES ('CUST-1005', 'Robert', 'Wilson', 'residential', '(555) 789-0123', 'rwilson@email.com',
            '2345 Pine Street', 'Newton', 'MA', '02458')
    ON CONFLICT (customer_number) DO NOTHING
    RETURNING id INTO cust5_id;
    IF cust5_id IS NULL THEN
        SELECT id INTO cust5_id FROM customers WHERE customer_number = 'CUST-1005';
    END IF;

    -- Create work orders
    -- WO1: Completed 2 weeks ago
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, assigned_to, created_by)
    VALUES ('WO-2024-1001', cust1_id, '1234 Oak Street, Boston MA 02101',
            'Electrical Panel Upgrade - 200A Service', 'completed', 'high',
            CURRENT_DATE - INTERVAL '14 days', 'tfisher', admin_user)
    ON CONFLICT (work_order_number) DO NOTHING
    RETURNING id INTO wo1_id;
    IF wo1_id IS NULL THEN
        SELECT id INTO wo1_id FROM work_orders WHERE work_order_number = 'WO-2024-1001';
    END IF;

    -- WO2: Completed 1 week ago
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, assigned_to, created_by)
    VALUES ('WO-2024-1002', cust3_id, '9012 Maple Avenue, Somerville MA 02144',
            'Install 8 New Outlets in Basement', 'completed', 'normal',
            CURRENT_DATE - INTERVAL '7 days', 'tfisher', admin_user)
    ON CONFLICT (work_order_number) DO NOTHING
    RETURNING id INTO wo2_id;
    IF wo2_id IS NULL THEN
        SELECT id INTO wo2_id FROM work_orders WHERE work_order_number = 'WO-2024-1002';
    END IF;

    -- WO3: Completed 3 days ago
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, assigned_to, created_by)
    VALUES ('WO-2024-1003', cust2_id, '5678 Commerce Drive, Cambridge MA 02139',
            'Replace Parking Lot Light Fixtures', 'completed', 'normal',
            CURRENT_DATE - INTERVAL '3 days', 'nraffery', admin_user)
    ON CONFLICT (work_order_number) DO NOTHING
    RETURNING id INTO wo3_id;
    IF wo3_id IS NULL THEN
        SELECT id INTO wo3_id FROM work_orders WHERE work_order_number = 'WO-2024-1003';
    END IF;

    -- WO4: In Progress today
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, assigned_to, created_by, emergency_call)
    VALUES ('WO-2024-1004', cust4_id, '3456 Industrial Way, Quincy MA 02169',
            'Emergency - No Power in Building A', 'in_progress', 'emergency',
            CURRENT_DATE, 'tfisher', admin_user, true)
    ON CONFLICT (work_order_number) DO NOTHING
    RETURNING id INTO wo4_id;
    IF wo4_id IS NULL THEN
        SELECT id INTO wo4_id FROM work_orders WHERE work_order_number = 'WO-2024-1004';
    END IF;

    -- WO5: Scheduled for today
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, assigned_to, created_by)
    VALUES ('WO-2024-1005', cust5_id, '2345 Pine Street, Newton MA 02458',
            'Install Ceiling Fans in 3 Bedrooms', 'scheduled', 'normal',
            CURRENT_DATE, 'nraffery', admin_user)
    ON CONFLICT (work_order_number) DO NOTHING
    RETURNING id INTO wo5_id;
    IF wo5_id IS NULL THEN
        SELECT id INTO wo5_id FROM work_orders WHERE work_order_number = 'WO-2024-1005';
    END IF;

    -- Add time entries (using hours_worked)
    -- Tyler: WO1 - 6.5 hours
    INSERT INTO time_entries (work_order_id, employee_username, work_date, hours_worked,
                             week_ending_date, notes, created_by)
    VALUES (wo1_id, 'tfisher', CURRENT_DATE - INTERVAL '14 days', 6.5,
            (CURRENT_DATE - INTERVAL '14 days') + (7 - EXTRACT(DOW FROM CURRENT_DATE - INTERVAL '14 days'))::INT,
            'Panel upgrade completed, tested all circuits', 'tfisher')
    ON CONFLICT (work_order_id, employee_username, work_date) DO NOTHING;

    -- Tyler: WO2 - 4 hours
    INSERT INTO time_entries (work_order_id, employee_username, work_date, hours_worked,
                             week_ending_date, notes, created_by)
    VALUES (wo2_id, 'tfisher', CURRENT_DATE - INTERVAL '7 days', 4.0,
            (CURRENT_DATE - INTERVAL '7 days') + (7 - EXTRACT(DOW FROM CURRENT_DATE - INTERVAL '7 days'))::INT,
            'Installed all 8 outlets, tested and labeled', 'tfisher')
    ON CONFLICT (work_order_id, employee_username, work_date) DO NOTHING;

    -- Tyler: WO4 - 5 hours today
    INSERT INTO time_entries (work_order_id, employee_username, work_date, hours_worked,
                             week_ending_date, notes, created_by)
    VALUES (wo4_id, 'tfisher', CURRENT_DATE, 5.0,
            CURRENT_DATE + (7 - EXTRACT(DOW FROM CURRENT_DATE))::INT,
            'Troubleshooting power issue in Building A', 'tfisher')
    ON CONFLICT (work_order_id, employee_username, work_date) DO NOTHING;

    -- Nick: WO1 - 5 hours (assisted)
    INSERT INTO time_entries (work_order_id, employee_username, work_date, hours_worked,
                             week_ending_date, notes, created_by)
    VALUES (wo1_id, 'nraffery', CURRENT_DATE - INTERVAL '14 days', 5.0,
            (CURRENT_DATE - INTERVAL '14 days') + (7 - EXTRACT(DOW FROM CURRENT_DATE - INTERVAL '14 days'))::INT,
            'Assisted with panel installation', 'nraffery')
    ON CONFLICT (work_order_id, employee_username, work_date) DO NOTHING;

    -- Nick: WO3 - 8 hours
    INSERT INTO time_entries (work_order_id, employee_username, work_date, hours_worked,
                             week_ending_date, notes, created_by)
    VALUES (wo3_id, 'nraffery', CURRENT_DATE - INTERVAL '3 days', 8.0,
            (CURRENT_DATE - INTERVAL '3 days') + (7 - EXTRACT(DOW FROM CURRENT_DATE - INTERVAL '3 days'))::INT,
            'Replaced 12 parking lot fixtures, all working', 'nraffery')
    ON CONFLICT (work_order_id, employee_username, work_date) DO NOTHING;

    RAISE NOTICE 'Mock data created successfully!';

END $$;

-- Show summary
SELECT '=== MOCK DATA SUMMARY ===' AS info;
SELECT 'Employees:' AS category, COUNT(*) AS count FROM users WHERE username IN ('tfisher', 'nraffery')
UNION ALL
SELECT 'Customers:', COUNT(*) FROM customers WHERE customer_number LIKE 'CUST-10%'
UNION ALL
SELECT 'Work Orders:', COUNT(*) FROM work_orders WHERE work_order_number LIKE 'WO-2024-10%'
UNION ALL
SELECT 'Time Entries:', COUNT(*) FROM time_entries WHERE employee_username IN ('tfisher', 'nraffery');

SELECT 'Work Orders by Status:' AS info;
SELECT status, COUNT(*) as count
FROM work_orders
WHERE work_order_number LIKE 'WO-2024-10%'
GROUP BY status
ORDER BY status;
