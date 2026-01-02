-- ============================================================
-- TEST WORK ORDERS - MA ELECTRICAL INVENTORY
-- ============================================================
-- Sample data for testing work order functionality:
-- 1. New Home Full Wiring (3-bedroom, 2000 sq ft)
-- 2. Service Call (Panel upgrade from 100A to 200A)
-- ============================================================

-- ============================================================
-- CUSTOMERS
-- ============================================================

INSERT INTO customers (customer_number, first_name, last_name, customer_type,
    phone_primary, phone_secondary, email, preferred_contact,
    service_street, service_city, service_state, service_zip,
    service_notes, payment_terms, tax_exempt, active)
VALUES
-- Customer 1: New Home Construction
('CUST-0001', 'Michael', 'Thompson', 'residential',
    '617-555-0123', '617-555-0124', 'michael.thompson@email.com', 'email',
    '145 Maple Street', 'Quincy', 'MA', '02169',
    'New construction - builder is Davis Homes LLC. Access via lockbox code 1234.',
    'net_30', FALSE, TRUE),

-- Customer 2: Panel Upgrade Service Call
('CUST-0002', 'Sarah', 'Martinez', 'residential',
    '781-555-0456', NULL, 'sarah.m@email.com', 'phone',
    '67 Oak Avenue', 'Braintree', 'MA', '02184',
    'Two dogs in backyard - call before entering. Panel in basement.',
    'due_on_receipt', FALSE, TRUE);


-- ============================================================
-- WORK ORDER 1: NEW HOME FULL WIRING
-- 3-bedroom, 2-bath, 2000 sq ft new construction
-- ============================================================

INSERT INTO work_orders (work_order_number, customer_id, service_address,
    job_type, job_description, scope_of_work,
    emergency_call, maintenance_visit, warranty_work,
    scheduled_date, scheduled_start_time, estimated_duration_hours,
    assigned_to,
    quoted_labor_hours, quoted_labor_rate, quoted_labor_cost,
    quoted_material_cost, quoted_subtotal,
    status, priority,
    permit_required, permit_number, inspection_required,
    created_by, created_at)
VALUES
('WO-2024-0001',
    (SELECT id FROM customers WHERE customer_number = 'CUST-0001'),
    '145 Maple Street, Quincy, MA 02169',
    'New Construction',
    'Complete electrical wiring for new 3-bedroom home',
    E'SCOPE OF WORK - NEW HOME ELECTRICAL:\n\n' ||
    E'SERVICE ENTRANCE:\n' ||
    E'- Install 200A main service panel (42-space)\n' ||
    E'- Service mast and weatherhead\n' ||
    E'- Ground rod installation (2 rods, 6 AWG copper)\n' ||
    E'- Whole-house surge protection\n\n' ||
    E'ROUGH-IN WIRING:\n' ||
    E'- All bedroom circuits (6 circuits, 15A AFCI)\n' ||
    E'- Kitchen circuits (2x 20A small appliance, 1x 20A refrigerator)\n' ||
    E'- Bathroom circuits (2x 20A GFCI)\n' ||
    E'- Laundry circuit (1x 20A)\n' ||
    E'- Living/dining circuits (3x 15A)\n' ||
    E'- Exterior GFCI outlets (3 locations)\n' ||
    E'- Garage circuits (2x 20A, 1 GFCI)\n\n' ||
    E'SPECIAL CIRCUITS:\n' ||
    E'- Range: 50A 240V (NEMA 14-50)\n' ||
    E'- Dryer: 30A 240V (NEMA 14-30)\n' ||
    E'- HVAC: 40A 240V disconnect\n' ||
    E'- Hot water heater: 30A 240V\n\n' ||
    E'LIGHTING:\n' ||
    E'- LED recessed cans (24 total)\n' ||
    E'- Switches (3-way for stairs/hallways)\n' ||
    E'- Exterior flood lights (4 locations)\n\n' ||
    E'SAFETY:\n' ||
    E'- Smoke detectors (hardwired, interconnected, 8 units)\n' ||
    E'- CO detectors (3 units)\n' ||
    E'- Doorbell transformer and wiring\n\n' ||
    E'NOTES:\n' ||
    E'- All work per NEC 2020\n' ||
    E'- Rough inspection required before drywall\n' ||
    E'- Final inspection required for CO',
    FALSE, FALSE, FALSE,
    '2024-12-02', '07:00:00', 120.00,  -- 120 hours (3 weeks)
    'joseph',
    120.00, 95.00, 11400.00,  -- Labor: 120 hrs @ $95/hr
    8500.00, 19900.00,  -- Materials + Labor
    'scheduled', 'normal',
    TRUE, 'EP-2024-1145', TRUE,
    'joseph', NOW());


