-- Comprehensive Mock Data for Testing Reports
-- Creates 4 more employees, 15 more jobs, materials, and financial data

DO $$
DECLARE
    admin_user VARCHAR;
    -- Employee usernames
    emp1 VARCHAR := 'jmartin';
    emp2 VARCHAR := 'srodriguez';
    emp3 VARCHAR := 'dchen';
    emp4 VARCHAR := 'lthompson';
    -- Customer IDs
    cust_ids INT[];
    new_cust_id INT;
    -- Work order IDs
    wo_id INT;
    -- Inventory IDs for materials
    inv_ids INT[];
BEGIN
    SELECT username INTO admin_user FROM users WHERE role = 'admin' LIMIT 1;

    -- ============================================================
    -- CREATE 4 MORE EMPLOYEES
    -- ============================================================

    INSERT INTO users (username, password, full_name, role, hourly_rate, overtime_rate, hire_date, active)
    VALUES
    ('jmartin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYfTRpqUQ9S', 'James Martin', 'technician', 30.00, 45.00, CURRENT_DATE - INTERVAL '1 year', true),
    ('srodriguez', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYfTRpqUQ9S', 'Sarah Rodriguez', 'technician', 29.50, 44.25, CURRENT_DATE - INTERVAL '10 months', true),
    ('dchen', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYfTRpqUQ9S', 'David Chen', 'technician', 31.00, 46.50, CURRENT_DATE - INTERVAL '2 years', true),
    ('lthompson', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYfTRpqUQ9S', 'Linda Thompson', 'manager', 35.00, 52.50, CURRENT_DATE - INTERVAL '3 years', true)
    ON CONFLICT (username) DO NOTHING;

    -- ============================================================
    -- CREATE MORE CUSTOMERS
    -- ============================================================

    INSERT INTO customers (customer_number, first_name, last_name, customer_type, phone_primary, email, service_street, service_city, service_state, service_zip)
    VALUES
    ('CUST-1006', 'Emily', 'Anderson', 'residential', '(555) 111-2222', 'eanderson@email.com', '789 Cedar Lane', 'Medford', 'MA', '02155'),
    ('CUST-1007', 'Thomas', 'White', 'residential', '(555) 222-3333', 'twhite@email.com', '456 Birch Road', 'Malden', 'MA', '02148'),
    ('CUST-1008', NULL, NULL, 'commercial', '(555) 333-4444', 'info@techstartup.com', '999 Innovation Drive', 'Cambridge', 'MA', '02142'),
    ('CUST-1009', 'Maria', 'Garcia', 'residential', '(555) 444-5555', 'mgarcia@email.com', '123 Willow Street', 'Arlington', 'MA', '02474'),
    ('CUST-1010', NULL, NULL, 'commercial', '(555) 555-6666', 'manager@retailstore.com', '321 Shopping Plaza', 'Burlington', 'MA', '01803'),
    ('CUST-1011', 'Christopher', 'Lee', 'residential', '(555) 666-7777', 'clee@email.com', '654 Elm Avenue', 'Lexington', 'MA', '02420'),
    ('CUST-1012', NULL, NULL, 'commercial', '(555) 777-8888', 'facilities@hospital.org', '111 Medical Center', 'Waltham', 'MA', '02453'),
    ('CUST-1013', 'Jennifer', 'Taylor', 'residential', '(555) 888-9999', 'jtaylor@email.com', '987 Oak Circle', 'Watertown', 'MA', '02472'),
    ('CUST-1014', 'Daniel', 'Martinez', 'residential', '(555) 999-0000', 'dmartinez@email.com', '246 Pine Drive', 'Belmont', 'MA', '02478'),
    ('CUST-1015', NULL, NULL, 'commercial', '(555) 101-1010', 'contact@restaurant.com', '852 Main Street', 'Cambridge', 'MA', '02138')
    ON CONFLICT (customer_number) DO NOTHING;

    -- Update company names for commercial customers
    UPDATE customers SET company_name = 'TechStartup Inc' WHERE customer_number = 'CUST-1008';
    UPDATE customers SET company_name = 'Retail Store Chain' WHERE customer_number = 'CUST-1010';
    UPDATE customers SET company_name = 'General Hospital' WHERE customer_number = 'CUST-1012';
    UPDATE customers SET company_name = 'Italian Restaurant' WHERE customer_number = 'CUST-1015';

    -- Get customer IDs for reference
    SELECT ARRAY(SELECT id FROM customers WHERE customer_number LIKE 'CUST-10%' ORDER BY id) INTO cust_ids;

    -- Get inventory IDs for materials
    SELECT ARRAY(SELECT id FROM inventory LIMIT 20) INTO inv_ids;

    -- ============================================================
    -- CREATE 15 MORE WORK ORDERS WITH VARIETY
    -- ============================================================

    -- WO 1006: Completed last month - with materials and invoice
    SELECT id INTO new_cust_id FROM customers WHERE customer_number = 'CUST-1006';
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, assigned_to, created_by,
                            quoted_labor_hours, quoted_labor_rate, quoted_labor_cost, quoted_material_cost,
                            actual_labor_cost, actual_material_cost, subtotal, tax_amount, total_amount)
    VALUES ('WO-2024-1006', new_cust_id, '789 Cedar Lane, Medford MA',
            'Install GFCI Outlets in Kitchen and Bathrooms',
            'completed', 'normal', CURRENT_DATE - 30, emp1, admin_user,
            3.0, 85.00, 255.00, 150.00,
            255.00, 180.50, 435.50, 27.22, 462.72)
    RETURNING id INTO wo_id;

    -- Add time entry
    INSERT INTO time_entries (work_order_id, employee_username, work_date, hours_worked, week_ending_date, notes, created_by)
    VALUES (wo_id, emp1, CURRENT_DATE - 30, 3.5, CURRENT_DATE - 26, 'Installed 6 GFCI outlets', emp1);

    -- Add materials
    IF array_length(inv_ids, 1) >= 3 THEN
        INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, quantity_allocated,
                                       quantity_loaded, quantity_used, quantity_returned,
                                       unit_cost, unit_price, line_cost, line_total)
        VALUES
        (wo_id, inv_ids[1], 6, 6, 8, 6, 2, 12.50, 18.75, 75.00, 112.50),
        (wo_id, inv_ids[2], 1, 1, 1, 1, 0, 45.00, 67.50, 45.00, 67.50);
    END IF;

    -- WO 1007: Completed last week - materials subtracted (returned unused)
    SELECT id INTO new_cust_id FROM customers WHERE customer_number = 'CUST-1007';
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, assigned_to, created_by,
                            actual_labor_cost, actual_material_cost, subtotal, tax_amount, total_amount)
    VALUES ('WO-2024-1007', new_cust_id, '456 Birch Road, Malden MA',
            'Troubleshoot Circuit Breaker Issues',
            'completed', 'high', CURRENT_DATE - 8, emp2, admin_user,
            212.50, 85.00, 297.50, 18.59, 316.09)
    RETURNING id INTO wo_id;

    INSERT INTO time_entries (work_order_id, employee_username, work_date, hours_worked, week_ending_date, notes, created_by)
    VALUES (wo_id, emp2, CURRENT_DATE - 8, 2.5, CURRENT_DATE - 3, 'Found faulty breaker, replaced', emp2);

    -- Materials with returns (subtracted)
    IF array_length(inv_ids, 1) >= 4 THEN
        INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, quantity_allocated,
                                       quantity_loaded, quantity_used, quantity_returned,
                                       unit_cost, unit_price, line_cost, line_total)
        VALUES
        (wo_id, inv_ids[3], 2, 2, 3, 1, 2, 35.00, 52.50, 35.00, 52.50),
        (wo_id, inv_ids[4], 10, 10, 15, 8, 7, 2.50, 3.75, 20.00, 30.00);
    END IF;

    -- WO 1008: In Progress - commercial job with materials
    SELECT id INTO new_cust_id FROM customers WHERE customer_number = 'CUST-1008';
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, assigned_to, helper_1, created_by,
                            quoted_labor_hours, quoted_labor_rate)
    VALUES ('WO-2024-1008', new_cust_id, '999 Innovation Drive, Cambridge MA',
            'Office Electrical System Upgrade - 50 Workstations',
            'in_progress', 'high', CURRENT_DATE - 2, emp3, emp1, admin_user,
            40.0, 90.00)
    RETURNING id INTO wo_id;

    INSERT INTO time_entries (work_order_id, employee_username, work_date, hours_worked, week_ending_date, created_by)
    VALUES
    (wo_id, emp3, CURRENT_DATE - 2, 8.0, CURRENT_DATE + 5, emp3),
    (wo_id, emp1, CURRENT_DATE - 2, 8.0, CURRENT_DATE + 5, emp1),
    (wo_id, emp3, CURRENT_DATE - 1, 7.5, CURRENT_DATE + 5, emp3),
    (wo_id, emp1, CURRENT_DATE - 1, 7.5, CURRENT_DATE + 5, emp1);

    -- Add materials to in-progress job
    IF array_length(inv_ids, 1) >= 8 THEN
        INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, quantity_allocated,
                                       quantity_loaded, quantity_used, quantity_returned,
                                       unit_cost, unit_price, line_cost, line_total)
        VALUES
        (wo_id, inv_ids[5], 50, 50, 55, 48, 0, 8.50, 12.75, 408.00, 612.00),
        (wo_id, inv_ids[6], 200, 200, 220, 185, 0, 1.25, 1.88, 231.25, 347.50),
        (wo_id, inv_ids[7], 25, 25, 30, 22, 0, 15.00, 22.50, 330.00, 495.00);
    END IF;

    -- WO 1009: Completed with outstanding balance
    SELECT id INTO new_cust_id FROM customers WHERE customer_number = 'CUST-1009';
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, assigned_to, created_by,
                            actual_labor_cost, actual_material_cost, subtotal, tax_amount, total_amount)
    VALUES ('WO-2024-1009', new_cust_id, '123 Willow Street, Arlington MA',
            'Install Outdoor Lighting and Landscape Power',
            'completed', 'normal', CURRENT_DATE - 12, emp2, admin_user,
            425.00, 320.00, 745.00, 46.56, 791.56)
    RETURNING id INTO wo_id;

    INSERT INTO time_entries (work_order_id, employee_username, work_date, hours_worked, week_ending_date, created_by)
    VALUES (wo_id, emp2, CURRENT_DATE - 12, 5.0, CURRENT_DATE - 7, emp2);

    -- Create invoice with partial payment (outstanding balance)
    INSERT INTO invoices (invoice_number, work_order_id, customer_id, invoice_date, due_date,
                         subtotal, tax_amount, total_amount, amount_paid, balance_due, status, created_by)
    VALUES ('INV-2024-001', wo_id, new_cust_id, CURRENT_DATE - 10, CURRENT_DATE - 10 + INTERVAL '30 days',
            745.00, 46.56, 791.56, 400.00, 391.56, 'partially_paid', admin_user);

    -- WO 1010: Scheduled for tomorrow - commercial
    SELECT id INTO new_cust_id FROM customers WHERE customer_number = 'CUST-1010';
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, assigned_to, created_by,
                            quoted_labor_hours, quoted_labor_rate, quoted_material_cost)
    VALUES ('WO-2024-1010', new_cust_id, '321 Shopping Plaza, Burlington MA',
            'Emergency Exit Lighting Installation - Code Compliance',
            'scheduled', 'high', CURRENT_DATE + 1, emp4, admin_user,
            6.0, 90.00, 450.00);

    -- WO 1011: Completed 3 weeks ago with full payment
    SELECT id INTO new_cust_id FROM customers WHERE customer_number = 'CUST-1011';
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, assigned_to, created_by,
                            actual_labor_cost, actual_material_cost, subtotal, tax_amount, total_amount)
    VALUES ('WO-2024-1011', new_cust_id, '654 Elm Avenue, Lexington MA',
            'Whole House Surge Protector Installation',
            'completed', 'normal', CURRENT_DATE - 21, emp3, admin_user,
            170.00, 280.00, 450.00, 28.13, 478.13)
    RETURNING id INTO wo_id;

    INSERT INTO time_entries (work_order_id, employee_username, work_date, hours_worked, week_ending_date, created_by)
    VALUES (wo_id, emp3, CURRENT_DATE - 21, 2.0, CURRENT_DATE - 14, emp3);

    INSERT INTO invoices (invoice_number, work_order_id, customer_id, invoice_date, due_date,
                         subtotal, tax_amount, total_amount, amount_paid, balance_due, status, created_by)
    VALUES ('INV-2024-002', wo_id, new_cust_id, CURRENT_DATE - 19, CURRENT_DATE - 19 + INTERVAL '30 days',
            450.00, 28.13, 478.13, 478.13, 0.00, 'paid', admin_user);

    -- WO 1012: Large commercial job completed with outstanding balance
    SELECT id INTO new_cust_id FROM customers WHERE customer_number = 'CUST-1012';
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, assigned_to, helper_1, helper_2, created_by,
                            actual_labor_cost, actual_material_cost, subtotal, tax_amount, total_amount)
    VALUES ('WO-2024-1012', new_cust_id, '111 Medical Center, Waltham MA',
            'Emergency Generator Transfer Switch Installation',
            'completed', 'emergency', CURRENT_DATE - 45, emp4, emp3, emp1, admin_user,
            2400.00, 3500.00, 5900.00, 368.75, 6268.75)
    RETURNING id INTO wo_id;

    INSERT INTO time_entries (work_order_id, employee_username, work_date, hours_worked, week_ending_date, created_by)
    VALUES
    (wo_id, emp4, CURRENT_DATE - 45, 8.0, CURRENT_DATE - 42, emp4),
    (wo_id, emp3, CURRENT_DATE - 45, 8.0, CURRENT_DATE - 42, emp3),
    (wo_id, emp1, CURRENT_DATE - 45, 8.0, CURRENT_DATE - 42, emp1),
    (wo_id, emp4, CURRENT_DATE - 44, 8.0, CURRENT_DATE - 42, emp4),
    (wo_id, emp3, CURRENT_DATE - 44, 8.0, CURRENT_DATE - 42, emp3);

    INSERT INTO invoices (invoice_number, work_order_id, customer_id, invoice_date, due_date,
                         subtotal, tax_amount, total_amount, amount_paid, balance_due, status, created_by)
    VALUES ('INV-2024-003', wo_id, new_cust_id, CURRENT_DATE - 43, CURRENT_DATE - 43 + INTERVAL '60 days',
            5900.00, 368.75, 6268.75, 3000.00, 3268.75, 'partially_paid', admin_user);

    -- WO 1013: Pending - waiting for quote approval
    SELECT id INTO new_cust_id FROM customers WHERE customer_number = 'CUST-1013';
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, created_by, quoted_labor_hours, quoted_labor_rate, quoted_material_cost)
    VALUES ('WO-2024-1013', new_cust_id, '987 Oak Circle, Watertown MA',
            'Basement Electrical Rewiring and Code Update',
            'pending', 'low', admin_user,
            12.0, 85.00, 600.00);

    -- WO 1014: In Progress today - emergency call
    SELECT id INTO new_cust_id FROM customers WHERE customer_number = 'CUST-1014';
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, assigned_to, created_by, emergency_call)
    VALUES ('WO-2024-1014', new_cust_id, '246 Pine Drive, Belmont MA',
            'No Power - Main Panel Failure',
            'in_progress', 'emergency', CURRENT_DATE, emp2, admin_user, true)
    RETURNING id INTO wo_id;

    INSERT INTO time_entries (work_order_id, employee_username, work_date, hours_worked, week_ending_date, created_by)
    VALUES (wo_id, emp2, CURRENT_DATE, 3.5, CURRENT_DATE + 7, emp2);

    -- WO 1015: Completed yesterday
    SELECT id INTO new_cust_id FROM customers WHERE customer_number = 'CUST-1015';
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, assigned_to, created_by,
                            actual_labor_cost, actual_material_cost, subtotal, tax_amount, total_amount)
    VALUES ('WO-2024-1015', new_cust_id, '852 Main Street, Cambridge MA',
            'Commercial Kitchen Equipment Power Installation',
            'completed', 'high', CURRENT_DATE - 1, emp1, admin_user,
            680.00, 520.00, 1200.00, 75.00, 1275.00)
    RETURNING id INTO wo_id;

    INSERT INTO time_entries (work_order_id, employee_username, work_date, hours_worked, week_ending_date, created_by)
    VALUES (wo_id, emp1, CURRENT_DATE - 1, 8.0, CURRENT_DATE + 6, emp1);

    INSERT INTO invoices (invoice_number, work_order_id, customer_id, invoice_date, due_date,
                         subtotal, tax_amount, total_amount, amount_paid, balance_due, status, created_by)
    VALUES ('INV-2024-004', wo_id, new_cust_id, CURRENT_DATE, CURRENT_DATE + INTERVAL '15 days',
            1200.00, 75.00, 1275.00, 0.00, 1275.00, 'sent', admin_user);

    -- WO 1016: Scheduled for next week
    SELECT id INTO new_cust_id FROM customers WHERE customer_number = 'CUST-1006';
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, assigned_to, created_by)
    VALUES ('WO-2024-1016', new_cust_id, '789 Cedar Lane, Medford MA',
            'Install Ceiling Fan and Dimmer Switches',
            'scheduled', 'low', CURRENT_DATE + 7, emp1, admin_user);

    -- WO 1017: Completed 2 days ago with materials
    SELECT id INTO new_cust_id FROM customers WHERE customer_number = 'CUST-1007';
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, assigned_to, created_by,
                            actual_labor_cost, actual_material_cost, subtotal, tax_amount, total_amount)
    VALUES ('WO-2024-1017', new_cust_id, '456 Birch Road, Malden MA',
            'Install EV Charger - Tesla Wall Connector',
            'completed', 'normal', CURRENT_DATE - 2, emp3, admin_user,
            340.00, 750.00, 1090.00, 68.13, 1158.13)
    RETURNING id INTO wo_id;

    INSERT INTO time_entries (work_order_id, employee_username, work_date, hours_worked, week_ending_date, created_by)
    VALUES (wo_id, emp3, CURRENT_DATE - 2, 4.0, CURRENT_DATE + 5, emp3);

    IF array_length(inv_ids, 1) >= 10 THEN
        INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, quantity_allocated,
                                       quantity_loaded, quantity_used, quantity_returned,
                                       unit_cost, unit_price, line_cost, line_total)
        VALUES
        (wo_id, inv_ids[8], 1, 1, 1, 1, 0, 650.00, 975.00, 650.00, 975.00),
        (wo_id, inv_ids[9], 50, 50, 60, 48, 12, 2.00, 3.00, 96.00, 144.00);
    END IF;

    -- WO 1018: Scheduled for today
    SELECT id INTO new_cust_id FROM customers WHERE customer_number = 'CUST-1008';
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, assigned_to, created_by)
    VALUES ('WO-2024-1018', new_cust_id, '999 Innovation Drive, Cambridge MA',
            'Conference Room AV and Power Infrastructure',
            'scheduled', 'normal', CURRENT_DATE, emp4, admin_user);

    -- WO 1019: Completed last month with paid invoice
    SELECT id INTO new_cust_id FROM customers WHERE customer_number = 'CUST-1009';
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, assigned_to, created_by,
                            actual_labor_cost, actual_material_cost, subtotal, tax_amount, total_amount)
    VALUES ('WO-2024-1019', new_cust_id, '123 Willow Street, Arlington MA',
            'Attic Fan Installation with Timer',
            'completed', 'low', CURRENT_DATE - 35, emp2, admin_user,
            255.00, 180.00, 435.00, 27.19, 462.19)
    RETURNING id INTO wo_id;

    INSERT INTO time_entries (work_order_id, employee_username, work_date, hours_worked, week_ending_date, created_by)
    VALUES (wo_id, emp2, CURRENT_DATE - 35, 3.0, CURRENT_DATE - 28, emp2);

    INSERT INTO invoices (invoice_number, work_order_id, customer_id, invoice_date, due_date,
                         subtotal, tax_amount, total_amount, amount_paid, balance_due, status, created_by)
    VALUES ('INV-2024-005', wo_id, new_cust_id, CURRENT_DATE - 33, CURRENT_DATE - 33 + INTERVAL '30 days',
            435.00, 27.19, 462.19, 462.19, 0.00, 'paid', admin_user);

    -- WO 1020: In Progress - multi-day job
    SELECT id INTO new_cust_id FROM customers WHERE customer_number = 'CUST-1010';
    INSERT INTO work_orders (work_order_number, customer_id, service_address, job_description,
                            status, priority, scheduled_date, assigned_to, helper_1, created_by)
    VALUES ('WO-2024-1020', new_cust_id, '321 Shopping Plaza, Burlington MA',
            'Store Remodel - Complete Electrical Upgrade',
            'in_progress', 'high', CURRENT_DATE - 5, emp3, emp4, admin_user)
    RETURNING id INTO wo_id;

    INSERT INTO time_entries (work_order_id, employee_username, work_date, hours_worked, week_ending_date, created_by)
    VALUES
    (wo_id, emp3, CURRENT_DATE - 5, 8.0, CURRENT_DATE + 2, emp3),
    (wo_id, emp4, CURRENT_DATE - 5, 8.0, CURRENT_DATE + 2, emp4),
    (wo_id, emp3, CURRENT_DATE - 4, 8.0, CURRENT_DATE + 2, emp3),
    (wo_id, emp4, CURRENT_DATE - 4, 8.0, CURRENT_DATE + 2, emp4),
    (wo_id, emp3, CURRENT_DATE - 3, 7.0, CURRENT_DATE + 2, emp3);

    RAISE NOTICE 'Comprehensive mock data created successfully!';
    RAISE NOTICE 'Added 4 employees, 10 customers, 15 work orders with varied statuses';
    RAISE NOTICE 'Includes materials, invoices, and outstanding balances';

