# 📦 Inventory Fields - Complete Analysis & Design

## 🎯 Goal
Design the **perfect inventory tracking system** for your electrical contracting business - capturing everything you need without unnecessary complexity.

---

## 📊 CURRENT FIELDS (37 total)

Let me break down what you have and analyze each field:

### ✅ IDENTIFICATION (5 fields)
| Field | Type | Keep? | Notes |
|-------|------|-------|-------|
| `id` | SERIAL | ✅ YES | Primary key (auto) |
| `item_id` | VARCHAR(20) | ✅ YES | Your custom ID (0001, 0002) |
| `sku` | VARCHAR(100) | 🤔 MAYBE | Manufacturer SKU - do you use this? |
| `brand` | VARCHAR(100) | ✅ YES | Square D, Siemens, etc. |
| `upc` | VARCHAR(50) | ✅ YES | For barcode scanning |
| `description` | TEXT | ✅ YES | Main product name |

**Questions:**
- Do you use manufacturer SKUs or just your item_id?
- Do all items have UPCs or just some?

---

### ✅ CATEGORY & CLASSIFICATION (2 fields)
| Field | Type | Keep? | Notes |
|-------|------|-------|-------|
| `category` | VARCHAR(100) | ✅ YES | Service Entrance, Wiring, etc. |
| `subcategory` | VARCHAR(100) | ✅ YES | Main Panels, Romex, etc. |

**Recommendation:** Keep both - great for filtering and organizing.

---

### 💰 PRICING (5 fields)
| Field | Type | Keep? | Notes |
|-------|------|-------|-------|
| `cost` | DECIMAL(10,2) | ✅ YES | What you paid |
| `retail` | DECIMAL(10,2) | 🤔 QUESTION | Manufacturer list price? |
| `granite_city_price` | DECIMAL(10,2) | 🤔 QUESTION | Your wholesale supplier? |
| `markup_percent` | DECIMAL(5,2) | ✅ YES | Your markup (35%) |
| `sell_price` | DECIMAL(10,2) | ✅ YES | What you charge customer |

**Questions:**
- **`retail`** - Do you need MSRP/list price? Or just cost vs sell?
- **`granite_city_price`** - Is this the price Granite City Electric charges you (same as `cost`)?
- Could we simplify to just: `cost`, `markup_percent`, `sell_price`?

**Pricing Suggestions:**
```
Option A (Simple):
- cost (what you pay)
- markup_percent (your margin)
- sell_price (what customer pays)

Option B (Detailed):
- cost (what you pay vendor)
- list_price (manufacturer MSRP - for reference)
- markup_percent
- sell_price (calculated: cost × (1 + markup))
- discount_price (optional sale price)

Which do you prefer?
```

---

### 📦 INVENTORY MANAGEMENT (3 fields + NEW)
| Field | Type | Keep? | Notes |
|-------|------|-------|-------|
| `qty` | INTEGER | ✅ YES | Total quantity on hand |
| `min_stock` | INTEGER | ✅ YES | Reorder point |
| `location` | VARCHAR(50) | ✅ YES | Warehouse location (A1, B2) |

**NEW FIELDS TO ADD:**
| Field | Type | Why? |
|-------|------|------|
| `qty_allocated` | INTEGER | Reserved for jobs |
| `qty_available` | COMPUTED | qty - qty_allocated |
| `qty_on_order` | INTEGER | Incoming from vendors |
| `reorder_qty` | INTEGER | How many to reorder when low |
| `max_stock` | INTEGER | Don't order above this |

**Example:**
```
Item: 12/2 Romex
qty: 20 rolls (total in warehouse)
qty_allocated: 8 rolls (reserved for active jobs)
qty_available: 12 rolls (free to use)
qty_on_order: 10 rolls (arriving Friday)
min_stock: 10 rolls (reorder trigger)
reorder_qty: 15 rolls (standard order amount)
max_stock: 30 rolls (don't exceed - storage limit)
```

**Question:** Do you want to track `max_stock` to prevent over-ordering?

---

### 📏 PHYSICAL PROPERTIES (2 fields)
| Field | Type | Keep? | Notes |
|-------|------|-------|-------|
| `qty_per` | VARCHAR(20) | ✅ YES | Each, Box, Roll, Foot, etc. |
| `weight_lbs` | DECIMAL(8,2) | 🤔 QUESTION | Do you need weight? |

