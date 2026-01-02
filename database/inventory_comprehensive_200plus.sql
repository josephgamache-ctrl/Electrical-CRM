-- ============================================================
-- COMPREHENSIVE MA ELECTRICAL INVENTORY - 200+ ITEMS
-- Products from Granite City Electric & Concord Electrical Supply
-- ============================================================
-- This file adds to the existing inventory_seed_data.sql
-- Item IDs: 0300-0799 (200+ new items)
-- Categories: AFCI/GFCI Breakers, Wire & Cable, Devices (Outlets/Switches),
--             Boxes & Covers, Conduit & Fittings, Lighting, Accessories, Specialty
-- ============================================================

-- ============================================================
-- CATEGORY 3: CIRCUIT BREAKERS - AFCI/GFCI (25 items)
-- ============================================================

INSERT INTO inventory (item_id, brand, manufacturer_part_number, description, category, subcategory,
    voltage, amperage, num_poles, cost, sell_price, qty, min_stock, location,
    qty_per, nec_ref, ul_listed, commonly_used, primary_vendor_id, lead_time_days, active)
VALUES
-- Square D QO AFCI Breakers
('0300', 'Square D', 'QO115CAFIC', '15A 1-Pole Combination AFCI Circuit Breaker', 'Circuit Breakers', 'AFCI Breakers', '120V', '15A', 1, 38.00, 58.00, 50, 20, 'B5', 'Each', 'NEC 210.12', TRUE, TRUE, 1, 1, TRUE),
('0301', 'Square D', 'QO120CAFIC', '20A 1-Pole Combination AFCI Circuit Breaker', 'Circuit Breakers', 'AFCI Breakers', '120V', '20A', 1, 38.00, 58.00, 60, 25, 'B5', 'Each', 'NEC 210.12', TRUE, TRUE, 1, 1, TRUE),
('0302', 'Square D', 'QO215CAFIC', '15A 2-Pole Combination AFCI Circuit Breaker', 'Circuit Breakers', 'AFCI Breakers', '240V', '15A', 2, 52.00, 79.00, 25, 10, 'B5', 'Each', 'NEC 210.12', TRUE, FALSE, 1, 1, TRUE),
('0303', 'Square D', 'QO220CAFIC', '20A 2-Pole Combination AFCI Circuit Breaker', 'Circuit Breakers', 'AFCI Breakers', '240V', '20A', 2, 52.00, 79.00, 30, 12, 'B5', 'Each', 'NEC 210.12', TRUE, TRUE, 1, 1, TRUE),

-- Square D QO GFCI Breakers
('0304', 'Square D', 'QO120GFIC', '20A 1-Pole GFCI Circuit Breaker', 'Circuit Breakers', 'GFCI Breakers', '120V', '20A', 1, 45.00, 68.00, 40, 15, 'B6', 'Each', 'NEC 210.8', TRUE, TRUE, 1, 1, TRUE),
('0305', 'Square D', 'QO115GFIC', '15A 1-Pole GFCI Circuit Breaker', 'Circuit Breakers', 'GFCI Breakers', '120V', '15A', 1, 45.00, 68.00, 30, 12, 'B6', 'Each', 'NEC 210.8', TRUE, TRUE, 1, 1, TRUE),
('0306', 'Square D', 'QO220GFIC', '20A 2-Pole GFCI Circuit Breaker', 'Circuit Breakers', 'GFCI Breakers', '240V', '20A', 2, 65.00, 98.00, 25, 10, 'B6', 'Each', 'NEC 210.8', TRUE, TRUE, 1, 1, TRUE),
('0307', 'Square D', 'QO230GFIC', '30A 2-Pole GFCI Circuit Breaker', 'Circuit Breakers', 'GFCI Breakers', '240V', '30A', 2, 75.00, 115.00, 20, 8, 'B6', 'Each', 'NEC 210.8', TRUE, TRUE, 1, 1, TRUE),

-- Square D QO Dual Function (AFCI+GFCI)
('0308', 'Square D', 'QO120DFIC', '20A 1-Pole Dual Function AFCI/GFCI Breaker', 'Circuit Breakers', 'AFCI/GFCI Dual', '120V', '20A', 1, 68.00, 105.00, 35, 15, 'B7', 'Each', 'NEC 210.12', TRUE, TRUE, 1, 1, TRUE),
('0309', 'Square D', 'QO115DFIC', '15A 1-Pole Dual Function AFCI/GFCI Breaker', 'Circuit Breakers', 'AFCI/GFCI Dual', '120V', '15A', 1, 68.00, 105.00, 30, 12, 'B7', 'Each', 'NEC 210.12', TRUE, TRUE, 1, 1, TRUE),

-- Siemens AFCI Breakers
('0310', 'Siemens', 'Q115AFC', '15A 1-Pole Combination AFCI Circuit Breaker', 'Circuit Breakers', 'AFCI Breakers', '120V', '15A', 1, 36.00, 55.00, 45, 18, 'B5', 'Each', 'NEC 210.12', TRUE, TRUE, 1, 1, TRUE),
('0311', 'Siemens', 'Q120AFC', '20A 1-Pole Combination AFCI Circuit Breaker', 'Circuit Breakers', 'AFCI Breakers', '120V', '20A', 1, 36.00, 55.00, 55, 22, 'B5', 'Each', 'NEC 210.12', TRUE, TRUE, 1, 1, TRUE),
('0312', 'Siemens', 'Q220AFC', '20A 2-Pole Combination AFCI Circuit Breaker', 'Circuit Breakers', 'AFCI Breakers', '240V', '20A', 2, 50.00, 76.00, 28, 11, 'B5', 'Each', 'NEC 210.12', TRUE, TRUE, 1, 1, TRUE),

-- Siemens GFCI Breakers
('0313', 'Siemens', 'Q120GFI', '20A 1-Pole GFCI Circuit Breaker', 'Circuit Breakers', 'GFCI Breakers', '120V', '20A', 1, 43.00, 65.00, 38, 14, 'B6', 'Each', 'NEC 210.8', TRUE, TRUE, 1, 1, TRUE),
('0314', 'Siemens', 'Q220GFI', '20A 2-Pole GFCI Circuit Breaker', 'Circuit Breakers', 'GFCI Breakers', '240V', '20A', 2, 63.00, 95.00, 23, 9, 'B6', 'Each', 'NEC 210.8', TRUE, TRUE, 1, 1, TRUE),

-- Eaton BR AFCI Breakers
('0315', 'Eaton', 'BR115AF', '15A 1-Pole Combination AFCI Circuit Breaker', 'Circuit Breakers', 'AFCI Breakers', '120V', '15A', 1, 34.00, 52.00, 40, 16, 'B5', 'Each', 'NEC 210.12', TRUE, TRUE, 2, 1, TRUE),
('0316', 'Eaton', 'BR120AF', '20A 1-Pole Combination AFCI Circuit Breaker', 'Circuit Breakers', 'AFCI Breakers', '120V', '20A', 1, 34.00, 52.00, 50, 20, 'B5', 'Each', 'NEC 210.12', TRUE, TRUE, 2, 1, TRUE),
('0317', 'Eaton', 'BR220AF', '20A 2-Pole Combination AFCI Circuit Breaker', 'Circuit Breakers', 'AFCI Breakers', '240V', '20A', 2, 48.00, 73.00, 26, 10, 'B5', 'Each', 'NEC 210.12', TRUE, TRUE, 2, 1, TRUE),

-- Eaton BR GFCI Breakers
('0318', 'Eaton', 'BRGF115', '15A 1-Pole GFCI Circuit Breaker', 'Circuit Breakers', 'GFCI Breakers', '120V', '15A', 1, 41.00, 62.00, 32, 13, 'B6', 'Each', 'NEC 210.8', TRUE, TRUE, 2, 1, TRUE),
('0319', 'Eaton', 'BRGF120', '20A 1-Pole GFCI Circuit Breaker', 'Circuit Breakers', 'GFCI Breakers', '120V', '20A', 1, 41.00, 62.00, 36, 14, 'B6', 'Each', 'NEC 210.8', TRUE, TRUE, 2, 1, TRUE),
('0320', 'Eaton', 'BRGF220', '20A 2-Pole GFCI Circuit Breaker', 'Circuit Breakers', 'GFCI Breakers', '240V', '20A', 2, 61.00, 92.00, 22, 9, 'B6', 'Each', 'NEC 210.8', TRUE, TRUE, 2, 1, TRUE),

-- Eaton BR Dual Function
('0321', 'Eaton', 'BR120DF', '20A 1-Pole Dual Function AFCI/GFCI Breaker', 'Circuit Breakers', 'AFCI/GFCI Dual', '120V', '20A', 1, 65.00, 99.00, 33, 13, 'B7', 'Each', 'NEC 210.12', TRUE, TRUE, 2, 1, TRUE),
('0322', 'Eaton', 'BR115DF', '15A 1-Pole Dual Function AFCI/GFCI Breaker', 'Circuit Breakers', 'AFCI/GFCI Dual', '120V', '15A', 1, 65.00, 99.00, 28, 11, 'B7', 'Each', 'NEC 210.12', TRUE, TRUE, 2, 1, TRUE),

-- Specialty GFCI Breakers
('0323', 'Square D', 'QO250GFIC', '50A 2-Pole GFCI Circuit Breaker - Spa/Hot Tub', 'Circuit Breakers', 'GFCI Breakers', '240V', '50A', 2, 95.00, 145.00, 12, 5, 'B6', 'Each', 'NEC 680.32', TRUE, FALSE, 1, 2, TRUE),
('0324', 'Eaton', 'BRGF250', '50A 2-Pole GFCI Circuit Breaker - Spa/Hot Tub', 'Circuit Breakers', 'GFCI Breakers', '240V', '50A', 2, 92.00, 140.00, 10, 4, 'B6', 'Each', 'NEC 680.32', TRUE, FALSE, 2, 2, TRUE);


-- ============================================================
-- CATEGORY 4: WIRE & CABLE (35 items)
-- ============================================================

INSERT INTO inventory (item_id, brand, manufacturer_part_number, description, category, subcategory,
    voltage, amperage, wire_gauge, cost, sell_price, qty, min_stock, location,
    qty_per, nec_ref, ul_listed, commonly_used, primary_vendor_id, lead_time_days, active)
