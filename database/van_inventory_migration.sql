-- ============================================================
-- Van Inventory Migration
-- Adds work vans as mobile inventory locations
-- Run this migration on the production database
-- ============================================================

-- ============================================================
-- 1. CREATE WORK_VANS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS work_vans (
    id SERIAL PRIMARY KEY,
    van_number VARCHAR(20) UNIQUE NOT NULL,  -- VAN-1, TRUCK-2
    name VARCHAR(100),                        -- "Joey's Van", "Service Truck #1"

    -- Assignment
    assigned_to VARCHAR(50) REFERENCES users(username),

    -- Status
    active BOOLEAN DEFAULT TRUE,

    -- Metadata
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for work_vans
CREATE INDEX IF NOT EXISTS idx_work_vans_van_number ON work_vans(van_number);
CREATE INDEX IF NOT EXISTS idx_work_vans_assigned_to ON work_vans(assigned_to);
CREATE INDEX IF NOT EXISTS idx_work_vans_active ON work_vans(active);

-- ============================================================
-- 2. CREATE VAN_INVENTORY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS van_inventory (
    id SERIAL PRIMARY KEY,
    van_id INTEGER NOT NULL REFERENCES work_vans(id) ON DELETE CASCADE,
    inventory_id INTEGER NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,

    -- Quantity Management
    quantity INTEGER DEFAULT 0 CHECK (quantity >= 0),
    min_quantity INTEGER DEFAULT 0,  -- Restock threshold for this van

    -- Tracking
    last_counted_date DATE,
    last_restocked_date DATE,
    last_restocked_by VARCHAR(50) REFERENCES users(username),

    -- Metadata
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ensure unique item per van
    UNIQUE(van_id, inventory_id)
);

-- Indexes for van_inventory
CREATE INDEX IF NOT EXISTS idx_van_inventory_van_id ON van_inventory(van_id);
CREATE INDEX IF NOT EXISTS idx_van_inventory_inventory_id ON van_inventory(inventory_id);
CREATE INDEX IF NOT EXISTS idx_van_inventory_low_stock ON van_inventory(quantity, min_quantity);

-- ============================================================
-- 3. ALTER EXISTING TABLES
-- ============================================================

-- Add default van preference to users table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'default_van_id'
    ) THEN
        ALTER TABLE users ADD COLUMN default_van_id INTEGER REFERENCES work_vans(id);
    END IF;
END $$;

-- Add van reference to job_materials_used (tracks which van material was loaded from)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'job_materials_used' AND column_name = 'loaded_from_van_id'
    ) THEN
        ALTER TABLE job_materials_used ADD COLUMN loaded_from_van_id INTEGER REFERENCES work_vans(id);
    END IF;
END $$;

-- Add van references to stock_transactions for transfer tracking
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'stock_transactions' AND column_name = 'from_van_id'
    ) THEN
        ALTER TABLE stock_transactions ADD COLUMN from_van_id INTEGER REFERENCES work_vans(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'stock_transactions' AND column_name = 'to_van_id'
    ) THEN
        ALTER TABLE stock_transactions ADD COLUMN to_van_id INTEGER REFERENCES work_vans(id);
    END IF;
END $$;

-- ============================================================
-- 4. CREATE TRIGGERS
-- ============================================================

-- Auto-update last_updated timestamp for work_vans
DROP TRIGGER IF EXISTS update_work_vans_timestamp ON work_vans;
CREATE TRIGGER update_work_vans_timestamp
    BEFORE UPDATE ON work_vans
    FOR EACH ROW EXECUTE FUNCTION update_last_updated_column();

-- Auto-update last_updated timestamp for van_inventory
DROP TRIGGER IF EXISTS update_van_inventory_timestamp ON van_inventory;
CREATE TRIGGER update_van_inventory_timestamp
    BEFORE UPDATE ON van_inventory
    FOR EACH ROW EXECUTE FUNCTION update_last_updated_column();

-- ============================================================
-- 5. INSERT SAMPLE VANS (Optional - comment out for production)
-- ============================================================
-- INSERT INTO work_vans (van_number, name, notes) VALUES
--     ('VAN-1', 'Service Van 1', 'Primary service vehicle'),
--     ('VAN-2', 'Service Van 2', 'Secondary service vehicle'),
--     ('TRUCK-1', 'Work Truck 1', 'Heavy equipment truck')
-- ON CONFLICT (van_number) DO NOTHING;

-- ============================================================
-- 6. VERIFICATION QUERIES
-- ============================================================
-- Run these to verify the migration succeeded:

-- Check tables exist
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name IN ('work_vans', 'van_inventory');

-- Check columns added to users
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'users' AND column_name = 'default_van_id';

-- Check columns added to job_materials_used
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'job_materials_used' AND column_name = 'loaded_from_van_id';

-- Check columns added to stock_transactions
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'stock_transactions' AND column_name IN ('from_van_id', 'to_van_id');

COMMIT;
