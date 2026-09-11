# Elite Travel XP — Trip Builder + PocketBase Admin

Mobile-first Japan trip builder for [travelexperiencesgroup.com](https://travelexperiencesgroup.com).

## Architecture

| Layer | Role |
|-------|------|
| **Next.js `/builder`** | Client trip builder (cream / navy / gold UI) |
| **PocketBase** | Admin “truth” — cities, hotels, vehicles, transfers, tours |
| **Zustand `useBuilderStore`** | Persisted user selections |
| **Docker Compose** | Independent VPS stack (web + PocketBase + Nginx + Certbot) |

## Local development

```bash
npm run pb:superuser
npm run pb          # http://127.0.0.1:8090
npm run pb:seed
cp .env.example .env.local
npm run dev -- -p 3001
```

- Builder: http://localhost:3001/builder  
- Admin: http://127.0.0.1:8090/_/

## VPS deploy (independent Docker)

On the server (DNS already pointing to the VPS):

```bash
git clone <this-repo> travelxp && cd travelxp
cp .env.production.example .env   # edit passwords
chmod +x scripts/vps-deploy.sh
./scripts/vps-deploy.sh
```

Or manually:

```bash
docker compose up -d --build
```

Services: `web` (Next.js :3000), `pocketbase` (:8090), `nginx` (80/443), `certbot` (renewal).

## PocketBase collections

`cities`, `accommodations`, `vehicles`, `transfers`, `tours`, `transit_modes` — edit in Admin UI; the builder loads them live.
