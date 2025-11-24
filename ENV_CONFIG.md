# AWS Deployer - Environment Configuration

## Setup Instructions

### 1. Environment Variables

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your preferred values:

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

### 2. Start the Application

```bash
docker compose up --build -d
```

### 3. Access the Application

- **Frontend**: http://localhost:5174 (or your configured FRONTEND_PORT)
- **Backend API**: http://localhost:8001 (or your configured BACKEND_PORT)
- **API Documentation**: http://localhost:8001/docs

## Environment Files

- **`.env`** - Your local configuration (gitignored)
- **`.env.example`** - Template with default values
- **`backend/.env.example`** - Backend-specific template
- **`frontend/.env.example`** - Frontend-specific template

## Production Deployment

For deploying to a domain with SSL, see [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md)

## Notes

- AWS credentials can be left empty in `.env` and provided through the UI
- Port changes require rebuilding containers: `docker compose up --build -d`
- CORS origins should include all frontend URLs you'll access the app from
- For domain deployment, update `DOMAIN` and `CORS_ORIGINS` in `.env`
