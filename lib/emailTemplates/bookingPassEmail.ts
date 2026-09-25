/**
 * Dark Japan Pass stub for transactional emails.
 * Uses solid hex backgrounds (not rgba/gradients) so Gmail/Outlook
 * cannot fall back to a white client chrome.
 */

export type BookingPassEmailFields = {
  pnrCode: string;
  guestName: string;
  partyText: string;
  travelStyle: string;
  startDateText: string;
  endDateText?: string | null;
  siteOrigin?: string;
  /** When false, omit Apple Wallet CTA (e.g. draft-only briefs). Default true. */
  includeWalletCta?: boolean;
};

const BG = "#04080C";
const CARD = "#0A1017";
const BORDER = "#1E293B";
const TEXT = "#E2E8F0";
const AMBER = "#F6A724";
const SKY = "#38BDF8";
const TEAL = "#075473";

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

function siteOrigin(raw?: string): string {
  return (raw || "https://tokiotours-app.com").replace(/\/$/, "");
}

/** Inner pass card HTML (embed inside a larger email). */
export function renderBookingPassCardHtml(
  fields: BookingPassEmailFields
): string {
  const origin = siteOrigin(fields.siteOrigin);
  const pnr = escapeHtml(fields.pnrCode);
  const guest = escapeHtml(fields.guestName || "GUEST");
  const party = escapeHtml(fields.partyText || "—");
  const style = escapeHtml(fields.travelStyle || "—");
  const start = escapeHtml(fields.startDateText || "—");
  const end = fields.endDateText
    ? escapeHtml(fields.endDateText)
    : "";
  const dates =
    end && end !== "—" && end !== start ? `${start} to ${end}` : start;
  const dossierUrl = escapeHtml(
    `${origin}/builder/itinerary?ref=${encodeURIComponent(fields.pnrCode)}&view=dossier`
  );
  const walletUrl = escapeHtml(
    `${origin}/api/wallet/apple/generate?pnr=${encodeURIComponent(fields.pnrCode)}`
  );
  const includeWallet = fields.includeWalletCta !== false;

  return `<div style="background-color:${CARD};color:#ffffff;padding:20px;border-radius:16px;border:1px solid ${BORDER};">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-bottom:1px dashed #334155;padding-bottom:12px;margin-bottom:12px;">
    <tr>
      <td style="color:${AMBER};font-size:13px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;">TOKIOTOURS JAPAN PASS</td>
      <td align="right" style="font-family:monospace;font-size:14px;color:${SKY};">REF: ${pnr}</td>
    </tr>
  </table>
  <p style="margin:6px 0;font-size:13px;color:${TEXT};"><strong style="color:#94A3B8;">GUEST:</strong> ${guest}</p>
  <p style="margin:6px 0;font-size:13px;color:${TEXT};"><strong style="color:#94A3B8;">PARTY:</strong> ${party}</p>
  <p style="margin:6px 0;font-size:13px;color:${TEXT};"><strong style="color:#94A3B8;">STYLE:</strong> ${style}</p>
  <p style="margin:6px 0;font-size:13px;color:${TEXT};"><strong style="color:#94A3B8;">DATES:</strong> ${dates}</p>
  <div style="margin-top:20px;text-align:center;">
    <a href="${dossierUrl}" style="background-color:${TEAL};color:#ffffff;padding:12px 20px;text-decoration:none;font-weight:bold;border-radius:10px;display:inline-block;margin:0 0 10px 0;font-size:11px;letter-spacing:0.06em;">VIEW DOSSIER ONLINE</a>
    ${
      includeWallet
        ? `<br/><a href="${walletUrl}" style="background-color:#000000;color:#ffffff;border:1px solid #475569;padding:12px 20px;text-decoration:none;font-weight:bold;border-radius:10px;display:inline-block;font-size:11px;letter-spacing:0.06em;">ADD TO APPLE WALLET</a>`
        : ""
    }
  </div>
</div>`;
}

/** Standalone dark email body focused on the Japan Pass. */
export function renderBookingPassEmailHtml(
  fields: BookingPassEmailFields
): string {
  const card = renderBookingPassCardHtml(fields);
  return `<!DOCTYPE html>
<html lang="en" style="background-color:${BG};" bgcolor="${BG}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark only" />
  <meta name="supported-color-schemes" content="dark only" />
  <style type="text/css">
    :root { color-scheme: dark only; supported-color-schemes: dark only; }
    body, table, td { background-color: ${BG} !important; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BG};color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;" bgcolor="${BG}">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="${BG}" style="background-color:${BG};padding:20px 12px;">
    <tr>
      <td align="center" bgcolor="${BG}" style="background-color:${BG};">
        <table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" bgcolor="${CARD}" style="max-width:600px;width:100%;background-color:${CARD};border-radius:16px;border:1px solid ${BORDER};">
          <tr>
            <td style="padding:20px;" bgcolor="${CARD}">
              ${card}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
