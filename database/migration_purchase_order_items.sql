-- Migration: Add purchase_order_items table and enhance purchase_orders
-- Date: 2024-12-19

-- ============================================================
-- ENHANCE PURCHASE_ORDERS TABLE
-- ============================================================

-- Add approval workflow columns
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS needs_approval BOOLEAN DEFAULT FALSE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_by VARCHAR(50) REFERENCES users(username);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add projection tracking
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS triggered_by_projection BOOLEAN DEFAULT FALSE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS projection_start_date DATE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS projection_end_date DATE;

-- Add created_by if not exists
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS created_by VARCHAR(50) REFERENCES users(username);

-- ============================================================
-- CREATE PURCHASE_ORDER_ITEMS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id SERIAL PRIMARY KEY,
    purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    inventory_id INTEGER NOT NULL REFERENCES inventory(id),

    -- Quantity and pricing
    quantity_ordered INTEGER NOT NULL,
    unit_cost DECIMAL(10,2) NOT NULL,
    line_total DECIMAL(10,2) GENERATED ALWAYS AS (quantity_ordered * unit_cost) STORED,

    -- Receipt tracking
    quantity_received INTEGER DEFAULT 0,
    received_date TIMESTAMP,
    received_by VARCHAR(50) REFERENCES users(username),

    -- Link to job materials that need this item
    linked_work_order_ids JSONB DEFAULT '[]'::jsonb,

    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for purchase_order_items
CREATE INDEX IF NOT EXISTS idx_poi_purchase_order ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_poi_inventory ON purchase_order_items(inventory_id);
CREATE INDEX IF NOT EXISTS idx_poi_received ON purchase_order_items(received_date) WHERE received_date IS NOT NULL;

-- ============================================================
-- INDEXES FOR PROJECTION QUERIES
-- ============================================================

-- Index for finding materials needed for scheduled jobs
CREATE INDEX IF NOT EXISTS idx_jmu_status_inventory ON job_materials_used(status, inventory_id)
    WHERE status IN ('planned', 'allocated');

-- Index for work order date filtering
CREATE INDEX IF NOT EXISTS idx_wo_start_date_status ON work_orders(start_date, status)
    WHERE status IN ('pending', 'scheduled', 'in_progress');
