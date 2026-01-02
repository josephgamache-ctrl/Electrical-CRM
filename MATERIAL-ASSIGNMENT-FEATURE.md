# Material Assignment Feature

## Overview

You can now conveniently select inventory items and assign them directly to work orders from the inventory list. The work order is automatically updated with all assigned materials.

## How to Use

### Step 1: Select Items from Inventory

1. Navigate to the inventory list (http://localhost:3001)
2. Use the checkboxes to select one or more items you want to assign
3. A button will appear showing: **"Assign to WO (X)"** where X is the number of selected items

### Step 2: Choose a Work Order

1. Click the **"Assign to WO"** button
2. A dialog will open showing all active work orders (pending, scheduled, in progress)
3. Search by:
   - Work order number
   - Customer name
   - Job type
   - Job description
4. Click on a work order to select it

### Step 3: Set Quantities

1. After selecting a work order, you'll see all selected items
2. Set the quantity needed for each item (default is 1)
3. The system shows:
   - Current available quantity
   - Warning if quantity exceeds available stock
   - Item location for easy warehouse picking

### Step 4: Confirm Assignment

1. Click **"Assign to Work Order"** button
2. All items will be added to the work order with status "planned"
3. Work order totals are automatically updated
4. Inventory remains available until materials are allocated

## Key Features

### Smart Work Order Selection
- Only shows active work orders (excludes completed/cancelled)
- Displays work order status, priority, and current item count
- Shows customer information and job details
- Real-time search across all work order fields

### Inventory Awareness
- Shows available quantity for each item
- Warns if requested quantity exceeds stock
- Displays warehouse location for easy picking
- Multiple items can be assigned at once

### Flexible Quantities
- Set different quantities for each item
- Quick quantity input with validation
- Minimum quantity of 1
- Visual warnings for low stock situations

### Automatic Updates
- Work order material list updated automatically
- Quote totals recalculated with new materials
- Success notification with summary
- Selected items are cleared after assignment

## Workflow Example

**Scenario:** Electrician calls from job site needing materials

1. **Quick Selection:**
   - Open inventory on phone or computer
   - Search for "wire 12"
   - Select the 12/2 NM-B wire
   - Search for "box"
   - Select junction boxes
   - Select outlet boxes

2. **Assign to Job:**
   - Click "Assign to WO (3)"
   - Search for work order "WO-2024-0045"
   - Click the work order

3. **Set Quantities:**
   - Wire: 250 feet
   - Junction boxes: 5
   - Outlet boxes: 10

4. **Confirm:**
   - Click "Assign to Work Order"
   - Done! Work order updated

5. **Warehouse Pulls Materials:**
   - Open work order detail
   - See all planned materials with locations
   - Allocate materials when ready to ship

## Technical Details

### Components

**AssignToWorkOrderDialog.js**
- Handles work order selection
- Manages quantity inputs
- Performs bulk assignment
- Provides real-time feedback

**Updated InventoryList.js**
- Added row selection tracking
- "Assign to WO" button (conditional)
- Selection state management
- Success/error handling

### API Integration

Uses existing endpoints:
- `GET /work-orders` - Fetch active work orders
- `POST /work-orders/{id}/add-material` - Assign each item

### Material Status Flow

1. **Planned** - Added to work order, not allocated
2. **Allocated** - Pulled from warehouse inventory
3. **Returned** - Returned to warehouse (if unused)

## Benefits

### Time Savings
- No need to open each work order individually
- Bulk assign multiple items at once
- Quick search and selection

### Accuracy
- See available stock before assigning
- Visual warnings prevent over-allocation
- Locations shown for easy picking

### Flexibility
- Assign materials as soon as they're identified
- Inventory not locked until allocation
- Easy to adjust quantities

### Mobile Friendly
- Full-screen dialog on phones
- Touch-optimized interface
- Large buttons and inputs
- Clear visual feedback

## Tips

1. **Use Search:** Quickly find work orders by customer name or WO number
2. **Check Stock:** Review available quantities before assigning
3. **Bulk Assign:** Select all needed items at once for efficiency
4. **Plan Ahead:** Add materials to work orders even if not ready to pull yet
5. **Location Info:** Note the warehouse location for faster picking

## Future Enhancements

Potential additions:
- [ ] Assign from low stock view
- [ ] Suggest commonly used items for job types
- [ ] Quick assign recent work orders
- [ ] Batch assign to multiple work orders
- [ ] Save item sets for common jobs

---

## Quick Reference

### Shortcuts

| Action | Method |
|--------|--------|
| Select all visible items | Click header checkbox |
| Search work orders | Type in search field |
| Change quantity | Click quantity field |
| Clear selection | Close dialog or complete assignment |

### Status Indicators

| Color | Meaning |
|-------|---------|
| Blue (Info) | Scheduled work order |
| Orange (Primary) | In progress work order |
| Gray (Default) | Pending work order |
| Green | Sufficient stock available |
| Red | Warning - exceeds available stock |

---

**Created:** December 2024
**Version:** 1.0
**Status:** ✅ Production Ready
