# main.py Comprehensive Audit Notes
**Date:** January 7, 2026
**File:** backend/main.py (15,150 lines, 161+ endpoints)
**Backup Created:** golden_20260107_pre_audit.tar.gz (85MB)

---

## Executive Summary

This document contains read-only audit findings for main.py. **NO CHANGES HAVE BEEN MADE.** These are observations and recommendations for discussion before any implementation.

The file is the entire backend API for the MA Electrical Inventory system. It handles authentication, inventory management, work orders, scheduling, invoicing, time tracking, PTO, geocoding, and communication services.

---

## 1. Architecture Observations

### 1.1 Monolithic Structure
**Location:** Entire file
**Observation:** All 161+ endpoints are in a single 15,150-line file.

**Potential Improvements to Discuss:**
- Consider splitting into separate router files by domain (already done for quotes_endpoints.py)
- Suggested modules:
  - `auth_endpoints.py` - Login, token refresh, user management
  - `inventory_endpoints.py` - Stock, materials, transactions
  - `workorder_endpoints.py` - Work orders, tasks, notes, photos
  - `schedule_endpoints.py` - Job schedule dates, crew assignments
  - `invoice_endpoints.py` - Invoicing, payments, line items
  - `time_endpoints.py` - Time entries, timecards
  - `pto_endpoints.py` - PTO requests, call-outs, availability
  - `reports_endpoints.py` - All reporting endpoints

**Trade-offs:**
- Pros: Easier navigation, smaller file diffs, clear ownership
- Cons: More files to manage, potential circular import issues, refactoring effort

### 1.2 Database Connection Pattern
**Location:** Lines ~100-150, used throughout
**Current Pattern:**
```python
conn = get_db_connection()
cur = conn.cursor()
try:
    # work
finally:
    cur.close()
    conn.close()
```

**Observation:** Connection handling is repeated in every endpoint. Some endpoints have the pattern correct, others have inconsistencies in error handling.

**Potential Improvement:**
- Context manager or dependency injection for automatic cleanup
- FastAPI dependency like `Depends(get_db)` that handles connection lifecycle

---

## 2. Security Observations

### 2.1 Role-Based Access Control
**Location:** Lines 815-850
**Functions:** `require_admin()`, `require_manager_or_admin()`, `require_admin_or_office()`

**Observation:** Good separation of concerns. Roles properly checked.

**Minor Finding:** Some endpoints use inline role checks rather than dependencies:
- Line 14018: `if current_user["role"] not in ["admin", "office"]:`
- Line 14083: `if current_user["role"] not in ["admin", "office"]`

**Recommendation:** Standardize all role checks to use the helper dependencies.

### 2.2 Path Traversal Protection
**Location:** Lines 7316-7330 (work order photo serving)
**Observation:** Properly sanitizes filenames and validates resolved paths stay within upload directory. This is done correctly.

### 2.3 SQL Injection Prevention
**Observation:** All SQL queries use parameterized queries with `%s` placeholders. No string concatenation of user input into SQL. This is correct.

### 2.4 JWT Token Handling
**Location:** Lines 630-680
**Observation:** Uses python-jose for JWT. Token expiration properly configured. No refresh token rotation observed (single token model).

---

## 3. Potential Bug Areas

### 3.1 Connection Leak Risk
**Location:** Multiple endpoints
**Issue:** Some error paths may not properly close connections.

**Example Pattern Found:**
```python
if not wo:
    conn.close()  # cursor not closed!
    raise HTTPException(...)
```

**Recommendation:** Audit all early returns to ensure both cursor and connection are closed.

### 3.2 Time Entry Locking Logic
**Location:** Lines 7910-7925
**Current Logic:**
```python
cur.execute("""
    SELECT EXTRACT(DOW FROM CURRENT_TIMESTAMP) = 1
       AND %s::date < CURRENT_DATE as is_locked
""", (week_ending,))
```

**Observation:** This locks entries on Monday (DOW=1) when the week ending is before current date. This may need verification that the business logic is correct.

### 3.3 Duplicate Code Patterns
**Observation:** Several endpoints have very similar code for:
- Date range calculations (monthly, quarterly, annually periods)
- Connection handling boilerplate
- Update query building with dynamic fields

**Lines with repeated date logic:**
- 9954-9968 (profitability)
- 10087-10098 (materials)
- 10320-10332 (labor)
- 10669-10683 (variance)

**Recommendation:** Extract to helper function like `get_date_range(period, start_date, end_date)`.

---

## 4. Scheduling System Observations

### 4.1 Dual Assignment Systems
**Observation:** There are two related but separate assignment concepts:

1. **work_order_assignments** (Lines 12084-12322)
   - Assigns workers to a work order as a whole
   - Used for "job roster"
   - Has fields: `assignment_role`, `is_lead`, `hourly_rate`

2. **job_schedule_crew** (Lines 12617-12700)
   - Assigns workers to specific dates within a work order
   - Used for daily scheduling
   - Has fields: `role`, `is_lead_for_day`, `scheduled_hours`

**Question for Discussion:**
- Is this dual-system intentional?
- Should they be unified or kept separate?
- Current behavior: Adding to schedule_crew doesn't auto-update work_order_assignments

### 4.2 Crew Sync Endpoint
**Location:** Lines 12740-13060 (PATCH /work-orders/{id}/crew)
**Observation:** This unified endpoint handles syncing crew to dates. It's complex but handles the edge cases well.

---

## 5. Invoice System Observations

