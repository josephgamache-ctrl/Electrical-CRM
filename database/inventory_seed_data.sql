-- Comprehensive MA Electrical Inventory Seed Data
-- Products from Granite City Electric & Concord Electrical Supply
-- ~200+ items for residential electrical contracting

-- Clear existing seed data (keep schema)
DELETE FROM inventory WHERE id > 5;

-- ============================================================
-- CATEGORY 1: SERVICE ENTRANCE & MAIN DISTRIBUTION (20 items)
-- ============================================================

INSERT INTO inventory (item_id, brand, manufacturer_part_number, description, category, subcategory,
    voltage, amperage, num_poles, cost, sell_price, qty, min_stock, location,
    qty_per, ma_code_ref, nec_ref, ul_listed, commonly_used, primary_vendor_id, lead_time_days, active)
VALUES
-- Main Load Centers
('0100', 'Square D', 'QO142M200RB', '200A 42-Space Main Breaker Load Center - Outdoor', 'Service Entrance', 'Main Load Centers', '120/240V', '200A', NULL, 298.00, 450.00, 5, 3, 'A1', 'Each', 'MA 230.85', 'NEC 408', TRUE, TRUE, 1, 2, TRUE),
('0101', 'Square D', 'QO130M100RB', '100A 30-Space Main Breaker Load Center - Outdoor', 'Service Entrance', 'Main Load Centers', '120/240V', '100A', NULL, 198.00, 299.00, 3, 2, 'A1', 'Each', 'MA 230.85', 'NEC 408', TRUE, FALSE, 1, 2, TRUE),
('0102', 'Siemens', 'P4042B1200CU', '200A 40-Space Main Breaker Load Center - Indoor', 'Service Entrance', 'Main Load Centers', '120/240V', '200A', NULL, 285.00, 430.00, 4, 2, 'A1', 'Each', 'MA 230.85', 'NEC 408', TRUE, TRUE, 1, 2, TRUE),
('0103', 'Eaton', 'BR4040B200', '200A 40-Space Main Breaker Load Center - Indoor', 'Service Entrance', 'Main Load Centers', '120/240V', '200A', NULL, 275.00, 415.00, 3, 2, 'A1', 'Each', 'MA 230.85', 'NEC 408', TRUE, TRUE, 2, 2, TRUE),
('0104', 'Square D', 'QO3040M200RB', '200A 30-Space Main Breaker Load Center - Outdoor', 'Service Entrance', 'Main Load Centers', '120/240V', '200A', NULL, 265.00, 400.00, 4, 2, 'A1', 'Each', 'MA 230.85', 'NEC 408', TRUE, TRUE, 1, 2, TRUE),

-- Meter Sockets
('0105', 'Milbank', 'U2040-XL-PG-HB', '200A Meter Socket - Ringless - Overhead', 'Service Entrance', 'Meter Sockets', '120/240V', '200A', NULL, 125.00, 189.00, 6, 3, 'A2', 'Each', 'NEC 230.66', 'NEC 230.66', TRUE, TRUE, 1, 1, TRUE),
('0106', 'Milbank', 'U1690-XL-200', '200A Meter Socket - Ringless - Underground', 'Service Entrance', 'Meter Sockets', '120/240V', '200A', NULL, 135.00, 205.00, 4, 2, 'A2', 'Each', 'NEC 230.66', 'NEC 230.66', TRUE, TRUE, 1, 1, TRUE),
('0107', 'Eaton', 'MBK0200R', '200A Meter Socket Combo - Main Breaker', 'Service Entrance', 'Meter Sockets', '120/240V', '200A', NULL, 245.00, 370.00, 3, 2, 'A2', 'Each', 'NEC 230.66', 'NEC 230.66', TRUE, FALSE, 2, 2, TRUE),

-- Service Entrance Cable
('0108', 'Southwire', '13055501', 'SEU 2-2-4 AL Service Entrance Cable - 100A - Per Foot', 'Service Entrance', 'Service Cable', '600V', '100A', NULL, 2.85, 4.50, 500, 100, 'A3', 'Foot', 'NEC 338', 'NEC 338', TRUE, TRUE, 1, 1, TRUE),
('0109', 'Southwire', '13056301', 'SEU 2/0-2/0-2/0 AL Service Entrance Cable - 200A - Per Foot', 'Service Entrance', 'Service Cable', '600V', '200A', NULL, 6.50, 10.00, 300, 75, 'A3', 'Foot', 'NEC 338', 'NEC 338', TRUE, TRUE, 1, 1, TRUE),

