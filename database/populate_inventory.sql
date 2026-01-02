-- Comprehensive Electrical Inventory Population
-- Items commonly available from CES and Granite City Electric
-- All items set to qty=50 for initial stock

-- Clear existing inventory (comment out if you want to keep existing items)
-- TRUNCATE TABLE inventory RESTART IDENTITY CASCADE;

-- WIRE & CABLE
INSERT INTO inventory (item_id, brand, description, category, subcategory, cost, sell_price, qty, commonly_used, active, created_by) VALUES
('THHN-12-BLK-500', 'Southwire', 'THHN 12 AWG Solid Black 500ft', 'Wire & Cable', 'Building Wire', 45.00, 75.00, 50, true, true, 'joseph'),
('THHN-12-WHT-500', 'Southwire', 'THHN 12 AWG Solid White 500ft', 'Wire & Cable', 'Building Wire', 45.00, 75.00, 50, true, true, 'joseph'),
('THHN-12-RED-500', 'Southwire', 'THHN 12 AWG Solid Red 500ft', 'Wire & Cable', 'Building Wire', 45.00, 75.00, 50, true, true, 'joseph'),
('THHN-12-GRN-500', 'Southwire', 'THHN 12 AWG Solid Green 500ft', 'Wire & Cable', 'Building Wire', 45.00, 75.00, 50, true, true, 'joseph'),
('THHN-10-BLK-500', 'Southwire', 'THHN 10 AWG Solid Black 500ft', 'Wire & Cable', 'Building Wire', 72.00, 120.00, 50, true, true, 'joseph'),
('THHN-10-WHT-500', 'Southwire', 'THHN 10 AWG Solid White 500ft', 'Wire & Cable', 'Building Wire', 72.00, 120.00, 50, true, true, 'joseph'),
('THHN-10-RED-500', 'Southwire', 'THHN 10 AWG Solid Red 500ft', 'Wire & Cable', 'Building Wire', 72.00, 120.00, 50, true, true, 'joseph'),
('THHN-8-BLK-250', 'Southwire', 'THHN 8 AWG Stranded Black 250ft', 'Wire & Cable', 'Building Wire', 95.00, 158.00, 50, true, true, 'joseph'),
('THHN-6-BLK-250', 'Southwire', 'THHN 6 AWG Stranded Black 250ft', 'Wire & Cable', 'Building Wire', 145.00, 242.00, 50, true, true, 'joseph'),
('THHN-4-BLK-250', 'Southwire', 'THHN 4 AWG Stranded Black 250ft', 'Wire & Cable', 'Building Wire', 225.00, 375.00, 50, false, true, 'joseph'),
('ROMEX-12-2-250', 'Southwire', 'NM-B 12/2 w/Ground 250ft', 'Wire & Cable', 'Romex', 89.00, 148.00, 50, true, true, 'joseph'),
('ROMEX-12-3-250', 'Southwire', 'NM-B 12/3 w/Ground 250ft', 'Wire & Cable', 'Romex', 125.00, 208.00, 50, true, true, 'joseph'),
('ROMEX-14-2-250', 'Southwire', 'NM-B 14/2 w/Ground 250ft', 'Wire & Cable', 'Romex', 65.00, 108.00, 50, true, true, 'joseph'),
('ROMEX-14-3-250', 'Southwire', 'NM-B 14/3 w/Ground 250ft', 'Wire & Cable', 'Romex', 95.00, 158.00, 50, true, true, 'joseph'),
('MC-12-2-250', 'Southwire', 'MC Cable 12/2 Armored 250ft', 'Wire & Cable', 'MC Cable', 185.00, 308.00, 50, true, true, 'joseph'),
('MC-12-3-250', 'Southwire', 'MC Cable 12/3 Armored 250ft', 'Wire & Cable', 'MC Cable', 245.00, 408.00, 50, true, true, 'joseph'),
('MC-10-3-250', 'Southwire', 'MC Cable 10/3 Armored 250ft', 'Wire & Cable', 'MC Cable', 385.00, 642.00, 50, false, true, 'joseph'),
('UF-12-2-250', 'Southwire', 'UF-B 12/2 Underground 250ft', 'Wire & Cable', 'Underground', 125.00, 208.00, 50, true, true, 'joseph');

