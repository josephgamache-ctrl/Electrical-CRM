# Pem2 Services Inventory - User Guide

## 📱 Quick Start

### Accessing the System

**Web Browser (Desktop/Laptop):**
- Go to: https://inventory.pem2services.com
- Works best in: Chrome, Firefox, Safari, or Edge

**Mobile Phone:**
- Open browser (Chrome, Safari)
- Go to same URL: https://inventory.pem2services.com
- For quick access: Add to home screen
  - **iPhone**: Tap Share → Add to Home Screen
  - **Android**: Tap Menu → Add to Home Screen

### Logging In

1. Enter your username
2. Enter your password
3. Click "Sign In"

**Forgot Password?** Contact your system administrator.

---

## 👥 User Roles

### Administrator
- **Can do everything**: Full system access
- Sees: Inventory, Jobs, Work Orders with pricing, User Management
- Use for: Business owners, office managers

### Manager
- **Most features**: Inventory and job management
- Sees: Inventory, Jobs, Work Orders with pricing
- Use for: Project managers, supervisors

### Office
- **Office tasks**: Inventory and job tracking
- Sees: Inventory, Jobs, Work Orders with pricing
- Use for: Office staff, schedulers

### Technician
- **Field work**: Job-focused view without pricing
- Sees: Inventory, Jobs (simplified view)
- Use for: Field technicians, installers

---

## 📦 Inventory Management

### Viewing Inventory

**Desktop:**
- All items displayed in sortable table
- Click column headers to sort
- Use search box to find items quickly

**Mobile:**
- Swipe to see all columns
- Tap item to see full details

### Search & Filter

**Search Box:**
- Type part number: "SW-100"
- Type description: "outlet"
- Type manufacturer: "Leviton"

**Category Filter:**
- Click category dropdown
- Select: Fixtures, Wiring, Tools, etc.
- Select "All Categories" to clear

**Stock Level Filter:**
- "All Items" - everything
- "In Stock" - available items
- "Low Stock" - items below reorder point
- "Out of Stock" - zero quantity

### Understanding Stock Indicators

- 🟢 **Green background**: Good stock (above reorder point)
- 🟡 **Yellow "Low Stock" chip**: Below reorder point
- 🔴 **Red highlight**: Out of stock (zero quantity)

### Adding Inventory Items

**Who can do this:** Admin, Manager, Office

**Steps:**
1. Click "+ Add Item" button (top right)
2. Fill in required fields:
   - **Part Number**: Your internal SKU
   - **Description**: What the item is
   - **Category**: Select from dropdown
   - **Unit Cost**: What you paid
   - **Unit Price**: What you charge
   - **Quantity on Hand**: Current stock
   - **Reorder Point**: Minimum before reorder
3. Optional fields:
   - Manufacturer
   - Location
   - Notes
4. Click "Add Item"

**Tips:**
- Use consistent part numbering (e.g., SW-100, SW-101)
- Be specific in descriptions
- Set realistic reorder points

### Editing Inventory

**Steps:**
1. Find the item in list
2. Click the ✏️ **Edit** icon
3. Make your changes
4. Click "Update Item"

### Quick Stock Adjustment

**For rapid counts/updates:**

1. Click "Quick Adjust" button
2. Find item in list
3. Enter new quantity
4. Click check mark ✓
5. Item updates immediately

**Use for:**
- Physical inventory counts
- Receiving shipments
- Quick corrections

### Downloading Inventory

**Export to Excel/CSV:**

1. Optionally filter items first
2. Click "Download CSV" button
3. Open in Excel or Google Sheets

**Use for:**
- Inventory reports
- Ordering from suppliers
- Backup records
- Accounting integration

---

## 📋 Work Orders (Admin/Manager/Office View)

### Viewing Work Orders

**Work Order List:**
- All jobs in one place
- Color-coded by status
- Search by customer or job number

**Status Filters:**
- **Not Started**: New jobs
- **In Progress**: Active jobs
- **Completed**: Finished jobs
- **Invoiced**: Billed to customer

### Creating Work Orders

**Who can do this:** Admin, Manager, Office

**Steps:**
1. Click "+ Create Work Order" button
2. Fill in details:
   - **Work Order Number**: Auto-generated or custom
   - **Customer Name**: First and Last
   - **Service Address**: Job location
   - **Phone**: Customer contact
   - **Description**: What work needs to be done
   - **Status**: Usually "Not Started" for new jobs
   - **Scheduled Date**: When job is planned
3. Click "Create"

**Tips:**
- Include detailed job description
- Add special instructions in description
- Set realistic schedule dates

### Assigning Materials to Jobs

**This is the key feature that tracks costs!**

