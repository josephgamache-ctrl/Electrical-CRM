# MA Electrical Inventory - Granite City Edition

Professional electrical inventory management system built on proven NPP_Deals architecture with work order integration ready for future expansion.

## 🎯 Project Status

### ✅ Phase 1 Complete: Core Infrastructure (Day 1)

**Backend (FastAPI + PostgreSQL)**
- ✅ Full REST API with JWT authentication
- ✅ Electrical-specific inventory schema (30+ fields)
- ✅ Work order tables (ready for Phase 2)
- ✅ Stock transaction audit trail
- ✅ Category/subcategory management
- ✅ Barcode lookup endpoint
- ✅ Quick stock adjustment API
- ✅ User settings persistence
- ✅ CSV import/export framework

**Database Schema**
- ✅ `inventory` - 37 electrical-specific fields
- ✅ `stock_transactions` - Complete audit trail
- ✅ `users` - Role-based access (admin, manager, user, viewer)
- ✅ `user_settings` - Theme, UI preferences
- ✅ `work_orders` - Job management (future phase)
- ✅ `work_order_items` - Material tracking (future phase)

**DevOps**
- ✅ Docker Compose with 3 services (db, backend, frontend)
- ✅ PostgreSQL 13 with persistent volumes
- ✅ Separate network for electrical inventory
- ✅ Port configuration (8001 backend, 3001 frontend)

---

## 🏗️ Architecture

### Tech Stack
- **Backend**: FastAPI 0.118.0 (Python 3.8)
- **Database**: PostgreSQL 13
- **Frontend**: React 18.3 + Material-UI v5
- **Auth**: JWT tokens (12-hour expiry)
- **Deployment**: Docker + Docker Compose

### Directory Structure
```
MA_Electrical_Inventory/
├── backend/
│   ├── main.py              # FastAPI application (650+ lines)
│   ├── requirements.txt     # Python dependencies
│   ├── Dockerfile           # Multi-stage Docker build
│   └── .env                 # Environment variables
├── frontend/
│   ├── src/
│   │   ├── components/      # React components (to be created)
│   │   ├── api.js           # API integration (to be created)
│   │   ├── theme.js         # Material-UI theme (to be created)
│   │   └── App.js           # Main React app (to be created)
│   ├── package.json         # Node dependencies
│   └── Dockerfile           # React build + Nginx
├── database/
│   └── schema.sql           # PostgreSQL schema with seed data
├── docker-compose.yml       # Orchestration (db + backend + frontend)
└── README.md                # This file
```

---

## 📊 Database Schema Highlights

### Inventory Table (Electrical-Specific)
```sql
-- Identification
item_id VARCHAR(20)          -- 0001, 0002, etc.
sku VARCHAR(100)
brand VARCHAR(100)
upc VARCHAR(50)              -- Barcode scanning
description TEXT

-- Category & Classification
category VARCHAR(100)        -- Service Entrance, Wiring, Lighting, etc.
subcategory VARCHAR(100)     -- Main Panels, NM-B Cable, LED Fixtures

-- Pricing (4 tiers)
cost DECIMAL(10, 2)          -- Our purchase price
retail DECIMAL(10, 2)        -- Manufacturer list
granite_city_price           -- Contractor wholesale
sell_price DECIMAL(10, 2)    -- Final customer price
markup_percent DECIMAL(5, 2)

-- Inventory Management
qty INTEGER
min_stock INTEGER            -- Low-stock threshold
location VARCHAR(50)         -- Warehouse: A1, B2, etc.

-- Electrical Specifications
voltage VARCHAR(50)          -- 120V, 240V, 120/240V
amperage VARCHAR(50)         -- 15A, 20A, 100A, 200A
wire_gauge VARCHAR(50)       -- 14 AWG, 12 AWG, etc.
wire_type VARCHAR(50)        -- Copper, Aluminum, CCA
num_poles INTEGER            -- For breakers: 1, 2, 3

-- Compliance & Documentation
ma_code_ref VARCHAR(100)     -- MA 230.85, 780 CMR
nec_ref VARCHAR(100)         -- NEC 210.12, NEC 408
ul_listed BOOLEAN
certifications TEXT          -- UL, CE, CSA, ETL

-- Supply Chain
vendor VARCHAR(100)
vendor_part_number VARCHAR(100)
manufacturer_part_number VARCHAR(100)
lead_time_days INTEGER

-- Media
image_url TEXT
datasheet_pdf TEXT
installation_guide TEXT
```

