# Google Workspace SSO (PocketBase staff)

## 1) Google Cloud Console — OAuth client "Web application"

Authorized JavaScript origins:
```
https://tokiotours-app.com
http://localhost:3000
http://127.0.0.1:3000
```

Authorized redirect URIs (PocketBase callback — required):
```
http://127.0.0.1:8090/api/oauth2-redirect
http://localhost:8090/api/oauth2-redirect
https://tokiotours-app.com/api/oauth2-redirect
```

If PocketBase is reached on the VPS host port **8091**:
```
https://YOUR_VPS_HOST:8091/api/oauth2-redirect
http://YOUR_VPS_HOST:8091/api/oauth2-redirect
```

Same-origin production (Nginx must proxy `/api/oauth2-redirect` → PocketBase — already added to `nginx/nginx.conf`).
Also add your production host origin if different from tokiotours-app.com, e.g. `https://travelexperiencesgroup.com`.

## 2) Environment

Set on **both** Next.js (optional, for docs) and **PocketBase container**:

```env
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
```

The hook `backend/pb_hooks/configure_google_oauth.pb.js` loads these into `staff.oauth2` on PocketBase bootstrap.

## 3) Staff provisioning

`staff.createRule` must be an **empty string** (`""`) — **not** `null`.
In PocketBase, `null` means only superusers can create (breaks Google first-login with “Only superusers…”).

With `createRule = ""`, Google SSO can mint the staff row on first login; `staff_role_provisioning.pb.js` assigns role / account_type. Core `@tokiotours.nl` emails map to fixed roles; unknown domains are parked `PENDING` + inactive.

Allowed domains (client guard after OAuth): `@tokiotours.nl`, `@travelexperiencesgroup.com`.

## 4) Login UI

- `/login` — dedicated Staff Access card
- Any staff portal route (`/ops`, `/agent`, …) shows the same Google button when logged out
