# 📦 Material Allocation System - Bidirectional Design

## 🎯 Core Principle
**Materials should be assignable from anywhere, anytime:**
- ✅ From Inventory page → Allocate to jobs
- ✅ From Job page → Pull from inventory
- ✅ From Mobile app → Quick add to current job
- ✅ Auto-check stock availability
- ✅ Warn about out-of-stock items
- ✅ Suggest purchasing if needed

---

## 🔄 WORKFLOW: Adding Materials to Jobs

### Scenario 1: Creating a New Job (From Job Page)

```
┌─────────────────────────────────────────────────────┐
│ Create Work Order - WO-2024-0042                   │
├─────────────────────────────────────────────────────┤
│ Customer: [John Smith                    ▼]        │
│ Job Type: [Panel Upgrade                 ▼]        │
│ Description: Upgrade from 100A to 200A             │
│                                                     │
│ ┌─────────────────────────────────────────────────┐│
│ │ 🛠️ Materials for This Job                      ││
│ │                                                  ││
│ │ [🔍 Search Inventory...           ] [+ ADD]     ││
│ │                                                  ││
│ │ ┌─ Selected Materials ──────────────────────┐  ││
│ │ │                                            │  ││
│ │ │ ✅ Main Panel 200A                        │  ││
│ │ │    Item: 0001                             │  ││
│ │ │    Qty: [−] 1 [+]                         │  ││
│ │ │    Available: 6 units ✅ IN STOCK        │  ││
│ │ │    Cost: $298  Sell: $402.30             │  ││
│ │ │    [❌ Remove]                            │  ││
│ │ │                                            │  ││
│ │ │ ✅ Surge Protector                        │  ││
│ │ │    Item: 0002                             │  ││
│ │ │    Qty: [−] 1 [+]                         │  ││
│ │ │    Available: 12 units ✅ IN STOCK       │  ││
│ │ │    Cost: $148  Sell: $199.00             │  ││
│ │ │    [❌ Remove]                            │  ││
│ │ │                                            │  ││
│ │ │ ⚠️ 12/2 Romex 250ft Roll                  │  ││
│ │ │    Item: 0019                             │  ││
│ │ │    Qty: [−] 2 [+]                         │  ││
│ │ │    Available: 1 unit ⚠️ LOW STOCK        │  ││
│ │ │    Need: 2 rolls, Have: 1 roll           │  ││
│ │ │    Cost: $75  Sell: $142.50              │  ││
│ │ │    [❌ Remove]                            │  ││
│ │ │    🛒 Need to order 1 more roll          │  ││
│ │ │    [📋 ADD TO PURCHASE ORDER]            │  ││
│ │ │                                            │  ││
│ │ └────────────────────────────────────────────┘  ││
│ │                                                  ││
│ │ Estimated Material Cost: $887.30                ││
│ │ Items In Stock: 2 ✅                            ││
│ │ Items Need Ordering: 1 ⚠️                       ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
│ [SAVE AS DRAFT] [CREATE WORK ORDER]                │
└─────────────────────────────────────────────────────┘
```

**When clicking "Search Inventory":**
```
┌─────────────────────────────────────────────────────┐
│ Add Materials from Inventory                        │
├─────────────────────────────────────────────────────┤
│ Search: [panel                           ] [🔍]     │
│                                                     │
│ Filters: [ ] In Stock Only  [ ] Commonly Used      │
│                                                     │
│ ┌─ Search Results ────────────────────────────────┐│
│ │                                                  ││
│ │ ☐ Main Panel 200A - 42 Circuit                 ││
│ │   Item: 0001 | Available: 6 units ✅            ││
│ │   Cost: $298.00  Sell: $402.30                  ││
│ │   Location: B2                                  ││
│ │                                                  ││
│ │ ☐ Main Panel 100A - 24 Circuit                 ││
│ │   Item: 0010 | Available: 0 units ❌            ││
│ │   Cost: $198.00  Sell: $297.00                  ││
│ │   🛒 OUT OF STOCK - Can still add to job       ││
│ │                                                  ││
│ │ ☐ Subpanel 100A - Indoor                       ││
│ │   Item: 0006 | Available: 3 units ✅            ││
│ │   Cost: $156.00  Sell: $234.00                  ││
│ │                                                  ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
│ [✓ ADD SELECTED (0)] [CANCEL]                      │
└─────────────────────────────────────────────────────┘
```

---

