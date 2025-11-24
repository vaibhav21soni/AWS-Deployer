# AWS EC2 Auto-Deployer

A full-stack application to provision EC2 instances and deploy Dockerized applications automatically.

## Features

- **Provision EC2**: Create an EC2 instance with a single click using your AWS credentials.
- **Auto-Configuration**: Automatically installs Docker, Nginx, and Git on the new instance.
- **One-Click Deploy**: Deploy any Dockerized application (from a Git repo) to the provisioned instance.
- **Branch Selection**: Choose which Git branch to deploy (e.g., `main`, `develop`).
- **Scheduled Destruction**: Schedule your instance to automatically terminate after a set time to save costs.
- **Auto-Nginx**: Automatically configures Nginx as a reverse proxy (Port 80 -> 3000/8000).
- **Real-time Logs**: View deployment logs in real-time.

## Project Structure

- `backend/`: FastAPI backend for AWS interaction, SSH deployment, and scheduling.
- `frontend/`: React frontend for the user interface.
- `infrastructure/`: Configuration files (Nginx, Docker Compose, User Data).

## Prerequisites

- Node.js (v18+)
- Python (v3.9+)
- AWS Account (Access Key & Secret Key)

## Setup & Run Locally

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

The backend will run on `http://localhost:8000`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on `http://localhost:5173`.

## Usage

1. **Credentials**: Enter your AWS Access Key and Secret Key.
2. **Create**: Click **Create EC2 Instance**. Wait for provisioning.
3. **Deploy**:
    - Enter a Git Repository URL.
    - (Optional) Enter a Branch Name (default: `main`).
    - Click **Deploy Application**.
4. **Schedule Destruction**:
    - Enter the number of minutes (e.g., `60`).
    - Click **Schedule** to auto-terminate the instance later.
5. **Terminate**: Click **Terminate Instance** to delete the server immediately.

## Security & Production Best Practices

### AWS Credentials
- **Current**: Credentials are passed per request for the POC.
- **Best Practice**: Use **AWS IAM Roles** if running this deployer on AWS. For local usage, integrate with **AWS Secrets Manager** or **Parameter Store** to avoid passing keys in the frontend.

### SSH Keys
- **Current**: A new key pair is generated for each session.
- **Best Practice**: Store a persistent `deployer-key` in **AWS Secrets Manager**. Retrieve it programmatically during deployment.

### Network Security
- **Current**: Security Group allows `0.0.0.0/0` for SSH (22).
- **Best Practice**: Restrict SSH access to your specific IP address or a Bastion Host. Use **AWS Systems Manager (SSM) Session Manager** to avoid opening port 22 entirely.

### Deployment Alternatives
- **SSM Run Command**: Instead of `paramiko` (SSH), use AWS SSM Run Command to execute scripts on instances. This is more secure and audit-friendly.
- **User Data**: Move more logic into `user_data` for immutable infrastructure patterns.

## Scaling

- **Load Balancing**: Attach instances to an **Application Load Balancer (ALB)** and use Auto Scaling Groups (ASG).
- **Container Orchestration**: For production, migrate from single EC2 Docker Compose to **AWS ECS (Fargate)** or **EKS (Kubernetes)**.
- **Database**: Externalize the database (don't run it in Docker on the app instance). Use **AWS RDS** for reliability.
