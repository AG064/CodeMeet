# CodeMeet

> A full-stack platform that connects developers, programmers, and hobbyists based on their programming languages, interests, and personal characteristics.

---

## Overview

CodeMeet is a social network built for coders. Create a profile, describe your tech stack, and let the recommendation engine find people worth knowing - then chat with them in real time.

## GraphQL API

This project exposes a GraphQL API alongside the REST API. The GraphQL documentation and quick-start (queries, subscriptions, playground info) is in `web/README_GRAPHQL.md` - see that file for GraphQL-specific usage and examples.

**Key capabilities:**
- Secure JWT + bcrypt authentication
- Rich developer profiles (tech stack, experience, OS, coding style, location, and more)
- Intelligent weighted recommendation algorithm
- Connection requests & contact management
- Real-time STOMP/WebSocket chat with file attachments
- Extensive UI customisation - themes, fonts, backgrounds

---

## Features

### Authentication & Profiles
- **Register & Login** - JWT-based auth with bcrypt-hashed passwords. Logout accessible from every authenticated page.
- **Bio** - Seven data points: primary language, experience level, looking for, preferred OS, coding style, GPS location + match radius, and age. All editable at any time.
- **About Me** - Free-text field up to 1 000 characters.
- **Profile Picture** - Upload, replace, or remove your avatar. Stored at `~/.codemeet/uploads/` and survives container rebuilds.

### Recommendation Engine
Weighted scoring across bio fields returns up to 10 matches, strongest first. Profiles below the minimum threshold are discarded.

| Signal | Points |
|---|---|
| Primary language | 30 |
| GPS distance | up to 25 |
| Looking for | 20 |
| Experience level | 15 |
| Age proximity | up to 10 |
| Preferred OS | 5 |
| Coding style | 5 |

You can skip a profile for 7 days, undo a skip, and view your full skip list.

### Connections & Chat
- **Connections** - Send, accept, or reject requests; disconnect at any time. Real-time WebSocket notifications for incoming requests.
- **Chat** - Full STOMP messaging with paginated history, file/image attachments, read receipts (✓ / ✓✓), typing indicators, in-conversation search, and an unread-message badge.
- **Profile Visibility** - Profiles return 404 to anyone who is not a recommendation, pending connection, or existing contact. Emails are never exposed.

### Real-time Presence
- **Online indicator** - Green/grey dot on every avatar.
- **Last seen** - Timestamps updated on WebSocket disconnect.
- **Typing indicator** - Animated "typing…" dots with debounce, via a dedicated STOMP topic.
- **Notification Bell** - Aggregated count of pending requests and unread messages.

### UI Customisation
- **Themes** - Default, GitHub Dark, VS Code Dark+, Dracula, and a fully custom theme derived from three user-picked hex colours via HSL manipulation. Applied before first paint to prevent flash.
- **Fonts** - Nine presets: Inter (default), five self-hosted Monaspace variants (Argon, Krypton, Neon, Radon, Xenon), JetBrains Mono, Fira Code, System UI.
- **Backgrounds** - Five CSS pattern presets (Dot Matrix, Grid Lines, Crosshatch, Gradient Mesh, None) plus a custom image upload stored as a data-URL.
- **Privacy Controls** - Toggle visibility for avatar, GPS radius, age, and last-seen status.

### Responsive Design
Desktop sidebar navigation collapses to a mobile bottom nav bar. The chat view switches between a conversation list and a single conversation on small screens. All grids use Tailwind responsive breakpoints.

---

## Tech Stack

### Backend

| Technology | Version |
|---|---|
| Java | 21 |
| Spring Boot | 4.0.3 |
| Spring Security | - |
| Spring WebSocket | - |
| PostgreSQL + PostGIS | - |
| JJWT | 0.12.5 |
| Lombok | - |
| Maven (wrapper included) | - |

### Frontend

| Technology | Version |
|---|---|
| React | 19.2 |
| TypeScript | 5.9 |
| Vite | 7.3 |
| Tailwind CSS | 4.2 |
| React Router DOM | 7.13 |
| Axios | 1.13 |
| @stomp/stompjs | 7.3 |
| SockJS Client | 1.6 |

---

## Getting Started

### Step 0 - Install Docker

Docker Desktop bundles the Docker Engine, CLI, and Compose plugin in a single installer. Choose your OS:

#### Windows
1. Download **Docker Desktop for Windows** from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/).
2. Run the installer (`Docker Desktop Installer.exe`) and follow the wizard.
3. Start Docker Desktop from the Start menu and wait for the whale icon to appear in the system tray.
4. Verify in PowerShell:
   ```powershell
   docker --version
   docker compose version
   ```

#### macOS
1. Download **Docker Desktop for Mac** from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/).
   Pick the correct chip: **Apple Silicon (M1/M2/M3/M4)** or **Intel**.
2. Open the `.dmg`, drag Docker to Applications, and launch it.
3. Grant the necessary permissions when prompted.
4. Wait for the whale icon in the menu bar to stop animating.
5. Verify in Terminal:
   ```bash
   docker --version
   docker compose version
   ```

> **macOS requirement:** Docker Desktop 4.42+ requires macOS Ventura 13.3 or later.

#### Linux (Ubuntu / Debian)
On Linux, Docker Desktop is optional. The recommended approach is to install **Docker Engine** directly - Compose is included as a plugin:

```bash
# Remove any old versions
sudo apt-get remove docker docker-engine docker.io containerd runc

# Install dependencies
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

# Add Docker's official GPG key and repository
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine + Compose plugin
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

# (Optional) Run Docker without sudo
sudo usermod -aG docker $USER
newgrp docker
```

Verify:
```bash
docker --version
docker compose version
```