-- CONDUIT & FITTINGS
INSERT INTO inventory (item_id, brand, description, category, subcategory, cost, sell_price, qty, commonly_used, active, created_by) VALUES
('EMT-0.5-10', 'Allied Tube', 'EMT 1/2" x 10ft', 'Conduit', 'EMT', 3.25, 5.42, 50, true, true, 'joseph'),
('EMT-0.75-10', 'Allied Tube', 'EMT 3/4" x 10ft', 'Conduit', 'EMT', 4.75, 7.92, 50, true, true, 'joseph'),
('EMT-1.0-10', 'Allied Tube', 'EMT 1" x 10ft', 'Conduit', 'EMT', 7.25, 12.08, 50, true, true, 'joseph'),
('EMT-1.25-10', 'Allied Tube', 'EMT 1-1/4" x 10ft', 'Conduit', 'EMT', 11.50, 19.17, 50, true, true, 'joseph'),
('EMT-1.5-10', 'Allied Tube', 'EMT 1-1/2" x 10ft', 'Conduit', 'EMT', 14.25, 23.75, 50, true, true, 'joseph'),
('EMT-2.0-10', 'Allied Tube', 'EMT 2" x 10ft', 'Conduit', 'EMT', 22.50, 37.50, 50, true, true, 'joseph'),
('PVC-0.5-10', 'Carlon', 'PVC Schedule 40 1/2" x 10ft', 'Conduit', 'PVC', 2.85, 4.75, 50, true, true, 'joseph'),
('PVC-0.75-10', 'Carlon', 'PVC Schedule 40 3/4" x 10ft', 'Conduit', 'PVC', 3.95, 6.58, 50, true, true, 'joseph'),
('PVC-1.0-10', 'Carlon', 'PVC Schedule 40 1" x 10ft', 'Conduit', 'PVC', 5.50, 9.17, 50, true, true, 'joseph'),
('PVC-1.25-10', 'Carlon', 'PVC Schedule 40 1-1/4" x 10ft', 'Conduit', 'PVC', 7.85, 13.08, 50, true, true, 'joseph'),
('PVC-1.5-10', 'Carlon', 'PVC Schedule 40 1-1/2" x 10ft', 'Conduit', 'PVC', 9.50, 15.83, 50, true, true, 'joseph'),
('PVC-2.0-10', 'Carlon', 'PVC Schedule 40 2" x 10ft', 'Conduit', 'PVC', 14.25, 23.75, 50, true, true, 'joseph'),
('FLEX-0.5-25', 'AFC Cable', 'Liquidtight Flex 1/2" x 25ft', 'Conduit', 'Flexible', 18.50, 30.83, 50, true, true, 'joseph'),
('FLEX-0.75-25', 'AFC Cable', 'Liquidtight Flex 3/4" x 25ft', 'Conduit', 'Flexible', 24.75, 41.25, 50, true, true, 'joseph'),
('FLEX-1.0-25', 'AFC Cable', 'Liquidtight Flex 1" x 25ft', 'Conduit', 'Flexible', 38.50, 64.17, 50, true, true, 'joseph'),
('EMT-CONN-0.5', 'Raco', 'EMT Set Screw Connector 1/2"', 'Conduit Fittings', 'Connectors', 0.45, 0.75, 50, true, true, 'joseph'),
('EMT-CONN-0.75', 'Raco', 'EMT Set Screw Connector 3/4"', 'Conduit Fittings', 'Connectors', 0.65, 1.08, 50, true, true, 'joseph'),
('EMT-CONN-1.0', 'Raco', 'EMT Set Screw Connector 1"', 'Conduit Fittings', 'Connectors', 1.15, 1.92, 50, true, true, 'joseph'),
('EMT-COUP-0.5', 'Raco', 'EMT Set Screw Coupling 1/2"', 'Conduit Fittings', 'Couplings', 0.38, 0.63, 50, true, true, 'joseph'),
('EMT-COUP-0.75', 'Raco', 'EMT Set Screw Coupling 3/4"', 'Conduit Fittings', 'Couplings', 0.52, 0.87, 50, true, true, 'joseph'),
('EMT-COUP-1.0', 'Raco', 'EMT Set Screw Coupling 1"', 'Conduit Fittings', 'Couplings', 0.95, 1.58, 50, true, true, 'joseph');

