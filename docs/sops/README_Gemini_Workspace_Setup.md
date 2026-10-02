# Google Workspace Gemini + TokioTours Ops Assist

## A) Google Admin (manual — outside this repo)

1. Sign in at [admin.google.com](https://admin.google.com) as super-admin (`admin@travelexperiencesgroup.com`).
2. **Billing → Get more services → Google Workspace Add-ons** — assign **Gemini Business** or **Gemini Enterprise** to Concierge/Ops users (`yency@tokiotours.nl`, `ops@tokiotours.nl`, …).
3. **Apps → Additional Google services → Gemini** — set service **ON** for everyone or the Operations & Concierge OU.
4. Under Gemini settings, enable **Enterprise Data Protection** so booking/PNR context is not used to train public models.

## B) Shared Drive SOPs (for Workspace Gemini @Drive)

1. Create Shared Drive: **TokioTours - Operations & Concierge SOPs**.
2. Copy / paste Google Docs from the markdown sources in this repo:
   - `docs/sops/01_Pricing_and_Discount_Rules.md`
   - `docs/sops/02_Guide_Workload_and_Dispatch_Rules.md`
   - `docs/sops/03_Logistics_and_Transport_Policies.md`
3. Staff prompts in Gmail / Docs / [gemini.google.com](https://gemini.google.com) with `@Google Drive`, e.g.  
   *"@Drive Check TokioTours pricing rules: Can I offer a €200 discount on PNR JPN-XRFTG2 without Ops Manager approval?"*

## C) In-app Comms Hub assist (this codebase)

- UI: **✨ Gemini Assist** in Ops Comms Hub composer (`GeminiAssistDrawer`)
- API: `POST /api/gemini/assist` grounded on the same SOP text (`lib/tokioToursSystemRules.ts`)
- Env:
  - `GEMINI_API_KEY` — Google AI Studio / Gemini API key (server-side)
  - `GEMINI_MODEL` — optional, default `gemini-2.0-flash`
- Without an API key, the assist returns deterministic **rules_fallback** answers so Ops still works offline from the API.
