import paramiko
import time
import io

def clone_repositories(ip_address, private_key_str, repos):
    key = paramiko.RSAKey.from_private_key(io.StringIO(private_key_str))
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        # Wait for SSH to be available (retry logic)
        retries = 10
        for i in range(retries):
            try:
                client.connect(hostname=ip_address, username="ubuntu", pkey=key, timeout=30, banner_timeout=60)
                break
            except Exception:
                time.sleep(5)
        else:
            return {"error": "Could not connect to instance via SSH"}

        commands = [
            "cloud-init status --wait", # Wait for user_data to finish
            "sudo apt-get update", # Ensure apt is updated
            "sudo apt-get install -y git", # Ensure git is installed
        ]

        # Clone each repository
        for repo in repos:
            # Build git URL with token if provided (for private repos)
            git_url = repo.url
            if repo.git_token:
                # For GitLab, GitHub, and other providers, use oauth2 or token as username
                if 'gitlab' in git_url.lower():
                    if git_url.startswith('https://'):
                        git_url = git_url.replace('https://', f'https://oauth2:{repo.git_token}@')
                    elif git_url.startswith('http://'):
                        git_url = git_url.replace('http://', f'http://oauth2:{repo.git_token}@')
                else:
                    if git_url.startswith('https://'):
                        git_url = git_url.replace('https://', f'https://{repo.git_token}@')
                    elif git_url.startswith('http://'):
                        git_url = git_url.replace('http://', f'http://{repo.git_token}@')
            else:
                # Check for embedded GitLab tokens
                if 'gitlab' in git_url.lower() and '@' in git_url:
                    try:
                        if git_url.startswith('https://'):
                            auth_part = git_url.split('https://')[1].split('@')[0]
                            if auth_part.startswith('glpat-') and ':' not in auth_part:
                                git_url = git_url.replace(f'https://{auth_part}@', f'https://oauth2:{auth_part}@')
                        elif git_url.startswith('http://'):
                            auth_part = git_url.split('http://')[1].split('@')[0]
                            if auth_part.startswith('glpat-') and ':' not in auth_part:
                                git_url = git_url.replace(f'http://{auth_part}@', f'http://oauth2:{auth_part}@')
                    except Exception:
                        pass
            
            # Normalize path - remove leading ./ if present
            normalized_path = repo.path.lstrip('./')
            
            # If path is empty or '.', clone to current directory (not recommended for multiple repos)
            # User wants to clone into specific paths relative to home
            if normalized_path == "" or normalized_path == ".":
                # This is risky if multiple repos, but user requested control
                # We'll assume they know what they are doing.
                # To avoid mess, we should probably still require a directory name if possible,
                # but for now let's just clone.
                # Git clone without directory arg clones into folder named after repo.
                # If they specified '.', they might mean "clone HERE", which is home dir.
                # Git clone . is invalid. Git clone URL . clones into current dir.
                commands.append(f"GIT_TERMINAL_PROMPT=0 git clone -b {repo.branch} {git_url} .")
            else:
                # Clone to subdirectory
                # Clean up first? User might want to re-clone.
                commands.append(f"rm -rf {normalized_path}")
                commands.append(f"GIT_TERMINAL_PROMPT=0 git clone -b {repo.branch} {git_url} {normalized_path}")

        output_log = []
        for cmd in commands:
            stdin, stdout, stderr = client.exec_command(cmd)
            exit_status = stdout.channel.recv_exit_status()
            out = stdout.read().decode()
            err = stderr.read().decode()
            output_log.append(f"CMD: {cmd}\nOUT: {out}\nERR: {err}")
            if exit_status != 0:
                return {"error": f"Command failed: {cmd}", "details": err}

        client.close()
        return {"message": "Repositories cloned successfully", "logs": output_log}

    except Exception as e:
        return {"error": f"Clone failed: {str(e)}"}


def start_application(ip_address, private_key_str, compose_path=".", frontend_path=None, backend_path=None, env_vars={}):
    print(f"DEBUG: start_application called with compose_path='{compose_path}'")
    key = paramiko.RSAKey.from_private_key(io.StringIO(private_key_str))
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        # Connect to instance
        client.connect(hostname=ip_address, username="ubuntu", pkey=key, timeout=10)

        commands = []
        
        # Nginx Configuration (Optional - keeping it for now as it's useful)
        nginx_config = """
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://localhost:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
"""
        commands.append(f"echo '{nginx_config}' | sudo tee /etc/nginx/sites-available/default")
        commands.append("sudo systemctl reload nginx")

        # Determine working directory
        # If compose_path is '.', it means home directory
        work_dir = compose_path if compose_path != "." else "."
        
        # Write .env file
        env_file_path = f"{work_dir}/.env"
        # Ensure directory exists if not .
        if work_dir != ".":
             commands.append(f"mkdir -p {work_dir}")
             
        commands.append(f"echo '{chr(10).join([f'{k}={v}' for k, v in env_vars.items()])}' > {env_file_path}")

        # Dynamic Docker Compose Generation
        if frontend_path and backend_path:
            docker_compose_content = f"""
version: '3.8'
services:
  frontend:
    build: ./{frontend_path}
    ports:
      - "3000:80"
    restart: always
  
  backend:
    build: ./{backend_path}
    ports:
      - "8000:8000"
    env_file:
      - .env
    restart: always

  nginx:
    image: nginx:latest
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - frontend
      - backend
"""
            # Write generated docker-compose.yml
            commands.append(f"echo '{docker_compose_content}' > {work_dir}/docker-compose.yml")
            
            # Write nginx.conf for the container
            container_nginx_conf = """
server {
    listen 80;
    location / {
        proxy_pass http://frontend:80;
    }
    location /api/ {
        proxy_pass http://backend:8000/;
    }
}
"""
            commands.append(f"echo '{container_nginx_conf}' > {work_dir}/nginx.conf")

        # Run Docker Compose
        commands.append(f"cd {work_dir} && sudo docker compose up -d --build")

        output_log = []
        for cmd in commands:
            print(f"DEBUG: Executing command: {cmd}")
            stdin, stdout, stderr = client.exec_command(cmd)
            exit_status = stdout.channel.recv_exit_status()
            out = stdout.read().decode()
            err = stderr.read().decode()
            output_log.append(f"CMD: {cmd}\nOUT: {out}\nERR: {err}")
            if exit_status != 0:
                return {"error": f"Command failed: {cmd}", "details": err}

        client.close()
        return {"message": "Application started successfully", "logs": output_log}

    except Exception as e:
        return {"error": f"Start application failed: {str(e)}"}