VALUES
-- NM-B Romex Cable (250ft rolls)
('0400', 'Southwire', '28827421', '14/2 NM-B Romex Cable w/Ground - 250ft Roll', 'Wire & Cable', 'NM-B Romex', '600V', '15A', '14 AWG', 85.00, 130.00, 15, 6, 'C1', 'Roll', 'NEC 334', TRUE, TRUE, 1, 1, TRUE),
('0401', 'Southwire', '28827422', '12/2 NM-B Romex Cable w/Ground - 250ft Roll', 'Wire & Cable', 'NM-B Romex', '600V', '20A', '12 AWG', 125.00, 190.00, 20, 8, 'C1', 'Roll', 'NEC 334', TRUE, TRUE, 1, 1, TRUE),
('0402', 'Southwire', '28827423', '10/2 NM-B Romex Cable w/Ground - 250ft Roll', 'Wire & Cable', 'NM-B Romex', '600V', '30A', '10 AWG', 215.00, 325.00, 12, 5, 'C1', 'Roll', 'NEC 334', TRUE, TRUE, 1, 1, TRUE),
('0403', 'Southwire', '28827432', '14/3 NM-B Romex Cable w/Ground - 250ft Roll', 'Wire & Cable', 'NM-B Romex', '600V', '15A', '14 AWG', 115.00, 175.00, 10, 4, 'C1', 'Roll', 'NEC 334', TRUE, TRUE, 1, 1, TRUE),
('0404', 'Southwire', '28827433', '12/3 NM-B Romex Cable w/Ground - 250ft Roll', 'Wire & Cable', 'NM-B Romex', '600V', '20A', '12 AWG', 175.00, 265.00, 15, 6, 'C1', 'Roll', 'NEC 334', TRUE, TRUE, 1, 1, TRUE),
('0405', 'Southwire', '28827434', '10/3 NM-B Romex Cable w/Ground - 250ft Roll', 'Wire & Cable', 'NM-B Romex', '600V', '30A', '10 AWG', 295.00, 445.00, 8, 3, 'C1', 'Roll', 'NEC 334', TRUE, TRUE, 1, 1, TRUE),

-- NM-B Romex Cable (1000ft rolls)
('0406', 'Southwire', '63948421', '12/2 NM-B Romex Cable w/Ground - 1000ft Roll', 'Wire & Cable', 'NM-B Romex', '600V', '20A', '12 AWG', 475.00, 715.00, 5, 2, 'C1', 'Roll', 'NEC 334', TRUE, TRUE, 1, 2, TRUE),
('0407', 'Southwire', '63948422', '14/2 NM-B Romex Cable w/Ground - 1000ft Roll', 'Wire & Cable', 'NM-B Romex', '600V', '15A', '14 AWG', 325.00, 490.00, 6, 2, 'C1', 'Roll', 'NEC 334', TRUE, TRUE, 1, 2, TRUE),

-- UF-B Underground Cable
('0408', 'Southwire', '13055706', '12/2 UF-B Underground Cable w/Ground - Per Foot', 'Wire & Cable', 'UF-B Underground', '600V', '20A', '12 AWG', 1.85, 2.80, 1000, 250, 'C2', 'Foot', 'NEC 340', TRUE, TRUE, 1, 1, TRUE),
('0409', 'Southwire', '13055707', '10/2 UF-B Underground Cable w/Ground - Per Foot', 'Wire & Cable', 'UF-B Underground', '600V', '30A', '10 AWG', 2.95, 4.45, 500, 150, 'C2', 'Foot', 'NEC 340', TRUE, TRUE, 1, 1, TRUE),
('0410', 'Southwire', '13055708', '12/3 UF-B Underground Cable w/Ground - Per Foot', 'Wire & Cable', 'UF-B Underground', '600V', '20A', '12 AWG', 2.65, 4.00, 750, 200, 'C2', 'Foot', 'NEC 340', TRUE, FALSE, 1, 1, TRUE),

-- THHN/THWN Single Conductors (500ft spools)
('0411', 'Southwire', '11587901', '14 AWG THHN/THWN Stranded - Black - 500ft', 'Wire & Cable', 'THHN Singles', '600V', '15A', '14 AWG', 68.00, 105.00, 8, 3, 'C3', 'Spool', 'NEC 310', TRUE, TRUE, 1, 1, TRUE),
('0412', 'Southwire', '11587902', '14 AWG THHN/THWN Stranded - White - 500ft', 'Wire & Cable', 'THHN Singles', '600V', '15A', '14 AWG', 68.00, 105.00, 8, 3, 'C3', 'Spool', 'NEC 310', TRUE, TRUE, 1, 1, TRUE),
('0413', 'Southwire', '11587903', '14 AWG THHN/THWN Stranded - Red - 500ft', 'Wire & Cable', 'THHN Singles', '600V', '15A', '14 AWG', 68.00, 105.00, 6, 2, 'C3', 'Spool', 'NEC 310', TRUE, FALSE, 1, 1, TRUE),
('0414', 'Southwire', '11587904', '14 AWG THHN/THWN Stranded - Green - 500ft', 'Wire & Cable', 'THHN Singles', '600V', '15A', '14 AWG', 68.00, 105.00, 6, 2, 'C3', 'Spool', 'NEC 310', TRUE, TRUE, 1, 1, TRUE),
('0415', 'Southwire', '11587911', '12 AWG THHN/THWN Stranded - Black - 500ft', 'Wire & Cable', 'THHN Singles', '600V', '20A', '12 AWG', 98.00, 150.00, 10, 4, 'C3', 'Spool', 'NEC 310', TRUE, TRUE, 1, 1, TRUE),
('0416', 'Southwire', '11587912', '12 AWG THHN/THWN Stranded - White - 500ft', 'Wire & Cable', 'THHN Singles', '600V', '20A', '12 AWG', 98.00, 150.00, 10, 4, 'C3', 'Spool', 'NEC 310', TRUE, TRUE, 1, 1, TRUE),
('0417', 'Southwire', '11587913', '12 AWG THHN/THWN Stranded - Red - 500ft', 'Wire & Cable', 'THHN Singles', '600V', '20A', '12 AWG', 98.00, 150.00, 6, 2, 'C3', 'Spool', 'NEC 310', TRUE, FALSE, 1, 1, TRUE),
('0418', 'Southwire', '11587914', '12 AWG THHN/THWN Stranded - Green - 500ft', 'Wire & Cable', 'THHN Singles', '600V', '20A', '12 AWG', 98.00, 150.00, 8, 3, 'C3', 'Spool', 'NEC 310', TRUE, TRUE, 1, 1, TRUE),
('0419', 'Southwire', '11587921', '10 AWG THHN/THWN Stranded - Black - 500ft', 'Wire & Cable', 'THHN Singles', '600V', '30A', '10 AWG', 155.00, 235.00, 6, 2, 'C3', 'Spool', 'NEC 310', TRUE, TRUE, 1, 1, TRUE),
('0420', 'Southwire', '11587922', '10 AWG THHN/THWN Stranded - White - 500ft', 'Wire & Cable', 'THHN Singles', '600V', '30A', '10 AWG', 155.00, 235.00, 6, 2, 'C3', 'Spool', 'NEC 310', TRUE, TRUE, 1, 1, TRUE),
('0421', 'Southwire', '11587924', '10 AWG THHN/THWN Stranded - Green - 500ft', 'Wire & Cable', 'THHN Singles', '600V', '30A', '10 AWG', 155.00, 235.00, 5, 2, 'C3', 'Spool', 'NEC 310', TRUE, TRUE, 1, 1, TRUE),

-- MC Cable (Metal Clad)
('0422', 'Southwire', '55275721', '12/2 MC Cable w/Ground - 250ft Roll', 'Wire & Cable', 'MC Cable', '600V', '20A', '12 AWG, 2 Conductor + Ground', 185.00, 280.00, 8, 3, 'C4', 'Roll', 'NEC 330', TRUE, TRUE, 1, 1, TRUE),
('0423', 'Southwire', '55275722', '12/3 MC Cable w/Ground - 250ft Roll', 'Wire & Cable', 'MC Cable', '600V', '20A', '12 AWG, 3 Conductor + Ground', 245.00, 370.00, 6, 2, 'C4', 'Roll', 'NEC 330', TRUE, TRUE, 1, 1, TRUE),
('0424', 'Southwire', '55275723', '10/2 MC Cable w/Ground - 250ft Roll', 'Wire & Cable', 'MC Cable', '600V', '30A', '10 AWG, 2 Conductor + Ground', 295.00, 445.00, 5, 2, 'C4', 'Roll', 'NEC 330', TRUE, FALSE, 1, 2, TRUE),

-- Low Voltage Cable
('0425', 'Southwire', '56918445', 'Cat6 Ethernet Cable - Blue - 1000ft Box', 'Wire & Cable', 'Low Voltage', '300V', NULL, 'Cat6 UTP 23 AWG', 125.00, 190.00, 10, 4, 'C5', 'Box', 'NEC 800', TRUE, TRUE, 1, 1, TRUE),
('0426', 'Southwire', '56918446', 'Cat6 Ethernet Cable - White - 1000ft Box', 'Wire & Cable', 'Low Voltage', '300V', NULL, 'Cat6 UTP 23 AWG', 125.00, 190.00, 8, 3, 'C5', 'Box', 'NEC 800', TRUE, TRUE, 1, 1, TRUE),
('0427', 'Southwire', '56918501', 'RG6 Coax Cable - Black - 1000ft Box', 'Wire & Cable', 'Low Voltage', '75 Ohm', NULL, '18 AWG Center Conductor', 85.00, 130.00, 6, 2, 'C5', 'Box', 'NEC 820', TRUE, TRUE, 1, 1, TRUE),
('0428', 'Southwire', '56918601', '18/2 Thermostat Wire - 250ft Roll', 'Wire & Cable', 'Low Voltage', '300V', NULL, '18 AWG, 2 Conductor', 28.00, 43.00, 15, 6, 'C5', 'Roll', 'NEC 725', TRUE, TRUE, 1, 1, TRUE),
('0429', 'Southwire', '56918602', '18/5 Thermostat Wire - 250ft Roll', 'Wire & Cable', 'Low Voltage', '300V', NULL, '18 AWG, 5 Conductor', 48.00, 73.00, 10, 4, 'C5', 'Roll', 'NEC 725', TRUE, FALSE, 1, 1, TRUE),
('0430', 'Southwire', '56918701', '18/2 Doorbell Wire - 250ft Roll', 'Wire & Cable', 'Low Voltage', '300V', NULL, '18 AWG, 2 Conductor', 26.00, 40.00, 12, 5, 'C5', 'Roll', 'NEC 725', TRUE, TRUE, 1, 1, TRUE),

