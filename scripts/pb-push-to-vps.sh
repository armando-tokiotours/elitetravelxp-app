#!/usr/bin/env bash
# Push local PocketBase data (DB + uploaded photos) → VPS.
# ONLY run when you explicitly want production data replaced by local.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_DATA="$ROOT/backend/pb_data"
REMOTE_HOST="${REMOTE_HOST:-tokiotours-vps}"
REMOTE_VOLUME_DATA="/var/lib/docker/volumes/elitetravelxp-app_pb_data/_data"
STAMP="$(date +%Y%m%d-%H%M%S)"

if [[ ! -d "$LOCAL_DATA" ]]; then
  echo "No local backend/pb_data — nothing to push."
  exit 1
fi

if [[ "${I_UNDERSTAND_REPLACE_VPS_DATA:-}" != "yes" ]]; then
  echo "This REPLACES all PocketBase data on the VPS with your local copy"
  echo "(records + photos). Code is NOT deployed by this script."
  echo ""
  echo "To confirm, run:"
  echo "  I_UNDERSTAND_REPLACE_VPS_DATA=yes npm run pb:push"
  exit 2
fi

echo "→ Backup VPS pb_data first…"
ssh "$REMOTE_HOST" "docker stop elite-pocketbase >/dev/null; \
  mkdir -p /root/elitetravelxp-app/backend/.pb_backups; \
  tar -C /var/lib/docker/volumes/elitetravelxp-app_pb_data -czf \
    /root/elitetravelxp-app/backend/.pb_backups/pb_data-vps-$STAMP.tgz _data"

echo "→ Stopping local PocketBase (avoid half-written DB)…"
pkill -f './pocketbase serve' 2>/dev/null || true
sleep 1

echo "→ Uploading local pb_data → VPS…"
rsync -az --delete \
  -e ssh \
  "$LOCAL_DATA/" \
  "$REMOTE_HOST:$REMOTE_VOLUME_DATA/"

echo "→ Restarting VPS PocketBase…"
ssh "$REMOTE_HOST" 'docker start elite-pocketbase >/dev/null'

echo "✓ VPS PocketBase data now matches local (including photos)."
echo "  Verify: https://travelexperiencesgroup.com/team-access"
