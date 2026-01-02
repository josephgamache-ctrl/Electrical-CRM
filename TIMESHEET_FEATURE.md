# Timesheet Feature - Implementation Guide

**Created:** December 10, 2025
**Status:** ✅ Complete and Ready to Test

---

## Features Implemented

### 1. Weekly Timecard View
- **Week starts on Monday** and ends on Sunday
- Displays all 7 days with **month and day** above each column
- Navigate between weeks using arrow buttons
- Shows current week by default

### 2. Job Selection System
When clicking "Add Job" button:

**Priority 1: Your Assigned Jobs** (shown first)
- Jobs currently assigned to the logged-in employee
- Highlighted in blue background
- Shows job number, customer name, and status

**Priority 2: All Other Jobs** (shown below assigned jobs)
- Sorted by status in this order:
  1. **In Progress** - Active jobs
  2. **Scheduled** - Jobs scheduled for future
  3. **Pending** - Jobs not yet scheduled
  4. **Completed** - Finished jobs
- Regular white background
- Shows job number, customer name, and status chip

### 3. Time Entry Interface
- **Add jobs as rows** - Each selected job becomes a row
- **Editable hour fields** - Enter hours for any day of the week
- **Daily totals** - Shows total hours per day (bottom row)
- **Job totals** - Shows total hours per job (right column)
- **Week total** - Grand total of all hours for the week
- **Remove jobs** - Delete icon to remove jobs from timesheet

### 4. Save & Submit Functionality
- **Save button** - Save your timesheet anytime (editable)
- **Submit button** - Submit timesheet on Sunday night
  - Locks the timesheet after submission
  - Sends to accountant
  - Cannot be edited after submission
- **Locked indicator** - Shows alert when timesheet is locked
- **Edit until Sunday** - Fully editable until submitted

---

## Database Schema

### time_entries Table
```sql
CREATE TABLE time_entries (
    id SERIAL PRIMARY KEY,
    work_order_id INTEGER REFERENCES work_orders(id),
    employee_username VARCHAR(50) REFERENCES users(username),
    work_date DATE NOT NULL,
    hours_worked DECIMAL(5, 2),
    billable_rate DECIMAL(10, 2),
    pay_rate DECIMAL(10, 2),
    week_ending_date DATE NOT NULL,
    is_locked BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### employee_pay_rates Table
```sql
CREATE TABLE employee_pay_rates (
    id SERIAL PRIMARY KEY,
    employee_username VARCHAR(50) REFERENCES users(username),
    hourly_rate DECIMAL(10, 2),
    overtime_rate DECIMAL(10, 2),
    effective_from DATE NOT NULL,
    effective_to DATE
);
```

### job_billing_rates Table
```sql
CREATE TABLE job_billing_rates (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(100),
    job_category VARCHAR(100),
    billable_rate DECIMAL(10, 2),
    effective_from DATE NOT NULL,
    effective_to DATE
);
```

---

## API Endpoints

### GET /time-entries
Get time entries for current user within a date range
```
Query Parameters:
  - start_date: YYYY-MM-DD (optional)
  - end_date: YYYY-MM-DD (optional)