-- Bare Ground Wire
('0431', 'Southwire', '11586901', '12 AWG Bare Copper Ground Wire - 315ft Coil', 'Wire & Cable', 'Grounding', NULL, NULL, '12 AWG Solid Bare Copper', 78.00, 120.00, 8, 3, 'C6', 'Coil', 'NEC 250', TRUE, TRUE, 1, 1, TRUE),
('0432', 'Southwire', '11586902', '10 AWG Bare Copper Ground Wire - 315ft Coil', 'Wire & Cable', 'Grounding', NULL, NULL, '10 AWG Solid Bare Copper', 118.00, 180.00, 6, 2, 'C6', 'Coil', 'NEC 250', TRUE, TRUE, 1, 1, TRUE),
('0433', 'Southwire', '11586903', '6 AWG Bare Copper Ground Wire - 315ft Coil', 'Wire & Cable', 'Grounding', NULL, NULL, '6 AWG Stranded Bare Copper', 245.00, 370.00, 4, 2, 'C6', 'Coil', 'NEC 250', TRUE, FALSE, 1, 1, TRUE);


-- ============================================================
-- CATEGORY 5: DEVICES - OUTLETS & RECEPTACLES (30 items)
-- ============================================================

INSERT INTO inventory (item_id, brand, manufacturer_part_number, description, category, subcategory,
    voltage, amperage, wire_gauge, cost, sell_price, qty, min_stock, location,
    qty_per, nec_ref, ul_listed, commonly_used, primary_vendor_id, lead_time_days, active)
VALUES
-- Standard Duplex Outlets - 15A
('0450', 'Leviton', '5320-W', '15A Duplex Receptacle - White', 'Devices', 'Standard Outlets', '125V', '15A', 'Side/Back Wire', 0.85, 1.50, 200, 75, 'D1', 'Each', 'NEC 406', TRUE, TRUE, 1, 1, TRUE),
('0451', 'Leviton', '5320-I', '15A Duplex Receptacle - Ivory', 'Devices', 'Standard Outlets', '125V', '15A', 'Side/Back Wire', 0.85, 1.50, 150, 50, 'D1', 'Each', 'NEC 406', TRUE, TRUE, 1, 1, TRUE),
('0452', 'Leviton', '5320-A', '15A Duplex Receptacle - Almond', 'Devices', 'Standard Outlets', '125V', '15A', 'Side/Back Wire', 0.85, 1.50, 100, 30, 'D1', 'Each', 'NEC 406', TRUE, FALSE, 1, 1, TRUE),
('0453', 'Pass & Seymour', 'TR-5325-W', '15A Tamper-Resistant Duplex - White', 'Devices', 'Tamper-Resistant', '125V', '15A', 'Side/Back Wire, TR', 1.45, 2.40, 250, 100, 'D1', 'Each', 'NEC 406.12', TRUE, TRUE, 1, 1, TRUE),
('0454', 'Pass & Seymour', 'TR-5325-I', '15A Tamper-Resistant Duplex - Ivory', 'Devices', 'Tamper-Resistant', '125V', '15A', 'Side/Back Wire, TR', 1.45, 2.40, 180, 70, 'D1', 'Each', 'NEC 406.12', TRUE, TRUE, 1, 1, TRUE),

-- Standard Duplex Outlets - 20A
('0455', 'Leviton', '5362-W', '20A Duplex Receptacle - White', 'Devices', 'Standard Outlets', '125V', '20A', 'Side/Back Wire, T-Slot', 1.25, 2.00, 150, 60, 'D1', 'Each', 'NEC 406', TRUE, TRUE, 1, 1, TRUE),
('0456', 'Leviton', '5362-I', '20A Duplex Receptacle - Ivory', 'Devices', 'Standard Outlets', '125V', '20A', 'Side/Back Wire, T-Slot', 1.25, 2.00, 100, 40, 'D1', 'Each', 'NEC 406', TRUE, FALSE, 1, 1, TRUE),
('0457', 'Pass & Seymour', 'TR-5362-W', '20A Tamper-Resistant Duplex - White', 'Devices', 'Tamper-Resistant', '125V', '20A', 'T-Slot, TR', 1.85, 2.90, 120, 50, 'D1', 'Each', 'NEC 406.12', TRUE, TRUE, 1, 1, TRUE),

-- Hospital Grade Outlets
('0458', 'Leviton', '8300-W', '20A Hospital Grade Duplex - White', 'Devices', 'Hospital Grade', '125V', '20A', 'Hospital Grade, Green Dot', 4.50, 7.00, 40, 15, 'D2', 'Each', 'NEC 517', TRUE, FALSE, 1, 1, TRUE),
('0459', 'Pass & Seymour', 'IG5362-W', '20A Isolated Ground Duplex - White', 'Devices', 'Hospital Grade', '125V', '20A', 'Isolated Ground, Orange', 3.25, 5.00, 30, 12, 'D2', 'Each', 'NEC 250.146', TRUE, FALSE, 1, 1, TRUE),

-- GFCI Outlets
('0460', 'Leviton', 'GFNT1-W', '15A GFCI Receptacle - White', 'Devices', 'GFCI Outlets', '125V', '15A', 'Self-Test, TR', 14.50, 22.00, 100, 40, 'D3', 'Each', 'NEC 210.8', TRUE, TRUE, 1, 1, TRUE),
('0461', 'Leviton', 'GFNT1-I', '15A GFCI Receptacle - Ivory', 'Devices', 'GFCI Outlets', '125V', '15A', 'Self-Test, TR', 14.50, 22.00, 70, 30, 'D3', 'Each', 'NEC 210.8', TRUE, TRUE, 1, 1, TRUE),
('0462', 'Leviton', 'GFNT2-W', '20A GFCI Receptacle - White', 'Devices', 'GFCI Outlets', '125V', '20A', 'Self-Test, TR', 16.00, 24.50, 120, 50, 'D3', 'Each', 'NEC 210.8', TRUE, TRUE, 1, 1, TRUE),
('0463', 'Leviton', 'GFNT2-I', '20A GFCI Receptacle - Ivory', 'Devices', 'GFCI Outlets', '125V', '20A', 'Self-Test, TR', 16.00, 24.50, 80, 35, 'D3', 'Each', 'NEC 210.8', TRUE, TRUE, 1, 1, TRUE),
('0464', 'Pass & Seymour', '1597-W', '15A GFCI Receptacle - White', 'Devices', 'GFCI Outlets', '125V', '15A', 'Self-Test, TR', 13.50, 21.00, 90, 40, 'D3', 'Each', 'NEC 210.8', TRUE, TRUE, 1, 1, TRUE),
('0465', 'Pass & Seymour', '2097-W', '20A GFCI Receptacle - White', 'Devices', 'GFCI Outlets', '125V', '20A', 'Self-Test, TR', 15.00, 23.00, 100, 45, 'D3', 'Each', 'NEC 210.8', TRUE, TRUE, 1, 1, TRUE),

-- Weatherproof GFCI Outlets
('0466', 'Leviton', 'GFWT1-W', '15A Weather-Resistant GFCI - White', 'Devices', 'Weatherproof GFCI', '125V', '15A', 'WR, Self-Test, TR', 18.50, 28.00, 60, 25, 'D4', 'Each', 'NEC 406.9', TRUE, TRUE, 1, 1, TRUE),
('0467', 'Leviton', 'GFWT2-W', '20A Weather-Resistant GFCI - White', 'Devices', 'Weatherproof GFCI', '125V', '20A', 'WR, Self-Test, TR', 20.00, 30.00, 70, 30, 'D4', 'Each', 'NEC 406.9', TRUE, TRUE, 1, 1, TRUE),

-- USB Outlets
('0468', 'Leviton', 'T5632-W', '15A Duplex w/ USB-A Charging - White', 'Devices', 'USB Outlets', '125V', '15A', 'TR, 3.6A USB', 18.00, 27.50, 80, 30, 'D5', 'Each', 'NEC 406', TRUE, TRUE, 1, 1, TRUE),
('0469', 'Leviton', 'T5633-W', '15A Duplex w/ USB-A + USB-C - White', 'Devices', 'USB Outlets', '125V', '15A', 'TR, USB-C PD 18W', 24.00, 36.00, 60, 25, 'D5', 'Each', 'NEC 406', TRUE, TRUE, 1, 1, TRUE),
('0470', 'Leviton', 'T5635-W', '20A Duplex w/ USB-A + USB-C - White', 'Devices', 'USB Outlets', '125V', '20A', 'TR, USB-C PD 30W', 28.00, 42.50, 50, 20, 'D5', 'Each', 'NEC 406', TRUE, FALSE, 1, 1, TRUE),
('0471', 'Pass & Seymour', 'TM8USB-W', '15A Duplex w/ USB-A Charging - White', 'Devices', 'USB Outlets', '125V', '15A', 'TR, 4.0A USB', 17.00, 26.00, 70, 28, 'D5', 'Each', 'NEC 406', TRUE, TRUE, 1, 1, TRUE),

