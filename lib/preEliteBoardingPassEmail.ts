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
        `<span style="display:inline-block;margin:0 6px 6px 0;padding:4px 10px;border-radius:999px;border:1px solid #075473;color:#075473;font-size:11px;letter-spacing:0.04em;">${escapeHtml(l)}</span>`
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
  const resumeUrl = `${siteBaseUrl()}/builder?ref=${encodeURIComponent(ref)}`;
  const arrival = formatArrivalLabel(itinerary);
  const days = itinerary.timing.totalDays;
  const style = labelFor(TRAVEL_STYLES, itinerary.travelStyle);
  const interests = itinerary.interests.map((id) => labelFor(INTERESTS, id));
  const motivation = labelFor(MOTIVATIONS, itinerary.tripMotivation);
  const concerns = itinerary.painPoints.map((id) => labelFor(PAIN_POINTS, id));
  const teamBanner =
    variant === "team"
      ? `<p style="margin:0 0 16px;padding:10px 12px;border-radius:10px;background:#075473;color:#fff;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">New draft lead · Concierge alert</p>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#0B0B0C;font-family:Georgia,'Times New Roman',serif;color:#F5F0E8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0B0B0C;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#1C1C1E;border:1px solid #075473;border-radius:18px;overflow:hidden;">
        <tr>
          <td style="padding:22px 24px 12px;border-bottom:1px dashed #075473;">
            ${teamBanner}
            <img src="https://tokiotours-app.com/images/tokiotours-logo.png" alt="TOKIOTOURS" width="44" height="44" style="display:block;border-radius:9999px;margin:0 0 12px 0;" />
            <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:#075473;">
              TOKIOTOURS · Draft Reservation Pass
            </p>
            <h1 style="margin:10px 0 0;font-size:26px;line-height:1.2;color:#FFFFFF;text-transform:uppercase;letter-spacing:0.05em;">Boarding Pass · Intent</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:12px 14px;background:#121212;border:1px solid #075473;border-radius:12px;">
                  <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#075473;">Pass Ref</p>
                  <p style="margin:6px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;letter-spacing:0.08em;color:#FFFFFF;">${escapeHtml(ref)}</p>
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;">
              <tr>
                <td width="50%" valign="top" style="padding-right:8px;">
                  <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#8A8278;">Passenger</p>
                  <p style="margin:6px 0 0;font-size:16px;color:#FFFFFF;">${escapeHtml(name)}</p>
                </td>
                <td width="50%" valign="top" style="padding-left:8px;">
                  <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#8A8278;">Group</p>
                  <p style="margin:6px 0 0;font-size:16px;color:#FFFFFF;">${escapeHtml(groupSizeLabel(itinerary))}</p>
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding-top:14px;">
                  <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#8A8278;">Email</p>
                  <p style="margin:6px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#075473;">${escapeHtml(email)}</p>
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding-top:14px;">
                  <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#8A8278;">WhatsApp</p>
                  <p style="margin:6px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#FFFFFF;">${escapeHtml(itinerary.whatsapp || "—")}</p>
                </td>
              </tr>
            </table>

            <div style="margin-top:20px;padding-top:16px;border-top:1px dashed #3A3A3C;">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#075473;">Itinerary Brief</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#F5F0E8;">
                <tr>
                  <td style="padding:6px 0;color:#8A8278;">Target arrival</td>
                  <td align="right" style="padding:6px 0;color:#FFFFFF;">${escapeHtml(arrival)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#8A8278;">Duration</td>
                  <td align="right" style="padding:6px 0;color:#FFFFFF;">${days} Day${days === 1 ? "" : "s"}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#8A8278;">Travel style</td>
                  <td align="right" style="padding:6px 0;color:#FFFFFF;">${escapeHtml(style)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#8A8278;">Motivation</td>
                  <td align="right" style="padding:6px 0;color:#FFFFFF;">${escapeHtml(motivation)}</td>
                </tr>
              </table>
              <p style="margin:14px 0 6px;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#8A8278;">Interests</p>
              <div>${chipList(interests)}</div>
              <p style="margin:12px 0 6px;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#8A8278;">Concerns</p>
              <div>${chipList(concerns)}</div>
            </div>

            <div style="margin-top:20px;padding:14px 16px;border-radius:14px;background:#075473;background:rgba(7,84,115,0.15);border:1px solid rgba(7,84,115,0.45);">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.55;color:#075473;">
                This email confirms your draft booking intent. Your itinerary design brief is registered under PNR <strong style="color:#FFFFFF;">${escapeHtml(ref)}</strong>. You can update or build further details at any time using your reference code.
              </p>
            </div>

            <div style="margin-top:22px;text-align:center;">
              <a href="${escapeHtml(resumeUrl)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#075473;color:#FFFFFF;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;text-decoration:none;letter-spacing:0.04em;">
                Continue in Trip Builder →
              </a>
              <p style="margin:12px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#8A8278;">
                ${escapeHtml(resumeUrl)}
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 24px 22px;border-top:1px dashed #3A3A3C;">
            <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#5C6570;text-align:center;">
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
  const resumeUrl = `${siteBaseUrl()}/builder?ref=${encodeURIComponent(ref)}`;
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
Continue building: ${resumeUrl}`;
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
