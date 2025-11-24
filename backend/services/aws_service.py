import boto3
import time

AMI_MAP = {
    "ubuntu": "ami-0c7217cdde317cfec", # Ubuntu 22.04 LTS us-east-1
    "amazon_linux": "ami-0df435f331839b2d6", # Amazon Linux 2023 us-east-1 (Example)
}

def create_ec2_instance(access_key, secret_key, region, os_type="ubuntu", instance_type="t2.micro", allowed_ports=[80, 443, 22, 3000, 8000]):
    try:
        ec2 = boto3.resource(
            'ec2',
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region
        )
        
        # Get AMI based on OS selection
        image_id = AMI_MAP.get(os_type, AMI_MAP["ubuntu"])

        # 1. Create Key Pair (or use existing - simplified for demo to create new one)
        key_name = f"deployer-key-{int(time.time())}"
        try:
            key_pair = ec2.create_key_pair(KeyName=key_name)
            private_key = key_pair.key_material
        except Exception as e:
            return {"error": f"Failed to create key pair: {str(e)}"}

        # Create Security Group
        sg_name = f"deployer-sg-{int(time.time())}"
        security_group = ec2.create_security_group(
            GroupName=sg_name,
            Description='Security group for deployed app'
        )
        
        # Authorize Ingress for allowed ports
        ip_permissions = []
        # Ensure port 22 is always allowed for SSH
        if 22 not in allowed_ports:
            allowed_ports.append(22)

        for port in allowed_ports:
            ip_permissions.append({
                'IpProtocol': 'tcp',
                'FromPort': port,
                'ToPort': port,
                'IpRanges': [{'CidrIp': '0.0.0.0/0'}]
            })
            
        security_group.authorize_ingress(IpPermissions=ip_permissions)
    except Exception as e:
        return {"error": f"Failed to create security group: {str(e)}"}

    # 3. Read user data script
    try:
        import os
        # Get the path relative to the backend directory
        script_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '..', 'infrastructure', 'user_data.sh')
        with open(script_path, 'r') as f:
            user_data_script = f.read()
    except Exception as e:
        return {"error": f"Failed to read user data script: {str(e)}"}

    # 4. Launch EC2 instance with specified instance type
    try:
        instances = ec2.create_instances(
            ImageId=image_id,
            MinCount=1,
            MaxCount=1,
            InstanceType=instance_type,  # Use the provided instance type
            KeyName=key_name,
            SecurityGroupIds=[security_group.id],
            UserData=user_data_script,
            TagSpecifications=[
                {
                    'ResourceType': 'instance',
                    'Tags': [{'Key': 'Name', 'Value': 'Deployer-Instance'}]
                }
            ]
        )
        instance = instances[0]
        instance.wait_until_running()
        instance.reload()
        
        return {
            "instance_id": instance.id,
            "public_ip": instance.public_ip_address,
            "private_key": private_key,
            "os_type": os_type,  # Include OS type for username determination
            "message": "Instance created successfully"
        }
    except Exception as e:
        return {"error": f"Failed to launch instance: {str(e)}"}

def terminate_instance(access_key, secret_key, region, instance_id):
    session = boto3.Session(
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=region
    )
    ec2 = session.resource('ec2')
    
    try:
        instance = ec2.Instance(instance_id)
        
        # Get Security Groups before terminating
        security_groups = [sg['GroupId'] for sg in instance.security_groups]
        
        # Terminate Instance
        instance.terminate()
        instance.wait_until_terminated()
        
        # Delete Security Groups (only if they start with 'deployer-sg-')
        deleted_sgs = []
        for sg_id in security_groups:
            try:
                sg = ec2.SecurityGroup(sg_id)
                if sg.group_name.startswith('deployer-sg-'):
                    # Wait a bit for the dependency to clear
                    time.sleep(5) 
                    sg.delete()
                    deleted_sgs.append(sg.group_name)
            except Exception as e:
                print(f"Warning: Could not delete SG {sg_id}: {e}")

        return {
            "message": f"Instance {instance_id} terminated successfully",
            "deleted_security_groups": deleted_sgs
        }
    except Exception as e:
        return {"error": f"Failed to terminate instance: {str(e)}"}
