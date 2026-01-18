-- Migration: Create vendor_returns table for Return-to-Vendor Rack feature
-- Date: 2026-01-09
-- Description: Tracks items placed on the return rack awaiting vendor return

-- Create the vendor_returns table
CREATE TABLE IF NOT EXISTS vendor_returns (
    id SERIAL PRIMARY KEY,
    inventory_id INTEGER REFERENCES inventory(id) ON DELETE SET NULL,
    vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    return_reason VARCHAR(50) NOT NULL CHECK (return_reason IN ('defective', 'overstock', 'wrong_item', 'damaged', 'expired')),
    return_reason_notes TEXT,
    source_location VARCHAR(50),  -- 'warehouse', 'van_101', etc.
    placed_on_rack_date TIMESTAMP DEFAULT NOW(),
    placed_by VARCHAR(50) REFERENCES users(username),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'returned', 'credited', 'cancelled')),
    return_authorization VARCHAR(100),  -- RA number from vendor
    credit_amount NUMERIC(10,2),
    credited_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_vendor_returns_status ON vendor_returns(status);
CREATE INDEX IF NOT EXISTS idx_vendor_returns_vendor_id ON vendor_returns(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_returns_inventory_id ON vendor_returns(inventory_id);
CREATE INDEX IF NOT EXISTS idx_vendor_returns_placed_date ON vendor_returns(placed_on_rack_date);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_vendor_returns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_vendor_returns_updated_at ON vendor_returns;
CREATE TRIGGER trigger_vendor_returns_updated_at
    BEFORE UPDATE ON vendor_returns
    FOR EACH ROW
    EXECUTE FUNCTION update_vendor_returns_updated_at();

-- Verify the table was created
SELECT 'vendor_returns table created successfully' as status;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'vendor_returns'
ORDER BY ordinal_position;
