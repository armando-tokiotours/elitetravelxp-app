/**
 * TOKIOTOURS proposal email HTML — solid dark ambient (no white client chrome).
 * Pure string builder (safe for Node mail + admin iframe preview).
 */

import { renderBookingPassCardHtml } from "@/lib/emailTemplates/bookingPassEmail";

export type ProposalTripMeta = {
  tourType?: "single_day" | "multi_day" | null;
  /** ISO date YYYY-MM-DD or already display-formatted */
  tourDate?: string | null;
  adults?: number;
  children?: number;
  customerEmail?: string | null;
};

export type ProposalEmailParams = {
  fullName: string;
  bookingRef: string;
  headerTitle?: string;
  welcomeBody?: string;
  ctaButtonText?: string;
  /** Base site URL; manage link is built from bookingRef + email */
  siteOrigin?: string;
  travelStyle?: string | null;
  experienceTier?: string | null;
  endDate?: string | null;
} & ProposalTripMeta;

const BRAND_RED = "#E60F43";
const BG = "#04080C";
const CARD = "#0A1017";
const BORDER = "#1E293B";
const TEXT = "#E2E8F0";
const MUTED = "#94A3B8";

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

/** Format ISO YYYY-MM-DD → `24 Sep 2026`. */
export function formatEmailDisplayDate(
  iso: string | null | undefined
): string {
  if (!iso) return "—";
  if (/[A-Za-z]{3}/.test(iso) && !/^\d{4}-\d{2}-\d{2}/.test(iso)) {
    return iso;
  }
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${d} ${months[m - 1]} ${y}`;
}

function brandTokiotours(text: string): string {
  return escapeHtml(text).replace(
    /(TOKIOTOURS|Tokiotours)/gi,
    `<span style="color:${BRAND_RED};font-weight:800;">$1</span>`
  );
}

function manageBookingUrl(
  origin: string,
  bookingRef: string,
  email: string
): string {
  const base = (origin || "https://tokiotours-app.com").replace(/\/$/, "");
  const q = new URLSearchParams({
    pnr: bookingRef,
    email,
  });
  return `${base}/manage?${q.toString()}`;
}

/**
 * Full HTML email body for itinerary proposals.
 */
export function renderProposalEmailHtml(params: ProposalEmailParams): string {
  const safeName = escapeHtml(params.fullName) || "Valued Guest";
  const safeRef = params.bookingRef || "TMP-BOOKING";
  const emailRaw = String(params.customerEmail || "").trim().toLowerCase();
  const headerTitle = escapeHtml(
    params.headerTitle || "YOUR JAPAN JOURNEY PROPOSAL"
  );
  const welcomeBody = brandTokiotours(
    params.welcomeBody ||
      "Thank you for designing your bespoke itinerary. Our concierge team at TOKIOTOURS has received your trip selections and is preparing your confirmed 1-on-1 daily proposal."
  ).replace(/\n/g, "<br/>");
  const origin = params.siteOrigin || "https://tokiotours-app.com";
  const manageUrl = escapeHtml(
    manageBookingUrl(origin, params.bookingRef || "TMP-BOOKING", emailRaw)
  );

  const isSingle = params.tourType === "single_day";
  const dateLabel = formatEmailDisplayDate(params.tourDate);
  const endDateLabel = formatEmailDisplayDate(params.endDate);
  const adults = Math.max(0, Number(params.adults) || 0);
  const kids = Math.max(0, Number(params.children) || 0);
  const guestsLabel = `${adults} Adult${adults === 1 ? "" : "s"}, ${kids} Child${kids === 1 ? "" : "ren"}`;
  const styleLabel = params.travelStyle || "—";
  const experienceLabel =
    params.experienceTier ||
    (isSingle ? "Day Tour" : "Premium Concierge");

  const passCard = renderBookingPassCardHtml({
    pnrCode: safeRef,
    guestName: params.fullName || "GUEST",
    partyText: guestsLabel,
    travelStyle: `${styleLabel} · ${experienceLabel}`,
    startDateText: dateLabel,
    endDateText: endDateLabel,
    siteOrigin: origin,
    includeWalletCta: true,
  });

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
<body style="margin:0;padding:0;background-color:${BG};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:${TEXT};" bgcolor="${BG}">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="${BG}" style="background-color:${BG};padding:32px 16px;">
    <tr>
      <td align="center" bgcolor="${BG}" style="background-color:${BG};">
        <table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" bgcolor="${CARD}" style="max-width:600px;width:100%;background-color:${CARD};border:1px solid ${BORDER};border-radius:16px;text-align:left;">
          <tr>
            <td style="padding:28px 28px 18px;" bgcolor="${CARD}">
              <img src="https://tokiotours-app.com/images/tokiotours-logo.png" alt="TOKIOTOURS" width="48" height="48" style="display:block;border-radius:9999px;margin:0 0 12px 0;" />
              <span style="color:${BRAND_RED};font-weight:800;font-size:20px;letter-spacing:2px;text-transform:uppercase;">TOKIOTOURS</span>
              <h1 style="color:#FFFFFF;font-size:22px;font-weight:700;margin:8px 0 0 0;text-transform:uppercase;letter-spacing:0.04em;">${headerTitle}</h1>
            </td>
          </tr>

          <tr>
            <td style="padding:0 28px 22px;" bgcolor="${CARD}">
              ${passCard}
            </td>
          </tr>

          <tr>
            <td style="padding:0 28px 8px;color:${TEXT};font-size:14px;line-height:1.65;" bgcolor="${CARD}">
              <p style="margin:0 0 16px 0;color:${TEXT};">Dear <strong style="color:#FFFFFF;">${safeName}</strong>,</p>
              <p style="margin:0 0 8px 0;color:${MUTED};">${welcomeBody}</p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:16px 28px 8px;" bgcolor="${CARD}">
              <a href="${manageUrl}" style="background-color:transparent;color:${TEXT};border:1px solid ${BORDER};text-decoration:none;font-size:11px;font-weight:bold;padding:12px 22px;border-radius:999px;display:inline-block;letter-spacing:0.06em;">MANAGE BOOKING</a>
            </td>
          </tr>

          <tr>
            <td style="border-top:1px solid ${BORDER};padding:18px 28px 28px;text-align:center;color:${MUTED};font-size:11px;" bgcolor="${CARD}">
              © <span style="color:${BRAND_RED};font-weight:700;">TOKIOTOURS</span> · Confidential Proposal
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
