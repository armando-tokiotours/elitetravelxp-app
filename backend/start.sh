#!/usr/bin/env bash
# Start PocketBase locally (schema migrations auto-apply).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"

EMAIL="${PB_ADMIN_EMAIL:-admin@travelexperiencesgroup.com}"
PASSWORD="${PB_ADMIN_PASSWORD:-EliteTravelAdmin2026!}"

# Ensure superuser exists (idempotent)
./pocketbase superuser upsert "$EMAIL" "$PASSWORD" || true

echo "→ PocketBase http://127.0.0.1:8090"
echo "  Admin UI: http://127.0.0.1:8090/_/"
echo "  Login: $EMAIL"
exec ./pocketbase serve --http=127.0.0.1:8090
