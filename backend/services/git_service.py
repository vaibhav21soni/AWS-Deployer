import paramiko
import time
import io

def git_pull_and_restart(ip_address, private_key_str, repos, compose_path=".", frontend_path=None, backend_path=None):
    """
    SSH into instance, pull latest code for all repos, and restart containers
    """
    key = paramiko.RSAKey.from_private_key(io.StringIO(private_key_str))
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        # Connect to instance
        retries = 5
        for i in range(retries):
            try:
                client.connect(hostname=ip_address, username="ubuntu", pkey=key, timeout=10)
                break
            except Exception:
                time.sleep(3)
        else:
            return {"error": "Could not connect to instance via SSH"}

        commands = []
        
        # Pull each repository
        for repo in repos:
            # Configure git credential helper to use token if provided
            if repo.git_token:
                # Set up credential helper for this specific pull
                git_url = repo.url
                if 'gitlab' in git_url.lower():
                    # GitLab format: use oauth2 as username
                    if git_url.startswith('https://'):
                        git_url = git_url.replace('https://', f'https://oauth2:{repo.git_token}@')
                    elif git_url.startswith('http://'):
                        git_url = git_url.replace('http://', f'http://oauth2:{repo.git_token}@')
                else:
                    # GitHub and others
                    if git_url.startswith('https://'):
                        git_url = git_url.replace('https://', f'https://{repo.git_token}@')
                    elif git_url.startswith('http://'):
                        git_url = git_url.replace('http://', f'http://{repo.git_token}@')
                
                # Update remote URL temporarily for pull
                normalized_path = repo.path.lstrip('./')
                if normalized_path == "" or normalized_path == ".":
                    commands.append(f"git remote set-url origin {git_url} && git pull origin {repo.branch}")
                else:
                    commands.append(f"cd {normalized_path} && git remote set-url origin {git_url} && git pull origin {repo.branch}")
            else:
                # Check if user embedded token in URL for GitLab
                git_url = repo.url
                if 'gitlab' in git_url.lower() and '@' in git_url:
                    try:
                        if git_url.startswith('https://'):
                            auth_part = git_url.split('https://')[1].split('@')[0]
                            if auth_part.startswith('glpat-') and ':' not in auth_part:
                                git_url = git_url.replace(f'https://{auth_part}@', f'https://oauth2:{auth_part}@')
                                # Need to update remote URL if we changed it
                                normalized_path = repo.path.lstrip('./')
                                if normalized_path == "" or normalized_path == ".":
                                    commands.append(f"git remote set-url origin {git_url} && git pull origin {repo.branch}")
                                else:
                                    commands.append(f"cd {normalized_path} && git remote set-url origin {git_url} && git pull origin {repo.branch}")
                                continue # Skip default pull
                    except Exception:
                        pass

                normalized_path = repo.path.lstrip('./')
                if normalized_path == "" or normalized_path == ".":
                    # Root directory (home)
                    commands.append(f"git pull origin {repo.branch}")
                else:
                    # Subdirectory
                    commands.append(f"cd {normalized_path} && git pull origin {repo.branch}")

        # Restart containers
        work_dir = compose_path if compose_path != "." else "."
        commands.append(f"cd {work_dir} && sudo docker compose down")
        commands.append(f"cd {work_dir} && sudo docker compose up -d --build")

        output_log = []
        for cmd in commands:
            stdin, stdout, stderr = client.exec_command(cmd)
            exit_status = stdout.channel.recv_exit_status()
            out = stdout.read().decode()
            err = stderr.read().decode()
            output_log.append(f"CMD: {cmd}\nOUT: {out}\nERR: {err}")
            if exit_status != 0 and "Already up to date" not in out:
                return {"error": f"Command failed: {cmd}", "details": err}

        client.close()
        return {"message": "Git pull and restart successful", "logs": output_log}

    except Exception as e:
        return {"error": f"Git pull failed: {str(e)}"}
