#!/usr/bin/env bash
set -euo pipefail

# run-all.sh - start the full stack for testers using Docker Compose
# Usage: ./run-all.sh    (Linux / macOS / WSL)
# This script changes directory to the repository root and starts the
# docker-compose configuration found in ./web/docker-compose.yaml

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Determine web directory containing the docker-compose.yaml.
# Support being invoked from repo root or from inside the web/ folder.
if [ -f "$SCRIPT_DIR/docker-compose.yaml" ]; then
  WEB_DIR="$SCRIPT_DIR"
elif [ -f "$SCRIPT_DIR/web/docker-compose.yaml" ]; then
  WEB_DIR="$SCRIPT_DIR/web"
elif [ -f "$(dirname "$SCRIPT_DIR")/web/docker-compose.yaml" ]; then
  WEB_DIR="$(dirname "$SCRIPT_DIR")/web"
else
  WEB_DIR="$SCRIPT_DIR/web"
fi

echo "[run-all] Starting services from $WEB_DIR using Docker Compose"
cd "$WEB_DIR" || { echo "ERROR: could not cd to $WEB_DIR" >&2; exit 3; }

# prefer the modern `docker compose` where available, fallback to `docker-compose`
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE_CMD=(docker-compose)
else
  echo "ERROR: neither 'docker compose' nor 'docker-compose' found on PATH" >&2
  exit 2
fi

echo "Using: ${DOCKER_COMPOSE_CMD[*]}"

# Run compose up in foreground so testers see logs; on Ctrl-C bring containers down.
"${DOCKER_COMPOSE_CMD[@]}" up --build --remove-orphans

EXIT_CODE=$?
echo "[run-all] docker compose exited with code $EXIT_CODE"
exit $EXIT_CODE

