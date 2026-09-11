#!/usr/bin/env bash
# Independent VPS bootstrap for Elite Travel XP (Docker-only).
# Run on the VPS from the repo root after cloning.
set -euo pipefail

DOMAIN="${DOMAIN:-travelexperiencesgroup.com}"
EMAIL="${CERTBOT_EMAIL:-admin@travelexperiencesgroup.com}"

if [[ ! -f .env ]]; then
  cp .env.production.example .env
  echo "→ Created .env — edit PB_ADMIN_PASSWORD before going live."
fi

# shellcheck disable=SC1091
set -a; source .env; set +a

echo "→ Building & starting containers…"
docker compose up -d --build

echo "→ Ensuring PocketBase superuser…"
docker compose exec -T pocketbase \
  ./pocketbase superuser upsert "${PB_ADMIN_EMAIL}" "${PB_ADMIN_PASSWORD}" || true

echo "→ Requesting Let's Encrypt certificate (requires DNS A record → this VPS)…"
# Temporary HTTP-only nginx so ACME can succeed before certs exist
cat > /tmp/elite-nginx-init.conf <<EOF
server {
  listen 80;
  server_name ${DOMAIN} www.${DOMAIN};
  location /.well-known/acme-challenge/ { root /var/www/certbot; }
  location / { return 200 'SSL bootstrap'; add_header Content-Type text/plain; }
}
EOF

docker compose stop nginx 2>/dev/null || true
docker run --rm -d --name elite-nginx-init \
  -p 80:80 \
  -v /tmp/elite-nginx-init.conf:/etc/nginx/conf.d/default.conf:ro \
  -v "$(docker volume ls -q | grep certbot_www | head -1):/var/www/certbot" \
  nginx:1.27-alpine || true

sleep 2
docker compose run --rm --entrypoint "" certbot \
  certbot certonly --webroot -w /var/www/certbot \
  -d "${DOMAIN}" -d "www.${DOMAIN}" \
  --email "${EMAIL}" --agree-tos --no-eff-email || {
    echo "⚠ Certbot failed (DNS not ready?). Stack still runs; retry later."
  }

docker rm -f elite-nginx-init 2>/dev/null || true
docker compose up -d nginx

echo ""
echo "✓ Stack is up"
echo "  Site:    https://${DOMAIN}/builder"
echo "  Admin:   https://${DOMAIN}/_/"
echo "  PB direct (optional): http://$(hostname -I | awk '{print $1}'):8090/_/"
echo ""
echo "Seed data once:"
echo "  PB_URL=http://127.0.0.1:8090 PB_ADMIN_EMAIL=... PB_ADMIN_PASSWORD=... npm run pb:seed"
echo "  (from a machine that can reach the VPS PocketBase port, or copy seed script into a one-off container)"