**Questions:**
- **Weight:** Do you use this for truck loading or shipping? Or can we skip it?
- **Additional physical specs needed?**
  - Dimensions (L × W × H)?
  - Package quantity (if buying boxes of 10)?

**Suggestions:**
```
qty_per options:
- Each (individual items)
- Box (box of 10 outlets)
- Roll (250ft wire roll)
- Foot (sold by the foot)
- Pair (sold in pairs)
- Case (case of 12)

Do we need:
- items_per_package (if buying boxes)?
  Example: Outlets - sold by Each, but come in boxes of 10
```

---

### ⚡ ELECTRICAL SPECIFICATIONS (5 fields)
| Field | Type | Keep? | Notes |
|-------|------|-------|-------|
| `voltage` | VARCHAR(50) | ✅ YES | 120V, 240V, etc. |
| `amperage` | VARCHAR(50) | ✅ YES | 15A, 20A, 100A, 200A |
| `wire_gauge` | VARCHAR(50) | ✅ YES | 14 AWG, 12 AWG, etc. |
| `wire_type` | VARCHAR(50) | ✅ YES | Copper, Aluminum |
| `num_poles` | INTEGER | ✅ YES | For breakers (1, 2, 3) |

**These are PERFECT for electrical contractors!** Keep all.

**Additional electrical specs to consider?**
| Field | Type | Example | Need? |
|-------|------|---------|-------|
| `phase` | VARCHAR(20) | Single, Three-Phase | 🤔 |
| `wire_strands` | VARCHAR(20) | Solid, Stranded | 🤔 |
| `wire_insulation` | VARCHAR(50) | THHN, THWN, XHHW | 🤔 |
| `conduit_size` | VARCHAR(20) | 1/2", 3/4", 1" | 🤔 |
| `outdoor_rated` | BOOLEAN | TRUE/FALSE | 🤔 |
| `wet_location_rated` | BOOLEAN | TRUE/FALSE | 🤔 |

**Question:** Which additional electrical specs do you commonly need to track?

---

### 📜 COMPLIANCE & DOCUMENTATION (4 fields)
| Field | Type | Keep? | Notes |
|-------|------|-------|-------|
| `ma_code_ref` | VARCHAR(100) | ✅ YES | MA 230.85, 780 CMR |
| `nec_ref` | VARCHAR(100) | ✅ YES | NEC 210.12, NEC 408 |
| `ul_listed` | BOOLEAN | ✅ YES | UL certified |
| `certifications` | TEXT | ✅ YES | UL, CE, CSA, ETL |

**These are GOLD for compliance!** Keep all.

**Additional compliance fields?**
| Field | Type | Need? |
|-------|------|-------|
| `arc_fault_required` | BOOLEAN | For AFCI requirements |
| `gfci_required` | BOOLEAN | For GFCI requirements |
| `tamper_resistant` | BOOLEAN | For TR outlets |

---

### 🏭 SUPPLY CHAIN (4 fields)
| Field | Type | Keep? | Notes |
|-------|------|-------|-------|
| `vendor` | VARCHAR(100) | 🤔 QUESTION | Store as text or link to vendors table? |
| `vendor_part_number` | VARCHAR(100) | ✅ YES | Vendor's item number |
| `manufacturer_part_number` | VARCHAR(100) | ✅ YES | Mfr part number |
| `lead_time_days` | INTEGER | ✅ YES | How long to restock |

**Question:** Should `vendor` be:
- **Option A:** Text field (simple) - "Granite City Electric"
- **Option B:** Foreign key to `vendors` table (normalized)
  - Better for tracking multiple vendors per item
  - Better for vendor contact info
  - Recommended if you have 5+ vendors

**Additional supply chain fields?**
| Field | Type | Need? |
|-------|------|-------|
| `preferred_vendor` | VARCHAR(100) | If multiple vendors |
| `alternate_vendor` | VARCHAR(100) | Backup supplier |
| `last_order_date` | DATE | When last ordered |
| `last_order_cost` | DECIMAL(10,2) | Track price changes |
| `discontinued` | BOOLEAN | Item no longer available |
| `replacement_item_id` | VARCHAR(20) | Newer model replaced this |

---