-- CIRCUIT BREAKERS
INSERT INTO inventory (item_id, brand, description, category, subcategory, cost, sell_price, qty, commonly_used, active, created_by) VALUES
('BR-15-1P', 'Square D', 'Homeline 15A 1-Pole Breaker', 'Circuit Breakers', 'Single Pole', 3.25, 5.42, 50, true, true, 'joseph'),
('BR-20-1P', 'Square D', 'Homeline 20A 1-Pole Breaker', 'Circuit Breakers', 'Single Pole', 3.25, 5.42, 50, true, true, 'joseph'),
('BR-30-1P', 'Square D', 'Homeline 30A 1-Pole Breaker', 'Circuit Breakers', 'Single Pole', 5.75, 9.58, 50, true, true, 'joseph'),
('BR-15-2P', 'Square D', 'Homeline 15A 2-Pole Breaker', 'Circuit Breakers', 'Double Pole', 9.50, 15.83, 50, true, true, 'joseph'),
('BR-20-2P', 'Square D', 'Homeline 20A 2-Pole Breaker', 'Circuit Breakers', 'Double Pole', 9.50, 15.83, 50, true, true, 'joseph'),
('BR-30-2P', 'Square D', 'Homeline 30A 2-Pole Breaker', 'Circuit Breakers', 'Double Pole', 12.75, 21.25, 50, true, true, 'joseph'),
('BR-40-2P', 'Square D', 'Homeline 40A 2-Pole Breaker', 'Circuit Breakers', 'Double Pole', 14.25, 23.75, 50, true, true, 'joseph'),
('BR-50-2P', 'Square D', 'Homeline 50A 2-Pole Breaker', 'Circuit Breakers', 'Double Pole', 16.50, 27.50, 50, true, true, 'joseph'),
('BR-15-GFCI', 'Square D', 'Homeline 15A GFCI Breaker', 'Circuit Breakers', 'GFCI', 38.50, 64.17, 50, true, true, 'joseph'),
('BR-20-GFCI', 'Square D', 'Homeline 20A GFCI Breaker', 'Circuit Breakers', 'GFCI', 38.50, 64.17, 50, true, true, 'joseph'),
('BR-15-AFCI', 'Square D', 'Homeline 15A AFCI Breaker', 'Circuit Breakers', 'AFCI', 42.00, 70.00, 50, true, true, 'joseph'),
('BR-20-AFCI', 'Square D', 'Homeline 20A AFCI Breaker', 'Circuit Breakers', 'AFCI', 42.00, 70.00, 50, true, true, 'joseph'),
('BR-20-CAFCI', 'Square D', 'Homeline 20A CAFCI Breaker', 'Circuit Breakers', 'AFCI/GFCI', 52.00, 86.67, 50, true, true, 'joseph'),
('QO-15-1P', 'Square D', 'QO 15A 1-Pole Breaker', 'Circuit Breakers', 'Single Pole', 8.50, 14.17, 50, true, true, 'joseph'),
('QO-20-1P', 'Square D', 'QO 20A 1-Pole Breaker', 'Circuit Breakers', 'Single Pole', 8.50, 14.17, 50, true, true, 'joseph'),
('QO-20-2P', 'Square D', 'QO 20A 2-Pole Breaker', 'Circuit Breakers', 'Double Pole', 18.75, 31.25, 50, true, true, 'joseph');

-- ELECTRICAL BOXES
INSERT INTO inventory (item_id, brand, description, category, subcategory, cost, sell_price, qty, commonly_used, active, created_by) VALUES
('BOX-4SQ-1.5', 'Raco', '4" Square Box 1-1/2" Deep', 'Boxes', 'Junction Boxes', 1.15, 1.92, 50, true, true, 'joseph'),
('BOX-4SQ-2.125', 'Raco', '4" Square Box 2-1/8" Deep', 'Boxes', 'Junction Boxes', 1.45, 2.42, 50, true, true, 'joseph'),
('BOX-4SQ-CVR-BLK', 'Raco', '4" Square Blank Cover', 'Boxes', 'Covers', 0.35, 0.58, 50, true, true, 'joseph'),
('BOX-4SQ-CVR-1G', 'Raco', '4" Square 1-Gang Cover', 'Boxes', 'Covers', 0.55, 0.92, 50, true, true, 'joseph'),
('BOX-1G-OLD', 'Carlon', 'Old Work 1-Gang Box', 'Boxes', 'Device Boxes', 0.85, 1.42, 50, true, true, 'joseph'),
('BOX-2G-OLD', 'Carlon', 'Old Work 2-Gang Box', 'Boxes', 'Device Boxes', 1.25, 2.08, 50, true, true, 'joseph'),
('BOX-1G-NEW', 'Carlon', 'New Work 1-Gang Box w/Nails', 'Boxes', 'Device Boxes', 0.65, 1.08, 50, true, true, 'joseph'),
('BOX-2G-NEW', 'Carlon', 'New Work 2-Gang Box w/Nails', 'Boxes', 'Device Boxes', 0.95, 1.58, 50, true, true, 'joseph'),
('BOX-OCTAGON', 'Raco', 'Octagon Box 4" 1-1/2" Deep', 'Boxes', 'Junction Boxes', 0.95, 1.58, 50, true, true, 'joseph'),
('BOX-HANDY', 'Raco', 'Handy Box 2x4 1-1/2" Deep', 'Boxes', 'Utility Boxes', 0.75, 1.25, 50, true, true, 'joseph'),
('BOX-WP-1G', 'TayMac', 'Weatherproof Box 1-Gang', 'Boxes', 'Weatherproof', 3.50, 5.83, 50, true, true, 'joseph'),
('BOX-WP-2G', 'TayMac', 'Weatherproof Box 2-Gang', 'Boxes', 'Weatherproof', 5.25, 8.75, 50, true, true, 'joseph');