**Steps:**
1. Open a work order
2. Click "Assign Materials" button
3. Search for the item you need
4. Select item from dropdown
5. Enter quantity
6. Click "Assign"

**What happens:**
- Material is added to job
- Quantity deducted from inventory
- Cost automatically calculated
- Job total updates

**Tips:**
- Assign materials as you plan the job
- Review assigned materials before job starts
- Update if actual usage differs

### Removing Materials from Jobs

**If materials were assigned by mistake:**

1. Find material in job's material list
2. Click ❌ **Remove** button
3. Confirm removal

**What happens:**
- Material removed from job
- Quantity returned to inventory
- Cost removed from job total

### Editing Work Orders

**Steps:**
1. Open work order
2. Click ✏️ **Edit** button
3. Update fields
4. Click "Save Changes"

**What you can edit:**
- Customer information
- Service address
- Description
- Status
- Scheduled date

### Work Order Material Costs

**View costs by:**
- **Individual items**: Cost per material
- **Category totals**: Grouped by type
- **Job total**: Complete material cost

**Use for:**
- Job costing
- Customer invoicing
- Profit margin analysis
- Future job estimating

---

## 💼 Jobs View (Technician Focus)

### What's Different in Jobs View?

**Simplified for field work:**
- ✅ No pricing information
- ✅ Focus on job tasks
- ✅ Mobile-optimized
- ✅ Quick actions

**Who uses this:** Primarily technicians

### Job List

**Desktop:**
- Table view with all jobs
- Status filter dropdown
- Search by customer/address

**Mobile:**
- Card view (one job per card)
- Easy to read in field
- Tap to open details

### Job Details

**What you see:**
- 📞 **Customer Name**: Tap to call
- 📍 **Service Address**: With Navigate button
- 📝 **Job Description**: What needs to be done
- 📦 **Materials Assigned**: What you should have
- 📸 **Photos**: Job documentation
- 📋 **Notes**: Job updates and communication

### Calling Customer

**On mobile:**
1. Tap customer name
2. Phone app opens
3. Number ready to dial

**On desktop:**
- Shows phone number
- Click to copy

### Navigating to Job

**The Navigate Button:**

**On mobile:**
1. Tap "Navigate" button
2. Maps app opens (Google Maps or Apple Maps)
3. Directions to job site

**On desktop:**
- Opens Google Maps in browser

**Use for:**
- Finding job location
- Getting directions
- Estimated arrival time

### Pulling Materials

**When you need materials for the job:**

1. Click "Pull Materials" button
2. Search for item in inventory
3. Select item
4. Enter quantity needed
5. Click "Pull Material"

**What happens:**
- Material assigned to your job
- Inventory quantity decreases
- Material appears in your job list

**When to use:**
- Forgot to pre-assign materials
- Need additional materials on site
- Job scope changed

**Important:**
- Only pull what you actually need
- Check inventory has enough stock
- Return unused materials!

### Returning Materials

**If materials aren't used:**

1. Find material in job's material list
2. Click "Return" button
3. Material goes back to inventory

**Why this matters:**
- Keeps inventory accurate
- Prevents material loss
- Helps with job costing
- Makes materials available for other jobs

**Always return:**
- Unused materials
- Wrong items pulled
- Extras not needed

### Taking Photos

**Document the job with photos:**

**On mobile:**
1. Click "Take Photo" or "Add Photo"
2. Camera opens
3. Take picture
4. Photo uploads automatically

**On desktop:**
1. Click "Add Photo"
2. Select file from computer
3. Upload

**What to photograph:**
- Before/after shots
- Problem areas
- Completed work
- Equipment installed
- Customer approvals

**Tips:**
- Photos stay with job forever
- Helpful for callbacks
- Proof of work
- Warranty documentation

### Adding Notes

**Document job details:**

1. Click "Add Note" button
2. Type your note
3. Click "Add"

**What to note:**
- Issues found
- Work completed
- Customer requests
- Follow-up needed
- Parts ordered

**Tips:**
- Be specific
- Include times if relevant
- Note anything unusual
- Good for team communication

---

## 👤 User Management (Admin Only)

### Viewing Users

**User List shows:**
- Username
- Full name
- Role (color-coded)
- Active status

**Role Colors:**
- 🔴 **Admin**: Red
- 🔵 **Manager**: Blue
- 🟢 **Office**: Green
- 🟡 **Technician**: Yellow

### Creating User Accounts

**Steps:**
1. Click "Add User" button
2. Fill in:
   - **Username**: Login name (no spaces)
   - **Password**: Temporary password
   - **Full Name**: Employee's name
   - **Role**: Select appropriate level