-- ============================================================
-- WORK ORDER 2: SERVICE CALL - PANEL UPGRADE
-- 100A to 200A panel replacement
-- ============================================================

INSERT INTO work_orders (work_order_number, customer_id, service_address,
    job_type, job_description, scope_of_work,
    emergency_call, maintenance_visit, warranty_work,
    scheduled_date, scheduled_start_time, estimated_duration_hours,
    assigned_to,
    quoted_labor_hours, quoted_labor_rate, quoted_labor_cost,
    quoted_material_cost, quoted_subtotal,
    status, priority,
    permit_required, permit_number, inspection_required,
    created_by, created_at)
VALUES
('WO-2024-0002',
    (SELECT id FROM customers WHERE customer_number = 'CUST-0002'),
    '67 Oak Avenue, Braintree, MA 02184',
    'Panel Upgrade',
    'Upgrade electrical panel from 100A to 200A',
    E'SCOPE OF WORK - PANEL UPGRADE:\n\n' ||
    E'REMOVAL:\n' ||
    E'- Remove existing 100A panel (20-space)\n' ||
    E'- Label and document all existing circuits\n' ||
    E'- Coordinate power shutdown with utility company\n\n' ||
    E'INSTALLATION:\n' ||
    E'- Install new 200A main breaker panel (42-space Square D QO)\n' ||
    E'- New 200A rated meter base\n' ||
    E'- Upgrade service entrance cable (4/0 aluminum)\n' ||
    E'- Install whole-house surge protector\n' ||
    E'- New grounding system (upgrade to current code)\n\n' ||
    E'CIRCUIT UPGRADES:\n' ||
    E'- Replace standard breakers with AFCI where required\n' ||
    E'- Add GFCI breakers for bathrooms and kitchen\n' ||
    E'- Reorganize and balance circuits\n' ||
    E'- Add capacity for future EV charger (60A 240V space)\n\n' ||
    E'CLEANUP:\n' ||
    E'- Remove old panel and wire\n' ||
    E'- Patch drywall around new panel\n' ||
    E'- Updated circuit directory label\n\n' ||
    E'NOTES:\n' ||
    E'- Utility company notified (shutoff scheduled)\n' ||
    E'- Inspection required\n' ||
    E'- 4-6 hour power outage expected',
    FALSE, FALSE, FALSE,
    '2024-12-05', '08:00:00', 8.00,  -- 8 hours (1 day)
    'joseph',
    8.00, 125.00, 1000.00,  -- Labor: 8 hrs @ $125/hr (service call rate)
    1800.00, 2800.00,  -- Materials + Labor
    'scheduled', 'high',
    TRUE, 'EP-2024-1189', TRUE,
    'joseph', NOW());


-- ============================================================
-- JOB MATERIALS - WO-2024-0001 (NEW HOME WIRING)
-- ============================================================

INSERT INTO job_materials_used (work_order_id, inventory_id,
    quantity_needed, quantity_allocated,
    unit_cost, unit_price,
    stock_status, status, notes)
