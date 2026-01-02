-- Migration: Email Notification Templates
-- Date: 2025-01-02
-- Description: Add email templates for internal notifications (PTO, job assignments, alerts)
-- NOTE: This migration should be run AFTER migration_communication_settings.sql

-- Add internal notification email templates
INSERT INTO email_templates (template_key, template_name, subject_template, body_template, description) VALUES

-- PTO Request Submitted (notify admin/managers)
(
    'pto_request_submitted',
    'PTO Request Notification',
    'PTO Request from {{employee_name}} - {{pto_type}}',
    '<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 10px;">Time Off Request</h2>
    <p>A new time off request has been submitted and requires your review.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold; width: 140px;">Employee:</td>
            <td style="padding: 10px;">{{employee_name}}</td>
        </tr>
        <tr>
            <td style="padding: 10px; font-weight: bold;">Request Type:</td>
            <td style="padding: 10px;">{{pto_type}}</td>
        </tr>
        <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold;">Date(s):</td>
            <td style="padding: 10px;">{{pto_dates}}</td>
        </tr>
        <tr>
            <td style="padding: 10px; font-weight: bold;">Hours:</td>
            <td style="padding: 10px;">{{pto_hours}}</td>
        </tr>
        <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold;">Reason:</td>
            <td style="padding: 10px;">{{pto_reason}}</td>
        </tr>
        <tr>
            <td style="padding: 10px; font-weight: bold;">Submitted:</td>
            <td style="padding: 10px;">{{submitted_date}}</td>
        </tr>
    </table>
    <p>Please log in to the system to approve or deny this request.</p>
    <p style="margin-top: 30px; color: #666; font-size: 12px;">
        This is an automated message from Pem2 Services.
    </p>
</body>
</html>',
    'Sent to admins/managers when an employee submits a PTO request'
),

-- PTO Request Approved (notify employee)
(
    'pto_request_approved',
    'PTO Request Approved',
    'Your Time Off Request Has Been Approved',
    '<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #2e7d32; border-bottom: 2px solid #2e7d32; padding-bottom: 10px;">Request Approved</h2>
    <p>Good news! Your time off request has been approved.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold; width: 140px;">Request Type:</td>
            <td style="padding: 10px;">{{pto_type}}</td>
        </tr>
        <tr>
            <td style="padding: 10px; font-weight: bold;">Date(s):</td>
            <td style="padding: 10px;">{{pto_dates}}</td>
        </tr>
        <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold;">Hours:</td>
            <td style="padding: 10px;">{{pto_hours}}</td>
        </tr>
        <tr>
            <td style="padding: 10px; font-weight: bold;">Approved By:</td>
            <td style="padding: 10px;">{{approved_by}}</td>
        </tr>
    </table>
    <p>Your schedule has been updated accordingly. Enjoy your time off!</p>
    <p style="margin-top: 30px; color: #666; font-size: 12px;">
        This is an automated message from Pem2 Services.
    </p>
</body>
</html>',
    'Sent to employee when their PTO request is approved'
),

-- PTO Request Denied (notify employee)
(
    'pto_request_denied',
    'PTO Request Denied',
    'Your Time Off Request Could Not Be Approved',
    '<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #c62828; border-bottom: 2px solid #c62828; padding-bottom: 10px;">Request Denied</h2>
    <p>Unfortunately, your time off request could not be approved at this time.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold; width: 140px;">Request Type:</td>
            <td style="padding: 10px;">{{pto_type}}</td>
        </tr>
        <tr>
            <td style="padding: 10px; font-weight: bold;">Date(s):</td>
            <td style="padding: 10px;">{{pto_dates}}</td>
        </tr>
        <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold;">Reviewed By:</td>
            <td style="padding: 10px;">{{reviewed_by}}</td>
        </tr>
        <tr>
            <td style="padding: 10px; font-weight: bold;">Reason:</td>
            <td style="padding: 10px;">{{denial_reason}}</td>
        </tr>
    </table>
    <p>If you have questions, please speak with your manager.</p>
    <p style="margin-top: 30px; color: #666; font-size: 12px;">
        This is an automated message from Pem2 Services.
    </p>
</body>
</html>',
    'Sent to employee when their PTO request is denied'
),

-- Job Assignment (notify technician)
(
    'job_assigned',
    'New Job Assignment',
    'You Have Been Assigned to Job {{work_order_number}}',
    '<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #1565c0; border-bottom: 2px solid #1565c0; padding-bottom: 10px;">New Job Assignment</h2>
    <p>You have been assigned to a new job.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold; width: 140px;">Work Order:</td>
            <td style="padding: 10px;">{{work_order_number}}</td>
        </tr>
        <tr>
            <td style="padding: 10px; font-weight: bold;">Customer:</td>
            <td style="padding: 10px;">{{customer_name}}</td>
        </tr>
        <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold;">Job Type:</td>
            <td style="padding: 10px;">{{job_type}}</td>
        </tr>
        <tr>
            <td style="padding: 10px; font-weight: bold;">Scheduled:</td>
            <td style="padding: 10px;">{{scheduled_date}}</td>
        </tr>
        <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold;">Address:</td>
            <td style="padding: 10px;">{{job_address}}</td>
        </tr>
        <tr>
            <td style="padding: 10px; font-weight: bold;">Description:</td>
            <td style="padding: 10px;">{{job_description}}</td>
        </tr>
    </table>
    <p>Please check the app for full details and materials list.</p>
    <p style="margin-top: 30px; color: #666; font-size: 12px;">
        This is an automated message from Pem2 Services.
    </p>
</body>
</html>',
    'Sent to technician when assigned to a new job'
),

