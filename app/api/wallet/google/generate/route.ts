import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Google Wallet "Add to Wallet" entry.
 * When GOOGLE_WALLET_SAVE_URL or a signed JWT issuer is configured, redirects
 * to the real Google Pay / Wallet save link. Otherwise opens the web pass preview.
 *
 * Does NOT invent fake JWTs — configure:
 * - GOOGLE_WALLET_SAVE_URL  (pre-built https://pay.google.com/gp/v/save/... URL)
 * - or GOOGLE_WALLET_ISSUER_ID + GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL +
 *   GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY (future signed-object flow)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const pnr = String(url.searchParams.get("pnr") || "")
    .trim()
    .toUpperCase();
  if (!pnr) {
    return NextResponse.json({ error: "pnr is required." }, { status: 400 });
  }

  const previewUrl = `${url.origin}/pass-preview/${encodeURIComponent(pnr)}?wallet=google`;

  const saveUrl = process.env.GOOGLE_WALLET_SAVE_URL?.trim();
  if (saveUrl) {
    // Allow per-PNR substitution if the template includes {pnr}
    const resolved = saveUrl.replace(/\{pnr\}/gi, encodeURIComponent(pnr));
    try {
      const target = new URL(resolved);
      if (target.protocol === "https:") {
        return NextResponse.redirect(target.toString(), 302);
      }
    } catch {
      /* fall through */
    }
  }

  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID?.trim();
  const saEmail = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL?.trim();
  const saKey = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY?.trim();

  if (issuerId && saEmail && saKey) {
    // Credentials present but signed-object builder not wired yet —
    // do not invent a JWT; send user to the web pass with a Google hint.
    console.warn(
      "[wallet/google] Issuer credentials set but GOOGLE_WALLET_SAVE_URL is missing. Redirecting to pass preview."
    );
  }

  return NextResponse.redirect(previewUrl, 302);
}
