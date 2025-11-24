# AWS EC2 Auto-Deployer

A full-stack application to provision EC2 instances and deploy Dockerized applications automatically with environment-based configuration and production-ready setup.

## Features

- **Provision EC2**: Create EC2 instances with custom configurations (OS type, instance type, ports)
- **Auto-Configuration**: Automatically installs Docker and dependencies on new instances
- **Multi-Repository Support**: Clone and deploy multiple Git repositories per instance
- **Per-Repo Configuration**: Individual Docker Compose, frontend, and backend paths for each repository
- **Interactive Terminal**: Execute commands directly on deployed instances
- **File Editor**: Read and write files remotely on instances
- **Git Pull & Restart**: Update and restart applications with one click
- **Scheduled Termination**: Auto-terminate instances after a set time to save costs
- **Environment-Based Config**: All settings configurable via `.env` files
- **Production Ready**: Domain support with SSL/HTTPS configuration
- **Real-time Logs**: View deployment logs in real-time

---

## Quick Start with Docker

### 1. Clone and Setup

```bash
git clone <your-repo-url>
cd aws-deployer

# Copy environment template
cp .env.example .env

# Edit .env with your preferred settings (optional)
nano .env
```

### 2. Start the Application

```bash
docker compose up -d
```

### 3. Access the Application

- **Frontend**: http://localhost:5174
- **Backend API**: http://localhost:8001
- **API Docs**: http://localhost:8001/docs

---

## Project Structure

```
aws-deployer/
├── backend/              # FastAPI backend
│   ├── services/         # AWS, SSH, Git, File operations
│   ├── main.py           # API endpoints
│   ├── requirements.txt  # Python dependencies
│   └── Dockerfile        # Backend container
├── frontend/             # React + Vite frontend
│   ├── src/              # React components
│   ├── nginx.conf        # Nginx proxy configuration
│   ├── Dockerfile        # Production build
│   └── Dockerfile.dev    # Development build
├── docker-compose.yml    # Container orchestration
├── .env.example          # Environment template
└── .gitignore            # Git ignore rules
```

---

## Environment Configuration

### Available Variables

Edit `.env` to customize:

```bash
# Port Configuration
BACKEND_PORT=8001          # Host port for backend API
FRONTEND_PORT=5174         # Host port for frontend

# AWS Configuration (Optional - can be provided via UI)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1

# Backend Configuration
BACKEND_HOST=0.0.0.0
BACKEND_INTERNAL_PORT=8000
LOG_LEVEL=INFO
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:5174

# Frontend Configuration
VITE_API_URL=/api

# Domain Configuration (for production)
DOMAIN=
```

### Important Notes

- **AWS credentials** can be left empty in `.env` and provided through the UI
- **Port changes** require rebuilding: `docker compose up --build -d`
- **CORS origins** should include all frontend URLs you'll access from
- `.env` files are gitignored - never commit credentials!

---

## Usage Guide

### 1. Configure AWS Credentials

Enter your AWS Access Key and Secret Key in the UI, or set them in `.env`:

```bash
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=us-east-1
```

### 2. Create EC2 Instance

- Select **OS Type** (Ubuntu 22.04 or Amazon Linux 2)
- Choose **Instance Type** (t2.micro, t2.small, etc.)
- Configure **Allowed Ports** (comma-separated: `80, 443, 22, 3000, 8000`)
- Click **Create EC2 Instance**

### 3. Add Repositories

For each repository you want to deploy:

- **Git URL**: Repository URL (HTTPS)
- **Branch**: Branch name (default: `main`)
- **Clone Path**: Destination directory (e.g., `backend`, `frontend`, `.`)
- **Git Token**: Personal access token for private repos (optional)

**Docker Configuration** (per repository):
- **Docker Compose Directory**: Path to `docker-compose.yml` (default: `.`)
- **Frontend Path**: Frontend Dockerfile context (optional)
- **Backend Path**: Backend Dockerfile context (optional)

### 4. Deploy

- Click **Clone** to clone the repository
- Click **Deploy** to start the application with Docker Compose
- Click **Pull & Restart** to update and restart

### 5. Interactive Features

**Terminal**:
- Execute commands directly on the instance
- View command output in real-time
- Full screen mode available

**File Editor**:
- Read files: Enter path and click "Read File"
- Edit files: Modify content and click "Save File"
- Useful for editing `.env` files or configs

### 6. Scheduled Termination

- Enter minutes (e.g., `60` for 1 hour)
- Click **Schedule Stop**
- Instance will auto-terminate after the specified time
- Or click **Terminate** for immediate termination

---

## Production Deployment

### Domain Setup

1. **Update Environment**:

```bash
# .env
DOMAIN=deployer.yourdomain.com
CORS_ORIGINS=https://deployer.yourdomain.com
FRONTEND_PORT=80
BACKEND_PORT=8000
```

2. **Update Nginx Configuration**:

Edit `frontend/nginx.conf`:

```nginx
server {
    listen 80;
    server_name deployer.yourdomain.com;  # Change this
    # ... rest of config
}
```

3. **DNS Configuration**:

Point your domain to your server:

```
A Record: deployer.yourdomain.com -> YOUR_SERVER_IP
```

