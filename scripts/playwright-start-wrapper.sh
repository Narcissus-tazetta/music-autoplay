#!/usr/bin/env bash
set -euo pipefail

# Simple Playwright wrapper: reuse running server if port is busy and healthy,
# otherwise optionally build and exec the start script in foreground.

PORT=${PORT:-3000}
URL=${PLAYWRIGHT_BASE_URL:-"http://localhost:${PORT}"}
TIMEOUT=${START_WRAPPER_TIMEOUT:-30}

echo "checking ${URL} (port ${PORT})"

if lsof -i :"${PORT}" >/dev/null 2>&1; then
  echo "port ${PORT} in use — waiting up to ${TIMEOUT}s for healthy response"
  for _ in $(seq 1 ${TIMEOUT}); do
    if curl -sSf "${URL}" >/dev/null 2>&1; then
      echo "server healthy"
      exit 0
    fi
    sleep 1
  done
  echo "timeout waiting for existing server"
  exit 1
fi

# Build unless explicitly skipped (PLAYWRIGHT_SKIP_BUILD=1)
if [ "${PLAYWRIGHT_SKIP_BUILD:-0}" != "1" ]; then
  echo "building..."
  bun run build
fi

echo "starting server..."
exec bun run start

