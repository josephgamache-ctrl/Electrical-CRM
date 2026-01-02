-- MA Electrical Inventory - FINAL COMPREHENSIVE Schema v3.0
-- Created: 2024-11-25
-- Purpose: Full electrical contractor management system
-- Focus: Residential service with multiple technicians
-- Future-proofed for company growth and advanced features

-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables (for clean reinstall)
DROP TABLE IF EXISTS material_requests CASCADE;
DROP TABLE IF EXISTS labor_tracking CASCADE;
DROP TABLE IF EXISTS job_materials_used CASCADE;
DROP TABLE IF EXISTS invoice_payments CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS permits CASCADE;
DROP TABLE IF EXISTS equipment_installed CASCADE;
DROP TABLE IF EXISTS maintenance_contracts CASCADE;
DROP TABLE IF EXISTS customer_sites CASCADE;
DROP TABLE IF EXISTS work_order_items CASCADE;
DROP TABLE IF EXISTS work_orders CASCADE;
DROP TABLE IF EXISTS stock_transactions CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================
-- USERS & AUTHENTICATION
-- ============================================================

CREATE TABLE users (
    username VARCHAR(50) PRIMARY KEY,
    password VARCHAR(255) NOT NULL,  -- bcrypt hashed
    full_name VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'technician',  -- admin, manager, technician, office

    -- Employment Info
    hire_date DATE,
    hourly_rate DECIMAL(8,2) DEFAULT 0.00,
    overtime_rate DECIMAL(8,2) DEFAULT 0.00,
    license_number VARCHAR(50),  -- Electrician license
    license_expiration DATE,

    -- Status
    active BOOLEAN DEFAULT TRUE,
    can_create_quotes BOOLEAN DEFAULT FALSE,
    can_close_jobs BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_settings (
    username VARCHAR(50) PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
    settings JSONB DEFAULT '{}'::jsonb,  -- theme, notifications, default_view
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Default admin user - CHANGE PASSWORD IMMEDIATELY in production!
-- The default password should be changed via the application after first login.
-- To generate a new bcrypt hash: python -c "import bcrypt; print(bcrypt.hashpw(b'YOUR_NEW_PASSWORD', bcrypt.gensalt()).decode())"
INSERT INTO users (username, password, full_name, email, role, can_create_quotes, can_close_jobs, hourly_rate, active)
VALUES ('joey', '$2b$12$Kw5PRAvZqklm5MN7D9APeevTVsdCTJVdR.evsm62Hs1xyOeKoTYbK', 'Joey', NULL, 'admin', TRUE, TRUE, 0.00, TRUE);

-- ============================================================
-- VENDORS (Granite City, Concord, etc.)
-- ============================================================

CREATE TABLE vendors (
    id SERIAL PRIMARY KEY,
    vendor_name VARCHAR(100) UNIQUE NOT NULL,

    -- Contact Info
    contact_person VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    website VARCHAR(200),

    -- Address
    street VARCHAR(200),
    city VARCHAR(100),
    state VARCHAR(2) DEFAULT 'MA',
    zip VARCHAR(10),

    -- Business Terms
    account_number VARCHAR(50),
    payment_terms VARCHAR(50) DEFAULT 'Net 30',  -- Net 30, COD, etc.
    discount_percent DECIMAL(5,2) DEFAULT 0.00,  -- Account discount
    tax_id VARCHAR(50),

    -- Preferences
    preferred BOOLEAN DEFAULT FALSE,  -- Primary vendor
    delivery_available BOOLEAN DEFAULT TRUE,
    will_call_available BOOLEAN DEFAULT TRUE,
    online_ordering BOOLEAN DEFAULT FALSE,

    -- Performance
    average_lead_time_days INTEGER DEFAULT 2,
    reliability_rating INTEGER,  -- 1-5 stars

    -- Status
    active BOOLEAN DEFAULT TRUE,
    notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- IMPORTANT: No vendor seed data is created (customer-specific).

CREATE INDEX idx_vendors_name ON vendors(vendor_name);
CREATE INDEX idx_vendors_preferred ON vendors(preferred, active);

-- ============================================================
-- CUSTOMERS (RESIDENTIAL FOCUS)
-- ============================================================

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    customer_number VARCHAR(20) UNIQUE NOT NULL,  -- CUST-0001

    -- Basic Info
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company_name VARCHAR(200),  -- For small business customers
    customer_type VARCHAR(20) DEFAULT 'residential',  -- residential, commercial

    -- Contact
    phone_primary VARCHAR(20) NOT NULL,
    phone_secondary VARCHAR(20),
    email VARCHAR(100),
    preferred_contact VARCHAR(20) DEFAULT 'phone',  -- phone, email, text

    -- Service Address (Primary)
    service_street VARCHAR(200),
    service_city VARCHAR(100),
    service_state VARCHAR(2) DEFAULT 'MA',
    service_zip VARCHAR(10),
    service_notes TEXT,  -- Gate code, dog, etc.

    -- Billing Address (if different)
    billing_same_as_service BOOLEAN DEFAULT TRUE,
    billing_street VARCHAR(200),
    billing_city VARCHAR(100),
    billing_state VARCHAR(2),
    billing_zip VARCHAR(10),

    -- Business Info
    payment_terms VARCHAR(20) DEFAULT 'due_on_receipt',  -- due_on_receipt, net_15, net_30
    tax_exempt BOOLEAN DEFAULT FALSE,
    tax_exempt_cert VARCHAR(50),
    credit_limit DECIMAL(10,2) DEFAULT 0.00,

    -- Relationship
    referral_source VARCHAR(100),  -- Google, Yelp, Referral from X
    customer_since DATE DEFAULT CURRENT_DATE,
    preferred_technician VARCHAR(50) REFERENCES users(username),

    -- Status
    active BOOLEAN DEFAULT TRUE,
    vip BOOLEAN DEFAULT FALSE,  -- Priority service
    notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_number ON customers(customer_number);
CREATE INDEX idx_customers_phone ON customers(phone_primary);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_name ON customers(last_name, first_name);
CREATE INDEX idx_customers_city ON customers(service_city);

-- ============================================================
-- CUSTOMER SITES (for customers with multiple properties)
-- ============================================================

CREATE TABLE customer_sites (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    site_name VARCHAR(100),  -- "Summer Home", "Rental Property A"

    -- Address
    street VARCHAR(200) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(2) DEFAULT 'MA',
    zip VARCHAR(10),

    -- Access
    access_instructions TEXT,  -- Gate code, key location
    site_contact_name VARCHAR(100),
    site_contact_phone VARCHAR(20),

    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customer_sites_customer ON customer_sites(customer_id);

-- ============================================================
-- ELECTRICAL INVENTORY - COMPREHENSIVE
-- ============================================================

CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,

    -- ============================================================
    -- IDENTIFICATION (6 fields)
    -- ============================================================
    item_id VARCHAR(20) UNIQUE NOT NULL,  -- 0001, 0002, etc. (YOUR ID)
    sku VARCHAR(100),  -- Manufacturer SKU (optional)
    brand VARCHAR(100) NOT NULL,  -- Square D, Siemens, Eaton, etc.
    upc VARCHAR(50),  -- UPC barcode for scanning
    manufacturer_part_number VARCHAR(100),  -- Manufacturer's part number
    description TEXT NOT NULL,  -- Main product description

    -- ============================================================
    -- CATEGORY & CLASSIFICATION (2 fields)
    -- ============================================================
    category VARCHAR(100),  -- Service Entrance, Wiring, Lighting, Overcurrent
    subcategory VARCHAR(100),  -- Main Panels, NM-B Cable, LED Fixtures, Breakers

    -- ============================================================
    -- PRICING (6 fields)
    -- ============================================================
    cost DECIMAL(10, 2) DEFAULT 0.00,  -- What you paid (from vendor)
    list_price DECIMAL(10, 2) DEFAULT 0.00,  -- Manufacturer MSRP (reference)
    contractor_price DECIMAL(10, 2) DEFAULT 0.00,  -- Special contractor pricing
    markup_percent DECIMAL(5, 2) DEFAULT 35.00,  -- Your standard markup
    sell_price DECIMAL(10, 2) DEFAULT 0.00,  -- What you charge customer
    discount_price DECIMAL(10, 2) DEFAULT 0.00,  -- Special/sale price (optional)

    -- ============================================================
    -- INVENTORY MANAGEMENT (10 fields)
    -- ============================================================
    qty INTEGER DEFAULT 0,  -- Total quantity in warehouse
    qty_allocated INTEGER DEFAULT 0,  -- Reserved for active jobs
    qty_available INTEGER GENERATED ALWAYS AS (qty - qty_allocated) STORED,  -- Available = Total - Allocated
    qty_on_order INTEGER DEFAULT 0,  -- Incoming from vendor

    min_stock INTEGER DEFAULT 0,  -- Reorder trigger point
    reorder_qty INTEGER DEFAULT 0,  -- Standard reorder amount
    max_stock INTEGER DEFAULT 0,  -- Don't exceed this (storage limit)

    location VARCHAR(50),  -- Warehouse location: A1, B2, Shelf-3, etc.
    bin_location VARCHAR(50),  -- More specific: A1-Top, B2-Middle

    last_counted_date DATE,  -- Last physical inventory count
    count_variance INTEGER DEFAULT 0,  -- Difference in last count (+ over, - under)

    -- ============================================================
    -- PHYSICAL PROPERTIES (5 fields)
    -- ============================================================
    qty_per VARCHAR(20) DEFAULT 'Each',  -- Each, Box, Roll, Foot, Pair, Case
    package_quantity INTEGER,  -- Items per package (e.g., box of 10 outlets)
    weight_lbs DECIMAL(8, 2) DEFAULT 0.00,  -- Weight per unit
    length_inches DECIMAL(8, 2),  -- Length (for wire, conduit)
    dimensions VARCHAR(50),  -- L x W x H (for storage planning)

    -- ============================================================
    -- ELECTRICAL SPECIFICATIONS (10 fields)
    -- ============================================================
    voltage VARCHAR(50),  -- 120V, 240V, 120/240V, 277V, 480V, Low Voltage
    amperage VARCHAR(50),  -- 15A, 20A, 30A, 40A, 50A, 100A, 200A
    wire_gauge VARCHAR(50),  -- 14 AWG, 12 AWG, 10 AWG, 8 AWG, 6 AWG
    wire_type VARCHAR(50),  -- Copper, Aluminum, CCA (Copper-Clad Aluminum)
    num_poles INTEGER,  -- For breakers: 1, 2, 3

    phase VARCHAR(20),  -- Single-Phase, Three-Phase
    wire_insulation VARCHAR(50),  -- THHN, THWN, THWN-2, XHHW, XHHW-2
    wire_stranding VARCHAR(20),  -- Solid, Stranded
    conduit_compatible VARCHAR(100),  -- Compatible conduit sizes: 1/2", 3/4", 1"

    indoor_outdoor VARCHAR(20),  -- Indoor, Outdoor, Both
    wet_location_rated BOOLEAN DEFAULT FALSE,  -- Wet location approved

    -- ============================================================
    -- COMPLIANCE & CERTIFICATIONS (6 fields)
    -- ============================================================
    ma_code_ref VARCHAR(100),  -- MA 230.85, MA Amendment, 780 CMR
    nec_ref VARCHAR(100),  -- NEC 210.12, NEC 408, NEC 250.52
    ul_listed BOOLEAN DEFAULT FALSE,
    certifications TEXT,  -- UL, CE, CSA, ETL (comma-separated)

    arc_fault_required BOOLEAN DEFAULT FALSE,  -- AFCI requirement flag
    gfci_required BOOLEAN DEFAULT FALSE,  -- GFCI requirement flag
    tamper_resistant BOOLEAN DEFAULT FALSE,  -- TR outlets

    -- ============================================================
    -- SUPPLY CHAIN (8 fields)
    -- ============================================================
    primary_vendor_id INTEGER REFERENCES vendors(id),  -- Preferred vendor
    alternate_vendor_id INTEGER REFERENCES vendors(id),  -- Backup vendor
    vendor_part_number VARCHAR(100),  -- Vendor's item number

    lead_time_days INTEGER DEFAULT 0,  -- Typical delivery time
    last_order_date DATE,  -- When last ordered
    last_order_cost DECIMAL(10, 2),  -- Price on last order (track changes)
    last_order_vendor_id INTEGER REFERENCES vendors(id),  -- Who we bought from

    discontinued BOOLEAN DEFAULT FALSE,  -- No longer available
    replacement_item_id VARCHAR(20),  -- Newer model that replaced this

    -- ============================================================
    -- MEDIA & DOCUMENTATION (6 fields)
    -- ============================================================
    image_url TEXT,  -- Primary product photo
    image_urls JSONB DEFAULT '[]'::jsonb,  -- Multiple images (array)
    datasheet_pdf TEXT,  -- Spec sheet URL
    installation_guide TEXT,  -- Install instructions URL
    video_url TEXT,  -- Installation video
    qr_code TEXT,  -- Generated QR code for mobile scanning

    -- ============================================================
    -- USAGE & ANALYTICS (5 fields)
    -- ============================================================
    commonly_used BOOLEAN DEFAULT FALSE,  -- Flag for mobile quick-add
    last_used_date DATE,  -- Last used in a job
    times_used INTEGER DEFAULT 0,  -- How many times used in jobs
    usage_frequency VARCHAR(20),  -- Daily, Weekly, Monthly, Rare

    seasonal_item BOOLEAN DEFAULT FALSE,  -- Demand varies by season

    -- ============================================================
    -- BUSINESS & FINANCIAL (4 fields)
    -- ============================================================
    taxable BOOLEAN DEFAULT TRUE,  -- Subject to sales tax
    serialized BOOLEAN DEFAULT FALSE,  -- Track individual serial numbers
    warranty_months INTEGER DEFAULT 0,  -- Manufacturer warranty period
    returnable BOOLEAN DEFAULT TRUE,  -- Can return to vendor

    -- ============================================================
    -- METADATA (6 fields)
    -- ============================================================
    notes TEXT,  -- General notes/comments
    estimation_guide VARCHAR(200),  -- For quotes: "1 per room", "100ft per floor"
    hazmat BOOLEAN DEFAULT FALSE,  -- Hazardous material flag

    active BOOLEAN DEFAULT TRUE,  -- Show in active inventory
    created_by VARCHAR(50) REFERENCES users(username),

    date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_inventory_item_id ON inventory(item_id);
CREATE INDEX idx_inventory_category ON inventory(category);
CREATE INDEX idx_inventory_subcategory ON inventory(subcategory);
CREATE INDEX idx_inventory_brand ON inventory(brand);
CREATE INDEX idx_inventory_upc ON inventory(upc);
CREATE INDEX idx_inventory_active ON inventory(active);
CREATE INDEX idx_inventory_low_stock ON inventory(qty_available, min_stock) WHERE active = TRUE;
CREATE INDEX idx_inventory_commonly_used ON inventory(commonly_used) WHERE active = TRUE;
CREATE INDEX idx_inventory_primary_vendor ON inventory(primary_vendor_id);
CREATE INDEX idx_inventory_description ON inventory USING gin(to_tsvector('english', description));

-- ============================================================
-- PURCHASE ORDERS
-- ============================================================

CREATE TABLE purchase_orders (
    id SERIAL PRIMARY KEY,
    po_number VARCHAR(20) UNIQUE NOT NULL,  -- PO-2024-001
    vendor_id INTEGER NOT NULL REFERENCES vendors(id),

    -- Order Details
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    actual_delivery_date DATE,

    -- Status
    status VARCHAR(20) DEFAULT 'pending',  -- pending, ordered, shipped, received, canceled

    -- Costs
    subtotal DECIMAL(10,2) DEFAULT 0.00,
    shipping_cost DECIMAL(10,2) DEFAULT 0.00,
    tax_amount DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2) DEFAULT 0.00,

    -- Items (JSONB array of {inventory_id, quantity, unit_cost})
    items JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Metadata
    notes TEXT,
    ordered_by VARCHAR(50) REFERENCES users(username),
    received_by VARCHAR(50) REFERENCES users(username),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_purchase_orders_number ON purchase_orders(po_number);
CREATE INDEX idx_purchase_orders_vendor ON purchase_orders(vendor_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_expected_date ON purchase_orders(expected_delivery_date);

-- ============================================================
-- WORK ORDERS (ENHANCED FOR SERVICE BUSINESS)
-- ============================================================

CREATE TABLE work_orders (
    id SERIAL PRIMARY KEY,
    work_order_number VARCHAR(20) UNIQUE NOT NULL,  -- WO-2024-0001

    -- Customer Information
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    customer_site_id INTEGER REFERENCES customer_sites(id),  -- NULL if main address
    service_address TEXT NOT NULL,  -- Denormalized for display

    -- Job Details
    job_type VARCHAR(50),  -- Service Call, Panel Upgrade, New Construction, Repair, Maintenance
    job_description TEXT NOT NULL,
    scope_of_work TEXT,  -- Detailed work description

    -- Service Type Flags
    emergency_call BOOLEAN DEFAULT FALSE,
    maintenance_visit BOOLEAN DEFAULT FALSE,
    warranty_work BOOLEAN DEFAULT FALSE,

    -- Scheduling
    scheduled_date DATE,
    scheduled_start_time TIME,
    scheduled_end_time TIME,
    estimated_duration_hours DECIMAL(5, 2),

    -- Time Tracking (Auto-populated from labor_tracking)
    actual_start_time TIMESTAMP,
    actual_end_time TIMESTAMP,
    actual_hours DECIMAL(5, 2) DEFAULT 0.00,

    -- Assignment
    assigned_to VARCHAR(50) REFERENCES users(username),  -- Primary tech
    helper_1 VARCHAR(50) REFERENCES users(username),
    helper_2 VARCHAR(50) REFERENCES users(username),

    -- Pricing
    quoted_labor_hours DECIMAL(5,2) DEFAULT 0.00,
    quoted_labor_rate DECIMAL(8,2) DEFAULT 0.00,
    quoted_labor_cost DECIMAL(10, 2) DEFAULT 0.00,
    quoted_material_cost DECIMAL(10, 2) DEFAULT 0.00,
    quoted_subtotal DECIMAL(10, 2) DEFAULT 0.00,

    actual_labor_cost DECIMAL(10, 2) DEFAULT 0.00,  -- Auto-calc from labor_tracking
    actual_material_cost DECIMAL(10, 2) DEFAULT 0.00,  -- Auto-calc from job_materials_used

    emergency_surcharge DECIMAL(10,2) DEFAULT 0.00,
    travel_charge DECIMAL(10, 2) DEFAULT 0.00,
    discount_percent DECIMAL(5,2) DEFAULT 0.00,
    discount_amount DECIMAL(10, 2) DEFAULT 0.00,

    subtotal DECIMAL(10, 2) DEFAULT 0.00,
    tax_rate DECIMAL(5,2) DEFAULT 6.25,  -- MA sales tax
    tax_amount DECIMAL(10, 2) DEFAULT 0.00,
    total_amount DECIMAL(10, 2) DEFAULT 0.00,

    -- Status & Priority
    status VARCHAR(20) DEFAULT 'pending',  -- pending, scheduled, in_progress, completed, invoiced, paid, canceled
    priority VARCHAR(20) DEFAULT 'normal',  -- low, normal, high, emergency

    -- Completion
    completed_date TIMESTAMP,
    completed_by VARCHAR(50) REFERENCES users(username),
    customer_signature TEXT,  -- Base64 encoded
    customer_satisfaction INTEGER,  -- 1-5 rating

    -- Compliance (MA Electrical Code)
    permit_required BOOLEAN DEFAULT FALSE,
    permit_number VARCHAR(50),
    permit_cost DECIMAL(10,2) DEFAULT 0.00,
    inspection_required BOOLEAN DEFAULT FALSE,
    inspection_scheduled_date DATE,
    inspection_completed_date DATE,
    inspection_passed BOOLEAN,
    inspector_name VARCHAR(100),
    inspector_notes TEXT,

    -- Documentation
    photos JSONB DEFAULT '[]'::jsonb,  -- Array of photo URLs
    tech_notes TEXT,  -- Internal notes
    customer_notes TEXT,  -- Visible to customer on invoice

    -- Warranty
    warranty_months INTEGER DEFAULT 12,
    warranty_expiration DATE,

    -- Metadata
    created_by VARCHAR(50) REFERENCES users(username),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_by VARCHAR(50) REFERENCES users(username)
);

CREATE INDEX idx_work_orders_number ON work_orders(work_order_number);
CREATE INDEX idx_work_orders_customer ON work_orders(customer_id);
CREATE INDEX idx_work_orders_status ON work_orders(status);
CREATE INDEX idx_work_orders_scheduled_date ON work_orders(scheduled_date);
CREATE INDEX idx_work_orders_assigned_to ON work_orders(assigned_to);
CREATE INDEX idx_work_orders_created_at ON work_orders(created_at);
CREATE INDEX idx_work_orders_priority ON work_orders(priority);

-- ============================================================
-- JOB MATERIALS USED (BIDIRECTIONAL ALLOCATION)
-- ============================================================

CREATE TABLE job_materials_used (
    id SERIAL PRIMARY KEY,
    work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    inventory_id INTEGER NOT NULL REFERENCES inventory(id),

    -- Quantity Management (FLEXIBLE WORKFLOW)
    quantity_needed INTEGER NOT NULL,  -- How much job requires
    quantity_allocated INTEGER DEFAULT 0,  -- Reserved from warehouse
    quantity_loaded INTEGER DEFAULT 0,  -- On tech's truck
    quantity_used INTEGER DEFAULT 0,  -- Actually installed/consumed
    quantity_returned INTEGER DEFAULT 0,  -- Returned to warehouse

    -- Stock Availability Check
    stock_status VARCHAR(20) DEFAULT 'checking',  -- in_stock, partial, out_of_stock, on_order
    needs_purchase BOOLEAN DEFAULT FALSE,
    purchase_order_id INTEGER REFERENCES purchase_orders(id),
    estimated_arrival DATE,

    -- Pricing (locked at allocation time)
    unit_cost DECIMAL(10, 2) NOT NULL,  -- Cost when allocated
    unit_price DECIMAL(10, 2) NOT NULL,  -- Sell price when allocated
    line_cost DECIMAL(10, 2) GENERATED ALWAYS AS (quantity_used * unit_cost) STORED,
    line_total DECIMAL(10, 2) GENERATED ALWAYS AS (quantity_used * unit_price) STORED,

    -- Installation Details
    installed_location VARCHAR(200),  -- "Main Panel", "Basement Subpanel"
    installed_by VARCHAR(50) REFERENCES users(username),
    installed_date TIMESTAMP,

    -- Status Tracking
    status VARCHAR(20) DEFAULT 'planned',  -- planned, allocated, loaded, used, returned, billed

    -- Metadata
    notes TEXT,
    allocated_by VARCHAR(50) REFERENCES users(username),
    allocated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_job_materials_wo ON job_materials_used(work_order_id);
CREATE INDEX idx_job_materials_inventory ON job_materials_used(inventory_id);
CREATE INDEX idx_job_materials_status ON job_materials_used(status);
CREATE INDEX idx_job_materials_stock_status ON job_materials_used(stock_status);

-- ============================================================
-- LABOR TRACKING (REPLACES EMAIL TIME TRACKING)
-- ============================================================

CREATE TABLE labor_tracking (
    id SERIAL PRIMARY KEY,
    work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    technician VARCHAR(50) NOT NULL REFERENCES users(username),

    -- Time Tracking
    clock_in_time TIMESTAMP NOT NULL,
    clock_out_time TIMESTAMP,
    hours_worked DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE
            WHEN clock_out_time IS NOT NULL
            THEN EXTRACT(EPOCH FROM (clock_out_time - clock_in_time)) / 3600
            ELSE 0
        END
    ) STORED,

    -- Break Time
    break_minutes INTEGER DEFAULT 0,
    billable_hours DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE
            WHEN clock_out_time IS NOT NULL
            THEN (EXTRACT(EPOCH FROM (clock_out_time - clock_in_time)) / 3600) - (break_minutes / 60.0)
            ELSE 0
        END
    ) STORED,

    -- Rates at time of work
    hourly_rate DECIMAL(8,2) NOT NULL,
    overtime_hours DECIMAL(5,2) DEFAULT 0.00,
    overtime_rate DECIMAL(8,2) DEFAULT 0.00,

    -- Cost Calculation
    labor_cost DECIMAL(10,2) GENERATED ALWAYS AS (
        (billable_hours - overtime_hours) * hourly_rate + overtime_hours * overtime_rate
    ) STORED,

    -- Location Tracking (GPS)
    clock_in_latitude DECIMAL(10,8),
    clock_in_longitude DECIMAL(11,8),
    clock_out_latitude DECIMAL(10,8),
    clock_out_longitude DECIMAL(11,8),

    -- Notes
    work_performed TEXT,
    notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_labor_tracking_wo ON labor_tracking(work_order_id);
CREATE INDEX idx_labor_tracking_tech ON labor_tracking(technician);
CREATE INDEX idx_labor_tracking_date ON labor_tracking(clock_in_time);

-- ============================================================
-- MATERIAL REQUESTS (FIELD TO OFFICE COMMUNICATION)
-- ============================================================

CREATE TABLE material_requests (
    id SERIAL PRIMARY KEY,
    work_order_id INTEGER NOT NULL REFERENCES work_orders(id),
    requested_by VARCHAR(50) NOT NULL REFERENCES users(username),

    -- Request Details
    urgency VARCHAR(20) DEFAULT 'normal',  -- normal, urgent, emergency
    status VARCHAR(20) DEFAULT 'pending',  -- pending, approved, fulfilled, declined

    -- Items Requested (JSONB array)
    items JSONB NOT NULL,  -- [{inventory_id, quantity, notes}]

    -- Reason
    reason TEXT,  -- "Need more wire", "Wrong breaker size", etc.

    -- Approval
    approved_by VARCHAR(50) REFERENCES users(username),
    approved_at TIMESTAMP,
    declined_reason TEXT,

    -- Fulfillment
    fulfilled_by VARCHAR(50) REFERENCES users(username),
    fulfilled_at TIMESTAMP,
    pickup_ready BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_material_requests_wo ON material_requests(work_order_id);
CREATE INDEX idx_material_requests_status ON material_requests(status);
CREATE INDEX idx_material_requests_requested_by ON material_requests(requested_by);

-- ============================================================
-- STOCK TRANSACTIONS (Enhanced Audit Trail)
-- ============================================================

CREATE TABLE stock_transactions (
    id SERIAL PRIMARY KEY,
    inventory_id INTEGER NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,

    transaction_type VARCHAR(20) NOT NULL,  -- purchase, adjustment, allocation, usage, return, damage, transfer
    quantity_change INTEGER NOT NULL,  -- Positive or negative
    quantity_before INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,

    -- Cost tracking
    unit_cost DECIMAL(10,2),
    total_cost DECIMAL(10,2),

    -- References
    work_order_id INTEGER REFERENCES work_orders(id),  -- If related to job
    job_material_id INTEGER REFERENCES job_materials_used(id),  -- Link to material usage
    purchase_order_id INTEGER REFERENCES purchase_orders(id),  -- If from PO

    reason TEXT,
    performed_by VARCHAR(50) REFERENCES users(username),
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stock_transactions_inventory ON stock_transactions(inventory_id);
CREATE INDEX idx_stock_transactions_date ON stock_transactions(transaction_date);
CREATE INDEX idx_stock_transactions_wo ON stock_transactions(work_order_id);
CREATE INDEX idx_stock_transactions_type ON stock_transactions(transaction_type);

-- ============================================================
-- INVOICES
-- ============================================================

CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(20) UNIQUE NOT NULL,  -- INV-2024-0001
    work_order_id INTEGER NOT NULL REFERENCES work_orders(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),

    -- Invoice Details
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,

    -- Amounts (copied from work order at time of invoice generation)
    labor_cost DECIMAL(10, 2) NOT NULL,
    material_cost DECIMAL(10, 2) NOT NULL,
    permit_cost DECIMAL(10, 2) DEFAULT 0.00,
    travel_charge DECIMAL(10, 2) DEFAULT 0.00,
    emergency_surcharge DECIMAL(10, 2) DEFAULT 0.00,

    subtotal DECIMAL(10, 2) NOT NULL,
    discount_amount DECIMAL(10, 2) DEFAULT 0.00,
    tax_rate DECIMAL(5,2) NOT NULL,
    tax_amount DECIMAL(10, 2) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,

    -- Payment Status
    amount_paid DECIMAL(10, 2) DEFAULT 0.00,
    balance_due DECIMAL(10, 2) GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
    payment_status VARCHAR(20) DEFAULT 'unpaid',  -- unpaid, partial, paid, overdue, written_off

    -- Late Fees
    days_overdue INTEGER DEFAULT 0,
    late_fee_amount DECIMAL(10, 2) DEFAULT 0.00,

    -- Metadata
    notes TEXT,
    terms TEXT,  -- Payment terms description
    sent_to_customer BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP,

    created_by VARCHAR(50) REFERENCES users(username),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoices_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_work_order ON invoices(work_order_id);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(payment_status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);

-- ============================================================
-- INVOICE PAYMENTS
-- ============================================================

CREATE TABLE invoice_payments (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

    -- Payment Details
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL,  -- cash, check, card, ach, zelle

    -- Check Info
    check_number VARCHAR(50),

    -- Card Info (last 4 digits only)
    card_last_four VARCHAR(4),
    card_type VARCHAR(20),  -- Visa, MC, Amex

    -- Reference
    transaction_id VARCHAR(100),  -- From payment processor

    -- Metadata
    notes TEXT,
    recorded_by VARCHAR(50) REFERENCES users(username),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoice_payments_invoice ON invoice_payments(invoice_id);
CREATE INDEX idx_invoice_payments_date ON invoice_payments(payment_date);

-- ============================================================
-- Additional tables (permits, equipment, maintenance, vehicles)
-- Omitted for brevity - included in schema_v2_enhanced.sql
-- ============================================================

-- ============================================================
-- TRIGGERS FOR AUTO-UPDATES
-- ============================================================

-- Update last_updated timestamp
CREATE OR REPLACE FUNCTION update_last_updated_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_inventory_timestamp BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_last_updated_column();

CREATE TRIGGER update_work_orders_timestamp BEFORE UPDATE ON work_orders
    FOR EACH ROW EXECUTE FUNCTION update_last_updated_column();

CREATE TRIGGER update_customers_timestamp BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_last_updated_column();

CREATE TRIGGER update_vendors_timestamp BEFORE UPDATE ON vendors
    FOR EACH ROW EXECUTE FUNCTION update_last_updated_column();

-- Update work order actual costs when labor/materials change
CREATE OR REPLACE FUNCTION update_work_order_costs()
RETURNS TRIGGER AS $$
BEGIN
    -- Update actual labor cost
    UPDATE work_orders
    SET actual_labor_cost = (
        SELECT COALESCE(SUM(labor_cost), 0)
        FROM labor_tracking
        WHERE work_order_id = NEW.work_order_id
    ),
    actual_material_cost = (
        SELECT COALESCE(SUM(line_total), 0)
        FROM job_materials_used
        WHERE work_order_id = NEW.work_order_id
        AND status IN ('used', 'billed')
    )
    WHERE id = NEW.work_order_id;

    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_wo_labor_cost AFTER INSERT OR UPDATE ON labor_tracking
    FOR EACH ROW EXECUTE FUNCTION update_work_order_costs();

-- Update inventory qty_allocated when job materials change
CREATE OR REPLACE FUNCTION update_inventory_allocated()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE inventory
        SET qty_allocated = (
            SELECT COALESCE(SUM(quantity_allocated - quantity_returned), 0)
            FROM job_materials_used
            WHERE inventory_id = NEW.inventory_id
            AND status IN ('allocated', 'loaded', 'used')
        )
        WHERE id = NEW.inventory_id;
    END IF;

    IF TG_OP = 'DELETE' THEN
        UPDATE inventory
        SET qty_allocated = (
            SELECT COALESCE(SUM(quantity_allocated - quantity_returned), 0)
            FROM job_materials_used
            WHERE inventory_id = OLD.inventory_id
            AND status IN ('allocated', 'loaded', 'used')
        )
        WHERE id = OLD.inventory_id;
    END IF;

    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_inventory_allocated_trigger
    AFTER INSERT OR UPDATE OR DELETE ON job_materials_used
    FOR EACH ROW EXECUTE FUNCTION update_inventory_allocated();

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- ============================================================
-- SEED DATA: Sample Items
-- ============================================================

-- IMPORTANT: No sample customer or inventory seed data is created.
-- Use the seed scripts in `database/` (or your import flow) per customer.

COMMENT ON TABLE inventory IS 'Comprehensive electrical inventory with 70+ fields for future growth';
COMMENT ON COLUMN inventory.qty_available IS 'Auto-calculated: qty - qty_allocated';
COMMENT ON COLUMN inventory.commonly_used IS 'Flag for mobile app quick-add feature';
COMMENT ON COLUMN inventory.primary_vendor_id IS 'Preferred vendor (Granite City or Concord)';
