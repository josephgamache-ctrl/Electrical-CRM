-- Create 10 Work Orders: 5 completed (past month), 5 scheduled (next month)

-- COMPLETED WORK ORDERS (past month)

-- Job 1: Panel Upgrade - Completed 3 weeks ago
INSERT INTO work_orders (
    work_order_number, customer_id, service_address, job_type, job_description,
    scope_of_work, scheduled_date, scheduled_start_time, estimated_duration_hours,
    assigned_to, status, priority, actual_start_time, actual_end_time, actual_hours,
    completed_at, completed_by, created_by
) VALUES (
    'WO-2024-1020', 1, '123 Main Street, Quincy, MA 02169', 'Panel Upgrade',
    '200A Panel Upgrade - Replace old Federal Pacific panel with new Square D',
    E'1. Remove old Federal Pacific panel\n2. Install new 200A Square D panel\n3. Transfer all circuits\n4. Install whole house surge protector\n5. Update grounding system',
    '2024-11-25', '08:00', 8.00,
    'nraffery', 'completed', 'high',
    '2024-11-25 08:15:00', '2024-11-25 16:30:00', 8.25,
    '2024-11-25 16:30:00', 'nraffery', 'joseph'
);

-- Job 2: Kitchen Remodel Electrical - Completed 2.5 weeks ago
INSERT INTO work_orders (
    work_order_number, customer_id, service_address, job_type, job_description,
    scope_of_work, scheduled_date, scheduled_start_time, estimated_duration_hours,
    assigned_to, helper_1, status, priority, actual_start_time, actual_end_time, actual_hours,
    completed_at, completed_by, created_by
) VALUES (
    'WO-2024-1021', 18, '456 Oak Avenue, Weymouth, MA 02188', 'Remodel',
    'Kitchen Remodel - New circuits for appliances, under cabinet lighting',
    E'1. Install dedicated 20A circuit for dishwasher\n2. Install 50A circuit for electric range\n3. Add 6 GFCI outlets on counter\n4. Install under cabinet LED lighting\n5. Update to AFCI breakers',
    '2024-11-27', '07:30', 10.00,
    'nraffery', 'tfisher', 'completed', 'normal',
    '2024-11-27 07:45:00', '2024-11-27 17:00:00', 9.25,
    '2024-11-27 17:00:00', 'nraffery', 'joseph'
);

-- Job 3: Commercial Lighting Retrofit - Completed 2 weeks ago
INSERT INTO work_orders (
    work_order_number, customer_id, service_address, job_type, job_description,
    scope_of_work, scheduled_date, scheduled_start_time, estimated_duration_hours,
    assigned_to, helper_1, status, priority, actual_start_time, actual_end_time, actual_hours,
    completed_at, completed_by, created_by
) VALUES (
    'WO-2024-1022', 21, '789 Industrial Way, Braintree, MA 02184', 'Commercial',
    'LED Lighting Retrofit - Replace fluorescent fixtures with LED',
    E'1. Remove 24 fluorescent fixtures\n2. Install 24 LED panel lights\n3. Install occupancy sensors\n4. Update lighting controls\n5. Dispose of old fixtures properly',
    '2024-12-02', '06:00', 12.00,
    'tfisher', 'nraffery', 'completed', 'normal',
    '2024-12-02 06:15:00', '2024-12-02 17:30:00', 11.25,
    '2024-12-02 17:30:00', 'tfisher', 'joseph'
);

-- Job 4: EV Charger Installation - Completed 1.5 weeks ago
INSERT INTO work_orders (
    work_order_number, customer_id, service_address, job_type, job_description,
    scope_of_work, scheduled_date, scheduled_start_time, estimated_duration_hours,
    assigned_to, status, priority, actual_start_time, actual_end_time, actual_hours,
    completed_at, completed_by, created_by
) VALUES (
    'WO-2024-1023', 22, '321 Maple Drive, Milton, MA 02186', 'EV Charger',
    'Tesla Wall Connector Installation - 60A circuit from panel to garage',
    E'1. Run 60A circuit from panel to garage\n2. Install 6/3 wire in conduit\n3. Mount Tesla Wall Connector\n4. Connect and test charger\n5. Program charging schedule',
    '2024-12-05', '09:00', 5.00,
    'nraffery', 'completed', 'normal',
    '2024-12-05 09:00:00', '2024-12-05 14:15:00', 5.25,
    '2024-12-05 14:15:00', 'nraffery', 'joseph'
);