-- Emergency Disconnects (MA Required!)
('0110', 'Square D', 'D222NRB', '60A Non-Fused Emergency Disconnect - Outdoor', 'Service Entrance', 'Emergency Disconnects', '240V', '60A', 2, 45.00, 68.00, 10, 5, 'A4', 'Each', 'MA 230.85', 'MA 230.85 MANDATORY', TRUE, TRUE, 1, 1, TRUE),
('0111', 'Eaton', 'DG222URB', '60A Non-Fused Emergency Disconnect - Outdoor', 'Service Entrance', 'Emergency Disconnects', '240V', '60A', 2, 48.00, 72.00, 8, 4, 'A4', 'Each', 'MA 230.85', 'MA 230.85 MANDATORY', TRUE, TRUE, 2, 1, TRUE),
('0112', 'Siemens', 'WN2060U', '60A Non-Fused Emergency Disconnect - Outdoor', 'Service Entrance', 'Emergency Disconnects', '240V', '60A', 2, 46.00, 70.00, 10, 5, 'A4', 'Each', 'MA 230.85', 'MA 230.85 MANDATORY', TRUE, TRUE, 1, 1, TRUE),

-- Whole House Surge Protection
('0113', 'Siemens', 'FS140', 'Type 1 Whole House Surge Protector - 140kA', 'Service Entrance', 'Surge Protection', '120/240V', NULL, NULL, 148.00, 225.00, 15, 8, 'A5', 'Each', 'MA 110.12(B)', 'NEC 280', TRUE, TRUE, 1, 1, TRUE),
('0114', 'Eaton', 'CHSPT2SURGE', 'Type 2 Whole House Surge Protector - Panel Mount', 'Service Entrance', 'Surge Protection', '120/240V', NULL, NULL, 85.00, 130.00, 12, 6, 'A5', 'Each', 'MA 110.12(B)', 'NEC 280', TRUE, TRUE, 2, 1, TRUE),

-- Subpanels
('0115', 'Square D', 'QO124L100RB', '100A 12-Space Subpanel - Indoor', 'Service Entrance', 'Subpanels', '120/240V', '100A', NULL, 95.00, 145.00, 6, 3, 'A6', 'Each', 'NEC 408.36', 'NEC 408.36', TRUE, TRUE, 1, 2, TRUE),
('0116', 'Siemens', 'P1224L1125CU', '125A 24-Space Subpanel - Indoor', 'Service Entrance', 'Subpanels', '120/240V', '125A', NULL, 125.00, 190.00, 4, 2, 'A6', 'Each', 'NEC 408.36', 'NEC 408.36', TRUE, TRUE, 1, 2, TRUE),
('0117', 'Eaton', 'BR1224L125', '125A 24-Space Subpanel - Indoor', 'Service Entrance', 'Subpanels', '120/240V', '125A', NULL, 120.00, 182.00, 5, 2, 'A6', 'Each', 'NEC 408.36', 'NEC 408.36', TRUE, TRUE, 2, 2, TRUE),

-- Grounding & Bonding
('0118', 'ILSCO', 'GBL-4', 'Ground Bar Lug - 4-14 AWG', 'Service Entrance', 'Grounding', NULL, NULL, NULL, 3.50, 6.00, 50, 20, 'A7', 'Each', 'NEC 250', 'NEC 250', TRUE, TRUE, 1, 1, TRUE),
('0119', 'Burndy', 'SERVIT', 'Ground Rod - 8ft x 5/8" Copper-Clad', 'Service Entrance', 'Grounding', NULL, NULL, NULL, 18.00, 28.00, 20, 10, 'A7', 'Each', 'NEC 250.52', 'NEC 250.52', TRUE, TRUE, 1, 1, TRUE);

-- ============================================================
-- CATEGORY 2: CIRCUIT BREAKERS - STANDARD (25 items)
-- ============================================================

