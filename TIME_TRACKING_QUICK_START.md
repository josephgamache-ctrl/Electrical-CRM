# Time Tracking - Quick Start Guide

## ✅ Deployment Complete!

All time tracking features have been successfully deployed to your system!

## What Was Done

1. ✅ **Database Migration** - Created 3 new tables:
   - `time_entries` - Stores employee hours worked
   - `employee_pay_rates` - Tracks pay rates over time
   - `job_billing_rates` - Customer billing rates

2. ✅ **Default Data Seeded**:
   - **Billing Rates**:
     - Standard Residential: $95/hr
     - Commercial: $125/hr
     - Emergency Service: $150/hr
     - Service Call: $85/hr

   - **Employee Pay Rates**:
     - joseph: $50/hr (Owner rate)
     - warehouse: $25/hr

3. ✅ **Backend API** - 8 new endpoints ready
4. ✅ **Frontend Component** - Time Entry page added
5. ✅ **Navigation** - "Time Entry" card added to home screen

## How to Use

### For Employees

1. **Login to the system**
   - Go to http://localhost:3001 (or your server URL)
   - Login with your username and password

2. **Navigate to Time Entry**
   - Click the **"Time Entry"** card on the home screen (purple clock icon)

3. **Select the date** you worked
   - Default is today's date
   - You can change it to enter hours for other days this week

4. **Enter your hours**
   - Jobs are organized by priority:
     - **Assigned to You** (your jobs first)
     - **Active Jobs** (currently in progress)
     - **Scheduled Jobs** (upcoming jobs)
     - **Other Jobs** (all other available jobs)

   - Type hours in the "Hours Worked" field (decimals OK: 8.5, 2.25, etc.)
   - A green checkmark appears when hours are entered
   - Optionally add notes about the work

5. **Submit your time**
   - A floating button appears at bottom-right when you have entries
   - Shows total hours and number of jobs
   - Click **"Submit Time Entries"** to save
   - Success message confirms your time was saved

6. **Edit your timecard**
   - You can edit entries until Sunday night at 11:59 PM
   - After that, the week locks for payroll

### For Managers/Admins

**View time entries on work orders:**
- When viewing a work order, you'll see all time entries
- Shows which employees worked, how many hours, and the costs

**Lock weeks for payroll (Admins only):**
- Use the API endpoint to lock completed weeks
- Or set up automatic weekly locking (see documentation)

## Testing the System

Try this quick test:

1. Login to http://localhost:3001
2. Click "Time Entry" on home
3. Select today's date
4. Find a job in the list
5. Enter "8" hours
6. Add a note like "Testing time entry"
7. Click the floating submit button
8. You should see "Successfully saved 1 time entries"
9. Refresh the page - you'll see "Already Entered" chip on that job

## Current Rates

### Your Pay Rate
- joseph: $50/hour
- warehouse: $25/hour

### Customer Billing Rates
- Standard jobs: $95/hour
- Commercial: $125/hour
- Emergency: $150/hour
- Service calls: $85/hour

**To add rates for other employees**, run this SQL:

```sql
docker exec -i ma_electrical-db psql -U postgres -d ma_electrical -c "
INSERT INTO employee_pay_rates (employee_username, hourly_rate, overtime_rate, job_title, effective_from, created_by)
VALUES ('username_here', 30.00, 45.00, 'Electrician', CURRENT_DATE, 'joseph');
"
```

## Features Included

✅ Date-first entry (prevents forgetting the date)
✅ Smart job prioritization (assigned jobs first)
✅ Batch submission (enter multiple jobs at once)
✅ Week-based locking (edit until Sunday night)
✅ Dual rate tracking (customer billing vs employee pay)
✅ Visual feedback (check marks, chips, borders)
✅ Mobile responsive design
✅ Already entered detection
✅ Total hours calculation
✅ Optional notes per entry

## Week Locking Schedule

- **Monday-Saturday**: Enter and edit time freely
- **Sunday**: Can still enter time until 11:59 PM
- **Monday 12:00 AM**: Week automatically locks
- **After lock**: Cannot edit locked weeks (payroll processing)

## Need Help?

See the full documentation: [TIME_TRACKING_IMPLEMENTATION.md](TIME_TRACKING_IMPLEMENTATION.md)

## Next Steps (Optional)

1. **Add pay rates for other employees** (see SQL above)
2. **Customize billing rates** for specific customers
3. **Set up automatic weekly locking** (cron job)
4. **Review the reports** in the database views:
   - `weekly_timecard_summary`
   - `job_labor_summary`
   - `daily_time_detail`

---

**Status**: ✅ READY TO USE!

Your time tracking system is live and ready for employees to start entering hours.
