import paramiko
import io
import time

def read_file(ip_address, private_key_str, file_path):
    """
    Read a file from the remote instance
    """
    key = paramiko.RSAKey.from_private_key(io.StringIO(private_key_str))
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        client.connect(hostname=ip_address, username="ubuntu", pkey=key, timeout=30, banner_timeout=60)
        
        # Try reading with sudo cat
        stdin, stdout, stderr = client.exec_command(f"sudo cat {file_path}")
        content = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        
        if err and not content:
             return {"error": f"Failed to read file: {err}"}
             
        client.close()
        return {"content": content, "path": file_path}
    except Exception as e:
        return {"error": f"Read failed: {str(e)}"}

def write_file(ip_address, private_key_str, file_path, content):
    """
    Write content to a file on the remote instance
    """
    key = paramiko.RSAKey.from_private_key(io.StringIO(private_key_str))
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        client.connect(hostname=ip_address, username="ubuntu", pkey=key, timeout=30, banner_timeout=60)
        
        # Write to a temp file first
        temp_path = f"/tmp/temp_edit_{int(time.time())}"
        
        sftp = client.open_sftp()
        with sftp.file(temp_path, 'w') as f:
            f.write(content)
        sftp.close()
        
        # Move temp file to target path with sudo
        # Ensure directory exists
        directory = "/".join(file_path.split("/")[:-1])
        if directory:
            client.exec_command(f"sudo mkdir -p {directory}")
            
        stdin, stdout, stderr = client.exec_command(f"sudo mv {temp_path} {file_path} && sudo chown ubuntu:ubuntu {file_path}")
        exit_status = stdout.channel.recv_exit_status()
        
        if exit_status != 0:
             err = stderr.read().decode()
             return {"error": f"Failed to write file: {err}"}

        client.close()
        return {"message": "File saved successfully"}
    except Exception as e:
        return {"error": f"Write failed: {str(e)}"}
