-- Add time entries for completed jobs only

-- Job 33 (WO-2024-1020): Panel Upgrade - 2024-11-25 - nraffery 8.25 hrs
INSERT INTO time_entries (work_order_id, employee_username, work_date, hours_worked, billable_rate, pay_rate, notes, created_by, time_type)
VALUES (33, 'nraffery', '2024-11-25', 8.25, 125.00, 35.00, 'Panel upgrade - full day', 'joseph', 'job');

-- Job 34 (WO-2024-1021): Kitchen Remodel - 2024-11-27 - nraffery 9.25 hrs, tfisher 9.25 hrs
INSERT INTO time_entries (work_order_id, employee_username, work_date, hours_worked, billable_rate, pay_rate, notes, created_by, time_type)
VALUES (34, 'nraffery', '2024-11-27', 9.25, 125.00, 35.00, 'Kitchen remodel electrical - lead', 'joseph', 'job');
INSERT INTO time_entries (work_order_id, employee_username, work_date, hours_worked, billable_rate, pay_rate, notes, created_by, time_type)
VALUES (34, 'tfisher', '2024-11-27', 9.25, 95.00, 28.00, 'Kitchen remodel electrical - helper', 'joseph', 'job');

-- Job 35 (WO-2024-1022): Commercial Lighting - 2024-12-02 - tfisher 11.25 hrs, nraffery 11.25 hrs
INSERT INTO time_entries (work_order_id, employee_username, work_date, hours_worked, billable_rate, pay_rate, notes, created_by, time_type)
VALUES (35, 'tfisher', '2024-12-02', 11.25, 125.00, 28.00, 'LED lighting retrofit - lead', 'joseph', 'job');
INSERT INTO time_entries (work_order_id, employee_username, work_date, hours_worked, billable_rate, pay_rate, notes, created_by, time_type)
VALUES (35, 'nraffery', '2024-12-02', 11.25, 95.00, 35.00, 'LED lighting retrofit - helper', 'joseph', 'job');

-- Job 36 (WO-2024-1023): EV Charger - 2024-12-05 - nraffery 5.25 hrs
INSERT INTO time_entries (work_order_id, employee_username, work_date, hours_worked, billable_rate, pay_rate, notes, created_by, time_type)
VALUES (36, 'nraffery', '2024-12-05', 5.25, 125.00, 35.00, 'Tesla Wall Connector install', 'joseph', 'job');

-- Job 37 (WO-2024-1024): Bathroom Remodel - 2024-12-09 - tfisher 6.50 hrs
INSERT INTO time_entries (work_order_id, employee_username, work_date, hours_worked, billable_rate, pay_rate, notes, created_by, time_type)
VALUES (37, 'tfisher', '2024-12-09', 6.50, 125.00, 28.00, 'Master bath remodel electrical', 'joseph', 'job');

-- Add some shop time and travel time for variety
INSERT INTO time_entries (employee_username, work_date, hours_worked, pay_rate, notes, created_by, time_type)
VALUES ('nraffery', '2024-11-26', 4.00, 35.00, 'Shop organization and inventory', 'joseph', 'shop');
INSERT INTO time_entries (employee_username, work_date, hours_worked, pay_rate, notes, created_by, time_type)
VALUES ('tfisher', '2024-12-03', 2.00, 28.00, 'Picking up materials from supplier', 'joseph', 'travel');
INSERT INTO time_entries (employee_username, work_date, hours_worked, pay_rate, notes, created_by, time_type)
VALUES ('nraffery', '2024-12-10', 3.00, 35.00, 'Safety training', 'joseph', 'training');
