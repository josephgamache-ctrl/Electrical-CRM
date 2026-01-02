-- Part 2: AFCI, GFCI, and Dual-Function Breakers (MA Code Critical!)

INSERT INTO inventory (item_id, brand, manufacturer_part_number, description, category, subcategory,
    voltage, amperage, num_poles, cost, sell_price, qty, min_stock, location,
    qty_per, ma_code_ref, nec_ref, ul_listed, arc_fault_required, gfci_required, commonly_used,
    primary_vendor_id, lead_time_days, active)
VALUES
-- AFCI Breakers (REQUIRED in MA for most circuits!)
('0300', 'Square D', 'QO115CAFIC', '15A 1-Pole Combination AFCI Circuit Breaker', 'Circuit Breakers', 'AFCI Breakers', '120V', '15A', 1, 38.00, 58.00, 30, 15, 'C1', 'Each', 'MA NEC 210.12', 'NEC 210.12', TRUE, TRUE, FALSE, TRUE, 1, 1, TRUE),
('0301', 'Square D', 'QO120CAFIC', '20A 1-Pole Combination AFCI Circuit Breaker', 'Circuit Breakers', 'AFCI Breakers', '120V', '20A', 1, 38.00, 58.00, 40, 20, 'C1', 'Each', 'MA NEC 210.12', 'NEC 210.12', TRUE, TRUE, FALSE, TRUE, 1, 1, TRUE),
('0302', 'Siemens', 'Q115AFC', '15A 1-Pole Combination AFCI Circuit Breaker', 'Circuit Breakers', 'AFCI Breakers', '120V', '15A', 1, 36.00, 55.00, 25, 12, 'C1', 'Each', 'MA NEC 210.12', 'NEC 210.12', TRUE, TRUE, FALSE, TRUE, 1, 1, TRUE),
('0303', 'Siemens', 'Q120AFC', '20A 1-Pole Combination AFCI Circuit Breaker', 'Circuit Breakers', 'AFCI Breakers', '120V', '20A', 1, 36.00, 55.00, 35, 18, 'C1', 'Each', 'MA NEC 210.12', 'NEC 210.12', TRUE, TRUE, FALSE, TRUE, 1, 1, TRUE),
('0304', 'Eaton', 'BRCAF115', '15A 1-Pole Combination AFCI Circuit Breaker', 'Circuit Breakers', 'AFCI Breakers', '120V', '15A', 1, 34.00, 52.00, 28, 14, 'C1', 'Each', 'MA NEC 210.12', 'NEC 210.12', TRUE, TRUE, FALSE, TRUE, 2, 1, TRUE),
('0305', 'Eaton', 'BRCAF120', '20A 1-Pole Combination AFCI Circuit Breaker', 'Circuit Breakers', 'AFCI Breakers', '120V', '20A', 1, 34.00, 52.00, 38, 19, 'C1', 'Each', 'MA NEC 210.12', 'NEC 210.12', TRUE, TRUE, FALSE, TRUE, 2, 1, TRUE),

-- GFCI Breakers
('0310', 'Square D', 'QO120GFI', '20A 1-Pole GFCI Circuit Breaker', 'Circuit Breakers', 'GFCI Breakers', '120V', '20A', 1, 48.00, 73.00, 20, 10, 'C2', 'Each', 'MA NEC 210.8', 'NEC 210.8', TRUE, FALSE, TRUE, TRUE, 1, 1, TRUE),
('0311', 'Square D', 'QO220GFI', '20A 2-Pole GFCI Circuit Breaker', 'Circuit Breakers', 'GFCI Breakers', '240V', '20A', 2, 68.00, 103.00, 15, 8, 'C2', 'Each', 'MA NEC 210.8', 'NEC 210.8', TRUE, FALSE, TRUE, TRUE, 1, 1, TRUE),
('0312', 'Square D', 'QO250GFI', '50A 2-Pole GFCI Circuit Breaker - For Hot Tubs/Spas', 'Circuit Breakers', 'GFCI Breakers', '240V', '50A', 2, 95.00, 145.00, 8, 4, 'C2', 'Each', 'MA NEC 680', 'NEC 680.32', TRUE, FALSE, TRUE, FALSE, 1, 2, TRUE),
('0313', 'Siemens', 'Q120GF', '20A 1-Pole GFCI Circuit Breaker', 'Circuit Breakers', 'GFCI Breakers', '120V', '20A', 1, 45.00, 69.00, 18, 9, 'C2', 'Each', 'MA NEC 210.8', 'NEC 210.8', TRUE, FALSE, TRUE, FALSE, 1, 1, TRUE),
('0314', 'Eaton', 'BRGF120', '20A 1-Pole GFCI Circuit Breaker', 'Circuit Breakers', 'GFCI Breakers', '120V', '20A', 1, 44.00, 67.00, 17, 8, 'C2', 'Each', 'MA NEC 210.8', 'NEC 210.8', TRUE, FALSE, TRUE, FALSE, 2, 1, TRUE),

-- Dual-Function AFCI/GFCI Breakers (BEST FOR MA!)
('0320', 'Square D', 'QO120DFIC', '20A 1-Pole Dual Function AFCI/GFCI Breaker', 'Circuit Breakers', 'Dual Function', '120V', '20A', 1, 58.00, 88.00, 25, 12, 'C3', 'Each', 'MA NEC 210.12/210.8', 'NEC 210.12 & 210.8', TRUE, TRUE, TRUE, TRUE, 1, 1, TRUE),
('0321', 'Square D', 'QO115DFIC', '15A 1-Pole Dual Function AFCI/GFCI Breaker', 'Circuit Breakers', 'Dual Function', '120V', '15A', 1, 58.00, 88.00, 20, 10, 'C3', 'Each', 'MA NEC 210.12/210.8', 'NEC 210.12 & 210.8', TRUE, TRUE, TRUE, FALSE, 1, 1, TRUE),
('0322', 'Siemens', 'Q120DF', '20A 1-Pole Dual Function AFCI/GFCI Breaker', 'Circuit Breakers', 'Dual Function', '120V', '20A', 1, 55.00, 84.00, 22, 11, 'C3', 'Each', 'MA NEC 210.12/210.8', 'NEC 210.12 & 210.8', TRUE, TRUE, TRUE, TRUE, 1, 1, TRUE),
('0323', 'Eaton', 'BRDF120', '20A 1-Pole Dual Function AFCI/GFCI Breaker', 'Circuit Breakers', 'Dual Function', '120V', '20A', 1, 53.00, 81.00, 21, 10, 'C3', 'Each', 'MA NEC 210.12/210.8', 'NEC 210.12 & 210.8', TRUE, TRUE, TRUE, TRUE, 2, 1, TRUE);