-- Specialty Outlets
('0472', 'Leviton', '5842-I', 'Dryer Receptacle - 30A 125/250V - Ivory', 'Devices', 'Specialty Outlets', '125/250V', '30A', '4-Wire NEMA 14-30R', 8.50, 13.00, 40, 15, 'D6', 'Each', 'NEC 250.140', TRUE, TRUE, 1, 1, TRUE),
('0473', 'Leviton', '5374', 'Range Receptacle - 50A 125/250V - Flush', 'Devices', 'Specialty Outlets', '125/250V', '50A', '4-Wire NEMA 14-50R', 12.50, 19.00, 35, 12, 'D6', 'Each', 'NEC 250.140', TRUE, TRUE, 1, 1, TRUE),
('0474', 'Leviton', '125/250V', 'Welder Receptacle - 50A - Surface', 'Devices', 'Specialty Outlets', '125/250V', '50A', '3-Wire NEMA 6-50R', 15.00, 23.00, 20, 8, 'D6', 'Each', 'NEC 406', TRUE, FALSE, 1, 1, TRUE),
('0475', 'Leviton', '5207-W', 'Single Receptacle - 20A 125V - White', 'Devices', 'Standard Outlets', '125V', '20A', 'Single Outlet', 1.85, 2.90, 60, 20, 'D1', 'Each', 'NEC 406', TRUE, FALSE, 1, 1, TRUE),
('0476', 'Hubbell', '5262', '15A Duplex Receptacle - White - Commercial', 'Devices', 'Standard Outlets', '125V', '15A', 'Heavy Duty Spec Grade', 2.85, 4.50, 100, 40, 'D1', 'Each', 'NEC 406', TRUE, FALSE, 1, 1, TRUE),
('0477', 'Hubbell', '5362', '20A Duplex Receptacle - White - Commercial', 'Devices', 'Standard Outlets', '125V', '20A', 'Heavy Duty Spec Grade', 3.50, 5.50, 80, 30, 'D1', 'Each', 'NEC 406', TRUE, FALSE, 1, 1, TRUE),

-- Outdoor/Weatherproof Covers (with outlets)
('0478', 'TayMac', 'MM410C', 'Weatherproof Cover - 1-Gang Vertical - Clear', 'Devices', 'Weatherproof Covers', NULL, NULL, 'In-Use Cover, NEMA 3R', 8.50, 13.00, 50, 20, 'D7', 'Each', 'NEC 406.9', TRUE, TRUE, 1, 1, TRUE),
('0479', 'Red Dot', 'DCVC', 'Weatherproof Cover - 1-Gang GFCI - Gray', 'Devices', 'Weatherproof Covers', NULL, NULL, 'In-Use Cover, NEMA 3R', 9.50, 14.50, 45, 18, 'D7', 'Each', 'NEC 406.9', TRUE, TRUE, 1, 1, TRUE);


-- ============================================================
-- CATEGORY 6: DEVICES - SWITCHES (25 items)
-- ============================================================

INSERT INTO inventory (item_id, brand, manufacturer_part_number, description, category, subcategory,
    voltage, amperage, wire_gauge, cost, sell_price, qty, min_stock, location,
    qty_per, nec_ref, ul_listed, commonly_used, primary_vendor_id, lead_time_days, active)
VALUES
-- Single-Pole Switches
('0500', 'Leviton', '5501-W', '15A Single-Pole Switch - White', 'Devices', 'Standard Switches', '120/277V', '15A', 'Side/Back Wire', 0.95, 1.60, 200, 80, 'E1', 'Each', 'NEC 404', TRUE, TRUE, 1, 1, TRUE),
('0501', 'Leviton', '5501-I', '15A Single-Pole Switch - Ivory', 'Devices', 'Standard Switches', '120/277V', '15A', 'Side/Back Wire', 0.95, 1.60, 150, 60, 'E1', 'Each', 'NEC 404', TRUE, TRUE, 1, 1, TRUE),
('0502', 'Leviton', '5501-A', '15A Single-Pole Switch - Almond', 'Devices', 'Standard Switches', '120/277V', '15A', 'Side/Back Wire', 0.95, 1.60, 80, 30, 'E1', 'Each', 'NEC 404', TRUE, FALSE, 1, 1, TRUE),
('0503', 'Pass & Seymour', 'PS20AC1-W', '20A Single-Pole Switch - White', 'Devices', 'Standard Switches', '120/277V', '20A', 'Commercial Grade', 1.85, 2.90, 120, 50, 'E1', 'Each', 'NEC 404', TRUE, TRUE, 1, 1, TRUE),

-- 3-Way Switches
('0504', 'Leviton', '5503-W', '15A 3-Way Switch - White', 'Devices', '3-Way Switches', '120/277V', '15A', 'Side/Back Wire', 1.25, 2.00, 180, 70, 'E2', 'Each', 'NEC 404', TRUE, TRUE, 1, 1, TRUE),
('0505', 'Leviton', '5503-I', '15A 3-Way Switch - Ivory', 'Devices', '3-Way Switches', '120/277V', '15A', 'Side/Back Wire', 1.25, 2.00, 130, 50, 'E2', 'Each', 'NEC 404', TRUE, TRUE, 1, 1, TRUE),
('0506', 'Leviton', '5503-A', '15A 3-Way Switch - Almond', 'Devices', '3-Way Switches', '120/277V', '15A', 'Side/Back Wire', 1.25, 2.00, 70, 25, 'E2', 'Each', 'NEC 404', TRUE, FALSE, 1, 1, TRUE),
('0507', 'Pass & Seymour', 'PS20AC3-W', '20A 3-Way Switch - White', 'Devices', '3-Way Switches', '120/277V', '20A', 'Commercial Grade', 2.15, 3.40, 100, 40, 'E2', 'Each', 'NEC 404', TRUE, TRUE, 1, 1, TRUE),

-- 4-Way Switches
('0508', 'Leviton', '5504-W', '15A 4-Way Switch - White', 'Devices', '4-Way Switches', '120/277V', '15A', 'Side/Back Wire', 2.85, 4.50, 60, 20, 'E3', 'Each', 'NEC 404', TRUE, FALSE, 1, 1, TRUE),
('0509', 'Leviton', '5504-I', '15A 4-Way Switch - Ivory', 'Devices', '4-Way Switches', '120/277V', '15A', 'Side/Back Wire', 2.85, 4.50, 50, 18, 'E3', 'Each', 'NEC 404', TRUE, FALSE, 1, 1, TRUE),
('0510', 'Pass & Seymour', 'PS20AC4-W', '20A 4-Way Switch - White', 'Devices', '4-Way Switches', '120/277V', '20A', 'Commercial Grade', 3.85, 6.00, 40, 15, 'E3', 'Each', 'NEC 404', TRUE, FALSE, 1, 1, TRUE),

-- Dimmer Switches - Standard
('0511', 'Lutron', 'DVCL-153P-WH', '150W LED/CFL Dimmer - White', 'Devices', 'Dimmers', '120V', '15A', 'Diva, Single-Pole', 18.50, 28.00, 80, 30, 'E4', 'Each', 'NEC 404', TRUE, TRUE, 1, 1, TRUE),
('0512', 'Lutron', 'DVCL-153P-IV', '150W LED/CFL Dimmer - Ivory', 'Devices', 'Dimmers', '120V', '15A', 'Diva, Single-Pole', 18.50, 28.00, 60, 25, 'E4', 'Each', 'NEC 404', TRUE, TRUE, 1, 1, TRUE),
('0513', 'Lutron', 'DVSTV-WH', '0-10V LED Dimmer - White', 'Devices', 'Dimmers', '120/277V', '15A', '0-10V Control', 45.00, 68.00, 30, 12, 'E4', 'Each', 'NEC 404', TRUE, FALSE, 1, 2, TRUE),
('0514', 'Lutron', 'DVCL-153PR-WH', '150W LED Dimmer 3-Way - White', 'Devices', 'Dimmers', '120V', '15A', 'Diva, 3-Way', 22.00, 33.50, 60, 25, 'E4', 'Each', 'NEC 404', TRUE, TRUE, 1, 1, TRUE),
('0515', 'Leviton', 'IPL06-1LZ', '150W LED Dimmer - White', 'Devices', 'Dimmers', '120V', '15A', 'Decora, Single-Pole', 16.00, 24.50, 70, 28, 'E4', 'Each', 'NEC 404', TRUE, TRUE, 1, 1, TRUE),

-- Smart Switches - Lutron Caseta
('0516', 'Lutron', 'PD-6WCL-WH', 'Caseta Smart Dimmer - White', 'Devices', 'Smart Switches', '120V', '15A', 'WiFi, LED/CFL 150W', 58.00, 88.00, 25, 10, 'E5', 'Each', 'NEC 404', TRUE, TRUE, 1, 2, TRUE),
('0517', 'Lutron', 'PD-5WS-DV-WH', 'Caseta Smart Switch - White', 'Devices', 'Smart Switches', '120V', '15A', 'WiFi, On/Off', 48.00, 73.00, 20, 8, 'E5', 'Each', 'NEC 404', TRUE, FALSE, 1, 2, TRUE),
('0518', 'Lutron', 'PD-FSQN-WH', 'Caseta Fan Speed Control - White', 'Devices', 'Smart Switches', '120V', '1.5A', 'WiFi, Fan Control', 58.00, 88.00, 15, 6, 'E5', 'Each', 'NEC 404', TRUE, FALSE, 1, 2, TRUE),

-- Occupancy Sensors
('0519', 'Leviton', 'OSS10-I0W', 'Occupancy Sensor Switch - White', 'Devices', 'Sensors', '120/277V', '15A', 'PIR, 180°, Auto On/Off', 28.00, 42.50, 40, 15, 'E6', 'Each', 'NEC 404', TRUE, TRUE, 1, 1, TRUE),
('0520', 'Lutron', 'MS-OPS5M-WH', 'Maestro Occupancy Sensor - White', 'Devices', 'Sensors', '120V', '5A', 'PIR, Manual On, Auto Off', 32.00, 48.50, 35, 14, 'E6', 'Each', 'NEC 404', TRUE, TRUE, 1, 1, TRUE),
('0521', 'Pass & Seymour', 'OSSMT-GDW', 'Dual Tech Occupancy Sensor - White', 'Devices', 'Sensors', '120/277V', '20A', 'PIR+Ultrasonic', 42.00, 64.00, 25, 10, 'E6', 'Each', 'NEC 404', TRUE, FALSE, 1, 1, TRUE),

-- Timer Switches
('0522', 'Leviton', 'LTB60-1LW', 'Decora Timer Switch - White', 'Devices', 'Timers', '120V', '20A', 'Digital, 7-Day Program', 38.00, 58.00, 30, 12, 'E7', 'Each', 'NEC 404', TRUE, FALSE, 1, 1, TRUE),
('0523', 'Lutron', 'MA-T51-WH', 'Maestro Timer Switch - White', 'Devices', 'Timers', '120V', '5A', '1/5/10/15/30/60 min', 22.00, 33.50, 35, 14, 'E7', 'Each', 'NEC 404', TRUE, TRUE, 1, 1, TRUE),
('0524', 'Intermatic', 'EI400C', 'Spring Wound Timer - Ivory', 'Devices', 'Timers', '120/277V', '20A', '12-Hour Mechanical', 12.00, 18.50, 25, 10, 'E7', 'Each', 'NEC 404', TRUE, FALSE, 1, 1, TRUE);


