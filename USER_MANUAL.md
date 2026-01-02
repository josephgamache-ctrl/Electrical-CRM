# Pem2 Services - Complete User Manual

**Version:** 2.0
**Last Updated:** December 2024

---

# Table of Contents

## Part I: Getting Started
1. [Introduction](#1-introduction)
   - 1.1 [System Overview](#11-system-overview)
   - 1.2 [Logging In](#12-logging-in)
   - 1.3 [User Roles and Permissions](#13-user-roles-and-permissions)
   - 1.4 [Navigation Overview](#14-navigation-overview)

## Part II: Home & Dashboards
2. [Home Dashboard](#2-home-dashboard)
3. [Mobile Dashboard (Pem2 Dashboard)](#3-mobile-dashboard-pem2-dashboard)

## Part III: Jobs & Work Orders
4. [Jobs Overview](#4-jobs-overview)
5. [Work Orders (Admin/Manager)](#5-work-orders-adminmanager)
6. [Job Details & Field View](#6-job-details--field-view)

## Part IV: Scheduling & Dispatch
7. [Schedule Overview](#7-schedule-overview)
8. [Dispatch Board](#8-dispatch-board)
9. [Adding Crew to Jobs](#9-adding-crew-to-jobs)
10. [Schedule Conflict Detection](#10-schedule-conflict-detection)

## Part V: Time Tracking & PTO
11. [Timesheet Entry](#11-timesheet-entry)
12. [Requesting Time Off (PTO)](#12-requesting-time-off-pto)
13. [PTO Approval (Admin/Manager)](#13-pto-approval-adminmanager)
14. [Call-Out / Sick Day](#14-call-out--sick-day)

## Part VI: Inventory Management
15. [Inventory Overview](#15-inventory-overview)
16. [Adding & Editing Items](#16-adding--editing-items)
17. [Stock Adjustments](#17-stock-adjustments)
18. [Material Allocation to Jobs](#18-material-allocation-to-jobs)

## Part VII: Customers
19. [Customer Management](#19-customer-management)

## Part VIII: Quotes & Invoices
20. [Creating Quotes](#20-creating-quotes)
21. [Converting Quotes to Work Orders](#21-converting-quotes-to-work-orders)
22. [Invoices](#22-invoices)
23. [Purchase Orders](#23-purchase-orders)

## Part IX: Reports & Analytics
24. [Financial Reports](#24-financial-reports)
25. [Inventory Reports](#25-inventory-reports)
26. [Productivity Reports](#26-productivity-reports)

## Part X: Administration
27. [User Management](#27-user-management)
28. [System Settings](#28-system-settings)
29. [Notifications](#29-notifications)

## Appendices
- [Appendix A: Role Permissions Matrix](#appendix-a-role-permissions-matrix)
- [Appendix B: Status Definitions](#appendix-b-status-definitions)
- [Appendix C: Troubleshooting](#appendix-c-troubleshooting)

---

# Part I: Getting Started

---

# 1. Introduction

## 1.1 System Overview

Pem2 Services is a comprehensive business management system designed for electrical contractors and service companies. The system provides integrated tools for managing every aspect of your business operations.

### Core Features

| Module | Description |
|--------|-------------|
| **Jobs & Work Orders** | Create, track, and manage jobs from estimate to completion |
| **Scheduling & Dispatch** | Assign crews, manage calendars, and dispatch technicians |
| **Time Tracking** | Employee timesheets with job-based hour tracking |
| **PTO Management** | Request and approve time off with schedule integration |
| **Inventory** | Track parts, materials, and supplies with stock levels |
| **Customers** | Manage customer records and service locations |
| **Quotes** | Create multi-tier estimates with good/better/best pricing |
| **Invoices** | Bill customers and track payments |
| **Purchase Orders** | Order materials from vendors |
| **Reports** | Financial, inventory, and productivity analytics |

### System Requirements

Pem2 Services runs in any modern web browser:
- **Recommended:** Google Chrome, Microsoft Edge
- **Supported:** Mozilla Firefox, Safari

The system is fully responsive and works on:
- Desktop computers and laptops
- Tablets (iPad, Android tablets)
- Mobile phones (iOS, Android)

---

## 1.2 Logging In

### Accessing the System

1. Open your web browser
2. Navigate to your company's Pem2 Services URL
3. The login page displays the Pem2 Services logo

### Login Screen Elements

| Field | Description |
|-------|-------------|
| **Username** | Your assigned username (typically first initial + last name) |
| **Password** | Your account password |
| **Sign In Button** | Click to log in to the system |

### To Log In

1. Enter your **Username** in the first field
2. Enter your **Password** in the second field
3. Click **Sign In**

If successful, you'll be taken to the Home dashboard. If credentials are incorrect, an error message will appear.

### Session Duration

Your login session remains active for **1 hour**. After this time, you'll need to sign in again.

### First-Time Login

When you receive your account:
1. Log in with your provided username and temporary password
2. Navigate to **Profile** (click your avatar) to update your information
3. Consider changing your password in **Settings**

---

## 1.3 User Roles and Permissions

The system has four primary user roles, each with different access levels:

### Administrator
**Full system access** including:
- All job and financial functions
- User management (create, edit, deactivate users)
- System settings and configuration
- All reports and analytics
- PTO approval
- Notification management

### Manager
**Supervisory access** including:
- Work order creation and management
- Crew scheduling and dispatch
- Quote creation
- Customer management
- PTO approval

### Technician
**Field worker access** including:
- View assigned jobs (field view without pricing)
- Timesheet entry and hour tracking
- View personal schedule
- Request time off (PTO)
- Document materials used on jobs

### Office
**Administrative support** including:
- Inventory management
- Customer record management
- Invoice processing
- View work orders with pricing

### Quick Permissions Reference

| Feature | Admin | Manager | Technician | Office |
|---------|:-----:|:-------:|:----------:|:------:|
| View Jobs | Full | Full | Field Only | Full |
| Create Work Orders | Yes | Yes | No | No |
| View Pricing | Yes | Yes | No | Yes |
| Manage Crew | Yes | Yes | No | No |
| Timesheet Entry | Yes | Yes | Yes | Yes |
| Request PTO | Yes | Yes | Yes | Yes |
| Approve PTO | Yes | Yes | No | No |
| Manage Users | Yes | No | No | No |
| View Reports | Yes | No | No | No |

---

## 1.4 Navigation Overview

### Top Header Bar

The dark blue header bar appears on every page:

**Left Side:**
- **User Avatar** - Circle showing your initial. Click to open the user menu
- **Back Arrow** (←) - Go to previous page
- **Forward Arrow** (→) - Go forward (if you went back)
- **Page Title** - Current page name (e.g., "Pem2 Services", "Jobs", "Schedule")
- **Role Badge** - Your role displayed below the title (Administrator, Manager, etc.)

**Right Side:**
- **Search Icon** (magnifying glass) - Quick search on supported pages
- **Notification Bell** - View notifications and alerts (shows count badge for unread)
- **Home Icon** - Return to Home dashboard

### User Menu (Click Your Avatar)

Clicking your avatar opens a dropdown menu:

| Option | Description |
|--------|-------------|
| **Home** | Return to the main Home dashboard |
| **Modules** | Expandable list of all available modules |
| **Profile** | View and edit your profile information |
| **Settings** | Access personal settings |
| **Logout** | Sign out of the system |

### Modules Menu

Click "Modules" in the user menu to see all available sections:
- Jobs (All roles)
- Work Orders (Admin/Manager only)
- Schedule (All roles)
- Customers (All roles)
- Inventory (All roles)
- Timesheet (All roles)
- Quotes (Admin/Manager only)
- Invoices (Admin/Office only)
- Purchase Orders (Admin only)
- Reports (Admin only)
- PTO Approval (Admin/Manager only)
- User Management (Admin only)

### Bottom Navigation Bar

The bottom bar provides quick access to common sections:

| Icon | Label | Description |
|------|-------|-------------|
| Home icon | Home | Main dashboard |
| Clipboard | Jobs | Job list and management |
| Calendar | Schedule | View schedules and calendar |
| People | Customers | Customer list |
| Chart (Admin only) | Reports | Reports and analytics |
| Clock | Timesheet | Timesheet entry |

Note: Reports only appears for Admin users, inserted before Timesheet.

---

# Part II: Home & Dashboards

---

# 2. Home Dashboard

The Home dashboard is the main landing page after logging in. It provides quick access to all system modules.

### Dashboard Layout

The Home dashboard displays a grid of large cards, each representing a module:

| Card | Description | Who Can See |
|------|-------------|-------------|
| **Inventory** | Access inventory management | All users |
| **Jobs** | View and manage jobs | All users |
| **Schedule** | View schedules and calendar | All users |
| **Timesheet** | Enter hours and manage time | All users |
| **Work Orders** | Create and manage work orders | Admin, Manager |
| **Admin** | User management and settings | Admin only |
| **Reports** | Financial and operational reports | Admin only |
| **Pem2 Dashboard** | Mobile-optimized dashboard | All users |

### Role-Specific Welcome Message

At the bottom of the Home page, you'll see a message indicating your access level:
- **Admin Access:** "You have full access to all features including work orders with financial data and user management."
- **Manager Access:** "You have access to inventory and job management features."
- **Technician/Office Access:** "You can view inventory and manage jobs. Use the Jobs section to pull materials and document your work."

### Navigating from Home

Click any card to navigate to that module. The card displays:
- A large icon representing the module
- The module name
- A brief description of what the module does

---

# 3. Mobile Dashboard (Pem2 Dashboard)

The Mobile Dashboard provides a mobile-optimized view with today's activity and quick actions. It's ideal for technicians in the field.

### Accessing the Mobile Dashboard

1. From the Home page, click the **Pem2 Dashboard** card
2. Or select it from the Modules menu

### Dashboard Sections

#### Header
The same header bar as other pages with:
- Your avatar and navigation arrows
- "Pem2 Dashboard" title
- Notification bell and home icon

#### Today's Stats Section

A purple/blue gradient section showing:
- **Completion Circle** - Visual ring showing jobs completed vs total jobs today
- **Today's Stats:**
  - Active Jobs - Number of jobs in progress or scheduled
  - Service Calls - Pending service calls requiring attention
  - Jobs Scheduled This Week - Weekly workload overview

#### Today's Jobs

A list of your active jobs showing:
- Job description/title
- Customer name
- Crew avatars showing who's assigned
- **Modify Crew button** (Admin/Manager only) - Group icon to add/edit crew
- Job status indicator (color-coded: Pending, Scheduled, In Progress, etc.)

Click any job to view full details. Click **View All** or **View More** to see all jobs.

#### Service Calls

A list of pending service calls (jobs with type "Service Call" or emergency calls):
- Job description/title
- Customer name
- Crew avatars
- **Modify Crew button** (Admin/Manager only)
- Status indicator

Service calls are sorted by priority (urgent first) then by date.

#### Bottom Navigation

The Mobile Dashboard has its own quick-access bottom navigation (different from main app):

| Button | Label | Goes To | Who Sees |
|--------|-------|---------|----------|
| Assignment icon | Schedule | /schedule | All |
| Work icon | Jobs (or Work) | /jobs (technicians) or /work-orders (admin/manager) | All |
| Inventory icon | Inventory | /inventory | All |
| Receipt icon | Invoices | /invoices | Admin only |
| Chart icon | Reports | /reports | Admin only |
| Clock icon | Timesheets | /my-timecard | All |
| Admin icon | Admin | /admin/users | Admin only |

### Adding Help to a Job (Admin/Manager Only)

From the Mobile Dashboard:
1. Find the job in "Today's Jobs" or "Service Calls"
2. Click the **group/person icon** (Modify Crew button)
3. The "Modify Crew" dialog opens
4. Select workers to add
5. Choose the date(s)
6. Click **Add Workers**

---

# Part III: Jobs & Work Orders

---

# 4. Jobs Overview

The Jobs section shows all jobs you have access to view. Technicians see a field-friendly view, while Admin/Manager see full details.

### Accessing Jobs

1. Click **Jobs** from the Home dashboard
2. Or click the briefcase icon in the bottom navigation
3. Or select **Jobs** from the Modules menu

### Jobs List View

The jobs list displays a **card-based layout** with each job as a clickable card showing:

| Field | Description |
|-------|-------------|
| **WO #** | Work order number in orange (e.g., WO-2024-0001) |
| **Status Badge** | Color-coded status chip (top right) |
| **Job Type** | Type of work (bold) |
| **Description** | Brief job description (2 lines max) |
| **Customer** | Customer name with person icon |
| **Address** | Service address with location icon |
| **Scheduled** | Scheduled date with calendar icon |
| **Priority** | Priority badge (outlined chip) |
| **Items** | Material count if any |
| **Crew Avatars** | Assigned worker avatars (bottom right) |

Click "View Job Details" button on any card to open the job detail view.

### Job Status Colors

| Status | Color | Meaning |
|--------|-------|---------|
| **Pending** | Yellow/Warning | Job created but not yet scheduled |
| **Scheduled** | Blue/Info | Job has a date and crew assigned |
| **In Progress** | Blue/Primary | Work has started |
| **Completed** | Green/Success | Job finished |
| **Cancelled** | Red/Error | Job cancelled |
| **Delayed** | Gray/Default | Job has been delayed |

### Filtering Jobs

Use the status dropdown in the header to filter:
- **All Jobs** - Show all jobs
- **Pending** - Jobs waiting to be scheduled
- **Scheduled** - Jobs with scheduled dates
- **In Progress** - Jobs currently being worked
- **Completed** - Finished jobs
- **Delayed** - Jobs that have been delayed

---

# 5. Work Orders (Admin/Manager)

Work Orders are the full administrative view of jobs, including pricing and financial information.

### Accessing Work Orders

1. Click **Work Orders** from the Home dashboard (Admin/Manager only)
2. Or select **Work Orders** from the Modules menu

### Work Orders List View

The Work Orders page uses a **table/grid layout** with sortable columns:

| Column | Description |
|--------|-------------|
| **WO #** | Work order number (bold) |
| **Customer** | Customer name |
| **Job Type** | Type of work |
| **Scheduled** | Scheduled date |
| **Status** | Color-coded status chip |
| **Priority** | Priority badge (outlined) |
| **Items** | Material count (allocated/total) |
| **Quote Total** | Total quoted amount |
| **Assigned To** | Assigned worker(s) |
| **Actions** | Modify Crew and View buttons |

Use the status dropdown filter in the header to filter by: All Status, Pending, Scheduled, In Progress, Completed, Delayed, Cancelled.

### Creating a New Work Order

1. Click the **New** button (green, top right in header)
2. Fill in the fields:

| Field | Description | Required |
|-------|-------------|:--------:|
| **Customer** | Select from list or create new | Yes |
| **Job Type** | Service Call, Panel Upgrade, New Construction, Repair, Maintenance, Installation | No |
| **Job Description** | Detailed job description | Yes |
| **Scope of Work** | Detailed scope items | No |
| **Priority** | Low, Normal, High, Emergency | No |
| **Scheduled Date** | When the job will be done | No |
| **Scheduled Start Time** | Start time for the job | No |
| **Estimated Hours** | Expected duration | No |
| **Assigned To** | Worker assignment | No |

3. Click **Create Work Order**

### Work Order Detail View

Click any work order row to see the full detail view:

#### Header Bar
- Back arrow to return to list
- **Job View** button - Switch to technician/field view
- **Edit** button - Modify work order details
- Status chip showing current status

#### Sections (Single Page, No Tabs)

| Section | Content |
|---------|---------|
| **Job Details** | Job type, priority, scheduled date, assigned crew, description |
| **Customer Information** | Name, company, phone, email, service address |
| **Quote Summary** | Labor hours/rate/cost, materials cost, subtotal, permit info |
| **Materials** | Material table with checkboxes for allocation, stock status, pricing |
| **Tasks/Scope** | Checkable task list (scope of work items) |
| **Notes** | Internal notes with add/delete functionality |
| **Photos** | Job photos with upload capability |
| **Activity Timeline** | History of all actions on this job |

#### Material Actions
- **Add Material** - Add inventory items to job
- **Allocate** - Reserve selected materials from stock
- **Return** - Return allocated materials to warehouse

### Work Order Status Flow

```
Pending → Scheduled → In Progress → Completed → Invoiced
                         ↓
                     Cancelled
```

**Automatic Status Changes:**
- Changes to **Scheduled** when crew is assigned
- Changes to **In Progress** when first time entry is made
- Changes to **Completed** when marked complete

---

# 6. Job Details & Field View

The Job View is accessed from the Jobs list and provides a field-friendly interface for working on jobs. All roles can access this view.

### Accessing Job View

1. Click any job card in the Jobs list
2. Click "View Job Details" on a job card
3. From Work Order detail, click "Job View" button

### Header Bar

- Back arrow to return to Jobs list
- **Edit WO** button (Admin/Manager only) - Opens work order detail
- Status chip showing current status

### Job Info Section

| Field | Description |
|-------|-------------|
| **Job Type** | Type of work (bold, orange) |
| **Description** | Full job description |
| **Customer** | Name, company, phone, and email |
| **Service Address** | Location with **Navigate** button for GPS navigation |
| **Schedule** | Date, start time, and estimated duration |
| **Priority** | Priority badge |
| **Crew Avatars** | Assigned workers |

### Update Job Status Section

Status control buttons available to all users:
- **Mark Complete** - Mark the job as completed

Admin-only additional controls:
- Set to Pending
- Set to Scheduled
- Set to In Progress
- Set to Completed
- Cancel Job
- **Generate Invoice** (appears when status is Completed)

### Tasks/Scope of Work Section

Checkable task list showing scope of work items that can be checked off as completed.

### Materials Checklist Section

Materials grouped by category showing:
- Item ID and description
- Brand name
- Quantity needed
- Available quantity
- Material status (Planned, Allocated, Used)
- **Location** prominently displayed in orange box
- **Pull** button - Take material from warehouse
- **Return** button - Return material to warehouse

Bulk actions:
- **Pull All Available** - Pull all planned materials with available stock
- **Return All** - Return all allocated materials

### Permits & Inspections Section

Shows when permit or inspection is required:
- Permit number if assigned
- Inspection requirements

### Job Notes Section

- View all notes on the job
- Add new notes with timestamp and your name
- Delete notes you've added

### Job Photos Section

- Upload photos from camera or file
- Select photo type: General, Before, After, Progress, Issue
- Add notes to photos
- View photos in full-screen viewer
- Delete photos

Photo types are color-coded:
- **Before** - Blue
- **After** - Green
- **Progress** - Orange
- **Issue** - Red

### Activity Timeline Section

Shows complete history of all actions on the job including:
- Status changes
- Material allocations
- Notes added
- Photos uploaded
- Crew assignments

---

# Part IV: Scheduling & Dispatch

---

# 7. Schedule Overview

The Schedule module provides a calendar view of all scheduled work and crew availability.

### Accessing Schedule

1. Click **Schedule** from the Home dashboard
2. Or click the calendar icon in bottom navigation
3. Or select **Schedule** from the Modules menu

### Schedule Views

The schedule tabs differ based on your role:

**Admin/Manager Views (5 tabs):**

| Tab | Description |
|-----|-------------|
| **List - Day** | Single day list of all jobs |
| **Calendar** | Monthly calendar grid view |
| **Dispatch** | Crew-centric dispatch board (default) |
| **Employee** | Individual employee schedule view |
| **Map** | Geographic map of job locations |

**Technician Views (3 tabs):**

| Tab | Description |
|-----|-------------|
| **Map** | Geographic map of job locations (default) |
| **Employee** | Your personal schedule |
| **Calendar** | Monthly calendar view |

### Date Navigation

| Button | Action |
|--------|--------|
| **< (Left Arrow)** | Go to previous day/week |
| **Today** | Jump to current date |
| **> (Right Arrow)** | Go to next day/week |
| **Date Picker** | Click the date to open a calendar picker |

### Schedule Entry Information

Each job on the schedule shows:
- Work order number
- Customer name
- Job type
- Time window (start - end time)
- Assigned crew (avatar icons)
- Status color indicator

### Employee Availability Indicators

When an employee has approved time off, the schedule shows:
- **Vacation/PTO** - Beach icon with "Vacation" label
- **Sick** - Medical cross icon
- **Unavailable** - Gray overlay on their calendar

---

# 8. Dispatch Board

The Dispatch Board provides a crew-centric view for managing daily schedules. Only Admin and Manager roles have access.

### Accessing Dispatch Board

1. Navigate to **Schedule**
2. Click the **Dispatch** tab (default view for Admin/Manager)

### Date Navigation

| Control | Action |
|---------|--------|
| **< Arrow** | Go to previous day |
| **Today** button | Jump to current date |
| **> Arrow** | Go to next day |
| **Date display** | Shows current selected date |

### Dispatch Layout

The dispatch board has two main sections:

**Left Panel: Jobs to Dispatch**
- List of all jobs filtered by status
- Filter dropdown: All Jobs, Unassigned, In Progress, Scheduled, Pending, Completed
- Priority filter: All, High, Normal, Low
- Each job card shows:
  - Work order number
  - Customer name
  - Job type and description
  - Priority badge
  - Crew avatars (if assigned)
  - Modify Crew and Unassign buttons

**Right Panel: Employees**
- List of all active employees
- Avatar and full name
- Job count for selected date
- Availability indicator (icons for vacation, sick, personal day)
- Click to expand and see their scheduled jobs for the day

### Bulk Assignment Mode

1. Click **Select Multiple** button
2. Check boxes appear on job cards
3. Select multiple jobs
4. Click **Assign Selected** button
5. Choose employees and date
6. System checks for schedule conflicts
7. Confirm assignment

### Employee Call-Out

Click the **call-out icon** (person with X) next to an employee to mark them as unavailable:
- Select type: Call-Out, Sick, Vacation, Personal Day
- Select date range
- System automatically removes them from scheduled jobs for those dates

### Employee Availability Display

| Icon | Meaning |
|------|---------|
| **Beach icon** | Vacation/PTO |
| **Medical cross** | Sick day |
| **Event busy** | Personal day |
| **Person off** | Call-out |

### Drag and Drop

- Drag jobs between employees to reassign
- Drop job on employee row to assign
- Visual feedback shows valid drop targets

---

# 9. Adding Crew to Jobs

The "Add Help" or "Modify Crew" dialog allows you to assign workers to jobs.

### Opening the Crew Dialog

From multiple locations:
- Click **Add Help** on a job card
- Click **+ person icon** on the Mobile Dashboard
- Click **Modify Crew** in Work Order detail

### Add Help Dialog Components

#### Job Information Panel
Shows the selected job:
- Work order number
- Job description
- Customer name
- Service address
- Current status
- Currently assigned crew (clickable to edit)

#### Date Selection

**Single Day Mode:**
- Date picker for one specific date

**Multiple Days Mode:**
1. Click **Multiple Days** button
2. Set start and end date range
3. A calendar grid appears
4. Click dates to select/deselect
5. Selected dates turn blue
6. Orange-bordered dates = already scheduled

#### Time Selection
- **Start Time** - When work begins (default 7:00 AM)
- **End Time** - When work ends (default 3:30 PM)
- Hours automatically calculated

#### Employee Selection
- Dropdown showing available employees
- Multi-select enabled
- Already assigned employees shown separately
- Click assigned employee chips to edit their schedule

### Editing Existing Crew

1. Click on an assigned crew member's chip
2. The dialog switches to Edit Mode (orange header)
3. Their currently scheduled dates are pre-selected
4. Modify dates as needed:
   - Deselect dates to remove from schedule
   - Select new dates to add
5. Click **Update Schedule** or **Remove from X Day(s)**

### Submit Actions

| Button | Action |
|--------|--------|
| **Add X Worker(s)** | Assign selected workers to selected dates |
| **Update Schedule** | Save changes to existing worker's schedule |
| **Remove from X Day(s)** | Remove worker from all selected dates |

---

# 10. Schedule Conflict Detection

The system automatically detects and prevents scheduling conflicts.

### Types of Conflicts Detected

#### 1. Schedule Conflicts (Warning)
- Worker already scheduled on another job at the same time
- **Can be overridden** - proceed will adjust existing schedule

#### 2. Time Off Conflicts (Blocking)
- Worker has **approved** PTO/vacation on that date
- **Cannot be overridden** - must select different dates or workers

### Conflict Dialog - Schedule Conflicts

When a schedule conflict is detected:

**Header:** Yellow/orange with warning icon - "Schedule Conflict Detected"

**Content Shows:**
- Employee name
- Date of conflict
- Current job assignment
- Time overlap details

**Actions:**
- **Cancel** - Go back and change selection
- **Proceed & Adjust Schedules** - Override the conflict (adjusts existing schedule)

### Conflict Dialog - Time Off Conflicts

When a PTO conflict is detected:

**Header:** Red with block icon - "Cannot Schedule - Time Off Approved"

**Content Shows:**
- Employee name with beach/PTO icon
- Date of conflict
- Type of time off (Vacation, Sick, etc.)
- Reason provided
- "All day unavailable" indicator

**Actions:**
- **Go Back & Select Different Dates** - Only option (cannot override)

### Conflict Resolution

**For Schedule Conflicts:**
- System will adjust overlapping hours on existing job
- Worker remains on both jobs for non-overlapping hours

**For Time Off Conflicts:**
- Must select different dates
- Or select different workers
- Cannot schedule workers on approved PTO

---

# Part V: Time Tracking & PTO

---

# 11. Timesheet Entry

The Timesheet module allows employees to log their work hours by job.

### Accessing Timesheet

1. Click **Timesheet** from the Home dashboard
2. Or click the clock icon in bottom navigation
3. Or select **Timesheet** from Modules menu

### Timesheet Layout

#### Week Navigation
- **< (Left arrow)** and **> (Right arrow)** buttons to navigate weeks
- Current week range displayed (e.g., "Week of Dec 23 - Dec 29")

#### Action Buttons (Top Right)
- **Request PTO** - Open the PTO request form (blue, with beach icon)
- **Call Out Sick** - Quick button to mark yourself sick for today (orange, with sick icon)
- **Add Job** - Add a job row to your timesheet
- **Add Other Time** - Add non-job time categories
- **Save** - Save entered hours
- **Submit** - Lock and submit the week for approval

#### Timesheet Grid

The timesheet displays as a **weekly grid table**:
- **Rows**: Jobs and time categories you're tracking
- **Columns**: Days of the week (Mon-Sun) plus Total column
- **Cells**: Enter hours directly in each cell

Each row shows:
- Work order number and customer name (for jobs)
- Category name with color chip (for non-job time)
- Delete (X) button to remove the row
- Total hours for that row

#### Footer Totals
- Daily totals at the bottom of each day column
- Weekly grand total

### Adding Job Time

1. Click **Add Job** button
2. Dialog shows two sections:
   - **Your Assigned Jobs** - Jobs you're currently assigned to
   - **Other Jobs** - All other available jobs (sorted by status)
3. Click a job to add it as a row in your timesheet

### Adding Non-Job Time

1. Click **Add Other Time** button
2. Select from available categories:

| Category | Color | Description |
|----------|-------|-------------|
| **Shop Time** | Purple | Time spent at the shop |
| **Office Time** | Blue | Administrative work |
| **Training** | Orange | Training sessions |
| **Travel** | Green | Travel between jobs |
| **Meeting** | Gray | Meetings |
| **Other** | Brown | Miscellaneous time |

### Entering Hours

- Click directly in any cell in the grid
- Enter decimal hours (e.g., 8, 4.5, 2.25)
- Click **Save** to save all hours
- Daily and row totals update automatically

### Removing a Row

- Click the **X** button on any job or time category row
- Row will be removed when you save

### Submitting Timesheet

1. Enter all hours for the week
2. Click **Save** to save in-progress work
3. Click **Submit** to lock the week
4. Once submitted, the week cannot be edited

### Quick Call Out Sick

Click **Call Out Sick** button to:
- Mark yourself unavailable for today
- Automatically remove yourself from today's scheduled jobs
- Creates a sick day unavailability record

---

# 12. Requesting Time Off (PTO)

Employees can request time off through the Timesheet page.

### Accessing PTO Request

1. Navigate to **Timesheet**
2. Click the **Request PTO** button (blue button with beach icon, top right)

### PTO Request Form

| Field | Description | Required |
|-------|-------------|:--------:|
| **Start Date** | First day of time off | Yes |
| **End Date** | Last day of time off | Yes |
| **Type** | Vacation, Sick, Personal, etc. | Yes |
| **Reason** | Explanation for the request | No |

### Submitting a Request

1. Fill in all required fields
2. Click **Submit Request**
3. Request is sent to Admin/Manager for approval
4. You'll receive a notification when approved or denied

### Request Status

| Status | Meaning |
|--------|---------|
| **Pending** | Waiting for approval |
| **Approved** | Time off granted |
| **Denied** | Request was rejected |

### Viewing Your Requests

After submitting a PTO request, you will receive a confirmation. Your manager will review the request and you'll be notified when it's approved or denied. Approved PTO will be visible on the Schedule views with vacation/time-off indicators.

### Important Notes

- Submit requests as early as possible
- Approved PTO will show on the schedule
- You **cannot** be scheduled for jobs on approved PTO days
- Pending requests do NOT block scheduling (until approved)

---

# 13. PTO Approval (Admin/Manager)

Administrators and Managers can approve or deny PTO requests.

### Accessing PTO Approval

1. Click **PTO Approval** from the Modules menu
2. Or look for notification badge on the bell icon

### PTO Approval Page

Shows all pending requests:

| Column | Information |
|--------|-------------|
| **Employee** | Name of requester |
| **Dates** | Start and end date |
| **Type** | Vacation, Sick, etc. |
| **Reason** | Employee's explanation |
| **Submitted** | When request was made |
| **Actions** | Approve/Deny buttons |

### Approving a Request

1. Review the request details
2. Check the schedule for that date range
3. Click **Approve** button
4. Employee is notified
5. Time off appears on schedule

### Denying a Request

1. Review the request
2. Click **Deny** button
3. Optionally add a reason
4. Employee is notified

### After Approval

When PTO is approved:
- Employee's calendar shows unavailability
- Attempting to schedule that employee triggers a **blocking conflict**
- Other managers can see the unavailability on dispatch board

---

# 14. Call-Out / Sick Day

For same-day absences (calling out sick), the system has a quick call-out feature.

### Marking an Employee as Called Out (Admin/Manager)

1. Navigate to **Schedule** or **Dispatch Board**
2. Find the employee
3. Click their name or the **Call Out** button
4. Fill in details:
   - Date range (usually just today)
   - Type (Sick, Emergency, Personal)
   - Reason (optional)
   - **Remove from Schedule** checkbox - removes from today's jobs

### What Happens on Call-Out

1. Employee marked as unavailable immediately
2. If "Remove from Schedule" checked:
   - They're removed from all jobs that day
   - Notification sent about affected jobs needing reassignment
3. Jobs without other crew members are flagged for attention

### Viewing Affected Jobs

After a call-out, a list shows:
- All jobs the employee was assigned to
- Whether other crew members are still assigned
- Jobs needing full reassignment (no other workers)

### Reassigning Work

1. Review the affected jobs list
2. Click on jobs needing coverage
3. Use **Add Help** to assign replacement workers

---

# Part VI: Inventory Management

---

# 15. Inventory Overview

The Inventory module tracks all parts, materials, and supplies.

### Accessing Inventory

1. Click **Inventory** from the Home dashboard
2. Or click the box icon in bottom navigation
3. Or select **Inventory** from Modules menu

### Header Buttons

| Button | Description |
|--------|-------------|
| **Low Stock badge** | Shows count of low stock items (orange chip) |
| **Rapid Count** | Open quick cycle count interface |
| **Scan** | Open barcode/QR scanner for fast lookup |

### Toolbar Controls

| Control | Description |
|---------|-------------|
| **Search** | Search all fields (item ID, description, brand, category) |
| **Low Stock Only** | Toggle to show only items below minimum level |
| **Refresh** (icon) | Reload inventory data |
| **Sort By** | Dropdown to change sort order |
| **Add Item** | Create new inventory item |
| **Assign to Work Order** | Assign selected items to a job (appears when items selected) |
| **Clear Selection** | Deselect all items (appears when items selected) |

### Sort Options

| Sort Option | Description |
|-------------|-------------|
| **Commonly Used** | Starred items first (default) |
| **Item ID** | Alphabetical by item ID |
| **Description** | Alphabetical by description |
| **Category** | Grouped by category |
| **Brand** | Grouped by brand |
| **Qty (Stock)** | By current quantity |
| **Available** | By available quantity |
| **Low Stock** | Low stock items first |
| **Cost** | By cost (Admin/Manager only) |
| **Sell Price** | By selling price |
| **Location** | By storage location |
| **Recently Added** | Newest items first |

### Inventory Grid Columns

| Column | Description |
|--------|-------------|
| **Pin icon** | Shows when item is selected (pinned to top) |
| **Star icon** | Indicates commonly used item |
| **Item ID** | Part number/SKU |
| **Description** | Item name and description |
| **Brand** | Manufacturer/brand |
| **Category** | Item category |
| **Stock** | Current quantity (red chip if low, green if ok) |
| **Available** | Quantity available (not allocated to jobs) |
| **Min** | Minimum stock level (reorder point) |
| **Location** | Storage location |
| **Cost** | Purchase cost (Admin/Manager only) |
| **Sell Price** | Customer selling price |
| **Actions** | Quick Adjust and Edit buttons |

### Row Actions

Each row has action buttons:
- **Quick Stock Adjust** (swap icon) - Fast +/- quantity adjustment
- **Edit** (pencil icon) - Open full edit form

### Selecting Items

Click row checkboxes to select items:
- Selected items are **pinned to top** of list
- **Clear Selection** button appears
- **Assign to Work Order** button enables for bulk assignment

### Stock Status Indicators

| Status | Color | Meaning |
|--------|-------|---------|
| **In Stock** | Green chip | Quantity above minimum |
| **Low Stock** | Red chip | At or below minimum level |

### Searching Inventory

Use the search bar to find items by any field:
- Item ID/SKU
- Description
- Brand/Manufacturer
- Category
- Location

---

# 16. Adding & Editing Items

### Adding a New Item

1. Click **+ Add Item** button
2. Fill in the form:

**Basic Information:**
| Field | Description | Required |
|-------|-------------|:--------:|
| **Name** | Item name/description | Yes |
| **SKU** | Part number/SKU | Yes |
| **Category** | Item category | Yes |
| **Manufacturer** | Brand/manufacturer | No |

**Stock Information:**
| Field | Description | Required |
|-------|-------------|:--------:|
| **Quantity** | Current count | Yes |
| **Minimum Level** | Reorder point | No |
| **Location** | Storage location | No |
| **Bin Number** | Specific bin/shelf | No |

**Pricing:**
| Field | Description | Required |
|-------|-------------|:--------:|
| **Unit Cost** | What you pay | No |
| **Unit Price** | What you charge | No |

3. Click **Save Item**

### Editing an Item

1. Click on the item in the list
2. Click **Edit** button
3. Modify fields as needed
4. Click **Save Changes**

### Item Categories

Common categories include:
- Wire & Cable
- Breakers & Panels
- Lighting
- Conduit & Fittings
- Switches & Outlets
- Tools & Equipment
- Miscellaneous

---

# 17. Stock Adjustments

### Receiving Stock

When new inventory arrives:

1. Navigate to the item
2. Click **Receive Stock** or **Adjust Qty**
3. Enter the quantity received
4. Select reason: "Received from Vendor"
5. Optionally link to Purchase Order
6. Click **Save**

### Stock Adjustment Reasons

| Reason | Use Case |
|--------|----------|
| **Received from Vendor** | New stock arrived |
| **Returned to Vendor** | Sent back to supplier |
| **Physical Count** | Correcting after inventory count |
| **Damaged/Defective** | Unusable items removed |
| **Used on Job** | Consumed for work (if not using allocation) |
| **Transferred** | Moved to another location |

### Stock Adjustment History

Each item shows a history of adjustments:
- Date of adjustment
- Quantity change (+/-)
- Reason
- Who made the adjustment
- Running balance

---

# 18. Material Allocation to Jobs

Materials can be allocated (reserved) for specific jobs.

### Allocating Materials to a Job

**From Work Order Detail:**
1. Open the work order
2. Scroll to the **Materials** section
3. Click **Add Material** button
4. Search for the item
5. Enter quantity needed
6. Click **Add**

**From Inventory Item:**
1. Open the inventory item
2. Click **Allocate to Job**
3. Select the work order
4. Enter quantity
5. Click **Allocate**

### Allocation Status

| Status | Meaning |
|--------|---------|
| **Planned** | Reserved but not pulled |
| **Allocated** | Pulled from stock for job |
| **Used** | Consumed on the job |
| **Returned** | Unused materials returned to stock |

### Stock Impact

- **Planned:** Does not reduce available stock
- **Allocated:** Reduces available stock, reserves for job
- **Used:** Permanently consumed
- **Returned:** Returns to available stock

### Viewing Allocated Materials

On a work order, the Materials section shows:
- Item name and SKU
- Quantity needed
- Quantity allocated
- Status
- Unit cost and total (Admin/Manager only)

---

# Part VII: Customers

---

# 19. Customer Management

The Customers module stores all customer information and service history.

### Accessing Customers

1. Click **Customers** from bottom navigation
2. Or select **Customers** from Modules menu

### Customer List

The list shows a table with columns:

| Column | Information |
|--------|-------------|
| **Customer #** | Unique customer number |
| **Name** | Company name, or First + Last name |
| **Type** | Residential, Commercial, or Industrial (chip) |
| **Phone** | Primary phone number |
| **Email** | Email address |
| **Service Address** | Full service address |
| **Actions** | Edit and Delete buttons |

### Adding a New Customer

1. Click **Add Customer** button (top right)
2. Fill in customer information in the dialog:

**Basic Information:**
| Field | Required |
|-------|:--------:|
| **First Name** | No |
| **Last Name** | No |
| **Company Name** | No |
| **Customer Type** | No (dropdown: Residential, Commercial, Industrial) |

**Contact Information:**
| Field | Required |
|-------|:--------:|
| **Primary Phone** | No |
| **Secondary Phone** | No |
| **Email** | No |
| **Preferred Contact** | No (Phone, Email, or Text) |

**Service Address:**
| Field | Required |
|-------|:--------:|
| **Street Address** | No |
| **City** | No |
| **State** | No (default: MA) |
| **ZIP Code** | No |
| **Service Notes** | No |

**Billing Address:**
| Field | Required |
|-------|:--------:|
| **Same as Service** | Checkbox (default: checked) |
| **Billing Street/City/State/ZIP** | No (if different from service) |

**Billing Settings:**
| Field | Required |
|-------|:--------:|
| **Payment Terms** | No (Due on Receipt, Net 15, Net 30, Net 45, Net 60) |
| **Active** | Checkbox (default: checked) |

3. Click **Save**

### Editing a Customer

1. Click the **Edit** (pencil) icon in the Actions column
2. Modify fields in the dialog
3. Click **Save**

### Deleting a Customer

1. Click the **Delete** (trash) icon in the Actions column
2. Confirm deletion in the dialog
3. Customer is permanently deleted

### Customer Types

| Type | Description | Chip Color |
|------|-------------|------------|
| **Residential** | Homeowners, renters | Gray |
| **Commercial** | Businesses, offices | Blue |
| **Industrial** | Factories, warehouses | Gray |

---

# Part VIII: Quotes & Invoices

---

# 20. Creating Quotes

Quotes provide estimates to customers before work begins.

### Accessing Quotes

1. Select **Quotes** from Modules menu (Admin/Manager only)

### Creating a New Quote

1. Click **+ New Quote**
2. Select customer
3. Add line items:

| Field | Description |
|-------|-------------|
| **Item/Service** | What you're quoting |
| **Description** | Details |
| **Quantity** | Amount |
| **Unit Price** | Price each |
| **Total** | Calculated automatically |

### Multi-Tier Pricing (Good/Better/Best)

Quotes can include multiple pricing options:
- **Good** - Basic option
- **Better** - Mid-range option
- **Best** - Premium option

Each tier shows different pricing and scope.

### Quote Actions

| Action | Description |
|--------|-------------|
| **Send to Customer** | Email quote to customer |
| **Print/PDF** | Generate printable version |
| **Convert to Work Order** | Create job from accepted quote |
| **Mark Won/Lost** | Track quote outcome |

---

# 21. Converting Quotes to Work Orders

When a customer accepts a quote:

1. Open the quote
2. Click **Convert to Work Order**
3. Select which tier was accepted (if multi-tier)
4. Work order is created with:
   - Customer information
   - Quote line items as job scope
   - Quoted pricing

### Quote Status After Conversion

- Quote status changes to "Accepted"
- Link to work order shown on quote
- Cannot be converted again

---

# 22. Invoices

Invoices bill customers for completed work.

### Creating an Invoice

**From Work Order:**
1. Open a completed work order
2. Click **Create Invoice**
3. Invoice populated with:
   - Job details
   - Labor hours and rates
   - Materials used
   - Any additional charges
4. Review and adjust as needed
5. Click **Save Invoice**

**Manual Invoice:**
1. Navigate to Invoices
2. Click **+ New Invoice**
3. Select customer
4. Add line items manually
5. Save

### Invoice Status

| Status | Color | Meaning |
|--------|-------|---------|
| **Paid** | Green | Payment fully received |
| **Partial** | Orange | Partial payment received |
| **Unpaid** | Red | No payment received |

Note: Invoices past their due date display an "Overdue" warning indicator.

### Invoice Actions

| Action | Description |
|--------|-------------|
| **Send** | Email to customer |
| **Print/PDF** | Generate printable |
| **Record Payment** | Mark as paid |
| **Void** | Cancel invoice |

---

# 23. Purchase Orders

Purchase orders track materials ordered from vendors.

### Creating a Purchase Order

1. Navigate to **Purchase Orders** (Admin only)
2. Click **+ New PO**
3. Select vendor
4. Add line items:
   - Select inventory item
   - Enter quantity to order
   - Confirm unit cost
5. Click **Create PO**

### PO Status

| Status | Meaning |
|--------|---------|
| **Draft** | Not yet submitted |
| **Pending Approval** | Waiting for manager approval |
| **Approved** | Approved by manager |
| **Ordered** | Sent to vendor |
| **Partial** | Some items received |
| **Received** | All items received |
| **Cancelled** | Order cancelled |

### Receiving a Purchase Order

1. Open the PO
2. Click **Receive**
3. Enter quantities received for each item
4. Inventory automatically updated
5. Status updates based on full/partial receipt

---

# Part IX: Reports & Analytics

---

# 24. Financial Reports

Financial reports provide insights into business performance.

### Accessing Reports

1. Click **Reports** from Home dashboard (Admin only)
2. Or select **Reports** from Modules menu

### Available Financial Reports

#### Revenue Summary
- Total revenue by period
- Revenue by customer
- Revenue by job type
- Month-over-month comparison

#### Job Profitability
- Revenue vs. costs per job
- Profit margin analysis
- Labor cost breakdown
- Material cost breakdown

#### Accounts Receivable
- Outstanding invoices
- Aging report (30/60/90 days)
- Collection status

### Report Date Ranges

Select from:
- This Week
- This Month
- This Quarter
- This Year
- Custom Range

### Exporting Reports

Click **Export** to download:
- PDF format
- Excel format
- CSV format

---

# 25. Inventory Reports

#### Stock Value Report
- Total inventory value
- Value by category
- Value by location

#### Low Stock Report
- Items below minimum level
- Reorder recommendations

#### Stock Movement Report
- Items received
- Items used
- Adjustments made

#### Inventory Turnover
- Fast-moving items
- Slow-moving items
- Dead stock identification

---

# 26. Productivity Reports

#### Labor Utilization
- Hours worked by employee
- Billable vs. non-billable hours
- Overtime tracking

#### Job Completion
- Jobs completed per period
- Average job duration
- On-time completion rate

#### Crew Performance
- Revenue per technician
- Jobs per technician
- Customer satisfaction (if tracked)

---

# Part X: Administration

---

# 27. User Management

User Management allows administrators to create and manage user accounts.

### Accessing User Management

1. Click **Admin** from Home dashboard (Admin only)
2. Or select **User Management** from Modules menu

### User List

The page shows summary cards at the top:
- **Active Users** - Count of active employees
- **Licensed** - Count of licensed electricians
- **Avg Hourly Rate** - Average rate across employees
- **Expiring Licenses** - Licenses expiring within 30 days

The user list has tabs for Active/Inactive users with columns:
| Column | Information |
|--------|-------------|
| **Username** | Login username |
| **Full Name** | Employee's full name |
| **Role** | Admin, Manager, Technician, Office |
| **Licensed** | Yes/No with license state |
| **License Expiry** | Expiration date (with warnings) |
| **Hourly Rate** | Employee pay rate |
| **Employment** | Full-time, Part-time, or Contractor |
| **Actions** | Edit and Delete buttons |

### Creating a New User

1. Click **+ Add User**
2. Fill in user details across these sections:

**Basic Information:**
| Field | Description |
|-------|-------------|
| **Username** | Login username (required for new users) |
| **Password** | Login password (required for new users) |
| **Full Name** | Employee's display name |
| **Email** | Email address |
| **Phone** | Phone number |
| **Role** | Admin, Manager, Technician, or Office |

**Employment Information:**
| Field | Description |
|-------|-------------|
| **Hire Date** | Date of hire |
| **Employment Type** | Full-time, Part-time, Contract |
| **Hourly Rate** | Standard pay rate |
| **Overtime Rate** | Overtime pay rate (defaults to 1.5x hourly) |
| **SSN Last 4** | Last 4 digits of SSN |

**License Information:**
| Field | Description |
|-------|-------------|
| **Licensed Electrician** | Toggle for licensed status |
| **License Number** | Electrical license number (if licensed) |
| **License State** | 2-letter state code (if licensed) |
| **License Expiration** | When license expires (if licensed) |

**Address Information:**
| Field | Description |
|-------|-------------|
| **Address** | Street address |
| **City** | City |
| **State** | State |
| **ZIP** | ZIP code |

**Emergency Contact:**
| Field | Description |
|-------|-------------|
| **Contact Name** | Emergency contact name |
| **Contact Phone** | Emergency contact phone |

**Permissions & Status:**
| Field | Description |
|-------|-------------|
| **Active** | Whether user can log in |
| **Can Create Quotes** | Allow creating customer quotes |
| **Can Close Jobs** | Allow marking jobs complete |

3. Click **Create** (or **Update** when editing)

### Editing a User

1. Click on user in list
2. Click **Edit**
3. Modify fields
4. Click **Save**

### Deactivating a User

1. Open user record
2. Click **Deactivate**
3. User can no longer log in
4. Historical data preserved

### Reactivating a User

1. Filter to show inactive users
2. Find the user
3. Click **Activate**

### Resetting a Password

1. Open user record
2. Click **Reset Password**
3. Enter new temporary password
4. User must change on next login

---

# 28. System Settings

System settings configure application behavior.

### General Settings
- Company name
- Company logo
- Contact information
- Business hours

### Default Values
- Default work times (7:00 AM - 3:30 PM)
- Default job priority
- Default payment terms

### Notifications
- Enable/disable email notifications
- Configure notification types
- Set recipients for different events

---

# 29. Notifications

The notification system keeps users informed of important events.

### Notification Bell

The bell icon in the header shows:
- Number badge for unread notifications
- Click to open notification panel

### Notification Panel

Shows recent notifications:
- Notification title
- Brief description
- Time received
- Click to navigate to related item

### Notification Types

| Type | Recipients | Trigger |
|------|-----------|---------|
| **PTO Request** | Admin, Manager | Employee requests time off |
| **PTO Approved** | Employee | Request was approved |
| **PTO Denied** | Employee | Request was denied |
| **Job Assigned** | Technician | Added to job crew |
| **Schedule Change** | Affected crew | Job rescheduled |
| **Low Stock** | Admin | Item falls below minimum |

### Managing Notifications

- Click a notification to view details
- Click **Mark Read** to dismiss
- Click **Mark All Read** to clear all

---

# Appendices

---

# Appendix A: Role Permissions Matrix

| Feature | Admin | Manager | Technician | Office |
|---------|:-----:|:-------:|:----------:|:------:|
| **Jobs** |
| View all jobs | Yes | Yes | Assigned only | Yes |
| Create work orders | Yes | Yes | No | No |
| Edit work orders | Yes | Yes | No | No |
| View job pricing | Yes | Yes | No | Yes |
| Change job status | Yes | Yes | Limited | No |
| **Scheduling** |
| View schedule | Yes | Yes | Own only | Yes |
| Create schedule entries | Yes | Yes | No | No |
| Assign crew | Yes | Yes | No | No |
| Modify crew | Yes | Yes | No | No |
| **Time Tracking** |
| Enter own time | Yes | Yes | Yes | Yes |
| View all timesheets | Yes | Yes | No | No |
| Edit others' time | Yes | Yes | No | No |
| **PTO** |
| Request time off | Yes | Yes | Yes | Yes |
| Approve/deny PTO | Yes | Yes | No | No |
| View all PTO | Yes | Yes | Own only | No |
| **Inventory** |
| View inventory | Yes | Yes | Yes | Yes |
| Add/edit items | Yes | Yes | No | Yes |
| Adjust quantities | Yes | Yes | No | Yes |
| **Customers** |
| View customers | Yes | Yes | Yes | Yes |
| Add/edit customers | Yes | Yes | No | Yes |
| **Quotes** |
| Create quotes | Yes | Yes | No | No |
| View quotes | Yes | Yes | No | No |
| **Invoices** |
| Create invoices | Yes | No | No | Yes |
| View invoices | Yes | Yes | No | Yes |
| **Purchase Orders** |
| Create POs | Yes | No | No | No |
| Receive POs | Yes | No | No | No |
| **Reports** |
| View reports | Yes | No | No | No |
| **Administration** |
| Manage users | Yes | No | No | No |
| System settings | Yes | No | No | No |

---

# Appendix B: Status Definitions

### Work Order / Job Status

| Status | Definition | Next Status |
|--------|------------|-------------|
| **Pending** | Job created, no schedule or crew | Scheduled, Cancelled |
| **Scheduled** | Has date and crew assigned | In Progress, Cancelled |
| **In Progress** | Work actively being performed | Completed, On Hold |
| **On Hold** | Temporarily paused | In Progress, Cancelled |
| **Completed** | All work finished | Invoiced |
| **Invoiced** | Invoice sent to customer | Paid |
| **Cancelled** | Job cancelled | (final) |

### Quote Status

| Status | Definition |
|--------|------------|
| **Draft** | Being prepared |
| **Sent** | Delivered to customer |
| **Accepted** | Customer accepted quote |
| **Declined** | Customer declined |
| **Expired** | Quote past validity date |

### Invoice Status

| Status | Definition |
|--------|------------|
| **Draft** | Being prepared |
| **Sent** | Delivered to customer |
| **Viewed** | Customer opened |
| **Partial** | Partially paid |
| **Paid** | Fully paid |
| **Overdue** | Past due date |
| **Void** | Cancelled |

### PTO Request Status

| Status | Definition |
|--------|------------|
| **Pending** | Awaiting approval |
| **Approved** | Time off granted |
| **Denied** | Request rejected |
| **Cancelled** | Withdrawn by employee |

---

# Appendix C: Troubleshooting

### Login Issues

**Problem:** Can't log in
- Verify username is spelled correctly (case-sensitive)
- Check that CAPS LOCK is not on
- Try resetting your password with an administrator
- Clear browser cache and cookies

**Problem:** Session expired
- Normal after 1 hour of inactivity
- Log in again with your credentials

### Schedule Issues

**Problem:** Can't schedule an employee
- Check if they have approved time off on that date
- Verify they're not already at maximum hours
- Ensure the job has available dates

**Problem:** Employee showing as unavailable
- They have approved PTO for those dates
- Check PTO Approval to see their time off

### Inventory Issues

**Problem:** Item shows "Out of Stock" but we have some
- Quantity may be allocated to jobs
- Check "Available" vs "On Hand" quantities
- Perform a stock adjustment if counts are wrong

**Problem:** Can't allocate material to job
- Verify item has available quantity
- Check if item is already fully allocated elsewhere

### Time Entry Issues

**Problem:** Can't add time to a job
- You must be assigned to the job
- Can't add time for future dates
- Check that job isn't in "Cancelled" status

### Browser Issues

**Problem:** Page not loading correctly
- Try refreshing the page (F5 or Ctrl+R)
- Clear browser cache
- Try a different browser
- Check internet connection

### Getting Help

If you encounter issues not covered here:
1. Note the exact error message
2. Note what you were trying to do
3. Contact your system administrator

---

**End of User Manual**

*Pem2 Services - Version 2.0*
*Last Updated: December 2024*
