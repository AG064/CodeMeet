# CodeMeet

A full-stack recommendation application designed to connect developers, programmers, and hobbyists based on their programming languages, interests, and characteristics.

## Project Overview

CodeMeet is a social platform tailored for coders. It provides:
- Secure User Authentication (JWT and bcrypt)
- Profile & Bio creation to highlight tech stack and interests
- An intelligent recommendation algorithm with weighted scoring
- A connection system to link with like-minded peers
- Real-time WebSocket chat with file attachments
- Extensive UI customisation (themes, fonts, backgrounds)

## Features

### Core
- **Registration & Login** — JWT-based authentication with bcrypt-hashed passwords. Logout available from every authenticated page.
- **Bio & Profile** — Six biographical data points (primary language, experience level, looking for, preferred OS, coding style, city) plus a free-text "About Me" (1 000 chars). All editable at any time via the onboarding form or Settings.
- **Profile Picture** — Upload / change avatar; placeholder icon shown when none is set. Stored on the file system at `~/.codemeet/uploads/` (survives rebuilds).
- **Recommendation Engine** — Weighted scoring across all six bio fields (language 30 pts, city 25 pts, lookFor 20 pts, experience 15 pts, OS 5 pts, codingStyle 5 pts). Returns a maximum of 10 results, strongest first.
- **Connections** — Send / accept / reject connection requests, disconnect from existing connections. Real-time WebSocket notifications for incoming requests.
- **Chat** — Full real-time STOMP messaging: paginated history, file/image attachments, read receipts (✓/✓✓), typing indicators, in-conversation search, unread-message badge.
- **Profile Visibility** — Profiles return 404 to users who are not recommended, pending, or connected. Emails are never exposed to other users.

### Real-time
- **Online Presence** — Green / grey dot on avatars; "Last seen" timestamps tracked on WebSocket disconnect.
- **Typing Indicator** — Animated "typing…" dots with debounce, powered by a dedicated STOMP topic.
- **Notification Bell** — Connection-request and unread-message counts in the header.

### UI / UX Customisation
- **Theme System** — Five themes (Default, GitHub Dark, VS Code Dark+, Dracula, Custom). Custom theme derives a full Tailwind palette from three user-picked hex colours via HSL manipulation. Restored before first paint via an inline `<script>` in `index.html`.
- **Font Picker** — Nine presets: Inter (default), five Monaspace variants (Argon, Krypton, Neon, Radon, Xenon — self-hosted woff2), JetBrains Mono, Fira Code, System UI.
- **Background Picker** — Five CSS pattern presets (Dot Matrix, Grid Lines, Crosshatch, Gradient Mesh, None) plus custom image upload (stored as data-URL in localStorage).
- **Privacy Controls** — Toggleable visibility for online status, typing indicator, and read receipts.

### Responsive Design
- Desktop sidebar navigation + mobile bottom-nav bar.
- Chat view switches between sidebar list and conversation on small screens.
- All grids collapse from multi-column to single-column with Tailwind responsive breakpoints.

### Other
- **404 Page** — Catch-all route for unknown URLs.
- **Privacy Statement** — Static page with back-navigation.
- **SPA Routing** — Backend permits all non-`/api/**` paths so direct URL navigation works without 403.

## Technology Stack

### Backend
| Dependency | Version |
|---|---|
| Java | 21 |
| Spring Boot | 4.0.3 |
| Spring Boot Starter Web | — |
| Spring Boot Starter Data JPA | — |
| Spring Boot Starter Security | — |
| Spring Boot Starter WebSocket | — |
| PostgreSQL (JDBC driver) | — |
| JJWT (API + Impl + Jackson) | 0.12.5 |
| Lombok | — |
| Maven (wrapper included) | — |

### Frontend
| Dependency | Version |
|---|---|
| React | 19.x |
| TypeScript | 5.x |
| Vite | 7.x |
| Tailwind CSS | 4.x |
| React Router DOM | 7.x |
| Axios | — |
| @stomp/stompjs | — |

## Setup and Installation

