import paramiko
import io
import select
import time

def execute_command(ip_address, private_key_str, command, username="ubuntu"):
    """
    Execute a single command on the remote instance and return output with streaming support
    """
    key = paramiko.RSAKey.from_private_key(io.StringIO(private_key_str))
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        # Connect to instance
        # Connect to instance with retries
        retries = 3
        for i in range(retries):
            try:
                print(f"DEBUG: Connecting to {ip_address} (Attempt {i+1}/{retries})...")
                client.connect(hostname=ip_address, username=username, pkey=key, timeout=30, banner_timeout=60, auth_timeout=60)
                print("DEBUG: Connected successfully")
                break
            except Exception as e:
                print(f"DEBUG: Connection failed: {e}")
                if i == retries - 1:
                    raise e
                time.sleep(5)
        
        # Execute command with get_pty for better output handling
        stdin, stdout, stderr = client.exec_command(command, get_pty=True)
        
        # Read output in real-time
        output_lines = []
        error_lines = []
        
        # Set channel to non-blocking
        stdout.channel.setblocking(0)
        
        while not stdout.channel.exit_status_ready():
            if stdout.channel.recv_ready():
                data = stdout.channel.recv(1024).decode('utf-8', errors='replace')
                output_lines.append(data)
            else:
                time.sleep(0.1)
        
        # Get any remaining output
        while stdout.channel.recv_ready():
            data = stdout.channel.recv(1024).decode('utf-8', errors='replace')
            output_lines.append(data)
        
        exit_status = stdout.channel.recv_exit_status()
        
        output = ''.join(output_lines)
        error = stderr.read().decode('utf-8', errors='replace') if stderr.channel.recv_stderr_ready() else ''
        
        client.close()
        
        return {
            "output": output,
            "error": error,
            "exit_status": exit_status
        }
    
    except Exception as e:
        return {"error": f"Command execution failed: {str(e)}", "exit_status": 1}