-- SWITCHES & OUTLETS
INSERT INTO inventory (item_id, brand, description, category, subcategory, cost, sell_price, qty, commonly_used, active, created_by) VALUES
('SW-15A-WHT', 'Leviton', '15A Single Pole Switch White', 'Wiring Devices', 'Switches', 0.85, 1.42, 50, true, true, 'joseph'),
('SW-15A-IVY', 'Leviton', '15A Single Pole Switch Ivory', 'Wiring Devices', 'Switches', 0.85, 1.42, 50, true, true, 'joseph'),
('SW-15A-BRN', 'Leviton', '15A Single Pole Switch Brown', 'Wiring Devices', 'Switches', 0.85, 1.42, 50, false, true, 'joseph'),
('SW-3WAY-WHT', 'Leviton', '15A 3-Way Switch White', 'Wiring Devices', 'Switches', 1.25, 2.08, 50, true, true, 'joseph'),
('SW-4WAY-WHT', 'Leviton', '15A 4-Way Switch White', 'Wiring Devices', 'Switches', 2.75, 4.58, 50, true, true, 'joseph'),
('SW-DIMM-WHT', 'Lutron', 'Diva 600W Dimmer White', 'Wiring Devices', 'Dimmers', 12.50, 20.83, 50, true, true, 'joseph'),
('SW-DIMM-IVY', 'Lutron', 'Diva 600W Dimmer Ivory', 'Wiring Devices', 'Dimmers', 12.50, 20.83, 50, true, true, 'joseph'),
('REC-15A-WHT', 'Leviton', '15A Duplex Receptacle White', 'Wiring Devices', 'Receptacles', 0.65, 1.08, 50, true, true, 'joseph'),
('REC-15A-IVY', 'Leviton', '15A Duplex Receptacle Ivory', 'Wiring Devices', 'Receptacles', 0.65, 1.08, 50, true, true, 'joseph'),
('REC-20A-WHT', 'Leviton', '20A Duplex Receptacle White', 'Wiring Devices', 'Receptacles', 1.15, 1.92, 50, true, true, 'joseph'),
('REC-GFCI-WHT', 'Leviton', '15A GFCI Receptacle White', 'Wiring Devices', 'GFCI Receptacles', 9.50, 15.83, 50, true, true, 'joseph'),
('REC-GFCI-IVY', 'Leviton', '15A GFCI Receptacle Ivory', 'Wiring Devices', 'GFCI Receptacles', 9.50, 15.83, 50, true, true, 'joseph'),
('REC-GFCI-20A', 'Leviton', '20A GFCI Receptacle White', 'Wiring Devices', 'GFCI Receptacles', 11.75, 19.58, 50, true, true, 'joseph'),
('REC-USB-WHT', 'Leviton', '15A USB Receptacle White', 'Wiring Devices', 'USB Receptacles', 16.50, 27.50, 50, true, true, 'joseph'),
('REC-WEATHER', 'Leviton', '15A Weather Resistant Receptacle', 'Wiring Devices', 'Receptacles', 2.25, 3.75, 50, true, true, 'joseph'),
('REC-TR-WHT', 'Leviton', '15A Tamper Resistant Receptacle White', 'Wiring Devices', 'Receptacles', 1.15, 1.92, 50, true, true, 'joseph');

