# Inventory & Labor Reporting System - Implementation Plan

## Executive Summary
Design and implement a comprehensive reporting system for tracking materials usage, labor hours, and generating financial insights across multiple time periods (individual job, weekly, monthly, quarterly, annually, all-time).

## Current State Analysis

### Existing Database Tables
1. **time_entries** - Tracks employee hours per job with billable rates and pay rates
2. **job_materials_used** - Tracks material allocation, usage, and costs per job
3. **work_orders** - Job details, scheduling, status
4. **inventory** - Stock items with costs and pricing
5. **users** - Employee information including hourly rates
6. **employee_pay_rates** - Historical pay rate tracking
7. **job_billing_rates** - Billing rate configuration

### Existing Views
1. **weekly_timecard_summary** - Weekly hours per employee
2. **job_labor_summary** - Labor costs per job
3. **daily_time_detail** - Detailed daily time entries
4. **financial_snapshot** - Overall financial snapshot
5. **job_financial_detail** - Job-level financial breakdown
6. **monthly_financial_summary** - Monthly aggregates

### Existing Report Endpoints
- `/reports/financial-snapshot` - Overall financial summary
- `/reports/job-financial-detail` - Job-level details with filters
- `/reports/monthly-summary` - Monthly financial data
- `/reports/customer-summary` - Customer-specific data
- `/reports/inventory-valuation` - Inventory value summary
- `/reports/employee-productivity` - Employee metrics

## Proposed Reporting Categories

### 1. **Material Usage Reports**

#### 1.1 Job Material Detail Report
**Purpose:** Show all materials used on a specific job with costs and quantities

**Data Points:**
- Material name, SKU, category
- Quantity needed vs. allocated vs. used vs. returned
- Unit cost, unit price, line total
- Installation location and technician
- Status (planned, allocated, loaded, used, returned, billed)
- Variance (quantity needed - quantity used)

**Time Periods:**
- Individual job (primary use case)
- Date range for multiple jobs

#### 1.2 Material Usage Summary by Category
**Purpose:** Aggregate material usage across jobs grouped by material category

**Data Points:**
- Total quantity used per material category
- Total cost and revenue per category
- Top 10 most-used materials
- Materials with highest profit margin
- Waste tracking (materials allocated but returned)

**Time Periods:**
- Weekly
- Monthly
- Quarterly
- Annually
- All-time
- Custom date range

#### 1.3 Material Efficiency Report
**Purpose:** Track material waste and efficiency

**Data Points:**
- Materials over-allocated (allocated > used)
- Return rate percentage
- Accuracy rate (planned vs. actually used)
- Cost of wasted/returned materials
- Jobs with high material variance

**Time Periods:**
- Weekly
- Monthly
- Quarterly

### 2. **Labor Reports**

#### 2.1 Employee Timecard Report
**Purpose:** Detailed timecard for payroll processing

**Data Points:**
- Employee name and username
- Work dates and hours per day
- Jobs worked on each day
- Total regular hours
- Total overtime hours (if >40/week)
- Billable vs. non-billable hours
- Pay rate and total pay
- Week ending date
- Lock status

**Time Periods:**
- Weekly (primary - payroll cycle)
- Bi-weekly
- Monthly
- Custom date range

#### 2.2 Job Labor Detail Report
**Purpose:** Show all labor on a specific job

**Data Points:**
- All employees who worked on job
- Hours per employee
- Work dates
- Billable rate vs. pay rate per employee
- Total labor cost vs. total billable amount
- Labor margin (billable - cost)
- Notes and work performed

**Time Periods:**
- Individual job (primary)
- Date range

#### 2.3 Employee Productivity Report
**Purpose:** Analyze employee performance and utilization

**Data Points:**
- Total hours worked
- Number of jobs worked
- Average hours per job
- Billable hours percentage
- Revenue generated (hours × billable rate)
- Labor efficiency (billable amount / pay cost)
- Jobs completed

**Time Periods:**
- Weekly
- Monthly
- Quarterly
- Annually
- All-time

### 3. **Combined Material + Labor Reports**

#### 3.1 Job Profitability Report
**Purpose:** Complete P&L for a job or set of jobs

**Data Points:**
- Job total revenue
- Material costs (total from job_materials_used)
- Labor costs (total from time_entries)
- Total costs (material + labor)
- Gross profit (revenue - total costs)
- Gross profit margin %
- Hours worked
- Revenue per hour

**Time Periods:**
- Individual job
- Weekly
- Monthly
- Quarterly
- Annually
- All-time
- By customer
- By job type

#### 3.2 Daily Job Activity Report
**Purpose:** What happened today across all jobs

**Data Points:**
- Jobs worked on today
- Materials used today (quantity and cost)
- Labor hours logged today
- Revenue generated today
- Costs incurred today
- Jobs started, completed, or in progress

**Time Period:**
- Daily (specific date)