-- Job 5: Bathroom Remodel - Completed 1 week ago
INSERT INTO work_orders (
    work_order_number, customer_id, service_address, job_type, job_description,
    scope_of_work, scheduled_date, scheduled_start_time, estimated_duration_hours,
    assigned_to, status, priority, actual_start_time, actual_end_time, actual_hours,
    completed_at, completed_by, created_by
) VALUES (
    'WO-2024-1024', 23, '555 Pine Street, Randolph, MA 02368', 'Remodel',
    'Master Bathroom Remodel - Exhaust fan, lighting, GFCI outlets',
    E'1. Install new exhaust fan with humidity sensor\n2. Replace vanity lighting\n3. Install recessed shower light\n4. Add GFCI outlets\n5. Install heated floor thermostat',
    '2024-12-09', '08:00', 6.00,
    'tfisher', 'completed', 'normal',
    '2024-12-09 08:00:00', '2024-12-09 14:30:00', 6.50,
    '2024-12-09 14:30:00', 'tfisher', 'joseph'
);

-- SCHEDULED WORK ORDERS (next month)

-- Job 6: New Construction Rough-In - Scheduled next week
INSERT INTO work_orders (
    work_order_number, customer_id, service_address, job_type, job_description,
    scope_of_work, scheduled_date, scheduled_start_time, estimated_duration_hours,
    assigned_to, helper_1, status, priority, created_by
) VALUES (
    'WO-2024-1025', 25, '100 New Development Rd, Canton, MA 02021', 'New Construction',
    'Rough-In Electrical - New single family home',
    E'1. Install 200A service entrance\n2. Run circuits per plan\n3. Install boxes for outlets and switches\n4. Run low voltage for data and TV\n5. Coordinate with inspector',
    '2024-12-23', '07:00', 16.00,
    'nraffery', 'tfisher', 'scheduled', 'high', 'joseph'
);

-- Job 7: Office Buildout - Scheduled next week
INSERT INTO work_orders (
    work_order_number, customer_id, service_address, job_type, job_description,
    scope_of_work, scheduled_date, scheduled_start_time, estimated_duration_hours,
    assigned_to, status, priority, created_by
) VALUES (
    'WO-2024-1026', 19, '200 Commerce Drive Suite 300, Quincy, MA 02169', 'Commercial',
    'Office Buildout - New tenant space electrical',
    E'1. Install sub-panel for tenant space\n2. Run circuits for workstations\n3. Install data drops at each desk\n4. Add emergency lighting\n5. Install exit signs',
    '2024-12-26', '06:00', 10.00,
    'tfisher', 'scheduled', 'normal', 'joseph'
);

-- Job 8: Generator Installation - Scheduled early January
INSERT INTO work_orders (
    work_order_number, customer_id, service_address, job_type, job_description,
    scope_of_work, scheduled_date, scheduled_start_time, estimated_duration_hours,
    assigned_to, helper_1, status, priority, created_by
) VALUES (
    'WO-2024-1027', 20, '777 Beach Road, Hull, MA 02045', 'Generator',
    'Generac 22kW Whole House Generator Installation',
    E'1. Pour concrete pad\n2. Install gas line connection point\n3. Install transfer switch\n4. Mount generator on pad\n5. Connect and test all circuits\n6. Program and commission',
    '2025-01-06', '08:00', 12.00,
    'nraffery', 'tfisher', 'scheduled', 'high', 'joseph'
);

-- Job 9: Apartment Complex Service Call - Scheduled January
INSERT INTO work_orders (
    work_order_number, customer_id, service_address, job_type, job_description,
    scope_of_work, scheduled_date, scheduled_start_time, estimated_duration_hours,
    assigned_to, status, priority, created_by
) VALUES (
    'WO-2024-1028', 24, '400 Valley View Apartments, Brockton, MA 02301', 'Service',
    'Multiple Unit Service Calls - Various electrical issues',
    E'1. Unit 101 - Replace faulty breaker\n2. Unit 205 - Fix flickering lights\n3. Unit 312 - GFCI not working\n4. Common area - Replace parking lot light\n5. Laundry room - Dryer outlet repair',
    '2025-01-08', '08:00', 8.00,
    'tfisher', 'scheduled', 'normal', 'joseph'
);

-- Job 10: Smart Home Installation - Scheduled mid-January
INSERT INTO work_orders (
    work_order_number, customer_id, service_address, job_type, job_description,
    scope_of_work, scheduled_date, scheduled_start_time, estimated_duration_hours,
    assigned_to, status, priority, created_by
) VALUES (
    'WO-2024-1029', 18, '456 Oak Avenue, Weymouth, MA 02188', 'Smart Home',
    'Smart Home Package - Switches, dimmers, and automation',
    E'1. Replace 12 switches with smart switches\n2. Install smart dimmers in living areas\n3. Set up hub and configure\n4. Install smart doorbell\n5. Program scenes and schedules',
    '2025-01-13', '09:00', 6.00,
    'nraffery', 'scheduled', 'low', 'joseph'
);
