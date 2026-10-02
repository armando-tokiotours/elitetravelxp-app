# Flexible staff / guide / travel-agent accounts

PocketBase collection: **`staff`** (not `users`).

Guides and travel agents use personal / agency domains (`@gmail.com`, `@yahoo.com`, agency domains). Core leadership keeps Google Workspace SSO. The provisioning hook never blocks creating any email.

## Account matrix

| User type | Email domain | Login | Role assignment | Access |
| --- | --- | --- | --- | --- |
| Core staff & leadership | `@tokiotours.nl` / `@travelexperiencesgroup.com` | Google Workspace SSO or email/password | Auto via core map → `owner` / `accounting` / `ops` / `agent` | Full Ops + financial controls |
| Flexible / fictitious staff | Any (incl. `agent1@tokiotours.nl`) | Email/password or SSO | Default `agent` (or set in Admin) | Comms Hub, cart edit (≤15% discount), tour booking |
| External travel agents | Any agency domain | Email/password | Role `agency` / `account_type` `TRAVEL_AGENT` | B2B portal, net prices, 15% max agent discount |
| Tour guides | Personal email | Email/password via **Create password link** | Role `guide` / `account_type` `GUIDE` | Guide Portal, job board, schedules, guest briefs |
| Unknown external (no type) | Any other | Blocked until activated | `account_type` `PENDING`, `active=false` | None until Ops flips role + active |

## Role map (spec → PocketBase)

| Spec label | PocketBase `role` |
| --- | --- |
| SUPER_USER | `owner` |
| ACCOUNTING | `accounting` |
| OPS_COORDINATOR | `ops` |
| CONCIERGE_AGENT | `agent` |
| TRAVEL_AGENT | `agency` |
| GUIDE | `guide` |

Optional field **`account_type`**: `STAFF` | `GUIDE` | `TRAVEL_AGENT` | `PENDING`

## Hook

`backend/pb_hooks/staff_role_provisioning.pb.js`

1. Core email map locks role + `account_type=STAFF`
2. If Admin already set a valid role → keep it
3. Else `account_type` GUIDE / TRAVEL_AGENT → `guide` / `agency`
4. Else `@tokiotours.nl` / `@travelexperiencesgroup.com` → `agent`
5. Else on create → `PENDING` + `active=false`

## Onboard in 3 clicks

1. **Create** in PocketBase Admin (or Staff Users) with real email + role `guide` / `agency` / `agent`
2. **Guides:** Ops → Guide Dispatch → **🔗 Create password link** → copy / send
3. Guide opens `/guide/setup-password?token=…`, sets password + phone/languages/LINE, then signs in at `/guide` (email/password — not Google SSO)

Travel agents: create `agency` staff row + password (Staff Users or Admin); they use `/login` email/password.

## Files

- Hook: `backend/pb_hooks/staff_role_provisioning.pb.js`
- Migration: `backend/pb_migrations/1791070000_staff_account_type.js`
- Invite UI: `components/staff/GuideInviteButton.tsx` (wired in Guide Dispatch)
- APIs: `/api/guides/generate-onboarding-link`, `/api/guides/complete-onboarding`
- Auth helpers: `lib/staffRoleProvisioning.ts`, `lib/guideOnboarding.ts`

Restart PocketBase after pulling so the hook + migration load.
