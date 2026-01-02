# 🧪 Testing Guide - MA Electrical Inventory

## 🎯 What's New and Ready to Test

You now have a **fully functional inventory management system** with:
- ✅ 77 comprehensive inventory fields
- ✅ Quick stock adjustment (2-click workflow)
- ✅ Comprehensive add/edit forms
- ✅ Vendor management
- ✅ Real-time stock availability tracking

---

## 🚀 How to Access

### On PC:
```
http://localhost:3001
```

### On Pixel 7:
```
http://192.168.1.160:3001
```

### Login:
```
Username: joseph
Password: <your-password>
```

---

## 📋 TEST CHECKLIST

### ✅ Test 1: View Inventory
**Expected:**
- See 5 sample items in the grid
- New columns visible:
  - ⭐ Commonly Used indicator (star icon)
  - item_id, description, brand, category
  - qty (colored chip - green/red)
  - **qty_available** (NEW - shows available stock)
  - min_stock, location
  - cost, sell_price
  - Actions buttons

**Actions:**
- [ ] Can see all 5 items
- [ ] Grid is sortable (click column headers)
- [ ] Search works
- [ ] "Low Stock Only" filter works

---

### ✅ Test 2: Quick Stock Adjustment (PRIMARY WORKFLOW)

**Location:** Click "Quick Adjust" button (swap icon) on any item row

**What to Test:**

1. **Open Dialog:**
   - [ ] Shows item info (item_id, brand, description)
   - [ ] Shows current qty and qty_available
   - [ ] Shows adjustment buttons: -10, -5, -1, +1, +5, +10

2. **Quick Adjustment:**
   - [ ] Click "+5" button
   - [ ] Preview shows new qty (e.g., 20 → 25)
   - [ ] Reason dropdown defaults to "Used on job"
   - [ ] Click "Adjust Stock" button
   - [ ] Success message appears
   - [ ] Grid refreshes with new qty
   - [ ] qty and qty_available both updated

3. **Manual Entry:**
   - [ ] Open dialog again
   - [ ] Type "-3" in manual entry field
   - [ ] Preview updates
   - [ ] Select reason: "Damaged"
   - [ ] Add notes: "Cracked during transport"
   - [ ] Submit
   - [ ] Grid updates

4. **Validation:**
   - [ ] Try to reduce stock below 0 (should show error)
   - [ ] Try empty reason (should require selection)

**Expected Workflow Time:** ~5 seconds per adjustment ⚡

---

### ✅ Test 3: Add New Item (SECONDARY WORKFLOW)

**Location:** Click "+ ADD ITEM" button in toolbar

**What to Test:**

**Tab 1 - Basic Info:**
- [ ] Fill required fields (marked with *):
  - item_id: "0021"
  - brand: "Eaton"
  - description: "30A 2-Pole Circuit Breaker"
  - category: "Overcurrent Protection"
  - cost: 12.50
  - sell_price: 18.75
  - qty: 25
  - min_stock: 10
  - location: "C2"
- [ ] Toggle "Commonly Used" ON
- [ ] Click "Save" (should work with just required fields)
- [ ] New item appears in grid
- [ ] Grid automatically refreshes

**Tab 2 - Pricing (Optional):**
- [ ] Click "Add Item" again
- [ ] Fill Basic Info for item "0022"
- [ ] Go to Pricing tab
- [ ] Fill: cost=$10, markup_percent=40, list_price=$20
- [ ] Sell price auto-calculates ($14.00)
- [ ] Save
- [ ] Item added with pricing

**Tab 3 - Electrical Specs (Optional):**
- [ ] Add item "0023"
- [ ] Go to Specs tab
- [ ] Fill: voltage="240V", amperage="30A", num_poles=2
- [ ] Check "UL Listed"
- [ ] Check "GFCI Required"
- [ ] Fill: ma_code_ref="NEC 240.6", nec_ref="NEC 240"
- [ ] Save
- [ ] Item added with electrical specs

