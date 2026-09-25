import {
  INTERESTS,
  MOTIVATIONS,
  PAIN_POINTS,
  TRAVEL_STYLES,
  labelFor,
  parseItineraryData,
  type PreEliteItineraryData,
} from "@/lib/preEliteBuilder";
import { envVal } from "@/lib/email";
import { getActiveEmailConfig } from "@/lib/emailConfigStore";
import { sendTransactionalMail } from "@/lib/mail";
import { renderBookingPassCardHtml } from "@/lib/emailTemplates/bookingPassEmail";

export type DraftBoardingPassParams = {
  bookingRef: string;
  fullName: string;
  email: string;
  itineraryData: string | PreEliteItineraryData;
};

function siteBaseUrl(): string {
  const raw =
    envVal("NEXT_PUBLIC_SITE_URL") ||
    envVal("NEXT_PUBLIC_APP_URL") ||
    envVal("SITE_URL") ||
    "https://tokiotours-app.com";
  return raw.replace(/\/$/, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatArrivalLabel(data: PreEliteItineraryData): string {
  const iso = data.timing.startDate;
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  return data.timing.formattedString || data.dates || "Dates TBD";
}

function groupSizeLabel(data: PreEliteItineraryData): string {
  const a = data.groupSize.adults;
  const c = data.groupSize.children;
  return `${a} Adult${a === 1 ? "" : "s"}, ${c} Child${c === 1 ? "" : "ren"}`;
}

function chipList(labels: string[]): string {
  if (!labels.length) return "—";
  return labels
    .map(
      (l) =>
        `<span style="display:inline-block;margin:0 6px 6px 0;padding:4px 10px;border-radius:999px;border:1px solid #475569;color:#E2E8F0;background-color:#0A1017;font-size:11px;letter-spacing:0.04em;">${escapeHtml(l)}</span>`
    )
    .join("");
}

export function buildDraftBoardingPassHtml(
  params: DraftBoardingPassParams,
  variant: "guest" | "team"
): string {
  const itinerary =
    typeof params.itineraryData === "string"
      ? parseItineraryData(params.itineraryData)
      : params.itineraryData;
  if (!itinerary) {
    throw new Error("Could not parse itinerary brief for boarding pass email.");
  }

  const ref = params.bookingRef.trim();
  const name = params.fullName.trim() || "Valued Guest";
  const email = params.email.trim().toLowerCase();
  const base = siteBaseUrl();
  const resumeUrl = `${base}/manage?pnr=${encodeURIComponent(ref)}&email=${encodeURIComponent(email)}`;
  const arrival = formatArrivalLabel(itinerary);
  const days = itinerary.timing.totalDays;
  const style = labelFor(TRAVEL_STYLES, itinerary.travelStyle);
  const interests = itinerary.interests.map((id) => labelFor(INTERESTS, id));
  const motivation = labelFor(MOTIVATIONS, itinerary.tripMotivation);
  const concerns = itinerary.painPoints.map((id) => labelFor(PAIN_POINTS, id));
  const party = groupSizeLabel(itinerary);
  const experience =
    itinerary.tripType === "single_day" ? "Day Tour" : "Premium Concierge";
  const firstName = name.split(/\s+/)[0] || name;
  const teamBanner =
    variant === "team"
      ? `<p style="margin:0 0 16px;padding:10px 12px;border-radius:10px;background-color:#075473;color:#ffffff;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">New draft lead · Concierge alert</p>`
      : "";

  const BG = "#04080C";
  const CARD = "#0A1017";
  const BORDER = "#1E293B";

  const passCard = renderBookingPassCardHtml({
    pnrCode: ref,
    guestName: name,
    partyText: party,
    travelStyle: `${style} · ${experience}`,
    startDateText: days
      ? `${arrival} · ${days} Day${days === 1 ? "" : "s"}`
      : arrival,
    siteOrigin: base,
    includeWalletCta: true,
  });

  return `<!DOCTYPE html>
<html lang="en" style="background-color:${BG};" bgcolor="${BG}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="dark only" />
  <meta name="supported-color-schemes" content="dark only" />
  <style type="text/css">
    :root { color-scheme: dark only; supported-color-schemes: dark only; }
    html, body, table, td { background-color: ${BG} !important; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BG};font-family:Helvetica,Arial,sans-serif;color:#E2E8F0;" bgcolor="${BG}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BG}" style="background-color:${BG};padding:28px 12px;">
    <tr><td align="center" bgcolor="${BG}" style="background-color:${BG};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARD}" style="max-width:560px;background-color:${CARD};border:1px solid ${BORDER};border-radius:18px;">
        <tr>
          <td style="padding:22px 24px 8px;" bgcolor="${CARD}">
            ${teamBanner}
            <img src="https://tokiotours-app.com/images/tokiotours-logo.png" alt="TOKIOTOURS" width="44" height="44" style="display:block;border-radius:9999px;margin:0 0 12px 0;" />
            <p style="margin:0;font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:#E60F43;font-weight:700;">TOKIOTOURS</p>
            <h1 style="margin:10px 0 0;font-size:24px;line-height:1.2;color:#FFFFFF;text-transform:uppercase;letter-spacing:0.05em;">Your Japan Journey Brief</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 24px 22px;" bgcolor="${CARD}">
            ${passCard}

            <p style="margin:22px 0 0;font-size:14px;line-height:1.65;color:#E2E8F0;">
              Dear <strong style="color:#FFFFFF;">${escapeHtml(firstName)}</strong>,
            </p>
            <p style="margin:12px 0 0;font-size:14px;line-height:1.65;color:#94A3B8;">
              Thank you for sharing your Japan travel brief with <span style="color:#E60F43;font-weight:800;">TOKIOTOURS</span>. Your request is saved under reference <strong style="color:#F6A724;">${escapeHtml(ref)}</strong>. Our concierge team will use these preferences to shape your itinerary.
            </p>

            <div style="margin-top:20px;padding-top:16px;border-top:1px solid ${BORDER};">
              <p style="margin:0;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#38BDF8;font-weight:700;">Brief details</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;font-size:13px;color:#E2E8F0;">
                <tr>
                  <td style="padding:6px 0;color:#94A3B8;">Motivation</td>
                  <td align="right" style="padding:6px 0;color:#FFFFFF;">${escapeHtml(motivation)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#94A3B8;">WhatsApp</td>
                  <td align="right" style="padding:6px 0;color:#FFFFFF;">${escapeHtml(itinerary.whatsapp || "—")}</td>
                </tr>
              </table>
              <p style="margin:14px 0 6px;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#94A3B8;">Interests</p>
              <div>${chipList(interests)}</div>
              <p style="margin:12px 0 6px;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#94A3B8;">Concerns</p>
              <div>${chipList(concerns)}</div>
            </div>

            <div style="margin-top:22px;text-align:center;">
              <a href="${escapeHtml(resumeUrl)}" style="display:inline-block;padding:12px 22px;border-radius:999px;border:1px solid ${BORDER};color:#E2E8F0;font-size:11px;font-weight:700;text-decoration:none;letter-spacing:0.06em;">
                MANAGE BOOKING
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 24px 22px;border-top:1px solid ${BORDER};" bgcolor="${CARD}">
            <p style="margin:0;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#64748B;text-align:center;">
              Status · Draft · No hotels or drivers locked yet
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildDraftBoardingPassText(
  params: DraftBoardingPassParams,
  variant: "guest" | "team"
): string {
  const itinerary =
    typeof params.itineraryData === "string"
      ? parseItineraryData(params.itineraryData)
      : params.itineraryData;
  if (!itinerary) {
    return `Draft reservation pass ${params.bookingRef}`;
  }
  const ref = params.bookingRef.trim();
  const resumeUrl = `${siteBaseUrl()}/manage?pnr=${encodeURIComponent(ref)}&email=${encodeURIComponent(params.email.trim().toLowerCase())}`;
  const prefix = variant === "team" ? "[CONCIERGE ALERT] " : "";
  return `${prefix}TOKIOTOURS · DRAFT RESERVATION PASS
PASS REF: ${ref}
Passenger: ${params.fullName}
Email: ${params.email}
WhatsApp: ${itinerary.whatsapp || "—"}
Group: ${groupSizeLabel(itinerary)}
Arrival: ${formatArrivalLabel(itinerary)}
Duration: ${itinerary.timing.totalDays} days
Style: ${labelFor(TRAVEL_STYLES, itinerary.travelStyle)}
Motivation: ${labelFor(MOTIVATIONS, itinerary.tripMotivation)}
Interests: ${itinerary.interests.map((id) => labelFor(INTERESTS, id)).join(", ")}
Concerns: ${itinerary.painPoints.map((id) => labelFor(PAIN_POINTS, id)).join(", ")}

This email confirms your draft booking intent under PNR ${ref}.
Review your booking brief: ${resumeUrl}`;
}

/**
 * Dual dispatch: guest boarding-pass confirmation + dedicated concierge lead alert.
 * Does not throw on mail failure — returns per-recipient results so PB save can succeed.
 */
export async function sendDraftBoardingPassEmails(
  params: DraftBoardingPassParams
): Promise<{
  guestSent: boolean;
  teamSent: boolean;
  errors: string[];
}> {
  const cfg = getActiveEmailConfig();
  const teamTo =
    envVal("BUSINESS_CONCIERGE_EMAIL") ||
    cfg.routing.bccRecipient ||
    "armando@tokiotours.nl";
  const guestTo = params.email.trim().toLowerCase();
  const ref = params.bookingRef.trim();
  const errors: string[] = [];
  let guestSent = false;
  let teamSent = false;

  try {
    const guest = await sendTransactionalMail({
      to: guestTo,
      subject: `Draft Reservation Pass · ${ref}`,
      text: buildDraftBoardingPassText(params, "guest"),
      html: buildDraftBoardingPassHtml(params, "guest"),
      skipTeamBcc: true,
    });
    if (guest.sent) guestSent = true;
    else if (guest.reason) errors.push(guest.reason);
  } catch (err) {
    errors.push(
      err instanceof Error ? err.message : "Guest boarding-pass email failed."
    );
  }

  try {
    const team = await sendTransactionalMail({
      to: teamTo,
      subject: `New Draft Lead · ${ref} · ${params.fullName.trim()}`,
      text: buildDraftBoardingPassText(params, "team"),
      html: buildDraftBoardingPassHtml(params, "team"),
      skipTeamBcc: true,
    });
    if (team.sent) teamSent = true;
    else if (team.reason) errors.push(team.reason);
  } catch (err) {
    errors.push(
      err instanceof Error ? err.message : "Team boarding-pass email failed."
    );
  }

  return { guestSent, teamSent, errors };
}