3. Click "Create User"

**Tips:**
- Use first name as username
- Give strong temporary password
- Tell employee to remember password
- Assign lowest role needed

### Editing Users

**What you can change:**
- Full name (if misspelled)
- Role (promote/demote)
- Password (if forgotten)
- Active status (disable access)

**Steps:**
1. Click ✏️ **Edit** on user
2. Make changes
3. Click "Update"

### Deactivating Users

**When employee leaves:**

1. Click 🗑️ **Delete** button
2. Confirm deactivation

**What happens:**
- User can't log in
- Data remains in system
- Can reactivate later if needed

**Don't delete users:** It keeps history intact

---

## 💡 Tips & Best Practices

### For Administrators

**Daily:**
- ✅ Check low stock alerts
- ✅ Review new jobs
- ✅ Monitor job progress

**Weekly:**
- ✅ Review inventory levels
- ✅ Export inventory for ordering
- ✅ Check completed jobs for invoicing

**Monthly:**
- ✅ Physical inventory count
- ✅ Review user accounts
- ✅ Analyze material costs

### For Technicians

**Start of Day:**
- ✅ Review assigned jobs
- ✅ Check materials are pulled
- ✅ Get directions to first job

**At Job Site:**
- ✅ Take before photos
- ✅ Note any issues found
- ✅ Pull additional materials if needed
- ✅ Return unused materials
- ✅ Take after photos
- ✅ Add completion notes

**End of Day:**
- ✅ Update job statuses
- ✅ Return unused materials
- ✅ Add any important notes

### Inventory Best Practices

1. **Count regularly**: Monthly physical counts
2. **Update immediately**: When receiving stock
3. **Set accurate reorder points**: Avoid stockouts
4. **Use categories**: Makes finding items easier
5. **Consistent naming**: Standard part numbers
6. **Return unused materials**: Keep inventory accurate

### Job Documentation

1. **Photos are invaluable**: Take lots of them
2. **Before and after**: Show the work done
3. **Note issues**: Document problems found
4. **Update status**: Keep job progress current
5. **Detailed descriptions**: Help future reference

---

## 🆘 Troubleshooting

### Can't Log In

**Try:**
1. Check username spelling
2. Check password (case-sensitive)
3. Try different browser
4. Clear browser cache
5. Contact administrator for password reset

### Can't Find Item in Inventory

**Check:**
1. Spelling in search box
2. Category filter (set to "All Categories")
3. Item might be out of stock
4. Check if item exists (ask administrator)

### Material Won't Assign to Job

**Possible reasons:**
1. Not enough stock in inventory
2. Item doesn't exist
3. Already assigned maximum quantity
4. Check internet connection

### Photos Won't Upload

**Try:**
1. Check internet connection
2. Make sure photo is < 20MB
3. Try different photo
4. Reload page and try again
5. Contact administrator if persists

### Page is Slow

**Try:**
1. Close other browser tabs
2. Clear browser cache
3. Check internet speed
4. Try different browser
5. Reload page

### Made a Mistake

**Don't panic:**
- Most actions can be undone
- Edit work orders if needed
- Return materials if wrong quantity
- Remove and re-add items
- Contact administrator for help

---

## 📞 Getting Help

### Contact Your Administrator

**For:**
- Password resets
- Account issues
- Permission questions
- Training requests
- Feature questions

### Technical Support

**If system is down or broken:**
- Contact system administrator immediately
- Describe what you were doing
- Note any error messages
- Try basic troubleshooting first

---

## 🎓 Training Resources

### Quick Reference Cards

**Coming soon:**
- Technician quick guide (printable)
- Inventory cheat sheet
- Common tasks checklist

### Video Tutorials

**Request from administrator:**
- Screen recordings
- Step-by-step videos
- Mobile app walkthrough

---

## ✅ Quick Actions Cheat Sheet

### Inventory
- **Add Item**: + Add Item button
- **Edit Item**: ✏️ Edit icon
- **Quick Adjust**: Quick Adjust button
- **Download**: Download CSV button
- **Search**: Type in search box
- **Filter**: Use dropdowns

### Work Orders
- **Create**: + Create Work Order
- **Open**: Click on work order
- **Assign Material**: Assign Materials button
- **Edit**: ✏️ Edit button
- **Update Status**: Edit work order

### Jobs (Technician)
- **View Job**: Tap job card
- **Call Customer**: Tap customer name
- **Navigate**: Navigate button
- **Pull Material**: Pull Materials button
- **Return Material**: Return button
- **Add Photo**: Take Photo button
- **Add Note**: Add Note button

---

**Need more help? Ask your administrator for personalized training!**
