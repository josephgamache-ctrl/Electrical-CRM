-- Migration: Communication Settings (Email/SMS)
-- Date: 2024
-- Description: Add table for storing email (SMTP) and SMS (Twilio) configuration

-- Communication settings table for email and SMS configuration
CREATE TABLE IF NOT EXISTS communication_settings (
    id SERIAL PRIMARY KEY,
    setting_type VARCHAR(20) NOT NULL,          -- 'email' or 'sms'
    provider VARCHAR(50) NOT NULL,               -- 'smtp', 'twilio', etc.
    config JSONB NOT NULL DEFAULT '{}',          -- Configuration data (passwords encrypted)
    is_active BOOLEAN DEFAULT false,             -- Whether this config is active
    test_status VARCHAR(20),                     -- 'success', 'failed', NULL
    test_message TEXT,                           -- Result message from last test
    last_tested_at TIMESTAMP WITH TIME ZONE,    -- When last test was performed
    updated_by VARCHAR(50) REFERENCES users(username),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(setting_type, provider)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_communication_settings_type ON communication_settings(setting_type);
CREATE INDEX IF NOT EXISTS idx_communication_settings_active ON communication_settings(is_active) WHERE is_active = true;

-- Add comment documentation
COMMENT ON TABLE communication_settings IS 'Stores email (SMTP) and SMS (Twilio) configuration for sending quotes, invoices, and POs';
COMMENT ON COLUMN communication_settings.setting_type IS 'Type of communication: email or sms';
COMMENT ON COLUMN communication_settings.provider IS 'Service provider: smtp for email, twilio for sms';
COMMENT ON COLUMN communication_settings.config IS 'JSONB configuration. Sensitive fields (password, auth_token) are encrypted';
COMMENT ON COLUMN communication_settings.is_active IS 'Whether this configuration should be used for sending';
COMMENT ON COLUMN communication_settings.test_status IS 'Result of last connection test: success, failed, or NULL if never tested';

-- Communication log table to track all sent messages
CREATE TABLE IF NOT EXISTS communication_log (
    id SERIAL PRIMARY KEY,
    communication_type VARCHAR(20) NOT NULL,     -- 'email' or 'sms'
    recipient_type VARCHAR(50),                   -- 'customer', 'vendor', 'employee'
    recipient_id INTEGER,                         -- ID of customer, vendor, or user
    recipient_address VARCHAR(255) NOT NULL,      -- Email address or phone number
    subject VARCHAR(500),                         -- Email subject (NULL for SMS)
    message_preview TEXT,                         -- First 500 chars of message
    related_type VARCHAR(50),                     -- 'quote', 'invoice', 'purchase_order', 'notification'
    related_id INTEGER,                           -- ID of quote, invoice, PO, etc.
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'delivered'
    error_message TEXT,                           -- Error details if failed
    provider_message_id VARCHAR(255),             -- ID from email/SMS provider for tracking
    sent_by VARCHAR(50) REFERENCES users(username),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for communication log
CREATE INDEX IF NOT EXISTS idx_communication_log_type ON communication_log(communication_type);
CREATE INDEX IF NOT EXISTS idx_communication_log_status ON communication_log(status);
CREATE INDEX IF NOT EXISTS idx_communication_log_related ON communication_log(related_type, related_id);
CREATE INDEX IF NOT EXISTS idx_communication_log_recipient ON communication_log(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_communication_log_sent_at ON communication_log(sent_at DESC);

COMMENT ON TABLE communication_log IS 'Audit log of all emails and SMS messages sent from the system';

-- Email templates table for consistent messaging
CREATE TABLE IF NOT EXISTS email_templates (
    id SERIAL PRIMARY KEY,
    template_key VARCHAR(50) UNIQUE NOT NULL,    -- 'quote_send', 'invoice_send', 'po_send', etc.
    template_name VARCHAR(100) NOT NULL,         -- Human-readable name
    subject_template VARCHAR(500) NOT NULL,      -- Subject with {{variables}}
    body_template TEXT NOT NULL,                 -- HTML body with {{variables}}
    description TEXT,                            -- What this template is used for
    is_active BOOLEAN DEFAULT true,
    updated_by VARCHAR(50) REFERENCES users(username),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE email_templates IS 'Reusable email templates for quotes, invoices, POs, etc.';

-- Insert default email templates
INSERT INTO email_templates (template_key, template_name, subject_template, body_template, description) VALUES
(
    'quote_send',
    'Quote/Estimate Delivery',
    'Quote {{quote_number}} from MA Electrical',
    '<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #1e3a5f;">Quote/Estimate</h2>
    <p>Dear {{customer_name}},</p>
    <p>Thank you for the opportunity to provide you with a quote for your electrical project.</p>
    <p><strong>Quote Number:</strong> {{quote_number}}<br>
    <strong>Project:</strong> {{quote_title}}<br>
    <strong>Valid Until:</strong> {{valid_until}}</p>
    <p>Please find the attached quote document for your review. We have included multiple pricing options for your consideration.</p>
    <p>If you have any questions or would like to proceed, please don''t hesitate to contact us.</p>
    <p>Best regards,<br>
    <strong>MA Electrical</strong><br>
    {{from_email}}</p>
</body>
</html>',
    'Template for sending quotes/estimates to customers'
),
(
    'invoice_send',
    'Invoice Delivery',
    'Invoice {{invoice_number}} from MA Electrical',
    '<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #1e3a5f;">Invoice</h2>
    <p>Dear {{customer_name}},</p>
    <p>Please find attached your invoice for electrical services.</p>
    <p><strong>Invoice Number:</strong> {{invoice_number}}<br>
    <strong>Invoice Date:</strong> {{invoice_date}}<br>
    <strong>Amount Due:</strong> {{total_amount}}<br>
    <strong>Due Date:</strong> {{due_date}}</p>
    <p>Payment can be made by check, credit card, or bank transfer. Please reference the invoice number with your payment.</p>
    <p>Thank you for your business!</p>
    <p>Best regards,<br>
    <strong>MA Electrical</strong><br>
    {{from_email}}</p>
</body>
</html>',
    'Template for sending invoices to customers'
),
(
    'po_send',
    'Purchase Order Delivery',
    'Purchase Order {{po_number}} from MA Electrical',
    '<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #1e3a5f;">Purchase Order</h2>
    <p>Dear {{vendor_contact}},</p>
    <p>Please find attached our purchase order for the following materials:</p>
    <p><strong>PO Number:</strong> {{po_number}}<br>
    <strong>Order Date:</strong> {{order_date}}<br>
    <strong>Expected Delivery:</strong> {{expected_delivery_date}}</p>
    <p>Please confirm receipt of this order and provide expected delivery date if different from above.</p>
    <p>Thank you for your partnership!</p>
    <p>Best regards,<br>
    <strong>MA Electrical</strong><br>
    {{from_email}}</p>
</body>
</html>',
    'Template for sending purchase orders to vendors'
),
(
    'quote_sms',
    'Quote SMS Notification',
    NULL,
    'MA Electrical: Your quote {{quote_number}} for {{quote_title}} has been sent to your email. Total: {{total_amount}}. Questions? Call us!',
    'SMS notification when quote is sent'
),
(
    'invoice_sms',
    'Invoice SMS Notification',
    NULL,
    'MA Electrical: Invoice {{invoice_number}} for {{total_amount}} has been sent to your email. Due: {{due_date}}. Thank you!',
    'SMS notification when invoice is sent'
)
ON CONFLICT (template_key) DO NOTHING;

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON communication_settings TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON communication_log TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON email_templates TO postgres;
GRANT USAGE, SELECT ON SEQUENCE communication_settings_id_seq TO postgres;
GRANT USAGE, SELECT ON SEQUENCE communication_log_id_seq TO postgres;
GRANT USAGE, SELECT ON SEQUENCE email_templates_id_seq TO postgres;