VALUES
-- SERVICE ENTRANCE
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0001'), 1, 0,
 298.00, 450.00, 'checking', 'planned', '200A 42-space main panel'),

((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0002'), 1, 0,
 185.00, 280.00, 'checking', 'planned', 'Whole-house surge protector'),

-- CIRCUIT BREAKERS - AFCI for bedrooms (6 breakers)
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0300'), 4, 0,
 38.00, 58.00, 'checking', 'planned', 'Bedroom circuits 15A AFCI'),

((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0301'), 2, 0,
 38.00, 58.00, 'checking', 'planned', 'Living area 20A AFCI'),

-- GFCI BREAKERS - Bathrooms, Kitchen, Exterior
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0304'), 6, 0,
 45.00, 68.00, 'checking', 'planned', 'Bathroom, kitchen, exterior GFCI'),

-- DUAL FUNCTION AFCI/GFCI - Kitchen countertop circuits
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0308'), 2, 0,
 68.00, 105.00, 'checking', 'planned', 'Kitchen small appliance circuits'),

-- STANDARD BREAKERS
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0200'), 5, 0,
 6.50, 11.00, 'checking', 'planned', 'Misc 15A circuits'),

((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0201'), 5, 0,
 7.50, 13.00, 'checking', 'planned', 'Misc 20A circuits'),

-- LARGE APPLIANCE BREAKERS
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0211'), 1, 0,
 19.00, 29.00, 'checking', 'planned', '50A Range circuit'),

((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0209'), 1, 0,
 15.00, 23.00, 'checking', 'planned', '30A Dryer circuit'),

((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0210'), 1, 0,
 15.00, 23.00, 'checking', 'planned', '30A Water heater'),

((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0212'), 1, 0,
 22.00, 33.00, 'checking', 'planned', '40A HVAC'),

-- WIRE & CABLE - NM-B ROMEX
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0400'), 12, 0,
 85.00, 130.00, 'checking', 'planned', '14/2 Romex - lighting circuits (3000 ft)'),

((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0401'), 15, 0,
 125.00, 190.00, 'checking', 'planned', '12/2 Romex - 20A circuits (3750 ft)'),

((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0403'), 8, 0,
 115.00, 175.00, 'checking', 'planned', '14/3 Romex - 3-way switches (2000 ft)'),

((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0404'), 6, 0,
 175.00, 265.00, 'checking', 'planned', '12/3 Romex - kitchen/bath (1500 ft)'),

((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0402'), 2, 0,
 215.00, 325.00, 'checking', 'planned', '10/2 Romex - dryer (500 ft)'),

((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0405'), 2, 0,
 295.00, 445.00, 'checking', 'planned', '10/3 Romex - range (500 ft)'),

-- GROUND WIRE
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0432'), 2, 0,
 118.00, 180.00, 'checking', 'planned', '10 AWG bare copper ground (630 ft)'),

((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0433'), 1, 0,
 245.00, 370.00, 'checking', 'planned', '6 AWG service ground (315 ft)'),

-- DEVICES - OUTLETS (Standard white)
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0450'), 45, 0,
 0.85, 1.50, 'checking', 'planned', '15A duplex outlets'),

((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0451'), 20, 0,
 1.25, 2.25, 'checking', 'planned', '20A duplex outlets'),

-- DEVICES - GFCI OUTLETS
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0460'), 6, 0,
 14.50, 22.00, 'checking', 'planned', '15A GFCI outlets - bathrooms'),

((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0461'), 4, 0,
 16.50, 25.00, 'checking', 'planned', '20A GFCI outlets - kitchen/garage'),

-- DEVICES - WEATHERPROOF GFCI
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0466'), 3, 0,
 28.00, 42.00, 'checking', 'planned', 'Exterior GFCI outlets'),

-- SPECIALTY OUTLETS
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0472'), 1, 0,
 8.50, 13.00, 'checking', 'planned', 'Dryer receptacle 30A'),

((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0473'), 1, 0,
 12.50, 19.00, 'checking', 'planned', 'Range receptacle 50A'),

-- SWITCHES - Standard
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0500'), 35, 0,
 0.95, 1.60, 'checking', 'planned', '15A single-pole switches'),

((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0504'), 8, 0,
 1.85, 3.25, 'checking', 'planned', '15A 3-way switches'),

((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0508'), 2, 0,
 3.25, 5.50, 'checking', 'planned', '15A 4-way switches'),

-- DIMMERS
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0511'), 6, 0,
 12.50, 19.00, 'checking', 'planned', 'LED dimmers'),

-- BOXES - New Work
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0555'), 50, 0,
 0.85, 1.50, 'checking', 'planned', 'Single gang new work boxes'),

((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0557'), 20, 0,
 1.35, 2.40, 'checking', 'planned', 'Double gang new work boxes'),

((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0559'), 10, 0,
 1.85, 3.25, 'checking', 'planned', 'Triple gang new work boxes'),

-- BOXES - Ceiling
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0570'), 30, 0,
 1.95, 3.50, 'checking', 'planned', 'Round ceiling boxes'),

-- BOXES - Weatherproof
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0575'), 4, 0,
 8.50, 13.00, 'checking', 'planned', 'Weatherproof boxes - exterior'),

-- LIGHTING - LED Recessed
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0650'), 24, 0,
 18.50, 28.00, 'checking', 'planned', '4" LED recessed lights'),

-- LIGHTING - LED Flood
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0659'), 4, 0,
 28.00, 42.00, 'checking', 'planned', 'LED flood lights - exterior'),

-- SMOKE DETECTORS
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0750'), 8, 0,
 22.00, 33.00, 'checking', 'planned', 'Hardwired smoke detectors'),

-- CO DETECTORS
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0754'), 3, 0,
 32.00, 48.00, 'checking', 'planned', 'Hardwired CO detectors'),

-- DOORBELL
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0756'), 1, 0,
 18.50, 28.00, 'checking', 'planned', 'Doorbell transformer'),

