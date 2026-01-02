# Pem2 Services Inventory - Administrator Guide

## 🎯 Your Role as Administrator

As an administrator, you have full control over the system. This guide covers your specific responsibilities and how to manage the system effectively.

---

## 👥 User Management

### Creating User Accounts (Monday - Employee Onboarding)

**After Monday's meeting, you'll have employee list. Here's how to set them up:**

**Steps for each employee:**

1. Navigate to **Admin → User Management**
2. Click **"+ Add User"** button
3. Fill in details:
   - **Username**: Use their first name (lowercase, no spaces)
     - Example: `john` for John Smith
   - **Password**: Create a strong temporary password
     - Example: `Pem2Temp2024!`
   - **Full Name**: Employee's full name
     - Example: `John Smith`
   - **Role**: Assign based on position (see below)
4. Click **"Create User"**
5. Write down username and password
6. Give credentials to employee in person

### Role Assignment Guide

**Admin (Red badge):**
- **Who**: Business owners, general managers
- **Can see**: Everything including financials
- **Can do**: All actions, user management
- **Assign to**: You, owner, office manager

**Manager (Blue badge):**
- **Who**: Project managers, lead technicians
- **Can see**: Inventory, jobs, work orders with pricing
- **Can do**: Everything except user management
- **Assign to**: Supervisors, senior staff

**Office (Green badge):**
- **Who**: Office staff, schedulers
- **Can see**: Inventory, jobs, work orders with pricing
- **Can do**: Create jobs, manage inventory, assign materials
- **Assign to**: Administrative staff

**Technician (Yellow badge):**
- **Who**: Field technicians, installers
- **Can see**: Jobs (simplified), inventory
- **Can do**: Pull/return materials, add photos/notes
- **Cannot see**: Pricing, financial information
- **Assign to**: Field workers

**Best Practice:** Assign the minimum role needed. You can always promote later.

### Employee Setup Checklist

For Monday's meeting:

```
□ Get complete employee list with:
  - Full names
  - Roles/positions
  - Phone numbers (optional but helpful)

□ Create user accounts for each employee

□ Write down credentials:
  Employee: _________ Username: _________ Password: _________
  Employee: _________ Username: _________ Password: _________
  Employee: _________ Username: _________ Password: _________

□ Schedule training session (recommend 2 hours)

□ Prepare demo/walkthrough for each role type
```

### Editing User Accounts

**Change role:**
1. Click ✏️ **Edit** on user
2. Select new role from dropdown
3. Click **"Update User"**
4. Changes take effect on next login

**Reset password (when employee forgets):**
1. Click ✏️ **Edit** on user
2. Enter new password
3. Click **"Update User"**
4. Give new password to employee

**Deactivate user (when employee leaves):**
1. Click 🗑️ **Delete** button
2. Confirm deactivation
3. User cannot log in anymore
4. All their data remains in system

**Reactivate user:**
1. Currently shows as inactive
2. Edit user and change status if needed
3. Contact technical support for assistance

---

## 📦 Inventory Management

### Setting Up Initial Inventory

**Option 1: Manual Entry**
1. Click **"+ Add Item"**
2. Enter each item's details
3. Set realistic reorder points
4. Organize by categories

**Option 2: CSV Import**
1. Prepare Excel/CSV file with columns:
   - part_number
   - description
   - category
   - unit_cost
   - unit_price
   - quantity_on_hand
   - reorder_point
2. Use CSV Upload feature (if available)
3. Review imported items
4. Make corrections as needed

### Inventory Best Practices

**Organize with categories:**
- Fixtures
- Wiring
- Electrical Boxes
- Conduit & Fittings
- Tools
- Fasteners & Hardware
- Safety Equipment
- Lighting
- Panels & Breakers
- Specialty Items

**Set reorder points strategically:**
- High-use items: Set higher reorder points
- Slow-movers: Lower reorder points
- Critical items: Don't let them run out
- Seasonal items: Adjust quarterly

**Pricing strategy:**
- **Unit Cost**: What you paid wholesale
- **Unit Price**: What you charge customers
- Maintain markup consistency (typically 30-100%)
- Review pricing quarterly

**Part numbering:**
- Use consistent format (e.g., CAT-001, CAT-002)
- Include category prefix
- Keep it simple
- Document your system

### Monitoring Low Stock

**Daily check:**
1. Look for yellow "Low Stock" warnings
2. Review items below reorder point
3. Create purchase orders as needed

**Set up routine:**
- Monday morning: Check low stock
- Generate reorder list
- Submit orders to suppliers
- Update quantities when stock arrives

### Physical Inventory Counts

**Monthly recommended:**

1. Print current inventory (Download CSV)
2. Count physical stock
3. Use "Quick Adjust" to update quantities
4. Investigate large discrepancies
5. Update reorder points if needed

**Annual deep dive:**
- Complete wall-to-wall count
- Reconcile all discrepancies
- Remove obsolete items
- Update pricing
- Adjust categories

