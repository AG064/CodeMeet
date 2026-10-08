import subprocess
import sys
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

SQL_COMMAND = """
              TRUNCATE TABLE profiles, bios, users CASCADE; \
              """

def confirm_action():
    print("⚠️  WARNING: This will delete ALL data (users, profiles, bios) but keep the tables intact!")
    choice = input("Are you sure? [yes/no]: ").strip().lower()

    if choice != 'yes':
        print("🛑 Aborted. The database data was not modified.")
        sys.exit(0)

def clear_database():
    print("⏳ Clearing data from tables...")

    if shutil.which("docker"):
        print("💻 Running from Host: Using 'docker exec'")
        command = [
            "docker", "exec", "-i", CONTAINER_NAME,
            "psql", "-U", DB_USER, "-d", DB_NAME
        ]
    else:
        print("🐳 Running from Container: Using network 'psql'")
        os.environ["PGPASSWORD"] = DB_PASSWORD
        command = [
            "psql", "-h", NETWORK_HOST, "-U", DB_USER, "-d", DB_NAME
        ]

    try:
        subprocess.run(
            command,
            input=SQL_COMMAND.encode('utf-8'),
            check=True,
            capture_output=True
        )
        print("✅ Success! All tables are now empty and ready for new data.")
    except FileNotFoundError:
        print("❌ Missing Tool: Could not find 'docker' or 'psql'.")
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(f"❌ Error executing command.")
        if e.stderr:
            print(f"Details: {e.stderr.decode('utf-8').strip()}")
        sys.exit(1)

if __name__ == "__main__":
    confirm_action()
    clear_database()
