-- Add materials to all 10 work orders

-- Job 33 (WO-2024-1020): Panel Upgrade - COMPLETED
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, quantity_allocated, quantity_used, unit_cost, unit_price, status, allocated_by, installed_by)
SELECT 33, id, 1, 1, 1, cost, sell_price, 'used', 'nraffery', 'nraffery' FROM inventory WHERE item_id = '0001';
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, quantity_allocated, quantity_used, unit_cost, unit_price, status, allocated_by, installed_by)
SELECT 33, id, 1, 1, 1, cost, sell_price, 'used', 'nraffery', 'nraffery' FROM inventory WHERE item_id = '0002';
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, quantity_allocated, quantity_used, unit_cost, unit_price, status, allocated_by, installed_by)
SELECT 33, id, 8, 8, 8, cost, sell_price, 'used', 'nraffery', 'nraffery' FROM inventory WHERE item_id = '0301';
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, quantity_allocated, quantity_used, unit_cost, unit_price, status, allocated_by, installed_by)
SELECT 33, id, 6, 6, 6, cost, sell_price, 'used', 'nraffery', 'nraffery' FROM inventory WHERE item_id = '0300';

-- Job 34 (WO-2024-1021): Kitchen Remodel - COMPLETED
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, quantity_allocated, quantity_used, unit_cost, unit_price, status, allocated_by, installed_by)
SELECT 34, id, 6, 6, 6, cost, sell_price, 'used', 'nraffery', 'nraffery' FROM inventory WHERE item_id = '0462';
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, quantity_allocated, quantity_used, unit_cost, unit_price, status, allocated_by, installed_by)
SELECT 34, id, 4, 4, 4, cost, sell_price, 'used', 'nraffery', 'nraffery' FROM inventory WHERE item_id = '0308';
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, quantity_allocated, quantity_used, unit_cost, unit_price, status, allocated_by, installed_by)
SELECT 34, id, 2, 2, 2, cost, sell_price, 'used', 'nraffery', 'nraffery' FROM inventory WHERE item_id = '0402';
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, quantity_allocated, quantity_used, unit_cost, unit_price, status, allocated_by, installed_by)
SELECT 34, id, 1, 1, 1, cost, sell_price, 'used', 'nraffery', 'nraffery' FROM inventory WHERE item_id = '0401';

-- Job 35 (WO-2024-1022): Commercial Lighting - COMPLETED
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, quantity_allocated, quantity_used, unit_cost, unit_price, status, allocated_by, installed_by)
SELECT 35, id, 24, 24, 24, cost, sell_price, 'used', 'tfisher', 'tfisher' FROM inventory WHERE item_id = '0655';

-- Job 36 (WO-2024-1023): EV Charger - COMPLETED
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, quantity_allocated, quantity_used, unit_cost, unit_price, status, allocated_by, installed_by)
SELECT 36, id, 1, 1, 1, cost, sell_price, 'used', 'nraffery', 'nraffery' FROM inventory WHERE item_id = '0306';
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, quantity_allocated, quantity_used, unit_cost, unit_price, status, allocated_by, installed_by)
SELECT 36, id, 75, 75, 75, cost, sell_price, 'used', 'nraffery', 'nraffery' FROM inventory WHERE item_id = '0408';

-- Job 37 (WO-2024-1024): Bathroom Remodel - COMPLETED
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, quantity_allocated, quantity_used, unit_cost, unit_price, status, allocated_by, installed_by)
SELECT 37, id, 2, 2, 2, cost, sell_price, 'used', 'tfisher', 'tfisher' FROM inventory WHERE item_id = '0462';
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, quantity_allocated, quantity_used, unit_cost, unit_price, status, allocated_by, installed_by)
SELECT 37, id, 3, 3, 3, cost, sell_price, 'used', 'tfisher', 'tfisher' FROM inventory WHERE item_id = '0655';
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, quantity_allocated, quantity_used, unit_cost, unit_price, status, allocated_by, installed_by)
SELECT 37, id, 1, 1, 1, cost, sell_price, 'used', 'tfisher', 'tfisher' FROM inventory WHERE item_id = '0401';

-- Job 28 (WO-2024-1025): New Construction - SCHEDULED
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, unit_cost, unit_price, status)
SELECT 28, id, 1, cost, sell_price, 'planned' FROM inventory WHERE item_id = '0001';
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, unit_cost, unit_price, status)
SELECT 28, id, 1, cost, sell_price, 'planned' FROM inventory WHERE item_id = '0002';
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, unit_cost, unit_price, status)
SELECT 28, id, 20, cost, sell_price, 'planned' FROM inventory WHERE item_id = '0301';
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, unit_cost, unit_price, status)
SELECT 28, id, 15, cost, sell_price, 'planned' FROM inventory WHERE item_id = '0300';
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, unit_cost, unit_price, status)
SELECT 28, id, 8, cost, sell_price, 'planned' FROM inventory WHERE item_id = '0401';
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, unit_cost, unit_price, status)
SELECT 28, id, 4, cost, sell_price, 'planned' FROM inventory WHERE item_id = '0404';

-- Job 29 (WO-2024-1026): Office Buildout - SCHEDULED
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, unit_cost, unit_price, status)
SELECT 29, id, 8, cost, sell_price, 'planned' FROM inventory WHERE item_id = '0308';
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, unit_cost, unit_price, status)
SELECT 29, id, 20, cost, sell_price, 'planned' FROM inventory WHERE item_id = '0503';
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, unit_cost, unit_price, status)
SELECT 29, id, 12, cost, sell_price, 'planned' FROM inventory WHERE item_id = '0655';

-- Job 30 (WO-2024-1027): Generator - SCHEDULED
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, unit_cost, unit_price, status)
SELECT 30, id, 1, cost, sell_price, 'planned' FROM inventory WHERE item_id = '0002';
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, unit_cost, unit_price, status)
SELECT 30, id, 50, cost, sell_price, 'planned' FROM inventory WHERE item_id = '0408';

-- Job 31 (WO-2024-1028): Apartment Service - SCHEDULED
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, unit_cost, unit_price, status)
SELECT 31, id, 3, cost, sell_price, 'planned' FROM inventory WHERE item_id = '0301';
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, unit_cost, unit_price, status)
SELECT 31, id, 2, cost, sell_price, 'planned' FROM inventory WHERE item_id = '0462';
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, unit_cost, unit_price, status)
SELECT 31, id, 1, cost, sell_price, 'planned' FROM inventory WHERE item_id = '0659';

-- Job 32 (WO-2024-1029): Smart Home - SCHEDULED
INSERT INTO job_materials_used (work_order_id, inventory_id, quantity_needed, unit_cost, unit_price, status)
SELECT 32, id, 12, cost, sell_price, 'planned' FROM inventory WHERE item_id = '0503';
