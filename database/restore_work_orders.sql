-- Restore Work Orders for MA Electrical
-- Created: December 10, 2025

-- First, get the admin user and customer IDs
DO $$
DECLARE
    admin_user VARCHAR;
    cust1_id INT;
    cust2_id INT;
    cust3_id INT;
    cust4_id INT;
    cust5_id INT;
    cust6_id INT;
    cust7_id INT;
    cust8_id INT;
BEGIN
    -- Get an admin user
    SELECT username INTO admin_user FROM users WHERE role = 'admin' LIMIT 1;
    IF admin_user IS NULL THEN
        RAISE EXCEPTION 'No admin user found in users table.';
    END IF;

    -- Get existing customer or create new ones
    SELECT id INTO cust1_id FROM customers WHERE customer_number = 'CUST-0001' LIMIT 1;

    -- Create additional customers if they don't exist
    IF NOT EXISTS (SELECT 1 FROM customers WHERE customer_number = 'CUST-1001') THEN
        INSERT INTO customers (customer_number, first_name, last_name, customer_type, phone_primary, email,
                              service_street, service_city, service_state, service_zip)
        VALUES ('CUST-1001', 'Michael', 'Johnson', 'residential', '(618) 555-1001', 'mjohnson@email.com',
                '1234 Oak Street', 'Granite City', 'IL', '62040')
        RETURNING id INTO cust1_id;
    ELSE
        SELECT id INTO cust1_id FROM customers WHERE customer_number = 'CUST-1001';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM customers WHERE customer_number = 'CUST-1002') THEN
        INSERT INTO customers (customer_number, company_name, customer_type, phone_primary, email,
                              service_street, service_city, service_state, service_zip)
        VALUES ('CUST-1002', 'Davis Commercial Plaza', 'commercial', '(618) 555-1002', 'facilities@davisplaza.com',
                '5678 Commerce Drive', 'Collinsville', 'IL', '62234')
        RETURNING id INTO cust2_id;
    ELSE
        SELECT id INTO cust2_id FROM customers WHERE customer_number = 'CUST-1002';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM customers WHERE customer_number = 'CUST-1003') THEN
        INSERT INTO customers (customer_number, first_name, last_name, customer_type, phone_primary, email,
                              service_street, service_city, service_state, service_zip)
        VALUES ('CUST-1003', 'Sarah', 'Smith', 'residential', '(618) 555-1003', 'smith.family@email.com',
                '9012 Maple Avenue', 'Edwardsville', 'IL', '62025')
        RETURNING id INTO cust3_id;
    ELSE
        SELECT id INTO cust3_id FROM customers WHERE customer_number = 'CUST-1003';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM customers WHERE customer_number = 'CUST-1004') THEN
        INSERT INTO customers (customer_number, company_name, customer_type, phone_primary, email,
                              service_street, service_city, service_state, service_zip)
        VALUES ('CUST-1004', 'Brown Manufacturing', 'commercial', '(618) 555-1004', 'maintenance@brownmfg.com',
                '3456 Industrial Way', 'Wood River', 'IL', '62095')
        RETURNING id INTO cust4_id;
    ELSE
        SELECT id INTO cust4_id FROM customers WHERE customer_number = 'CUST-1004';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM customers WHERE customer_number = 'CUST-1005') THEN
        INSERT INTO customers (customer_number, first_name, last_name, customer_type, phone_primary, email,
                              service_street, service_city, service_state, service_zip)
        VALUES ('CUST-1005', 'Robert', 'Wilson', 'residential', '(618) 555-1005', 'rwilson@email.com',
                '2345 Pine Street', 'Glen Carbon', 'IL', '62034')
        RETURNING id INTO cust5_id;
    ELSE
        SELECT id INTO cust5_id FROM customers WHERE customer_number = 'CUST-1005';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM customers WHERE customer_number = 'CUST-1006') THEN
        INSERT INTO customers (customer_number, first_name, last_name, customer_type, phone_primary, email,
                              service_street, service_city, service_state, service_zip)
        VALUES ('CUST-1006', 'Jennifer', 'Martinez', 'residential', '(618) 555-1006', 'jmartinez@email.com',
                '7890 Cedar Lane', 'Granite City', 'IL', '62040')
        RETURNING id INTO cust6_id;
    ELSE
        SELECT id INTO cust6_id FROM customers WHERE customer_number = 'CUST-1006';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM customers WHERE customer_number = 'CUST-1007') THEN
        INSERT INTO customers (customer_number, company_name, customer_type, phone_primary, email,
                              service_street, service_city, service_state, service_zip)
        VALUES ('CUST-1007', 'Green Valley Apartments', 'commercial', '(618) 555-1007', 'manager@greenvalley.com',
                '1111 Valley Road', 'Maryville', 'IL', '62062')
        RETURNING id INTO cust7_id;
    ELSE
        SELECT id INTO cust7_id FROM customers WHERE customer_number = 'CUST-1007';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM customers WHERE customer_number = 'CUST-1008') THEN
        INSERT INTO customers (customer_number, first_name, last_name, customer_type, phone_primary, email,
                              service_street, service_city, service_state, service_zip)
        VALUES ('CUST-1008', 'David', 'Thompson', 'residential', '(618) 555-1008', 'dthompson@email.com',
                '4321 Birch Drive', 'Alton', 'IL', '62002')
        RETURNING id INTO cust8_id;
    ELSE
        SELECT id INTO cust8_id FROM customers WHERE customer_number = 'CUST-1008';
    END IF;

    -- Create Work Orders (mix of statuses and dates)

    -- WO-2024-1001: Completed 3 weeks ago - Panel Upgrade
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, assigned_to, created_by)
    VALUES ('WO-2024-1001', cust1_id, '1234 Oak Street, Granite City IL 62040',
            'Electrical Panel Upgrade - Replace 100A panel with 200A service',
            'completed', 'high',
            CURRENT_DATE - INTERVAL '21 days', admin_user, admin_user)
    ON CONFLICT (work_order_number) DO NOTHING;

    -- WO-2024-1002: Completed 2 weeks ago - Outlet Installation
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, assigned_to, created_by)
    VALUES ('WO-2024-1002', cust3_id, '9012 Maple Avenue, Edwardsville IL 62025',
            'Install 12 new GFCI outlets in basement and garage',
            'completed', 'normal',
            CURRENT_DATE - INTERVAL '14 days', admin_user, admin_user)
    ON CONFLICT (work_order_number) DO NOTHING;

    -- WO-2024-1003: Completed 1 week ago - Commercial Lighting
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, assigned_to, created_by)
    VALUES ('WO-2024-1003', cust2_id, '5678 Commerce Drive, Collinsville IL 62234',
            'Replace parking lot lighting fixtures with LED units',
            'completed', 'normal',
            CURRENT_DATE - INTERVAL '7 days', admin_user, admin_user)
    ON CONFLICT (work_order_number) DO NOTHING;

    -- WO-2024-1004: In Progress today - Emergency Service
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, assigned_to, created_by, emergency_call)
    VALUES ('WO-2024-1004', cust4_id, '3456 Industrial Way, Wood River IL 62095',
            'Emergency - No power in Building A, main breaker tripped',
            'in_progress', 'emergency',
            CURRENT_DATE, admin_user, admin_user, true)
    ON CONFLICT (work_order_number) DO NOTHING;

    -- WO-2024-1005: Scheduled for today - Ceiling Fans
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, assigned_to, created_by)
    VALUES ('WO-2024-1005', cust5_id, '2345 Pine Street, Glen Carbon IL 62034',
            'Install ceiling fans in 4 bedrooms with wall controls',
            'scheduled', 'normal',
            CURRENT_DATE, admin_user, admin_user)
    ON CONFLICT (work_order_number) DO NOTHING;

    -- WO-2024-1006: Scheduled for tomorrow - EV Charger
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, assigned_to, created_by)
    VALUES ('WO-2024-1006', cust6_id, '7890 Cedar Lane, Granite City IL 62040',
            'Install Level 2 EV charger in garage with dedicated 50A circuit',
            'scheduled', 'high',
            CURRENT_DATE + INTERVAL '1 day', admin_user, admin_user)
    ON CONFLICT (work_order_number) DO NOTHING;

    -- WO-2024-1007: Scheduled for 3 days - Apartment Building
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, created_by)
    VALUES ('WO-2024-1007', cust7_id, '1111 Valley Road, Maryville IL 62062',
            'Replace hallway lighting in 3 buildings (24 fixtures total)',
            'scheduled', 'normal',
            CURRENT_DATE + INTERVAL '3 days', admin_user)
    ON CONFLICT (work_order_number) DO NOTHING;

    -- WO-2024-1008: Scheduled for next week - Generator
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, created_by)
    VALUES ('WO-2024-1008', cust4_id, '3456 Industrial Way, Wood River IL 62095',
            'Install backup generator with transfer switch for critical systems',
            'scheduled', 'high',
            CURRENT_DATE + INTERVAL '7 days', admin_user)
    ON CONFLICT (work_order_number) DO NOTHING;

    -- WO-2024-1009: Pending - Home Rewire
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, created_by)
    VALUES ('WO-2024-1009', cust8_id, '4321 Birch Drive, Alton IL 62002',
            'Partial rewire - Replace knob and tube wiring in main floor',
            'pending', 'high', admin_user)
    ON CONFLICT (work_order_number) DO NOTHING;

    -- WO-2024-1010: Pending - Hot Tub Circuit
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, created_by)
    VALUES ('WO-2024-1010', cust3_id, '9012 Maple Avenue, Edwardsville IL 62025',
            'Install dedicated 60A circuit for outdoor hot tub',
            'pending', 'normal', admin_user)
    ON CONFLICT (work_order_number) DO NOTHING;

    -- WO-2024-1011: Scheduled for 2 days - Commercial Kitchen
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, created_by)
    VALUES ('WO-2024-1011', cust2_id, '5678 Commerce Drive, Collinsville IL 62234',
            'Install electrical for new commercial kitchen equipment',
            'scheduled', 'high',
            CURRENT_DATE + INTERVAL '2 days', admin_user)
    ON CONFLICT (work_order_number) DO NOTHING;

    -- WO-2024-1012: In Progress - Troubleshooting
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, assigned_to, created_by)
    VALUES ('WO-2024-1012', cust1_id, '1234 Oak Street, Granite City IL 62040',
            'Troubleshoot intermittent power loss in upstairs bedrooms',
            'in_progress', 'high',
            CURRENT_DATE, admin_user, admin_user)
    ON CONFLICT (work_order_number) DO NOTHING;

    -- WO-2024-1013: Scheduled for 5 days - Outdoor Lighting
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, assigned_to, created_by)
    VALUES ('WO-2024-1013', cust5_id, '2345 Pine Street, Glen Carbon IL 62034',
            'Install landscape lighting system with timer and photocell',
            'scheduled', 'normal',
            CURRENT_DATE + INTERVAL '5 days', admin_user, admin_user)
    ON CONFLICT (work_order_number) DO NOTHING;

    -- WO-2024-1014: Pending - Code Compliance
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, created_by)
    VALUES ('WO-2024-1014', cust7_id, '1111 Valley Road, Maryville IL 62062',
            'Bring electrical system up to code for building inspection',
            'pending', 'high', admin_user)
    ON CONFLICT (work_order_number) DO NOTHING;

    -- WO-2024-1015: Scheduled for next week - HVAC Circuit
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, created_by)
    VALUES ('WO-2024-1015', cust6_id, '7890 Cedar Lane, Granite City IL 62040',
            'Install 240V circuit for new central air conditioning unit',
            'scheduled', 'normal',
            CURRENT_DATE + INTERVAL '10 days', admin_user)
    ON CONFLICT (work_order_number) DO NOTHING;

    RAISE NOTICE '✅ Successfully created 15 work orders';
    RAISE NOTICE 'Statuses: 3 completed, 3 in_progress, 8 scheduled, 3 pending';
    RAISE NOTICE 'Assigned: Assigned jobs assigned to admin_user';

END $$;

-- Show summary
SELECT '=== WORK ORDERS SUMMARY ===' AS info;

SELECT
    status,
    COUNT(*) as count,
    STRING_AGG(work_order_number, ', ' ORDER BY work_order_number) as work_orders
FROM work_orders
WHERE work_order_number LIKE 'WO-2024-%'
GROUP BY status
ORDER BY
    CASE status
        WHEN 'in_progress' THEN 1
        WHEN 'scheduled' THEN 2
        WHEN 'pending' THEN 3
        WHEN 'completed' THEN 4
        ELSE 5
    END;

SELECT '=== ASSIGNMENT SUMMARY ===' AS info;

SELECT
    COALESCE(assigned_to, 'Unassigned') as assigned_to,
    COUNT(*) as job_count
FROM work_orders
WHERE work_order_number LIKE 'WO-2024-%'
GROUP BY assigned_to
ORDER BY job_count DESC;