### 📸 MEDIA & DOCUMENTATION (3 fields)
| Field | Type | Keep? | Notes |
|-------|------|-------|-------|
| `image_url` | TEXT | ✅ YES | Product photo |
| `datasheet_pdf` | TEXT | ✅ YES | Spec sheets |
| `installation_guide` | TEXT | ✅ YES | Install instructions |

**Perfect!** Keep all.

**Additional media fields?**
| Field | Type | Need? |
|-------|------|-------|
| `multiple_images` | JSONB | Array of image URLs |
| `video_url` | TEXT | Installation videos |
| `qr_code` | TEXT | Generated QR code for mobile |

---

### 📝 METADATA (4 fields + suggestions)
| Field | Type | Keep? | Notes |
|-------|------|-------|-------|
| `notes` | TEXT | ✅ YES | General notes |
| `qty_formula` | VARCHAR(100) | 🤔 QUESTION | "1 per room" - do you use? |
| `active` | BOOLEAN | ✅ YES | Hide discontinued items |
| `out_of_stock` | BOOLEAN | 🤔 QUESTION | Redundant with qty=0? |
| `date_added` | TIMESTAMP | ✅ YES | When created |
| `last_updated` | TIMESTAMP | ✅ YES | Last modified |

**Questions:**
- **`qty_formula`:** Is this for estimating jobs? Example: "1 panel per 2000 sq ft"?
- **`out_of_stock`:** Can we just check `qty_available = 0`? Or does this mean "discontinued"?

**NEW METADATA FIELDS TO CONSIDER:**
| Field | Type | Why? |
|-------|------|------|
| `commonly_used` | BOOLEAN | Quick-add for mobile app |
| `taxable` | BOOLEAN | Subject to sales tax? |
| `serialized` | BOOLEAN | Track individual serial numbers |
| `hazardous` | BOOLEAN | Special handling needed |
| `returnable` | BOOLEAN | Can return to vendor |
| `warranty_months` | INTEGER | Product warranty |
| `last_counted_date` | DATE | Last physical inventory count |
| `count_variance` | INTEGER | Difference in last count |

---

## 🎯 RECOMMENDED FIELD GROUPS

### 🟢 TIER 1: ESSENTIAL (Must Have)
```sql
-- Identification
id, item_id, description, brand, upc

-- Category
category, subcategory

-- Pricing
cost, markup_percent, sell_price

-- Inventory
qty, qty_allocated, qty_available (computed), min_stock, location

-- Metadata
active, notes, date_added, last_updated
```

### 🟡 TIER 2: IMPORTANT (Highly Recommended)
```sql
-- Electrical Specs
voltage, amperage, wire_gauge, wire_type, num_poles

-- Physical
qty_per

-- Compliance
ma_code_ref, nec_ref, ul_listed

-- Supply Chain
vendor, manufacturer_part_number, lead_time_days

-- Media
image_url

-- Job Management
commonly_used, reorder_qty
```

### 🔵 TIER 3: NICE TO HAVE (Optional)
```sql
-- Additional Pricing
retail, granite_city_price, discount_price

-- Additional Inventory
qty_on_order, max_stock

-- Additional Physical
weight_lbs, dimensions

-- Additional Compliance
certifications, arc_fault_required, gfci_required

-- Additional Supply Chain
vendor_part_number, alternate_vendor, discontinued

-- Additional Media
datasheet_pdf, installation_guide, multiple_images

-- Additional Metadata
qty_formula, taxable, serialized, warranty_months
```

---

## ❓ QUESTIONS FOR YOU:

### 1. **Pricing Model**
Which pricing structure do you use?
- [ ] **Simple:** cost + markup = sell_price
- [ ] **With Reference:** cost + list_price (MSRP) + markup = sell_price
- [ ] **Multiple Tiers:** cost + wholesale_price + retail_price + your_markup

### 2. **Vendors**
How many vendors do you regularly buy from?
- [ ] 1-2 (keep as text field)
- [ ] 3-5 (maybe create vendors table)
- [ ] 6+ (definitely create vendors table)