-- WIRE CONNECTORS & ACCESSORIES
INSERT INTO inventory (item_id, brand, description, category, subcategory, cost, sell_price, qty, commonly_used, active, created_by) VALUES
('WIRENUT-BLUE', 'Ideal', 'Blue Wire Nut 22-16 AWG (Box of 100)', 'Connectors', 'Wire Nuts', 4.25, 7.08, 50, true, true, 'joseph'),
('WIRENUT-ORG', 'Ideal', 'Orange Wire Nut 18-12 AWG (Box of 100)', 'Connectors', 'Wire Nuts', 5.50, 9.17, 50, true, true, 'joseph'),
('WIRENUT-YEL', 'Ideal', 'Yellow Wire Nut 14-12 AWG (Box of 100)', 'Connectors', 'Wire Nuts', 6.75, 11.25, 50, true, true, 'joseph'),
('WIRENUT-RED', 'Ideal', 'Red Wire Nut 12-10 AWG (Box of 100)', 'Connectors', 'Wire Nuts', 8.50, 14.17, 50, true, true, 'joseph'),
('WIRENUT-GRY', 'Ideal', 'Gray Wire Nut 6-2 AWG (Box of 50)', 'Connectors', 'Wire Nuts', 14.25, 23.75, 50, true, true, 'joseph'),
('CRIMP-RING', 'Ideal', 'Ring Terminal Assortment Kit', 'Connectors', 'Terminals', 18.50, 30.83, 50, true, true, 'joseph'),
('CRIMP-SPADE', 'Ideal', 'Spade Terminal Assortment Kit', 'Connectors', 'Terminals', 18.50, 30.83, 50, true, true, 'joseph'),
('BUSHING-0.5', 'Halex', 'Insulated Bushing 1/2"', 'Fittings', 'Bushings', 0.18, 0.30, 50, true, true, 'joseph'),
('BUSHING-0.75', 'Halex', 'Insulated Bushing 3/4"', 'Fittings', 'Bushings', 0.22, 0.37, 50, true, true, 'joseph'),
('BUSHING-1.0', 'Halex', 'Insulated Bushing 1"', 'Fittings', 'Bushings', 0.35, 0.58, 50, true, true, 'joseph'),
('CLAMP-0.5', 'Halex', 'Cable Clamp 1/2" NM', 'Fittings', 'Clamps', 0.25, 0.42, 50, true, true, 'joseph'),
('CLAMP-0.75', 'Halex', 'Cable Clamp 3/4" NM', 'Fittings', 'Clamps', 0.32, 0.53, 50, true, true, 'joseph'),
('STAPLE-ROMEX', 'Gardner Bender', 'Romex Staples 1/2" (Box of 100)', 'Fasteners', 'Staples', 3.50, 5.83, 50, true, true, 'joseph'),
('STRAP-1HOLE', 'Minerallac', '1-Hole EMT Strap 1/2"', 'Fasteners', 'Straps', 0.15, 0.25, 50, true, true, 'joseph'),
('STRAP-2HOLE', 'Minerallac', '2-Hole EMT Strap 1/2"', 'Fasteners', 'Straps', 0.22, 0.37, 50, true, true, 'joseph');

-- PANELS & LOAD CENTERS
INSERT INTO inventory (item_id, brand, description, category, subcategory, cost, sell_price, qty, commonly_used, active, created_by) VALUES
('PANEL-100A-20', 'Square D', 'Homeline 100A Main Breaker Panel 20-Space', 'Panels', 'Load Centers', 125.00, 208.33, 50, true, true, 'joseph'),
('PANEL-100A-30', 'Square D', 'Homeline 100A Main Breaker Panel 30-Space', 'Panels', 'Load Centers', 165.00, 275.00, 50, true, true, 'joseph'),
('PANEL-200A-40', 'Square D', 'Homeline 200A Main Breaker Panel 40-Space', 'Panels', 'Load Centers', 285.00, 475.00, 50, true, true, 'joseph'),
('PANEL-100A-SUB', 'Square D', 'Homeline 100A Sub-Panel 20-Space', 'Panels', 'Sub Panels', 95.00, 158.33, 50, true, true, 'joseph'),
('PANEL-200A-OUT', 'Square D', 'Homeline 200A Outdoor Panel', 'Panels', 'Outdoor Panels', 325.00, 541.67, 50, false, true, 'joseph');

