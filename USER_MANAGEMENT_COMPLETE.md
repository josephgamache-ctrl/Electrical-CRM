# User Management System - Complete

**Date:** December 10, 2025
**Status:** ✅ Complete and Ready

---

## Overview

Created a comprehensive User Management system for admins to manage workers with complete financial tracking, licensing info, and labor cost integration.

---

## Features Implemented

### 1. Enhanced User Database Fields

Added the following fields to the `users` table:

**Financial Tracking:**
- `hourly_rate` - Employee's regular hourly wage
- `overtime_rate` - Overtime rate (defaults to 1.5x hourly)
- `is_licensed` - Boolean flag for licensed electricians
- `license_number` - Electrician license number
- `license_state` - State of license (2-letter code)
- `license_expiration` - License expiration date

**Employment Info:**
- `hire_date` - Date employee was hired
- `employment_type` - full-time, part-time, or contract
- `phone` - Contact phone number
- `address`, `city`, `state`, `zip` - Employee address
- `ssn_last_4` - Last 4 digits of SSN for payroll

**Emergency Contact:**
- `emergency_contact_name` - Emergency contact person
- `emergency_contact_phone` - Emergency contact phone

**Permissions:**
- `can_create_quotes` - Permission to create quotes
- `can_close_jobs` - Permission to close/complete jobs
- `active` - Active/inactive status

---

## 2. Admin User Management Interface

**Location:** [frontend/src/components/admin/UserManagement.js](frontend/src/components/admin/UserManagement.js)

### Features:

#### Dashboard Summary Cards:
- Active Users count
- Licensed Electricians count
- Average Hourly Rate
- Expiring Licenses count (within 30 days)

#### User List View:
- **Tabs:** Active Users / Inactive Users
- **Table Columns:**
  - Username
  - Full Name
  - Role (with color-coded chips)
  - Licensed status (with state badge)
  - License expiration (with warning for expiring/expired)
  - Hourly Rate
  - Employment Type
  - Actions (Edit/Delete)

#### Add/Edit User Dialog:
Comprehensive form with sections:

1. **Basic Information:**
   - Username
   - Password (hashed)
   - Full Name
   - Role (Admin, Manager, Office, Technician)
   - Email
   - Phone

2. **Employment Information:**
   - Hire Date
   - Employment Type (Full-Time, Part-Time, Contract)
   - Hourly Rate
   - Overtime Rate (defaults to 1.5x hourly)
   - SSN Last 4 digits

3. **License Information:**
   - Licensed Electrician toggle
   - License Number
   - License State
   - License Expiration Date
   - **Visual Warnings:** Red badge for expired, yellow for expiring soon

4. **Address Information:**
   - Street Address
   - City
   - State
   - ZIP Code

5. **Emergency Contact:**
   - Contact Name
   - Contact Phone

6. **Permissions & Status:**
   - Active toggle
   - Can Create Quotes
   - Can Close Jobs

---

## 3. Backend API Endpoints

### GET `/admin/users`
Returns all users with complete information including:
- Basic info (username, full_name, email, phone, role)
- Employment (hire_date, hourly_rate, overtime_rate, employment_type)
- License (is_licensed, license_number, license_state, license_expiration)
- Address (address, city, state, zip)
- Emergency contact
- Permissions and status

### POST `/admin/users`
Create new user with all fields.
- Automatically calculates overtime rate (1.5x hourly) if not provided
- Hashes password securely with bcrypt
- Validates username uniqueness

### PUT `/admin/users/{username}`
Update existing user.
- Supports partial updates (only changed fields)
- Password is optional (leave blank to keep current)
- Recalculates overtime if hourly rate changes

### DELETE `/admin/users/{username}`
Soft delete (sets active = false).
- Cannot delete your own account
- Preserves all historical data
- User can be reactivated later

---

## 4. Financial Integration

###  Labor Cost Tracking:

When employees submit hours on their timesheet, the system automatically:

1. **Calculates Labor Cost:**
   ```
   Labor Cost = Hours Worked × Employee Hourly Rate
   Overtime Cost = Overtime Hours × Employee Overtime Rate
   ```