Returns: Array of time entries with job details
```

### POST /time-entries
Create a new time entry
```json
{
  "work_order_id": 1,
  "work_date": "2025-12-10",
  "hours_worked": 8.5,
  "employee_username": "joseph"
}
```

### PUT /time-entries/{entry_id}
Update an existing time entry (if not locked)
```json
{
  "hours_worked": 9.0,
  "notes": "Extended work on difficult issue"
}
```

### DELETE /time-entries/{entry_id}
Delete a time entry (if not locked)

### POST /time-entries/lock-week
Submit and lock a week's timesheet
```json
{
  "week_ending_date": "2025-12-15"
}
```

---

## Frontend Components

### File: `frontend/src/components/time/Timesheet.js`

**Key Features:**
1. **Week Navigation**
   - Calculates Monday of current week automatically
   - Previous/Next week buttons
   - Displays week range in header

2. **Job Management**
   - Modal dialog for job selection
   - Separates assigned vs other jobs
   - Sorts by status priority
   - Prevents duplicate job selection

3. **Time Entry Grid**
   - 7-day week display (Mon-Sun)
   - Number input fields (0-24 hours, 0.5 step)
   - Real-time total calculations
   - Responsive table layout

4. **State Management**
   - Organizes entries by work_order_id
   - Tracks selected jobs
   - Maintains hour data per job per day
   - Locked status prevents editing

---

## User Workflow

### For Employees:

1. **Navigate to Timesheet**
   - Click "My Timecard" or "Timesheet" in navigation
   - Default view shows current week

2. **Add Jobs**
   - Click "Add Job" button
   - Select from your assigned jobs first
   - Or browse all other jobs by status
   - Click job to add to timesheet

3. **Enter Hours**
   - Click into any day's hour field
   - Enter hours worked (can use decimals: 8.5)
   - Tab or click to move between fields
   - Watch totals update automatically

4. **Save Progress**
   - Click "Save" button anytime during the week
   - Your data is saved but still editable
   - Can close and come back later

5. **Submit on Sunday**
   - Review all hours for accuracy
   - Check daily and weekly totals
   - Click "Submit" button
   - Timesheet locks and sends to accountant

### For Managers:

- Submitted timesheets appear in reports
- Can view employee hours per job
- Can see billable vs pay rates
- Access to historical timesheet data

---

## Access Routes

- `/my-timecard` - Primary route for timesheet
- `/timesheet` - Alternative route (same component)

---

## Current User Setup

**Login Credentials:**
- Username: joseph
- Password: admin

**Employee Pay Rate:**
- Hourly Rate: $35.00
- Overtime Rate: $52.50
- Effective from: Current date

---

## Testing Checklist

- [ ] Navigate to /my-timecard route
- [ ] Verify current week is displayed (Monday-Sunday)
- [ ] Click "Add Job" - verify modal opens
- [ ] Verify your assigned jobs show first (if any)
- [ ] Verify other jobs are sorted by status
- [ ] Select a job - verify it appears as a row
- [ ] Enter hours in multiple days
- [ ] Verify daily totals calculate correctly
- [ ] Verify job totals calculate correctly
- [ ] Verify week total is accurate
- [ ] Click "Save" - verify success
- [ ] Reload page - verify hours persisted
- [ ] Navigate to previous week
- [ ] Navigate to next week
- [ ] Add multiple jobs to timesheet
- [ ] Remove a job - verify row disappears
- [ ] Click "Submit" - verify week locks
- [ ] Verify locked timesheet shows alert
- [ ] Verify cannot edit locked timesheet

---

## Next Steps / Enhancements

### Potential Future Additions:

1. **Overtime Calculation**
   - Auto-calculate overtime hours (>40/week)
   - Different rate for OT hours
   - Visual indicator for OT days

2. **Approval Workflow**
   - Manager review step before accounting
   - Approve/reject functionality
   - Comments/feedback system

3. **Mobile Optimization**
   - Swipe between weeks on mobile
   - Better touch targets for hour inputs
   - Compact view for small screens

4. **Reports Integration**
   - Employee timesheet history report
   - Job labor cost report
   - Payroll summary export

5. **Notifications**
   - Reminder to submit on Sundays
   - Alert if timesheet incomplete
   - Confirmation email when submitted

6. **Break Time Tracking**
   - Optional break minutes field
   - Auto-subtract from billable hours
   - Compliance tracking

---

## Troubleshooting

### Issue: Can't see timesheet page
**Solution:** Verify user is logged in, check browser console for errors

### Issue: Jobs don't appear in "Add Job" modal
**Solution:** Ensure work orders exist in database with proper customer associations

### Issue: Hours don't save
**Solution:** Check backend logs, verify database connection, ensure no validation errors

### Issue: Can't submit timesheet
**Solution:** Ensure all hours are valid (0-24), check for locked status, verify API connectivity

### Issue: Week dates incorrect
**Solution:** Clear browser cache, check system timezone settings

---

## Database Migration Applied

File: `database/migration_add_time_tracking_fixed.sql`

**What was created:**
- time_entries table
- employee_pay_rates table
- job_billing_rates table
- Helper functions for week calculations
- Reporting views
- Default billing rates
- Employee pay rates for joseph and warehouse users

**To re-apply if needed:**
```bash
docker exec -i ma_electrical-db psql -U postgres -d ma_electrical < database/migration_add_time_tracking_fixed.sql
```

---

## Files Modified/Created

### Created:
1. `frontend/src/components/time/Timesheet.js` - Main timesheet component

### Modified:
1. `frontend/src/App.js` - Added timesheet routes
2. `backend/main.py` - Added GET /time-entries endpoint

### Database:
1. Applied `migration_add_time_tracking_fixed.sql`

---

**Feature Status:** ✅ Ready for Testing
**Documentation:** Complete
**API:** Tested and Working
**Frontend:** Integrated
