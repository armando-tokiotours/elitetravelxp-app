#!/usr/bin/env bash
# Sync local catalog (+ branding) upload slots to the VPS host volume that
# elite-web mounts. Catalog is gitignored — code push alone never ships these.
#
# Usage:
#   npm run catalog:push
#   REMOTE_HOST=tokiotours-vps npm run catalog:push
#
# Does NOT touch PocketBase data or .env.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_HOST="${REMOTE_HOST:-tokiotours-vps}"
REMOTE_APP="${REMOTE_APP:-/root/elitetravelxp-app}"

LOCAL_CATALOG="$ROOT/public/uploads/catalog"
LOCAL_BRANDING="$ROOT/public/uploads/branding"
REMOTE_CATALOG="$REMOTE_APP/data/catalog-uploads"
REMOTE_BRANDING="$REMOTE_APP/data/branding-uploads"

if [[ ! -d "$LOCAL_CATALOG" ]]; then
  echo "✗ Missing local $LOCAL_CATALOG"
  exit 1
fi

echo "→ Ensuring remote upload dirs on ${REMOTE_HOST}…"
ssh "$REMOTE_HOST" "mkdir -p '$REMOTE_CATALOG' '$REMOTE_BRANDING' && chown -R 1001:1001 '$REMOTE_CATALOG' '$REMOTE_BRANDING' 2>/dev/null || true"

echo "→ Rsync catalog → ${REMOTE_HOST}:${REMOTE_CATALOG}/"
rsync -az --delete \
  --exclude '.gitkeep' \
  --exclude '.DS_Store' \
  "$LOCAL_CATALOG/" \
  "${REMOTE_HOST}:${REMOTE_CATALOG}/"

if [[ -d "$LOCAL_BRANDING" ]]; then
  echo "→ Rsync branding → ${REMOTE_HOST}:${REMOTE_BRANDING}/"
  rsync -az \
    --exclude '.gitkeep' \
    --exclude '.DS_Store' \
    "$LOCAL_BRANDING/" \
    "${REMOTE_HOST}:${REMOTE_BRANDING}/"
fi

echo "→ Fix ownership (container uid 1001)…"
ssh "$REMOTE_HOST" "chown -R 1001:1001 '$REMOTE_CATALOG' '$REMOTE_BRANDING' 2>/dev/null || true"

CAT_COUNT="$(ssh "$REMOTE_HOST" "ls -1 '$REMOTE_CATALOG' 2>/dev/null | wc -l | tr -d ' '")"
echo "✓ Catalog on VPS: ${CAT_COUNT} files (host volume data/catalog-uploads)"
echo "  Remount/rebuild once if elite-web is not yet mounting these dirs."