---

## 📋 Work Order Management

### Creating Work Orders

**Best practices:**

**Complete information:**
- Customer full name and contact
- Detailed service address (include unit/apt numbers)
- Clear job description
- Realistic schedule date

**Job descriptions should include:**
- Type of work (installation, repair, upgrade)
- Specific requirements
- Special customer requests
- Access information

**Status workflow:**
1. **Not Started**: New job, not yet scheduled
2. **In Progress**: Technician working on it
3. **Completed**: Work done, awaiting invoice
4. **Invoiced**: Billed to customer

### Assigning Materials (Pre-Job Planning)

**Before technician goes to job:**

1. Open work order
2. Review job description
3. Click "Assign Materials"
4. Add all materials needed:
   - Materials from job scope
   - Common consumables
   - Safety items
   - Extras (10% buffer)

**Benefits:**
- Technician knows what to bring
- Materials reserved for job
- Accurate cost estimate
- Better inventory control

**Example for "Install 3 outlets":**
- 3x Outlet (15A, 125V)
- Wire nuts (assorted)
- Electrical tape
- Wire (appropriate gauge)
- Cover plates
- Mounting screws

### Monitoring Job Costs

**Track material costs:**
- View by category (Fixtures, Wiring, etc.)
- Compare to estimate
- Identify cost overruns
- Use for future estimates

**Monthly review:**
- Export completed jobs
- Calculate material costs per job
- Compare costs to revenue
- Identify profit margins
- Adjust pricing if needed

### Job Completion Checklist

**Before marking "Invoiced":**

□ Work completed (check with technician)
□ Photos documented
□ All materials assigned/returned
□ Notes reviewed
□ Customer satisfied
□ Ready for billing

---

## 📊 Reports & Analysis

### Available Reports

**Inventory Reports:**
1. **Full Inventory** (Download CSV)
   - All items with quantities and values
   - Use for: Accounting, insurance, audits

2. **Low Stock Report** (Filter + Download)
   - Items below reorder point
   - Use for: Purchase orders

3. **Category Analysis** (Filter + Download)
   - Items by category
   - Use for: Budgeting, supplier orders

**Job Reports:**
1. **Material Cost by Job** (Export work orders)
   - See what each job cost
   - Use for: Invoicing, profit analysis

2. **Category Cost by Job**
   - Break down by material type
   - Use for: Understanding cost drivers

### Financial Insights

**Calculate profit margins:**
```
Material Cost: (from system)
Labor Cost: (your records)
Total Cost: Material + Labor
Revenue: (what you billed)
Profit: Revenue - Total Cost
Margin %: (Profit / Revenue) × 100
```

**Track over time:**
- Weekly material costs
- Job profitability
- Inventory value
- Material waste (returned items)

### Using Data for Estimates

**Build estimate templates:**
1. Find similar completed jobs
2. Review material lists
3. Note quantities used
4. Add 10-15% buffer
5. Calculate labor separately
6. Create estimate from template

---

## 🔐 Security & Access Control

### Password Policy

**Recommendations:**
- **Initial passwords**: Strong temporary (change on first use)
- **Minimum length**: 8+ characters
- **Include**: Letters, numbers, special characters
- **Change**: If compromised
- **Never share**: Each employee has own account

### Monitoring User Activity

**Watch for:**
- Unusual material assignments
- Large quantity pulls
- After-hours access (if unusual)
- Account sharing (multiple simultaneous logins)

**If you suspect issues:**
1. Review user's recent actions
2. Speak with employee
3. Change password if needed
4. Deactivate account if necessary

### Data Privacy

**Remember:**
- Customer information is private
- Don't share login credentials
- Log out when not in use
- Don't access from public computers
- Use secure internet connections

---

## 🔄 Daily/Weekly/Monthly Tasks

### Daily (5-10 minutes)

**Morning:**
□ Check low stock alerts
□ Review jobs scheduled for today
□ Check for any system issues

**Throughout Day:**
□ Monitor job progress
□ Answer employee questions
□ Update work order statuses

**End of Day:**
□ Review completed jobs
□ Check inventory accuracy
□ Address any issues

### Weekly (30 minutes)

**Monday:**
□ Review week's schedule
□ Check material needs
□ Create purchase orders

**Wednesday:**
□ Mid-week inventory check
□ Follow up on pending jobs
□ Review any issues

**Friday:**
□ Week in review
□ Export reports if needed
□ Plan next week

### Monthly (1-2 hours)

**First week:**
□ Physical inventory count
□ Reconcile discrepancies
□ Update reorder points

**Mid-month:**
□ Review pricing
□ Analyze job costs
□ Check profit margins

**End of month:**
□ Export financial data
□ Generate reports
□ Review user accounts
□ Clean up completed jobs

### Quarterly (2-3 hours)

□ Deep inventory audit
□ Review all pricing
□ Analyze trends
□ Update categories
□ Remove obsolete items
□ User account cleanup
□ System performance review

---

