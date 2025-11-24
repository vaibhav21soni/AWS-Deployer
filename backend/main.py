from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from services.aws_service import create_ec2_instance, terminate_instance
from services.ssh_service import clone_repositories, start_application
from services.git_service import git_pull_and_restart
from services.command_service import execute_command
from services.file_service import read_file, write_file
import uvicorn
import os
from dotenv import load_dotenv

from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta

# Load environment variables
load_dotenv()

app = FastAPI(title="AWS EC2 Deployer")

# Initialize Scheduler
scheduler = BackgroundScheduler()
scheduler.start()

# CORS Configuration from environment
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,http://localhost:5174").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AWSCredentials(BaseModel):
    access_key: str
    secret_key: str
    region: str = "us-east-1"
    os_type: str = "ubuntu"
    instance_type: str = "t2.micro"
    allowed_ports: List[int] = [80, 443, 22, 3000, 8000] # Default ports

from typing import List, Optional

class RepoConfig(BaseModel):
    url: str
    branch: str = "main"
    path: str = "." # Clone destination relative to root
    git_token: Optional[str] = None  # Optional token for private repos

class DeploymentRequest(BaseModel):
    ip_address: str
    private_key: str
    repos: List[RepoConfig]
    compose_path: str = "." # Directory containing docker-compose.yml
    frontend_path: Optional[str] = None # Optional: Path to frontend Dockerfile context
    backend_path: Optional[str] = None # Optional: Path to backend Dockerfile context
    env_vars: dict = {}

class StartDeployRequest(BaseModel):
    ip_address: str
    private_key: str
    compose_path: str = "."
    frontend_path: Optional[str] = None
    backend_path: Optional[str] = None
    env_vars: dict = {}

class GitPullRequest(BaseModel):
    ip_address: str
    private_key: str
    repos: List[RepoConfig]
    compose_path: str = "."
    frontend_path: Optional[str] = None
    backend_path: Optional[str] = None


class CommandRequest(BaseModel):
    ip_address: str
    private_key: str
    command: str
    username: str = "ubuntu"  # Default to ubuntu, frontend will send ec2-user for Amazon Linux


class FileReadRequest(BaseModel):
    ip_address: str
    private_key: str
    file_path: str


class FileWriteRequest(BaseModel):
    ip_address: str
    private_key: str
    file_path: str
    content: str


class TerminateRequest(BaseModel):
    access_key: str
    secret_key: str
    region: str
    instance_id: str

class ScheduleTerminationRequest(BaseModel):
    access_key: str
    secret_key: str
    region: str
    instance_id: str
    minutes: int

@app.get("/")
def read_root():
    return {"message": "AWS Deployer API is running"}

@app.post("/create-ec2")
def create_ec2(creds: AWSCredentials):
    try:
        result = create_ec2_instance(creds.access_key, creds.secret_key, creds.region, creds.os_type, creds.instance_type, creds.allowed_ports)
        return result
    except Exception as e:
        return {"error": str(e)}

@app.post("/clone-repos")
def clone_repos(request: DeploymentRequest):
    try:
        result = clone_repositories(
            request.ip_address,
            request.private_key,
            request.repos
        )
        return result
    except Exception as e:
        return {"error": str(e)}

@app.post("/start-deploy")
def start_deploy(request: StartDeployRequest):
    try:
        print(f"DEBUG: /start-deploy received: {request.dict()}")
        result = start_application(
            request.ip_address,
            request.private_key,
            request.compose_path,
            request.frontend_path,
            request.backend_path,
            request.env_vars
        )
        return result
    except Exception as e:
        return {"error": str(e)}

# Deprecated but kept for backward compatibility if needed
@app.post("/deploy")
def deploy(request: DeploymentRequest):
    # ... (logic moved to new endpoints, but we can keep this or remove it)
    return {"error": "Endpoint deprecated. Use /clone-repos and /start-deploy"}

@app.post("/git-pull")
def git_pull(request: GitPullRequest):
    try:
        result = git_pull_and_restart(request.ip_address, request.private_key, request.repos, request.compose_path, request.frontend_path, request.backend_path)
        return result
    except Exception as e:
        return {"error": str(e)}


@app.post("/execute-command")
def execute_cmd(request: CommandRequest):
    try:
        result = execute_command(request.ip_address, request.private_key, request.command, request.username)
        return result
    except Exception as e:
        return {"error": str(e)}


@app.post("/read-file")
def read_file_endpoint(request: FileReadRequest):
    try:
        print(f"DEBUG: /read-file received for path: {request.file_path}")
        result = read_file(request.ip_address, request.private_key, request.file_path)
        return result
    except Exception as e:
        print(f"DEBUG: /read-file error: {e}")
        return {"error": str(e)}


@app.post("/write-file")
def write_file_endpoint(request: FileWriteRequest):
    try:
        print(f"DEBUG: /write-file received for path: {request.file_path}")
        result = write_file(request.ip_address, request.private_key, request.file_path, request.content)
        print(f"DEBUG: /write-file result: {result}")
        return result
    except Exception as e:
        return {"error": str(e)}


from fastapi import FastAPI, BackgroundTasks

# ... (imports)

@app.post("/delete-ec2")
def delete_ec2(req: TerminateRequest, background_tasks: BackgroundTasks):
    # We can't easily return the result of a background task to the immediate response.
    # However, for the user experience, they just want to know "Termination Started".
    # But the user asked for SG deletion which happens AFTER termination.
    # If we make it async, the UI won't know when it's fully done.
    # BUT, `terminate_instance` waits for termination (`wait_until_terminated`).
    # If we run this in the main thread, the request will hang for 2-5 minutes.
    # So BackgroundTasks is the right way.
    
    background_tasks.add_task(terminate_instance, req.access_key, req.secret_key, req.region, req.instance_id)
    return {"message": "Termination started. Security Groups will be cleaned up automatically."}

@app.post("/schedule-termination")
def schedule_termination(req: ScheduleTerminationRequest):
    try:
        run_date = datetime.now() + timedelta(minutes=req.minutes)
        scheduler.add_job(
            terminate_instance,
            'date',
            run_date=run_date,
            args=[req.access_key, req.secret_key, req.region, req.instance_id]
        )
        return {"message": f"Termination scheduled for {run_date}"}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host=host, port=port)