### Scenario 2: Adding Materials from Inventory Page

```
┌─────────────────────────────────────────────────────────────────┐
│ Inventory Management                                            │
├─────────────────────────────────────────────────────────────────┤
│ Search: [12/2 romex] [🔍]  [Low Stock] [+ ADD NEW ITEM]        │
├────────┬────────────────┬─────┬───────┬────────┬─────┬─────────┤
│ Select │ Description    │ Qty │ Alloc │ Avail  │ Min │ Actions │
├────────┼────────────────┼─────┼───────┼────────┼─────┼─────────┤
│   ☐   │ 12/2 Romex 250'│ 3   │ 2     │ 1      │ 8   │[📦][✏️]│
│        │ Item: 0019     │     │       │        │     │         │
│        │ Cost: $75      │     │       │        │     │         │
│        │ Sell: $142.50  │     │       │        │     │         │
├────────┼────────────────┼─────┼───────┼────────┼─────┼─────────┤
│   ☐   │ 14/2 Romex 250'│ 12  │ 8     │ 4      │ 10  │[📦][✏️]│
│        │ Item: 0018     │     │       │        │     │         │
└────────┴────────────────┴─────┴───────┴────────┴─────┴─────────┘

[✓ ALLOCATE TO JOB (0 selected)] [⬇️ EXPORT]
```

**When clicking [📦] icon or "Allocate to Job":**
```
┌─────────────────────────────────────────────────────┐
│ Allocate to Work Order                              │
│ Item: 12/2 Romex 250ft Roll                         │
│ Available: 1 unit ⚠️ LOW STOCK                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Select Work Order:                                  │
│ ┌─────────────────────────────────────────────────┐│
│ │ 🔍 Search by WO#, Customer, or Address...       ││
│ │                                                  ││
│ │ Active Work Orders:                              ││
│ │                                                  ││
│ │ ○ WO-2024-0042 - John Smith                    ││
│ │   Panel Upgrade | Scheduled: Today 9:00 AM      ││
│ │   📍 123 Main St, Springfield                   ││
│ │   👷 Assigned to: Mike                          ││
│ │   Status: Scheduled                             ││
│ │                                                  ││
│ │ ○ WO-2024-0043 - Jane Doe                      ││
│ │   Service Call | In Progress since 10:00 AM     ││
│ │   📍 456 Oak Ave, Springfield                   ││
│ │   👷 Assigned to: Sarah                         ││
│ │   Status: In Progress                           ││
│ │                                                  ││
│ │ ○ WO-2024-0044 - Bob Wilson                    ││
│ │   New Construction | Scheduled: Tomorrow        ││
│ │   📍 789 Elm St, Springfield                    ││
│ │   👷 Assigned to: Tom                           ││
│ │   Status: Scheduled                             ││
│ │                                                  ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
│ Quantity to Allocate: [−] 1 [+]                    │
│                                                     │
│ ⚠️ Warning: Only 1 unit available                  │
│ Other jobs may need this material                  │
│                                                     │
│ [ ] Mark as "Need to Order More"                   │
│                                                     │
│ [✓ ALLOCATE] [CANCEL]                              │
└─────────────────────────────────────────────────────┘
```

---

### Scenario 3: Mobile - Tech Needs to Add Materials During Job

```
┌─────────────────────────────┐
│ WO-2024-0042               │
│ Panel Upgrade              │
├─────────────────────────────┤
│ Materials on This Job:     │
│                            │
│ ✓ Main Panel 200A (1)      │
│ ✓ Surge Protector (1)      │
│                            │
│ [+ ADD MORE MATERIALS]     │
│ [📦 SCAN BARCODE]          │
└─────────────────────────────┘
```

**Clicking "ADD MORE MATERIALS":**
```
┌─────────────────────────────┐
│ Add Materials to Job       │
├─────────────────────────────┤
│ 🔍 Search: [wire nuts      ]│
│                            │
│ Quick Add (Common Items):  │
│ ┌─────────┬─────────┐     │
│ │ 20A     │ Outlets │     │
│ │ Breaker │ (5pk)   │     │
│ │ Avail:35│ Avail:8 │     │
│ └─────────┴─────────┘     │
│ ┌─────────┬─────────┐     │
│ │ Wire    │ 12/2    │     │
│ │ Nuts    │ Romex   │     │
│ │ Avail:20│⚠️LOW:1  │     │
│ └─────────┴─────────┘     │
│                            │
│ Search Results:            │
│ ┌─────────────────────────┐│
│ │ ✅ Wire Nut Assortment  ││
│ │ Available: 20 boxes     ││
│ │ Qty: [−] 1 [+]         ││
│ │ [ADD TO JOB]           ││
│ │                         ││
│ │ ⚠️ Wire Connector Kit   ││
│ │ Available: 0 boxes      ││
│ │ OUT OF STOCK           ││
│ │ [ADD ANYWAY + ORDER]   ││
│ └─────────────────────────┘│
│                            │
│ [DONE]                     │
└─────────────────────────────┘
```