#### 3.3 Job Comparison Report
**Purpose:** Compare similar jobs to analyze efficiency

**Data Points:**
- Multiple jobs side-by-side
- Material costs comparison
- Labor hours comparison
- Profit margin comparison
- Time to completion
- Cost per square foot (if applicable)

**Filters:**
- By job type
- By customer
- By date range

### 4. **Inventory Impact Reports**

#### 4.1 Material Consumption Trends
**Purpose:** Track which materials are being used most

**Data Points:**
- Material usage rate (quantity per week/month)
- Seasonal patterns
- Fast-moving vs. slow-moving items
- Reorder recommendations based on usage
- Cost trends

**Time Periods:**
- Last 30/60/90 days
- Monthly trend (12 months)
- Quarterly trend

#### 4.2 Job Cost Estimation Report
**Purpose:** Historical data for estimating future jobs

**Data Points:**
- Average material cost by job type
- Average labor hours by job type
- Material cost per square foot
- Labor cost per square foot
- Common materials used per job type
- Profit margin averages

**Grouping:**
- By job type
- By customer type
- By complexity level

## Implementation Plan

### Phase 1: Backend Database Views & Functions

#### New Database Views to Create

```sql
-- 1. Material usage by job
CREATE VIEW job_material_detail AS ...

-- 2. Material usage by category
CREATE VIEW material_category_summary AS ...

-- 3. Material efficiency metrics
CREATE VIEW material_efficiency_report AS ...

-- 4. Employee timecard detail
CREATE VIEW employee_timecard_detail AS ...

-- 5. Job profitability summary
CREATE VIEW job_profitability_summary AS ...

-- 6. Daily activity summary
CREATE VIEW daily_activity_summary AS ...

-- 7. Material consumption trends
CREATE VIEW material_consumption_trends AS ...
```

#### New Database Functions

```sql
-- Get job profitability for date range
CREATE FUNCTION get_job_profitability(start_date, end_date, filters) ...

-- Get material usage aggregates
CREATE FUNCTION get_material_usage_summary(period_type, filters) ...

-- Get employee timecard
CREATE FUNCTION get_employee_timecard(employee, week_ending) ...

-- Get labor efficiency metrics
CREATE FUNCTION get_labor_efficiency(period_type, filters) ...
```

### Phase 2: Backend API Endpoints

#### Material Report Endpoints
```
GET /reports/job-materials/{work_order_id}
GET /reports/material-usage-summary?period=monthly&start_date=...&end_date=...
GET /reports/material-efficiency?period=weekly&start_date=...
GET /reports/material-trends?period=monthly&months=12
```

#### Labor Report Endpoints
```
GET /reports/employee-timecard/{username}?week_ending=...
GET /reports/job-labor/{work_order_id}
GET /reports/employee-productivity?period=monthly&employee=...
GET /reports/labor-summary?period=weekly&start_date=...&end_date=...
```

#### Combined Report Endpoints
```
GET /reports/job-profitability/{work_order_id}
GET /reports/job-profitability-summary?period=monthly&start_date=...&end_date=...
GET /reports/daily-activity?date=...
GET /reports/job-comparison?job_type=...&start_date=...&end_date=...
```

### Phase 3: Frontend Components

#### 3.1 Enhanced Reports Page
- Tab-based navigation for different report types
- Period selector (job, weekly, monthly, quarterly, annually, all-time)
- Date range picker
- Export to PDF/Excel functionality

#### 3.2 Individual Report Components

**MaterialUsageReport.js**
- Material breakdown by category
- Charts: Pie chart of material costs by category
- Table: Top materials used with quantities and costs
- Filters: Date range, job type, material category

**LaborReport.js**
- Employee timecard view
- Labor efficiency metrics
- Charts: Bar chart of hours by employee, line chart of hours over time
- Filters: Employee, date range, job type

**JobProfitabilityReport.js**
- P&L view for jobs
- Material + Labor breakdown
- Charts: Waterfall chart (revenue → costs → profit)
- Comparison view for multiple jobs
- Filters: Status, job type, customer, date range

**EmployeeTimecard.js**
- Weekly timecard grid
- Daily hours entry
- Week summary with overtime calculation
- Lock/unlock week for payroll
- Export to PDF

**DailyActivityDashboard.js**
- Today's snapshot
- Jobs in progress
- Materials used today
- Hours logged today
- Revenue/costs today

#### 3.3 Report Export Features
- PDF generation for timecards (payroll)
- Excel export for detailed data
- Print-friendly views
- Email report functionality

### Phase 4: UI/UX Enhancements

#### Period Selector Component
```jsx
<PeriodSelector
  options={['job', 'daily', 'weekly', 'monthly', 'quarterly', 'annually', 'all-time', 'custom']}
  onPeriodChange={(period, startDate, endDate) => ...}
/>
```