## 🆘 Common Issues & Solutions

### "Employee forgot password"

**Solution:**
1. User Management → Edit user
2. Enter new temporary password
3. Give to employee in person
4. Have them change it

### "Inventory not matching physical count"

**Possible causes:**
- Materials not returned
- Wrong quantities assigned
- Theft/loss
- Data entry errors

**Solution:**
1. Use Quick Adjust to fix
2. Investigate large discrepancies
3. Remind techs to return materials
4. Do more frequent counts

### "Job costs seem too high"

**Investigation:**
1. Review assigned materials
2. Check for duplicates
3. Verify quantities are correct
4. Look for unreturned materials
5. Compare to similar jobs

**Fix:**
- Remove incorrect items
- Adjust quantities
- Train employees on accuracy

### "Technician can't pull materials"

**Check:**
1. Enough stock in inventory?
2. Correct role assigned?
3. Internet connection working?
4. Item exists in system?

### "System seems slow"

**Try:**
1. Clear browser cache
2. Check internet speed
3. Try different browser
4. Restart browser
5. Contact technical support

---

## 📞 Technical Support

### When to Contact Support

**Immediate (system down):**
- Can't access system at all
- Database errors
- All users locked out
- Data loss suspected

**Soon (within 24 hours):**
- Features not working
- Reports incorrect
- Performance issues
- User access problems

**When convenient:**
- Feature requests
- Training questions
- Best practice advice
- Optimization tips

### What to Include in Support Request

1. **What happened**: Describe the issue
2. **When**: Date and time
3. **Who**: Which user/role
4. **What they did**: Steps that led to problem
5. **Error message**: Exact wording
6. **Screenshots**: If possible

### Support Options

**Included (60 days):**
- Bug fixes
- Basic training
- Usage questions
- Minor adjustments

**Optional ($99/month):**
- Ongoing support
- Feature updates
- Priority assistance
- Monthly check-ins

---

## 🎓 Training Your Team

### Monday Training Session (Recommended: 2 hours)

**Agenda:**

**Part 1: Overview (15 min)**
- System purpose and benefits
- Login and navigation
- Role-based differences

**Part 2: Inventory (20 min)**
- Search and filter
- Understanding stock levels
- Quick adjust (admins only)

**Part 3: Work Orders (30 min)**
- Creating jobs (admins/office)
- Assigning materials
- Viewing job costs

**Part 4: Jobs - Technician View (30 min)**
- Finding jobs
- Job details and navigation
- Pulling materials
- Returning materials
- Photos and notes

**Part 5: Hands-On (20 min)**
- Let employees try
- Answer questions
- Practice scenarios

**Part 6: Questions & Wrap-Up (5 min)**

### Training Tips

**For technicians:**
- Focus on job view
- Emphasize mobile use
- Practice pulling/returning materials
- Show photo documentation
- Keep it simple

**For office staff:**
- Focus on work order creation
- Material assignment workflow
- Report generation
- Customer information

**For managers:**
- Overview of all features
- Job cost analysis
- Inventory management
- Report interpretation

### Follow-Up Training

**Week 2:**
- Check-in with each user
- Answer questions
- Review common mistakes
- Provide tips

**Month 1:**
- Advanced features
- Optimization strategies
- Best practices
- Address pain points

---

## 📈 Growing with the System

### As Your Business Grows

**More employees:**
- Just create more accounts (unlimited)
- Organize by teams/crews
- Consider role hierarchy

**More inventory:**
- Add categories as needed
- Use better organization
- Consider location tracking

**More jobs:**
- Archive old completed jobs
- Export historical data
- Maintain system performance

**New features:**
- Contact developer for custom additions
- Request integrations (QuickBooks, etc.)
- Suggest improvements

---

## ✅ Administrator Success Checklist

**First Week:**
□ All employees have accounts
□ Everyone trained on their role
□ Initial inventory entered
□ First jobs created
□ Materials assigned to jobs
□ Photos being documented

**First Month:**
□ Daily routine established
□ Inventory accuracy >95%
□ All jobs documented
□ Reports being used
□ Team comfortable with system
□ Issues resolved quickly

**First Quarter:**
□ ROI realized (time/money saved)
□ Process optimization
□ Training gaps addressed
□ System fully integrated
□ Team sees value

---

## 💡 Pro Tips for Admins

1. **Lead by example**: Use system consistently yourself
2. **Be patient**: Learning curve is normal
3. **Celebrate wins**: Note time saved, costs tracked
4. **Stay organized**: Keep inventory clean
5. **Regular reviews**: Monthly system health checks
6. **Document processes**: Write down your workflows
7. **Backup important data**: Export reports regularly
8. **Keep learning**: Discover new ways to use features
9. **Listen to feedback**: Employees have good ideas
10. **Stay in touch**: Contact support when needed

---

**You're the key to system success. Your organization and leadership will make this system invaluable to Pem2 Services!**

**Questions? Need help? Contact technical support anytime during your 60-day support period.**
