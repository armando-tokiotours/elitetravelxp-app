/**
 * Dark Japan Pass email — three-tier layout:
 * 1) Hero banner (email-1.jpg)
 * 2) Greeting + welcome + pass stub + CTAs
 * 3) Official footer banner (email-2)
 *
 * Solid hex backgrounds only (no rgba/gradients) so Gmail/Outlook
 * cannot fall back to white client chrome.
 */

export type BookingPassEmailFields = {
  pnrCode: string;
  guestName: string;
  guestEmail?: string;
  partyText: string;
  travelStyle: string;
  startDateText: string;
  endDateText?: string | null;
  siteOrigin?: string;
  welcomeBody?: string;
  ctaButtonText?: string;
  /** Absolute or path CTA; {{bookingRef}} expanded when present. */
  ctaUrl?: string;
  /** When false, omit Apple Wallet CTA. Default true. */
  includeWalletCta?: boolean;
};

const BG = "#04080C";
const CARD = "#0A1017";
const BORDER = "#1E293B";
const TEXT = "#E2E8F0";
const MUTED = "#94A3B8";
const AMBER = "#F6A724";
const SKY = "#38BDF8";
const TEAL = "#075473";
const BRAND_RED = "#E60F43";

function escapeHtml(s: string): string {
  return String(s || "").replace(/[<>&"]/g, (c) =>
    c === "<"
      ? "&lt;"
      : c === ">"
        ? "&gt;"
        : c === "&"
          ? "&amp;"
          : "&quot;"
  );
}

export function siteOrigin(raw?: string): string {
  return (raw || "https://tokiotours-app.com").replace(/\/$/, "");
}

function brandTokiotours(text: string): string {
  return escapeHtml(text).replace(
    /(TOKIOTOURS|Tokiotours)/gi,
    `<strong style="color:${AMBER};">$1</strong>`
  );
}

function resolveCtaUrl(
  origin: string,
  pnrCode: string,
  guestEmail: string,
  ctaUrl?: string
): string {
  const filled = String(ctaUrl || "")
    .trim()
    .replace(/\{\{\s*bookingRef\s*\}\}/gi, encodeURIComponent(pnrCode));
  if (filled.startsWith("http")) return filled;
  if (filled.startsWith("/")) return `${origin}${filled}`;
  const q = new URLSearchParams({
    pnr: pnrCode,
    email: guestEmail,
  });
  return `${origin}/manage?${q.toString()}`;
}

/** Inner pass card HTML (embed inside a larger email). */
export function renderBookingPassCardHtml(
  fields: BookingPassEmailFields
): string {
  const pnr = escapeHtml(fields.pnrCode);
  const guest = escapeHtml(fields.guestName || "GUEST");
  const party = escapeHtml(fields.partyText || "2 Adults");
  const style = escapeHtml(fields.travelStyle || "Premium Comfort");
  const start = escapeHtml(fields.startDateText || "Selected Itinerary Dates");
  const end = fields.endDateText ? escapeHtml(fields.endDateText) : "";
  const dates =
    end && end !== "—" && end !== start ? `${start} to ${end}` : start;

  return `<div style="background-color:#0F172A;border:1px solid #334155;border-left:4px solid ${AMBER};border-radius:12px;padding:18px;margin:0 0 24px 0;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-bottom:1px dashed #334155;padding-bottom:10px;margin-bottom:12px;">
    <tr>
      <td style="font-size:12px;font-weight:bold;color:${AMBER};letter-spacing:1px;text-transform:uppercase;">TOKIOTOURS JAPAN PASS</td>
      <td align="right" style="font-family:monospace;font-size:14px;font-weight:bold;color:${SKY};">REF: ${pnr}</td>
    </tr>
  </table>
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size:13px;color:#CBD5E1;border-collapse:collapse;">
    <tr>
      <td style="padding:4px 0;font-weight:bold;width:35%;">GUEST:</td>
      <td style="padding:4px 0;color:#ffffff;">${guest}</td>
    </tr>
    <tr>
      <td style="padding:4px 0;font-weight:bold;">PARTY SIZE:</td>
      <td style="padding:4px 0;color:#ffffff;">${party}</td>
    </tr>
    <tr>
      <td style="padding:4px 0;font-weight:bold;">STYLE:</td>
      <td style="padding:4px 0;color:#ffffff;">${style}</td>
    </tr>
    <tr>
      <td style="padding:4px 0;font-weight:bold;">DATES:</td>
      <td style="padding:4px 0;color:#ffffff;">${dates}</td>
    </tr>
  </table>
</div>`;
}

/**
 * Full three-tier booking email HTML (hero → body → footer).
 * Preferred entry point for proposal + boarding-pass guest mail.
 */
export function generateBookingEmailHtml(
  data: BookingPassEmailFields
): string {
  const origin = siteOrigin(data.siteOrigin);
  const pnrCode = String(data.pnrCode || "").trim() || "TMP-BOOKING";
  const guestName = String(data.guestName || "Valued Guest").trim();
  const guestEmail = String(data.guestEmail || "").trim().toLowerCase();
  const firstName = guestName.split(/\s+/)[0] || guestName;
  const welcome =
    data.welcomeBody ||
    "Thank you for designing your bespoke itinerary. Our concierge team at TOKIOTOURS has received your trip selections and is preparing your confirmed 1-on-1 daily proposal.";
  const ctaText = escapeHtml(
    data.ctaButtonText || "REVIEW YOUR BOOKING BRIEF →"
  );
  const ctaHref = escapeHtml(
    resolveCtaUrl(origin, pnrCode, guestEmail, data.ctaUrl)
  );
  const walletUrl = escapeHtml(
    `${origin}/api/wallet/apple/generate?pnr=${encodeURIComponent(pnrCode)}`
  );
  const heroUrl = escapeHtml(`${origin}/brand/email-1.jpg`);
  const footerUrl = escapeHtml(`${origin}/brand/email-2.png`);
  const includeWallet = data.includeWalletCta !== false;
  const passCard = renderBookingPassCardHtml(data);
  const safeEmail = escapeHtml(guestEmail);
  const safePnr = escapeHtml(pnrCode);
  const mailto = guestEmail
    ? `<a href="mailto:${safeEmail}" style="color:${SKY};text-decoration:none;">${safeEmail}</a>`
    : `<span style="color:${SKY};">your email</span>`;

  return `<!DOCTYPE html>
<html lang="en" style="background-color:${BG};" bgcolor="${BG}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark only" />
  <meta name="supported-color-schemes" content="dark only" />
  <style type="text/css">
    :root { color-scheme: dark only; supported-color-schemes: dark only; }
    html, body, table, td { background-color: ${BG} !important; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BG};color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;" bgcolor="${BG}">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="${BG}" style="background-color:${BG};padding:20px 12px;">
    <tr>
      <td align="center" bgcolor="${BG}" style="background-color:${BG};">
        <table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" bgcolor="${CARD}" style="max-width:600px;width:100%;background-color:${CARD};border:1px solid ${BORDER};border-radius:16px;overflow:hidden;">

          <!-- 1. HERO HEADER IMAGE -->
          <tr>
            <td align="center" bgcolor="#000000" style="background-color:#000000;padding:0;line-height:0;font-size:0;">
              <img src="${heroUrl}" alt="Get Ready Explore Japan" width="600" style="width:100%;max-width:600px;height:auto;display:block;border:0;outline:none;text-decoration:none;" />
            </td>
          </tr>

          <!-- 2. BODY -->
          <tr>
            <td style="padding:24px;color:${TEXT};text-align:left;" bgcolor="${CARD}">
              <h2 style="color:#ffffff;font-size:20px;font-weight:bold;margin:0 0 12px 0;">
                Dear ${escapeHtml(firstName)},
              </h2>
              <p style="font-size:14px;line-height:1.6;color:${MUTED};margin:0 0 20px 0;">
                ${brandTokiotours(welcome).replace(/\n/g, "<br/>")}
              </p>

              ${passCard}

              <p style="font-size:13px;line-height:1.5;color:${MUTED};margin:0 0 20px 0;text-align:center;">
                Manage your booking anytime on Tokiotours — use your Booking Reference (<strong style="color:${AMBER};">${safePnr}</strong>) and Email (${mailto}) to review or update your itinerary.
              </p>

              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding:8px 0 6px;">
                    <a href="${ctaHref}" style="background-color:${TEAL};color:#ffffff;padding:12px 24px;text-decoration:none;font-weight:bold;font-size:13px;border-radius:10px;display:inline-block;letter-spacing:0.04em;">
                      ${ctaText}
                    </a>
                  </td>
                </tr>
                ${
                  includeWallet
                    ? `<tr>
                  <td align="center" style="padding:6px 0 0;">
                    <a href="${walletUrl}" style="background-color:#000000;color:#ffffff;border:1px solid #475569;padding:10px 20px;text-decoration:none;font-weight:bold;font-size:12px;border-radius:10px;display:inline-block;">
                      &#63743; SAVE TO APPLE WALLET
                    </a>
                  </td>
                </tr>`
                    : ""
                }
              </table>
            </td>
          </tr>

          <!-- 3. OFFICIAL FOOTER BANNER -->
          <tr>
            <td align="center" bgcolor="#020408" style="background-color:#020408;border-top:1px solid ${BORDER};padding:0;line-height:0;font-size:0;">
              <img src="${footerUrl}" alt="TOKIOTOURS official channel notice" width="600" style="width:100%;max-width:600px;height:auto;display:block;border:0;outline:none;" />
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#020408" style="background-color:#020408;padding:12px 16px 16px;font-size:11px;color:#64748B;line-height:1.5;">
              <p style="margin:0 0 6px 0;color:#64748B;">Official Channel Notice: TokioTours (Netherlands / Japan Operations).</p>
              <p style="margin:0;color:#475569;font-family:monospace;font-size:10px;">
                tokiotours.com | tokiotours.nl | tokiotours.jp | tokiotours-app.com
              </p>
              <p style="margin:8px 0 0;font-size:10px;color:#475569;">
                © <span style="color:${BRAND_RED};font-weight:700;">TOKIOTOURS</span> · Confidential Proposal
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** @deprecated Prefer generateBookingEmailHtml — kept for callers expecting pass-only body. */
export function renderBookingPassEmailHtml(
  fields: BookingPassEmailFields
): string {
  return generateBookingEmailHtml(fields);
}
