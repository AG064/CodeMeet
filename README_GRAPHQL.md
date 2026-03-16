# GraphQL - Quick Guide

This file documents how to use the GraphQL API provided by the backend, how to run the service for testing, and a few troubleshooting tips useful for testers.

## Endpoints

- GraphQL HTTP endpoint: `POST http://localhost:8080/graphql`
- In-page tester / playground (dev only): `http://localhost:8080/playground`
- REST endpoints still available (examples below): `GET http://localhost:8080/api/me`

## Run the full stack (recommended for testers)

From the repository root you can start Postgres + backend + adminer with one command (Docker required):

Linux / WSL / macOS
```bash
chmod +x ./run-all.sh   # once
./run-all.sh
```

Windows PowerShell
```powershell
.\run-all.ps1
```

Before running the compose stack copy `web/.env.example` to `web/.env`

## Enabling the playground (dev)

Start the backend in developer mode to enable the in-browser playground at `/playground`.

Using the Maven wrapper (WSL / macOS / Linux):
```bash
cd web/backend
./mvnw spring-boot:run -Dspring-boot.run.arguments=-d
```

Or set the active profile:
```bash
SPRING_PROFILES_ACTIVE=dev ./mvnw spring-boot:run
```

When running the compose stack the backend image by default runs normally (not dev). Use the `./mvnw` approach when you want the playground.

## Authentication (JWT)

The API uses JWT for protected GraphQL queries and REST endpoints.

1. Register a user (if no account exists):
```bash
curl -s -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"secret","name":"alice"}'
```

2. Login to obtain a token:
```bash
curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"alice@example.com","password":"secret"}'
```
The response body contains the raw JWT string. Use it in the `Authorization` header as `Authorization: Bearer <token>`.

## Example GraphQL queries

Recommendations with bio + profile
```graphql
{
  recommendations {
    id
    name
    profilePicture
    bio { id city primaryLanguage }
    profile { id aboutMe }
  }
}
```

Fetch current user, bio and profile (authenticated)
```graphql
{
  me { id name profilePicture }
  myBio { id city primaryLanguage age }
  myProfile { id aboutMe }
}
```

Run using curl (replace `$TOKEN` with a valid JWT):
```bash
curl -s -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"{ me { id name } }"}'
```

## Subscriptions

The server exposes a `presenceChanged` subscription for realtime presence updates (published by `PresenceService`).

Example (GraphQL over WebSocket):
```graphql
subscription {
  presenceChanged { userId becameOffline }
}
```

The in-page tester does not support subscriptions. Use a GraphQL client that supports WebSocket subscriptions (GraphiQL/GraphQL Playground, Apollo Client, or a CLI tool) to connect to the server's websocket endpoint (same `/graphql` path using the GraphQL over WebSocket protocol).

## Performance notes

- To avoid N+1 database queries the GraphQL resolvers use batch fetch methods for `User.bio` and `User.profile` (backend performs grouping by user id).
- If you add additional list-resolving fields, prefer repository methods that fetch multiple rows by user id in one query.

## Troubleshooting

- PostGIS / DB init: The project `web/docker-compose.yaml` uses `postgis/postgis` image. If you start the backend against a different Postgres instance that lacks PostGIS, database initialization scripted in `src/main/resources/schema.sql` may fail. We can skip SQL init by setting `-Dspring.sql.init.mode=never` or by using the included Docker Compose which provides PostGIS.
- Port conflicts: backend exposes port `8080`. If `8080` is in use, stop the conflicting service or run the backend on another port (`-Dserver.port=8081`).
- Invalid credentials on login: ensure the user exists in the DB (register first), and that the password is correct. Check backend logs - `AuthController` logs debug messages during login attempts.

## Files of interest

- GraphQL schema: `src/main/resources/graphql/schema.graphqls`
- GraphQL resolvers: `src/main/java/.../graphql/GraphqlController.java`
- Presence publishing: `src/main/java/.../service/PresenceService.java`
- In-page tester: `src/main/resources/static/playground.html`