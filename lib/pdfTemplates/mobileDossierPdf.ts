/**
 * Mobile-first printable HTML for Tokiotours dossier / invoice PDFs.
 * Viewport ~430×932 (iPhone class) with dark brand fidelity + #E60F43 glow.
 */

export type MobilePdfDocKind = "dossier" | "invoice";

export type MobilePassPdfData = {
  pnrCode: string;
  guestName: string;
  partyText: string;
  travelStyle: string;
  tripType: "single" | "multi";
  passLabel: string;
  leftCode: string;
  leftLabel: string;
  rightCode: string;
  rightLabel: string;
  durationText: string;
  startDateText: string;
  endDateText: string;
  experienceType?: string;
  singleDayHighlights?: string;
  routeLines?: string[];
  qrDataUrl?: string;
  dossierUrl?: string;
};

export type MobileInvoicePdfData = {
  pnrCode: string;
  guestName: string;
  partyText: string;
  quoteMin?: number | null;
  quoteMax?: number | null;
  currency?: string;
  lineItems?: Array<{ label: string; detail?: string }>;
  tourDateText?: string;
  notes?: string[];
};

function esc(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(n: number, currency = "EUR"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

const BASE_CSS = `
  @page { size: 430px auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #04080C;
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body {
    width: 430px;
    padding: 20px 18px 28px;
  }
  .card {
    position: relative;
    background: #0A1017;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px;
    padding: 22px 20px;
    overflow: hidden;
    margin-bottom: 16px;
  }
  .glow {
    position: absolute;
    top: -64px;
    right: -64px;
    width: 220px;
    height: 220px;
    border-radius: 50%;
    pointer-events: none;
    opacity: 0.38;
    background: radial-gradient(circle, #E60F43 0%, rgba(230,15,67,0) 70%);
  }
  .z { position: relative; z-index: 1; }
  .brand-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    padding-bottom: 14px;
    margin-bottom: 16px;
  }
  .brand {
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .badge {
    flex-shrink: 0;
    padding: 5px 10px;
    border-radius: 999px;
    border: 1px solid rgba(34,211,238,0.35);
    background: rgba(6,182,212,0.12);
    color: #22d3ee;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .times {
    display: flex;
    align-items: center;
    justify-content: space-between;
    text-align: center;
    gap: 8px;
    padding: 8px 0 4px;
  }
  .time-val {
    font-size: 22px;
    font-weight: 900;
    letter-spacing: 0.04em;
  }
  .time-lbl {
    display: block;
    margin-top: 4px;
    font-size: 8px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #94a3b8;
  }
  .mid {
    flex: 1;
    padding: 0 6px;
  }
  .mid-dur {
    color: #F6A724;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .mid-line {
    height: 2px;
    margin: 6px auto;
    width: 88px;
    background: linear-gradient(90deg, transparent, #22d3ee, transparent);
  }
  .mid-date {
    font-size: 9px;
    color: #cbd5e1;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .grid3 {
    display: grid;
    grid-template-columns: 1.2fr 0.9fr 1fr;
    gap: 8px;
    border-top: 1px solid rgba(255,255,255,0.1);
    border-bottom: 1px solid rgba(255,255,255,0.1);
    padding: 14px 0;
    margin: 14px 0;
    text-align: left;
  }
  .lbl {
    display: block;
    font-size: 8px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #64748b;
    margin-bottom: 4px;
  }
  .val {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    line-height: 1.25;
    word-break: break-word;
  }
  .amber { color: #F6A724; }
  .center { text-align: center; }
  .pnr-lbl {
    font-size: 9px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #64748b;
  }
  .pnr {
    margin-top: 4px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 18px;
    font-weight: 800;
    letter-spacing: 0.16em;
    color: #F6A724;
  }
  .qr-wrap {
    display: inline-block;
    margin-top: 14px;
    padding: 10px;
    background: #ffffff;
    border-radius: 14px;
  }
  .qr-wrap img { display: block; width: 112px; height: 112px; }
  .meta {
    margin-top: 12px;
    font-size: 10px;
    color: #94a3b8;
    line-height: 1.45;
  }
  .section-title {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #22d3ee;
    margin: 0 0 12px;
  }
  .line {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    font-size: 12px;
  }
  .line:last-child { border-bottom: 0; }
  .muted { color: #94a3b8; }
  .quote {
    margin-top: 14px;
    padding: 12px 14px;
    border-radius: 12px;
    background: rgba(246,167,36,0.1);
    border: 1px solid rgba(246,167,36,0.35);
  }
  .quote strong {
    display: block;
    font-size: 20px;
    color: #F6A724;
    letter-spacing: 0.02em;
  }
  .foot {
    margin-top: 10px;
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #64748b;
    text-align: center;
  }
`;

export function generateMobilePassHtml(data: MobilePassPdfData): string {
  const routeHtml = (data.routeLines || [])
    .map((line) => `<div class="meta">${esc(line)}</div>`)
    .join("");
  const highlight = data.singleDayHighlights || data.experienceType || "";
  const endDateBlock =
    data.tripType === "multi" && data.endDateText
      ? `<div class="mid-date">TO ${esc(data.endDateText)}</div>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=430" />
  <title>Tokiotours Pass ${esc(data.pnrCode)}</title>
  <style>${BASE_CSS}</style>
</head>
<body>
  <div class="card">
    <div class="glow" aria-hidden="true"></div>
    <div class="z">
      <div class="brand-row">
        <div class="brand">TOKIOTOURS</div>
        <div class="badge">${esc(data.passLabel)}</div>
      </div>

      <div class="times">
        <div>
          <div class="time-val">${esc(data.leftCode)}</div>
          <span class="time-lbl">${esc(data.leftLabel)}</span>
        </div>
        <div class="mid">
          <div class="mid-dur">${esc(data.durationText)}</div>
          <div class="mid-line"></div>
          <div class="mid-date">${esc(data.startDateText || "DATE TBD")}</div>
          ${endDateBlock}
        </div>
        <div>
          <div class="time-val">${esc(data.rightCode)}</div>
          <span class="time-lbl">${esc(data.rightLabel)}</span>
        </div>
      </div>

      <div class="grid3">
        <div>
          <span class="lbl">Guest</span>
          <div class="val">${esc(data.guestName)}</div>
        </div>
        <div>
          <span class="lbl">Party</span>
          <div class="val">${esc(data.partyText)}</div>
        </div>
        <div>
          <span class="lbl">Style</span>
          <div class="val amber">${esc(data.travelStyle || "—")}</div>
        </div>
      </div>

      ${highlight ? `<div class="meta">${esc(highlight)}</div>` : ""}
      ${routeHtml}

      <div class="center" style="padding-top:8px">
        <div class="pnr-lbl">Booking Ref</div>
        <div class="pnr">${esc(data.pnrCode)}</div>
        ${
          data.qrDataUrl
            ? `<div class="qr-wrap"><img src="${esc(data.qrDataUrl)}" alt="QR" /></div>`
            : ""
        }
        ${
          data.dossierUrl
            ? `<div class="meta" style="margin-top:10px;word-break:break-all">${esc(data.dossierUrl)}</div>`
            : ""
        }
      </div>
    </div>
  </div>
  <div class="foot">Tokiotours · Mobile itinerary pass</div>
</body>
</html>`;
}

export function generateMobileInvoiceHtml(data: MobileInvoicePdfData): string {
  const currency = data.currency || "EUR";
  const lines = (data.lineItems || [])
    .map(
      (item) =>
        `<div class="line"><span>${esc(item.label)}</span><span class="muted">${esc(item.detail || "")}</span></div>`
    )
    .join("");
  const notes = (data.notes || [])
    .map((n) => `<div class="meta">• ${esc(n)}</div>`)
    .join("");

  let quoteBlock = "";
  if (data.quoteMin != null && data.quoteMax != null && data.quoteMax > 0) {
    const range =
      data.quoteMax > data.quoteMin
        ? `${money(data.quoteMin, currency)} – ${money(data.quoteMax, currency)}`
        : money(data.quoteMax, currency);
    quoteBlock = `<div class="quote"><span class="lbl">Estimated package</span><strong>${esc(range)}</strong></div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=430" />
  <title>Tokiotours Invoice ${esc(data.pnrCode)}</title>
  <style>${BASE_CSS}</style>
</head>
<body>
  <div class="card">
    <div class="glow" aria-hidden="true"></div>
    <div class="z">
      <div class="brand-row">
        <div class="brand">TOKIOTOURS</div>
        <div class="badge">Private Quotation</div>
      </div>
      <h1 class="section-title">Invoice summary</h1>
      <div class="grid3" style="border-bottom:0;margin-bottom:4px">
        <div>
          <span class="lbl">Guest</span>
          <div class="val">${esc(data.guestName)}</div>
        </div>
        <div>
          <span class="lbl">Party</span>
          <div class="val">${esc(data.partyText)}</div>
        </div>
        <div>
          <span class="lbl">Ref</span>
          <div class="val amber">${esc(data.pnrCode)}</div>
        </div>
      </div>
      ${
        data.tourDateText
          ? `<div class="meta">Tour date: <strong style="color:#fff">${esc(data.tourDateText)}</strong></div>`
          : ""
      }
      ${lines ? `<div style="margin-top:10px">${lines}</div>` : ""}
      ${quoteBlock}
      ${notes}
    </div>
  </div>
  <div class="foot">Tokiotours · Mobile quotation</div>
</body>
</html>`;
}
