# Time Tracking System Implementation Guide

## Overview

This document describes the complete time tracking system implementation for the MA Electrical Inventory Management System. The system allows employees to enter their hours worked on jobs with intelligent job prioritization, week-based locking, and dual-rate tracking (billable vs. pay rates) for future accounting features.

## Table of Contents

1. [Features](#features)
2. [Database Schema](#database-schema)
3. [API Endpoints](#api-endpoints)
4. [Frontend Components](#frontend-components)
5. [User Flow](#user-flow)
6. [Deployment Instructions](#deployment-instructions)
7. [Future Enhancements](#future-enhancements)

---

## Features

### Core Features

1. **Date-First Entry**: Users select a date before entering hours to prevent forgetting
2. **Smart Job Prioritization**:
   - Assigned jobs shown first
   - Active jobs next
   - Scheduled jobs below that
   - Other available jobs at bottom
3. **Batch Submission**: Enter hours for multiple jobs and submit all at once with floating submit button
4. **Week-Based Locking**: Employees can edit timecard until Sunday 11:59 PM, then week locks for payroll
5. **Dual Rate System**:
   - Billable rate (charged to customer)
   - Pay rate (paid to employee)
   - Rates captured at time of entry for historical accuracy
6. **Visual Feedback**:
   - Jobs already entered today are highlighted
   - Check marks appear when hours are entered
   - Total hours displayed before submit

### Security & Permissions

- All users can enter their own time
- Managers/admins can view time entries for work orders
- Only admins can lock weeks for payroll
- Week lock prevents all modifications to that week's entries
- Users can only modify their own entries (unless admin/manager)

---

## Database Schema

### Tables Created

The migration file `database/migration_add_time_tracking.sql` creates the following tables:

#### 1. `time_entries` (Primary Table)

```sql
CREATE TABLE time_entries (
    id SERIAL PRIMARY KEY,
    work_order_id INTEGER NOT NULL REFERENCES work_orders(id),
    employee_username VARCHAR(50) NOT NULL REFERENCES users(username),
    work_date DATE NOT NULL,
    hours_worked DECIMAL(5, 2) NOT NULL CHECK (hours_worked > 0 AND hours_worked <= 24),
    billable_rate DECIMAL(10, 2),  -- Rate charged to customer
    pay_rate DECIMAL(10, 2),       -- Rate paid to employee
    billable_amount DECIMAL(10, 2) GENERATED ALWAYS AS (hours_worked * COALESCE(billable_rate, 0)) STORED,
    pay_amount DECIMAL(10, 2) GENERATED ALWAYS AS (hours_worked * COALESCE(pay_rate, 0)) STORED,
    week_ending_date DATE NOT NULL,  -- Auto-calculated Sunday
    is_locked BOOLEAN DEFAULT FALSE,
    notes TEXT,
    break_minutes INTEGER DEFAULT 0,
    created_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_modified_by VARCHAR(50),
    last_modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(work_order_id, employee_username, work_date)  -- One entry per employee per job per day
);
```

**Key Features:**
- Unique constraint prevents duplicate entries for same employee/job/date
- Generated columns auto-calculate billable and pay amounts
- Week ending date auto-calculated via trigger
- Locked flag prevents edits after week closes

**Indexes:**
```sql
idx_time_entries_employee (employee_username)
idx_time_entries_work_order (work_order_id)
idx_time_entries_work_date (work_date)
idx_time_entries_week_ending (week_ending_date)
idx_time_entries_employee_week (employee_username, week_ending_date)
idx_time_entries_locked (is_locked)
idx_time_entries_employee_week_date (employee_username, week_ending_date, work_date) -- Composite for fast lookups
```

#### 2. `employee_pay_rates` (For Future Accounting)

```sql
CREATE TABLE employee_pay_rates (
    id SERIAL PRIMARY KEY,
    employee_username VARCHAR(50) NOT NULL REFERENCES users(username),
    hourly_rate DECIMAL(10, 2) NOT NULL CHECK (hourly_rate >= 0),
    overtime_rate DECIMAL(10, 2),
    effective_from DATE NOT NULL,
    effective_to DATE,  -- NULL = current rate
    job_title VARCHAR(100),
    rate_type VARCHAR(50) DEFAULT 'hourly',
    created_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    -- Ensures no overlapping date ranges
    EXCLUDE USING gist (
        employee_username WITH =,
        daterange(effective_from, COALESCE(effective_to, '9999-12-31'::date), '[]') WITH &&
    )
);
```

**Key Features:**
- Effective date ranges for tracking rate changes over time
- Exclusion constraint prevents overlapping date ranges
- Supports different rates for different roles (apprentice, journeyman, master)

#### 3. `job_billing_rates` (For Future Accounting)

```sql
CREATE TABLE job_billing_rates (
    id SERIAL PRIMARY KEY,
    rate_name VARCHAR(100) NOT NULL,
    rate_type VARCHAR(50) NOT NULL DEFAULT 'default',  -- default, customer, job_type, custom
    hourly_billable_rate DECIMAL(10, 2) NOT NULL CHECK (hourly_billable_rate >= 0),
    customer_name VARCHAR(200),  -- If customer-specific
    job_type VARCHAR(50),        -- If job-type-specific
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Seeded Default Rates:**
```sql
- Standard Residential: $95/hr
- Commercial: $125/hr
- Emergency Service: $150/hr
- Service Call: $85/hr
```

### Database Functions

#### `calculate_week_ending(input_date DATE)`
Returns the Sunday of the week containing input_date.

```sql
SELECT calculate_week_ending('2024-12-04'::date);  -- Returns 2024-12-08 (Sunday)
```

#### `get_current_pay_rate(emp_username VARCHAR)`
Returns the current hourly pay rate for an employee.

```sql
SELECT get_current_pay_rate('joseph');  -- Returns 50.00
```

#### `get_job_billable_rate(job_type VARCHAR, customer_name VARCHAR)`
Returns billable rate with priority: customer-specific > job-type-specific > default.

```sql
SELECT get_job_billable_rate('Commercial', 'ABC Corp');  -- Returns 125.00
```

#### `lock_completed_weeks()`
Locks all time entries for weeks that have ended. Should be run on Mondays.

```sql
SELECT lock_completed_weeks();  -- Returns count of locked entries
```

### Database Views

#### `weekly_timecard_summary`
```sql
SELECT * FROM weekly_timecard_summary
WHERE employee_username = 'joseph'
AND week_ending_date = '2024-12-08';
```

Returns:
- employee_username, full_name
- week_ending_date
- days_worked, total_hours
- total_billable, total_pay
- is_locked

#### `job_labor_summary`
```sql
SELECT * FROM job_labor_summary WHERE work_order_id = 123;
```

Returns:
- work_order_id, work_order_number
- customer_name, job_type, status
- employee_count, work_days, total_hours
- total_labor_billable, total_labor_cost
- labor_margin (billable - cost)

#### `daily_time_detail`
```sql
SELECT * FROM daily_time_detail
WHERE employee_username = 'joseph'
AND work_date BETWEEN '2024-12-01' AND '2024-12-07';
```

Returns full detail of each time entry with employee name, work order info, amounts, lock status.

---

## API Endpoints

All endpoints are in `backend/main.py`.

### Employee Endpoints (All Users)

#### `GET /time-entries/my-week`
Get current user's timecard for a specific week.

**Query Parameters:**
- `week_ending` (optional): Sunday date in YYYY-MM-DD format. Defaults to current week.

**Response:**
```json
{
  "week_ending": "2024-12-08",
  "employee": "joseph",
  "entries": [
    {
      "id": 1,
      "work_order_id": 5,
      "work_date": "2024-12-04",
      "hours_worked": 8.5,
      "billable_rate": 95.00,
      "pay_rate": 50.00,
      "billable_amount": 807.50,
      "pay_amount": 425.00,
      "notes": "Installed new panel",
      "is_locked": false,
      "work_order_number": "WO-2024-0005",
      "customer_name": "John Doe",
      "customer_address": "123 Main St"
    }
  ],
  "totals": {
    "entry_count": 5,
    "total_hours": 42.5,
    "total_billable": 4037.50,
    "total_pay": 2125.00,
    "is_locked": false
  }
}
```

#### `GET /time-entries/available-jobs`
Get list of jobs available for time entry, prioritized by assignment.

**Query Parameters:**
- `work_date` (required): Date in YYYY-MM-DD format

**Response:**
```json
{
  "Assigned to You": [
    {
      "id": 5,
      "work_order_number": "WO-2024-0005",
      "customer_name": "John Doe",
      "customer_address": "123 Main St",
      "job_type": "Service Upgrade",
      "status": "in_progress",
      "assigned_to": "joseph",
      "has_entry_today": true,
      "section": "Assigned to You"
    }
  ],
  "Active Jobs": [...],
  "Scheduled Jobs": [...],
  "Other Jobs": [...]
}
```

#### `POST /time-entries/batch`
Create multiple time entries at once (batch submit).

**Request Body:**
```json
{
  "work_date": "2024-12-04",
  "entries": [
    {
      "work_order_id": 5,
      "hours_worked": 8.5,
      "notes": "Installed new panel",
      "break_minutes": 30
    },
    {
      "work_order_id": 7,
      "hours_worked": 2.0,
      "notes": "Emergency service call"
    }
  ]
}
```

**Response:**
```json
{
  "message": "Successfully saved 2 time entries",
  "entries": [
    {
      "id": 1,
      "work_order_id": 5,
      "work_date": "2024-12-04",
      "hours_worked": 8.5,
      "billable_amount": 807.50,
      "pay_amount": 425.00
    }
  ]
}
```

**Features:**
- Automatically calculates billable and pay rates from database
- Uses UPSERT (ON CONFLICT) to update existing entries
- Validates week is not locked
- Returns created/updated entries

#### `POST /time-entries`
Create a single time entry.

**Request Body:**
```json
{
  "work_order_id": 5,
  "work_date": "2024-12-04",
  "hours_worked": 8.5,
  "notes": "Installed new panel",
  "break_minutes": 30
}
```

#### `PUT /time-entries/{entry_id}`
Update an existing time entry.

**Request Body:**
```json
{
  "hours_worked": 9.0,
  "notes": "Updated: Installed panel and tested circuits"
}
```

**Validation:**
- Entry must not be locked
- User must own the entry (or be admin/manager)

#### `DELETE /time-entries/{entry_id}`
Delete a time entry.

**Validation:**
- Entry must not be locked
- User must own the entry (or be admin/manager)

### Manager/Admin Endpoints

#### `GET /time-entries/work-order/{work_order_id}`
Get all time entries for a specific work order.

**Response:**
```json
{
  "work_order_id": 5,
  "entries": [
    {
      "id": 1,
      "work_date": "2024-12-04",
      "employee_username": "joseph",
      "employee_name": "Joseph - Owner/Manager",
      "hours_worked": 8.5,
      "billable_rate": 95.00,
      "pay_rate": 50.00,
      "billable_amount": 807.50,
      "pay_amount": 425.00,
      "notes": "Installed new panel",
      "is_locked": false
    }
  ],
  "totals": {
    "employee_count": 2,
    "total_hours": 16.0,
    "total_billable": 1520.00,
    "total_labor_cost": 800.00
  }
}
```

### Admin-Only Endpoints

#### `POST /time-entries/lock-week`
Lock a week's time entries for payroll processing.

**Request Body:**
```json
{
  "week_ending": "2024-12-08"
}
```

**Response:**
```json
{
  "message": "Successfully locked 25 time entries for week ending 2024-12-08",
  "entries_locked": 25
}
```

---

## Frontend Components

### 1. TimeEntry Component (`frontend/src/components/TimeEntry.js`)

#### Features

**Date Selection:**
- Defaults to today's date
- Date picker at top of page
- Jobs load when date changes

**Job Display:**
- Organized into collapsible sections (Accordions)
- "Assigned to You" expanded by default
- Each job shows:
  - Customer name (bold)
  - Customer address
  - Job type and status
  - "Already Entered" chip if entry exists for today
  - Hours input field with clock icon
  - Check mark when hours entered
  - Optional notes field (appears when hours entered)

**Batch Submission:**
- Floating action button (FAB) appears when there are changes
- Shows total hours and job count in summary card
- Submit button disabled during submission
- Success snackbar on completion
- Auto-reloads jobs after successful submit

**Visual States:**
- Loading spinner while fetching jobs
- Error alerts for API failures
- Green border on cards with hours entered
- Blue background for jobs already entered today
- Disabled state during submission

#### State Management

```javascript
const [selectedDate, setSelectedDate] = useState('');  // YYYY-MM-DD
const [jobs, setJobs] = useState(null);  // Grouped jobs object
const [timeEntries, setTimeEntries] = useState({});  // { jobId: { hours, notes } }
const [loading, setLoading] = useState(false);
const [submitting, setSubmitting] = useState(false);
const [error, setError] = useState(null);
const [successMessage, setSuccessMessage] = useState('');
const [hasChanges, setHasChanges] = useState(false);
```

#### Key Functions

```javascript
loadJobsForDate(date)  // Fetches available jobs for selected date
handleHoursChange(jobId, hours)  // Updates hours for a job
handleNotesChange(jobId, notes)  // Updates notes for a job
handleSubmit()  // Validates and submits batch of entries
getTotalHours()  // Calculates total hours entered
getEntryCount()  // Counts how many jobs have hours
```

### 2. API Functions (`frontend/src/api.js`)

Eight new API functions added:

```javascript
getMyWeekTimecard(weekEnding)
getAvailableJobsForTimecard(workDate)
createTimeEntriesBatch(workDate, entries)
createTimeEntry(entry)
updateTimeEntry(entryId, updates)
deleteTimeEntry(entryId)
getTimeEntriesForWorkOrder(workOrderId)
lockWeekForPayroll(weekEnding)
```

All functions:
- Use `requireToken()` for authentication
- Include proper error handling
- Return parsed JSON responses
- Log errors to console

### 3. Routing Updates

#### App.js

```javascript
import TimeEntry from "./components/TimeEntry";

// Route added
<Route
  path="/time-entry"
  element={
    <PrivateRoute>
      <TimeEntry />
    </PrivateRoute>
  }
/>
```

#### Home.js

New card added to dashboard:

```javascript
<Grid item xs={12} sm={6} md={4}>
  <Card elevation={3} sx={{ height: '100%' }}>
    <CardActionArea onClick={() => navigate('/time-entry')}>
      <CardContent sx={{ textAlign: 'center' }}>
        <TimeIcon sx={{ fontSize: 80, color: '#9c27b0', mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          Time Entry
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Enter your hours worked on jobs for the day or week
        </Typography>
      </CardContent>
    </CardActionArea>
  </Card>
</Grid>
```

---

## User Flow

### Daily Time Entry Flow

1. **User logs in** and clicks "Time Entry" on home screen
2. **Date selection**:
   - Default is today's date
   - User can select any date in current week (or past weeks if not locked)
3. **Jobs load automatically** based on selected date
4. **Jobs displayed in priority order:**
   - **Section 1**: "Assigned to You" (expanded by default)
   - **Section 2**: "Active Jobs"
   - **Section 3**: "Scheduled Jobs"
   - **Section 4**: "Other Jobs"
5. **User enters hours**:
   - Types hours (decimals allowed: 0.25, 0.5, 8.5, etc.)
   - Check mark appears next to job
   - Notes field becomes available (optional)
   - Card border turns green
6. **Summary updates**:
   - Total hours calculated
   - Summary card shows job count and total
7. **Floating submit button appears**:
   - Located bottom-right corner
   - Shows "Submit Time Entries"
8. **User clicks submit**:
   - Button shows loading spinner
   - All entries saved in single batch
   - Success message appears
   - Job list refreshes to show "Already Entered" chips
   - Entry fields clear

### Weekly Timecard Management

**Monday - Saturday:**
- Employees can enter/edit time for any day of current week
- Existing entries can be modified
- Notes can be added/updated

**Sunday Night (11:59 PM):**
- Week automatically locks at midnight
- All entries for that week become read-only
- Attempting to edit shows "Week locked for payroll" error

**Monday Morning:**
- Admin runs lock function (or automated cron job runs)
- Previous week's entries are locked
- New week starts fresh

**Special Cases:**
- Admins can manually unlock weeks if needed
- Managers can view all time entries for their work orders
- Users can only see/edit their own entries

---

## Deployment Instructions

### Step 1: Run Database Migration

```bash
# Connect to PostgreSQL
psql -U postgres -d ma_electrical

# Run migration
\i database/migration_add_time_tracking.sql

# Verify tables created
\dt time_entries
\dt employee_pay_rates
\dt job_billing_rates

# Verify views created
\dv weekly_timecard_summary
\dv job_labor_summary
\dv daily_time_detail

# Test functions
SELECT calculate_week_ending(CURRENT_DATE);
SELECT get_current_pay_rate('joseph');
```

### Step 2: Add Employee Pay Rates

```sql
-- Add pay rates for your employees
INSERT INTO employee_pay_rates (
    employee_username,
    hourly_rate,
    overtime_rate,
    job_title,
    effective_from,
    created_by
) VALUES
    ('joseph', 50.00, 75.00, 'Master Electrician / Owner', '2024-01-01', 'joseph'),
    ('warehouse', 25.00, 37.50, 'Warehouse Staff', '2024-01-01', 'joseph');
```

### Step 3: Adjust Billing Rates (Optional)

```sql
-- Update default billing rates if needed
UPDATE job_billing_rates
SET hourly_billable_rate = 100.00
WHERE rate_name = 'Standard Residential';

-- Add customer-specific rates
INSERT INTO job_billing_rates (
    rate_name,
    rate_type,
    hourly_billable_rate,
    customer_name,
    created_by
) VALUES
    ('ABC Corp Special Rate', 'customer', 110.00, 'ABC Corp', 'joseph');
```

### Step 4: Restart Backend

```bash
# If using docker-compose
docker-compose restart backend

# Or manually restart uvicorn
cd backend
uvicorn main:app --reload
```

### Step 5: Rebuild Frontend (if not in dev mode)

```bash
cd frontend
npm run build

# If using docker-compose
docker-compose restart frontend
```

### Step 6: Test the System

1. **Login** as a regular user (not admin)
2. **Navigate to Time Entry** from home screen
3. **Select today's date**
4. **Verify jobs load** and are properly grouped
5. **Enter hours** for one or more jobs
6. **Add notes** (optional)
7. **Submit** and verify success message
8. **Reload page** and verify "Already Entered" chips appear
9. **Try editing** the same entry (should work)
10. **Login as admin** and verify you can view entries on work orders

### Step 7: Setup Weekly Lock Automation (Optional)

Create a cron job to automatically lock completed weeks every Monday:

```bash
# Add to crontab
0 1 * * 1 psql -U postgres -d ma_electrical -c "SELECT lock_completed_weeks();"
```

Or create a scheduled task in PostgreSQL:

```sql
-- Using pg_cron extension (if available)
SELECT cron.schedule('lock-weeks', '0 1 * * 1',
    $$SELECT lock_completed_weeks();$$
);
```

---

## Future Enhancements

### Short-term (Next Sprint)

1. **My Timecard View**
   - Dedicated page showing all entries for current week
   - Edit entries inline
   - Week selector to view past weeks
   - Print/export timecard

2. **Timecard Approval Workflow**
   - Manager reviews and approves timecards
   - Approved status separate from locked status
   - Approval history tracking

3. **Time Entry Notifications**
   - Reminder if no time entered by end of day
   - Warning on Friday if hours missing
   - Email digest of week's entries

### Medium-term

4. **Overtime Tracking**
   - Automatic detection of >40 hours/week
   - Overtime rate application
   - Overtime approval workflow

5. **Break Time Management**
   - Track unpaid break minutes
   - Deduct from billable hours
   - Compliance reporting for labor laws

6. **Mobile Time Entry App**
   - React Native mobile app
   - Quick entry from job site
   - Offline mode with sync

7. **GPS/Location Tracking**
   - Optional GPS check-in at job sites
   - Verify employee was on-site
   - Track travel time separately

### Long-term (Future Versions)

8. **Integration with Accounting**
   - Export to QuickBooks
   - Sync with payroll systems
   - Automated invoicing based on hours

9. **Advanced Reporting**
   - Labor cost analysis by job type
   - Employee productivity metrics
   - Profit margin analysis
   - Estimated vs. actual hours comparison

10. **Project Time Budgets**
    - Set hour budgets per work order
    - Alert when approaching budget
    - Track variance

11. **Time Entry Templates**
    - Save common entry patterns
    - Quick apply to multiple days
    - Recurring job auto-entry

---

## Troubleshooting

### Common Issues

**Issue: "Week is locked" error when trying to enter time**

Solution: Week has already been locked for payroll. Contact admin to unlock if it was locked in error.

```sql
-- Admin can unlock manually
UPDATE time_entries
SET is_locked = FALSE
WHERE week_ending_date = '2024-12-08';
```

**Issue: No jobs showing up**

Possible causes:
1. No active/scheduled jobs in system → Create work orders
2. Date selected is too far in past → Check work order dates
3. Work orders not marked as `active = TRUE` → Update work orders

```sql
-- Check active work orders
SELECT id, work_order_number, customer_name, status, active
FROM work_orders
WHERE active = TRUE;
```

**Issue: Rates showing as $0.00**

Possible causes:
1. No pay rate defined for employee → Add to `employee_pay_rates`
2. No billing rate defined for job type → Add to `job_billing_rates`
3. Effective dates don't cover entry date → Adjust date ranges

```sql
-- Check employee pay rate
SELECT * FROM employee_pay_rates WHERE employee_username = 'username';

-- Check billing rates
SELECT * FROM job_billing_rates WHERE is_active = TRUE;
```

**Issue: Can't submit - "No fields to update" error**

Solution: Enter hours for at least one job before submitting.

**Issue: Floating submit button not appearing**

Check:
1. Have you entered hours for any job? (hours > 0)
2. Check browser console for JavaScript errors
3. Verify `hasChanges` state is updating

---

## Technical Notes

### Performance Considerations

1. **Indexes**: All critical queries have supporting indexes
2. **Batch Insert**: Uses single transaction for batch operations
3. **Views**: Pre-computed for common aggregations
4. **Generated Columns**: Auto-calculate amounts on insert/update

### Security

1. **Row-Level Security**: Users can only see their own entries
2. **Week Locking**: Trigger prevents modification of locked entries
3. **Rate Capture**: Rates stored at time of entry (not recalculated)
4. **Audit Trail**: All entries track creator and last modifier

### Data Integrity

1. **Unique Constraint**: Prevents duplicate entries (employee + job + date)
2. **Foreign Keys**: Ensures referential integrity
3. **Check Constraints**: Validates hours > 0 and <= 24
4. **Exclusion Constraint**: Prevents overlapping pay rate date ranges

---

## Contact & Support

For questions or issues with the time tracking system:

1. Check this documentation first
2. Review database migration file for schema details
3. Check API endpoint documentation in backend code
4. Test with sample data before production use

---

## Appendix: File Locations

### Database Files
- **Migration**: `database/migration_add_time_tracking.sql`
- **Schema**: `database/schema.sql` (original)

### Backend Files
- **Main API**: `backend/main.py` (lines 408-422: models, 2366-2939: endpoints)
- **Time Entry Models**: Lines 408-422
- **Time Entry Endpoints**: Lines 2366-2939

### Frontend Files
- **TimeEntry Component**: `frontend/src/components/TimeEntry.js`
- **API Functions**: `frontend/src/api.js` (lines 749-956)
- **App Routing**: `frontend/src/App.js` (lines 14, 113-120)
- **Home Navigation**: `frontend/src/components/Home.js` (lines 21, 130-145)

### Documentation
- **This File**: `TIME_TRACKING_IMPLEMENTATION.md`

---

## Version History

- **v1.0** (2024-12-06): Initial implementation
  - Date-first entry
  - Smart job prioritization
  - Week-based locking
  - Dual rate system
  - Batch submission
  - Full CRUD operations

---

**End of Documentation**