END $$;

-- ============================================================
-- SUMMARY REPORT
-- ============================================================

SELECT '=== COMPREHENSIVE DATA SUMMARY ===' AS report;
SELECT '';
SELECT '--- EMPLOYEES ---' AS section;
SELECT username, full_name, role, hourly_rate
FROM users
WHERE username IN ('tfisher', 'nraffery', 'jmartin', 'srodriguez', 'dchen', 'lthompson')
ORDER BY full_name;

SELECT '';
SELECT '--- WORK ORDERS BY STATUS ---' AS section;
SELECT status, COUNT(*) as count,
       TO_CHAR(SUM(total_amount), 'FM$999,999.00') as total_value
FROM work_orders
WHERE work_order_number LIKE 'WO-2024-%'
GROUP BY status
ORDER BY status;

SELECT '';
SELECT '--- INVOICES SUMMARY ---' AS section;
SELECT status, COUNT(*) as count,
       TO_CHAR(SUM(total_amount), 'FM$999,999.00') as total_invoiced,
       TO_CHAR(SUM(balance_due), 'FM$999,999.00') as total_outstanding
FROM invoices
GROUP BY status
ORDER BY status;

SELECT '';
SELECT '--- MATERIALS USAGE ---' AS section;
SELECT COUNT(DISTINCT work_order_id) as jobs_with_materials,
       SUM(quantity_used) as total_items_used,
       TO_CHAR(SUM(line_cost), 'FM$999,999.00') as total_material_cost
FROM job_materials_used;

SELECT '';
SELECT '--- EMPLOYEE HOURS (All Time) ---' AS section;
SELECT u.full_name,
       COUNT(te.id) as time_entries,
       TO_CHAR(SUM(te.hours_worked), 'FM999.0') || ' hrs' as total_hours,
       TO_CHAR(SUM(te.hours_worked) * u.hourly_rate, 'FM$999,999.00') as total_pay_cost
FROM users u
LEFT JOIN time_entries te ON u.username = te.employee_username
WHERE u.role IN ('technician', 'manager')
GROUP BY u.full_name, u.hourly_rate
ORDER BY SUM(te.hours_worked) DESC NULLS LAST;

SELECT '';
SELECT '=== DATA READY FOR TESTING ===' AS complete;
