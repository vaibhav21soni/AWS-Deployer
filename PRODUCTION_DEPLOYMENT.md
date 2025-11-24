# Production Deployment Guide

## Domain Deployment

When deploying to a domain (e.g., `deployer.yourdomain.com`), follow these steps:

### 1. Update Environment Variables

Edit your `.env` file:

```bash
# Domain Configuration
DOMAIN=deployer.yourdomain.com

# Update CORS to include your domain
CORS_ORIGINS=https://deployer.yourdomain.com,http://localhost:5174

# For production, you may want to change ports
FRONTEND_PORT=80
BACKEND_PORT=8000
```

### 2. Update Nginx Configuration

Edit `frontend/nginx.conf` and update the `server_name`:

```nginx
server {
    listen 80;
    server_name deployer.yourdomain.com;  # Change this to your domain
    # ... rest of config
}
```

### 3. SSL/HTTPS Setup (Recommended)

For production, use SSL with Let's Encrypt:

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d deployer.yourdomain.com

# Certbot will automatically update your nginx config
```

### 4. DNS Configuration

Point your domain to your server:

```
A Record: deployer.yourdomain.com -> YOUR_SERVER_IP
```

### 5. Firewall Configuration

Ensure ports are open:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 6. Deploy

```bash
docker compose down
docker compose up --build -d
```

## Production Checklist

- [ ] Domain DNS configured
- [ ] SSL certificate installed
- [ ] Environment variables updated
- [ ] Nginx server_name updated
- [ ] CORS origins include production domain
- [ ] Firewall configured
- [ ] Docker containers running
- [ ] Test application at https://yourdomain.com

## Reverse Proxy Alternative

If you prefer using a reverse proxy (like Caddy or Traefik), you can:

1. Keep nginx serving on internal ports
2. Use the reverse proxy to handle SSL and domain routing
3. Point reverse proxy to `http://localhost:5174` (frontend) and `http://localhost:8001` (backend API)