### 5.1 Invoice Recalculation
**Location:** Lines 11930-11990 (line item update)
**Observation:** When a line item is updated, the invoice totals are manually recalculated. This is done correctly but is repeated in multiple places.

**Potential Improvement:** Move recalculation logic to a helper function or database trigger.

### 5.2 Email Template Hardcoded
**Location:** Lines 11684-11732
**Observation:** Invoice email HTML template is hardcoded in the endpoint.

**Recommendation:** Consider moving to a separate template file or database-stored template for easier updates.

---

## 6. Reporting System Observations

### 6.1 Admin-Only Reports
**Location:** Lines 9837-9844, and throughout reports section
**Pattern:** `require_admin_access(current_user)` helper function.

**Observation:** Reports are properly restricted to admin role only.

### 6.2 Materialized Views Usage
**Observation:** Several reports query from views:
- `customer_financial_summary`
- `inventory_valuation`
- `employee_productivity`
- `job_profitability_view`
- `job_variance_view`
- `daily_activity_summary_view`

**Question:** Are these standard views or materialized views? If standard, performance could be an issue with large datasets.

---

## 7. PTO/Availability System

### 7.1 Call-Out vs PTO Flow
**Observation:** Two distinct flows exist:

1. **Call-Out** (Lines 14313-14507)
   - Immediate unavailability (sick, emergency)
   - Automatically approved
   - Immediately removes from schedule

2. **PTO Request** (Lines 14667-14779)
   - Planned absence (vacation, personal)
   - Requires approval
   - Only affects schedule after approval

This is a good separation of concerns.

### 7.2 Schedule Cleanup on PTO
**Location:** Lines 14353-14468
**Observation:** When an employee calls out or PTO is approved, they are:
- Removed from `job_schedule_crew`
- If they were lead, another crew member is promoted
- `work_orders.assigned_to` is cleared if it matches

---

## 8. Geocoding Observations

### 8.1 Rate Limiting Implementation
**Location:** Lines 13904-13948
**Observation:** Uses asyncio semaphore and sleep to enforce 1 request/second for Nominatim API. This is correct.

### 8.2 Batch Geocoding Limit
**Location:** Line 14032
**Observation:** `LIMIT 50` on batch geocoding to prevent long-running requests.

---

## 9. Performance Considerations

### 9.1 N+1 Query Pattern
**Location:** Lines 12386-12404 (get_job_schedule_dates)
**Pattern:**
```python
schedule_dates = cur.fetchall()
for sd in schedule_dates:
    cur.execute("SELECT ... WHERE jsc.job_schedule_date_id = %s", (sd['id'],))
    sd['crew'] = cur.fetchall()
```

**Observation:** This is an N+1 query pattern. For a work order with 20 scheduled dates, this makes 21 queries.

**Recommendation:** Use a single query with JOINs and restructure in Python, or use a subquery.

### 9.2 Large Result Sets
**Observation:** Some endpoints don't have pagination:
- `GET /reports/customer-summary` has `limit` parameter
- `GET /reports/inventory-valuation` has no limit
- `GET /reports/dead-stock` has no limit

---

## 10. Error Handling Patterns

### 10.1 Consistent Pattern
**Location:** Throughout
**Observation:** Most endpoints follow this pattern:
```python
try:
    # work
    conn.commit()
except HTTPException:
    raise
except Exception as e:
    conn.rollback()
    cur.close()
    conn.close()
    log_and_raise(e)
```

This is good - HTTPExceptions are re-raised, other exceptions are logged.

### 10.2 log_and_raise Function
**Observation:** This function (defined early in file) logs errors and raises HTTPException. Consistent use throughout.

---

## 11. External Service Dependencies

### 11.1 Communication Services
**Location:** Lines 11667-11739, 11841-11858
**Dependencies:**
- `communication_service.EmailService`
- `communication_service.SMSService`
- `communication_service.SMSGatewayService`

**Observation:** These are imported at runtime inside functions, not at module level. This is intentional to avoid circular imports but adds overhead per request.

### 11.2 Nominatim API
**Location:** Lines 13919-13948
**Dependency:** OpenStreetMap Nominatim for geocoding
**Risk:** Free service with rate limits. If production usage increases, may need paid alternative.

---

## 12. Recommendations Summary (Priority Order)

### High Priority (Should Discuss First)
1. **Connection handling standardization** - Some early returns don't close cursors
2. **N+1 query patterns** - Affects performance on schedule views
3. **Inline role checks vs dependencies** - Inconsistent pattern

### Medium Priority
4. **Date range calculation helper** - Remove code duplication
5. **Invoice recalculation helper** - Centralize logic
6. **Email template extraction** - Easier to maintain

### Lower Priority (Quality of Life)
7. **File splitting** - Large refactor, low urgency
8. **Pagination for all list endpoints** - Future-proofing

---

## 13. Questions for Discussion

1. **Scheduling System:** Is the dual work_order_assignments / job_schedule_crew system working as intended? Are there any pain points?

2. **Time Entry Locking:** Is the Monday-based locking logic correct for your payroll process?

3. **Report Views:** Are the reporting views (customer_financial_summary, etc.) performing well? Any slow queries?

4. **Geocoding:** Is 50 customers per batch sufficient for the initial data load?

5. **Email Templates:** Would it be valuable to make invoice email templates editable through the admin interface?

---

## Next Steps

After discussing these findings:
1. Prioritize which items to address
2. Create individual tasks for each approved change
3. Implement changes one at a time with testing
4. Continue audit of other major files (frontend components, etc.)

---

*This audit was conducted as a read-only review. No code changes were made.*
