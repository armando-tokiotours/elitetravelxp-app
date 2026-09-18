#!/bin/sh
# Ensure admin superuser exists after fresh volume / pb:push restores.
set -eu

EMAIL="${PB_ADMIN_EMAIL:-admin@travelexperiencesgroup.com}"
PASSWORD="${PB_ADMIN_PASSWORD:-EliteTravelAdmin2026!}"

if [ -n "$EMAIL" ] && [ -n "$PASSWORD" ]; then
  ./pocketbase superuser upsert "$EMAIL" "$PASSWORD" || \
    echo "⚠ superuser upsert failed (PocketBase may still be starting); retry after serve."
fi

exec ./pocketbase serve --http=0.0.0.0:8090