---

## 🔔 OUT OF STOCK HANDLING

### When Adding Out-of-Stock Item to Job:

```
┌─────────────────────────────────────────────────────┐
│ ⚠️ Item Out of Stock                               │
├─────────────────────────────────────────────────────┤
│ Item: 100A Main Panel - 24 Circuit                 │
│ Item ID: 0010                                       │
│                                                     │
│ Current Stock: 0 units                              │
│ Requested: 1 unit                                   │
│                                                     │
│ ❌ Not available in warehouse                      │
│                                                     │
│ Options:                                            │
│                                                     │
│ ○ Add to job anyway (mark as "Need to Purchase")   │
│   Job will show material is pending                │
│                                                     │
│ ○ Add to Purchase Order immediately                │
│   Estimated delivery: 2-3 days                     │
│   Vendor: Granite City Electric                    │
│   Cost: $198.00                                    │
│                                                     │
│ ○ Find alternative item                            │
│   [🔍 SEARCH SIMILAR ITEMS]                        │
│                                                     │
│ ○ Cancel - Don't add this item                     │
│                                                     │
│ [CONFIRM SELECTION] [CANCEL]                       │
└─────────────────────────────────────────────────────┘
```

---

## 📊 JOB MATERIALS STATUS TRACKING

### On Work Order Details Page:

```
┌─────────────────────────────────────────────────────┐
│ Work Order Details - WO-2024-0042                   │
├─────────────────────────────────────────────────────┤
│ Customer: John Smith                                │
│ Job Type: Panel Upgrade                             │
│ Status: Scheduled for Nov 26, 9:00 AM               │
│                                                     │
│ ┌─ Materials Summary ─────────────────────────────┐│
│ │                                                  ││
│ │ ✅ Ready to Go: 2 items                         ││
│ │ ⚠️ Low Stock: 1 item                            ││
│ │ 🛒 Need to Order: 1 item                        ││
│ │                                                  ││
│ │ Total Material Cost: $887.30                    ││
│ │                                                  ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
│ Materials List:                                     │
│ ┌─────────────────────────────────────────────────┐│
│ │                                                  ││
│ │ ✅ Main Panel 200A                              ││
│ │    Qty: 1 | Available: 6 units                  ││
│ │    Status: IN STOCK                             ││
│ │    Location: B2 | Sell: $402.30                 ││
│ │    [✏️ Edit Qty] [❌ Remove]                    ││
│ │                                                  ││
│ │ ✅ Surge Protector                              ││
│ │    Qty: 1 | Available: 12 units                 ││
│ │    Status: IN STOCK                             ││
│ │    Location: B3 | Sell: $199.00                 ││
│ │    [✏️ Edit Qty] [❌ Remove]                    ││
│ │                                                  ││
│ │ ⚠️ 12/2 Romex 250ft Roll                        ││
│ │    Qty Needed: 2 | Available: 1 unit            ││
│ │    Status: LOW STOCK (short 1 roll)             ││
│ │    Sell: $285.00 (2 rolls)                      ││
│ │    [📋 CREATE PURCHASE ORDER]                   ││
│ │    [✏️ Edit Qty] [❌ Remove]                    ││
│ │                                                  ││
│ │ 🛒 Wire Connector Kit                           ││
│ │    Qty Needed: 1 | Available: 0 units           ││
│ │    Status: OUT OF STOCK - ON ORDER              ││
│ │    PO#: PO-2024-015 | ETA: Nov 27               ││
│ │    Sell: $45.00                                 ││
│ │    [📋 VIEW PURCHASE ORDER]                     ││
│ │                                                  ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
│ [+ ADD MORE MATERIALS]                              │
│ [⚠️ MARK JOB AS "WAITING ON MATERIALS"]            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 🎯 INTELLIGENT STOCK CHECKING

### Database Logic:

```sql
-- When adding material to job:

