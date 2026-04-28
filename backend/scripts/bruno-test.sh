#!/usr/bin/env bash
#
# Purpose: Run the Bruno API collection (backend/bruno/) against a running backend.
# Usage:   ./scripts/bruno-test.sh                # uses environment 'local'
#          ./scripts/bruno-test.sh prod           # alternate environment file
#          BACKEND_URL=http://1.2.3.4:3000 ./scripts/bruno-test.sh
# Goal:    Smoke / regression test the live HTTP API surface from CI or a
#          developer's laptop without needing the Bruno desktop app.
#
# Requirements:
# - The backend is reachable at $BACKEND_URL (default http://localhost:3000).
# - The backend has a logged-in-able admin user — the in-memory mock auto-creates
#   admin@example.com / Admin1234! at boot when the user table is empty.
#
# Exit code: 0 if every request passes its `tests` block, non-zero otherwise.
#
set -euo pipefail

ENV="${1:-local}"
HERE="$(cd "$(dirname "$0")" && pwd)"
BRUNO_DIR="$(cd "$HERE/../bruno" && pwd)"

if [ ! -d "$BRUNO_DIR" ]; then
  echo "[bruno-test] Collection not found at $BRUNO_DIR" >&2
  exit 1
fi

if [ ! -f "$BRUNO_DIR/environments/$ENV.bru" ]; then
  echo "[bruno-test] Environment file '$ENV.bru' not found in $BRUNO_DIR/environments/" >&2
  echo "[bruno-test] Available:" >&2
  ls "$BRUNO_DIR/environments" >&2 || true
  exit 1
fi

# Allow CI override of baseUrl via env var without editing the .bru file.
EXTRA_ARGS=()
if [ -n "${BACKEND_URL:-}" ]; then
  EXTRA_ARGS+=(--env-var "baseUrl=${BACKEND_URL}")
fi

echo "[bruno-test] Running collection in $BRUNO_DIR (env: $ENV)"
cd "$BRUNO_DIR"

# Prefer a local install (devDependency); fall back to npx if missing.
BRU_BIN="$HERE/../node_modules/.bin/bru"
if [ ! -x "$BRU_BIN" ]; then
  BRU_BIN="npx --yes @usebruno/cli@latest"
fi

# shellcheck disable=SC2086
$BRU_BIN run --env "$ENV" ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"} --reporter-html "$HERE/../bruno-report.html"
