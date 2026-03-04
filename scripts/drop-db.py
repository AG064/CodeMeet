import subprocess
import sys

# TRUNCATE мгновенно очищает таблицы, оставляя их структуру.
# CASCADE автоматически очистит связанные таблицы (profiles, bios), если они ссылаются на users.
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
    command = [
        "docker", "exec", "-i", "web-database-1",
        "psql", "-U", "postgres", "-d", "codemeet_db"
    ]

    try:
        print("⏳ Clearing data from tables...")
        subprocess.run(
            command,
            input=SQL_COMMAND.encode('utf-8'),
            check=True,
            capture_output=True
        )
        print("✅ Success! All tables are now empty and ready for new data.")
    except subprocess.CalledProcessError as e:
        print(f"❌ Error executing command.")
        if e.stderr:
            print(f"Details: {e.stderr.decode('utf-8').strip()}")
        sys.exit(1)

if __name__ == "__main__":
    confirm_action()
    clear_database()