-- ============================================================
-- CATEGORY 7: BOXES & COVERS (30 items)
-- ============================================================

INSERT INTO inventory (item_id, brand, manufacturer_part_number, description, category, subcategory,
    wire_gauge, cost, sell_price, qty, min_stock, location,
    qty_per, nec_ref, ul_listed, commonly_used, primary_vendor_id, lead_time_days, active)
VALUES
-- Old Work/Cut-In Boxes
('0550', 'Carlon', 'B114R-UPC', 'Single Gang Old Work Box - Blue', 'Boxes & Covers', 'Old Work Boxes', '14 cu.in., PVC', 0.65, 1.20, 300, 100, 'F1', 'Each', 'NEC 314.16', TRUE, TRUE, 1, 1, TRUE),
('0551', 'Carlon', 'B120R-UPC', '2-Gang Old Work Box - Blue', 'Boxes & Covers', 'Old Work Boxes', '20 cu.in., PVC', 1.15, 2.00, 200, 75, 'F1', 'Each', 'NEC 314.16', TRUE, TRUE, 1, 1, TRUE),
('0552', 'Carlon', 'B125R-UPC', '3-Gang Old Work Box - Blue', 'Boxes & Covers', 'Old Work Boxes', '25 cu.in., PVC', 1.85, 3.00, 100, 35, 'F1', 'Each', 'NEC 314.16', TRUE, TRUE, 1, 1, TRUE),
('0553', 'Thomas & Betts', 'B114A-25', 'Single Gang Old Work Box - 25pk', 'Boxes & Covers', 'Old Work Boxes', '14 cu.in., PVC', 12.50, 19.50, 20, 8, 'F1', 'Box-25', 'NEC 314.16', TRUE, TRUE, 1, 1, TRUE),
('0554', 'Carlon', 'B618R', 'Single Gang Old Work - Shallow 2.5"', 'Boxes & Covers', 'Old Work Boxes', '8 cu.in., PVC', 0.85, 1.50, 150, 50, 'F1', 'Each', 'NEC 314.16', TRUE, FALSE, 1, 1, TRUE),

-- New Work Boxes - Plastic
('0555', 'Carlon', 'B114RB', 'Single Gang New Work Box - Blue', 'Boxes & Covers', 'New Work Boxes', '18 cu.in., PVC, Nails', 0.75, 1.35, 350, 120, 'F2', 'Each', 'NEC 314.16', TRUE, TRUE, 1, 1, TRUE),
('0556', 'Carlon', 'B120RB', '2-Gang New Work Box - Blue', 'Boxes & Covers', 'New Work Boxes', '32 cu.in., PVC, Nails', 1.35, 2.25, 250, 85, 'F2', 'Each', 'NEC 314.16', TRUE, TRUE, 1, 1, TRUE),
('0557', 'Carlon', 'B125RB', '3-Gang New Work Box - Blue', 'Boxes & Covers', 'New Work Boxes', '45 cu.in., PVC, Nails', 2.15, 3.50, 150, 50, 'F2', 'Each', 'NEC 314.16', TRUE, TRUE, 1, 1, TRUE),
('0558', 'Carlon', 'BH114RB-25', 'Single Gang New Work - Adjustable - 25pk', 'Boxes & Covers', 'New Work Boxes', '18 cu.in., PVC', 15.00, 23.50, 25, 10, 'F2', 'Box-25', 'NEC 314.16', TRUE, TRUE, 1, 1, TRUE),

-- New Work Boxes - Metal
('0559', 'RACO', '663', 'Single Gang Metal New Work Box', 'Boxes & Covers', 'New Work Boxes', 'Steel, 14 cu.in.', 1.65, 2.75, 100, 40, 'F3', 'Each', 'NEC 314.16', TRUE, FALSE, 1, 1, TRUE),
('0560', 'RACO', '664', '2-Gang Metal New Work Box', 'Boxes & Covers', 'New Work Boxes', 'Steel, 25 cu.in.', 2.85, 4.50, 75, 30, 'F3', 'Each', 'NEC 314.16', TRUE, FALSE, 1, 1, TRUE),

-- 4" Square Boxes
('0561', 'RACO', '8230', '4" Square Box - 1-1/2" Deep', 'Boxes & Covers', '4" Square Boxes', 'Steel, 21 cu.in.', 1.85, 3.00, 200, 75, 'F4', 'Each', 'NEC 314.16', TRUE, TRUE, 1, 1, TRUE),
('0562', 'RACO', '8231', '4" Square Box - 2-1/8" Deep', 'Boxes & Covers', '4" Square Boxes', 'Steel, 30.3 cu.in.', 2.25, 3.60, 180, 65, 'F4', 'Each', 'NEC 314.16', TRUE, TRUE, 1, 1, TRUE),
('0563', 'RACO', '8232', '4" Square Extension Ring - 1-1/2"', 'Boxes & Covers', '4" Square Boxes', 'Steel Extension', 1.50, 2.50, 100, 40, 'F4', 'Each', 'NEC 314.16', TRUE, FALSE, 1, 1, TRUE),
('0564', 'Thomas & Betts', '52151-1/2', '4-11/16" Square Box - 1-1/2" Deep', 'Boxes & Covers', '4" Square Boxes', 'Steel, 30.3 cu.in.', 2.50, 4.00, 150, 55, 'F4', 'Each', 'NEC 314.16', TRUE, TRUE, 1, 1, TRUE),
('0565', 'Thomas & Betts', '52151-2-1/8', '4-11/16" Square Box - 2-1/8" Deep', 'Boxes & Covers', '4" Square Boxes', 'Steel, 42 cu.in.', 3.00, 4.75, 120, 45, 'F4', 'Each', 'NEC 314.16', TRUE, TRUE, 1, 1, TRUE),

-- 4" Square Covers
('0566', 'RACO', '8705', '4" Square Blank Cover - Flat', 'Boxes & Covers', '4" Sq Covers', 'Steel', 0.85, 1.50, 150, 50, 'F5', 'Each', 'NEC 314.28', TRUE, TRUE, 1, 1, TRUE),
('0567', 'RACO', '8751', '4" Square Cover - Single Device', 'Boxes & Covers', '4" Sq Covers', 'Steel, Raised 1/2"', 1.25, 2.10, 200, 75, 'F5', 'Each', 'NEC 314.28', TRUE, TRUE, 1, 1, TRUE),
('0568', 'RACO', '8752', '4" Square Cover - Double Device', 'Boxes & Covers', '4" Sq Covers', 'Steel, Raised 1/2"', 1.75, 2.80, 150, 55, 'F5', 'Each', 'NEC 314.28', TRUE, TRUE, 1, 1, TRUE),
('0569', 'RACO', '8753', '4" Square Cover - Triple Device', 'Boxes & Covers', '4" Sq Covers', 'Steel, Raised 1/2"', 2.50, 4.00, 80, 30, 'F5', 'Each', 'NEC 314.28', TRUE, FALSE, 1, 1, TRUE),

-- Ceiling Boxes
('0570', 'RACO', '936', 'Round Pancake Box - 1/2" Deep', 'Boxes & Covers', 'Ceiling Boxes', 'Steel, 4" Round', 1.15, 2.00, 120, 45, 'F6', 'Each', 'NEC 314.27', TRUE, TRUE, 1, 1, TRUE),
('0571', 'RACO', '937', 'Round Ceiling Box - 1-1/2" Deep', 'Boxes & Covers', 'Ceiling Boxes', 'Steel, 4" Round', 1.85, 3.00, 150, 55, 'F6', 'Each', 'NEC 314.27', TRUE, TRUE, 1, 1, TRUE),
('0572', 'Carlon', 'B618A', 'Round Old Work Ceiling Box - PVC', 'Boxes & Covers', 'Ceiling Boxes', 'PVC, 18 cu.in.', 1.25, 2.10, 100, 40, 'F6', 'Each', 'NEC 314.27', TRUE, TRUE, 1, 1, TRUE),
('0573', 'RACO', '911C', 'Octagon Ceiling Box - 1-1/2" Deep', 'Boxes & Covers', 'Ceiling Boxes', 'Steel, 4" Octagon', 2.15, 3.40, 120, 45, 'F6', 'Each', 'NEC 314.27', TRUE, TRUE, 1, 1, TRUE),
('0574', 'Carlon', 'B620A-UPC', 'Ceiling Fan Box - Old Work', 'Boxes & Covers', 'Ceiling Boxes', 'PVC, Fan Rated 50lb', 3.85, 6.00, 60, 25, 'F6', 'Each', 'NEC 314.27', TRUE, TRUE, 1, 1, TRUE),

-- Weatherproof Boxes
('0575', 'Red Dot', 'WPB1', '1-Gang Weatherproof Box - Gray', 'Boxes & Covers', 'Weatherproof Boxes', 'Die-Cast, 3 Holes', 4.50, 7.00, 80, 30, 'F7', 'Each', 'NEC 314.15', TRUE, TRUE, 1, 1, TRUE),
('0576', 'Red Dot', 'WPB2', '2-Gang Weatherproof Box - Gray', 'Boxes & Covers', 'Weatherproof Boxes', 'Die-Cast, 5 Holes', 6.50, 10.00, 60, 25, 'F7', 'Each', 'NEC 314.15', TRUE, TRUE, 1, 1, TRUE),
('0577', 'TayMac', 'MX2100', '1-Gang Deep Weatherproof Box - Gray', 'Boxes & Covers', 'Weatherproof Boxes', 'Non-Metallic, 2" Deep', 5.50, 8.50, 70, 28, 'F7', 'Each', 'NEC 314.15', TRUE, TRUE, 1, 1, TRUE),

