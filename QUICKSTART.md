# MA Electrical Inventory - Quick Start Guide

## ⚡ 5-Minute Setup

### Step 1: Verify Prerequisites
```bash
docker --version    # Should show Docker 20+
docker-compose --version
```

### Step 2: Navigate to Project
```bash
cd /c/Users/josep/projects/MA_Electrical_Inventory
```

### Step 3: Configure Environment
Copy the template and set strong values:
```bash
cp .env.example .env
```

Edit `.env` and set at minimum:
- `DB_PASSWORD`
- `SECRET_KEY`

### Step 4: Start Everything
```bash
docker-compose up -d --build
```

**First-time build takes ~5 minutes**
- Downloading PostgreSQL image
- Building Python backend
- Installing React dependencies

### Step 5: Watch Progress
```bash
docker-compose logs -f
```

Press `Ctrl+C` to stop watching logs.

### Step 6: Check Status
```bash
docker-compose ps
```

### Login
- Username: `joey`
- Password: `password123` (change immediately)

✅ All 3 services should show **"Up"**:
- `ma_electrical-db`
- `ma_electrical-backend`
- `ma_electrical-frontend`

### Step 6: Access the App

**Backend API:**
http://localhost:8001

**API Documentation:**
http://localhost:8001/docs  ← Try this first!

**Frontend** (when built):
http://localhost:3001

---

## 🧪 Test the Backend API

### Option 1: Use Swagger UI (Easiest)
1. Open http://localhost:8001/docs
2. Click **Authorize** button (top right)
3. Create an admin user:
   - `docker compose exec ma_electrical-backend python scripts/create_admin.py --username admin --password '<strong-password>' --role admin`
4. Try these endpoints:
   - `GET /inventory` - See all items
   - `GET /inventory/low-stock` - Low stock items
   - `GET /categories` - All categories

### Option 2: Use curl (Terminal)
```bash
# Get auth token
curl -X POST http://localhost:8001/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=<your-password>"

# Response: {"access_token": "eyJ...", "token_type": "bearer"}

# Use token to get inventory (replace YOUR_TOKEN)
curl -X GET http://localhost:8001/inventory \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🗄️ Database Quick Check

### Connect to Database
```bash
docker exec -it ma_electrical-db psql -U postgres -d ma_electrical
```

### Run Queries
```sql
-- See all items
SELECT item_id, description, category, qty, min_stock FROM inventory LIMIT 10;

-- Count by category
SELECT category, COUNT(*) FROM inventory GROUP BY category ORDER BY COUNT(*) DESC;

-- Low stock
SELECT item_id, description, qty, min_stock
FROM inventory
WHERE qty <= min_stock;

-- Exit
\q
```

---

## 🛠️ Common Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Just backend
docker-compose logs -f ma_electrical-backend

# Just database
docker-compose logs -f ma_electrical-db
```

### Restart Services
```bash
# Restart all
docker-compose restart

# Restart just backend
docker-compose restart ma_electrical-backend
```

### Stop Everything
```bash
docker-compose down
```

### Stop and Delete Data
```bash
docker-compose down -v  # ⚠️ Deletes database!
```

### Rebuild After Code Changes
```bash
docker-compose up -d --build
```

---

## 🚨 Troubleshooting

### Port Already in Use
```
Error: bind: address already in use (port 8001)
```

**Solution:**
```bash
# Find what's using port 8001
netstat -ano | findstr :8001

# Kill the process (Windows)
taskkill /PID <process_id> /F

# Or change port in docker-compose.yml:
ports:
  - "8002:8000"  # Use 8002 instead
```

### Database Connection Failed
```
psycopg2.OperationalError: could not connect to server
```

**Solution:**
```bash
# Check database is running
docker-compose ps ma_electrical-db

# View database logs
docker-compose logs ma_electrical-db

# Restart database
docker-compose restart ma_electrical-db
```

### Schema Not Loaded
```
relation "inventory" does not exist
```

**Solution:**
```bash
# Manually run schema
docker exec -it ma_electrical-db psql -U postgres -d ma_electrical -f /app/database/schema.sql

# Or rebuild everything
docker-compose down -v
docker-compose up -d --build
```

---

## 📊 Sample API Calls (Postman/Insomnia)

### 1. Login
```
POST http://localhost:8001/login
Content-Type: application/x-www-form-urlencoded

username=admin&password=<your-password>
```

**Response:**
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "username": "joseph"
}
```

### 2. Get All Inventory
```
GET http://localhost:8001/inventory
Authorization: Bearer eyJhbGc...
```

### 3. Create New Item
```
POST http://localhost:8001/inventory
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "description": "Test Circuit Breaker 20A",
  "category": "Overcurrent Protection",
  "subcategory": "Standard Circuit Breakers",
  "brand": "Square D",
  "amperage": "20A",
  "voltage": "120/240V",
  "num_poles": 1,
  "cost": 12.50,
  "retail": 24.99,
  "sell_price": 19.99,
  "qty": 50,
  "min_stock": 10,
  "location": "A1",
  "active": true
}
```

### 4. Adjust Stock (Add 10 units)
```
POST http://localhost:8001/inventory/1/adjust-stock
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "inventory_id": 1,
  "quantity_change": 10,
  "transaction_type": "restock",
  "reason": "Weekly delivery from supplier"
}
```

### 5. Search Inventory
```
GET http://localhost:8001/inventory/search?query=breaker
Authorization: Bearer eyJhbGc...
```

### 6. Get Item by Barcode
```
GET http://localhost:8001/inventory/barcode/785901123456
Authorization: Bearer eyJhbGc...
```

---

## 🎯 Next Steps

1. ✅ Backend is running - **You are here!**
2. ⏳ Build frontend (React components)
3. ⏳ Test full stack integration
4. ⏳ Deploy to DigitalOcean

---

## 📁 Project Structure Recap

```
MA_Electrical_Inventory/
├── backend/               ✅ COMPLETE
│   ├── main.py           ✅ 650+ lines of API code
│   ├── requirements.txt  ✅ Python dependencies
│   ├── Dockerfile        ✅ Multi-stage build
│   └── .env              ✅ Database credentials
│
├── database/             ✅ COMPLETE
│   └── schema.sql        ✅ Full PostgreSQL schema
│
├── docker-compose.yml    ✅ COMPLETE
│
├── frontend/             ⏳ NEXT PHASE
│   ├── package.json      ✅ Dependencies defined
│   ├── src/              ⏳ React components needed
│   └── Dockerfile        ⏳ To be created
│
├── README.md             ✅ Full documentation
└── QUICKSTART.md         ✅ This file
```

---

## 💡 Tips

1. **Use Swagger UI** (http://localhost:8001/docs) - It's your best friend for testing
2. **Check logs often** - `docker-compose logs -f` shows real-time errors
3. **Database persists** - Your data survives `docker-compose down` (but not `down -v`)
4. **Default users** - none (create via `scripts/create_admin.py`)

---

**Ready for production?** See `README.md` for full deployment guide.