**Tab 4 - Vendor (Optional):**
- [ ] Add item "0024"
- [ ] Go to Vendor tab
- [ ] Select Primary Vendor: "Granite City Electric"
- [ ] Fill vendor_part_number: "BR230"
- [ ] Fill lead_time_days: 2
- [ ] Save
- [ ] Item added with vendor info

**Tab 5 - Advanced (Optional):**
- [ ] Add item "0025"
- [ ] Go to Advanced tab
- [ ] Fill physical properties: qty_per="Each", weight_lbs=1.2
- [ ] Fill media: image_url="https://example.com/image.jpg"
- [ ] Add notes: "Compatible with BR panels only"
- [ ] Check "Active"
- [ ] Save
- [ ] Item added with all details

**Validation Tests:**
- [ ] Try to save without item_id (should show error)
- [ ] Try to save without brand (should show error)
- [ ] Try to save without description (should show error)
- [ ] Try negative qty (should show error)
- [ ] Try non-numeric cost (should show error)

---

### ✅ Test 4: Edit Existing Item

**Location:** Click "Edit" icon button on any item row

**What to Test:**

1. **Load Existing Data:**
   - [ ] Dialog opens in "Edit" mode
   - [ ] All tabs show existing values
   - [ ] Basic Info shows all current data
   - [ ] Pricing shows current prices
   - [ ] Specs show electrical details

2. **Partial Update (Change 1 Field):**
   - [ ] Edit item "0001"
   - [ ] Change only location: "B2" → "B3"
   - [ ] Click "Save"
   - [ ] Only location updates (other fields unchanged)
   - [ ] Grid refreshes

3. **Multi-Tab Update:**
   - [ ] Edit item "0002"
   - [ ] Basic Info: Change qty from 15 to 20
   - [ ] Pricing: Change cost from 148.00 to 150.00
   - [ ] Vendor: Change primary vendor
   - [ ] Save
   - [ ] All changes applied
   - [ ] Grid refreshes

4. **Add Optional Fields to Existing Item:**
   - [ ] Edit item "0018" (14/2 Romex)
   - [ ] Go to Specs tab
   - [ ] Fill wire_insulation: "THHN"
   - [ ] Fill indoor_outdoor: "Indoor"
   - [ ] Check "Wet Location Rated"
   - [ ] Save
   - [ ] Fields added to existing item

---

### ✅ Test 5: Search & Filter

**Search:**
- [ ] Type "romex" in search box
- [ ] See only items 0018 and 0019
- [ ] Clear search
- [ ] Type "200A"
- [ ] See items with 200A amperage

**Low Stock Filter:**
- [ ] Click "Low Stock Only" button
- [ ] See only items where qty ≤ min_stock
- [ ] Badge shows count
- [ ] Click again to clear filter

**Sorting:**
- [ ] Click "qty" column header
- [ ] Items sort by quantity
- [ ] Click again for reverse order
- [ ] Sort by "cost"
- [ ] Sort by "sell_price"

---

### ✅ Test 6: Computed Fields

**qty_available (NEW!):**
- [ ] Note initial qty and qty_available for an item
- [ ] Use Quick Adjust to change qty
- [ ] Both qty and qty_available update
- [ ] They should always match (no jobs allocated yet)

**Future Test (when jobs are added):**
- [ ] Allocate materials to a job
- [ ] qty stays same
- [ ] qty_available decreases by allocated amount
- [ ] Example: qty=20, allocated=5, available=15

---

### ✅ Test 7: Mobile Experience

**On Pixel 7:**

1. **Responsive Layout:**
   - [ ] Grid fits screen width
   - [ ] Columns adjust for mobile
   - [ ] Action buttons accessible
   - [ ] Dialogs are scrollable