-- Junction Boxes - PVC
('0578', 'Carlon', 'E987N', '4x4x2 PVC Junction Box', 'Boxes & Covers', 'Junction Boxes', 'PVC, NEMA 3R', 2.85, 4.50, 100, 40, 'F8', 'Each', 'NEC 314', TRUE, TRUE, 1, 1, TRUE),
('0579', 'Carlon', 'E989N', '6x6x4 PVC Junction Box', 'Boxes & Covers', 'Junction Boxes', 'PVC, NEMA 3R', 5.50, 8.50, 60, 25, 'F8', 'Each', 'NEC 314', TRUE, FALSE, 1, 1, TRUE);


-- ============================================================
-- CATEGORY 8: CONDUIT & FITTINGS (25 items)
-- ============================================================

INSERT INTO inventory (item_id, brand, manufacturer_part_number, description, category, subcategory,
    wire_gauge, cost, sell_price, qty, min_stock, location,
    qty_per, nec_ref, ul_listed, commonly_used, primary_vendor_id, lead_time_days, active)
VALUES
-- EMT Conduit
('0600', 'Allied Tube', 'EMT050-10', '1/2" EMT Conduit - 10ft Stick', 'Conduit & Fittings', 'EMT Conduit', 'Electric Metallic Tubing', 4.50, 7.00, 150, 50, 'G1', 'Each', 'NEC 358', TRUE, TRUE, 1, 1, TRUE),
('0601', 'Allied Tube', 'EMT075-10', '3/4" EMT Conduit - 10ft Stick', 'Conduit & Fittings', 'EMT Conduit', 'Electric Metallic Tubing', 6.50, 10.00, 120, 40, 'G1', 'Each', 'NEC 358', TRUE, TRUE, 1, 1, TRUE),
('0602', 'Allied Tube', 'EMT100-10', '1" EMT Conduit - 10ft Stick', 'Conduit & Fittings', 'EMT Conduit', 'Electric Metallic Tubing', 9.50, 14.50, 80, 30, 'G1', 'Each', 'NEC 358', TRUE, TRUE, 1, 1, TRUE),
('0603', 'Allied Tube', 'EMT125-10', '1-1/4" EMT Conduit - 10ft Stick', 'Conduit & Fittings', 'EMT Conduit', 'Electric Metallic Tubing', 14.00, 21.50, 50, 20, 'G1', 'Each', 'NEC 358', TRUE, FALSE, 1, 1, TRUE),
('0604', 'Allied Tube', 'EMT150-10', '1-1/2" EMT Conduit - 10ft Stick', 'Conduit & Fittings', 'EMT Conduit', 'Electric Metallic Tubing', 17.00, 26.00, 40, 15, 'G1', 'Each', 'NEC 358', TRUE, FALSE, 1, 1, TRUE),

-- PVC Conduit Schedule 40
('0605', 'Cantex', 'PVC-40-050', '1/2" PVC Schedule 40 Conduit - 10ft', 'Conduit & Fittings', 'PVC Conduit', 'Schedule 40, Gray', 2.85, 4.50, 100, 35, 'G2', 'Each', 'NEC 352', TRUE, TRUE, 1, 1, TRUE),
('0606', 'Cantex', 'PVC-40-075', '3/4" PVC Schedule 40 Conduit - 10ft', 'Conduit & Fittings', 'PVC Conduit', 'Schedule 40, Gray', 3.85, 6.00, 80, 30, 'G2', 'Each', 'NEC 352', TRUE, TRUE, 1, 1, TRUE),
('0607', 'Cantex', 'PVC-40-100', '1" PVC Schedule 40 Conduit - 10ft', 'Conduit & Fittings', 'PVC Conduit', 'Schedule 40, Gray', 5.50, 8.50, 70, 25, 'G2', 'Each', 'NEC 352', TRUE, TRUE, 1, 1, TRUE),
('0608', 'Cantex', 'PVC-40-125', '1-1/4" PVC Schedule 40 Conduit - 10ft', 'Conduit & Fittings', 'PVC Conduit', 'Schedule 40, Gray', 7.50, 11.50, 50, 20, 'G2', 'Each', 'NEC 352', TRUE, FALSE, 1, 1, TRUE),
('0609', 'Cantex', 'PVC-40-150', '1-1/2" PVC Schedule 40 Conduit - 10ft', 'Conduit & Fittings', 'PVC Conduit', 'Schedule 40, Gray', 9.50, 14.50, 40, 15, 'G2', 'Each', 'NEC 352', TRUE, FALSE, 1, 1, TRUE),
('0610', 'Cantex', 'PVC-40-200', '2" PVC Schedule 40 Conduit - 10ft', 'Conduit & Fittings', 'PVC Conduit', 'Schedule 40, Gray', 13.50, 20.50, 35, 12, 'G2', 'Each', 'NEC 352', TRUE, FALSE, 1, 1, TRUE),

-- Liquid-Tight Flexible Conduit
('0611', 'Southwire', 'LTB-050-100', '1/2" Liquid-Tight Flex - 100ft Coil', 'Conduit & Fittings', 'Liquid-Tight', 'LFMC Type B', 48.00, 73.00, 15, 6, 'G3', 'Coil', 'NEC 350', TRUE, TRUE, 1, 1, TRUE),
('0612', 'Southwire', 'LTB-075-100', '3/4" Liquid-Tight Flex - 100ft Coil', 'Conduit & Fittings', 'Liquid-Tight', 'LFMC Type B', 68.00, 105.00, 12, 5, 'G3', 'Coil', 'NEC 350', TRUE, TRUE, 1, 1, TRUE),
('0613', 'Southwire', 'LTB-100-50', '1" Liquid-Tight Flex - 50ft Coil', 'Conduit & Fittings', 'Liquid-Tight', 'LFMC Type B', 58.00, 88.00, 10, 4, 'G3', 'Coil', 'NEC 350', TRUE, FALSE, 1, 1, TRUE),

-- EMT Fittings
('0614', 'RACO', '2801', '1/2" EMT Set Screw Connector - Steel', 'Conduit & Fittings', 'EMT Fittings', 'Set Screw Connector', 0.45, 0.85, 300, 100, 'G4', 'Each', 'NEC 358', TRUE, TRUE, 1, 1, TRUE),
('0615', 'RACO', '2803', '3/4" EMT Set Screw Connector - Steel', 'Conduit & Fittings', 'EMT Fittings', 'Set Screw Connector', 0.65, 1.15, 250, 90, 'G4', 'Each', 'NEC 358', TRUE, TRUE, 1, 1, TRUE),
('0616', 'RACO', '2805', '1" EMT Set Screw Connector - Steel', 'Conduit & Fittings', 'EMT Fittings', 'Set Screw Connector', 1.15, 1.90, 150, 55, 'G4', 'Each', 'NEC 358', TRUE, TRUE, 1, 1, TRUE),
('0617', 'RACO', '2701', '1/2" EMT Set Screw Coupling - Steel', 'Conduit & Fittings', 'EMT Fittings', 'Set Screw Coupling', 0.40, 0.75, 300, 100, 'G4', 'Each', 'NEC 358', TRUE, TRUE, 1, 1, TRUE),
('0618', 'RACO', '2703', '3/4" EMT Set Screw Coupling - Steel', 'Conduit & Fittings', 'EMT Fittings', 'Set Screw Coupling', 0.55, 1.00, 250, 90, 'G4', 'Each', 'NEC 358', TRUE, TRUE, 1, 1, TRUE),
('0619', 'RACO', '2705', '1" EMT Set Screw Coupling - Steel', 'Conduit & Fittings', 'EMT Fittings', 'Set Screw Coupling', 0.95, 1.60, 150, 55, 'G4', 'Each', 'NEC 358', TRUE, TRUE, 1, 1, TRUE),

-- PVC Fittings
('0620', 'Cantex', 'E950F', '1/2" PVC Terminal Adapter', 'Conduit & Fittings', 'PVC Fittings', 'Female Thread', 0.35, 0.65, 200, 75, 'G5', 'Each', 'NEC 352', TRUE, TRUE, 1, 1, TRUE),
('0621', 'Cantex', 'E950J', '3/4" PVC Terminal Adapter', 'Conduit & Fittings', 'PVC Fittings', 'Female Thread', 0.50, 0.90, 180, 65, 'G5', 'Each', 'NEC 352', TRUE, TRUE, 1, 1, TRUE),
('0622', 'Cantex', 'E950K', '1" PVC Terminal Adapter', 'Conduit & Fittings', 'PVC Fittings', 'Female Thread', 0.75, 1.30, 150, 55, 'G5', 'Each', 'NEC 352', TRUE, TRUE, 1, 1, TRUE),
('0623', 'Cantex', 'E943C', '1/2" PVC 90° Elbow', 'Conduit & Fittings', 'PVC Fittings', '90 Degree Sweep', 0.85, 1.50, 150, 55, 'G5', 'Each', 'NEC 352', TRUE, TRUE, 1, 1, TRUE),
('0624', 'Cantex', 'E943E', '3/4" PVC 90° Elbow', 'Conduit & Fittings', 'PVC Fittings', '90 Degree Sweep', 1.15, 1.90, 120, 45, 'G5', 'Each', 'NEC 352', TRUE, TRUE, 1, 1, TRUE);


-- ============================================================
-- CATEGORY 9: LIGHTING (20 items)
-- ============================================================

INSERT INTO inventory (item_id, brand, manufacturer_part_number, description, category, subcategory,
    wire_gauge, cost, sell_price, qty, min_stock, location,
    qty_per, nec_ref, ul_listed, commonly_used, primary_vendor_id, lead_time_days, active)
VALUES
-- LED Recessed Lighting - 4 inch
('0650', 'Halo', 'RL460WH6930R', '4" LED Recessed Downlight - 9W 3000K White', 'Lighting', 'LED Recessed', '650 Lumens, Dimmable', 12.50, 19.00, 80, 30, 'H1', 'Each', 'NEC 410', TRUE, TRUE, 1, 1, TRUE),
('0651', 'Halo', 'RL460WH6940R', '4" LED Recessed Downlight - 9W 4000K White', 'Lighting', 'LED Recessed', '650 Lumens, Dimmable', 12.50, 19.00, 60, 25, 'H1', 'Each', 'NEC 410', TRUE, FALSE, 1, 1, TRUE),
('0652', 'Halo', 'RL4069S1EWHR', '4" LED Color Selectable - 9W White', 'Lighting', 'LED Recessed', '650L, 3CCT, Dimmable', 16.50, 25.00, 70, 28, 'H1', 'Each', 'NEC 410', TRUE, TRUE, 1, 1, TRUE),

