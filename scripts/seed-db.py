import uuid
import random
from datetime import datetime, timedelta, timezone
import subprocess

# --- CONFIGURATION ---
CONTAINER_NAME = "web-database-1"
DB_NAME = "codemeet_db"
DB_USER = "postgres"

# --- MOCK DATA POOLS ---
LANGUAGES = ["Java", "Python", "TypeScript", "Go", "Rust", "C#", "C++", "JavaScript", "Kotlin"]
EXPERIENCE = ["Junior", "Mid", "Senior", "Lead"]
LOOK_FOR = ["Mentor", "Mentee", "Coding Buddy", "Networking"]
OS = ["Linux", "macOS", "Windows"]
GEO_POINTS = [
    (40.7128, -74.0060), (51.5072, -0.1276), (35.6762, 139.6503),
    (52.5200, 13.4050), (37.7749, -122.4194), (30.2672, -97.7431),
    (43.6532, -79.3832),
]
FIRST_NAMES = ["Alex", "Jordan", "Taylor", "Casey", "Morgan", "Riley", "Jamie", "Chris", "Sam", "Drew"]
LAST_NAMES = ["Smith", "Johnson", "Williams", "Jones", "Brown", "Davis", "Miller", "Wilson"]
MESSAGE_CONTENTS = ["Hey! Want to collaborate?", "Hi, nice profile!", "Are you open to mentoring?", "Hello!", "What projects are you working on?", "Lets build something!"]

# pswd: dummy
DUMMY_PASSWORD_HASH = "$2a$12$eIVKvWz5NO3FkU8ZcUfVaeyQzWrDpKBhRX./KLUCqwKrBfB9Izdke"
DEFAULT_ROLE = "USER"

def generate_sql(num_users=100):
    users_sql, profiles_sql, bios_sql = [], [], []
    connections_sql, messages_sql = [], []

    user_ids = []

    # 1. Generate Users, Profiles, Bios
    for i in range(num_users):
        u_id = str(uuid.uuid4())
        user_ids.append(u_id)

        f_name = random.choice(FIRST_NAMES)
        l_name = random.choice(LAST_NAMES)
        suffix = f"{i:03d}{random.randint(10, 99)}"
        email = f"{f_name.lower()}.{l_name.lower()}{suffix}@example.com"
        name = f"{f_name} {l_name} {suffix}"
        last_seen = (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 5))).strftime('%Y-%m-%d %H:%M:%S%z')

        # New boolean columns based on the latest schema updates
        hide_location = random.choice(['true', 'false'])
        hide_age = random.choice(['true', 'false'])

        users_sql.append(f"('{u_id}', '{email}', '{last_seen}', '{name}', '{DUMMY_PASSWORD_HASH}', NULL, '{DEFAULT_ROLE}', {hide_location}, {hide_age})")

        p_id = str(uuid.uuid4())
        about = f"Hi! I'm {f_name}, a developer who enjoys building projects and meeting new collaborators.".replace("'", "''")
        profiles_sql.append(f"('{p_id}', '{about}', '{u_id}')")

        b_id = str(uuid.uuid4())
        age = random.randint(18, 60)
        base_lat, base_lng = random.choice(GEO_POINTS)
        latitude = round(base_lat + ((random.random() - 0.5) * 0.35), 6)
        longitude = round(base_lng + ((random.random() - 0.5) * 0.35), 6)
        max_distance_km = random.randint(10, 120)
        bios_sql.append(
            f"('{b_id}', 'Night Owl', '{random.choice(EXPERIENCE)}', "
            f"'{random.choice(LOOK_FOR)}', '{random.choice(OS)}', '{random.choice(LANGUAGES)}', {latitude}, {longitude}, {max_distance_km}, {age}, '{u_id}')"
        )

    # 2. Generate Connections
    accepted_pairs = set()
    for i in range(num_users):
        # Connect with 2-5 random other users
        num_connections = random.randint(2, 5)
        targets = random.sample([j for j in range(num_users) if j != i], num_connections)

        for target_idx in targets:
            u1, u2 = user_ids[i], user_ids[target_idx]

            # Ensure we don't duplicate connection pairs in reverse
            pair = tuple(sorted([u1, u2]))
            if pair in accepted_pairs:
                continue

            c_id = str(uuid.uuid4())
            status = random.choices(['PENDING', 'ACCEPTED', 'SKIPPED', 'REJECTED', 'BLOCKED'], weights=[20, 50, 15, 10, 5])[0]
            created_at = (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 30))).strftime('%Y-%m-%d %H:%M:%S%z')

            connections_sql.append(f"('{c_id}', '{u1}', '{u2}', '{status}', '{created_at}')")

            if status == 'ACCEPTED':
                accepted_pairs.add(pair)

    # 3. Generate Messages for Accepted Connections
    for u1, u2 in accepted_pairs:
        num_messages = random.randint(1, 8)
        for _ in range(num_messages):
            m_id = str(uuid.uuid4())
            sender, recipient = (u1, u2) if random.choice([True, False]) else (u2, u1)
            content = random.choice(MESSAGE_CONTENTS)
            timestamp = (datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 100))).strftime('%Y-%m-%d %H:%M:%S%z')
            is_read = random.choice(['true', 'false'])
            messages_sql.append(f"('{m_id}', '{sender}', '{recipient}', '{content}', '{timestamp}', {is_read})")

    # Build final SQL string
    sql = "BEGIN;\n"
    sql += "INSERT INTO users (id, email, last_seen_at, name, password, profile_picture, role, hide_location, hide_age) VALUES\n" + ",\n".join(users_sql) + ";\n\n"
    sql += "INSERT INTO profiles (id, about_me, user_id) VALUES\n" + ",\n".join(profiles_sql) + ";\n\n"
    sql += "INSERT INTO bios (id, coding_style, experience_level, look_for, preferred_os, primary_language, latitude, longitude, max_distance_km, age, user_id) VALUES\n" + ",\n".join(bios_sql) + ";\n\n"

    if connections_sql:
        sql += "INSERT INTO connections (id, requester_id, recipient_id, status, created_at) VALUES\n" + ",\n".join(connections_sql) + ";\n\n"

    if messages_sql:
        sql += "INSERT INTO messages (id, sender_id, recipient_id, content, timestamp, is_read) VALUES\n" + ",\n".join(messages_sql) + ";\n\n"

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
            print(f"✅ Successfully seeded mock data (users, profiles, bios, connections, and messages) into '{DB_NAME}'.")

    except Exception as e:
        print(f"❌ Runtime Error: {e}")

if __name__ == "__main__":
    seed()