1. Check inventory.qty_available (total - allocated)
2. If qty_available >= requested_qty:
   ✅ Show "IN STOCK"

3. If qty_available > 0 BUT < requested_qty:
   ⚠️ Show "PARTIAL STOCK"
   "Have 1, Need 2 - Short 1 unit"

4. If qty_available = 0:
   ❌ Show "OUT OF STOCK"
   Offer options:
   - Add to job with "pending purchase" flag
   - Create purchase order
   - Find alternative item

5. Update job_materials_used:
   - quantity_needed = X
   - quantity_available_at_time = Y
   - status = 'in_stock' | 'partial' | 'out_of_stock'
   - needs_purchase = TRUE/FALSE
```

---

## 🔄 ALLOCATION STATES

### Material Status Flow:

```
1. PLANNED (not allocated yet)
   ↓
2. ALLOCATED (reserved for job, in warehouse)
   ↓
3. LOADED (on tech's truck)
   ↓
4. USED (installed/consumed)
   ↓
5. RETURNED (unused, back to warehouse)
   ↓
6. BILLED (invoiced to customer)
```

### Visual Indicators:

```
Status Colors:
✅ Green  - In stock, ready
⚠️ Yellow - Low stock, but can fulfill
🛒 Orange - Need to purchase
❌ Red    - Out of stock, blocking job
🚚 Blue   - On order, ETA available
```

---

## 📱 MOBILE FEATURES

### Quick Material Actions on Mobile:

```
┌─────────────────────────────┐
│ Current Job: WO-2024-0042  │
├─────────────────────────────┤
│ [📦 SCAN BARCODE]          │
│ Auto-adds to job           │
│                            │
│ [+ QUICK ADD]              │
│ Shows commonly used items  │
│                            │
│ [🔍 SEARCH INVENTORY]      │
│ Full search capability     │
│                            │
│ [📋 VIEW ALLOCATED]        │
│ See what's assigned        │
└─────────────────────────────┘
```

---

## 🎯 KEY FEATURES SUMMARY

### ✅ From Inventory Page:
- Click on item → "Allocate to Job"
- Select from active work orders
- See stock availability
- Warn if allocating last unit

### ✅ From Job Page:
- Search inventory
- Add multiple items
- See stock status inline
- Quick add common items
- Handle out-of-stock gracefully

### ✅ From Mobile:
- Quick add to current job
- Barcode scanner
- Common items shortcuts
- Real-time stock checking

### ✅ Smart Stock Checking:
- IN STOCK (green) - Ready to go
- LOW STOCK (yellow) - Partial availability
- OUT OF STOCK (red) - Need to order
- ON ORDER (blue) - Incoming with ETA

### ✅ Purchase Order Integration:
- Auto-suggest creating PO
- Track ETA
- Link materials to POs
- Update job status when materials arrive

---

## 🗄️ DATABASE CHANGES

### Updated `job_materials_used` table:

```sql
CREATE TABLE job_materials_used (
    id SERIAL PRIMARY KEY,
    work_order_id INTEGER NOT NULL REFERENCES work_orders(id),
    inventory_id INTEGER NOT NULL REFERENCES inventory(id),

    -- Quantity Management
    quantity_needed INTEGER NOT NULL,  -- How much job needs
    quantity_allocated INTEGER DEFAULT 0,  -- Reserved from warehouse
    quantity_loaded INTEGER DEFAULT 0,  -- On tech's truck
    quantity_used INTEGER DEFAULT 0,  -- Actually installed
    quantity_returned INTEGER DEFAULT 0,  -- Returned to warehouse

    -- Stock Status
    stock_status VARCHAR(20) DEFAULT 'checking',
    -- 'in_stock', 'partial', 'out_of_stock', 'on_order'

    needs_purchase BOOLEAN DEFAULT FALSE,
    purchase_order_id INTEGER REFERENCES purchase_orders(id),
    estimated_arrival DATE,

    -- Pricing
    unit_cost DECIMAL(10, 2) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,

    -- Status Tracking
    status VARCHAR(20) DEFAULT 'planned',
    -- 'planned', 'allocated', 'loaded', 'used', 'returned', 'billed'

    allocated_by VARCHAR(50) REFERENCES users(username),
    allocated_at TIMESTAMP,

    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

**This design gives you maximum flexibility** - add materials from anywhere, always know stock status, and seamlessly handle out-of-stock situations! 🚀

Ready to implement this approach?