-- LED Recessed Lighting - 6 inch
('0653', 'Halo', 'RL560WH6930R', '6" LED Recessed Downlight - 10W 3000K White', 'Lighting', 'LED Recessed', '750 Lumens, Dimmable', 14.50, 22.00, 100, 40, 'H1', 'Each', 'NEC 410', TRUE, TRUE, 1, 1, TRUE),
('0654', 'Halo', 'RL560WH6940R', '6" LED Recessed Downlight - 10W 4000K White', 'Lighting', 'LED Recessed', '750 Lumens, Dimmable', 14.50, 22.00, 70, 30, 'H1', 'Each', 'NEC 410', TRUE, FALSE, 1, 1, TRUE),
('0655', 'Halo', 'RL5609S1EWHR', '6" LED Color Selectable - 10W White', 'Lighting', 'LED Recessed', '750L, 3CCT, Dimmable', 18.50, 28.00, 90, 35, 'H1', 'Each', 'NEC 410', TRUE, TRUE, 1, 1, TRUE),

-- LED Can Retrofit Kits
('0656', 'Commercial Electric', 'T24-DL4-30K', '4" Retrofit LED Downlight - 3000K', 'Lighting', 'LED Retrofit', '575 Lumens, Dimmable', 8.50, 13.50, 60, 25, 'H2', 'Each', 'NEC 410', TRUE, TRUE, 1, 1, TRUE),
('0657', 'Commercial Electric', 'T24-DL6-30K', '6" Retrofit LED Downlight - 3000K', 'Lighting', 'LED Retrofit', '850 Lumens, Dimmable', 10.50, 16.00, 70, 28, 'H2', 'Each', 'NEC 410', TRUE, TRUE, 1, 1, TRUE),
('0658', 'Halo', 'RL5609S1EWHR-DM', '5/6" Universal Retrofit - Color Select', 'Lighting', 'LED Retrofit', '850L, 3CCT, Dimmable', 16.00, 24.50, 50, 20, 'H2', 'Each', 'NEC 410', TRUE, TRUE, 1, 1, TRUE),

-- Outdoor LED Flood Lights
('0659', 'Lithonia', 'OLF2-40K-120-WH', '40W LED Flood Light - 4000K White', 'Lighting', 'LED Flood', '3600 Lumens, 120V', 38.00, 58.00, 40, 15, 'H3', 'Each', 'NEC 410', TRUE, TRUE, 1, 1, TRUE),
('0660', 'Lithonia', 'OLF2-20K-120-BZ', '20W LED Flood Light - 3000K Bronze', 'Lighting', 'LED Flood', '1800 Lumens, 120V', 28.00, 42.50, 35, 14, 'H3', 'Each', 'NEC 410', TRUE, TRUE, 1, 1, TRUE),
('0661', 'Lithonia', 'OLCS-15-WH-M4', '15W LED Wall Pack - 4000K White', 'Lighting', 'LED Wall Pack', '1350 Lumens, Dusk/Dawn', 42.00, 64.00, 25, 10, 'H3', 'Each', 'NEC 410', TRUE, FALSE, 1, 1, TRUE),

-- Ceiling Fixtures
('0662', 'Lithonia', 'FMLRL-11-14840', '11" LED Flush Mount - 3000K White', 'Lighting', 'Ceiling Fixtures', '1100 Lumens, 120V', 18.50, 28.00, 40, 15, 'H4', 'Each', 'NEC 410', TRUE, TRUE, 1, 1, TRUE),
('0663', 'Lithonia', 'FMLRL-14-14840', '14" LED Flush Mount - 3000K White', 'Lighting', 'Ceiling Fixtures', '1600 Lumens, 120V', 24.00, 36.50, 35, 14, 'H4', 'Each', 'NEC 410', TRUE, TRUE, 1, 1, TRUE),

-- Vanity Lights
('0664', 'Progress Lighting', 'P300048-009', '3-Light Vanity Bar - Brushed Nickel', 'Lighting', 'Vanity Lights', '100W Each Socket', 38.00, 58.00, 20, 8, 'H5', 'Each', 'NEC 410', TRUE, FALSE, 1, 2, TRUE),
('0665', 'Progress Lighting', 'P300047-009', '2-Light Vanity Bar - Brushed Nickel', 'Lighting', 'Vanity Lights', '100W Each Socket', 28.00, 42.50, 25, 10, 'H5', 'Each', 'NEC 410', TRUE, FALSE, 1, 2, TRUE),

-- LED Bulbs
('0666', 'Philips', '479576', 'LED A19 Bulb - 9W 3000K - 60W Equiv', 'Lighting', 'LED Bulbs', '800 Lumens, Dimmable', 2.50, 4.00, 200, 75, 'H6', 'Each', 'NEC 410', TRUE, TRUE, 1, 1, TRUE),
('0667', 'Philips', '479584', 'LED A19 Bulb - 9W 5000K - 60W Equiv', 'Lighting', 'LED Bulbs', '800 Lumens, Dimmable', 2.50, 4.00, 150, 60, 'H6', 'Each', 'NEC 410', TRUE, FALSE, 1, 1, TRUE),
('0668', 'Philips', '479717', 'LED BR30 Bulb - 9W 3000K - 65W Equiv', 'Lighting', 'LED Bulbs', '650 Lumens, Dimmable', 4.50, 7.00, 120, 50, 'H6', 'Each', 'NEC 410', TRUE, TRUE, 1, 1, TRUE),
('0669', 'Feit Electric', 'BR30DM/930CA', 'LED BR30 Bulb - 8.3W 3000K - 65W Equiv', 'Lighting', 'LED Bulbs', '650 Lumens, Dimmable', 4.00, 6.25, 100, 40, 'H6', 'Each', 'NEC 410', TRUE, TRUE, 1, 1, TRUE);


-- ============================================================
-- CATEGORY 10: WIRE MANAGEMENT & ACCESSORIES (25 items)
-- ============================================================

INSERT INTO inventory (item_id, brand, manufacturer_part_number, description, category, subcategory,
    wire_gauge, cost, sell_price, qty, min_stock, location,
    qty_per, nec_ref, ul_listed, commonly_used, primary_vendor_id, lead_time_days, active)
VALUES
-- Wire Nuts - Boxes
('0700', 'Ideal', '30-072', 'Red Wire Nuts - Box of 100', 'Accessories', 'Wire Connectors', '22-16 AWG', 8.50, 13.00, 50, 20, 'J1', 'Box-100', 'NEC 110.14', TRUE, TRUE, 1, 1, TRUE),
('0701', 'Ideal', '30-073', 'Yellow Wire Nuts - Box of 100', 'Accessories', 'Wire Connectors', '18-14 AWG', 8.50, 13.00, 60, 25, 'J1', 'Box-100', 'NEC 110.14', TRUE, TRUE, 1, 1, TRUE),
('0702', 'Ideal', '30-074', 'Orange Wire Nuts - Box of 100', 'Accessories', 'Wire Connectors', '18-12 AWG', 9.50, 14.50, 70, 30, 'J1', 'Box-100', 'NEC 110.14', TRUE, TRUE, 1, 1, TRUE),
('0703', 'Ideal', '30-1034', 'Blue Wire Nuts - Box of 100', 'Accessories', 'Wire Connectors', '12-10 AWG', 12.00, 18.50, 50, 20, 'J1', 'Box-100', 'NEC 110.14', TRUE, TRUE, 1, 1, TRUE),
('0704', 'Ideal', '30-1033', 'Gray Wing-Nuts - Box of 100', 'Accessories', 'Wire Connectors', '14-8 AWG', 14.00, 21.50, 40, 15, 'J1', 'Box-100', 'NEC 110.14', TRUE, TRUE, 1, 1, TRUE),
('0705', 'Ideal', '30-1032', 'Green Wire Nuts - Box of 100', 'Accessories', 'Wire Connectors', '14-10 AWG Ground', 9.50, 14.50, 45, 18, 'J1', 'Box-100', 'NEC 110.14', TRUE, TRUE, 1, 1, TRUE),

-- Wago Connectors
('0706', 'Wago', '221-412', '2-Port Lever Nuts - Box of 50', 'Accessories', 'Wire Connectors', '12-24 AWG', 18.00, 27.50, 40, 15, 'J2', 'Box-50', 'NEC 110.14', TRUE, TRUE, 1, 1, TRUE),
('0707', 'Wago', '221-413', '3-Port Lever Nuts - Box of 50', 'Accessories', 'Wire Connectors', '12-24 AWG', 22.00, 33.50, 50, 20, 'J2', 'Box-50', 'NEC 110.14', TRUE, TRUE, 1, 1, TRUE),
('0708', 'Wago', '221-415', '5-Port Lever Nuts - Box of 25', 'Accessories', 'Wire Connectors', '12-24 AWG', 16.00, 24.50, 35, 14, 'J2', 'Box-25', 'NEC 110.14', TRUE, TRUE, 1, 1, TRUE),

-- Cable Staples
('0709', 'Gardner Bender', 'GBS-1550', 'Romex Staples 1/2" - Box of 100', 'Accessories', 'Cable Management', 'For 14/2, 12/2 NM', 3.50, 5.50, 80, 30, 'J3', 'Box-100', 'NEC 334.30', TRUE, TRUE, 1, 1, TRUE),
('0710', 'Gardner Bender', 'GBS-1575', 'Romex Staples 3/4" - Box of 100', 'Accessories', 'Cable Management', 'For 10/2, 12/3 NM', 4.00, 6.25, 70, 28, 'J3', 'Box-100', 'NEC 334.30', TRUE, TRUE, 1, 1, TRUE),
('0711', 'Arlington', 'RP25-100', 'Insulated Staples - Box of 100', 'Accessories', 'Cable Management', 'Plastic Romex Staples', 5.50, 8.50, 60, 25, 'J3', 'Box-100', 'NEC 334.30', TRUE, TRUE, 1, 1, TRUE),

