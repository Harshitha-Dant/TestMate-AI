#!/bin/sh
# Container start for Render: restore the database from Backblaze B2, then run TestMate AI under
# Litestream so every change is copied back to B2 within about a second.
set -eu

CONFIG=/app/deploy/render/litestream.yml
DB="${TESTMATE_DB_PATH:-/var/data/testmate.db}"
export TESTMATE_DB_PATH="$DB"

# Fail fast with a clear message if a required setting is missing (values are never printed).
for name in TESTMATE_ADMIN_KEY LITESTREAM_ACCESS_KEY_ID LITESTREAM_SECRET_ACCESS_KEY B2_BUCKET B2_ENDPOINT B2_REGION; do
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    echo "[start] Missing environment variable $name. Set it in Render: service → Environment." >&2
    exit 1
  fi
done

# The online deployment must run in public mode (admin key, rate limits, locked request settings).
# The Docker image sets TESTMATE_PUBLIC_MODE=1; refuse to start if a dashboard setting overrides it.
if [ "${TESTMATE_PUBLIC_MODE:-}" != "1" ]; then
  echo "[start] TESTMATE_PUBLIC_MODE must be 1 for the online deployment. Remove the override or set it to 1 in Render: service → Environment." >&2
  exit 1
fi

mkdir -p "$(dirname "$DB")"

# Restore the latest backup. Does nothing if the database file already exists, and succeeds without
# restoring when the bucket has no backup yet (first deploy). A connection or permission error stops
# the start, so the app never runs with an empty database while a backup exists.
echo "[start] Restoring the database from Backblaze B2 (if a backup exists)"
litestream restore -config "$CONFIG" -if-db-not-exists -if-replica-exists "$DB"

if [ ! -f "$DB" ]; then
  echo "[start] No backup yet: creating a new database with the demo project"
  node --import tsx server/src/db/cli.ts seed
fi

echo "[start] Starting TestMate AI with continuous backup"
exec litestream replicate -config "$CONFIG" -exec "node --import tsx server/src/index.ts"
