# Mobile Development Guide - Test on Pixel 7

## 🎯 Goal
Develop locally on Windows PC and test live on your Google Pixel 7 for mobile UI fine-tuning.

---

## 🏗️ Architecture Options

### **Option 1: LAN Access (Recommended - Easiest)**
Your PC and Pixel 7 connect via your local WiFi network.

**Pros:**
- ✅ No setup required
- ✅ Fast refresh times
- ✅ Works with Link to Windows
- ✅ Real device testing

**Cons:**
- ⚠️ Must be on same WiFi network
- ⚠️ Need to find your PC's IP address

### **Option 2: Local Dev Server + ngrok (Internet Tunnel)**
Expose localhost via public URL for testing anywhere.

**Pros:**
- ✅ Test from anywhere (not just home WiFi)
- ✅ Share with others for feedback
- ✅ HTTPS support

**Cons:**
- ⚠️ Requires ngrok account (free tier available)
- ⚠️ Slight latency
- ⚠️ URL changes each restart

---

## 🚀 **OPTION 1: LAN Access Setup (Start Here)**

### Step 1: Find Your PC's IP Address

**Method A: Using Command Prompt**
```cmd
ipconfig
```

Look for "IPv4 Address" under your WiFi adapter (usually starts with 192.168.x.x or 10.x.x.x)

**Method B: Using PowerShell**
```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -like "192.168.*"}
```

**Example Output:**
```
IPv4 Address: 192.168.1.160
```

### Step 2: Update Docker Compose for LAN Access

The frontend needs to connect to the backend via your PC's IP instead of localhost.

**Edit `docker-compose.yml`:**

Change the frontend build args from:
```yaml
ma_electrical-frontend:
  build:
    context: ./frontend
    dockerfile: Dockerfile
    args:
      REACT_APP_FRONTEND_URL: http://104.131.49.141:8001  # OLD
```

To your local IP:
```yaml
ma_electrical-frontend:
  build:
    context: ./frontend
    dockerfile: Dockerfile
    args:
      REACT_APP_FRONTEND_URL: http://192.168.1.160:8001  # YOUR PC IP
```

**OR** Just use localhost (nginx will proxy):
```yaml
ma_electrical-frontend:
  build:
    context: ./frontend
    dockerfile: Dockerfile
    # No args needed - nginx.conf handles the proxy
```

### Step 3: Configure Windows Firewall

Allow incoming connections on ports 3001 and 8001:

**Run as Administrator in PowerShell:**
```powershell
# Allow frontend port 3001
New-NetFirewallRule -DisplayName "MA Electrical Frontend" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow

# Allow backend port 8001
New-NetFirewallRule -DisplayName "MA Electrical Backend" -Direction Inbound -Protocol TCP -LocalPort 8001 -Action Allow
```

**OR use the GUI:**
1. Open Windows Firewall
2. Advanced Settings → Inbound Rules → New Rule
3. Port → TCP → 3001, 8001
4. Allow connection → Apply

### Step 4: Test from Your Pixel 7

