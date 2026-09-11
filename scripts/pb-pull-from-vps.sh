#!/usr/bin/env bash
# Pull PocketBase data (DB + uploaded photos) from VPS → local.
# Run from repo root. Stops local PocketBase briefly for a clean copy.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_DATA="$ROOT/backend/pb_data"
REMOTE_HOST="${REMOTE_HOST:-tokiotours-vps}"
REMOTE_VOLUME_DATA="/var/lib/docker/volumes/elitetravelxp-app_pb_data/_data"
STAMP="$(date +%Y%m%d-%H%M%S)"

echo "→ Snapshot local pb_data (backup)…"
if [[ -d "$LOCAL_DATA" ]]; then
  mkdir -p "$ROOT/backend/.pb_backups"
  tar -C "$ROOT/backend" -czf "$ROOT/backend/.pb_backups/pb_data-local-$STAMP.tgz" pb_data
  echo "  saved backend/.pb_backups/pb_data-local-$STAMP.tgz"
fi

echo "→ Stopping local PocketBase (if running)…"
pkill -f './pocketbase serve' 2>/dev/null || true
sleep 1

echo "→ Stopping VPS PocketBase for consistent dump…"
ssh "$REMOTE_HOST" 'docker stop elite-pocketbase >/dev/null'

echo "→ Downloading VPS pb_data (records + photos)…"
rm -rf "$LOCAL_DATA"
mkdir -p "$LOCAL_DATA"
rsync -az --delete \
  -e ssh \
  "$REMOTE_HOST:$REMOTE_VOLUME_DATA/" \
  "$LOCAL_DATA/"

echo "→ Restarting VPS PocketBase…"
ssh "$REMOTE_HOST" 'docker start elite-pocketbase >/dev/null'

echo "✓ Local PocketBase data now matches VPS."
echo "  Start local stack:"
echo "    npm run pb"
echo "    npm run dev -- -p 3001"
echo "  Team Access: http://localhost:3001/team-access"
echo "  (local PB admin may use the VPS admin password after this pull)"
