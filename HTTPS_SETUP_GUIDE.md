# HTTPS Setup Guide for MA Electrical Inventory

## Option 1: Self-Signed Certificate (For Testing Only)

**Use this for development/testing on local network. NOT for production!**

### Step 1: Generate Self-Signed Certificate

```bash
# Create SSL directory
mkdir -p nginx/ssl

# Generate self-signed certificate (valid for 365 days)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/privkey.pem \
  -out nginx/ssl/fullchain.pem \
  -subj "/C=US/ST=Illinois/L=Granite City/O=MA Electrical/CN=localhost"
```

### Step 2: Update nginx.conf

Uncomment the HTTPS server block in `nginx/nginx.conf` (lines 61-90)

### Step 3: Update docker-compose.yml

Add volume mount for SSL certificates to nginx service:

```yaml
  nginx:
    volumes:
      - ./nginx/ssl:/etc/nginx/ssl:ro
```

### Step 4: Restart Services

```bash
docker-compose restart nginx
```

**Note:** Browsers will show a security warning for self-signed certificates. This is expected.

---

## Option 2: Let's Encrypt (Free SSL - For Production)

**Use this for production deployment with a real domain name.**

### Prerequisites:
- A domain name pointing to your server
- Server accessible from the internet on ports 80 and 443

### Step 1: Install Certbot

On your server (not in Docker):

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Or use Docker-based certbot
docker run -it --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/lib/letsencrypt:/var/lib/letsencrypt \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  -d your-domain.com
```

### Step 2: Copy Certificates

```bash
# Copy Let's Encrypt certificates to your project
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/
sudo chown $USER:$USER nginx/ssl/*.pem
```

### Step 3: Update nginx.conf

1. Uncomment the HTTPS server block (lines 61-90)
2. Update `server_name` to your actual domain
3. Uncomment the HTTP to HTTPS redirect (lines 14-19)

### Step 4: Update docker-compose.yml

Add port 443 and SSL volume to nginx:

```yaml
  nginx:
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
```

### Step 5: Restart Services

```bash
docker-compose down
docker-compose up -d
```

### Step 6: Set Up Auto-Renewal

Let's Encrypt certificates expire after 90 days. Set up auto-renewal:

```bash
# Add to crontab
sudo crontab -e

# Add this line (runs renewal check twice daily)
0 0,12 * * * certbot renew --quiet && docker-compose -f /path/to/MA_Electrical_Inventory/docker-compose.yml restart nginx
```

---

## Option 3: Cloudflare (Easiest for Production)

**Recommended for non-technical users with a domain.**

### Step 1: Sign Up for Cloudflare

1. Create account at https://cloudflare.com
2. Add your domain to Cloudflare
3. Update your domain's nameservers to Cloudflare's

### Step 2: Enable SSL/TLS

1. Go to SSL/TLS settings
2. Set SSL/TLS encryption mode to "Full" or "Flexible"
3. Cloudflare will automatically provide HTTPS

### Step 3: (Optional) Use Cloudflare Origin Certificate

For "Full (strict)" mode:

1. Go to SSL/TLS → Origin Server
2. Click "Create Certificate"
3. Download the certificate and private key
4. Save as `nginx/ssl/fullchain.pem` and `nginx/ssl/privkey.pem`
5. Follow Option 2 steps 3-5 above

**Benefits:**
- Free SSL certificate
- DDoS protection
- CDN for faster loading
- No certificate renewal needed

---

## Verification

After setup, test your HTTPS configuration:

1. **Check certificate:**
   ```bash
   curl -I https://your-domain.com
   ```

2. **Test SSL security:**
   - Visit https://www.ssllabs.com/ssltest/
   - Enter your domain
   - Aim for A or A+ rating

3. **Check headers:**
   ```bash
   curl -I https://your-domain.com | grep -E "X-Frame|X-Content|X-XSS|Strict-Transport"
   ```

---

## Troubleshooting

### "Certificate not found" error:
- Check that SSL files exist: `ls -la nginx/ssl/`
- Verify file permissions: `chmod 644 nginx/ssl/*.pem`
- Check docker-compose volumes are mounted correctly

### "Too many redirects" error:
- If using Cloudflare, set SSL/TLS mode to "Full" not "Flexible"
- Ensure HTTP to HTTPS redirect is only in nginx, not both nginx and Cloudflare

### Browser shows "Not secure":
- For self-signed certs, this is normal (click "Advanced" → "Proceed anyway")
- For Let's Encrypt, ensure certificate matches your domain name
- Check certificate hasn't expired: `openssl x509 -in nginx/ssl/fullchain.pem -noout -dates`

---

## Current Status

✅ Security headers added to nginx configuration
⚠️ HTTPS not yet configured - still using HTTP only

**Next Steps:**
1. Choose which option above fits your use case
2. Follow the steps for that option
3. Test HTTPS is working
4. Update frontend API calls to use HTTPS (if using absolute URLs)