### 3. **Inventory Tracking**
Do you need to track:
- [ ] Maximum stock levels (don't order too much)
- [ ] Items on order (incoming shipments)
- [ ] Physical count dates (last inventory audit)
- [ ] Serial numbers for individual items

### 4. **Electrical Specifications**
Beyond the basics, do you need:
- [ ] Phase (single/three-phase)
- [ ] Wire insulation type (THHN, THWN)
- [ ] Conduit sizes
- [ ] Indoor/outdoor rating
- [ ] Wet location rating

### 5. **Physical Properties**
Do you need:
- [ ] Weight (for truck loading)
- [ ] Dimensions (for storage planning)
- [ ] Package quantity (items per box)

### 6. **Usage Data**
Would these help?
- [ ] Commonly used flag (quick-add on mobile)
- [ ] Usage frequency (how often used in jobs)
- [ ] Last used date
- [ ] Most popular items report

### 7. **Compliance Tracking**
Do you need quick filters for:
- [ ] AFCI required items
- [ ] GFCI required items
- [ ] Tamper-resistant items
- [ ] Arc-fault detection items

### 8. **Advanced Features**
Interested in:
- [ ] Barcode/QR code generation
- [ ] Multiple photos per item
- [ ] Video installation guides
- [ ] Warranty tracking
- [ ] Hazmat flags
- [ ] Return policy tracking

---

## 🎨 SIMPLIFIED INVENTORY FORM

Here's what the "Add/Edit Item" form could look like based on tiers:

```
┌─────────────────────────────────────────────────────┐
│ Add/Edit Inventory Item                             │
├─────────────────────────────────────────────────────┤
│ *** BASIC INFO ***                                  │
│ Item ID: [0021    ] (auto-generated)                │
│ Description: [20A 1-Pole Circuit Breaker        ]   │
│ Brand: [Square D ▼]                                 │
│ UPC/Barcode: [_____________] [📷 SCAN]              │
│                                                     │
│ *** CATEGORY ***                                    │
│ Category: [Overcurrent Protection ▼]                │
│ Subcategory: [Standard Circuit Breakers ▼]          │
│                                                     │
│ *** PRICING ***                                     │
│ Cost: [$8.50  ] Markup: [35 %]                     │
│ Sell Price: [$11.48 ] (auto-calculated)            │
│                                                     │
│ *** INVENTORY ***                                   │
│ Quantity: [50   ]  Unit: [Each ▼]                  │
│ Location: [C1   ]                                   │
│ Min Stock: [20  ]  Reorder Qty: [30  ]             │
│                                                     │
│ *** ELECTRICAL SPECS *** (optional)                 │
│ Voltage: [120V ▼]  Amperage: [20A ▼]               │
│ Poles: [1 ▼]                                        │
│                                                     │
│ *** COMPLIANCE *** (optional)                       │
│ MA Code: [NEC 240       ]                           │
│ UL Listed: [✓]                                      │
│                                                     │
│ *** VENDOR *** (optional)                           │
│ Vendor: [Granite City Electric ▼]                   │
│ Mfr Part #: [QO120     ]                            │
│ Lead Time: [2  ] days                               │
│                                                     │
│ *** NOTES ***                                       │
│ [Compatible with QO panels only               ]     │
│                                                     │
│ [✓ Commonly Used] [✓ Active]                        │
│                                                     │
│ [SAVE] [SAVE & ADD ANOTHER] [CANCEL]                │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 MY RECOMMENDATIONS

Based on your residential service contractor business, here's what I suggest:

### ✅ KEEP (35 fields):
All current fields EXCEPT:
- Remove `out_of_stock` (redundant - use qty_available = 0)
- Simplify pricing (see below)

### ➕ ADD (8 new fields):
1. `qty_allocated` - Reserved for jobs
2. `qty_available` - Computed: qty - qty_allocated
3. `qty_on_order` - Incoming stock
4. `reorder_qty` - Standard reorder amount
5. `commonly_used` - Quick-add flag for mobile
6. `taxable` - Sales tax applicable
7. `last_order_date` - Track purchasing
8. `last_order_cost` - Track price changes

### 🔧 MODIFY (2 fields):
1. `vendor` - Create `vendors` table if you have 3+ suppliers
2. `qty_formula` - Rename to `estimation_guide` for clarity

### 📊 FINAL COUNT: ~42 fields
- Essential for daily use: 15 fields
- Important for operations: 15 fields
- Nice to have: 12 fields

---

## 🎯 NEXT STEP:

**Answer the questions above** and I'll create the **final, optimized inventory schema** tailored exactly to your needs!

Which fields are you unsure about? Let's discuss! 🚀