#### Report Filter Panel
```jsx
<ReportFilters
  filters={{
    dateRange: true,
    employee: true,
    customer: true,
    jobType: true,
    status: true,
  }}
  onFilterChange={(filters) => ...}
/>
```

#### Charts & Visualizations
- Material cost pie chart (by category)
- Labor hours bar chart (by employee)
- Profit margin trend line (over time)
- Material usage bar chart (top 10)
- Revenue vs. cost waterfall

### Phase 5: Key Features

#### 5.1 Smart Filtering
- Remember user's last selected filters
- Quick presets: "This Week", "Last Month", "This Quarter", "This Year"
- Save custom filter combinations

#### 5.2 Drill-Down Capability
- Click on monthly summary → see daily breakdown
- Click on material category → see individual materials
- Click on employee total → see individual jobs

#### 5.3 Comparison Features
- Side-by-side job comparison
- Period-over-period comparison (this month vs. last month)
- Variance highlighting (actual vs. budget/estimate)

#### 5.4 Export & Share
- PDF export (formatted for printing)
- Excel export (raw data)
- Email report directly
- Scheduled reports (future enhancement)

## Database Schema Changes Needed

### New Tables (Optional - for caching/performance)
```sql
-- Cache for frequently accessed aggregates
CREATE TABLE report_cache (
  id SERIAL PRIMARY KEY,
  report_type VARCHAR(100),
  filters JSONB,
  period_start DATE,
  period_end DATE,
  data JSONB,
  generated_at TIMESTAMP,
  expires_at TIMESTAMP
);
```

### Indexes for Performance
```sql
-- Optimize time_entries queries
CREATE INDEX idx_time_entries_work_date_range ON time_entries(work_date);
CREATE INDEX idx_time_entries_employee_date ON time_entries(employee_username, work_date);

-- Optimize job_materials_used queries
CREATE INDEX idx_job_materials_status_date ON job_materials_used(status, allocated_at);
CREATE INDEX idx_job_materials_installed_date ON job_materials_used(installed_date);
```

## Priority Implementation Order

### Week 1: Core Infrastructure
1. Create database views for job material detail and job labor detail
2. Create job profitability view combining materials + labor
3. Build backend endpoints for individual job reports
4. Create JobProfitabilityReport.js component

### Week 2: Time Period Aggregates
1. Create material usage summary views (weekly, monthly, etc.)
2. Create labor summary views
3. Build backend endpoints for period-based reports
4. Create PeriodSelector component
5. Create MaterialUsageReport.js component

### Week 3: Employee Features
1. Enhance employee timecard views
2. Build employee productivity views
3. Create EmployeeTimecard.js component
4. Create LaborReport.js component

### Week 4: Polish & Export
1. Add chart visualizations
2. Implement PDF export
3. Implement Excel export
4. Add report filtering panel
5. Add drill-down navigation

## Success Metrics

### Functional Goals
- ✅ View material usage for any job
- ✅ View labor hours for any job
- ✅ View complete job profitability (material + labor + revenue)
- ✅ Generate employee timecards for payroll
- ✅ Analyze material efficiency and waste
- ✅ Track employee productivity
- ✅ Export reports to PDF/Excel

### Performance Goals
- Reports load in < 2 seconds
- Support date ranges up to 5 years
- Handle 1000+ jobs efficiently

### User Experience Goals
- Intuitive period selection
- Clear visual presentation
- Easy export functionality
- Mobile-responsive views

## Technical Considerations

### Performance Optimization
- Use materialized views for complex aggregates
- Implement report caching for frequently accessed data
- Add database indexes on commonly filtered columns
- Consider pagination for large result sets

### Security
- Role-based access to financial reports (admin/manager only)
- Employees can only see their own timecards
- Audit log for report generation

### Scalability
- Design views to handle growing data volume
- Use efficient aggregation queries
- Implement lazy loading for large datasets

## Questions for User

1. **Payroll Processing:**
   - What day does the work week end? (Currently set to Sunday)
   - Do you use a payroll service that needs specific export format?

2. **Report Access:**
   - Should technicians see material costs and profit margins?
   - Or only admins/managers?

3. **Time Periods:**
   - For quarterly reports, which months are Q1, Q2, Q3, Q4?
   - Standard calendar quarters (Jan-Mar, Apr-Jun, etc.)?

4. **Material Tracking:**
   - Do you want to track material waste reasons (damaged, over-ordered, etc.)?
   - Should we flag jobs with high material variance for review?

5. **Export Formats:**
   - PDF for timecards - any specific formatting requirements?
   - Excel exports - any specific column arrangements needed?

6. **Comparison Baselines:**
   - Do you create estimates/quotes before jobs?
   - Should reports compare actual vs. estimated costs?

## Next Steps

After user clarification on the questions above, I will:
1. Create the database migration file with all views and functions
2. Build the backend API endpoints
3. Create the frontend report components
4. Test with real data
5. Iterate based on user feedback
