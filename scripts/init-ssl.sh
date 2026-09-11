#!/usr/bin/env bash
# Bootstrap Let's Encrypt certificates for travelexperiencesgroup.com
# Run once on the VPS before starting the full HTTPS stack.
set -euo pipefail

DOMAIN="travelexperiencesgroup.com"
EMAIL="${CERTBOT_EMAIL:-admin@travelexperiencesgroup.com}"

echo "→ Creating temporary HTTP-only nginx config for ACME challenge…"
cat > nginx/nginx.init.conf <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name travelexperiencesgroup.com www.travelexperiencesgroup.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'Elite Travel — SSL bootstrap';
        add_header Content-Type text/plain;
    }
}
EOF

docker compose up -d web
docker run --rm -d \
  --name elite-travel-nginx-init \
  -p 80:80 \
  -v "$(pwd)/nginx/nginx.init.conf:/etc/nginx/conf.d/default.conf:ro" \
  -v "$(pwd)/certbot/www:/var/www/certbot:ro" \
  --network travelxp_elite-travel-net \
  nginx:1.27-alpine || true

# Prefer compose network name; fall back to starting nginx briefly
docker compose run --rm --entrypoint "" certbot \
  certbot certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN" -d "www.$DOMAIN" \
  --email "$EMAIL" --agree-tos --no-eff-email || true

docker rm -f elite-travel-nginx-init 2>/dev/null || true
rm -f nginx/nginx.init.conf

echo "→ Starting full stack…"
docker compose up -d --build

echo "✓ Done. Visit https://$DOMAIN"