-- LIGHTING
INSERT INTO inventory (item_id, brand, description, category, subcategory, cost, sell_price, qty, commonly_used, active, created_by) VALUES
('LED-A19-60W', 'Philips', 'LED A19 9W (60W Equiv) 2700K', 'Lighting', 'LED Bulbs', 1.85, 3.08, 50, true, true, 'joseph'),
('LED-A19-100W', 'Philips', 'LED A19 14W (100W Equiv) 2700K', 'Lighting', 'LED Bulbs', 3.25, 5.42, 50, true, true, 'joseph'),
('LED-BR30-65W', 'Philips', 'LED BR30 10W (65W Equiv) 2700K', 'Lighting', 'LED Bulbs', 4.50, 7.50, 50, true, true, 'joseph'),
('LED-PAR38-90W', 'Philips', 'LED PAR38 13W (90W Equiv) 3000K', 'Lighting', 'LED Bulbs', 8.75, 14.58, 50, true, true, 'joseph'),
('LED-4IN-RETRO', 'Commercial Electric', 'LED 4" Retrofit Downlight 10W', 'Lighting', 'Recessed', 8.50, 14.17, 50, true, true, 'joseph'),
('LED-6IN-RETRO', 'Commercial Electric', 'LED 6" Retrofit Downlight 13W', 'Lighting', 'Recessed', 11.25, 18.75, 50, true, true, 'joseph'),
('FIXTURE-4FT-LED', 'Lithonia', 'LED 4ft Shop Light 4000lm', 'Lighting', 'Commercial', 28.50, 47.50, 50, true, true, 'joseph'),
('FIXTURE-8FT-LED', 'Lithonia', 'LED 8ft Shop Light 8000lm', 'Lighting', 'Commercial', 52.00, 86.67, 50, false, true, 'joseph'),
('KEYLESS-PORCELAIN', 'Leviton', 'Porcelain Keyless Lampholder', 'Lighting', 'Lampholders', 1.45, 2.42, 50, true, true, 'joseph'),
('PULLCHAIN-PORCELAIN', 'Leviton', 'Porcelain Pull Chain Lampholder', 'Lighting', 'Lampholders', 2.15, 3.58, 50, true, true, 'joseph');

-- GROUNDING & BONDING
INSERT INTO inventory (item_id, brand, description, category, subcategory, cost, sell_price, qty, commonly_used, active, created_by) VALUES
('GRD-ROD-8FT', 'Erico', 'Ground Rod 5/8" x 8ft Copper', 'Grounding', 'Ground Rods', 14.50, 24.17, 50, true, true, 'joseph'),
('GRD-CLAMP-ROD', 'Erico', 'Ground Rod Clamp 5/8" Bronze', 'Grounding', 'Clamps', 2.85, 4.75, 50, true, true, 'joseph'),
('GRD-CLAMP-WATER', 'Erico', 'Water Pipe Ground Clamp 1/2"-1"', 'Grounding', 'Clamps', 3.50, 5.83, 50, true, true, 'joseph'),
('GRD-WIRE-6', 'Southwire', 'Bare Copper Ground Wire #6 250ft', 'Grounding', 'Wire', 95.00, 158.33, 50, true, true, 'joseph'),
('GRD-WIRE-4', 'Southwire', 'Bare Copper Ground Wire #4 250ft', 'Grounding', 'Wire', 165.00, 275.00, 50, false, true, 'joseph'),
('BOND-BUSHING-0.5', 'Erico', 'Grounding Bushing 1/2"', 'Grounding', 'Bushings', 2.15, 3.58, 50, true, true, 'joseph'),
('BOND-BUSHING-0.75', 'Erico', 'Grounding Bushing 3/4"', 'Grounding', 'Bushings', 2.65, 4.42, 50, true, true, 'joseph'),
('BOND-BUSHING-1.0', 'Erico', 'Grounding Bushing 1"', 'Grounding', 'Bushings', 3.50, 5.83, 50, true, true, 'joseph');

-- TAPE & SUPPLIES
INSERT INTO inventory (item_id, brand, description, category, subcategory, cost, sell_price, qty, commonly_used, active, created_by) VALUES
('TAPE-ELECT-BLK', '3M', 'Electrical Tape 3/4" x 66ft Black', 'Supplies', 'Tape', 1.25, 2.08, 50, true, true, 'joseph'),
('TAPE-ELECT-WHT', '3M', 'Electrical Tape 3/4" x 66ft White', 'Supplies', 'Tape', 1.25, 2.08, 50, true, true, 'joseph'),
('TAPE-ELECT-RED', '3M', 'Electrical Tape 3/4" x 66ft Red', 'Supplies', 'Tape', 1.25, 2.08, 50, true, true, 'joseph'),
('TAPE-DUCT', '3M', 'Duct Tape 2" x 60yd Silver', 'Supplies', 'Tape', 4.50, 7.50, 50, true, true, 'joseph'),
('CABLETIES-8IN', 'Gardner Bender', 'Cable Ties 8" Black (100pk)', 'Supplies', 'Cable Management', 3.25, 5.42, 50, true, true, 'joseph'),
('CABLETIES-14IN', 'Gardner Bender', 'Cable Ties 14" Black (50pk)', 'Supplies', 'Cable Management', 4.50, 7.50, 50, true, true, 'joseph'),
('WIREPULL-LUB', 'Ideal', 'Wire Pulling Lubricant 1qt', 'Supplies', 'Lubricants', 8.50, 14.17, 50, true, true, 'joseph'),
('ANTIOXIDANT', 'Ideal', 'Noalox Anti-Oxidant 4oz', 'Supplies', 'Compounds', 6.75, 11.25, 50, true, true, 'joseph'),
('LABEL-WIRE', 'Brady', 'Wire Marker Book A-Z', 'Supplies', 'Labels', 12.50, 20.83, 50, true, true, 'joseph');

