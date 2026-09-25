/**
 * TOKIOTOURS proposal email HTML — branding colors, trip summary, manage CTA.
 * Pure string builder (safe for Node mail + admin iframe preview).
 */

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
const BRAND_AMBER = "#F6A724";
const CTA_TEAL = "#075473";
const BG = "#05080C";
const CARD = "#0D1117";
const BORDER = "#1F2937";
const TEXT = "#E4E4E7";
const MUTED = "#9CA3AF";

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

function summaryRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:6px 0;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:${MUTED};width:38%;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:6px 0;font-size:14px;font-weight:600;color:#FFFFFF;vertical-align:top;">${value}</td>
    </tr>`;
}

/**
 * Full HTML email body for itinerary proposals.
 */
export function renderProposalEmailHtml(params: ProposalEmailParams): string {
  const safeName = escapeHtml(params.fullName) || "Valued Guest";
  const safeRef = escapeHtml(params.bookingRef) || "TMP-BOOKING";
  const emailRaw = String(params.customerEmail || "").trim().toLowerCase();
  const safeEmail = escapeHtml(emailRaw) || "—";
  const headerTitle = escapeHtml(
    params.headerTitle || "YOUR JAPAN JOURNEY PROPOSAL"
  );
  const welcomeBody = brandTokiotours(
    params.welcomeBody ||
      "Thank you for designing your bespoke itinerary. Our concierge team at TOKIOTOURS has received your trip selections and is preparing your confirmed 1-on-1 daily proposal."
  ).replace(/\n/g, "<br/>");
  const ctaText = escapeHtml(
    params.ctaButtonText || "REVIEW YOUR BOOKING BRIEF →"
  );
  const origin = params.siteOrigin || "https://tokiotours-app.com";
  const manageUrl = escapeHtml(
    manageBookingUrl(origin, params.bookingRef || "TMP-BOOKING", emailRaw)
  );

  const isSingle = params.tourType === "single_day";
  const tourTypeLabel = isSingle ? "Single-Day Tour" : "Multi-Day Journey";
  const dateLabel = formatEmailDisplayDate(params.tourDate);
  const endDateLabel = formatEmailDisplayDate(params.endDate);
  const adults = Math.max(0, Number(params.adults) || 0);
  const kids = Math.max(0, Number(params.children) || 0);
  const guestsLabel = `${adults} Adult${adults === 1 ? "" : "s"}, ${kids} Child${kids === 1 ? "" : "ren"}`;
  const styleLabel = escapeHtml(params.travelStyle || "—");
  const experienceLabel = escapeHtml(
    params.experienceTier ||
      (isSingle ? "Day Tour" : "Premium Concierge")
  );
  const datesPassLabel =
    endDateLabel && endDateLabel !== "—" && endDateLabel !== dateLabel
      ? `${escapeHtml(dateLabel)} to ${escapeHtml(endDateLabel)}`
      : escapeHtml(dateLabel);
  const dossierUrl = escapeHtml(
    `${origin.replace(/\/$/, "")}/builder/itinerary?ref=${encodeURIComponent(params.bookingRef || "")}&view=dossier`
  );
  const walletUrl = escapeHtml(
    `${origin.replace(/\/$/, "")}/api/wallet/generate-pass?pnr=${encodeURIComponent(params.bookingRef || "")}`
  );

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:${BG};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:${TEXT};">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:${BG};padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background-color:${CARD};border:1px solid ${BORDER};border-radius:16px;padding:32px;text-align:left;">
          <tr>
            <td style="padding-bottom:20px;">
              <img src="https://tokiotours-app.com/images/tokiotours-logo.png" alt="TOKIOTOURS" width="48" height="48" style="display:block;border-radius:9999px;margin:0 0 12px 0;" />
              <span style="color:${BRAND_RED};font-weight:800;font-size:22px;letter-spacing:2px;text-transform:uppercase;">TOKIOTOURS</span>
              <h1 style="color:#FFFFFF;font-size:24px;font-weight:700;margin:8px 0 0 0;text-transform:uppercase;letter-spacing:0.04em;">${headerTitle}</h1>
            </td>
          </tr>

          <!-- Japan Booking Pass stub -->
          <tr>
            <td style="padding-bottom:24px;">
              <div style="background-color:#0A1017;color:#FFFFFF;padding:20px;border-radius:16px;border:1px solid ${BORDER};">
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-bottom:1px dashed #334155;padding-bottom:12px;margin-bottom:12px;">
                  <tr>
                    <td style="color:${BRAND_AMBER};font-size:14px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;">TOKIOTOURS JAPAN PASS</td>
                    <td align="right" style="font-family:monospace;font-size:14px;color:#38BDF8;">REF: ${safeRef}</td>
                  </tr>
                </table>
                <p style="margin:4px 0;font-size:13px;"><strong style="color:${MUTED};">GUEST:</strong> ${safeName}</p>
                <p style="margin:4px 0;font-size:13px;"><strong style="color:${MUTED};">PARTY:</strong> ${escapeHtml(guestsLabel)}</p>
                <p style="margin:4px 0;font-size:13px;"><strong style="color:${MUTED};">STYLE &amp; EXPERIENCE:</strong> ${styleLabel} · ${experienceLabel}</p>
                <p style="margin:4px 0;font-size:13px;"><strong style="color:${MUTED};">DATES:</strong> ${datesPassLabel}</p>
                <div style="margin-top:18px;text-align:center;">
                  <a href="${dossierUrl}" style="background-color:${CTA_TEAL};color:#ffffff;padding:12px 18px;text-decoration:none;font-weight:bold;border-radius:12px;display:inline-block;margin:4px;font-size:11px;letter-spacing:0.04em;">OPEN BOOKING ON WEBSITE</a>
                  <a href="${walletUrl}" style="background-color:#000000;color:#ffffff;border:1px solid #475569;padding:12px 18px;text-decoration:none;font-weight:bold;border-radius:12px;display:inline-block;margin:4px;font-size:11px;letter-spacing:0.04em;">SAVE TO APPLE WALLET</a>
                </div>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding-bottom:8px;color:${TEXT};font-size:14px;line-height:1.6;">
              <p style="margin:0 0 16px 0;">Dear <strong style="color:#FFFFFF;">${safeName}</strong>,</p>
              <p style="margin:0 0 20px 0;">${welcomeBody}</p>
            </td>
          </tr>

          <tr>
            <td style="padding-bottom:24px;">
              <div style="background-color:${BG};border:1px solid ${BORDER};border-left:4px solid ${BRAND_RED};border-radius:12px;padding:16px 18px;">
                <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${BRAND_RED};display:block;margin-bottom:10px;">ITINERARY SUMMARY</span>
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  ${summaryRow("Type", escapeHtml(tourTypeLabel))}
                  ${summaryRow("Date", escapeHtml(dateLabel))}
                  ${summaryRow("Party Size", escapeHtml(guestsLabel))}
                  ${summaryRow("Email", safeEmail)}
                </table>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding-bottom:8px;color:${TEXT};font-size:14px;line-height:1.6;">
              <p style="margin:0 0 16px 0;color:${MUTED};font-size:13px;">
                Manage your booking anytime on <span style="color:${BRAND_RED};font-weight:700;">Tokiotours</span> — use your Booking Reference (<strong style="color:${BRAND_AMBER};">${safeRef}</strong>) and Email (<strong style="color:#FFFFFF;">${safeEmail}</strong>) to review or update your itinerary.
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:12px 0 24px 0;">
              <a href="${manageUrl}" style="background-color:${CTA_TEAL};color:#FFFFFF;text-decoration:none;font-size:12px;font-weight:bold;padding:14px 28px;border-radius:999px;display:inline-block;letter-spacing:1px;">${ctaText}</a>
            </td>
          </tr>

          <tr>
            <td style="border-top:1px solid ${BORDER};padding-top:20px;text-align:center;color:${MUTED};font-size:11px;">
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
