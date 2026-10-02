/// <reference path="../pb_data/types.d.ts" />
/**
 * Inject Google Workspace OAuth client credentials into staff.oauth2 from env.
 * Requires GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET on the PocketBase process.
 *
 * Google Cloud Console → Authorized redirect URIs must include:
 *   {POCKETBASE_PUBLIC_URL}/api/oauth2-redirect
 * e.g. http://127.0.0.1:8090/api/oauth2-redirect
 *      https://tokiotours-app.com/api/oauth2-redirect  (same-origin proxy)
 *      http://HOST:8091/api/oauth2-redirect            (VPS direct PB port)
 */
onBootstrap((e) => {
  e.next();

  const clientId = String($os.getenv("GOOGLE_CLIENT_ID") || "").trim();
  const clientSecret = String($os.getenv("GOOGLE_CLIENT_SECRET") || "").trim();

  if (!clientId || !clientSecret) {
    console.log(
      "[google_oauth] GOOGLE_CLIENT_ID/SECRET not set — staff Google SSO stays disabled until env is provided"
    );
    return;
  }

  try {
    const staff = $app.findCollectionByNameOrId("staff");
    const providers = [];
    const existing = staff.oauth2 && staff.oauth2.providers
      ? staff.oauth2.providers
      : [];

    for (const p of existing) {
      if (String(p.name || "").toLowerCase() === "google") continue;
      providers.push(p);
    }

    providers.push({
      name: "google",
      displayName: "Google Workspace",
      clientId: clientId,
      clientSecret: clientSecret,
      // PKCE recommended for public clients; Google supports it with PocketBase
      pkce: true,
    });

    staff.oauth2 = staff.oauth2 || {};
    staff.oauth2.enabled = true;
    staff.oauth2.providers = providers;
    if (!staff.oauth2.mappedFields) {
      staff.oauth2.mappedFields = { name: "name" };
    }

    $app.save(staff);
    console.log(
      "[google_oauth] staff Google provider configured (clientId ends with …" +
        clientId.slice(-12) +
        ")"
    );
  } catch (err) {
    console.log("[google_oauth] configure failed:", err);
  }
});
