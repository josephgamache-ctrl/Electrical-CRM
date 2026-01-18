# Claude Developer Guide - Pem2 Services / MA Electrical Inventory

**Purpose:** Optimized reference for Claude to continue development on this codebase.
**Last Updated:** January 17, 2026 (Added job-to-manager assignment feature, test jobs for khiggins)
**Current State:** Backend fully modularized (15 endpoint modules, 256+ endpoints)
**Van Fleet:** 8 active vans with ~$36,300 total inventory value

---

## Table of Contents

1. [Quick Reference](#1-quick-reference)
2. [Architecture Overview](#2-architecture-overview)
3. [Backend Structure](#3-backend-structure)
4. [Frontend Structure](#4-frontend-structure)
5. [Database Reference](#5-database-reference)
6. [API Endpoints Summary](#6-api-endpoints-summary)
7. [User Roles & Permissions](#7-user-roles--permissions)
8. [Deployment Procedures](#8-deployment-procedures)
9. [Common Development Tasks](#9-common-development-tasks)
10. [Known Issues & Fixes Applied](#10-known-issues--fixes-applied)
11. [Testing Procedures](#11-testing-procedures)
12. [Security Considerations](#12-security-considerations)
13. [Communication Services (Email/SMS)](#13-communication-services-emailsms)

---

## 1. Quick Reference

### Server Details

| Resource | Value |
|----------|-------|
| **Production IP** | 165.22.32.192 |
| **Production URL** | https://app.krisjohnsonelectrical.com |
| **Database** | ma_electrical_inventory (PostgreSQL 13) |
| **Docker Network** | ma-electrical_ma_electrical_network |
| **Production Directory** | /opt/ma-electrical/ |
| **Backup Location** | /opt/ma-electrical/backups/ |

### Docker Containers

| Container | Purpose |
|-----------|---------|
| ma_electrical-backend | FastAPI Python backend |
| ma_electrical-frontend | React app served by nginx |
| ma_electrical-db | PostgreSQL database |
| ma_electrical-nginx | Reverse proxy with SSL |

### Key Commands

```bash
# SSH to production
ssh root@165.22.32.192

# Restart backend after changes
docker restart ma_electrical-backend

# Check backend logs
docker logs --tail 50 ma_electrical-backend

# Access database
docker exec -it ma_electrical-db psql -U postgres -d ma_electrical_inventory

# Get fresh auth token (for API testing)
docker exec ma_electrical-backend curl -s -X POST 'http://localhost:8000/login' -d 'username=jgamache&password=TestAdmin123%21'
```

### Test User Credentials

| Username | Role | Password |
|----------|------|----------|
| jgamache | Admin | TestAdmin123! (or Pem2Services2026) |
| cemerson | Admin | Pem2Services2026 |
| jcurrie | Admin | Pem2Services2026 |
| khiggins | Manager | Pem2Services2026 |
| tfisher | Manager | Pem2Services2026 |

**Note:** The `!` character needs URL encoding as `%21` in curl commands.

---

## 2. Architecture Overview

### Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Material-UI (MUI) |
| Backend | Python FastAPI |
| Database | PostgreSQL 13 |
| Hosting | Docker on DigitalOcean |
| Auth | JWT with bcrypt password hashing |

### Application Stats (as of Jan 17, 2026)

| Category | Count |
|----------|-------|
| Backend Endpoint Modules | 15 |
| Total API Endpoints | 256+ |
| Database Tables | 62 |
| Frontend Components | 79 |
| Frontend Routes | 28 |
| API Functions (api.js) | 150+ |

### File Structure

```
MA_Electrical_Inventory/
├── frontend/
│   ├── src/
│   │   ├── App.js                 # Main app with routes
│   │   ├── api.js                 # All API functions
│   │   ├── theme.js               # MUI theme
│   │   └── components/            # React components
│   │       ├── schedule/          # Schedule sub-components
│   │       ├── time/              # Time tracking
│   │       ├── admin/             # Admin pages
│   │       ├── reports/           # Report components
│   │       └── common/            # Shared components
│   └── public/                    # Static files, PWA manifest
├── backend/
│   ├── main.py                    # Core FastAPI app (~712 lines)
│   ├── auth_endpoints.py          # Authentication & user management
│   ├── inventory_endpoints.py     # Inventory CRUD & scanning
│   ├── workorder_endpoints.py     # Work order management
│   ├── schedule_endpoints.py      # Scheduling, calendar, PTO, crew
│   ├── invoice_endpoints.py       # Invoicing and payments
│   ├── time_endpoints.py          # Time tracking and timecards
│   ├── settings_endpoints.py      # User and communication settings
│   ├── notifications_endpoints.py # Notification management
│   ├── purchase_orders_endpoints.py # Purchase order management
│   ├── vendors_dashboard_endpoints.py # Vendors and dashboard
│   ├── reports_endpoints.py       # Financial and operational reports
│   ├── quotes_endpoints.py        # Quote management
│   ├── communication_service.py   # Email/SMS services
│   └── requirements.txt           # Python dependencies
├── database/
│   └── migrations/                # SQL migrations
└── backups/                       # Local backup snapshots
```

---

## 3. Backend Structure

### Module Pattern

All endpoint modules follow this dependency injection pattern:

```python
# module_endpoints.py
from fastapi import APIRouter, HTTPException, Request
router = APIRouter(tags=["Module Name"])

# Module-level variables set by init function
_get_db_connection = None
_get_current_user = None

def init_module(db_func, auth_func):
    """Initialize the module with database and auth functions from main.py"""
    global _get_db_connection, _get_current_user
    _get_db_connection = db_func
    _get_current_user = auth_func

def get_db():
    """Get database connection"""
    return _get_db_connection()

async def get_current_user_from_request(request: Request):
    """Extract token from request and get current user."""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    return await _get_current_user(token)
```

### Registration in main.py

```python
from module_endpoints import router as module_router, init_module
init_module(get_db_connection, get_current_user)
app.include_router(module_router)
```

### Backend Modules Summary

| Module | Lines | Endpoints | Description |
|--------|-------|-----------|-------------|
| main.py | 824 | 8 | FastAPI app, CORS, JWT, DB pool |
| auth_endpoints.py | 964 | 15 | Login, users, roles, password |
| inventory_endpoints.py | 2,740 | 30 | Inventory CRUD, scanning, cycle count |
| workorder_endpoints.py | 2,695 | 31 | Work orders, tasks, notes, photos |
| schedule_endpoints.py | 2,587 | 27 | Calendar, crew, PTO, availability |
| invoice_endpoints.py | 1,281 | 12 | Invoices, payments, email/SMS |
| time_endpoints.py | 1,319 | 12 | Time entries, timecards, submit |
| settings_endpoints.py | 1,038 | 17 | User settings, communication config |
| notifications_endpoints.py | 413 | 6 | Notifications CRUD |
| purchase_orders_endpoints.py | 753 | 9 | Purchase orders, receiving |
| vendors_dashboard_endpoints.py | 318 | 3 | Vendors, dashboard jobs |
| reports_endpoints.py | 2,466 | 26 | All financial/operational reports |
| quotes_endpoints.py | 1,541 | 24 | Quotes, templates, conversion |
| van_endpoints.py | 1,090 | 13 | Van inventory, transfers, tracking |
| customers_endpoints.py | 505 | 8 | Customer CRUD, search |

### Key Backend Functions (main.py)

| Function | Purpose |
|----------|---------|
| `get_db_connection()` | Returns a pooled database connection with RealDictCursor |
| `get_current_user(token)` | Validates JWT and returns user dict |
| `log_and_raise(message, code, e)` | Error handler with UUID logging |
| `require_admin_access(user)` | Decorator for admin-only endpoints |
| `require_admin_or_office(user)` | Decorator for admin or office |
| `require_admin_or_manager(user)` | Decorator for admin or manager |

### Database Connection Pattern

```python
conn = get_db()
cur = conn.cursor()
try:
    cur.execute("SELECT ...", (params,))
    result = cur.fetchall()
    return result
finally:
    cur.close()
    conn.close()
```

**Critical:** Always close both cursor AND connection, even on error paths.

---

## 4. Frontend Structure

### Key Components

| Component | Route | Purpose |
|-----------|-------|---------|
| App.js | / | Main routing and auth context |
| UnifiedDashboard.js | /home | Auto-switches mobile/desktop |
| DesktopDashboard.js | - | Dashboard for screens >=1024px |
| MobileDashboard.js | - | Mobile-optimized dashboard |
| JobsList.js | /jobs | Job cards with field view |
| JobView.js | /jobs/:id | Full job detail view |
| WorkOrdersList.js | /work-orders | Admin work order table |
| WorkOrderDetail.js | /work-orders/:id | Full work order with pricing |
| Schedule.js | /schedule | Schedule container with tabs |
| InventoryList.js | /inventory | Inventory grid |
| InventoryScanner.js | /inventory/scan | Barcode scanner |
| InvoiceList.js | /invoices | Invoice listing |
| InvoiceDetail.js | /invoices/:id | Invoice detail with editing |
| ReportsPage.js | /reports | Reports dashboard |
| UserManagement.js | /admin/users | User CRUD |
| SettingsPage.js | /settings | User settings |
| VansList.js | /vans | Van fleet inventory management |
| VanInventoryDialog.js | - | Van inventory details dialog |
| ReturnRackPage.js | /return-rack | Vendor returns management |
| BarcodeScanner.js | - | Generic barcode scanning component |
| JobMaterialScanner.js | /job-scanner | Job-specific material scanning |
| MaterialReconciliationDialog.js | - | Material reconciliation for jobs |
| DelayJobDialog.js | - | Job delay management dialog |
| OrderPlanning.js | /order-planning | Purchase order planning |
| QuotesList.js | /quotes | Quote listing |
| QuoteDetail.js | /quotes/:id | Quote detail view |
| QuoteForm.js | /quotes/new | Quote creation/editing |
| Customers.js | /customers | Customer management |
| PurchaseOrders.js | /purchase-orders | Purchase order management |
| ProfilePage.js | /profile | User profile page |

### Schedule Component Tabs

**Admin/Manager (5 tabs):**
1. List - Day (index 0)
2. Calendar (index 1)
3. Dispatch (index 2) - **DEFAULT**
4. Employee (index 3)
5. Map (index 4)

**Technician/Office (3 tabs):**
1. Map (index 0) - **DEFAULT**
2. Employee (index 1)
3. Calendar (index 2)

### API Functions (api.js)

All API calls go through `frontend/src/api.js`. Key patterns:

```javascript
// GET with auth
export async function fetchWorkOrders() {
  const response = await fetch(`${API_BASE_URL}/work-orders`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
}

// POST with JSON body
export async function createWorkOrder(data) {
  const response = await fetch(`${API_BASE_URL}/work-orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to create');
  return response.json();
}
```

### Route Guards

```javascript
// In App.js
<AdminRoute path="/admin/users" element={<UserManagement />} />
<AdminOrManagerRoute path="/work-orders" element={<WorkOrdersList />} />
<AdminOrOfficeRoute path="/invoices" element={<InvoiceList />} />
```

---

## 5. Database Reference

### Key Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| users | User accounts | username, password, role, active |
| customers | Customer records | id, first_name, last_name, company_name |
| work_orders | Jobs | id, work_order_number, customer_id, status |
| inventory | Stock items | item_id, description, qty, location |
| invoices | Customer invoices | id, invoice_number, work_order_id, status |
| time_entries | Labor tracking | id, work_order_id, employee_username, hours_worked |
| job_schedule_dates | Schedule dates | work_order_id, scheduled_date, start_time |
| job_schedule_crew | Crew assignments | job_schedule_date_id, employee_username |
| pto_requests | Time off requests | username, start_date, end_date, status |
| notifications | User notifications | id, username, message, read |
| stock_transactions | Inventory audit trail | inventory_id, transaction_type, quantity_change |
| vendor_returns | Return rack items | inventory_id, vendor_id, status, quantity |

### Stock Transactions (Inventory Audit Trail)

The `stock_transactions` table provides a complete audit trail of all inventory movements. **IMPORTANT:** All inventory changes should log a transaction for future reporting.

#### Transaction Types

| Type | Description | qty_change | When Used |
|------|-------------|------------|-----------|
| `adjustment` | Manual stock correction | +/- | Cycle counts, corrections |
| `transfer` | Warehouse ↔ Van movement | +/- | Restock, returns |
| `got_it` | Field acquisition | + | Item acquired at store/job site |
| `purchase` | PO received | + | Purchase order receiving |
| `job_usage` | Material consumed on job | - | Job completion reconciliation |
| `job_return` | Leftover returned to warehouse | + | Job completion reconciliation |
| `job_to_van` | Leftover transferred to van | 0 | Job completion reconciliation |
| `allocation_release` | Reserved stock released | 0 | Job cancelled/unused materials |
| `return_rack` | Placed on vendor return rack | 0 | Defective/damaged items |
| `vendor_return` | Actually returned to vendor | - | Vendor return processed |

#### Key Columns

```sql
stock_transactions (
    id SERIAL PRIMARY KEY,
    inventory_id INTEGER NOT NULL,       -- Which item
    transaction_type VARCHAR(20) NOT NULL, -- See table above
    quantity_change INTEGER NOT NULL,     -- +/- or 0
    quantity_before INTEGER NOT NULL,     -- Warehouse qty before
    quantity_after INTEGER NOT NULL,      -- Warehouse qty after
    work_order_id INTEGER,                -- If job-related
    job_material_id INTEGER,              -- Link to job_materials_used
    purchase_order_id INTEGER,            -- If from PO
    from_van_id INTEGER,                  -- Source van (transfers)
    to_van_id INTEGER,                    -- Destination van
    unit_cost DECIMAL(10,2),              -- Cost tracking
    total_cost DECIMAL(10,2),             -- qty * cost
    reason TEXT,                          -- Human-readable description
    performed_by VARCHAR(50),             -- Username
    transaction_date TIMESTAMP            -- Auto timestamp
)
```

#### Example: Job Completion Flow

When a job is completed and materials are reconciled, these transactions are created:

1. **Materials Used:** `job_usage` - Negative qty, tracks consumption
2. **Leftover to Warehouse:** `job_return` - Positive qty, back to available stock
3. **Leftover to Van:** `job_to_van` - Zero qty change (just location tracking)
4. **Unused Allocation:** `allocation_release` - Zero qty change (releases reserved stock)

#### Querying for Reports

```sql
-- Materials used on jobs this month
SELECT i.item_id, i.description, SUM(ABS(st.quantity_change)) as total_used
FROM stock_transactions st
JOIN inventory i ON st.inventory_id = i.id
WHERE st.transaction_type = 'job_usage'
  AND st.transaction_date >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY i.item_id, i.description
ORDER BY total_used DESC;

-- All activity for a specific item
SELECT * FROM stock_transactions
WHERE inventory_id = :item_id
ORDER BY transaction_date DESC;

-- Job material summary
SELECT
    st.work_order_id,
    wo.work_order_number,
    st.transaction_type,
    COUNT(*) as transaction_count,
    SUM(st.quantity_change) as net_change
FROM stock_transactions st
JOIN work_orders wo ON st.work_order_id = wo.id
WHERE st.work_order_id IS NOT NULL
GROUP BY st.work_order_id, wo.work_order_number, st.transaction_type;
```

### Common Column Name Issues

**Verify column names before writing queries:**

| Table | Correct Column | Wrong Assumption |
|-------|----------------|------------------|
| users | `password` | password_hash |
| users | `active` | is_active |
| schedule_contradictions | `resolution_status` | resolved |
| schedule_contradictions | `work_order_ids` (array) | work_order_id |

### Database Access Commands

```bash
# Describe table
docker exec ma_electrical-db psql -U postgres -d ma_electrical_inventory -c "\d table_name"

# Count records
docker exec ma_electrical-db psql -U postgres -d ma_electrical_inventory -c "SELECT COUNT(*) FROM table_name;"

# View users
docker exec ma_electrical-db psql -U postgres -d ma_electrical_inventory -c "SELECT username, role, active FROM users;"
```

---

## 6. API Endpoints Summary

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /login | Login with form data (not JSON) |
| GET | /users/me | Get current user info |

### Users (admin only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /users | List all users |
| POST | /users | Create user |
| PUT | /users/{username} | Update user |
| DELETE | /users/{username} | Deactivate user |

### Work Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /work-orders | List work orders |
| POST | /work-orders | Create work order |
| GET | /work-orders/{id} | Get work order detail |
| PUT | /work-orders/{id} | Update work order |
| DELETE | /work-orders/{id} | Delete work order |
| GET | /work-orders/{id}/notes | Get notes |
| POST | /work-orders/{id}/notes | Add note |
| GET | /work-orders/{id}/photos | Get photos |
| POST | /work-orders/{id}/photos | Upload photo |

### Inventory

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /inventory | List inventory (default limit 100) |
| POST | /inventory | Create item |
| GET | /inventory/{id} | Get item detail |
| PUT | /inventory/{id} | Update item |
| DELETE | /inventory/{id} | Delete item |
| POST | /inventory/{id}/adjust | Quick stock adjust |
| POST | /inventory/{id}/cycle-count | Record cycle count |
| GET | /inventory/search?q= | Search items |
| GET | /inventory/barcode/{upc} | Lookup by barcode |

### Schedule

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /calendar/schedule | Get schedule by date range |
| GET | /calendar/employee/{username} | Employee calendar |
| POST | /work-orders/{id}/schedule-dates | Add schedule date |
| POST | /schedule-dates/{id}/crew | Add crew member |
| DELETE | /schedule-dates/{id}/crew/{username} | Remove crew member |
| GET | /employees/available-for-date | Available employees |
| POST | /employees/{username}/schedule-conflicts | Check conflicts |

### Time Tracking

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /time-entries/my-week | Get user's timecard |
| POST | /time-entries/batch | Batch create entries |
| POST | /time-entries/submit-week | Submit timecard |
| GET | /time-entries/work-order/{id} | Time for work order |

### Vans

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /vans | List all vans |
| GET | /vans/{id} | Get van details with inventory |
| POST | /vans | Create new van |
| PUT | /vans/{id} | Update van |
| DELETE | /vans/{id} | Delete van |
| GET | /vans/{id}/inventory | Get van inventory items |
| POST | /vans/{id}/inventory | Add item to van |
| PUT | /vans/{id}/inventory/{item_id} | Update van inventory item |
| DELETE | /vans/{id}/inventory/{item_id} | Remove item from van |
| POST | /vans/transfer | Transfer inventory between vans/warehouse |
| GET | /vans/summary | Get fleet summary with totals |
| POST | /vans/{id}/restock | Restock van from warehouse |
| GET | /vans/{id}/history | Get van inventory history |

### Customers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /customers | List customers |
| GET | /customers/{id} | Get customer details |
| POST | /customers | Create customer |
| PUT | /customers/{id} | Update customer |
| DELETE | /customers/{id} | Delete customer |
| GET | /customers/search | Search customers |
| GET | /customers/{id}/work-orders | Get customer work orders |
| GET | /customers/{id}/invoices | Get customer invoices |

### Reports (admin only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /reports/financial-snapshot | Financial summary |
| GET | /reports/profit-loss | P&L report |
| GET | /reports/inventory-valuation | Inventory value |
| GET | /reports/employee-productivity | Labor metrics |
| GET | /reports/inventory-movement | Stock movement history with filters |
| GET | /reports/vendor-returns-summary | Return rack summary by vendor |
| GET | /reports/dead-stock | Items with no recent usage |
| GET | /reports/shrinkage-analysis | Count variance analysis |

### Inventory Movement Report

**Endpoint:** `GET /reports/inventory-movement`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| start_date | date | Start of period (default: 30 days ago) |
| end_date | date | End of period (default: today) |
| transaction_type | string | Filter by type (see types below) |
| vendor_id | int | Filter by vendor |
| inventory_id | int | Filter by specific item |
| work_order_id | int | Filter by job |
| limit | int | Max results (default: 500) |

**Response includes:**
- `transactions`: Detailed transaction list
- `summary`: Totals by type with in/out counts
- `top_items`: Most active items in period
- `job_summary`: Materials used per job
- `filters`: Available vendors and transaction types

**Frontend:** `InventoryMovementReport.js` - Tab in ReportsPage with date filters, vendor filter, and three views (All Transactions, Top Items, By Job)

**Login endpoint note:** Uses OAuth2PasswordRequestForm (form data, not JSON):

```bash
# CORRECT
curl -X POST http://localhost:8000/login -d "username=user&password=pass"

# WRONG
curl -X POST http://localhost:8000/login -H "Content-Type: application/json" -d '{"username":"user"}'
```

---

## 7. User Roles & Permissions

### Role Values

| Role | Database Value | Display Name | Description |
|------|----------------|--------------|-------------|
| Administrator | admin | Administrator | Full system access |
| Manager | manager | Manager | Crew/job management, no reports or user admin |
| Technician | technician | Technician | Field worker, sees assigned jobs only |
| Office | office | Office | Billing/invoices focus, no work orders |
| Warehouse | warehouse | Warehouse | Inventory-focused, same base access as technician |

### Route Access Matrix

| Route | Admin | Manager | Office | Technician | Warehouse |
|-------|:-----:|:-------:|:------:|:----------:|:---------:|
| `/home` (Dashboard) | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/jobs` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/work-orders` | ✓ | ✓ | ✗ | ✗ | ✗ |
| `/schedule` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/inventory` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/vans` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/return-rack` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/quotes` | ✓ | ✓ | ✗ | ✗ | ✗ |
| `/invoices` | ✓ | ✗ | ✓ | ✗ | ✗ |
| `/purchase-orders` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `/reports` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `/admin/users` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `/admin/pto-approval` | ✓ | ✓ | ✗ | ✗ | ✗ |

### Feature Permissions Matrix

| Feature | Admin | Manager | Office | Technician | Warehouse |
|---------|:-----:|:-------:|:------:|:----------:|:---------:|
| View all jobs | ✓ | ✓ | ✓ | Assigned only | ✓ |
| Create work orders | ✓ | ✓ | ✗ | ✗ | ✗ |
| Edit work orders | ✓ | ✓ | ✗ | ✗ | ✗ |
| View pricing | ✓ | ✓ | ✓ | ✗ | ✗ |
| Manage crew | ✓ | ✓ | ✗ | ✗ | ✗ |
| Enter own time | ✓ | ✓ | ✓ | ✓ | ✓ |
| View all timesheets | ✓ | ✓ | ✗ | ✗ | ✗ |
| Request PTO | ✓ | ✓ | ✓ | ✓ | ✓ |
| Approve PTO | ✓ | ✓ | ✗ | ✗ | ✗ |
| Manage inventory | ✓ | ✓ | ✓ | ✓ | ✓ |
| Transfer van inventory | ✓ | ✓ | ✓ | ✓ | ✓ |
| View reports | ✓ | ✗ | ✗ | ✗ | ✗ |
| Manage users | ✓ | ✗ | ✗ | ✗ | ✗ |
| Reset passwords | ✓ | ✗ | ✗ | ✗ | ✗ |
| Create invoices | ✓ | ✗ | ✓ | ✗ | ✗ |
| View invoices | ✓ | ✗ | ✓ | ✗ | ✗ |
| Create quotes | ✓ | ✓ | ✗ | ✗ | ✗ |
| Create POs | ✓ | ✗ | ✗ | ✗ | ✗ |

### Password Requirements

When creating or updating user passwords (admin only):
- Minimum 8 characters
- At least 1 uppercase letter (A-Z)
- At least 1 lowercase letter (a-z)
- At least 1 number (0-9)

### Backend Role Checking Functions

```python
# Admin only
def require_admin(current_user: dict):
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

# Admin or manager
def require_manager_or_admin(current_user: dict):
    if current_user.get('role') not in ['admin', 'manager']:
        raise HTTPException(status_code=403, detail="Manager or admin access required")

# Admin or office (for invoice access)
def require_admin_or_office(current_user: dict):
    if current_user.get('role') not in ['admin', 'office']:
        raise HTTPException(status_code=403, detail="Admin or office access required")
```

### Frontend Route Guards (App.js)

```javascript
// Admin only routes
<AdminRoute><Component /></AdminRoute>

// Admin or Manager routes (work orders, quotes, PTO approval)
<AdminOrManagerRoute><Component /></AdminOrManagerRoute>

// Admin or Office routes (invoices)
<AdminOrOfficeRoute><Component /></AdminOrOfficeRoute>

// All authenticated users
<PrivateRoute><Component /></PrivateRoute>
```

### Manager-Worker Assignment System

Managers can only see and manage workers assigned to them via the `manager_workers` table.

**Database Schema:**
```sql
CREATE TABLE manager_workers (
    id SERIAL PRIMARY KEY,
    manager_username VARCHAR(50) REFERENCES users(username),
    worker_username VARCHAR(50) REFERENCES users(username),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by VARCHAR(50) REFERENCES users(username),
    notes TEXT,
    active BOOLEAN DEFAULT TRUE
);
```

**Key Behaviors:**
- A worker CAN be assigned to multiple managers (rare but allowed)
- Managers only see their assigned workers in Dispatch/Schedule views
- Managers receive notifications for their workers' schedule changes, PTO, call-outs
- Managers can mark their workers as calling out sick/unavailable
- Admins can assign/unassign workers via Admin → Manager Assignments

**API Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /admin/manager-workers | All assignments (admin) |
| GET | /admin/manager-workers/{manager} | Workers for manager (admin) |
| PUT | /admin/manager-workers/bulk/{manager} | Bulk assign workers (admin) |
| DELETE | /admin/manager-workers/{id} | Remove assignment (admin) |
| GET | /manager/my-workers | Get own workers (manager) |

### Job-to-Manager Assignment System

Jobs can be assigned to a specific manager via the `assigned_manager` field on work_orders. This is separate from crew assignments.

**Database Schema:**
```sql
-- Column added to work_orders table
ALTER TABLE work_orders ADD COLUMN assigned_manager VARCHAR(50) REFERENCES users(username);
CREATE INDEX idx_work_orders_assigned_manager ON work_orders(assigned_manager);
```

**Key Behaviors:**
- Only 2 managers exist: `khiggins` (Ken Higgins) and `tfisher` (Todd Fisher)
- Jobs appear in a manager's views if:
  1. The job is explicitly assigned to that manager (`assigned_manager = 'khiggins'`), OR
  2. One of the manager's workers is scheduled on the job
- Jobs can be unassigned (assigned_manager = NULL) and still visible to all
- Manager assignment is independent of crew assignment - a manager can be assigned to oversee a job without any of their workers on the crew
- Managers can manage any job assigned to them, including scheduling, editing, etc.

**API Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /work-orders/managers | List available managers for dropdown |
| GET | /work-orders?assigned_manager=khiggins | Filter work orders by manager |
| PUT | /work-orders/{id} | Update assigned_manager field |

**Frontend Components:**
- CreateWorkOrderDialog: "Assign to Manager" dropdown
- EditWorkOrderDialog: "Assign to Manager" dropdown
- WorkOrdersList: Automatically filters by manager for manager role users

**Manager View Filtering Logic (workorder_endpoints.py):**
```python
if user_role == 'manager':
    manager_username = current_user['username']
    base_query += """ AND (
        wo.assigned_manager = %s
        OR EXISTS (
            SELECT 1 FROM job_schedule_crew jsc
            JOIN job_schedule_dates jsd ON jsc.job_schedule_date_id = jsd.id
            JOIN manager_workers mw ON jsc.employee_username = mw.worker_username
            WHERE jsd.work_order_id = wo.id
            AND mw.manager_username = %s
            AND mw.active = true
        )
    )"""
    params.extend([manager_username, manager_username])
```

---

## 8. Deployment Procedures

### Backend Deployment

```bash
# 1. Copy file to server
scp backend/module_endpoints.py root@165.22.32.192:/tmp/

# 2. Copy into container
ssh root@165.22.32.192 "docker cp /tmp/module_endpoints.py ma_electrical-backend:/app/"

# 3. Restart backend
ssh root@165.22.32.192 "docker restart ma_electrical-backend"

# 4. Check logs
ssh root@165.22.32.192 "docker logs --tail 20 ma_electrical-backend"

# 5. Get fresh token and test
TOKEN=$(ssh root@165.22.32.192 "docker exec ma_electrical-backend curl -s -X POST 'http://localhost:8000/login' -d 'username=jgamache&password=TestAdmin123%21'" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
```

### Frontend Deployment (Fast Method - Recommended)

```bash
# 1. Clean and rebuild locally (CRITICAL: clear cache to ensure fresh build)
cd frontend
Remove-Item -Recurse -Force build -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue
npm run build

# 2. Bump service worker version (forces browser cache refresh)
# Edit frontend/public/service-worker.js, increment CACHE_NAME and STATIC_CACHE versions

# 3. Create zip and upload
Remove-Item -Force build.zip -ErrorAction SilentlyContinue
Compress-Archive -Path build\* -DestinationPath build.zip -Force
scp build.zip root@165.22.32.192:/root/build.zip

# 4. Deploy on server (MUST clean container first to prevent old file accumulation)
ssh root@165.22.32.192 "cd /root/frontend-build && rm -rf * && unzip -o /root/build.zip && rm /root/build.zip && docker exec ma_electrical-frontend sh -c 'rm -rf /usr/share/nginx/html/*' && docker cp /root/frontend-build/. ma_electrical-frontend:/usr/share/nginx/html/ && docker exec ma_electrical-frontend nginx -s reload"
```

### Verify Deployment

```bash
# Check JS hash in deployed index.html
ssh root@165.22.32.192 "docker exec ma_electrical-frontend cat /usr/share/nginx/html/index.html | grep -o 'main\.[a-z0-9]*\.js'"

# Verify only ONE JS file exists (no old bundles)
ssh root@165.22.32.192 "docker exec ma_electrical-frontend ls /usr/share/nginx/html/static/js/"

# Check file timestamp matches your build time
ssh root@165.22.32.192 "docker exec ma_electrical-frontend stat /usr/share/nginx/html/static/js/main.*.js | grep Modify"

# Check service worker version
ssh root@165.22.32.192 "docker exec ma_electrical-frontend head -4 /usr/share/nginx/html/service-worker.js"
```

### Common Deployment Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Changes don't appear after deploy | Old cached build in local folder | Delete `build/` AND `node_modules/.cache/` before rebuilding |
| Multiple JS bundles in container | docker cp merges files | MUST run `rm -rf /usr/share/nginx/html/*` BEFORE docker cp |
| Browser still shows old version | Service worker cache | Increment CACHE_NAME version in service-worker.js |
| Same JS hash after code changes | Webpack cache | Delete `node_modules/.cache/` |
| 401 on API tests | Token expired | Get fresh token |
| Container won't start | Syntax error | Check `docker logs` |

**CRITICAL DEPLOYMENT NOTE:** The `docker cp` command MERGES files, it does NOT replace the directory. If you don't clean the container's `/usr/share/nginx/html/` first, old JS bundles will accumulate and may cause issues.

### ⚠️ DEPLOYMENT PERSISTENCE WARNING

**PROBLEM:** Docker containers can lose deployments when:
1. Container is recreated (`docker-compose up -d --build`)
2. Container is removed and recreated
3. Server is rebooted and container doesn't mount volumes
4. Someone runs `docker-compose pull` and restarts

**WHY:** The frontend container has the build BAKED INTO THE IMAGE at build time. When you `docker cp` files in, they exist only in that container instance. If the container is recreated from the image, those changes are LOST.

**LOCATIONS TO CHECK WHEN DEBUGGING VERSION ISSUES:**

| Location | Purpose | Command to Check |
|----------|---------|------------------|
| Docker container (LIVE) | What users see | `docker exec ma_electrical-frontend cat /usr/share/nginx/html/index.html \| grep main` |
| /opt/ma-electrical/frontend/build/ | Persistent server copy | `cat /opt/ma-electrical/frontend/build/index.html \| grep main` |
| /root/frontend-build/ | Temp deploy staging | `cat /root/frontend-build/index.html \| grep main` |
| Local machine | Development copy | Check `frontend/build/index.html` |
| GitHub repo | Version control | `git status` - check for uncommitted files |

**SAFE DEPLOYMENT PROCEDURE:**

```bash
# 1. Build locally
cd frontend && npm run build

# 2. Upload to PERSISTENT location on server
scp -r build/* root@165.22.32.192:/opt/ma-electrical/frontend/build/

# 3. Deploy from persistent location to container
ssh root@165.22.32.192 "docker exec ma_electrical-frontend sh -c 'rm -rf /usr/share/nginx/html/*' && docker cp /opt/ma-electrical/frontend/build/. ma_electrical-frontend:/usr/share/nginx/html/ && docker exec ma_electrical-frontend nginx -s reload"

# 4. VERIFY deployment
ssh root@165.22.32.192 "docker exec ma_electrical-frontend cat /usr/share/nginx/html/index.html | grep -o 'main\.[a-z0-9]*\.js'"
```

**AFTER TESTING IS COMPLETE - CLEANUP OLD VERSIONS:**

```bash
# On server - clean up old JS bundles (keep only current)
ssh root@165.22.32.192 "
  CURRENT_JS=\$(docker exec ma_electrical-frontend cat /usr/share/nginx/html/index.html | grep -o 'main\.[a-z0-9]*\.js')
  echo 'Current JS: '\$CURRENT_JS
  # In container
  docker exec ma_electrical-frontend sh -c 'cd /usr/share/nginx/html/static/js && ls -la'
  # Clean old in /opt persistent dir (optional)
  cd /opt/ma-electrical/frontend/build/static/js && ls -la
"

# Clean /root/frontend-build staging area
ssh root@165.22.32.192 "rm -rf /root/frontend-build/* /root/build.zip"

# On local machine - clean build artifacts
Remove-Item -Recurse -Force frontend/build -ErrorAction SilentlyContinue
Remove-Item -Force frontend/build.zip -ErrorAction SilentlyContinue
```

**COMMIT ALL CHANGES TO GITHUB:**

```bash
# Check what's uncommitted
git status

# Stage and commit all changes
git add -A
git commit -m "Description of changes"
git push origin main
```

**RECOVERY PROCEDURE (if container loses deployment):**

```bash
# If /opt/ma-electrical/frontend/build/ has the good version:
ssh root@165.22.32.192 "docker exec ma_electrical-frontend sh -c 'rm -rf /usr/share/nginx/html/*' && docker cp /opt/ma-electrical/frontend/build/. ma_electrical-frontend:/usr/share/nginx/html/ && docker exec ma_electrical-frontend nginx -s reload"

# If only local has the good version - redeploy from local
cd frontend && npm run build
scp -r build/* root@165.22.32.192:/opt/ma-electrical/frontend/build/
ssh root@165.22.32.192 "docker exec ma_electrical-frontend sh -c 'rm -rf /usr/share/nginx/html/*' && docker cp /opt/ma-electrical/frontend/build/. ma_electrical-frontend:/usr/share/nginx/html/ && docker exec ma_electrical-frontend nginx -s reload"
```

---

## 9. Common Development Tasks

### Adding a New API Endpoint

1. Choose the appropriate module (or create new one)
2. Add the route with proper decorators:

```python
@router.post("/my-endpoint")
async def my_endpoint(request: Request, data: MyModel):
    current_user = await get_current_user_from_request(request)
    require_admin_access(current_user)  # if needed

    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute("INSERT INTO ...", (data.field,))
        conn.commit()
        return {"message": "Success"}
    except Exception as e:
        error_id = str(uuid.uuid4())[:8]
        logger.error(f"Error {error_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error. Reference: {error_id}")
    finally:
        cur.close()
        conn.close()
```

3. Add corresponding frontend API function in `api.js`
4. Deploy backend, test, then deploy frontend

### Adding a New Frontend Component

1. Create component in appropriate folder
2. Add route in `App.js` with proper guard:

```javascript
import MyComponent from './components/MyComponent';

<Route path="/my-route" element={
  <AdminRoute><MyComponent /></AdminRoute>
} />
```

3. Add to navigation if needed (AppHeader.js)
4. Add API function in `api.js`
5. Test locally, then deploy

### Resetting a User Password

```bash
# Generate hash inside container (avoids escaping issues)
ssh root@165.22.32.192 "docker exec ma_electrical-backend python3 -c \"import bcrypt; print(bcrypt.hashpw(b'NewPassword123!', bcrypt.gensalt()).decode())\""

# Update in database
ssh root@165.22.32.192 "docker exec ma_electrical-db psql -U postgres -d ma_electrical_inventory -c \"UPDATE users SET password = 'PASTE_HASH_HERE', failed_login_attempts = 0, locked_until = NULL WHERE username = 'USERNAME'\""
```

### Checking Database Schema

```bash
# Describe a table
ssh root@165.22.32.192 "docker exec ma_electrical-db psql -U postgres -d ma_electrical_inventory -c '\d table_name'"

# List all tables
ssh root@165.22.32.192 "docker exec ma_electrical-db psql -U postgres -d ma_electrical_inventory -c '\dt'"
```

---

## 10. Known Issues & Fixes Applied

### Database Schema Issues (Not Fixed - Low Priority)

| Issue | Location | Impact |
|-------|----------|--------|
| Missing FK | inventory.replacement_item_id | Data integrity |
| No CHECK constraints | status enum fields | Invalid values possible |
| Missing indexes | Several FK columns | Query performance |

### Fixes Applied (January 2026)

| Date | Issue | Fix Applied |
|------|-------|-------------|
| Jan 5 | Inventory field updates not working | Expanded `allowed_fields` to include all 70+ fields |
| Jan 5 | Scanner dialogs behind overlay | Added `slotProps.backdrop` with zIndex 10000 |
| Jan 5 | Login lockout timing attack | Generic lockout message instead of exact time |
| Jan 5 | SQL injection in quotes | Added field whitelists for UPDATE queries |
| Jan 5 | Error leakage | Replaced `str(e)` with UUID logging pattern |
| Jan 6 | Low stock card not working | Fixed to check `data.inventory` first |
| Jan 6 | File upload security | Added extension/MIME type validation |
| Jan 7 | Backend 15K lines | Extracted to 12 modules (~712 lines remaining) |
| Jan 13 | Vendor return update fails with KeyError | Changed from tuple indexing `existing[3]` to dict key access `existing['status']` - cursor returns RealDictCursor |
| Jan 13 | Inventory column `vendor_id` not found | Database uses `primary_vendor_id`, not `vendor_id` - updated all queries in reports_endpoints.py |
| Jan 13 | DataGrid checkbox selection not working | MUI DataGrid v5 uses `selectionModel`/`onSelectionModelChange`, not v7's `rowSelectionModel` props |
| Jan 14 | add-material endpoint KeyError: unit_cost | Now auto-fetches cost/sell_price from inventory if not provided in request |
| Jan 14 | load-materials KeyError: source_type | Removed source_type check - column doesn't exist in job_materials_used |
| Jan 14 | load-materials UndefinedColumn: loaded_by | Column doesn't exist - simplified UPDATE to only set quantity_loaded and status |
| Jan 14 | Inventory column `price` not found | Database uses `sell_price`, not `price` - updated queries |
| Jan 16 | Schema mismatches fixed | Added source_type, loaded_by/at, returned_by/at, external_vendor, external_receipt_number columns to job_materials_used |
| Jan 16 | External purchase returns | External purchases can now be returned (for branch pickups from regular suppliers) |
| Jan 16 | Custom/special order materials | Added custom_description, custom_vendor, custom_manufacturer, custom_model_number, needs_ordering columns to job_materials_used. inventory_id now nullable. material_change_log.inventory_id also nullable. New endpoint: POST /work-orders/{id}/add-custom-material |
| Jan 16 | Custom materials not visible in job | Changed `JOIN inventory` to `LEFT JOIN inventory` in work order materials query. Custom materials have `inventory_id = NULL` and were excluded by INNER JOIN |
| Jan 16 | Customer provided materials | Added `customer_provided` BOOLEAN column to job_materials_used. When true, sets cost/price to 0 and disables ordering. Frontend AddMaterialDialog has "Customer Provided" toggle |
| Jan 16 | JobView mobile navigation | Added MUI Accordion components to make all 8 sections collapsible: Job Details, Job Status, Tasks, Materials, Permits, Notes, Photos & Videos, Activity History. Job Details and Job Status expanded by default |
| Jan 16 | Video upload support | Updated photo upload to accept video files (mp4, webm, mov, avi). Added video preview in upload dialog and playback in job view |
| Jan 17 | Invoice line item editing | Admin/Manager can edit individual line item prices/quantities and labor rates/hours. Includes audit logging, automatic invoice recalculation, and work order total sync for report accuracy |
| Jan 17 | Reports sync with invoice edits | Added work order total sync when invoice line items edited. Reports (Job Profitability, P&L) now correctly reflect edited prices via `job_materials_used.line_total` generated column |

### Schema Column Mappings

| Column | Table | Notes |
|--------|-------|-------|
| price | inventory | Use `sell_price` |
| vendor_id | inventory | Use `primary_vendor_id` |
| updated_at | inventory | Not implemented |

### job_materials_used - New Tracking Columns (Added Jan 16, 2026)

| Column | Type | Purpose |
|--------|------|---------|
| source_type | VARCHAR(20) DEFAULT 'inventory' | 'inventory' or 'external_purchase' |
| loaded_by | VARCHAR(50) | Username who loaded material to van |
| loaded_at | TIMESTAMP | When material was loaded to van |
| returned_by | VARCHAR(50) | Username who returned unused material |
| returned_at | TIMESTAMP | When material was returned |
| external_vendor | VARCHAR(100) | Vendor name for external purchases (e.g., "CED - Worcester") |
| external_receipt_number | VARCHAR(50) | Receipt/invoice number from vendor |
| custom_description | VARCHAR(500) | Description for custom/special order items (NULL for inventory items) |
| custom_vendor | VARCHAR(100) | Vendor name for custom items |
| custom_manufacturer | VARCHAR(100) | Manufacturer for custom items |
| custom_model_number | VARCHAR(100) | Model/part number for custom items |
| needs_ordering | BOOLEAN DEFAULT FALSE | Flag indicating custom item needs to be ordered |
| customer_provided | BOOLEAN DEFAULT FALSE | True if customer is providing this item (no cost to job) |

**Custom/Special Order Materials Flow:** (Added Jan 16, 2026)
1. For designer fixtures, special orders, or items not in inventory
2. Call `POST /work-orders/{id}/add-custom-material` with:
   - description (required): Item description
   - quantity, unit_cost, unit_price (required)
   - vendor, manufacturer, model_number, notes (optional)
   - needs_ordering (default true)
3. Material is created with `inventory_id=NULL` and `source_type='custom'`
4. Status starts as 'planned' - moves through normal lifecycle
5. `needs_ordering` flag helps track procurement status
6. Frontend: AddMaterialDialog has "Custom / Special Order" tab

**External Purchase Flow:**
1. Worker picks up material from supplier branch (CED, Graybar, etc.)
2. Call `POST /work-orders/{id}/add-external-material` with vendor and receipt info
3. Material is marked with `source_type='external_purchase'` and `status='used'`
4. If unused portions need to return, call `POST /work-orders/{id}/return-materials`
5. Returns are tracked with `returned_by` and `returned_at`
6. Returned external purchases reduce `quantity_used` (since they started as used)

### Stock Transaction Types

The system tracks 8 types of inventory movements:

| Type | Description | Qty Change |
|------|-------------|------------|
| job_usage | Material consumed on a job | Negative |
| vendor_return | Item returned to vendor | Negative |
| transfer | Move between warehouse/vans | Both |
| got_it | Field acquisition (emergency purchase) | Positive |
| return_rack | Placed on return rack for vendor return | Zero |
| cycle_count | Physical inventory count adjustment | Both |
| adjustment | Manual quantity adjustment | Both |
| allocation_release | Leftover materials released from job | Zero |

### Patterns to Avoid

```python
# BAD - Error leakage
raise HTTPException(status_code=500, detail=str(e))

# GOOD - UUID logging
error_id = str(uuid.uuid4())[:8]
logger.error(f"Error {error_id}: {str(e)}")
raise HTTPException(status_code=500, detail=f"Operation failed. Reference: {error_id}")
```

```python
# BAD - SQL injection risk
cur.execute(f"UPDATE table SET {field} = %s WHERE id = %s", (value, id))

# GOOD - Field whitelist
ALLOWED_FIELDS = ['field1', 'field2']
if field not in ALLOWED_FIELDS:
    raise HTTPException(status_code=400, detail="Invalid field")
```

---

## 11. Testing Procedures

### API Testing

```bash
# Get token
TOKEN=$(ssh root@165.22.32.192 "docker exec ma_electrical-backend curl -s -X POST 'http://localhost:8000/login' -d 'username=jgamache&password=TestAdmin123%21'" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# Test endpoint
ssh root@165.22.32.192 "docker exec ma_electrical-backend curl -s -H 'Authorization: Bearer $TOKEN' 'http://localhost:8000/endpoint'"
```

### Database Testing

```sql
-- Check user count
SELECT COUNT(*) FROM users;

-- Check active admins
SELECT username, full_name FROM users WHERE role = 'admin' AND active = true;

-- Check inventory count
SELECT COUNT(*) FROM inventory;

-- Check work order statuses
SELECT status, COUNT(*) FROM work_orders GROUP BY status;
```

### Frontend Testing Checklist

- [ ] Login works
- [ ] Dashboard loads (check both mobile and desktop)
- [ ] Work orders list loads
- [ ] Job view shows details
- [ ] Inventory search works
- [ ] Scanner opens (on mobile)
- [ ] Schedule tabs switch correctly
- [ ] Reports load (admin only)

---

## 12. Security Considerations

### Current Security Features

| Feature | Implementation |
|---------|---------------|
| Password hashing | bcrypt with 12 rounds |
| JWT tokens | HS256, 60-minute expiration |
| Account lockout | 5 failed attempts, 15-min lockout |
| Rate limiting | /login (5/min), /users POST (10/min) |
| CORS | Configured for production domain |
| SQL injection | Parameterized queries throughout |
| File uploads | Extension/MIME validation |

### Security Patterns

```python
# Always use parameterized queries
cur.execute("SELECT * FROM users WHERE username = %s", (username,))

# Never expose raw errors
except Exception as e:
    logger.error(f"Error: {str(e)}")  # Log full error
    raise HTTPException(status_code=500, detail="Operation failed")  # Generic to user

# Validate file uploads
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
ALLOWED_MIME_TYPES = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}
```

### Password Reset Commands

```bash
# Reset password for locked account
ssh root@165.22.32.192 "docker exec ma_electrical-db psql -U postgres -d ma_electrical_inventory -c \"UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE username = 'USERNAME'\""
```

---

## 13. Communication Services (Email/SMS)

### Overview

The system supports multiple email and SMS providers configured via Settings > Communication Settings (admin/manager access required).

**Important:** DigitalOcean blocks standard SMTP ports (25, 465, 587). Use SendGrid (HTTP API) which bypasses port restrictions.

### Email Providers

| Provider | Method | Port | Status |
|----------|--------|------|--------|
| **SendGrid** (Recommended) | HTTP API | 443 | Works on DigitalOcean |
| Gmail SMTP | SMTP/TLS | 587 | Blocked by DigitalOcean |
| Other SMTP | SMTP | 25/465/587 | Blocked by DigitalOcean |

### SendGrid Setup

1. Create free account at https://signup.sendgrid.com/ (100 emails/day free forever)
2. Create API Key: Settings > API Keys > Create API Key
3. Verify sender: Settings > Sender Authentication > Single Sender Verification
4. In app: Settings > Communication Settings > SendGrid section
   - API Key: `SG.xxxxx...`
   - From Name: `Pem2 Services`
   - From Email: Verified sender email
5. Click Test to verify

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/settings/communication` | GET | Get all communication settings |
| `/settings/communication/sendgrid` | POST | Save SendGrid settings |
| `/settings/communication/sendgrid/test` | POST | Test SendGrid |
| `/settings/communication/email` | POST | Save SMTP settings |
| `/settings/communication/email/test` | POST | Test SMTP |
| `/settings/communication/sms-gateway` | POST | Enable email-to-SMS gateway |
| `/settings/communication/sms-gateway/test` | POST | Test SMS gateway |

### SMS Options

| Provider | Cost | Notes |
|----------|------|-------|
| Email-to-SMS Gateway | Free | Uses carrier email gateways (requires email configured) |
| Twilio | Paid | Direct SMS via Twilio API |

### Email-to-SMS Carrier Gateways

The system can send SMS via carrier email gateways (free). Supported carriers:
- AT&T, Verizon, T-Mobile, Sprint, US Cellular, Cricket, Boost, Metro PCS, Virgin, Google Fi, Xfinity, Visible, Spectrum, Consumer Cellular

### Database Tables

| Table | Purpose |
|-------|---------|
| `communication_settings` | Provider configuration (encrypted credentials) |
| `communication_log` | History of sent emails/SMS |
| `email_templates` | Reusable email templates |

### Backend Files

| File | Purpose |
|------|---------|
| `communication_service.py` | EmailService, SendGridEmailService, SMSService, SMSGatewayService classes |
| `settings_endpoints.py` | API endpoints for configuration and testing |

---

## Appendix: Scheduling System Design (Updated January 8, 2026)

### Core Concept: Assignment-Based Scheduling

The scheduling system focuses on **crew assignment** rather than status labels. The key question is:
**"Does this job need crew for upcoming dates?"**

### Job Categories

| Category | Definition | Where Shown |
|----------|------------|-------------|
| **Needs Date** | Has no `start_date` set | Work Orders list (separate section) |
| **Unassigned** | Has `start_date`, NOT delayed, NOT completed, no crew for upcoming dates | Dispatch view |
| **Scheduled** | Has crew assigned for upcoming dates | Calendar, Dispatch (assigned section) |
| **Delayed** | Intentionally paused (date range or indefinite) | Work Orders list only |
| **Completed** | Work finished | Work Orders list, Reports |

### Delay System

Jobs can be delayed in two ways:

1. **Date Range Delay** (e.g., Jan 10-15)
   - Only removes crew from those specific dates
   - Keeps crew on dates outside the range
   - Auto-undelays at midnight after `delay_end_date`
   - Job shows as unassigned for dates needing crew

2. **Indefinite Delay** (`delay_end_date = NULL`)
   - Removes ALL crew from ALL future dates
   - Keeps `job_schedule_dates` records (remembers planned dates)
   - Must be manually un-delayed
   - Does NOT appear in Dispatch/unassigned views

### Database Schema for Delays

```sql
-- Added to work_orders table:
delay_start_date DATE,        -- When delay begins (NULL if not delayed)
delay_end_date DATE,          -- When delay ends (NULL = indefinite)
delay_reason TEXT,            -- Optional note about why delayed
delayed_by VARCHAR(50),       -- Who delayed it
delayed_at TIMESTAMP          -- When it was delayed
```

### Unassigned Job Query Logic

```sql
-- A job is "unassigned" if:
WHERE status NOT IN ('completed', 'cancelled', 'invoiced', 'paid')
  AND start_date IS NOT NULL
  AND start_date <= CURRENT_DATE + INTERVAL '14 days'
  AND (
    -- Not delayed at all
    delay_start_date IS NULL
    OR
    -- Or delay has ended
    (delay_end_date IS NOT NULL AND delay_end_date < CURRENT_DATE)
  )
  AND NOT EXISTS (
    SELECT 1 FROM job_schedule_crew jsc
    JOIN job_schedule_dates jsd ON jsc.job_schedule_date_id = jsd.id
    WHERE jsd.work_order_id = wo.id
      AND jsd.scheduled_date >= CURRENT_DATE
      -- Exclude dates within active delay range
      AND NOT (
        wo.delay_start_date IS NOT NULL
        AND jsd.scheduled_date >= wo.delay_start_date
        AND (wo.delay_end_date IS NULL OR jsd.scheduled_date <= wo.delay_end_date)
      )
  )
```

### Status Flow (Simplified)

```
[No Date] ──(set date)──► [Unassigned] ──(assign crew)──► [Scheduled]
                               │                              │
                               ▼                              ▼
                          [Delayed] ◄────────────────── (delay job)
                               │
                               ▼ (undelay or auto-undelay)
                          [Unassigned]
                               │
                               ▼ (complete work)
                          [Completed] → [Invoiced] → [Paid]
```

### API Endpoints for Delays

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/work-orders/{id}/delay` | POST | Delay a job (date range or indefinite) |
| `/work-orders/{id}/undelay` | POST | Remove delay from a job |
| `/work-orders/{id}/status` | PATCH | Redirects delay requests to /delay endpoint |

#### Delay Endpoint Request Body
```json
{
  "delay_start_date": "2026-01-10",  // Optional, defaults to today
  "delay_end_date": "2026-01-15",    // NULL = indefinite
  "delay_reason": "Waiting for permit"
}
```

#### Undelay Endpoint Request Body
```json
{
  "clear_delay_history": false  // Set true to also clear delay_reason
}
```

### Frontend Components

| Component | Purpose |
|-----------|---------|
| `DelayJobDialog.js` | Dialog to delay jobs with date range/indefinite options |
| `EditWorkOrderDialog.js` | Opens DelayJobDialog when status → delayed |
| `WorkOrdersList.js` | Shows "Needs Date" section for jobs without start_date |
| `ScheduleDispatch.js` | Filters unassigned jobs based on delay rules |
| `EmployeeCalendar.js` | Filters unassigned jobs based on delay rules |

### Auto-Undelay Logic

Located in `backend/main.py`:
```python
def auto_undelay_expired_jobs():
    """Runs on backend startup - finds jobs where delay_end_date has passed"""
    # Sets status to 'scheduled' if crew exists, else 'pending'
    # Clears delay fields (keeps delay_reason for history)
```

---

## Appendix: Status Flows

### Work Order Status

```
Pending → Scheduled → In Progress → Completed → Invoiced
                          ↓
                      Cancelled
```

### Invoice Status

```
Draft → Sent → Partial → Paid
         ↓
       Overdue (auto after due date)
```

### PTO Request Status

```
Pending → Approved
    ↓
  Denied
```

### Purchase Order Status

```
Draft → Pending Approval → Approved → Ordered → Partial → Received
                                         ↓
                                     Cancelled
```

---

## Index A: File Location Reference

| What You're Looking For | File Path |
|------------------------|-----------|
| Main React app & routes | `frontend/src/App.js` |
| All API functions | `frontend/src/api.js` |
| MUI theme configuration | `frontend/src/theme.js` |
| App header/navigation | `frontend/src/components/AppHeader.js` |
| Desktop dashboard | `frontend/src/components/DesktopDashboard.js` |
| Mobile dashboard | `frontend/src/components/MobileDashboard.js` |
| Job list (technician view) | `frontend/src/components/JobsList.js` |
| Job detail view | `frontend/src/components/JobView.js` |
| Work order list | `frontend/src/components/WorkOrdersList.js` |
| Work order detail | `frontend/src/components/WorkOrderDetail.js` |
| Inventory list | `frontend/src/components/InventoryList.js` |
| Barcode scanner | `frontend/src/components/InventoryScanner.js` |
| Schedule container | `frontend/src/components/Schedule.js` |
| Dispatch board | `frontend/src/components/schedule/ScheduleDispatch.js` |
| Employee calendar | `frontend/src/components/schedule/EmployeeCalendar.js` |
| Modify crew dialog | `frontend/src/components/schedule/ModifyCrewDialog.js` |
| Timesheet | `frontend/src/components/time/Timesheet.js` |
| Invoice list | `frontend/src/components/InvoiceList.js` |
| Invoice detail | `frontend/src/components/InvoiceDetail.js` |
| Quotes list | `frontend/src/components/QuotesList.js` |
| Quote detail | `frontend/src/components/QuoteDetail.js` |
| Reports page | `frontend/src/components/ReportsPage.js` |
| User management | `frontend/src/components/admin/UserManagement.js` |
| PTO approval | `frontend/src/components/admin/PTOApprovalPage.js` |
| Settings page | `frontend/src/components/SettingsPage.js` |
| Settings context | `frontend/src/settings/SettingsContext.js` |
| Van fleet list | `frontend/src/components/VansList.js` |
| Van inventory dialog | `frontend/src/components/VanInventoryDialog.js` |
| Return rack page | `frontend/src/components/ReturnRackPage.js` |
| Barcode scanner (generic) | `frontend/src/components/BarcodeScanner.js` |
| Job material scanner | `frontend/src/components/JobMaterialScanner.js` |
| Material reconciliation | `frontend/src/components/MaterialReconciliationDialog.js` |
| Delay job dialog | `frontend/src/components/DelayJobDialog.js` |
| Order planning | `frontend/src/components/OrderPlanning.js` |
| Quote form | `frontend/src/components/QuoteForm.js` |
| Customers page | `frontend/src/components/Customers.js` |
| Purchase orders | `frontend/src/components/PurchaseOrders.js` |
| Profile page | `frontend/src/components/ProfilePage.js` |
| Inventory movement report | `frontend/src/components/reports/InventoryMovementReport.js` |
| FastAPI main app | `backend/main.py` |
| Auth endpoints | `backend/auth_endpoints.py` |
| Inventory endpoints | `backend/inventory_endpoints.py` |
| Work order endpoints | `backend/workorder_endpoints.py` |
| Schedule endpoints | `backend/schedule_endpoints.py` |
| Invoice endpoints | `backend/invoice_endpoints.py` |
| Time entry endpoints | `backend/time_endpoints.py` |
| Settings endpoints | `backend/settings_endpoints.py` |
| Notification endpoints | `backend/notifications_endpoints.py` |
| Purchase order endpoints | `backend/purchase_orders_endpoints.py` |
| Vendor/dashboard endpoints | `backend/vendors_dashboard_endpoints.py` |
| Reports endpoints | `backend/reports_endpoints.py` |
| Quotes endpoints | `backend/quotes_endpoints.py` |
| Van endpoints | `backend/van_endpoints.py` |
| Customer endpoints | `backend/customers_endpoints.py` |
| Email/SMS service | `backend/communication_service.py` |
| Notification service | `backend/notification_service.py` |

---

## Index B: API Endpoint Quick Reference

### Authentication & Users
| Endpoint | Method | Module | Purpose |
|----------|--------|--------|---------|
| `/login` | POST | main.py | User login (form data, returns user info) |
| `/users/me` | GET | ~~N/A~~ | **Does not exist** - login response includes user info |
| `/users` | GET | auth_endpoints | List all users |
| `/users` | POST | auth_endpoints | Create user |
| `/users/{username}` | PUT | auth_endpoints | Update user |
| `/users/{username}` | DELETE | auth_endpoints | Deactivate user |

### Work Orders
| Endpoint | Method | Module | Purpose |
|----------|--------|--------|---------|
| `/work-orders` | GET | workorder_endpoints | List work orders |
| `/work-orders` | POST | workorder_endpoints | Create work order |
| `/work-orders/{id}` | GET | workorder_endpoints | Get detail |
| `/work-orders/{id}` | PUT | workorder_endpoints | Update |
| `/work-orders/{id}` | DELETE | workorder_endpoints | Delete |
| `/work-orders/{id}/notes` | GET/POST | workorder_endpoints | Notes |
| `/work-orders/{id}/photos` | GET/POST | workorder_endpoints | Photos |
| `/work-orders/{id}/tasks` | GET/POST | workorder_endpoints | Tasks |
| `/work-orders/{id}/materials` | GET/POST | workorder_endpoints | Materials |

### Inventory
| Endpoint | Method | Module | Purpose |
|----------|--------|--------|---------|
| `/inventory` | GET | inventory_endpoints | List items |
| `/inventory` | POST | inventory_endpoints | Create item |
| `/inventory/{id}` | GET | inventory_endpoints | Get item |
| `/inventory/{id}` | PUT | inventory_endpoints | Update item |
| `/inventory/{id}/adjust` | POST | inventory_endpoints | Quick adjust |
| `/inventory/{id}/cycle-count` | POST | inventory_endpoints | Cycle count |
| `/inventory/search` | GET | inventory_endpoints | Search items |
| `/inventory/barcode/{upc}` | GET | inventory_endpoints | Barcode lookup |
| `/inventory/low-stock` | GET | inventory_endpoints | Low stock items |

### Schedule
| Endpoint | Method | Module | Purpose |
|----------|--------|--------|---------|
| `/calendar/schedule` | GET | schedule_endpoints | Schedule by date range |
| `/calendar/employee/{username}` | GET | schedule_endpoints | Employee calendar |
| `/work-orders/{id}/schedule-dates` | GET/POST | schedule_endpoints | Schedule dates |
| `/schedule-dates/{id}/crew` | POST | schedule_endpoints | Add crew |
| `/schedule-dates/{id}/crew/{username}` | DELETE | schedule_endpoints | Remove crew |
| `/employees/available-for-date` | GET | schedule_endpoints | Available employees |
| `/employees/{username}/schedule-conflicts` | POST | schedule_endpoints | Check conflicts |
| `/employees/{username}/availability` | GET/POST | schedule_endpoints | Availability |
| `/pto/pending` | GET | schedule_endpoints | Pending PTO |
| `/pto/{id}/approve` | PATCH | schedule_endpoints | Approve PTO |

### Time Tracking
| Endpoint | Method | Module | Purpose |
|----------|--------|--------|---------|
| `/time-entries/my-week` | GET | time_endpoints | User's timecard |
| `/time-entries/batch` | POST | time_endpoints | Batch create |
| `/time-entries/submit-week` | POST | time_endpoints | Submit timecard |
| `/time-entries` | GET/POST | time_endpoints | List/create entries |
| `/time-entries/{id}` | PUT/DELETE | time_endpoints | Update/delete |
| `/time-entries/work-order/{id}` | GET | time_endpoints | Time for WO |

### Invoices
| Endpoint | Method | Module | Purpose |
|----------|--------|--------|---------|
| `/invoices` | GET | invoice_endpoints | List invoices |
| `/invoices` | POST | invoice_endpoints | Create invoice |
| `/invoices/{id}` | GET | invoice_endpoints | Get detail |
| `/invoices/{id}` | PUT | invoice_endpoints | Update |
| `/invoices/{id}/payments` | POST | invoice_endpoints | Record payment |
| `/invoices/{id}/line-items/{item_id}` | PUT | invoice_endpoints | Edit line item price/qty |
| `/invoices/{id}/labor-entries/{entry_id}` | PUT | invoice_endpoints | Edit labor rate/hours |
| `/invoices/{id}/email` | POST | invoice_endpoints | Email invoice |
| `/invoices/{id}/sms` | POST | invoice_endpoints | SMS invoice |
| `/invoices/summary/stats` | GET | invoice_endpoints | Invoice stats |

**Invoice Line Item Editing (Added Jan 17, 2026):**
- Admin/Manager can edit individual material prices and quantities
- Admin/Manager can edit labor rates and hours worked
- Setting price to $0 shows "FREE" chip on invoice
- Changes are audit logged with username and old→new values
- Invoice totals automatically recalculate after edits
- Work order totals sync with invoice totals (for reporting accuracy)
- Reports (Job Profitability, P&L) use `job_materials_used.line_total` which reflects edited prices

### Reports (Admin Only)
| Endpoint | Method | Module | Purpose |
|----------|--------|--------|---------|
| `/reports/financial-snapshot` | GET | reports_endpoints | Financial summary |
| `/reports/profit-loss` | GET | reports_endpoints | P&L report |
| `/reports/inventory-valuation` | GET | reports_endpoints | Inventory value |
| `/reports/employee-productivity` | GET | reports_endpoints | Labor metrics |
| `/reports/dead-stock` | GET | reports_endpoints | Dead stock |
| `/reports/daily-activity` | GET | reports_endpoints | Daily activity |
| `/reports/customer-summary` | GET | reports_endpoints | Customer stats |
| `/reports/monthly-summary` | GET | reports_endpoints | Monthly summary |

### Other
| Endpoint | Method | Module | Purpose |
|----------|--------|--------|---------|
| `/customers` | GET/POST | main.py | Customers |
| `/vendors` | GET | vendors_dashboard_endpoints | Vendors |
| `/dashboard/my-jobs` | GET | vendors_dashboard_endpoints | Dashboard jobs |
| `/notifications` | GET | notifications_endpoints | Get notifications |
| `/notifications/{id}/read` | POST | notifications_endpoints | Mark read |
| `/purchase-orders` | GET/POST | purchase_orders_endpoints | POs |
| `/quotes` | GET/POST | quotes_endpoints | Quotes |
| `/user/settings` | GET/POST | settings_endpoints | User settings |
| `/settings/communication` | GET | settings_endpoints | Comm settings |

---

## Index C: Database Table Reference

| Table | Primary Key | Key Foreign Keys | Purpose |
|-------|-------------|------------------|---------|
| `users` | username | - | User accounts |
| `customers` | id | - | Customer records |
| `work_orders` | id | customer_id | Jobs/work orders |
| `work_order_notes` | id | work_order_id | Job notes |
| `work_order_photos` | id | work_order_id | Job photos |
| `work_order_tasks` | id | work_order_id | Job tasks |
| `inventory` | item_id | - | Stock items |
| `job_materials_used` | id | work_order_id, item_id | Materials on jobs |
| `stock_adjustments` | id | item_id | Inventory adjustments |
| `invoices` | id | work_order_id, customer_id | Customer invoices |
| `invoice_line_items` | id | invoice_id | Invoice lines |
| `invoice_payments` | id | invoice_id | Payments received |
| `time_entries` | id | work_order_id, employee_username | Labor tracking |
| `job_schedule_dates` | id | work_order_id | Schedule dates |
| `job_schedule_crew` | id | job_schedule_date_id, employee_username | Crew assignments |
| `pto_requests` | id | username | Time off requests |
| `employee_availability` | id | username | Availability records |
| `notifications` | id | username | User notifications |
| `purchase_orders` | id | vendor_id | Purchase orders |
| `purchase_order_items` | id | purchase_order_id, item_id | PO line items |
| `quotes` | id | customer_id | Customer quotes |
| `quote_line_items` | id | quote_id | Quote lines |
| `vendors` | id | - | Vendor records |
| `user_settings` | username | - | User preferences |
| `communication_settings` | id | - | Email/SMS config |
| `communication_log` | id | - | Send history |
| `manager_workers` | id | manager_username, worker_username | Manager-worker assignments |
| `vans` | id | - | Work vans |
| `van_inventory` | id | van_id, inventory_id | Van stock |

---

## Index D: Component → Route Mapping

| Route | Component | Access |
|-------|-----------|--------|
| `/` | Redirect to /home | - |
| `/login` | Login | Public |
| `/home` | UnifiedDashboard | All authenticated |
| `/jobs` | JobsList | All authenticated |
| `/jobs/:id` | JobView | All authenticated |
| `/work-orders` | WorkOrdersList | Admin, Manager |
| `/work-orders/:id` | WorkOrderDetail | Admin, Manager |
| `/schedule` | Schedule | All authenticated |
| `/inventory` | InventoryList | All authenticated |
| `/inventory/scan` | InventoryScanner | All authenticated |
| `/vans` | VansList | All authenticated |
| `/return-rack` | ReturnRackPage | All authenticated |
| `/job-scanner` | JobMaterialScanner | All authenticated |
| `/customers` | Customers | All authenticated |
| `/quotes` | QuotesList | Admin, Manager |
| `/quotes/new` | QuoteForm | Admin, Manager |
| `/quotes/:id` | QuoteDetail | Admin, Manager |
| `/quotes/:id/edit` | QuoteForm | Admin, Manager |
| `/invoices` | InvoiceList | Admin, Office |
| `/invoices/:id` | InvoiceDetail | Admin, Office |
| `/purchase-orders` | PurchaseOrders | Admin |
| `/order-planning` | OrderPlanning | Admin |
| `/reports` | ReportsPage | Admin |
| `/timesheet` | Timesheet | All authenticated |
| `/my-timecard` | Timesheet | All authenticated |
| `/admin/users` | UserManagement | Admin |
| `/admin/contradictions` | ContradictionsReport | Admin |
| `/admin/manager-workers` | ManagerWorkerAssignments | Admin |
| `/admin/pto-approval` | PTOApprovalPage | Admin, Manager |
| `/profile` | ProfilePage | All authenticated |
| `/settings` | SettingsPage | All authenticated |

---

## Index E: Common Commands Quick Reference

### SSH & Docker Access
```bash
# SSH to production
ssh root@165.22.32.192

# Backend logs
docker logs --tail 50 ma_electrical-backend

# Database shell
docker exec -it ma_electrical-db psql -U postgres -d ma_electrical_inventory

# Restart backend
docker restart ma_electrical-backend

# Restart frontend
docker restart ma_electrical-frontend
```

### Database Queries
```bash
# Count users
docker exec ma_electrical-db psql -U postgres -d ma_electrical_inventory -c "SELECT COUNT(*) FROM users;"

# List admins
docker exec ma_electrical-db psql -U postgres -d ma_electrical_inventory -c "SELECT username, full_name FROM users WHERE role='admin' AND active=true;"

# Describe table
docker exec ma_electrical-db psql -U postgres -d ma_electrical_inventory -c "\d table_name"

# Check work order statuses
docker exec ma_electrical-db psql -U postgres -d ma_electrical_inventory -c "SELECT status, COUNT(*) FROM work_orders GROUP BY status;"
```

### Password Management
```bash
# Generate bcrypt hash (run inside backend container)
docker exec ma_electrical-backend python3 -c "import bcrypt; print(bcrypt.hashpw(b'PASSWORD', bcrypt.gensalt()).decode())"

# Reset all passwords (use pipe to avoid escaping issues)
echo "UPDATE users SET password = E'\$2b\$12\$HASH_HERE', failed_login_attempts = 0, locked_until = NULL WHERE active = true;" | docker exec -i ma_electrical-db psql -U postgres -d ma_electrical_inventory

# Unlock account
docker exec ma_electrical-db psql -U postgres -d ma_electrical_inventory -c "UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE username = 'USERNAME';"
```

### Deployment
```bash
# Copy backend file
scp backend/file.py root@165.22.32.192:/tmp/ && ssh root@165.22.32.192 "docker cp /tmp/file.py ma_electrical-backend:/app/"

# Copy frontend file
scp frontend/src/components/File.js root@165.22.32.192:/opt/ma-electrical/frontend/src/components/

# Rebuild frontend
ssh root@165.22.32.192 "cd /opt/ma-electrical && docker compose -f docker-compose.prod.yml build --no-cache ma_electrical-frontend && docker compose -f docker-compose.prod.yml up -d ma_electrical-frontend"

# Reload nginx
ssh root@165.22.32.192 "docker exec ma_electrical-nginx nginx -s reload"
```

### API Testing
```bash
# Get auth token
docker exec ma_electrical-backend curl -s -X POST 'http://localhost:8000/login' -d 'username=jgamache&password=Pem2Services2026'

# Test endpoint with token
docker exec ma_electrical-backend curl -s -H "Authorization: Bearer TOKEN" "http://localhost:8000/endpoint"
```

---

## Index F: Error Reference

| Error Message | Likely Cause | Solution |
|---------------|--------------|----------|
| `Invalid salt` | Corrupted bcrypt hash in database | Re-run password reset with proper escaping |
| `401 Unauthorized` | Token expired or invalid | Get fresh token |
| `403 Forbidden` | Role lacks permission | Check role requirements for endpoint |
| `500 Internal Error` with UUID | Backend exception (check logs) | `docker logs ma_electrical-backend` |
| `Connection refused` | Container not running | `docker ps` then `docker start` |
| `Permission denied (publickey)` | SSH key not on server | Add key via DigitalOcean console |
| `CORS error` | Frontend/backend domain mismatch | Check CORS config in main.py |
| Changes not appearing | Browser cache or old JS bundle | Hard refresh (Ctrl+Shift+R) |
| Multiple JS bundles | docker cp merges files | Clean container before copy |

---

## Index G: User Role Quick Reference

| Role | Value | Can Create WO | Can View Pricing | Can Manage Users | Can View Reports |
|------|-------|:-------------:|:----------------:|:----------------:|:----------------:|
| Admin | `admin` | Yes | Yes | Yes | Yes |
| Manager | `manager` | Yes | Yes | No | No |
| Technician | `technician` | No | No | No | No |
| Office | `office` | No | Yes | No | No |
| Warehouse | `warehouse` | No | No | No | No |

### Role-Specific UI Differences

| Feature | Admin | Manager | Technician | Office | Warehouse |
|---------|-------|---------|------------|--------|-----------|
| Schedule default tab | Dispatch | Dispatch | Map | Map | Map |
| Schedule tabs count | 5 | 5 | 3 | 3 | 3 |
| Bottom nav Reports | Yes | No | No | No | No |
| Work Orders menu | Yes | Yes | No | No | No |
| Invoices menu | Yes | No | No | Yes | No |
| Quotes menu | Yes | Yes | No | No | No |

---

## Index H: Comprehensive Audit Results (January 8, 2026)

### Audit Summary

| Category | Status | Details |
|----------|--------|---------|
| **Backups** | Complete | Local: `backups/golden_20260108_pre_audit.tar.gz`Production DB: `/root/backups/db_backup_20260108_pre_audit.sql` (329KB) |
| **Backend Security** | Good (with findings) | See security findings below |
| **Frontend Security** | Excellent | No XSS vectors, no eval(), no password in localStorage |
| **Database Schema** | Good | 62 tables, 171 indexes, 105 foreign keys |
| **API Endpoints** | Operational | All tested endpoints return 200 (except noted) |

### Production Statistics (January 8, 2026)

| Resource | Count |
|----------|-------|
| Database Tables | 62 |
| Database Indexes | 171 |
| Foreign Key Constraints | 105 |
| Active Users | 28 |
| Work Orders | 4 |
| Inventory Items | 237 |
| Invoices | 0 |

### Security Findings - REQUIRES ATTENTION

#### 1. Error Message Leakage (8 instances)

The following files expose internal error details to users via `str(e)`:

| File | Lines | Issue |
|------|-------|-------|
| `add_purchase_order_endpoints.py` | 216, 326, 394, 526, 564, 609, 652 | Raw exception in HTTP response |
| `workorder_endpoints.py` | 437 | Raw exception in HTTP response |

**Fix:** Replace `detail=f"Failed to...: {str(e)}"` with UUID logging pattern:
```python
error_id = str(uuid.uuid4())[:8]
logger.error(f"Error {error_id}: {str(e)}")
raise HTTPException(status_code=500, detail=f"Operation failed. Reference: {error_id}")
```

#### 2. Documentation Inconsistency

| Item | Documentation Says | Actual |
|------|-------------------|--------|
| `/users/me` endpoint | Listed in Index B | Does NOT exist - login returns user info directly |

**Fix:** Remove `/users/me` from Index B or add the endpoint.

### API Endpoint Test Results

| Endpoint | HTTP Code | Status |
|----------|-----------|--------|
| `/users` | 200 | OK |
| `/work-orders` | 200 | OK |
| `/inventory` | 200 | OK |
| `/invoices` | 200 | OK |
| `/notifications` | 200 | OK |
| `/reports/financial-snapshot` | 200 | OK |
| `/reports/profit-loss` | 200 | OK |
| `/reports/daily-activity` | 200 | OK |
| `/calendar/schedule` | 200 | OK |
| `/pto/pending` | 200 | OK |
| `/inventory/low-stock` | 200 | OK |
| `/inventory/abc-analysis` | 200 | OK |
| `/inventory/stockout-predictions` | 200 | OK |
| `/inventory/cycle-count-due` | 200 | OK |
| `/quotes` | 200 | OK |
| `/purchase-orders` | 200 | OK |
| `/vendors` | 200 | OK |
| `/dashboard/my-jobs` | 200 | OK |
| `/time-entries/my-week` | 200 | OK |
| `/user/settings` | 200 | OK |
| `/settings/communication` | 200 | OK |
| `/employees/available-for-date` | 422 | Query param validation (expected) |
| `/users/me` | 404 | Endpoint does not exist |

### Backend Module Line Counts (Updated)

| Module | Lines | Endpoints |
|--------|-------|-----------|
| main.py | ~712 | Core setup |
| auth_endpoints.py | ~900 | 15+ |
| inventory_endpoints.py | 2,163 | 23 |
| workorder_endpoints.py | ~2,020 | 27 |
| schedule_endpoints.py | 2,587 | 35+ |
| invoice_endpoints.py | 1,226 | 12 |
| time_endpoints.py | 1,320 | 12 |
| settings_endpoints.py | 1,015 | 17 |
| notifications_endpoints.py | 413 | 6 |
| purchase_orders_endpoints.py | 753 | 9 |
| vendors_dashboard_endpoints.py | 318 | 3 |
| reports_endpoints.py | 2,078 | 21 |
| quotes_endpoints.py | ~1,500 | 15+ |
| **Total Backend Lines** | **~16,000** | **161+** |

### Role-Based Access Control Audit

All endpoints properly implement role checks:
- Admin-only: `/users` CRUD, `/reports/*`, `/purchase-orders` CRUD
- Admin+Manager: Schedule management, PTO approval, inventory adjustments
- Admin+Office: Invoice management
- All authenticated: View own time entries, settings, dashboard

### Security Best Practices Verified

| Check | Status |
|-------|--------|
| Parameterized SQL queries | Verified in all modules |
| No SQL string concatenation | Verified |
| No `dangerouslySetInnerHTML` | Verified |
| No `eval()` usage | Verified |
| No passwords in localStorage | Verified |
| bcrypt password hashing | Verified (12 rounds) |
| JWT token expiration | Verified (60 minutes) |
| Account lockout after 5 attempts | Verified |
| Rate limiting on login | Verified |
| CORS properly configured | Verified |

### Recommended Actions (Priority Order)

1. **HIGH:** Fix error message leakage in `add_purchase_order_endpoints.py` (7 locations)
2. **HIGH:** Fix error message leakage in `workorder_endpoints.py` (1 location)
3. **LOW:** Update Index B to remove `/users/me` or implement the endpoint
4. **LOW:** Consider adding database CHECK constraints for status enum fields

---

## Appendix: Van Inventory System (Added January 9, 2026)

### Overview

Work vans serve as mobile inventory locations. Technicians can:
- Stock their vans from the warehouse
- Use materials from their van on jobs
- Transfer materials between vans
- Return unused materials to warehouse
- Field-acquire items directly to van ("Got It" feature)

### Current Fleet (as of January 9, 2026)

| Van ID | Name | Van Number | Assigned To | Items | Total Value |
|--------|------|------------|-------------|-------|-------------|
| 1 | Van 101 | V-101 | John Forget | 8 | $4,401.00 |
| 3 | Van 102 | V-102 | Brad Galvin | 7 | $5,175.00 |
| 4 | Van 103 | V-103 | Jonathan Frates | 9 | $3,536.90 |
| 5 | Van 104 | V-104 | Eric Anzivino | 8 | $6,695.75 |
| 6 | Van 105 | V-105 | Ryan Keyes | 7 | $2,612.75 |
| 7 | Van 106 | V-106 | Liam Moloney | 7 | $4,001.90 |
| 8 | Van 107 | V-107 | Cam Melanson | 7 | $4,451.00 |
| 9 | Van 108 | V-108 | Sean Tully | 7 | $5,425.60 |

**Total Fleet Value:** ~$36,300

### Database Tables

```sql
-- work_vans: Van records
CREATE TABLE work_vans (
    id SERIAL PRIMARY KEY,
    van_number VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100),
    assigned_to VARCHAR(50) REFERENCES users(username),
    active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- van_inventory: What's in each van
CREATE TABLE van_inventory (
    id SERIAL PRIMARY KEY,
    van_id INTEGER REFERENCES work_vans(id),
    inventory_id INTEGER REFERENCES inventory(id),
    quantity INTEGER DEFAULT 0,
    min_quantity INTEGER DEFAULT 0,  -- For low stock alerts
    last_updated TIMESTAMP DEFAULT NOW(),
    UNIQUE(van_id, inventory_id)
);
```

### API Endpoints (van_endpoints.py)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/vans` | GET | List all vans |
| `/vans` | POST | Create van |
| `/vans/{id}` | GET | Get van details |
| `/vans/{id}` | PATCH | Update van |
| `/vans/{id}` | DELETE | Soft delete (deactivate) van |
| `/vans/{id}/inventory` | GET | Get van's inventory |
| `/vans/{id}/inventory/low-stock` | GET | Low stock items in van |
| `/vans/{id}/transfer-from-warehouse` | POST | Warehouse → Van |
| `/vans/{id}/transfer-to-warehouse` | POST | Van → Warehouse |
| `/vans/{id}/got-it` | POST | **NEW** Field acquisition → Van |
| `/vans/{id}/bulk-transfer-from-warehouse` | POST | Bulk transfer to van |
| `/vans/transfer-between` | POST | Van → Van |
| `/vans/user/default-van` | GET/POST | User's default van |

### Frontend Components

| Component | Location | Purpose |
|-----------|----------|---------|
| VansList.js | /vans | Van management list |
| VanInventoryDialog.js | Dialog | View/manage van inventory |
| JobMaterialScanner.js | /job-scanner | Scan & move inventory for jobs |
| BarcodeScanner.js | Shared | Unified barcode scanning component |

### API Functions (api.js)

```javascript
// Van CRUD
fetchVans(activeOnly)
fetchVan(vanId)
createVan(vanData)
updateVan(vanId, vanData)
deleteVan(vanId)

// Van Inventory
fetchVanInventory(vanId, lowStockOnly)
transferToVan(vanId, inventoryId, quantity, notes)
transferFromVan(vanId, inventoryId, quantity, notes)
gotItToVan(vanId, inventoryId, quantity, costPerUnit, notes)  // NEW - Field acquisition
bulkTransferToVan(vanId, items, notes)
transferBetweenVans(fromVanId, toVanId, inventoryId, quantity, notes)

// User Default Van
getUserDefaultVan()
setUserDefaultVan(vanId)
```

### API Testing Examples (curl)

```bash
# Get auth token first
TOKEN=$(ssh root@165.22.32.192 "python3 -c \"
import jwt
from datetime import datetime, timedelta, timezone
secret = '9dGFvKmLgNECm8c7mrTrabev2gVf8otStLP0pxbTDykJCnFdAL9b8GxfyzaLoah'
token = jwt.encode({'sub': 'jgamache', 'exp': datetime.now(timezone.utc) + timedelta(hours=4)}, secret, algorithm='HS256')
print(token)
\"")

# List all vans with inventory summary
ssh root@165.22.32.192 "docker exec ma_electrical-backend curl -s 'http://localhost:8000/vans' -H 'Authorization: Bearer $TOKEN'"

# Get single van with inventory
ssh root@165.22.32.192 "docker exec ma_electrical-backend curl -s 'http://localhost:8000/vans/1/inventory' -H 'Authorization: Bearer $TOKEN'"

# Search van inventory
ssh root@165.22.32.192 "docker exec ma_electrical-backend curl -s 'http://localhost:8000/vans/1/inventory?search=breaker' -H 'Authorization: Bearer $TOKEN'"

# Transfer from warehouse to van
ssh root@165.22.32.192 "docker exec ma_electrical-backend curl -s -X POST 'http://localhost:8000/vans/1/transfer-from-warehouse' \
  -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{\"inventory_id\": 6, \"quantity\": 10, \"notes\": \"Restocking van\"}'"

# Transfer from van to warehouse (return)
ssh root@165.22.32.192 "docker exec ma_electrical-backend curl -s -X POST 'http://localhost:8000/vans/1/transfer-to-warehouse' \
  -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{\"inventory_id\": 6, \"quantity\": 5, \"notes\": \"Returning excess stock\"}'"

# Transfer between vans
ssh root@165.22.32.192 "docker exec ma_electrical-backend curl -s -X POST 'http://localhost:8000/vans/transfer-between' \
  -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{\"from_van_id\": 1, \"to_van_id\": 3, \"inventory_id\": 6, \"quantity\": 5, \"notes\": \"Sharing materials\"}'"

# Got It - Field acquisition
ssh root@165.22.32.192 "docker exec ma_electrical-backend curl -s -X POST 'http://localhost:8000/vans/5/got-it' \
  -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{\"inventory_id\": 18, \"quantity\": 3, \"cost_per_unit\": 125.50, \"notes\": \"Picked up from supply house\"}'"

# Bulk transfer to van
ssh root@165.22.32.192 "docker exec ma_electrical-backend curl -s -X POST 'http://localhost:8000/vans/4/bulk-transfer-from-warehouse' \
  -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{\"items\": [{\"inventory_id\": 1, \"quantity\": 3}, {\"inventory_id\": 11, \"quantity\": 5}], \"notes\": \"Bulk restock\"}'"
```

### Error Handling

Van endpoints return appropriate HTTP errors:

| Error | Status | Example Response |
|-------|--------|------------------|
| Van not found | 404 | `{"detail":"Van not found or inactive"}` |
| Insufficient stock | 400 | `{"detail":"Insufficient van stock. Available: 15, Requested: 999"}` |
| Invalid quantity | 400 | `{"detail":"Quantity must be positive"}` |
| Item not found | 404 | `{"detail":"Inventory item not found"}` |
| Item not in van | 404 | `{"detail":"Item not found in van inventory"}` |

### Inventory Flow Diagram

```
                    ┌──────────────┐
                    │  WAREHOUSE   │
                    │  (inventory  │
                    │   table)     │
                    └──────┬───────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │  VAN 1   │    │  VAN 2   │    │  VAN 3   │
    │(van_inv) │◄──►│(van_inv) │◄──►│(van_inv) │
    └────┬─────┘    └──────────┘    └──────────┘
         │
         ▼
    ┌──────────┐
    │   JOB    │
    │(job_mat) │
    └──────────┘
```

### Material Movement Patterns

1. **Warehouse → Van**: Stock van before going to job site
2. **Warehouse → Job**: Pull directly for job (drop off at site)
3. **Van → Job**: Use material from van on a job
4. **Van → Warehouse**: Return unused materials
5. **Van → Van**: Transfer between vans
6. **Got It → Van**: Field acquisition (bought at store) directly to van
7. **Got It → Job**: Field acquisition directly to job

### JobView Pull Enhancement (IMPLEMENTED - January 9, 2026)

The JobView "Pull" button now supports flexible From/To selection:

**Implementation:**
When user clicks "Pull" on a material in JobView.js:

1. **Van selector**: Pre-selects user's default van (can change)
2. **From dropdown**: Warehouse or My Van
3. **To dropdown**: This Job or My Van (only when From=Warehouse)
4. **Dynamic availability**: Shows quantity available from selected source

**Action mapping:**
| Source | Destination | API Call |
|--------|-------------|----------|
| Warehouse | Job | `allocateMaterials()` |
| Warehouse | Van | `transferToVan()` |
| Van | Job | `transferFromVan()` + `allocateMaterials()` |

**Key state variables (JobView.js):**
```javascript
const [vans, setVans] = useState([]);
const [selectedVanId, setSelectedVanId] = useState('');
const [vanInventory, setVanInventory] = useState([]);
const [pullSource, setPullSource] = useState('warehouse');
const [pullDestination, setPullDestination] = useState('job');
```

### "Got It" Feature (Field Acquisition)

**Purpose:** Add items acquired in the field (bought at store, found, etc.) directly to inventory without deducting from warehouse stock.

**Locations implemented:**
1. **JobView.js** - "Got It" button on job materials (marks field acquisition for job)
2. **VanInventoryDialog.js** - "Got It" button adds items directly to van

**Backend endpoint:** `POST /vans/{id}/got-it`
```json
{
  "inventory_id": 123,
  "quantity": 5,
  "cost_per_unit": 10.50,  // Optional - uses item's default if omitted
  "notes": "Bought at Home Depot"
}
```

**How it works:**
- Increases warehouse `qty` (tracks total system inventory)
- Adds to van inventory via upsert
- Records `got_it` transaction type in `stock_transactions`
- Does NOT decrease warehouse stock (item came from outside)

### Job Material Scanner (JobMaterialScanner.js)

Separate scanning interface for field use, accessible at `/job-scanner`:

**Modes:**
- **Use Material**: Pull from van, mark as used on job
- **Load to Van**: Transfer warehouse → van
- **Return**: Transfer van → warehouse

**Features:**
- Unified BarcodeScanner component with auto-start
- Quick quantity fix button ("Fix Qty") for inventory corrections
- Session tracking of materials used
- Optional work order association via URL param (`?workorder=123`)
- Van selector (defaults to user's assigned van)

**Quick Quantity Fix:**
When an item is scanned and the displayed quantity is wrong, users can tap "Fix" to correct:
- For van inventory: Transfers the delta to/from warehouse
- For warehouse inventory: Uses `adjustStock()` API

### JobView Status Controls (SIMPLIFIED - January 9, 2026)

The JobView status change section has been simplified to only show:

| Button | Condition | Action |
|--------|-----------|--------|
| **Mark Complete** | Status not completed/invoiced/paid | Sets status to `completed` |
| **Delay Job** | Status not completed/invoiced/paid AND not already delayed | Opens DelayJobDialog |
| **Delayed Chip** | Job has `delay_start_date` | Shows delay end date or "indefinitely" |
| **Generate Invoice** | Status is `completed` | Creates invoice for the job |

**Removed:** Admin-only buttons for pending, scheduled, in_progress, cancelled. These status changes should be managed from WorkOrdersList or WorkOrderDetail by admins/managers.

**Components used:**
- `DelayJobDialog.js` - Handles date range or indefinite delay
- `delayWorkOrder()` API function

### JobView Collapsible Sections (Added January 16, 2026)

For better mobile navigation, JobView uses MUI Accordion components for all sections:

| Section | Default State | Contents |
|---------|---------------|----------|
| **Job Details** | Expanded | Customer info, address, job type, navigation |
| **Job Status** | Expanded | Status badge, Mark Complete, Delay Job, Generate Invoice |
| **Tasks** | Collapsed | Task checklist with completion tracking |
| **Materials** | Collapsed | Material list with badges (Special Order, Customer Provided) |
| **Permits** | Collapsed | Permit info and inspection status (only shown if permit_required) |
| **Notes** | Collapsed | Job notes with add note form |
| **Photos & Videos** | Collapsed | Photo/video gallery with upload capability |
| **Activity History** | Collapsed | Timeline of all job activity |

**Implementation:**
- State: `expandedSections` object tracks which sections are open
- Handler: `handleSectionToggle(section)` returns accordion onChange handler
- Each accordion has color-coded header with icon and count badge
- Materials section shows badges: "Special Order" (secondary), "Customer Provided" (info)

### Video Upload Support (Added January 16, 2026)

The photo upload system now supports video files:

**Supported formats:** `.mp4`, `.webm`, `.mov`, `.avi`
**MIME types:** `video/mp4`, `video/webm`, `video/quicktime`, `video/x-msvideo`

**Frontend changes:**
- `handlePhotoSelect()` validates both image and video extensions/MIME types
- Upload dialog shows video thumbnail preview with play icon overlay
- JobView gallery detects videos by extension and renders `<video>` tag with controls

### Multi-Location Inventory System

**Status:** PLANNED - Approved design as of January 9, 2026

The inventory system will show ALL locations where products exist (warehouse, vans, jobs), with clear distinction between "available" and "visible" stock.

#### Core Concepts

| Concept | Definition |
|---------|------------|
| **Available Stock** | Warehouse quantity only - what can be promised for new jobs |
| **Visible Stock** | All locations (warehouse + vans + jobs) - for visibility, not availability |
| **Location Types** | Warehouse (source of truth), Van (mobile stock), Job (allocated/pending use) |

**Key Rules:**
1. Only warehouse qty is "available" for work orders
2. Van inventory is VISIBLE to everyone but NOT counted as available
3. Items can exist on a van AND be designated for a work order simultaneously
4. Quantities consolidate when items move to same location
5. Free movement: Warehouse↔Van, Van↔Van, Warehouse↔Job, Van↔Job

#### UI Design: Grouped Expandable Rows

```
┌─────────────────────────────────────────────────────────────────┐
│ ▶ ROMEX-12-2 | 12/2 NM-B Romex | Total: 2,500 ft | $0.85/ft   │
├─────────────────────────────────────────────────────────────────┤
│   📦 Warehouse          | 2,000 ft  | [Transfer]               │
│   🚐 Van 101 (Joey)     |   200 ft  | [Transfer] [Use on Job]  │
│   🚐 Van 102 (Chris)    |   150 ft  | [Transfer]               │
│   🏗️ Job #1234 (Smith)  |   150 ft  | [Return]                 │
└─────────────────────────────────────────────────────────────────┘
```

**Row Behaviors:**
- Main row shows aggregate totals
- Click to expand/collapse location breakdown
- Each sub-row has contextual actions
- Search works both ways: by item shows all locations, by location shows items there

#### Implementation Phases

**Phase 1: Backend Location Data**
```
New Endpoint: GET /inventory/{id}/locations
Returns:
{
  "item_id": 123,
  "description": "12/2 NM-B Romex",
  "warehouse_qty": 2000,
  "total_qty": 2500,
  "available_qty": 2000,  // Only warehouse counts as available
  "locations": [
    {"type": "warehouse", "name": "Main Warehouse", "qty": 2000, "value": 1700.00},
    {"type": "van", "id": 1, "name": "Van 101", "assigned_to": "Joey", "qty": 200},
    {"type": "van", "id": 2, "name": "Van 102", "assigned_to": "Chris", "qty": 150},
    {"type": "job", "id": 1234, "name": "Smith Residence", "qty": 150, "status": "allocated"}
  ]
}

Modified Endpoint: GET /inventory?include_locations=true
Adds location_summary to each item in list response
```

**Phase 2: Inventory List Expandable Rows**
- Modify InventoryList.js to use collapsible rows
- Main row: Item info + aggregate totals
- Expanded: Location breakdown with transfer actions
- Filter options: Show all locations / Warehouse only / Specific van

**Phase 3: Work Order Multi-Source Pull**
When pulling materials for a work order:
```
┌─────────────────────────────────────────────────────────────────┐
│ Pull Material: ROMEX-12-2                                       │
│ Need: 10 units                                                  │
├─────────────────────────────────────────────────────────────────┤
│ ☐ Warehouse        | Available: 2,000 | Pull: [___] |          │
│ ☐ Van 101 (Joey)   | Has: 200        | Pull: [___] |          │
│ ☐ Van 102 (Chris)  | Has: 150        | Pull: [___] |          │
│ ☐ Got It (field)   |                 | Add:  [___] | $[___]   │
├─────────────────────────────────────────────────────────────────┤
│ Total to fulfill: [10] of 10                     [Confirm Pull] │
└─────────────────────────────────────────────────────────────────┘
```

**Phase 4: Polish & Edge Cases**
- Consolidation when items merge to same location
- Scanner integration updates
- Offline support considerations
- Performance optimization for large inventories

#### Database Queries for Multi-Location

```sql
-- Get all locations for an item
SELECT
    'warehouse' as location_type,
    NULL as location_id,
    'Main Warehouse' as location_name,
    i.qty as quantity,
    NULL as assigned_to
FROM inventory i
WHERE i.id = :item_id

UNION ALL

SELECT
    'van' as location_type,
    vi.van_id as location_id,
    wv.name as location_name,
    vi.quantity,
    wv.assigned_to
FROM van_inventory vi
JOIN work_vans wv ON vi.van_id = wv.id
WHERE vi.inventory_id = :item_id AND vi.quantity > 0

UNION ALL

SELECT
    'job' as location_type,
    jm.work_order_id as location_id,
    wo.work_order_number || ' - ' || COALESCE(c.company_name, c.last_name) as location_name,
    jm.quantity_used as quantity,
    NULL as assigned_to
FROM job_materials_used jm
JOIN work_orders wo ON jm.work_order_id = wo.id
LEFT JOIN customers c ON wo.customer_id = c.id
WHERE jm.item_id = :item_id AND jm.quantity_used > 0;
```

#### API Function Updates (api.js)

```javascript
// Get locations for a specific item
export async function fetchItemLocations(itemId) {
  const response = await fetch(`${API_BASE_URL}/inventory/${itemId}/locations`, {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
  });
  if (!response.ok) throw new Error('Failed to fetch item locations');
  return response.json();
}

// Fetch inventory with location summaries
export async function fetchInventoryWithLocations(params = {}) {
  const searchParams = new URLSearchParams({ ...params, include_locations: 'true' });
  const response = await fetch(`${API_BASE_URL}/inventory?${searchParams}`, {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
  });
  if (!response.ok) throw new Error('Failed to fetch inventory');
  return response.json();
}

// Multi-source pull for work order (Phase 3)
export async function pullMaterialMultiSource(workOrderId, itemId, sources) {
  // sources: [{ type: 'warehouse'|'van'|'got_it', id?: number, qty: number, cost?: number }]
  const response = await fetch(`${API_BASE_URL}/work-orders/${workOrderId}/materials/multi-pull`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ item_id: itemId, sources })
  });
  if (!response.ok) throw new Error('Failed to pull materials');
  return response.json();
}
```

#### Work Order Material Display

On work order detail, materials show:
- **Needed:** Total quantity needed
- **Pulled:** Quantity already pulled (from any source)
- **Available:** Warehouse qty only (NOT van qty)
- **Pull Sources:** Button to open multi-source pull dialog

```
Material: ROMEX-12-2 | Need: 100 | Pulled: 25 | Available: 2,000 | [Pull More ▼]
```

#### Affected Components Summary

| Component | Changes |
|-----------|---------|
| InventoryList.js | Expandable rows, location breakdown, transfer actions |
| InventoryScanner.js | Show all locations on scan result |
| JobView.js | Already has From/To selection, add multi-source |
| WorkOrderDetail.js | Show available (warehouse only), pull from multiple sources |
| VanInventoryDialog.js | No changes needed - already handles transfers |
| JobMaterialScanner.js | No changes needed |
| inventory_endpoints.py | Add `/{id}/locations` endpoint, `include_locations` param |
| workorder_endpoints.py | Add multi-source pull endpoint |

---

## Appendix: Vendor Return Rack System (Planned - January 9, 2026)

### Overview

A designated shelf location for items that need to be returned to vendors. Items are placed here when defective, wrong item ordered, overstock, damaged, or expired. The system tracks which vendor each item goes back to and generates return lists.

### Database Schema

```sql
CREATE TABLE vendor_returns (
    id SERIAL PRIMARY KEY,
    inventory_id INTEGER REFERENCES inventory(id),
    vendor_id INTEGER REFERENCES vendors(id),  -- Which vendor to return to
    quantity INTEGER NOT NULL,
    return_reason VARCHAR(50) NOT NULL,  -- defective, overstock, wrong_item, damaged, expired
    return_reason_notes TEXT,
    source_location VARCHAR(50),  -- Where it came from: warehouse, van_1, etc.
    placed_on_rack_date TIMESTAMP DEFAULT NOW(),
    placed_by VARCHAR(50) REFERENCES users(username),
    status VARCHAR(20) DEFAULT 'pending',  -- pending, approved, returned, credited
    return_authorization VARCHAR(100),  -- RMA number from vendor
    credit_amount NUMERIC(10,2),
    credited_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_vendor_returns_status ON vendor_returns(status);
CREATE INDEX idx_vendor_returns_vendor ON vendor_returns(vendor_id);
CREATE INDEX idx_vendor_returns_inventory ON vendor_returns(inventory_id);
```

### Return Reasons

| Reason | Description |
|--------|-------------|
| `defective` | Item doesn't work or is broken |
| `overstock` | Ordered too many, returning excess |
| `wrong_item` | Vendor shipped wrong item |
| `damaged` | Shipping damage or warehouse damage |
| `expired` | Item past shelf life (for perishables) |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/inventory/returns` | GET | List items on return rack |
| `/inventory/returns` | POST | Add item to return rack |
| `/inventory/returns/{id}` | GET | Get return details |
| `/inventory/returns/{id}` | PATCH | Update return (status, RMA#, etc.) |
| `/inventory/returns/{id}` | DELETE | Remove from rack (cancel return) |
| `/inventory/returns/by-vendor` | GET | Group returns by vendor |
| `/inventory/returns/{id}/complete` | POST | Mark as returned, apply credit |
| `/reports/vendor-return-list` | GET | Printable return list for vendor |

### Frontend Components

| Component | Purpose |
|-----------|---------|
| `ReturnRackPage.js` | Main page showing return rack items |
| `MarkForReturnDialog.js` | Dialog to add item to return rack |
| `VendorReturnListDialog.js` | Printable return list for vendor |

### Workflow

1. **Identify Return Item**: Staff finds defective/wrong item in warehouse or van
2. **Mark for Return**: Use "Mark for Return" action, select reason and vendor
3. **Physical Placement**: Place item on designated return shelf
4. **Request RMA**: Contact vendor, get return authorization number
5. **Update System**: Add RMA number to the return record
6. **Ship Return**: Send items back to vendor
7. **Complete Return**: Mark as returned, record credit amount
8. **Credit Applied**: Update when credit appears on account

### Integration Points

- `InventoryList.js` - Add "Mark for Return" action
- `VanInventoryDialog.js` - Add "Mark for Return" action
- `InventoryScanner.js` - Quick access to mark scanned item for return

---

## Appendix: Outgoing Crew Rack System (Planned - January 9, 2026)

### Overview

A staging area where warehouse staff can pre-build material kits for upcoming jobs. Crews can pick up their staged orders before heading to job sites.

### Core Logic: Jobs Needing Stock

A job appears in the "needs stock" list when:
- Scheduled in upcoming period (configurable, default 14 days)
- Has materials where `quantity_needed > quantity_allocated`
- Status is not completed/cancelled/invoiced/paid
- **Important**: Once all materials are fulfilled (needed = allocated), job disappears from list

```sql
-- Query for jobs still needing materials
SELECT DISTINCT wo.id, wo.work_order_number,
       MIN(jsd.scheduled_date) as next_scheduled_date,
       COUNT(DISTINCT jmu.id) as unfulfilled_items,
       SUM(jmu.quantity_needed - COALESCE(jmu.quantity_allocated, 0)) as total_qty_needed
FROM work_orders wo
JOIN job_schedule_dates jsd ON jsd.work_order_id = wo.id
JOIN job_materials_used jmu ON jmu.work_order_id = wo.id
WHERE jsd.scheduled_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '14 days'
  AND wo.status NOT IN ('completed', 'cancelled', 'invoiced', 'paid')
  AND jmu.quantity_needed > COALESCE(jmu.quantity_allocated, 0)
GROUP BY wo.id, wo.work_order_number
ORDER BY next_scheduled_date;
```

### Database Schema

```sql
-- Staged material kits for crew pickup
CREATE TABLE outgoing_crew_orders (
    id SERIAL PRIMARY KEY,
    work_order_id INTEGER REFERENCES work_orders(id),
    van_id INTEGER REFERENCES work_vans(id),
    scheduled_date DATE,  -- Which day this order is for
    prepared_by VARCHAR(50) REFERENCES users(username),
    prepared_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'staged',  -- staged, picked_up, partial, cancelled
    picked_up_by VARCHAR(50) REFERENCES users(username),
    picked_up_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Items in each staged order
CREATE TABLE outgoing_crew_order_items (
    id SERIAL PRIMARY KEY,
    outgoing_order_id INTEGER REFERENCES outgoing_crew_orders(id) ON DELETE CASCADE,
    inventory_id INTEGER REFERENCES inventory(id),
    job_material_id INTEGER REFERENCES job_materials_used(id),
    quantity_staged INTEGER NOT NULL,
    bin_location VARCHAR(50),
    picked BOOLEAN DEFAULT FALSE,
    notes TEXT
);

CREATE INDEX idx_outgoing_orders_status ON outgoing_crew_orders(status);
CREATE INDEX idx_outgoing_orders_van ON outgoing_crew_orders(van_id);
CREATE INDEX idx_outgoing_orders_wo ON outgoing_crew_orders(work_order_id);
CREATE INDEX idx_outgoing_orders_date ON outgoing_crew_orders(scheduled_date);
```

### Order Statuses

| Status | Description |
|--------|-------------|
| `staged` | Order built and waiting on rack |
| `partial` | Some items picked up, others remain |
| `picked_up` | All items picked up by crew |
| `cancelled` | Order cancelled, items returned to warehouse |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/outgoing/jobs-needing-stock` | GET | List jobs with unfulfilled materials |
| `/outgoing/orders` | GET | List staged orders |
| `/outgoing/orders` | POST | Create new staged order |
| `/outgoing/orders/{id}` | GET | Get order details |
| `/outgoing/orders/{id}` | PATCH | Update order |
| `/outgoing/orders/{id}` | DELETE | Cancel order |
| `/outgoing/orders/{id}/pickup` | POST | Mark picked up, transfer to van |
| `/outgoing/orders/for-van/{van_id}` | GET | Orders waiting for specific van |
| `/outgoing/stage-for-job/{work_order_id}` | POST | Quick stage materials for job |

### Frontend Components

| Component | Purpose |
|-----------|---------|
| `OutgoingRackPage.js` | Main page with two tabs |
| - Needs Stock tab | Jobs needing materials in upcoming days |
| - Staged Orders tab | Orders waiting for pickup |
| `StageJobMaterialsDialog.js` | Build kit for a job |
| `PickupConfirmDialog.js` | Confirm pickup, select items |

### Workflow

1. **View Upcoming Jobs**: Warehouse staff sees jobs scheduled in next 7-14 days
2. **Filter by Need**: Only jobs with unfulfilled materials appear
3. **Stage Materials**: Pull items from warehouse, create outgoing order
4. **Physical Staging**: Place labeled kit on outgoing rack
5. **Notify Crew**: System shows crew their order is ready
6. **Crew Pickup**: Crew confirms pickup, items transfer to their van
7. **Job Removed**: Once fully staged, job disappears from "needs stock"

### Material Fulfillment Tracking

Key fields in `job_materials_used`:
- `quantity_needed` - Total needed for job
- `quantity_allocated` - Reserved from warehouse inventory
- `quantity_loaded` - Physically loaded onto van
- `quantity_used` - Consumed on the job
- `quantity_returned` - Returned unused
- `source_type` - 'inventory' (default) or 'external_purchase'
- `loaded_by` / `loaded_at` - Who loaded and when
- `returned_by` / `returned_at` - Who returned and when
- **Remaining** = `quantity_needed - quantity_allocated`

When staging:
1. Deduct from warehouse `inventory.qty`
2. Increase `job_materials_used.quantity_allocated`
3. Record in `outgoing_crew_order_items`

When picked up:
1. Transfer from "staged" to van inventory
2. Update `outgoing_crew_orders.status` to 'picked_up'

### UI Mockups

**Jobs Needing Stock Tab:**
```
┌─────────────────────────────────────────────────────────────────┐
│ 📦 Outgoing Rack                              [Date Range ▼]    │
├─────────────────────────────────────────────────────────────────┤
│ JOBS NEEDING STOCK │ STAGED ORDERS (3)                          │
├─────────────────────────────────────────────────────────────────┤
│ 📅 Monday, Jan 13                                               │
│ ├─ WO-2024-0042 │ Smith Residence     │ 3 items short │ [Stage] │
│ └─ WO-2024-0045 │ Jones Commercial    │ 1 item short  │ [Stage] │
│                                                                 │
│ 📅 Tuesday, Jan 14                                              │
│ └─ WO-2024-0048 │ Miller Kitchen      │ 5 items short │ [Stage] │
│                                                                 │
│ 📅 Wednesday, Jan 15                                            │
│ └─ (All jobs fully stocked ✓)                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Staged Orders Tab:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Staged Orders Waiting for Pickup                                │
├─────────────────────────────────────────────────────────────────┤
│ 🚐 Van 101 (John Forget)                                        │
│ ├─ WO-2024-0042 │ 5 items │ Staged 2hrs ago │ [View] [Pickup]   │
│ └─ WO-2024-0045 │ 3 items │ Staged 1hr ago  │ [View] [Pickup]   │
│                                                                 │
│ 🚐 Van 102 (Brad Galvin)                                        │
│ └─ WO-2024-0048 │ 8 items │ Staged 30min ago│ [View] [Pickup]   │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Phases

**Phase 1: Vendor Return Rack**
1. Database migration for `vendor_returns` table
2. Backend endpoints in `inventory_endpoints.py`
3. Frontend: ReturnRackPage + MarkForReturnDialog
4. Vendor return list report
5. Integration with InventoryList actions

**Phase 2: Outgoing Crew Rack**
1. Database migration for outgoing orders tables
2. Backend endpoints (new file `outgoing_endpoints.py`)
3. Frontend: OutgoingRackPage with both tabs
4. Frontend: StageJobMaterialsDialog
5. Integration with Schedule (badge showing jobs needing stock)

---

## Appendix: Comprehensive Software Audit (January 13, 2026)

### Audit Overview

A full professional audit of the entire software system was conducted covering:
- Backend security and code quality
- Frontend components and React patterns
- API layer completeness and consistency
- Database schema integrity
- Route guards and permissions

### Audit Summary

| Area | Status | Critical Issues | Action Required |
|------|--------|-----------------|-----------------|
| Backend Security | GOOD with findings | 30+ error leakage instances | HIGH - Fix error messages |
| Frontend Components | EXCELLENT | 18 deprecated dialog patterns | MEDIUM - Replace native dialogs |
| API Layer | GOOD with gaps | Missing Quote/PO functions | HIGH - Add to api.js |
| Database Schema | GOOD with gaps | 3 missing delay columns | HIGH - Add migration |
| Route Guards | GOOD | Minor optimization needed | LOW |

---

### 1. Backend Security Audit

#### 1.1 Error Message Leakage (HIGH PRIORITY)

**Issue:** 30+ locations expose internal exception details to users via `str(e)`

| File | Lines | Fix Required |
|------|-------|--------------|
| `van_endpoints.py` | 171, 222, 267, 351, 393, 479, 585, 684, 798, 905, 939, 1050, 1087 | Use UUID logging pattern |
| `add_purchase_order_endpoints.py` | 216, 326, 394, 526, 564, 609, 652 | Use UUID logging pattern |
| `settings_endpoints.py` | 420, 497, 558, 638, 701, 768, 825, 896 | Use UUID logging pattern |
| `communication_service.py` | 185, 187, 189, 191, 266, 268, 270, 400, 514, 554, 556, 598, 600 | Return generic messages |
| `workorder_endpoints.py` | 464, 2418 | Use UUID logging pattern |

**Fix Pattern:**
```python
try:
    # operations
except HTTPException:
    raise
except Exception as e:
    error_id = str(uuid.uuid4())[:8]
    logger.error(f"Error {error_id}: {type(e).__name__}: {str(e)}")
    raise HTTPException(status_code=500, detail=f"Operation failed. Reference: {error_id}")
```

#### 1.2 Security Strengths (VERIFIED GOOD)

| Feature | Status |
|---------|--------|
| SQL Injection | SECURE - All parameterized queries |
| Authentication | SECURE - All endpoints protected |
| Password Hashing | SECURE - bcrypt 12 rounds |
| Account Lockout | SECURE - 5 attempts, 15 min lockout |
| Rate Limiting | SECURE - Implemented on login |
| File Uploads | SECURE - Extension/MIME validation |
| CORS | SECURE - Properly configured |
| JWT Tokens | SECURE - 60 min expiration |

#### 1.3 reset_pw.py Security Concern (MEDIUM)

The password reset script has hardcoded username and should be:
- Moved to `.gitignore`
- Require username via prompt
- Or replaced with admin UI workflow

---

### 2. Frontend Components Audit

#### 2.1 Component Statistics

| Metric | Count |
|--------|-------|
| Total Components Audited | 75+ |
| XSS Vulnerabilities | 0 |
| Hardcoded Credentials | 0 |
| Console.logs (Production) | 0 (1 dev-only) |
| Unused Imports | 0 |
| Memory Leaks | 0 |

#### 2.2 Deprecated Native Dialog Usage (MEDIUM PRIORITY)

**Issue:** 18 instances of `window.confirm()` and `alert()` should use Material-UI components

| File | Instances | Pattern |
|------|-----------|---------|
| `Timesheet.js` | 8 | `alert()` calls |
| `JobTasks.js` | 3 | `window.confirm()` |
| `QuotesList.js` | 4 | Both patterns |
| `SettingsPage.js` | 2 | `window.confirm()` |
| `QuoteDetail.js` | 2 | Both patterns |
| `PurchaseOrders.js` | 1 | `window.confirm()` |
| `WorkOrderDetail.js` | 1 | `window.confirm()` |
| `QuoteForm.js` | 1 | `alert()` |

**Fix:** Replace with `ConfirmDialog.js` (already exists) and `Snackbar`/`Alert` components.

#### 2.3 Minor Error Handling Gaps

| File | Issue | Severity |
|------|-------|----------|
| `InventoryScanner.js:256` | Fallback success shown even if API fails | MEDIUM |
| `MobileDashboard.js:112` | Dashboard errors caught but no user feedback | LOW |
| `QuoteForm.js:327` | Item addition error only logged | LOW |

---

### 3. API Layer Audit

#### 3.1 Missing API Functions (HIGH PRIORITY)

**Quote API Functions - NOT IN api.js:**
Components call these directly with `fetch()`:
- `fetchQuotes()`, `createQuote()`, `fetchQuote()`, `updateQuote()`, `deleteQuote()`
- `sendQuote()`, `approveQuote()`, `declineQuote()`, `convertQuoteToWorkOrder()`
- `cloneQuote()`, `saveQuoteAsTemplate()`, `fetchQuoteTemplates()`
- `createQuoteFromTemplate()`, `updateQuoteTemplate()`, `deleteQuoteTemplate()`

**Purchase Order API Functions - NOT IN api.js:**
- `fetchPurchaseOrders()`, `createPurchaseOrder()`, `fetchPurchaseOrder()`
- `updatePurchaseOrder()`, `deletePurchaseOrder()`, `receivePurchaseOrder()`
- `createPurchaseOrderFromShortages()`, `addPurchaseOrderItem()`, `removePurchaseOrderItem()`

**Impact:** Components bypass `api.js`, violating DRY and making maintenance difficult.

#### 3.2 Error Handling Inconsistency

| Pattern | Usage | Issue |
|---------|-------|-------|
| Text error parsing | 80% | May fail on JSON responses |
| JSON error parsing | 10% | Better approach |
| 404 special handling | 5% | Returns null (correct) |
| Form submission | 5% | Login uses URLSearchParams |

**Recommendations:**
- Standardize on JSON-first error parsing
- Add request timeout utility
- Implement token refresh for `SessionExpiredError`

#### 3.3 Route Guards

All routes properly guarded. Minor optimization: Guards call `getCurrentUser()` on every render - consider caching.

---

### 4. Database Schema Audit

#### 4.1 Missing Columns (CRITICAL)

**work_orders table missing delay tracking columns:**
```sql
-- Add to production database:
ALTER TABLE work_orders ADD COLUMN delay_start_date DATE;
ALTER TABLE work_orders ADD COLUMN delay_end_date DATE;
ALTER TABLE work_orders ADD COLUMN delay_reason TEXT;
```

Backend code (`workorder_endpoints.py`) references these columns extensively for the delay job feature.

#### 4.2 Table Name Mismatch

| Backend Uses | Schema Has | Status |
|--------------|------------|--------|
| `work_order_photos` | `job_photos` (+ compat view) | OK - View exists |
| `work_order_tasks` | `job_tasks` | MISMATCH - Needs fix |
| `work_order_notes` | `job_notes` | MISMATCH - Needs fix |

#### 4.3 Missing Indexes on Foreign Keys

```sql
-- Add for performance:
CREATE INDEX idx_stock_transactions_job_material ON stock_transactions(job_material_id);
CREATE INDEX idx_stock_transactions_purchase_order ON stock_transactions(purchase_order_id);
CREATE INDEX idx_job_materials_purchase_order ON job_materials_used(purchase_order_id);
CREATE INDEX idx_material_requests_approved_by ON material_requests(approved_by);
CREATE INDEX idx_material_requests_fulfilled_by ON material_requests(fulfilled_by);
```

#### 4.4 Missing NOT NULL Constraints

- `login_attempts.username` should be `NOT NULL`
- Should also have FK to `users(username)`

---

### 5. Priority Action Items

#### HIGH PRIORITY (Fix This Week)

1. **Fix Error Message Leakage** - Update 5 backend files with UUID logging pattern
2. **Add Missing API Functions** - Create Quote and PO wrapper functions in `api.js`
3. **Add Delay Columns Migration** - Create `migration_add_delay_tracking.sql`

#### MEDIUM PRIORITY (Fix This Month)

4. **Replace Native Dialogs** - Replace 18 `window.confirm()`/`alert()` with Material-UI
5. **Standardize Table Names** - Either add views for `work_order_tasks`/`work_order_notes` or update backend
6. **Add Missing Indexes** - Create performance optimization migration

#### LOW PRIORITY (Backlog)

7. **Cache User in Route Guards** - Reduce unnecessary API calls
8. **Add Request Timeout** - Add timeout utility to api.js
9. **Add Token Refresh** - Implement automatic token refresh
10. **Secure reset_pw.py** - Move to gitignore or replace with UI

---

### 6. Files Modified in This Audit

No code changes made during audit - this is documentation only.

---

### 7. Overall Assessment

**Production Readiness:** READY with HIGH PRIORITY fixes recommended

| Category | Grade |
|----------|-------|
| Security | B+ (Error leakage is main issue) |
| Code Quality | A- (Minor patterns to update) |
| Architecture | A (Well-structured modular design) |
| Documentation | A (Comprehensive guide exists) |
| Performance | B (Missing some indexes) |

The application is fundamentally sound with good security practices. The main issues are:
1. Error message leakage exposing internal details
2. Missing API wrapper functions causing code duplication
3. Schema/code misalignments for delay feature and table names

---

**End of Developer Guide**

*Last Updated: January 13, 2026*
*Inventory Movement Report Added: January 13, 2026*
*Stock Transaction Tracking for Job Materials Added: January 13, 2026*
*Comprehensive Software Audit Added: January 13, 2026*
*Van Inventory System Documented: January 9, 2026*
*JobView Pull Enhancement Implemented: January 9, 2026*
*Got It Feature Added: January 9, 2026*
*Multi-Location Inventory Plan Added: January 9, 2026*
*JobView Status Controls Simplified: January 9, 2026*
*Van Fleet Expanded to 8 Vans with Full Testing: January 9, 2026*
*Material Reconciliation Logic Fixed: January 9, 2026*
*Vendor Return Rack Plan Added: January 9, 2026*
*Outgoing Crew Rack Plan Added: January 9, 2026*
*Return Rack Feature Implemented: January 12, 2026*
*Address as Primary WO Identifier: January 12, 2026*