-- Zip Ties
('0712', 'Thomas & Betts', 'TY23M', '8" Cable Ties - Natural - 100pk', 'Accessories', 'Cable Management', '50lb Tensile Strength', 3.50, 5.50, 100, 40, 'J4', 'Box-100', NULL, TRUE, TRUE, 1, 1, TRUE),
('0713', 'Thomas & Betts', 'TY24M', '11" Cable Ties - Natural - 100pk', 'Accessories', 'Cable Management', '50lb Tensile Strength', 5.00, 7.75, 80, 30, 'J4', 'Box-100', NULL, TRUE, TRUE, 1, 1, TRUE),
('0714', 'Thomas & Betts', 'TY525M', '14" Cable Ties - Natural - 100pk', 'Accessories', 'Cable Management', '50lb Tensile Strength', 7.50, 11.50, 60, 25, 'J4', 'Box-100', NULL, TRUE, FALSE, 1, 1, TRUE),

-- Electrical Tape
('0715', '3M', 'Temflex-1700', '3M Temflex Vinyl Tape - Black - 3/4"x60ft', 'Accessories', 'Tape & Adhesives', 'UL Listed, 600V', 2.85, 4.50, 150, 60, 'J5', 'Roll', 'NEC 110.14', TRUE, TRUE, 1, 1, TRUE),
('0716', '3M', 'Temflex-1700-W', '3M Temflex Vinyl Tape - White - 3/4"x60ft', 'Accessories', 'Tape & Adhesives', 'UL Listed, 600V', 2.85, 4.50, 80, 30, 'J5', 'Roll', 'NEC 110.14', TRUE, FALSE, 1, 1, TRUE),
('0717', '3M', 'Temflex-2155', '3M Rubber Splicing Tape - Black - 3/4"x22ft', 'Accessories', 'Tape & Adhesives', 'Self-Fusing, 600V', 8.50, 13.00, 40, 15, 'J5', 'Roll', 'NEC 110.14', TRUE, FALSE, 1, 1, TRUE),

-- Anti-Oxidant Compound
('0718', 'Ideal', 'Noalox', 'Anti-Oxidant Compound - 4oz Tube', 'Accessories', 'Compounds', 'Aluminum Wire/Lugs', 8.00, 12.25, 50, 20, 'J6', 'Tube', 'NEC 110.14', TRUE, TRUE, 1, 1, TRUE),

-- Wire Markers & Labels
('0719', 'Brady', 'M-125-422', 'Wire Marker Book - Numbers 0-9', 'Accessories', 'Labels & Markers', '15 Pages Each Number', 12.00, 18.50, 25, 10, 'J7', 'Book', NULL, TRUE, FALSE, 1, 1, TRUE),
('0720', 'Brady', 'SCN06-PK', 'Self-Laminating Wire Markers - 25 Sheets', 'Accessories', 'Labels & Markers', 'Laser Printable', 18.00, 27.50, 20, 8, 'J7', 'Pack-25', NULL, TRUE, FALSE, 1, 2, TRUE),

-- Cable Pulling Lubricant
('0721', 'Ideal', 'Yellow 77', 'Cable Pulling Lubricant - 1 Quart', 'Accessories', 'Compounds', 'Wax-Based', 14.00, 21.50, 30, 12, 'J6', 'Quart', NULL, TRUE, TRUE, 1, 1, TRUE),
('0722', 'Ideal', 'Yellow 77-P', 'Cable Pulling Lubricant - 5 Gallon', 'Accessories', 'Compounds', 'Wax-Based', 125.00, 190.00, 5, 2, 'J6', 'Pail', NULL, TRUE, FALSE, 1, 2, TRUE),

-- Junction Box Fill Calculation Tool Items
('0723', 'Klein Tools', 'VDV999-063', 'Foam Ear Plugs - Box of 200', 'Accessories', 'Safety', 'NRR 33dB', 12.00, 18.50, 20, 8, 'J8', 'Box-200', NULL, TRUE, FALSE, 1, 1, TRUE),
('0724', 'Sharpie', '38262PP', 'Fine Point Marker - Black - 12pk', 'Accessories', 'Markers', 'Permanent', 8.50, 13.00, 30, 12, 'J7', 'Pack-12', NULL, TRUE, TRUE, 1, 1, TRUE);


-- ============================================================
-- CATEGORY 11: SPECIALTY ITEMS (15 items)
-- ============================================================

INSERT INTO inventory (item_id, brand, manufacturer_part_number, description, category, subcategory,
    voltage, wire_gauge, cost, sell_price, qty, min_stock, location,
    qty_per, nec_ref, ul_listed, commonly_used, primary_vendor_id, lead_time_days, active)
VALUES
-- Smoke Detectors
('0750', 'Kidde', 'i12060', 'Hardwired Smoke Alarm - AC/DC Backup', 'Specialty', 'Smoke Detectors', '120V', 'Ionization, Battery Backup', 14.50, 22.00, 60, 25, 'K1', 'Each', 'NEC 760', TRUE, TRUE, 1, 1, TRUE),
('0751', 'Kidde', 'i12080', 'Hardwired Smoke/CO Combo - AC/DC Backup', 'Specialty', 'Smoke Detectors', '120V', 'Ion + CO, Battery Backup', 28.00, 42.50, 40, 15, 'K1', 'Each', 'NEC 760', TRUE, TRUE, 1, 1, TRUE),
('0752', 'First Alert', 'BRK-7010B', 'Hardwired Smoke Alarm - Photoelectric', 'Specialty', 'Smoke Detectors', '120V', 'Photoelectric, Battery Backup', 16.00, 24.50, 50, 20, 'K1', 'Each', 'NEC 760', TRUE, TRUE, 1, 1, TRUE),
('0753', 'First Alert', 'BRK-3120B', 'Hardwired Smoke Alarm - Dual Sensor', 'Specialty', 'Smoke Detectors', '120V', 'Ion + Photo, Battery Backup', 22.00, 33.50, 35, 14, 'K1', 'Each', 'NEC 760', TRUE, FALSE, 1, 1, TRUE),

-- Carbon Monoxide Detectors
('0754', 'Kidde', 'KN-COSM-IBA', 'Hardwired CO Detector - AC/DC Backup', 'Specialty', 'CO Detectors', '120V', 'Electrochemical Sensor', 24.00, 36.50, 40, 15, 'K2', 'Each', 'NEC 760', TRUE, TRUE, 1, 1, TRUE),
('0755', 'First Alert', 'CO615', 'Plug-In CO Detector - Battery Backup', 'Specialty', 'CO Detectors', '120V', 'Electrochemical, Digital', 22.00, 33.50, 30, 12, 'K2', 'Each', NULL, TRUE, FALSE, 1, 1, TRUE),

-- Doorbell Transformers
('0756', 'Honeywell', 'AT72D1683', 'Doorbell Transformer - 16V 30VA', 'Specialty', 'Doorbells', '120V', '16V AC Output, 30VA', 8.50, 13.00, 70, 28, 'K3', 'Each', 'NEC 725', TRUE, TRUE, 1, 1, TRUE),
('0757', 'Honeywell', 'AT140A1000', 'Doorbell Transformer - 16V 10VA', 'Specialty', 'Doorbells', '120V', '16V AC Output, 10VA', 6.50, 10.00, 60, 25, 'K3', 'Each', 'NEC 725', TRUE, TRUE, 1, 1, TRUE),
('0758', 'Edwards', '598', 'Doorbell Transformer - 16V 20VA', 'Specialty', 'Doorbells', '120V', '16V AC Output, 20VA', 12.00, 18.50, 50, 20, 'K3', 'Each', 'NEC 725', TRUE, FALSE, 1, 1, TRUE),

-- Timers & Controls
('0759', 'Woods', '59008WD', 'In-Wall Digital Timer - 7-Day', 'Specialty', 'Timers', '120V', 'Digital, 1800W', 18.00, 27.50, 30, 12, 'K4', 'Each', 'NEC 404', TRUE, FALSE, 1, 1, TRUE),
('0760', 'Intermatic', 'T101', 'Mechanical Timer - 40A DPST', 'Specialty', 'Timers', '120/240V', 'Indoor/Outdoor, 40A', 28.00, 42.50, 25, 10, 'K4', 'Each', 'NEC 404', TRUE, FALSE, 1, 1, TRUE),
('0761', 'Woods', '50008WD', 'Outdoor Timer - 2-Outlet', 'Specialty', 'Timers', '120V', 'Grounded, Weather Resist', 14.00, 21.50, 35, 14, 'K4', 'Each', NULL, TRUE, FALSE, 1, 1, TRUE),

-- Photocells & Light Sensors
('0762', 'Intermatic', 'K4121C', 'Photoelectric Control - 120V', 'Specialty', 'Light Controls', '120V', 'Dusk-to-Dawn, 1000W', 12.00, 18.50, 45, 18, 'K5', 'Each', 'NEC 410', TRUE, TRUE, 1, 1, TRUE),
('0763', 'Intermatic', 'K4223C', 'Photoelectric Control - 208-277V', 'Specialty', 'Light Controls', '208-277V', 'Dusk-to-Dawn, 1000W', 16.00, 24.50, 30, 12, 'K5', 'Each', 'NEC 410', TRUE, FALSE, 1, 1, TRUE),
('0764', 'Woods', '59408WD', 'Indoor/Outdoor Digital Timer', 'Specialty', 'Timers', '120V', '1800W, Astronomic', 24.00, 36.50, 25, 10, 'K4', 'Each', 'NEC 404', TRUE, FALSE, 1, 1, TRUE);

-- Add final comment
COMMENT ON TABLE inventory IS 'Comprehensive inventory - 200+ items from Granite City Electric and Concord Electrical Supply';

-- ============================================================
-- INVENTORY SUMMARY
-- ============================================================
-- Total Items Added: 200+
--
-- Category Breakdown:
-- - AFCI/GFCI Breakers: 25 items (0300-0324)
-- - Wire & Cable: 34 items (0400-0433)
-- - Devices - Outlets: 30 items (0450-0479)
-- - Devices - Switches: 25 items (0500-0524)
-- - Boxes & Covers: 30 items (0550-0579)
-- - Conduit & Fittings: 25 items (0600-0624)
-- - Lighting: 20 items (0650-0669)
-- - Accessories: 25 items (0700-0724)
-- - Specialty: 15 items (0750-0764)
--
-- TOTAL NEW ITEMS: 229
--
-- Combined with existing inventory_seed_data.sql (63 items):
-- GRAND TOTAL: 292+ ITEMS
-- ============================================================
