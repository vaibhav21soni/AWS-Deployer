# Project Structure & Setup Guide

## Directory Tree

```
aws-deployer/
├── backend/                 # FastAPI Backend
│   ├── main.py              # API Entrypoint
│   ├── services/            # Business Logic (AWS, SSH)
│   ├── Dockerfile           # Backend Container Config
│   └── requirements.txt     # Python Dependencies
├── frontend/                # React Frontend
│   ├── src/                 # Source Code
│   │   ├── App.jsx          # Main Component
│   │   ├── api.js           # API Client
│   │   └── components/      # UI Components
│   ├── Dockerfile           # Frontend Container Config
│   └── package.json         # Node Dependencies
├── infrastructure/          # Deployment Assets (Target Instance)
│   ├── user_data.sh         # EC2 Init Script (Docker, Nginx)
│   ├── nginx.conf           # Target Nginx Config
│   └── docker-compose.yml   # Target App Compose
├── docker-compose.yml       # Root Compose (Run the Deployer Tool)
├── setup_env.py             # Environment Setup Script
└── README.md                # General Documentation
```

## How to Start

### Option 1: Docker (Recommended)
Run the entire tool (Frontend + Backend) in containers.

```bash
docker compose up --build
```
- Frontend: http://localhost:5173
- Backend: http://localhost:8000

### Option 2: Manual Setup

1.  **Environment Setup**:
    Run the helper script to create `.env` files.
    ```bash
    python3 setup_env.py
    ```

2.  **Backend**:
    ```bash
    cd backend
    pip install -r requirements.txt
    uvicorn main:app --reload
    ```

3.  **Frontend**:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

## Environment Variables

- **Frontend (`frontend/.env`)**:
    - `VITE_API_URL`: URL of the backend API (default: `http://localhost:8000`).

- **Backend (`backend/.env`)**:
    - `AWS_ACCESS_KEY_ID`: (Optional) Default AWS Access Key.
    - `AWS_SECRET_ACCESS_KEY`: (Optional) Default AWS Secret Key.
    - `AWS_DEFAULT_REGION`: (Optional) Default AWS Region.