-- TOOLS & TESTERS
INSERT INTO inventory (item_id, brand, description, category, subcategory, cost, sell_price, qty, commonly_used, active, created_by) VALUES
('TESTER-NCVT', 'Klein', 'Non-Contact Voltage Tester', 'Tools', 'Testers', 18.50, 30.83, 50, true, true, 'joseph'),
('TESTER-PLUG', 'Klein', 'GFCI Receptacle Tester', 'Tools', 'Testers', 8.50, 14.17, 50, true, true, 'joseph'),
('TESTER-MULTI', 'Klein', 'Multimeter MM400', 'Tools', 'Testers', 42.00, 70.00, 50, true, true, 'joseph'),
('FISH-TAPE-50', 'Klein', 'Fish Tape 50ft Steel', 'Tools', 'Wire Pulling', 28.50, 47.50, 50, true, true, 'joseph'),
('STRIPPER-WIRE', 'Klein', 'Wire Stripper/Cutter 10-18 AWG', 'Tools', 'Hand Tools', 22.50, 37.50, 50, true, true, 'joseph'),
('PLIERS-LINEMAN', 'Klein', 'Lineman Pliers 9"', 'Tools', 'Hand Tools', 24.75, 41.25, 50, true, true, 'joseph'),
('PLIERS-NEEDLE', 'Klein', 'Needle Nose Pliers 8"', 'Tools', 'Hand Tools', 18.50, 30.83, 50, true, true, 'joseph'),
('DRIVER-11IN1', 'Klein', '11-in-1 Screwdriver/Nut Driver', 'Tools', 'Hand Tools', 28.50, 47.50, 50, true, true, 'joseph'),
('DRILL-BIT-SET', 'Milwaukee', 'Drill Bit Set Thunderbolt 29pc', 'Tools', 'Drill Bits', 32.00, 53.33, 50, true, true, 'joseph'),
('HOLE-SAW-KIT', 'Milwaukee', 'Hole Saw Kit 15pc', 'Tools', 'Hole Saws', 85.00, 141.67, 50, true, true, 'joseph');

-- SPECIALTY ITEMS
INSERT INTO inventory (item_id, brand, description, category, subcategory, cost, sell_price, qty, commonly_used, active, created_by) VALUES
('SMOKE-DETECTOR', 'Kidde', 'Smoke Detector Hardwired w/Battery', 'Safety', 'Detectors', 18.50, 30.83, 50, true, true, 'joseph'),
('CO-DETECTOR', 'Kidde', 'Carbon Monoxide Detector Hardwired', 'Safety', 'Detectors', 28.50, 47.50, 50, true, true, 'joseph'),
('DOORBELL-TRANS', 'Honeywell', 'Doorbell Transformer 16V 30VA', 'Transformers', 'Doorbell', 12.50, 20.83, 50, true, true, 'joseph'),
('THERMOSTAT-PROG', 'Honeywell', 'Programmable Thermostat 7-Day', 'Controls', 'Thermostats', 52.00, 86.67, 50, true, true, 'joseph'),
('CEILING-FAN', 'Hunter', 'Ceiling Fan 52" White w/Light', 'Fans', 'Ceiling Fans', 85.00, 141.67, 50, false, true, 'joseph'),
('EXHAUST-FAN', 'Broan', 'Bathroom Exhaust Fan 50CFM', 'Fans', 'Exhaust Fans', 24.75, 41.25, 50, true, true, 'joseph'),
('TIMER-WALL', 'Intermatic', 'Digital Wall Timer Switch', 'Controls', 'Timers', 28.50, 47.50, 50, true, true, 'joseph'),
('MOTION-SENSOR', 'Leviton', 'Occupancy Sensor Switch', 'Controls', 'Sensors', 32.00, 53.33, 50, true, true, 'joseph'),
('PHOTOCELL', 'Intermatic', 'Photocell Light Control 120V', 'Controls', 'Photocells', 8.50, 14.17, 50, true, true, 'joseph'),
('SURGE-PROTECTOR', 'Eaton', 'Whole House Surge Protector', 'Protection', 'Surge Protection', 125.00, 208.33, 50, true, true, 'joseph');