INSERT INTO inventory (item_id, brand, manufacturer_part_number, description, category, subcategory,
    voltage, amperage, num_poles, cost, sell_price, qty, min_stock, location,
    qty_per, nec_ref, ul_listed, commonly_used, primary_vendor_id, lead_time_days, active)
VALUES
-- Square D QO Standard Breakers
('0200', 'Square D', 'QO115', '15A 1-Pole Standard Circuit Breaker', 'Circuit Breakers', 'Standard Breakers', '120V', '15A', 1, 6.50, 11.00, 75, 30, 'B1', 'Each', 'NEC 240', TRUE, TRUE, 1, 1, TRUE),
('0201', 'Square D', 'QO120', '20A 1-Pole Standard Circuit Breaker', 'Circuit Breakers', 'Standard Breakers', '120V', '20A', 1, 6.50, 11.00, 100, 40, 'B1', 'Each', 'NEC 240', TRUE, TRUE, 1, 1, TRUE),
('0202', 'Square D', 'QO130', '30A 1-Pole Standard Circuit Breaker', 'Circuit Breakers', 'Standard Breakers', '120V', '30A', 1, 7.50, 13.00, 40, 15, 'B1', 'Each', 'NEC 240', TRUE, TRUE, 1, 1, TRUE),
('0203', 'Square D', 'QO215', '15A 2-Pole Standard Circuit Breaker', 'Circuit Breakers', 'Standard Breakers', '240V', '15A', 2, 12.00, 19.00, 30, 12, 'B1', 'Each', 'NEC 240', TRUE, FALSE, 1, 1, TRUE),
('0204', 'Square D', 'QO220', '20A 2-Pole Standard Circuit Breaker', 'Circuit Breakers', 'Standard Breakers', '240V', '20A', 2, 12.00, 19.00, 50, 20, 'B1', 'Each', 'NEC 240', TRUE, TRUE, 1, 1, TRUE),
('0205', 'Square D', 'QO230', '30A 2-Pole Standard Circuit Breaker', 'Circuit Breakers', 'Standard Breakers', '240V', '30A', 2, 13.50, 21.00, 40, 15, 'B1', 'Each', 'NEC 240', TRUE, TRUE, 1, 1, TRUE),
('0206', 'Square D', 'QO240', '40A 2-Pole Standard Circuit Breaker', 'Circuit Breakers', 'Standard Breakers', '240V', '40A', 2, 14.50, 23.00, 25, 10, 'B1', 'Each', 'NEC 240', TRUE, TRUE, 1, 1, TRUE),
('0207', 'Square D', 'QO250', '50A 2-Pole Standard Circuit Breaker', 'Circuit Breakers', 'Standard Breakers', '240V', '50A', 2, 16.00, 25.00, 20, 8, 'B1', 'Each', 'NEC 240', TRUE, TRUE, 1, 1, TRUE),
('0208', 'Square D', 'QO260', '60A 2-Pole Standard Circuit Breaker', 'Circuit Breakers', 'Standard Breakers', '240V', '60A', 2, 18.00, 28.00, 15, 6, 'B1', 'Each', 'NEC 240', TRUE, FALSE, 1, 1, TRUE),

-- Siemens Standard Breakers
('0209', 'Siemens', 'Q115', '15A 1-Pole Standard Circuit Breaker', 'Circuit Breakers', 'Standard Breakers', '120V', '15A', 1, 5.50, 10.00, 60, 25, 'B2', 'Each', 'NEC 240', TRUE, TRUE, 1, 1, TRUE),
('0210', 'Siemens', 'Q120', '20A 1-Pole Standard Circuit Breaker', 'Circuit Breakers', 'Standard Breakers', '120V', '20A', 1, 5.50, 10.00, 80, 35, 'B2', 'Each', 'NEC 240', TRUE, TRUE, 1, 1, TRUE),
('0211', 'Siemens', 'Q215', '15A 2-Pole Standard Circuit Breaker', 'Circuit Breakers', 'Standard Breakers', '240V', '15A', 2, 10.50, 17.00, 25, 10, 'B2', 'Each', 'NEC 240', TRUE, FALSE, 1, 1, TRUE),
('0212', 'Siemens', 'Q220', '20A 2-Pole Standard Circuit Breaker', 'Circuit Breakers', 'Standard Breakers', '240V', '20A', 2, 10.50, 17.00, 45, 18, 'B2', 'Each', 'NEC 240', TRUE, TRUE, 1, 1, TRUE),
('0213', 'Siemens', 'Q230', '30A 2-Pole Standard Circuit Breaker', 'Circuit Breakers', 'Standard Breakers', '240V', '30A', 2, 12.00, 19.00, 35, 14, 'B2', 'Each', 'NEC 240', TRUE, TRUE, 1, 1, TRUE),
('0214', 'Siemens', 'Q250', '50A 2-Pole Standard Circuit Breaker', 'Circuit Breakers', 'Standard Breakers', '240V', '50A', 2, 14.50, 23.00, 18, 7, 'B2', 'Each', 'NEC 240', TRUE, TRUE, 1, 1, TRUE),

