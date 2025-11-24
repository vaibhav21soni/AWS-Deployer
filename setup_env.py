import os

def create_frontend_env():
    print("\n--- Frontend Configuration ---")
    api_url = input("Enter Backend API URL (default: http://localhost:8000): ").strip() or "http://localhost:8000"
    
    env_content = f"VITE_API_URL={api_url}\n"
    
    with open("frontend/.env", "w") as f:
        f.write(env_content)
    print(f"✅ Created frontend/.env with VITE_API_URL={api_url}")

def create_backend_env():
    print("\n--- Backend Configuration (Optional) ---")
    print("Note: The app primarily uses credentials passed via the UI, but you can set defaults here for local testing.")
    access_key = input("Enter AWS Access Key ID (leave empty to skip): ").strip()
    secret_key = input("Enter AWS Secret Access Key (leave empty to skip): ").strip()
    region = input("Enter AWS Region (default: us-east-1): ").strip() or "us-east-1"
    
    env_content = f"AWS_DEFAULT_REGION={region}\n"
    if access_key:
        env_content += f"AWS_ACCESS_KEY_ID={access_key}\n"
    if secret_key:
        env_content += f"AWS_SECRET_ACCESS_KEY={secret_key}\n"
        
    with open("backend/.env", "w") as f:
        f.write(env_content)
    print("✅ Created backend/.env")

def main():
    print("🚀 AWS Deployer Environment Setup 🚀")
    
    if not os.path.exists("frontend"):
        print("❌ Error: 'frontend' directory not found. Run this script from the project root.")
        return

    create_frontend_env()
    create_backend_env()
    
    print("\n✨ Setup Complete! ✨")
    print("You can now run the application:")
    print("  1. Backend: cd backend && uvicorn main:app --reload")
    print("  2. Frontend: cd frontend && npm run dev")

if __name__ == "__main__":
    main()
