import subprocess
import shutil
import os
from pathlib import Path

# --- LOAD ENVIRONMENT VARIABLES ---
env_path = Path(__file__).resolve().parent.parent / '.env'
if not env_path.exists():
    env_path = Path(__file__).resolve().parent.parent / 'backend' / '.env'

try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=env_path)
except ImportError:
    pass

# --- CONFIGURATION (With Defaults) ---
CONTAINER_NAME = os.getenv("DB_CONTAINER_NAME", "web-database-1")
NETWORK_HOST = os.getenv("DB_NETWORK_HOST", "database")
DB_NAME = "codemeet_db"
DB_USER = os.getenv("POSTGRES_USER", "postgres")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD")
if not DB_PASSWORD or not DB_PASSWORD.strip():
    raise RuntimeError("Set a private POSTGRES_PASSWORD before running database tools")

ADMIN_EMAIL = "admin@test.com"
ADMIN_NAME = "Admin"
ADMIN_PASSWORD_HASH = "$2a$12$5.cFcfT1hdyIvBMh9bVII.1/smzfvtd3BikfZel4G92WTzgZKdQSO"
ADMIN_ROLE = "ADMIN"

def generate_sql():
    return f"""
DO $$
DECLARE
    admin_id UUID;
BEGIN
    -- Only insert if this email doesn't already exist
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = '{ADMIN_EMAIL}') THEN

        admin_id := gen_random_uuid();

        INSERT INTO users (id, email, name, password, role, last_seen_at, profile_picture, hide_location, hide_age)
        VALUES (
            admin_id,
            '{ADMIN_EMAIL}',
            '{ADMIN_NAME}',
            '{ADMIN_PASSWORD_HASH}',
            '{ADMIN_ROLE}',
            NOW(),
            NULL,
            false,
            false
        );

        RAISE NOTICE '>>> Admin user created: {ADMIN_EMAIL}';
    ELSE
        RAISE NOTICE '>>> Admin user already exists, skipping.';
    END IF;
END $$;
"""

def init_admin():
    print(f"🚀 Initializing admin user in '{DB_NAME}'...")
    sql = generate_sql()

    if shutil.which("docker"):
        print("💻 Running from Host: Using 'docker exec'")
        command = [
            "docker", "exec", "-i", CONTAINER_NAME,
            "psql", "-v", "ON_ERROR_STOP=1", "-U", DB_USER, "-d", DB_NAME
        ]
    else:
        print("🐳 Running from Container: Using network 'psql'")
        os.environ["PGPASSWORD"] = DB_PASSWORD
        command = [
            "psql", "-h", NETWORK_HOST, "-U", DB_USER, "-d", DB_NAME, "-v", "ON_ERROR_STOP=1"
        ]

    try:
        process = subprocess.run(command, input=sql.encode("utf-8"), capture_output=True)

        output = process.stdout.decode("utf-8").strip()
        errors = process.stderr.decode("utf-8").strip()

        if process.returncode != 0:
            print(f"❌ Error:\n{errors}")
        else:
            if errors:
                print(errors)
            print("✅ Done.")

    except FileNotFoundError:
        print("❌ Missing Tool: Could not find 'docker' or 'psql'.")
    except Exception as e:
        print(f"❌ Runtime Error: {e}")

if __name__ == "__main__":
    init_admin()