1. **Connect Pixel 7 to the same WiFi** as your PC
2. **Open Chrome on your phone**
3. **Navigate to:**
   ```
   http://192.168.1.160:3001
   ```
   (Replace with YOUR PC's IP from Step 1)

4. **You should see the login page!**

---

## 🔄 **Live Development Workflow**

### For Quick CSS/UI Changes (No Rebuild Required)

**Option A: Run Frontend Locally (Fast Refresh)**

1. **Stop Docker frontend:**
   ```bash
   docker-compose stop ma_electrical-frontend
   ```

2. **Start local React dev server:**
   ```bash
   cd frontend
   npm start
   ```
   This starts on **http://localhost:3000** with hot-reload

3. **Access from Pixel 7:**
   ```
   http://192.168.1.160:3000
   ```

4. **Make changes to React files:**
   - Edit `frontend/src/components/InventoryList.js`
   - Save file
   - **Phone auto-refreshes in ~2 seconds!** ⚡

**Option B: Docker with Volume Mount (Medium Speed)**

Update `docker-compose.yml` to mount source code:

```yaml
ma_electrical-frontend:
  build:
    context: ./frontend
    dockerfile: Dockerfile.dev  # Use dev Dockerfile
  volumes:
    - ./frontend/src:/app/src:ro  # Mount source for hot reload
  ports:
    - "3001:3000"
```

Create `frontend/Dockerfile.dev`:
```dockerfile
FROM node:20-bullseye
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps
COPY . .
CMD ["npm", "start"]
```

**Rebuilds on file save (10-15 seconds)**

---

## 📱 **Recommended Development Setup**

### **Quick Iteration (Recommended)**

```bash
# Terminal 1: Keep backend running in Docker
cd /c/Users/josep/projects/MA_Electrical_Inventory
docker-compose up ma_electrical-db ma_electrical-backend

# Terminal 2: Run frontend locally for hot-reload
cd frontend
npm start
```

**Access on Pixel 7:**
```
http://192.168.1.160:3000
```

**Workflow:**
1. Edit `frontend/src/components/InventoryList.js`
2. Save file (Ctrl+S)
3. **Phone refreshes automatically in 2 seconds!** ⚡
4. See changes immediately
5. Repeat!

---

## 🎨 **Mobile UI Fine-Tuning Checklist**

### Things to Test on Pixel 7:

**Screen Size:**
- Pixel 7 resolution: 1080 x 2400 pixels
- Test portrait and landscape modes

**Touch Targets:**
- Buttons should be at least 48x48px
- Add spacing between clickable elements

**Responsive Breakpoints:**
```javascript
// In your React components
const isMobile = useMediaQuery(theme.breakpoints.down("md")); // < 900px
const isTablet = useMediaQuery(theme.breakpoints.between("md", "lg")); // 900-1200px
```

**DataGrid on Mobile:**
```javascript
<DataGrid
  rows={inventory}
  columns={isMobile ? mobileColumns : allColumns}  // Fewer columns on mobile
  pageSize={isMobile ? 10 : 25}  // Smaller page size on mobile
  sx={{
    '& .MuiDataGrid-cell': {
      fontSize: isMobile ? '0.875rem' : '1rem',  // Smaller text on mobile
    },
  }}
/>
```

**Quick Stock Buttons (Mobile-First):**
```javascript
<Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
  <Button
    size="large"
    variant="outlined"
    onClick={() => adjustStock(item.id, -5)}
    sx={{ minWidth: 60, minHeight: 60 }}  // Large touch target
  >
    -5
  </Button>
  <Button
    size="large"
    variant="outlined"
    onClick={() => adjustStock(item.id, -1)}
    sx={{ minWidth: 60, minHeight: 60 }}
  >
    -1
  </Button>
  <Button
    size="large"
    variant="contained"
    onClick={() => adjustStock(item.id, +1)}
    sx={{ minWidth: 60, minHeight: 60 }}
  >
    +1
  </Button>
  <Button
    size="large"
    variant="contained"
    onClick={() => adjustStock(item.id, +5)}
    sx={{ minWidth: 60, minHeight: 60 }}
  >
    +5
  </Button>
</Box>
```

---

## 🛠️ **Helpful Chrome DevTools on Desktop**

Before testing on phone, simulate mobile in Chrome:

1. Open **http://localhost:3000** in Chrome
2. Press **F12** (DevTools)
3. Click **Device Toolbar** icon (Ctrl+Shift+M)
4. Select "Pixel 7" from device dropdown
5. Test responsive behavior

**Simulate touch events:**
- DevTools → Settings → Devices → Add custom device
- Enable "Touch" emulation

---

## 🐛 **Troubleshooting Mobile Access**

### Problem: "This site can't be reached" on phone

**Solution 1: Check IP Address**
```bash
# On PC, verify IP hasn't changed
ipconfig
```
DHCP might assign new IP after restart.

**Solution 2: Check Firewall**
```bash
# Test if port is accessible
# On Pixel 7, use Network Tools app or browser:
http://192.168.1.160:3001
```

**Solution 3: Check WiFi Network**
- PC and phone MUST be on same WiFi
- Not guest network vs main network
- Not mobile data on phone

**Solution 4: Restart Services**
```bash
docker-compose restart
```

### Problem: Changes not showing on phone

**Solution 1: Hard Refresh**
- Chrome on Android: Menu → Settings → Clear browsing data → Cached images and files

**Solution 2: Check React Dev Server**
- Terminal should show: "webpack compiled successfully"
- Look for errors in terminal

**Solution 3: Check Browser Console**
- Chrome on Android:
  - Connect phone to PC via USB
  - PC Chrome: `chrome://inspect`
  - Click "Inspect" under your phone's browser

---

## 📊 **Performance Testing on Phone**

### Check Load Times:
1. Open Chrome DevTools on PC
2. Connect phone via USB
3. Go to `chrome://inspect` on PC
4. Inspect phone browser
5. Network tab → Reload page

**Target Metrics:**
- First paint: < 1.5 seconds
- Interactive: < 3 seconds
- Smooth 60fps scrolling

### Optimize for Mobile:
```javascript
// Lazy load images
<img src={item.image_url} loading="lazy" />

// Reduce bundle size
// Use dynamic imports for large components
const BarcodeScanner = lazy(() => import('./BarcodeScanner'));

// Compress images
// Use WebP format
// Serve scaled images (don't send 4K to mobile)
```

---

## 🔒 **Security Note**

When testing on LAN:
- ✅ Safe for local network (home WiFi)
- ⚠️ Don't expose to public internet without HTTPS
- ⚠️ Use VPN if accessing from outside home

---

## 📝 **Quick Reference Card**

**Save this for daily use:**

```bash
# START DEVELOPMENT SESSION
# =========================

# Terminal 1: Backend
cd /c/Users/josep/projects/MA_Electrical_Inventory
docker-compose up ma_electrical-db ma_electrical-backend

# Terminal 2: Frontend (hot-reload)
cd frontend
npm start

# Access on Phone:
# http://192.168.1.160:3000

# Make changes → Save → Phone refreshes automatically!

# When done:
# Ctrl+C in both terminals
# docker-compose down
```

---

## 🎯 **Next Steps After Setup**

1. **Create mobile-optimized components:**
   - `frontend/src/components/QuickStockAdjuster.js`
   - `frontend/src/components/MobileInventoryCard.js`
   - `frontend/src/components/BarcodeScanner.js`

2. **Add bottom navigation for mobile:**
   ```javascript
   <BottomNavigation>
     <BottomNavigationAction label="Inventory" icon={<Inventory />} />
     <BottomNavigationAction label="Quick Stock" icon={<Add />} />
     <BottomNavigationAction label="Scanner" icon={<CameraAlt />} />
     <BottomNavigationAction label="Settings" icon={<Settings />} />
   </BottomNavigation>
   ```

3. **Test all features on Pixel 7:**
   - Login
   - View inventory
   - Search
   - Filter low stock
   - Sort columns
   - Edit items (when implemented)

---

## 💡 **Pro Tips**

1. **Keep phone plugged in** during testing (heavy browser use drains battery)

2. **Use Chrome Remote Debugging:**
   - PC Chrome: `chrome://inspect`
   - See phone's console logs on PC screen
   - Debug JavaScript errors

3. **Add viewport meta tag** (already in index.html):
   ```html
   <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
   ```

4. **Use React DevTools on Phone:**
   - Install "React Developer Tools" Chrome extension
   - Works in remote debugging

5. **Screen Recording for Bug Reports:**
   - Pixel 7: Swipe down → Screen Record
   - Record issues to show developer

---

**Ready to start mobile development!** 📱

Follow the "Quick Iteration" workflow above for the fastest development experience.