-- Schedule Change (notify technician)
(
    'schedule_changed',
    'Schedule Change Notification',
    'Schedule Update for {{scheduled_date}}',
    '<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #f57c00; border-bottom: 2px solid #f57c00; padding-bottom: 10px;">Schedule Update</h2>
    <p>Your schedule has been updated.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold; width: 140px;">Date:</td>
            <td style="padding: 10px;">{{scheduled_date}}</td>
        </tr>
        <tr>
            <td style="padding: 10px; font-weight: bold;">Change:</td>
            <td style="padding: 10px;">{{change_description}}</td>
        </tr>
        <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold;">Updated By:</td>
            <td style="padding: 10px;">{{updated_by}}</td>
        </tr>
    </table>
    <p>Please check the app for your updated schedule.</p>
    <p style="margin-top: 30px; color: #666; font-size: 12px;">
        This is an automated message from Pem2 Services.
    </p>
</body>
</html>',
    'Sent to technician when their schedule is changed'
),

-- Low Stock Alert (notify admin/managers)
(
    'low_stock_alert',
    'Low Stock Alert',
    'Low Stock Alert: {{item_count}} Items Need Reordering',
    '<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #d32f2f; border-bottom: 2px solid #d32f2f; padding-bottom: 10px;">Low Stock Alert</h2>
    <p>The following inventory items are at or below minimum stock levels:</p>
    {{item_list}}
    <p>Please review and place orders as needed.</p>
    <p style="margin-top: 30px; color: #666; font-size: 12px;">
        This is an automated message from Pem2 Services.
    </p>
</body>
</html>',
    'Daily digest of items below minimum stock level'
),

-- License Expiring (notify admin/employee)
(
    'license_expiring',
    'License Expiration Warning',
    'License Expiring: {{employee_name}}',
    '<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #ff8f00; border-bottom: 2px solid #ff8f00; padding-bottom: 10px;">License Expiration Warning</h2>
    <p>An electrical license is expiring soon.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold; width: 140px;">Employee:</td>
            <td style="padding: 10px;">{{employee_name}}</td>
        </tr>
        <tr>
            <td style="padding: 10px; font-weight: bold;">License #:</td>
            <td style="padding: 10px;">{{license_number}}</td>
        </tr>
        <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold;">State:</td>
            <td style="padding: 10px;">{{license_state}}</td>
        </tr>
        <tr>
            <td style="padding: 10px; font-weight: bold;">Expires:</td>
            <td style="padding: 10px; color: #d32f2f; font-weight: bold;">{{expiration_date}}</td>
        </tr>
        <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold;">Days Until:</td>
            <td style="padding: 10px;">{{days_until_expiry}}</td>
        </tr>
    </table>
    <p>Please ensure renewal is completed before the expiration date.</p>
    <p style="margin-top: 30px; color: #666; font-size: 12px;">
        This is an automated message from Pem2 Services.
    </p>
</body>
</html>',
    'Sent when an employee license is about to expire'
),

-- Call-Out / Sick Day (notify admin/managers)
(
    'callout_notification',
    'Employee Call-Out',
    'Call-Out: {{employee_name}} - {{callout_date}}',
    '<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #7b1fa2; border-bottom: 2px solid #7b1fa2; padding-bottom: 10px;">Employee Call-Out</h2>
    <p>An employee has called out.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold; width: 140px;">Employee:</td>
            <td style="padding: 10px;">{{employee_name}}</td>
        </tr>
        <tr>
            <td style="padding: 10px; font-weight: bold;">Date:</td>
            <td style="padding: 10px;">{{callout_date}}</td>
        </tr>
        <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold;">Type:</td>
            <td style="padding: 10px;">{{callout_type}}</td>
        </tr>
        <tr>
            <td style="padding: 10px; font-weight: bold;">Reason:</td>
            <td style="padding: 10px;">{{callout_reason}}</td>
        </tr>
    </table>
    <p>Please review the schedule for any jobs that may need reassignment.</p>
    <p style="margin-top: 30px; color: #666; font-size: 12px;">
        This is an automated message from Pem2 Services.
    </p>
</body>
</html>',
    'Sent to managers when an employee calls out sick'
)

ON CONFLICT (template_key) DO NOTHING;

-- Update the company name in existing templates from "MA Electrical" to "Pem2 Services"
UPDATE email_templates
SET body_template = REPLACE(body_template, 'MA Electrical', 'Pem2 Services'),
    subject_template = REPLACE(subject_template, 'MA Electrical', 'Pem2 Services')
WHERE body_template LIKE '%MA Electrical%' OR subject_template LIKE '%MA Electrical%';

-- Add notification preference types for the new notifications
INSERT INTO user_notification_preferences (username, notification_type, enabled, delivery_method)
SELECT u.username, nt.type, TRUE, 'in_app'
FROM users u
CROSS JOIN (
    VALUES
        ('pto'),
        ('job_assignment'),
        ('schedule_change'),
        ('low_stock'),
        ('license_expiry'),
        ('callout')
) AS nt(type)
ON CONFLICT (username, notification_type) DO NOTHING;