-- WIRE CONNECTORS
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0700'), 5, 0,
 3.25, 5.50, 'checking', 'planned', 'Red wire nuts (500 pcs)'),

((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0701'), 3, 0,
 3.50, 6.00, 'checking', 'planned', 'Yellow wire nuts (300 pcs)'),

((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0703'), 5, 0,
 15.50, 24.00, 'checking', 'planned', 'Wago 221 connectors (50 pk)'),

-- TAPE & ACCESSORIES
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0715'), 10, 0,
 2.85, 4.50, 'checking', 'planned', 'Electrical tape'),

((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0001'),
 (SELECT id FROM inventory WHERE item_id = '0709'), 5, 0,
 12.50, 19.00, 'checking', 'planned', 'Cable staples (1000 pk)');


-- ============================================================
-- JOB MATERIALS - WO-2024-0002 (PANEL UPGRADE SERVICE CALL)
-- ============================================================

INSERT INTO job_materials_used (work_order_id, inventory_id,
    quantity_needed, quantity_allocated,
    unit_cost, unit_price,
    stock_status, status, notes)
VALUES
-- MAIN PANEL
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0002'),
 (SELECT id FROM inventory WHERE item_id = '0001'), 1, 0,
 298.00, 450.00, 'checking', 'planned', '200A 42-space main panel'),

-- SURGE PROTECTOR
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0002'),
 (SELECT id FROM inventory WHERE item_id = '0002'), 1, 0,
 185.00, 280.00, 'checking', 'planned', 'Whole-house surge protector'),

-- AFCI BREAKERS - Bedroom circuits
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0002'),
 (SELECT id FROM inventory WHERE item_id = '0300'), 3, 0,
 38.00, 58.00, 'checking', 'planned', 'Bedroom AFCI 15A'),