-- ADDITIONAL WIRE TYPES
INSERT INTO inventory (item_id, brand, description, category, subcategory, cost, sell_price, qty, commonly_used, active, created_by) VALUES
('COAX-RG6-1000', 'Southwire', 'RG6 Coaxial Cable 1000ft Black', 'Wire & Cable', 'Low Voltage', 45.00, 75.00, 50, true, true, 'joseph'),
('CAT6-1000', 'Southwire', 'CAT6 UTP Cable 1000ft Blue', 'Wire & Cable', 'Data Cable', 95.00, 158.33, 50, true, true, 'joseph'),
('DOORBELL-18-2', 'Southwire', 'Doorbell Wire 18/2 250ft', 'Wire & Cable', 'Low Voltage', 28.50, 47.50, 50, true, true, 'joseph'),
('SPEAKER-16-2', 'Southwire', 'Speaker Wire 16/2 250ft', 'Wire & Cable', 'Low Voltage', 32.00, 53.33, 50, true, true, 'joseph'),
('THHN-14-BLK-500', 'Southwire', 'THHN 14 AWG Solid Black 500ft', 'Wire & Cable', 'Building Wire', 32.00, 53.33, 50, true, true, 'joseph'),
('THHN-14-WHT-500', 'Southwire', 'THHN 14 AWG Solid White 500ft', 'Wire & Cable', 'Building Wire', 32.00, 53.33, 50, true, true, 'joseph'),
('THHN-14-RED-500', 'Southwire', 'THHN 14 AWG Solid Red 500ft', 'Wire & Cable', 'Building Wire', 32.00, 53.33, 50, true, true, 'joseph');

-- ADDITIONAL BREAKERS & PANELS
INSERT INTO inventory (item_id, brand, description, category, subcategory, cost, sell_price, qty, commonly_used, active, created_by) VALUES
('BR-60-2P', 'Square D', 'Homeline 60A 2-Pole Breaker', 'Circuit Breakers', 'Double Pole', 18.50, 30.83, 50, true, true, 'joseph'),
('BR-70-2P', 'Square D', 'Homeline 70A 2-Pole Breaker', 'Circuit Breakers', 'Double Pole', 22.50, 37.50, 50, false, true, 'joseph'),
('BR-100-2P', 'Square D', 'Homeline 100A 2-Pole Breaker', 'Circuit Breakers', 'Double Pole', 32.00, 53.33, 50, true, true, 'joseph'),
('PANEL-COVER-20', 'Square D', 'Homeline Panel Cover 20-Space', 'Panels', 'Accessories', 12.50, 20.83, 50, true, true, 'joseph'),
('PANEL-FILLER', 'Square D', 'Homeline Panel Filler Plate', 'Panels', 'Accessories', 1.85, 3.08, 50, true, true, 'joseph');

-- JUNCTION BOX ACCESSORIES
INSERT INTO inventory (item_id, brand, description, category, subcategory, cost, sell_price, qty, commonly_used, active, created_by) VALUES
('BOX-EXTENDER-1G', 'Raco', '1-Gang Box Extender', 'Boxes', 'Accessories', 1.45, 2.42, 50, true, true, 'joseph'),
('BOX-EXTENDER-2G', 'Raco', '2-Gang Box Extender', 'Boxes', 'Accessories', 2.15, 3.58, 50, true, true, 'joseph'),
('BOX-SUPPORT', 'Caddy', 'Ceiling Fan/Fixture Support Box', 'Boxes', 'Support Boxes', 8.50, 14.17, 50, true, true, 'joseph'),
('PANCAKE-BOX', 'Raco', 'Pancake Box 4" Round 1/2" Deep', 'Boxes', 'Junction Boxes', 1.25, 2.08, 50, true, true, 'joseph');

-- OUTDOOR/WEATHERPROOF
INSERT INTO inventory (item_id, brand, description, category, subcategory, cost, sell_price, qty, commonly_used, active, created_by) VALUES
('WP-COVER-1G-VT', 'TayMac', 'Weatherproof Cover 1-Gang Vertical', 'Boxes', 'Weatherproof', 3.25, 5.42, 50, true, true, 'joseph'),
('WP-COVER-1G-HZ', 'TayMac', 'Weatherproof Cover 1-Gang Horizontal', 'Boxes', 'Weatherproof', 3.25, 5.42, 50, true, true, 'joseph'),
('WP-COVER-2G', 'TayMac', 'Weatherproof Cover 2-Gang', 'Boxes', 'Weatherproof', 5.50, 9.17, 50, true, true, 'joseph'),
('REC-WP-WHT', 'Leviton', 'Weather Resistant Receptacle White', 'Wiring Devices', 'Receptacles', 2.85, 4.75, 50, true, true, 'joseph');

SELECT 'Inventory population complete! Total items added.' as status;