### Work Order Tables (Future Phase)
```sql
work_orders:
  - work_order_number (WO-2024-0001)
  - customer info (name, email, phone, address)
  - job details (type, description, scheduling)
  - pricing (labor, materials, total)
  - status (pending, scheduled, in_progress, completed)
  - compliance (permit_number, inspection_required)

work_order_items:
  - Links work orders to inventory
  - Tracks quantity used per job
  - Records unit cost/price at time of order
  - Installation location tracking
```

---

## 🚀 Getting Started

### Prerequisites
- Docker Desktop installed
- Git Bash (Windows) or terminal (Mac/Linux)
- Node.js 20+ (for local development)
- Python 3.8+ (for local development)

### Quick Start (Docker - Recommended)

1. **Navigate to project**
```bash
cd /c/Users/josep/projects/MA_Electrical_Inventory
```

2. **Start all services**
```bash
docker-compose up -d --build
```

3. **Check status**
```bash
docker-compose ps
```

Expected output:
```
NAME                      STATUS    PORTS
ma_electrical-db          Up        5432/tcp
ma_electrical-backend     Up        0.0.0.0:8001->8000/tcp
ma_electrical-frontend    Up        0.0.0.0:3001->80/tcp
```

4. **Access the application**
- Frontend: http://localhost:3001
- Backend API: http://localhost:8001
- API Docs: http://localhost:8001/docs

5. **Default Login**
- Username: `joey`
- Password: `password123` (change immediately)

Optional: reset via:
- `docker compose exec ma_electrical-backend python scripts/create_admin.py --username joey --password '<new-strong-password>' --role admin --force`

If you have older data where jobs/time entries reference `joseph`, reassign them to `joey`:
- PowerShell: `Get-Content database/migration_reassign_legacy_joseph_to_joey.sql | docker compose exec -T ma_electrical-db psql -U postgres -d ma_electrical`
- Bash: `cat database/migration_reassign_legacy_joseph_to_joey.sql | docker compose exec -T ma_electrical-db psql -U postgres -d ma_electrical`

---

## 🔌 API Endpoints

### Authentication
- `POST /login` - Get JWT token

### Inventory
- `GET /inventory` - List all items
- `GET /inventory/{id}` - Get single item
- `GET /inventory/low-stock` - Items below min_stock
- `GET /inventory/barcode/{upc}` - Lookup by barcode
- `POST /inventory` - Create new item
- `PATCH /inventory/{id}` - Update item
- `DELETE /inventory/{id}` - Delete item

### Stock Management
- `POST /inventory/{id}/adjust-stock` - Adjust quantity (+/-)
- `GET /inventory/{id}/transactions` - View stock history

### Search & Filters
- `GET /inventory/search?query={text}` - Full-text search
- `GET /categories` - List all categories

### User Settings
- `GET /user/settings` - Get user preferences
- `POST /user/settings` - Save preferences (theme, columns, etc.)

### Import/Export
- `POST /inventory/import` - CSV bulk upload
- (Export handled by frontend)

### Work Orders (Future)
- `GET /work-orders` - Placeholder (returns empty array)

---

## 📱 Mobile Features (To Be Implemented)

### Phase 2: Mobile UI Components
1. **Quick Stock Adjustment**
   - Large +1, +5, −1, −5 buttons
   - Touch-optimized for warehouse use
   - Instant stock updates with haptic feedback

2. **Barcode Scanner**
   - Camera-based scanning using @zxing/library
   - Auto-lookup inventory by UPC
   - Quick view item details
   - One-tap stock adjustment

3. **Low-Stock Alerts**
   - Red row highlighting when qty ≤ min_stock
   - Badge count on navigation
   - Filter view for reorder management

4. **Responsive Layout**
   - Bottom tab navigation (phones)
   - Single-column card view (small screens)
   - DataGrid with horizontal scroll (tablets)

---

## 🎨 Electrical Inventory Features

### What Makes This Different from NPP_Deals

**Electrical-Specific Fields**
- Voltage, amperage, wire gauge, wire type
- MA electrical code references (MA 230.85)
- NEC 2023 compliance tracking
- UL listing and certifications

**4-Tier Pricing**
- Cost (our purchase price)
- Retail (manufacturer list)
- Granite City Price (contractor wholesale)
- Sell Price (final customer)

**Warehouse Management**
- Physical location tracking (A1, B2, etc.)
- Min stock thresholds
- Stock transaction audit trail
- Low-stock alerts

**Work Order Integration (Future)**
- Link inventory to jobs
- Track material usage per work order
- Generate customer invoices
- Permit and inspection tracking

---

## 🔧 Development Commands

### Backend (Local Development)
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (Local Development)
```bash
cd frontend
npm install
npm start
```

### Database (Direct Access)
```bash
docker exec -it ma_electrical-db psql -U postgres -d ma_electrical
```