2. **Quick Adjust on Mobile:**
   - [ ] Tap "Quick Adjust"
   - [ ] Dialog opens full-screen
   - [ ] Buttons are touch-friendly (48px min)
   - [ ] Easy to tap +/- buttons
   - [ ] Keyboard appears for manual entry
   - [ ] Save button is large and accessible

3. **Add/Edit on Mobile:**
   - [ ] Tap "+ ADD ITEM"
   - [ ] Tabs are swipeable
   - [ ] Form fields are touch-friendly
   - [ ] Dropdowns work well
   - [ ] Can scroll to see all fields
   - [ ] Save button always visible

4. **Navigation:**
   - [ ] Can scroll grid left/right
   - [ ] Can pinch to zoom (if needed)
   - [ ] Search box works with on-screen keyboard
   - [ ] Filter toggle works

---

## 🐛 COMMON ISSUES & FIXES

### Issue 1: "Network Error" or "Not authenticated"
**Fix:** Log out and log back in. JWT token may have expired.

### Issue 2: Changes don't appear in grid
**Fix:** The grid should auto-refresh. If not, refresh browser (Ctrl+R or F5).

### Issue 3: Dialog doesn't open
**Fix:** Check browser console (F12) for errors. Report error message.

### Issue 4: Vendor dropdown is empty
**Fix:** Backend vendors endpoint might not be working. Check backend logs.

### Issue 5: Can't save new item
**Fix:** Check that all required fields are filled (marked with *).

---

## 📊 EXPECTED RESULTS

### After Quick Adjust +5 on Item 0001:
```
Before:
  qty: 8
  qty_available: 8

After:
  qty: 13
  qty_available: 13
```

### After Adding Item 0021:
```
Grid shows new row:
  item_id: 0021
  description: 30A 2-Pole Circuit Breaker
  brand: Eaton
  category: Overcurrent Protection
  qty: 25
  qty_available: 25
  min_stock: 10
  location: C2
```

### After Editing Item Location:
```
Only location changes:
  Before: location = "B2"
  After: location = "B3"

All other fields unchanged
```

---

## 🎯 KEY FEATURES TO VERIFY

### 1. Quick Stock Adjustment (Most Important!)
- [ ] Fast (2-3 clicks max)
- [ ] No page reload required
- [ ] Immediate visual feedback
- [ ] Works on mobile

### 2. Comprehensive Forms
- [ ] All 77 fields accessible
- [ ] Organized in logical tabs
- [ ] Required fields enforced
- [ ] Optional fields truly optional

### 3. Data Integrity
- [ ] Negative stock prevented
- [ ] Required fields can't be skipped
- [ ] Numeric validation works
- [ ] Changes save correctly

### 4. User Experience
- [ ] Loading indicators show
- [ ] Success messages appear
- [ ] Error messages are clear
- [ ] Mobile-friendly

---

## 📝 FEEDBACK TO PROVIDE

After testing, report:

1. **What works well:**
   - List features that work smoothly
   - Note workflows that feel natural

2. **What needs improvement:**
   - Any confusing UI elements
   - Missing fields you need
   - Workflows that feel slow

3. **Issues found:**
   - Specific errors encountered
   - Steps to reproduce problems
   - Browser console errors (F12)

4. **Feature requests:**
   - Additional fields needed
   - Different layout preferences
   - Missing functionality

---

## 🚀 NEXT FEATURES TO BUILD

After you test and approve Phase 1, we'll add:

**Phase 2:**
- Work order creation
- Material allocation to jobs
- Customer management
- Job status tracking

**Phase 3:**
- Labor time tracking
- Invoice generation
- Reports & analytics
- Advanced search filters

---

## 📞 HOW TO TEST

1. **Open browser** (PC or phone)
2. **Login** with your admin credentials (created via `backend/scripts/create_admin.py`)
3. **Follow test checklist above** (check boxes as you go)
4. **Note any issues or feedback**
5. **Report back** what works and what needs adjustment

**Take your time and test thoroughly!** This is your chance to fine-tune before we add more complex features. 🎯
