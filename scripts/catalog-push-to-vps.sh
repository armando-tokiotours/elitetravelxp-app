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
LOCAL_HERO="$ROOT/public/uploads/hero-panels"
REMOTE_CATALOG="$REMOTE_APP/data/catalog-uploads"
REMOTE_BRANDING="$REMOTE_APP/data/branding-uploads"
REMOTE_HERO="$REMOTE_APP/data/hero-panel-uploads"

if [[ ! -d "$LOCAL_CATALOG" ]]; then
  echo "✗ Missing local $LOCAL_CATALOG"
  exit 1
fi

echo "→ Ensuring remote upload dirs on ${REMOTE_HOST}…"
ssh "$REMOTE_HOST" "mkdir -p '$REMOTE_CATALOG' '$REMOTE_BRANDING' '$REMOTE_HERO' && chown -R 1001:1001 '$REMOTE_CATALOG' '$REMOTE_BRANDING' '$REMOTE_HERO' 2>/dev/null || true"

sync_dir() {
  local label="$1" local_dir="$2" remote_dir="$3" delete_flag="${4:-}"
  if [[ ! -d "$local_dir" ]]; then
    echo "· skip ${label} (no local dir)"
    return 0
  fi
  echo "→ Rsync ${label} → ${REMOTE_HOST}:${remote_dir}/"
  # shellcheck disable=SC2086
  rsync -az ${delete_flag} \
    --exclude '.gitkeep' \
    --exclude '.DS_Store' \
    "$local_dir/" \
    "${REMOTE_HOST}:${remote_dir}/"
}

# --delete keeps VPS slots identical to local (same IDs, no orphans).
sync_dir "catalog" "$LOCAL_CATALOG" "$REMOTE_CATALOG" "--delete"
sync_dir "branding" "$LOCAL_BRANDING" "$REMOTE_BRANDING" "--delete"
sync_dir "hero-panels" "$LOCAL_HERO" "$REMOTE_HERO" "--delete"

echo "→ Fix ownership (container uid 1001)…"
ssh "$REMOTE_HOST" "chown -R 1001:1001 '$REMOTE_CATALOG' '$REMOTE_BRANDING' '$REMOTE_HERO' 2>/dev/null || true"

CAT_COUNT="$(ssh "$REMOTE_HOST" "ls -1 '$REMOTE_CATALOG' 2>/dev/null | wc -l | tr -d ' '")"
BR_COUNT="$(ssh "$REMOTE_HOST" "ls -1 '$REMOTE_BRANDING' 2>/dev/null | wc -l | tr -d ' '")"
HP_COUNT="$(ssh "$REMOTE_HOST" "ls -1 '$REMOTE_HERO' 2>/dev/null | wc -l | tr -d ' '")"
echo "✓ VPS media folders: catalog=${CAT_COUNT} branding=${BR_COUNT} hero-panels=${HP_COUNT}"
echo "  (elite-web mounts data/*-uploads — recreate container once after compose change)"