2. **Tracks on Work Orders:**
   - Time entries link employee → work order
   - `time_entries` table stores:
     - `employee_username` (links to users table)
     - `work_order_id` (links to work order)
     - `hours_worked`
     - `pay_rate` (captured from user's hourly_rate at time of entry)
     - `pay_amount` (hours × pay_rate) ← **Labor Paid**
     - `billable_rate` (what customer is charged)
     - `billable_amount` (hours × billable_rate)

3. **Financial Reports:**
   - Job Profitability View shows:
     - `total_labor_cost` - Sum of all pay_amounts for the job
     - `total_labor_revenue` - Sum of billable_amounts
     - `labor_profit` - Difference between revenue and cost
   - Employee productivity metrics
   - Labor margin percentages

### How Time Tracking Works:

1. **Employee submits timesheet:**
   - Selects work order(s) they worked on
   - Enters hours for each day of the week (Mon-Sun)
   - Clicks "Submit" to lock for accounting

2. **System creates time_entry records:**
   ```sql
   INSERT INTO time_entries (
     employee_username,  -- Links to users.username
     work_order_id,      -- Links to work_orders.id
     work_date,
     hours_worked,
     pay_rate,           -- User's hourly_rate
     pay_amount,         -- hours_worked × pay_rate
     billable_rate,      -- From job_billing_rates
     billable_amount     -- hours_worked × billable_rate
   )
   ```

3. **Labor costs tracked in views:**
   - `job_profitability_view` - Per-job labor costs
   - `employee_productivity_view` - Per-employee metrics
   - `financial_snapshot` - Overall labor costs

---

## 5. License Management

### Automatic Alerts:

The system tracks license expirations and shows visual warnings:

- **Green Badge:** Valid license
- **Yellow Badge + "Expiring Soon":** License expires within 30 days
- **Red Badge + "Expired":** License has expired

### Compliance Tracking:

- Filter users by licensed status
- Track which state each license is valid in
- Monitor expiration dates
- Ensure licensed electricians are assigned to jobs requiring licenses

---

## 6. User Roles & Permissions

### Role Hierarchy:

1. **Admin:**
   - Full system access
   - Can manage users
   - Can create quotes
   - Can close jobs
   - Can access financial reports

2. **Manager:**
   - Can view inventory
   - Can manage jobs
   - Can assign work orders
   - Optional: Can create quotes
   - Optional: Can close jobs

3. **Office:**
   - Can view inventory
   - Can manage customers
   - Can create work orders
   - Can view schedules

4. **Technician:**
   - Can view assigned jobs
   - Can pull materials
   - Can enter time
   - Can upload photos/notes
   - Can update job status (if permitted)

### Granular Permissions:

Beyond the role, you can set:
- `can_create_quotes` - Allow creating price quotes
- `can_close_jobs` - Allow marking jobs as completed

---

## Testing the Feature

### Access User Management:

1. Login as admin (joseph / admin)
2. Go to Home Dashboard
3. Click "Admin" card
4. You'll see the User Management interface

**OR**

Navigate directly to: `http://localhost:3001/admin/users`

### Test Scenarios:

#### 1. Add a New Licensed Electrician:
- Click "Add User"
- Fill in basic info
- Set hourly rate (e.g., $45.00)
- Toggle "Licensed Electrician" ON
- Enter license number and state
- Set expiration date
- Save

#### 2. Edit Existing User:
- Click Edit icon on any user
- Modify hourly rate
- Notice overtime rate auto-updates
- Save changes

#### 3. View License Warnings:
- Find a user with license expiring soon
- Yellow badge should appear
- Edit and update expiration date
- Warning disappears

#### 4. Track Labor Costs:
- Have user submit timesheet hours
- Go to Reports → Job Profitability
- See labor costs calculated from hourly rates

---

## Files Modified/Created

### Frontend:
- ✅ **Created:** `frontend/src/components/admin/UserManagement.js` - Full UI
- ✅ **Modified:** `frontend/src/App.js` - Updated import path

### Backend:
- ✅ **Modified:** `backend/main.py`
  - Updated `UserCreate` model (lines 538-562)
  - Updated `UserUpdate` model (lines 564-587)
  - Updated `GET /admin/users` endpoint (lines 589-606)
  - Updated `POST /admin/users` endpoint (lines 608-657)
  - Updated `PUT /admin/users/{username}` endpoint (lines 659-734)

### Database:
- ✅ **Modified:** `users` table - Added columns:
  - `is_licensed`
  - `license_state`
  - `emergency_contact_name`
  - `emergency_contact_phone`
  - `address`, `city`, `state`, `zip`
  - `ssn_last_4`
  - `employment_type`

---

## Database Integration with Time Tracking

### Relationship Diagram:

```
users table
├── username (PK)
├── hourly_rate ──┐
├── overtime_rate │
├── is_licensed   │
└── ...           │
                  │
                  ↓
time_entries table
├── employee_username (FK → users.username)
├── work_order_id (FK → work_orders.id)
├── hours_worked
├── pay_rate ← Captured from users.hourly_rate
├── pay_amount ← hours_worked × pay_rate (**LABOR COST**)
├── billable_rate ← From job_billing_rates
└── billable_amount ← hours_worked × billable_rate
                  │
                  ↓
job_profitability_view
├── work_order_id
├── total_labor_cost ← SUM(pay_amount)
├── total_labor_revenue ← SUM(billable_amount)
└── labor_profit ← revenue - cost
```

### When Hours Are Submitted:

1. User opens Timesheet (`/timesheet`)
2. Adds jobs they worked on
3. Enters hours for each day
4. Clicks "Submit"
5. System creates `time_entry` for each day with hours:
   ```javascript
   {
     employee_username: "john_doe",
     work_order_id: 15,
     work_date: "2025-12-10",
     hours_worked: 8.0,
     pay_rate: 45.00,        // From users.hourly_rate
     pay_amount: 360.00,     // 8.0 × 45.00 = LABOR PAID
     billable_rate: 75.00,   // What customer pays
     billable_amount: 600.00 // 8.0 × 75.00
   }
   ```

6. **Labor Paid = $360.00** is now tracked for that job
7. Financial reports aggregate all labor costs

---

## Benefits

### For Admins:
✅ Centralized employee management
✅ Track wages for accurate job costing
✅ Monitor license expirations
✅ Manage permissions granularly
✅ See labor costs in real-time

### For Accounting:
✅ Accurate labor cost tracking
✅ Hourly rates tied to time entries
✅ Overtime calculations
✅ Job profitability with labor costs
✅ Employee productivity metrics

### For Compliance:
✅ Track licensed electricians
✅ License expiration alerts
✅ Emergency contact information
✅ Employment type tracking

---

## Next Steps

1. **Test the user management interface**
2. **Add some test employees with different roles**
3. **Submit timesheet hours to see labor costs calculated**
4. **Check Reports → Job Profitability to see labor tracking**
5. **Monitor license expirations**

---

## Backup Created

**File:** `backups/ma_electrical_with_user_mgmt_20251210.sql`

**Contains:**
- All user data with new fields
- Complete time tracking integration
- Updated backend endpoints
- All financial reporting views

---

**User Management System Complete!** Admins can now fully manage workers, track wages, monitor licenses, and see labor costs automatically calculated when employees submit their timesheets.