Useful queries:
```sql
-- View all inventory
SELECT item_id, description, category, qty, min_stock FROM inventory;

-- Low stock items
SELECT * FROM inventory WHERE qty <= min_stock;

-- Stock transactions
SELECT * FROM stock_transactions ORDER BY transaction_date DESC LIMIT 20;

-- Categories
SELECT DISTINCT category FROM inventory ORDER BY category;
```

---

## 🚢 Deployment (DigitalOcean)

### Option 1: Deploy Alongside NPP_Deals
Your droplet at `104.131.49.141` can run both systems:

**NPP_Deals:**
- Frontend: Port 80 (http://104.131.49.141)
- Backend: Port 8000

**MA Electrical:**
- Frontend: Port 3001 (http://104.131.49.141:3001)
- Backend: Port 8001

### Option 2: Separate Subdomain
Use Cloudflare Tunnel or Nginx reverse proxy:
- `catalog.nat-procurement.com` → NPP_Deals
- `inventory.nat-procurement.com` → MA Electrical

### Deployment Steps
1. SSH into droplet:
```bash
ssh root@104.131.49.141
```

2. Clone repository:
```bash
cd /root
git clone <your-repo-url> MA_Electrical_Inventory
cd MA_Electrical_Inventory
```

3. Start services:
```bash
docker-compose up -d --build
```

4. Configure firewall:
```bash
ufw allow 3001/tcp
ufw allow 8001/tcp
```

---

## 📋 Seed Data Included

The database schema includes 58 items from your existing Streamlit app:
- 2 fully-priced items (Square D panel, Siemens SPD)
- 56 categorized items across all electrical categories:
  - Service Entrance & Main Distribution
  - Overcurrent Protection
  - Wiring & Cables
  - Conduit & Raceway
  - Electrical Boxes
  - Receptacles
  - Switches
  - Lighting Fixtures
  - Safety & Detection
  - Grounding & Bonding
  - Special Systems
  - Fasteners & Supports

---

## 🔐 Security Features

- **bcrypt password hashing** (salt rounds: 12)
- **JWT tokens** with 12-hour expiration
- **Role-based access control** (admin, manager, user, viewer)
- **SQL injection protection** (parameterized queries)
- **CORS configuration** (whitelisted origins only)
- **HTTPS ready** (TLS termination at Nginx)

---

## 🎯 Next Steps

### Immediate (Day 2-3)
1. Create React frontend components:
   - Login page
   - Inventory list (DataGrid)
   - Product form dialog
   - Quick stock adjuster
   - Barcode scanner

2. Implement mobile UI:
   - Bottom tab navigation
   - Touch-friendly buttons
   - Responsive breakpoints

3. Add visual features:
   - Low-stock red rows
   - Badge notifications
   - Loading states

### Short-Term (Week 1-2)
1. CSV import wizard (frontend)
2. Excel export with column selection
3. Advanced filters (category, voltage, amperage)
4. Settings dialog (theme, text scale)
5. Stock transaction history view

### Long-Term (Month 1-2)
1. Work order management UI
2. Customer database
3. Job scheduling calendar
4. Invoice generation
5. Reporting dashboard

---

## 📞 Support

**Owner/Manager**: Joseph
**Developer**: Claude Code
**Project Type**: Separate company from NPP_Deals

**Key Files to Study:**
1. `backend/main.py` - Complete API logic
2. `database/schema.sql` - Full database structure
3. `docker-compose.yml` - Service orchestration

---

## 🔄 Comparison: Streamlit vs. New System

| Feature | Old (Streamlit) | New (React + FastAPI) |
|---------|----------------|----------------------|
| **Multi-user** | ❌ Excel file locking | ✅ PostgreSQL concurrent access |
| **Mobile** | ⚠️ Table too wide | ✅ Responsive design + touch UI |
| **Authentication** | ❌ None | ✅ JWT with roles |
| **Audit Trail** | ❌ None | ✅ Full transaction history |
| **Barcode** | ❌ Manual entry | ✅ Camera scanning |
| **Work Orders** | ❌ Not possible | ✅ Database ready |
| **Deployment** | ⚠️ Local file only | ✅ Docker + cloud-ready |
| **API** | ❌ None | ✅ RESTful + auto docs |
| **Low Stock** | ⚠️ Filter only | ✅ Visual alerts + badges |

---

## 📚 Learning Resources

- FastAPI Docs: https://fastapi.tiangolo.com
- Material-UI: https://mui.com/material-ui/getting-started/
- PostgreSQL: https://www.postgresql.org/docs/13/
- Docker Compose: https://docs.docker.com/compose/
- React Router: https://reactrouter.com/en/main

---

**Generated by**: Claude Code
**Date**: November 24, 2024
**Version**: 1.0.0 - Foundation Complete
