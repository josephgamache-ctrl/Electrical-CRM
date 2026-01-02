-- Migration: Quote/Estimate System
-- Date: 2024-12-22
-- Description: Adds quotes/estimates functionality with Good/Better/Best pricing tiers

-- ============================================================
-- 1. QUOTES TABLE - Main Quote/Estimate Document
-- ============================================================
CREATE TABLE IF NOT EXISTS quotes (
    id SERIAL PRIMARY KEY,
    quote_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    customer_site_id INTEGER REFERENCES customer_sites(id),

    -- Job Information
    title VARCHAR(200) NOT NULL,
    job_description TEXT,
    scope_of_work TEXT,
    service_address TEXT,
    service_city VARCHAR(100),
    service_state VARCHAR(2) DEFAULT 'MA',
    service_zip VARCHAR(10),

    -- Job Type (matches work_orders)
    job_type VARCHAR(50) DEFAULT 'service_call',

    -- Totals (auto-calculated from line items)
    labor_subtotal DECIMAL(10, 2) DEFAULT 0.00,
    material_subtotal DECIMAL(10, 2) DEFAULT 0.00,
    other_charges DECIMAL(10, 2) DEFAULT 0.00,

    subtotal DECIMAL(10, 2) DEFAULT 0.00,
    discount_percent DECIMAL(5, 2) DEFAULT 0.00,
    discount_amount DECIMAL(10, 2) DEFAULT 0.00,

    tax_rate DECIMAL(5, 4) DEFAULT 0.0625,
    tax_amount DECIMAL(10, 2) DEFAULT 0.00,
    total_amount DECIMAL(10, 2) DEFAULT 0.00,

    -- Quote Dates
    quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until DATE,
    estimated_start_date DATE,
    estimated_duration_days INTEGER,

    -- Status Workflow: draft -> sent -> viewed -> approved/declined -> converted/expired
    status VARCHAR(20) DEFAULT 'draft',

    -- Customer Approval
    customer_approved BOOLEAN DEFAULT FALSE,
    customer_approved_at TIMESTAMP,
    customer_approved_by VARCHAR(100),
    customer_signature TEXT,
    customer_notes TEXT,
    selected_tier VARCHAR(20),

    -- Internal
    internal_notes TEXT,
    terms_and_conditions TEXT,

    -- Conversion to Work Order
    converted_to_work_order_id INTEGER REFERENCES work_orders(id),
    converted_at TIMESTAMP,

    -- Audit
    created_by VARCHAR(50) NOT NULL REFERENCES users(username),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(50) REFERENCES users(username),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,
    viewed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quotes_number ON quotes(quote_number);
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_date ON quotes(quote_date);

-- ============================================================
-- 2. QUOTE LINE ITEMS TABLE - Supports Good/Better/Best Tiers
-- ============================================================
CREATE TABLE IF NOT EXISTS quote_line_items (
    id SERIAL PRIMARY KEY,
    quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,

    -- Item Type
    item_type VARCHAR(20) NOT NULL DEFAULT 'material',  -- labor, material, equipment, service, other

    -- Link to inventory (optional)
    inventory_id INTEGER REFERENCES inventory(id),

    -- Description
    description TEXT NOT NULL,

    -- Pricing
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
    unit VARCHAR(20) DEFAULT 'Each',
    unit_cost DECIMAL(10, 2) DEFAULT 0.00,
    unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    markup_percent DECIMAL(5, 2) DEFAULT 0.00,
    line_total DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,

    -- Tier Assignment (Good/Better/Best)
    -- basic = Good (cheapest), standard = Better (recommended), premium = Best (full service)
    tier_basic BOOLEAN DEFAULT TRUE,
    tier_standard BOOLEAN DEFAULT TRUE,
    tier_premium BOOLEAN DEFAULT TRUE,

    -- Display
    line_order INTEGER DEFAULT 0,
    is_optional BOOLEAN DEFAULT FALSE,
    notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_line_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_type ON quote_line_items(item_type);

-- ============================================================
-- 3. QUOTE TIERS TABLE - Define the 3 pricing options
-- ============================================================
CREATE TABLE IF NOT EXISTS quote_tiers (
    id SERIAL PRIMARY KEY,
    quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,

    tier_key VARCHAR(20) NOT NULL,  -- basic, standard, premium
    tier_name VARCHAR(50) NOT NULL,  -- "Good", "Better", "Best" or custom names
    tier_description TEXT,

    -- Calculated totals for this tier
    labor_subtotal DECIMAL(10, 2) DEFAULT 0.00,
    material_subtotal DECIMAL(10, 2) DEFAULT 0.00,
    other_subtotal DECIMAL(10, 2) DEFAULT 0.00,
    subtotal DECIMAL(10, 2) DEFAULT 0.00,
    tax_amount DECIMAL(10, 2) DEFAULT 0.00,
    total_amount DECIMAL(10, 2) DEFAULT 0.00,

    -- Display order (1=first/cheapest, 3=last/most expensive)
    display_order INTEGER DEFAULT 2,
    is_recommended BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(quote_id, tier_key)
);

CREATE INDEX IF NOT EXISTS idx_quote_tiers_quote ON quote_tiers(quote_id);

-- ============================================================
-- 4. QUOTE HISTORY TABLE - Audit Trail
-- ============================================================
CREATE TABLE IF NOT EXISTS quote_history (
    id SERIAL PRIMARY KEY,
    quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,

    action VARCHAR(50) NOT NULL,  -- created, updated, sent, viewed, approved, declined, converted, expired
    action_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    performed_by VARCHAR(50) REFERENCES users(username),

    old_status VARCHAR(20),
    new_status VARCHAR(20),

    details JSONB,
    notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quote_history_quote ON quote_history(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_history_date ON quote_history(action_date);

-- ============================================================
-- 5. ADD QUOTE REFERENCE TO WORK ORDERS
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'work_orders' AND column_name = 'quote_id') THEN
        ALTER TABLE work_orders ADD COLUMN quote_id INTEGER REFERENCES quotes(id);
    END IF;
END $$;

-- ============================================================
-- 6. QUOTE NUMBER SEQUENCE
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS quote_number_seq START 1000;

-- ============================================================
-- 7. FUNCTION: Generate Quote Number
-- ============================================================
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS VARCHAR(20) AS $$
DECLARE
    new_number VARCHAR(20);
    year_part VARCHAR(4);
    seq_part INTEGER;
BEGIN
    year_part := TO_CHAR(CURRENT_DATE, 'YYYY');
    seq_part := nextval('quote_number_seq');
    new_number := 'QT-' || year_part || '-' || LPAD(seq_part::TEXT, 4, '0');
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 8. FUNCTION: Recalculate Quote Totals
-- ============================================================
CREATE OR REPLACE FUNCTION recalculate_quote_totals(p_quote_id INTEGER)
RETURNS VOID AS $$
DECLARE
    v_labor_subtotal DECIMAL(10,2);
    v_material_subtotal DECIMAL(10,2);
    v_other_charges DECIMAL(10,2);
    v_subtotal DECIMAL(10,2);
    v_discount_percent DECIMAL(5,2);
    v_discount_amount DECIMAL(10,2);
    v_tax_rate DECIMAL(5,4);
    v_taxable_amount DECIMAL(10,2);
    v_tax_amount DECIMAL(10,2);
    v_total DECIMAL(10,2);
BEGIN
    -- Calculate labor subtotal
    SELECT COALESCE(SUM(line_total), 0) INTO v_labor_subtotal
    FROM quote_line_items
    WHERE quote_id = p_quote_id AND item_type = 'labor';

    -- Calculate material subtotal
    SELECT COALESCE(SUM(line_total), 0) INTO v_material_subtotal
    FROM quote_line_items
    WHERE quote_id = p_quote_id AND item_type = 'material';

    -- Calculate other charges
    SELECT COALESCE(SUM(line_total), 0) INTO v_other_charges
    FROM quote_line_items
    WHERE quote_id = p_quote_id AND item_type NOT IN ('labor', 'material');

    -- Get discount percent and tax rate
    SELECT discount_percent, tax_rate INTO v_discount_percent, v_tax_rate
    FROM quotes WHERE id = p_quote_id;

    -- Calculate totals
    v_subtotal := v_labor_subtotal + v_material_subtotal + v_other_charges;
    v_discount_amount := v_subtotal * (COALESCE(v_discount_percent, 0) / 100);
    v_taxable_amount := v_subtotal - v_discount_amount;
    v_tax_amount := v_taxable_amount * COALESCE(v_tax_rate, 0.0625);
    v_total := v_taxable_amount + v_tax_amount;

    -- Update quote
    UPDATE quotes SET
        labor_subtotal = v_labor_subtotal,
        material_subtotal = v_material_subtotal,
        other_charges = v_other_charges,
        subtotal = v_subtotal,
        discount_amount = v_discount_amount,
        tax_amount = v_tax_amount,
        total_amount = v_total,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_quote_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 9. TRIGGER: Auto-recalculate on line item changes
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_recalculate_quote()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM recalculate_quote_totals(OLD.quote_id);
        RETURN OLD;
    ELSE
        PERFORM recalculate_quote_totals(NEW.quote_id);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quote_line_items_calc ON quote_line_items;
CREATE TRIGGER trg_quote_line_items_calc
AFTER INSERT OR UPDATE OR DELETE ON quote_line_items
FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_quote();

-- ============================================================
-- 10. DEFAULT TERMS AND CONDITIONS
-- ============================================================
INSERT INTO quotes (
    quote_number, customer_id, title, job_description, status, created_by
) SELECT
    'QT-TEMPLATE-001', 1, 'Template - Do Not Use',
    'This is a template quote for default terms',
    'draft', 'jgamache'
WHERE NOT EXISTS (SELECT 1 FROM quotes WHERE quote_number = 'QT-TEMPLATE-001')
AND EXISTS (SELECT 1 FROM customers WHERE id = 1)
AND EXISTS (SELECT 1 FROM users WHERE username = 'jgamache');

-- Delete template if created (it was just for testing)
DELETE FROM quotes WHERE quote_number = 'QT-TEMPLATE-001';

COMMIT;
