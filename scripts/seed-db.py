import uuid
import random
from datetime import datetime, timedelta, timezone
import subprocess
import sys

# --- CONFIGURATION ---
CONTAINER_NAME = "web-database-1"
DB_NAME = "codemeet_db"
DB_USER = "postgres"

# --- MOCK DATA POOLS ---
LANGUAGES = ["Java", "Python", "TypeScript", "Go", "Rust", "C#", "C++", "JavaScript", "Kotlin"]
EXPERIENCE = ["Junior", "Mid", "Senior", "Lead"]
LOOK_FOR = ["Mentor", "Mentee", "Coding Buddy", "Networking"]
OS = ["Linux", "macOS", "Windows"]
CITIES = ["New York", "London", "Tokyo", "Berlin", "San Francisco", "Austin", "Toronto"]
FIRST_NAMES = ["Alex", "Jordan", "Taylor", "Casey", "Morgan", "Riley", "Jamie", "Chris", "Sam", "Drew"]
LAST_NAMES = ["Smith", "Johnson", "Williams", "Jones", "Brown", "Davis", "Miller", "Wilson"]

DUMMY_PASSWORD_HASH = "$2a$10$vI8aWBnW3fID.021/sOWcow1Jv/C3Q/WvS22XW.Xw/8G6P4Xm.O2y"

def generate_sql(num_users=100):
    users_sql, profiles_sql, bios_sql = [], [], []

    for i in range(num_users):
        u_id = str(uuid.uuid4())
        f_name = random.choice(FIRST_NAMES)
        l_name = random.choice(LAST_NAMES)

        # Ensure uniqueness for constraints
        suffix = f"{i:03d}{random.randint(10, 99)}"
        email = f"{f_name.lower()}.{l_name.lower()}{suffix}@example.com"
        name = f"{f_name} {l_name} {suffix}"
        last_seen = (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 5))).strftime('%Y-%m-%d %H:%M:%S%z')

        # 1. users table
        users_sql.append(f"('{u_id}', '{email}', '{last_seen}', '{name}', '{DUMMY_PASSWORD_HASH}', NULL)")

        # 2. profiles table
        p_id = str(uuid.uuid4())
        about = f"Hi! I'm {f_name}, a dev from {random.choice(CITIES)}.".replace("'", "''")
        profiles_sql.append(f"('{p_id}', '{about}', {random.choice(['true', 'false'])}, '{u_id}')")

        # 3. bios table
        b_id = str(uuid.uuid4())
        bios_sql.append(
            f"('{b_id}', '{random.choice(CITIES)}', 'Night Owl', '{random.choice(EXPERIENCE)}', "
            f"'{random.choice(LOOK_FOR)}', '{random.choice(OS)}', '{random.choice(LANGUAGES)}', '{u_id}')"
        )

    sql = "BEGIN;\n"
    sql += "INSERT INTO users (id, email, last_seen_at, name, password, profile_picture) VALUES " + ",\n".join(users_sql) + ";\n"
    sql += "INSERT INTO profiles (id, about_me, is_online, user_id) VALUES " + ",\n".join(profiles_sql) + ";\n"
    sql += "INSERT INTO bios (id, city, coding_style, experience_level, look_for, preferred_os, primary_language, user_id) VALUES " + ",\n".join(bios_sql) + ";\n"
    sql += "COMMIT;"
    return sql

def seed():
    print(f"🚀 Starting seed process for {DB_NAME}...")
    sql_content = generate_sql(100)

    command = [
        "docker", "exec", "-i", CONTAINER_NAME,
        "psql", "-v", "ON_ERROR_STOP=1", "-U", DB_USER, "-d", DB_NAME
    ]

    try:
        process = subprocess.run(command, input=sql_content.encode('utf-8'), capture_output=True)

        if process.returncode != 0:
            print(f"❌ Error details:\n{process.stderr.decode('utf-8').strip()}")
        else:
            print(f"✅ Successfully seeded 100 users into '{DB_NAME}'.")

    except Exception as e:
        print(f"❌ Runtime Error: {e}")

if __name__ == "__main__":
    seed()