4. **SSL/HTTPS Setup** (Recommended):

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d deployer.yourdomain.com
```

5. **Firewall Configuration**:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

6. **Deploy**:

```bash
docker compose down
docker compose up --build -d
```

### Production Checklist

- [ ] Domain DNS configured
- [ ] SSL certificate installed
- [ ] Environment variables updated
- [ ] Nginx server_name updated
- [ ] CORS origins include production domain
- [ ] Firewall configured
- [ ] Docker containers running
- [ ] Test application at https://yourdomain.com

---

## Git Repository Setup

### Initial Setup

The repository is already initialized with a comprehensive `.gitignore` that protects:

- ✅ Environment files (`.env`)
- ✅ Dependencies (`node_modules/`, `venv/`)
- ✅ Build artifacts (`dist/`, `build/`)
- ✅ Private keys and certificates (`*.pem`, `*.key`)
- ✅ IDE and OS files (`.vscode/`, `.DS_Store`)

### Push to Remote

```bash
# Add your remote repository
git remote add origin https://github.com/yourusername/aws-deployer.git

# Push to GitHub/GitLab
git branch -M main
git push -u origin main
```

### Verify Protected Files

```bash
# Check what files are ignored
git status --ignored

# Verify .env is ignored
git check-ignore .env
```

**Important**: Never commit `.env` files with real credentials!

---

## Architecture

### Request Flow

```
Browser (localhost:5174)
    ↓
Frontend (nginx:80)
    ├─ Serves static React app
    └─ Proxies /api/* → Backend
                          ↓
                    Backend (uvicorn:8000)
                          ├─ AWS EC2 operations
                          ├─ SSH/deployment
                          ├─ Git operations
                          └─ File operations
```

### Why This Works

1. **Single Origin**: Browser only talks to `localhost:5174`
2. **No CORS Issues**: All requests appear from same origin
3. **Production Ready**: Same pattern works with domains
4. **Secure**: Backend not directly exposed to browser

When you make a request to `/api/create-ec2`:
1. Browser sends: `GET http://localhost:5174/api/create-ec2`
2. Nginx receives and matches `/api/` location block
3. Nginx proxies to: `http://backend:8000/create-ec2` (strips `/api` prefix)
4. Backend responds
5. Nginx sends response back to browser

---

## Development

### Local Development (without Docker)

**Backend**:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend**:
```bash
cd frontend
npm install
npm run dev
```

### Using Development Dockerfile

For frontend development with hot reload:

```bash
# Update docker-compose.yml to use Dockerfile.dev
docker compose up --build -d
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
```

### Rebuild Containers

```bash
# After code changes
docker compose up --build -d

# Force rebuild
docker compose build --no-cache
docker compose up -d
```

---

## Security Best Practices

### AWS Credentials

- **Current**: Credentials passed per request (POC)
- **Best Practice**: Use **AWS IAM Roles** if running on AWS
- **Alternative**: Use **AWS Secrets Manager** or **Parameter Store**

### SSH Keys

- **Current**: New key pair generated per session
- **Best Practice**: Store persistent key in **AWS Secrets Manager**
- **Alternative**: Use **AWS Systems Manager (SSM) Session Manager**

### Network Security

- **Current**: Security Group allows `0.0.0.0/0` for SSH (22)
- **Best Practice**: Restrict SSH to specific IP addresses
- **Alternative**: Use **SSM Session Manager** to avoid opening port 22

### Environment Files

- ✅ Never commit `.env` files
- ✅ Use `.env.example` as templates
- ✅ Rotate credentials regularly
- ✅ Use different credentials for dev/staging/prod

---

## Troubleshooting

### Containers Not Starting

```bash
# Check container status
docker compose ps

# View logs
docker compose logs

# Restart containers
docker compose restart
```

### Port Already in Use

```bash
# Change ports in .env
BACKEND_PORT=8002
FRONTEND_PORT=5175

# Rebuild
docker compose up --build -d
```

### CORS Errors

Update `CORS_ORIGINS` in `.env`:

```bash
CORS_ORIGINS=http://localhost:5174,http://localhost:3000,https://yourdomain.com
```

### AWS Connection Issues

- Verify AWS credentials are correct
- Check AWS region is valid
- Ensure IAM user has EC2 permissions
- Check AWS service quotas

### SSH Connection Timeout

- Verify security group allows port 22
- Check instance is running
- Verify private key is correct
- Ensure instance has public IP

---

## Scaling & Production Considerations

### Load Balancing

- Attach instances to **Application Load Balancer (ALB)**
- Use **Auto Scaling Groups (ASG)** for automatic scaling

### Container Orchestration

For production, consider migrating to:
- **AWS ECS (Fargate)**: Serverless containers
- **AWS EKS (Kubernetes)**: Full container orchestration

### Database

- Don't run databases in Docker on app instances
- Use **AWS RDS** for managed databases
- Use **Amazon ElastiCache** for caching

### Monitoring

- **CloudWatch**: Logs and metrics
- **CloudWatch Alarms**: Automated alerts
- **X-Ray**: Distributed tracing

### CI/CD

- **GitHub Actions**: Automated deployments
- **AWS CodePipeline**: Native AWS CI/CD
- **GitLab CI**: Alternative pipeline

---

## License

MIT License - feel free to use and modify as needed.

## Contributing

Contributions welcome! Please open an issue or PR.

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Docker logs: `docker compose logs`
3. Open an issue on GitHub