### Prerequisites
- **Java JDK 21** — [Eclipse Temurin](https://adoptium.net/temurin/releases/?version=21) or `sudo apt install openjdk-21-jdk`
- **Node.js 18+** — [nodejs.org](https://nodejs.org/) or via NVM
- **PostgreSQL** — [postgresql.org/download](https://www.postgresql.org/download/) or `sudo apt install postgresql postgresql-contrib`
- **Maven** (optional) — a Maven wrapper (`mvnw` / `mvnw.cmd`) is included in the backend directory

### Database Setup
1. Open `psql` or pgAdmin.
2. Create the database: `CREATE DATABASE codemeet_db;`
3. Note the credentials for the next step.

### Backend
```bash
cd backend

# Configure database credentials
# Edit src/main/resources/application.properties:
#   spring.datasource.url=jdbc:postgresql://localhost:5432/codemeet_db
#   spring.datasource.username=<your_user>
#   spring.datasource.password=<your_password>

./mvnw clean install        # compile & run tests
./mvnw spring-boot:run      # start on http://localhost:8080
```

### Frontend
```bash
cd frontend
npm install
npm run dev                  # start on http://localhost:5173
```

Optionally create `frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:8080/api
VITE_WS_BASE_URL=http://localhost:8080
```

### Docker (recommended)

The project ships with a multi-stage `Dockerfile` and a `docker-compose.yaml` that bundles everything — **no local Java, Node, or PostgreSQL install required**.

#### Quick start
```bash
docker compose up --build
```

This single command will:
1. **Build the frontend** (Node 20-Alpine) — installs deps and runs `npm run build`.
2. **Build the backend** (Maven 3.9 + Temurin 21) — resolves dependencies, copies the compiled frontend into Spring's `static/` resources, and packages the fat JAR.
3. **Produce a minimal runtime image** (Temurin 21 JRE-Alpine) containing only the final JAR.
4. **Start PostgreSQL 16** (Alpine) with a health-check, creating the database automatically.
5. **Start the app** on `http://localhost:8080` once Postgres is healthy.

The frontend is served by Spring Boot itself, so you only need **one URL** — `http://localhost:8080`.

#### Services

| Service | Image | Port | Notes |
|---|---|---|---|
| `database` | `postgres:16-alpine` | 5432 | User `postgres`, password `12345`, DB `codemeet_db` |
| `app` | Built from `./Dockerfile` | 8080 | Connects to the `database` service via Docker networking |

Database data is persisted in the `db_data` named volume, so it survives container restarts.

#### Useful commands
```bash
# Start in detached mode
docker compose up -d --build

# View logs
docker compose logs -f app

# Stop and keep data
docker compose down

# Stop and wipe database volume (fresh start)
docker compose down -v

# Rebuild only the app (after code changes)
docker compose up --build app
```

#### Environment variables
The `docker-compose.yaml` passes database credentials to Spring Boot via environment variables that override `application.properties`:

| Variable | Default | Purpose |
|---|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://database:5432/codemeet_db` | JDBC connection string |
| `SPRING_DATASOURCE_USERNAME` | `postgres` | DB username |
| `SPRING_DATASOURCE_PASSWORD` | `12345` | DB password |

Override them in a `.env` file next to `docker-compose.yaml` or inline:
```bash
SPRING_DATASOURCE_PASSWORD=supersecret docker compose up --build
```

Both Docker and local setups now use the same database name (`codemeet_db`), username (`postgres`), and password (`12345`) by default, so switching between them is seamless.

## Usage
1. Open `http://localhost:5173`.
2. Register a new account.
3. Complete the Bio onboarding (six data points + optional About Me).
4. Browse recommendations on **Matches** — connect or dismiss.
5. Manage requests on **Connections**.
6. Chat in real-time with connected users (text + file attachments).
7. Customise appearance in **Settings** (theme, font, background, privacy).

## REST API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Authenticate and receive JWT |
| GET | `/api/me` | Current user summary (id, name, picture) |
| GET | `/api/me/bio` | Current user's bio |
| POST | `/api/me/bio` | Create / update bio |
| GET | `/api/me/profile` | Current user's profile (aboutMe) |
| POST | `/api/me/profile` | Create / update profile |
| POST | `/api/me/profile-picture` | Upload avatar |
| POST | `/api/me/alias` | Change display name |
| GET | `/api/users/{id}` | Public user summary |
| GET | `/api/users/{id}/bio` | Public user bio |
| GET | `/api/users/{id}/profile` | Public user profile |
| GET | `/api/recommendations` | Up to 10 recommendation IDs |
| GET | `/api/connections` | Connected user IDs |
| POST | `/api/connections/request/{id}` | Send connection request |
| POST | `/api/connections/{id}/accept` | Accept request |
| POST | `/api/connections/{id}/reject` | Reject request |
| DELETE | `/api/connections/disconnect/{id}` | Disconnect |
| GET | `/api/chat/partners` | Chat partner list |
| GET | `/api/chat/history/{id}` | Paginated message history |
| POST | `/api/chat/upload` | Upload chat attachment |

All `/api/**` routes (except auth) require a valid `Authorization: Bearer <token>` header. Profile endpoints return **404** if the caller lacks permission.
