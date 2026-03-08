import subprocess

CONTAINER_NAME = "web-database-1"
DB_NAME = "codemeet_db"
DB_USER = "postgres"

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

    command = [
        "docker", "exec", "-i", CONTAINER_NAME,
        "psql", "-v", "ON_ERROR_STOP=1", "-U", DB_USER, "-d", DB_NAME
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

    except Exception as e:
        print(f"❌ Runtime Error: {e}")

if __name__ == "__main__":
    init_admin()