> For other distros (Fedora, RHEL, Debian, etc.) follow the official guide: [docs.docker.com/engine/install](https://docs.docker.com/engine/install/).

---

### Step 1 - Run CodeMeet

All you need is **Docker** (installed above).

```bash
# From the project root (./web)
docker compose up -d
```

> Docker Compose is included in Docker Desktop and in Docker Engine v2+. No separate install needed.

That single command will:
1. Build the frontend (Node 20-Alpine) - install deps and run `npm run build`.
2. Build the backend (Maven 3.9 + Temurin 21) - compile, copy the frontend into Spring's `static/` resources, and package the fat JAR.
3. Produce a minimal runtime image (Temurin 21 JRE-Alpine).
4. Start PostgreSQL 16 + PostGIS with a health-check, creating the database automatically.
5. Start the app at **http://localhost:8080** once Postgres is healthy.

### Step 2 (optional) - Developer Mode

If you prefer to run services individually:

#### Prerequisites
- **Java JDK 21** - [Eclipse Temurin](https://adoptium.net/temurin/releases/?version=21) or `sudo apt install openjdk-21-jdk`
- **Node.js 18+** - [nodejs.org](https://nodejs.org/) or via NVM
- **PostgreSQL + PostGIS** - [postgresql.org](https://www.postgresql.org/download/) or `sudo apt install postgresql postgresql-contrib postgis`

#### 1. Configure environment variables

Both `.env` files are **optional** - the project has sensible defaults built in. The one exception is dev mode, where the backend needs to reach the database on `localhost` instead of the Docker network.

Create `./web/.env` with just this one line:
```env
DATASOURCE_URL=jdbc:postgresql://localhost:5432/codemeet_db
```

Optionally, create `frontend/.env` if you want to override the API URLs:
```env
VITE_API_BASE_URL=http://localhost:8080/api
VITE_WS_BASE_URL=http://localhost:8080
```

#### 2. Start the database

```bash
# From the project root (./web)
docker compose up database -d
```

#### 3. Start the backend

```bash
cd backend
./mvnw clean install          # compile & run tests
./mvnw spring-boot:run        # http://localhost:8080
```

#### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

> In production (Docker), the frontend is served by Spring Boot - only one URL needed.

### Useful Commands

#### Docker Compose

```bash
# Stream logs
docker compose logs -f app

# Stop, keep data
docker compose down

# Stop and wipe database volume (fresh start)
docker compose down -v

# Rebuild only the app after code changes
docker compose up --build app
```

#### Database & Seed Scripts

Run from the `frontend/` directory with `npm run <script>`.

**Docker mode** (app must be running via `docker compose up`):

```bash
npm run docker:init-seed   # seed the database with 100 test users
npm run docker:init-admin  # create an admin account
npm run docker:drop-db     # wipe the database
```

**Dev mode:**

```bash
npm run dev:init-seed      # seed the database with 100 test users
npm run dev:init-admin     # create an admin account
npm run dev:drop-db        # wipe the database
```

Both Docker and local setups use the same defaults - `codemeet_db` / `postgres` / `54321` - so switching between them is seamless.

---

## Usage

1. Open `http://localhost:8080` (or `http://localhost:5173` in dev mode).
2. Register a new account.
3. Complete the Bio onboarding (GPS location, match radius, age, tech stack, About Me).
4. Browse recommendations on **Matches** - connect or dismiss.
5. Manage incoming and outgoing requests on **Connections**.
6. Chat in real time with connected users (text + file attachments).
7. Customise your experience in **Settings** (theme, font, background, privacy).

---

## REST API

All `/api/**` routes except `/api/auth/**` require an `Authorization: Bearer <token>` header. Profile endpoints return **404** if the caller lacks permission to view that profile.

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Authenticate and receive JWT |
| GET | `/api/me` | Current user summary (id, name, picture) |
| GET | `/api/me/bio` | Current user's bio |
| POST | `/api/me/bio` | Create / update bio |
| GET | `/api/me/profile` | Current user's profile (About Me) |
| POST | `/api/me/profile` | Create / update profile |
| GET | `/api/me/privacy` | Current user's privacy settings |
| POST | `/api/me/privacy` | Create / update privacy settings |
| POST | `/api/me/profile-picture` | Upload avatar |
| DELETE | `/api/me/profile-picture` | Remove avatar |
| POST | `/api/me/alias` | Change display name |
| GET | `/api/users/{id}` | Public user summary |
| GET | `/api/users/{id}/bio` | Public user bio |
| GET | `/api/users/{id}/profile` | Public user profile |
| GET | `/api/recommendations` | Up to 10 recommendation IDs |
| POST | `/api/recommendations/skip/{id}` | Skip a profile for 7 days |
| DELETE | `/api/recommendations/skip/{id}` | Undo a skip |
| GET | `/api/recommendations/skipped` | List active skipped profiles |
| GET | `/api/connections` | Connected user IDs |
| POST | `/api/connections/request/{id}` | Send connection request |
| POST | `/api/connections/{id}/accept` | Accept request |
| POST | `/api/connections/{id}/reject` | Reject request |
| DELETE | `/api/connections/disconnect/{id}` | Disconnect |
| GET | `/api/block` | List blocked users |
| POST | `/api/block/{id}` | Block a user |
| DELETE | `/api/block/{id}` | Unblock a user |
| GET | `/api/chat/partners` | Chat partner list |
| GET | `/api/chat/history/{id}` | Paginated message history |
| GET | `/api/chat/presence` | Presence snapshot for connected users |
| POST | `/api/chat/read/{id}` | Mark a chat as read |
| POST | `/api/chat/send/{id}` | REST fallback for sending a message |
| POST | `/api/chat/upload/{id}` | Upload a chat attachment |
