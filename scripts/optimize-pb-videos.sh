#!/usr/bin/env bash
# Re-encode PocketBase branding MP4s in-place for fast mobile start.
# Keeps sharp quality (max longer edge 1280, CRF 22) + faststart, strips audio.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STORAGE="${1:-$ROOT/backend/pb_data/storage}"
FFMPEG="${FFMPEG:-ffmpeg}"

if ! command -v "$FFMPEG" >/dev/null 2>&1; then
  echo "ffmpeg not found. Install with: brew install ffmpeg" >&2
  exit 1
fi

if [[ ! -d "$STORAGE" ]]; then
  echo "Storage dir missing: $STORAGE" >&2
  exit 1
fi

filesize() {
  wc -c < "$1" | tr -d ' '
}

count=0
saved=0
while IFS= read -r -d '' f; do
  # Skip temp leftovers from a prior run
  case "$f" in
    *.opt.tmp.mp4) continue ;;
  esac
  count=$((count + 1))
  before=$(filesize "$f")
  tmp="${f}.opt.tmp.mp4"
  echo "→ $(basename "$f") ($(( before / 1024 )) KB)"
  if ! "$FFMPEG" -y -hide_banner -loglevel error -i "$f" \
    -vf "scale='min(1280,iw)':'min(1280,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2" \
    -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 22 -preset medium \
    -movflags +faststart -an \
    "$tmp"; then
    echo "  ✗ ffmpeg failed — left original"
    rm -f "$tmp"
    continue
  fi
  after=$(filesize "$tmp")
  # Keep if smaller, or only slightly larger (faststart overhead on tiny files)
  if (( after < before * 105 / 100 )); then
    mv "$tmp" "$f"
    saved=$(( saved + before - after ))
    echo "  ✓ $(( before / 1024 )) → $(( after / 1024 )) KB"
  else
    rm -f "$tmp"
    echo "  · skipped (no size win)"
  fi
done < <(find "$STORAGE" -type f \( -iname '*.mp4' -o -iname '*.m4v' -o -iname '*.mov' \) -print0)

echo "Done: $count files · saved ~$(( saved / 1024 )) KB"