-- Eaton BR Standard Breakers
('0215', 'Eaton', 'BR115', '15A 1-Pole Standard Circuit Breaker', 'Circuit Breakers', 'Standard Breakers', '120V', '15A', 1, 4.75, 9.00, 70, 30, 'B3', 'Each', 'NEC 240', TRUE, TRUE, 2, 1, TRUE),
('0216', 'Eaton', 'BR120', '20A 1-Pole Standard Circuit Breaker', 'Circuit Breakers', 'Standard Breakers', '120V', '20A', 1, 4.75, 9.00, 90, 40, 'B3', 'Each', 'NEC 240', TRUE, TRUE, 2, 1, TRUE),
('0217', 'Eaton', 'BR130', '30A 1-Pole Standard Circuit Breaker', 'Circuit Breakers', 'Standard Breakers', '120V', '30A', 1, 6.25, 11.00, 35, 15, 'B3', 'Each', 'NEC 240', TRUE, TRUE, 2, 1, TRUE),
('0218', 'Eaton', 'BR215', '15A 2-Pole Standard Circuit Breaker', 'Circuit Breakers', 'Standard Breakers', '240V', '15A', 2, 9.50, 16.00, 28, 12, 'B3', 'Each', 'NEC 240', TRUE, FALSE, 2, 1, TRUE),
('0219', 'Eaton', 'BR220', '20A 2-Pole Standard Circuit Breaker', 'Circuit Breakers', 'Standard Breakers', '240V', '20A', 2, 9.50, 16.00, 48, 20, 'B3', 'Each', 'NEC 240', TRUE, TRUE, 2, 1, TRUE),
('0220', 'Eaton', 'BR230', '30A 2-Pole Standard Circuit Breaker', 'Circuit Breakers', 'Standard Breakers', '240V', '30A', 2, 11.00, 18.00, 38, 15, 'B3', 'Each', 'NEC 240', TRUE, TRUE, 2, 1, TRUE),
('0221', 'Eaton', 'BR240', '40A 2-Pole Standard Circuit Breaker', 'Circuit Breakers', 'Standard Breakers', '240V', '40A', 2, 12.50, 20.00, 22, 10, 'B3', 'Each', 'NEC 240', TRUE, TRUE, 2, 1, TRUE),
('0222', 'Eaton', 'BR250', '50A 2-Pole Standard Circuit Breaker', 'Circuit Breakers', 'Standard Breakers', '240V', '50A', 2, 14.00, 22.00, 19, 8, 'B3', 'Each', 'NEC 240', TRUE, TRUE, 2, 1, TRUE),

-- Eaton CH Standard Breakers
('0223', 'Eaton', 'CH115', '15A 1-Pole Standard Circuit Breaker', 'Circuit Breakers', 'Standard Breakers', '120V', '15A', 1, 6.00, 10.50, 50, 20, 'B4', 'Each', 'NEC 240', TRUE, FALSE, 2, 1, TRUE),
('0224', 'Eaton', 'CH120', '20A 1-Pole Standard Circuit Breaker', 'Circuit Breakers', 'Standard Breakers', '120V', '20A', 1, 6.00, 10.50, 65, 25, 'B4', 'Each', 'NEC 240', TRUE, FALSE, 2, 1, TRUE);

-- Continue with more items in next section...
-- This file will continue with AFCI, GFCI, Wire/Cable, Devices, etc.
-- Aiming for 200+ total items

COMMENT ON TABLE inventory IS 'Comprehensive seed data - Products from Granite City Electric and Concord Electrical Supply';