((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0002'),
 (SELECT id FROM inventory WHERE item_id = '0301'), 1, 0,
 38.00, 58.00, 'checking', 'planned', 'Living room AFCI 20A'),

-- GFCI BREAKERS
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0002'),
 (SELECT id FROM inventory WHERE item_id = '0304'), 3, 0,
 45.00, 68.00, 'checking', 'planned', 'Bath/kitchen GFCI'),

-- DUAL FUNCTION
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0002'),
 (SELECT id FROM inventory WHERE item_id = '0308'), 2, 0,
 68.00, 105.00, 'checking', 'planned', 'Kitchen countertop AFCI/GFCI'),

-- STANDARD BREAKERS
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0002'),
 (SELECT id FROM inventory WHERE item_id = '0200'), 4, 0,
 6.50, 11.00, 'checking', 'planned', 'Standard 15A'),

((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0002'),
 (SELECT id FROM inventory WHERE item_id = '0201'), 3, 0,
 7.50, 13.00, 'checking', 'planned', 'Standard 20A'),

-- WIRE FOR SERVICE UPGRADE (short runs to reconnect)
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0002'),
 (SELECT id FROM inventory WHERE item_id = '0401'), 2, 0,
 125.00, 190.00, 'checking', 'planned', '12/2 Romex for circuit extensions'),

((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0002'),
 (SELECT id FROM inventory WHERE item_id = '0400'), 1, 0,
 85.00, 130.00, 'checking', 'planned', '14/2 Romex for circuit extensions'),

-- GROUND WIRE
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0002'),
 (SELECT id FROM inventory WHERE item_id = '0433'), 1, 0,
 245.00, 370.00, 'checking', 'planned', '6 AWG ground wire upgrade'),

-- CONNECTORS & ACCESSORIES
((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0002'),
 (SELECT id FROM inventory WHERE item_id = '0703'), 2, 0,
 15.50, 24.00, 'checking', 'planned', 'Wago connectors'),

((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0002'),
 (SELECT id FROM inventory WHERE item_id = '0715'), 2, 0,
 2.85, 4.50, 'checking', 'planned', 'Electrical tape'),

((SELECT id FROM work_orders WHERE work_order_number = 'WO-2024-0002'),
 (SELECT id FROM inventory WHERE item_id = '0719'), 1, 0,
 8.50, 13.00, 'checking', 'planned', 'Circuit labels');


-- ============================================================
-- SUMMARY QUERIES (for verification)
-- ============================================================

-- View Work Order Summary
SELECT
    wo.work_order_number,
    wo.job_type,
    c.first_name || ' ' || c.last_name as customer,
    wo.scheduled_date,
    wo.quoted_labor_cost,
    wo.quoted_material_cost,
    wo.quoted_subtotal,
    COUNT(jm.id) as material_line_items,
    wo.status
FROM work_orders wo
JOIN customers c ON wo.customer_id = c.id
LEFT JOIN job_materials_used jm ON wo.id = jm.work_order_id
GROUP BY wo.id, c.id
ORDER BY wo.work_order_number;

-- View Material Summary by Work Order
SELECT
    wo.work_order_number,
    i.item_id,
    i.brand,
    i.description,
    i.category,
    jm.quantity_needed,
    jm.quantity_allocated,
    i.qty as warehouse_qty,
    i.qty_available as available_qty,
    jm.unit_price,
    (jm.quantity_needed * jm.unit_price) as line_total,
    jm.stock_status,
    jm.status
FROM job_materials_used jm
JOIN work_orders wo ON jm.work_order_id = wo.id
JOIN inventory i ON jm.inventory_id = i.id
ORDER BY wo.work_order_number, i.category, i.item_id;

COMMENT ON TABLE work_orders IS 'Test work orders created for MA Electrical Inventory testing';
COMMENT ON TABLE job_materials_used IS 'Material allocations for test work orders';
