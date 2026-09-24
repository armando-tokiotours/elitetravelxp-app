/**
 * Admin dossier PDF from a bookings_and_leads row snapshot.
 * Client-side html2pdf — does not mutate builder stores.
 */

export type DossierLeadInput = {
  booking_ref: string;
  email?: string;
  status?: string;
  type?: string;
  primary_city?: string;
  tour_date?: string | null;
  guests?: { adults?: number; kids?: number };
  duration_value?: number;
  quote_min?: number;
  quote_max?: number;
  selections?: Record<string, unknown> | null;
};

function money(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function escapeHtml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildDossierHtml(lead: DossierLeadInput): string {
  const ref = String(lead.booking_ref || "DRAFT").toUpperCase();
  const isSingle = lead.type === "single_day";
  const sel = (lead.selections || {}) as Record<string, unknown>;
  const adults = Number(lead.guests?.adults) || 0;
  const kids = Number(lead.guests?.kids) || 0;
  const city = String(lead.primary_city || sel.cityFocus || "—");
  const date = lead.tour_date
    ? String(lead.tour_date).slice(0, 10)
    : "TBD";
  const duration = lead.duration_value
    ? `${lead.duration_value}${isSingle ? " hours" : " days"}`
    : "—";

  const experienceLines: string[] = [];
  if (isSingle) {
    const ids = Array.isArray(sel.selectedExperienceIds)
      ? (sel.selectedExperienceIds as string[])
      : [];
    for (const id of ids) {
      experienceLines.push(`Experience ID: ${id}`);
    }
    if (sel.guidePreference) {
      experienceLines.push(`Guide: ${String(sel.guidePreference)}`);
    }
    if (sel.startHour) {
      experienceLines.push(`Start: ${String(sel.startHour)}`);
    }
    if (sel.pace) experienceLines.push(`Pace: ${String(sel.pace)}`);
  } else {
    const cities = Array.isArray(sel.locationCityIds)
      ? (sel.locationCityIds as string[])
      : [];
    if (cities.length) {
      experienceLines.push(`Cities: ${cities.join(" → ")}`);
    }
    const schedule = Array.isArray(sel.experienceSchedule)
      ? (sel.experienceSchedule as Array<Record<string, unknown>>)
      : [];
    for (const row of schedule) {
      const title = String(row.tourId || "Tour");
      const d = row.date ? String(row.date).slice(0, 10) : "";
      experienceLines.push(d ? `${title} · ${d}` : title);
    }
    const ids = Array.isArray(sel.experienceIds)
      ? (sel.experienceIds as string[])
      : [];
    if (!schedule.length && ids.length) {
      for (const id of ids) experienceLines.push(`Tour ID: ${id}`);
    }
  }

  const quoteParts: string[] = [];
  if (lead.quote_min != null && lead.quote_min > 0) {
    quoteParts.push(money(lead.quote_min));
  }
  if (
    lead.quote_max != null &&
    lead.quote_max > 0 &&
    lead.quote_max !== lead.quote_min
  ) {
    quoteParts.push(money(lead.quote_max));
  }
  const quoteLabel = quoteParts.length
    ? quoteParts.join(" – ")
    : "Quote pending";

  const expHtml = experienceLines.length
    ? experienceLines
        .map(
          (line) =>
            `<li style="margin:4px 0;color:#334155">${escapeHtml(line)}</li>`
        )
        .join("")
    : `<li style="color:#94a3b8">No experiences saved on this lead yet.</li>`;

  return `
  <div class="dossier-root" style="font-family:Georgia,serif;color:#0B1F3A;padding:24px;background:#fff;width:720px">
  <p style="font-size:10px;letter-spacing:.28em;text-transform:uppercase;color:#075473;font-weight:700;margin:0">TOKIOTOURS · ${isSingle ? "Single-Day" : "Multi-Day"} Dossier</p>
  <h1 style="font-size:22px;letter-spacing:.08em;text-transform:uppercase;margin:8px 0 4px">Travel Itinerary Snapshot</h1>
  <p style="font-family:ui-monospace,monospace;font-size:18px;color:#B45309;font-weight:700;margin:12px 0">${escapeHtml(ref)}</p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0;font-size:13px">
    <div><div style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.14em">Guest email</div><div style="font-weight:600;margin-top:2px">${escapeHtml(lead.email || "—")}</div></div>
    <div><div style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.14em">Status</div><div style="font-weight:600;margin-top:2px">${escapeHtml(String(lead.status || "lead"))}</div></div>
    <div><div style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.14em">City hub</div><div style="font-weight:600;margin-top:2px">${escapeHtml(city)}</div></div>
    <div><div style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.14em">Date / Duration</div><div style="font-weight:600;margin-top:2px">${escapeHtml(date)} · ${escapeHtml(duration)}</div></div>
    <div><div style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.14em">Guests</div><div style="font-weight:600;margin-top:2px">${adults} adults, ${kids} children</div></div>
    <div><div style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.14em">Estimate</div><div style="font-weight:600;margin-top:2px">${escapeHtml(quoteLabel)}</div></div>
  </div>
  <div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-top:16px">
    <p style="font-size:10px;letter-spacing:.28em;text-transform:uppercase;color:#075473;font-weight:700;margin:0 0 8px">Saved selections</p>
    <ul style="padding-left:18px;margin:8px 0">${expHtml}</ul>
  </div>
  <div style="margin-top:20px;padding:14px;background:#0B1F3A;color:#fff;border-radius:12px">
    <p style="margin:0;font-size:10px;letter-spacing:.2em;text-transform:uppercase;opacity:.7">Package estimate</p>
    <p style="margin:6px 0 0;font-size:24px;font-weight:700">${escapeHtml(quoteLabel)}</p>
  </div>
  <p style="margin-top:24px;text-align:center;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#94a3b8">TOKIOTOURS · Admin dossier export</p>
  </div>`;
}

async function loadHtml2Pdf(): Promise<
  (el?: HTMLElement) => {
    set: (opts: unknown) => {
      from: (src: HTMLElement | string) => {
        save: () => Promise<void>;
      };
    };
  }
> {
  const mod = await import("html2pdf.js");
  return (mod.default || mod) as never;
}

/**
 * Generate + download Tokiotours_Itinerary_{booking_ref}.pdf from a lead row.
 */
export async function generateDossierPdf(lead: DossierLeadInput): Promise<void> {
  const ref = String(lead.booking_ref || "DRAFT")
    .trim()
    .toUpperCase()
    .replace(/[^\w.-]+/g, "_");
  if (!ref) throw new Error("Missing booking reference.");

  const html = buildDossierHtml(lead);
  const host = document.createElement("div");
  host.setAttribute("id", "admin-dossier-pdf-host");
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;width:800px;background:#fff;z-index:-1;";
  host.innerHTML = html;
  document.body.appendChild(host);

  try {
    const root =
      (host.querySelector(".dossier-root") as HTMLElement | null) || host;
    const html2pdf = await loadHtml2Pdf();
    await html2pdf()
      .set({
        margin: 10,
        filename: `Tokiotours_Itinerary_${ref}.pdf`,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] },
      })
      .from(root)
      .save();
  } finally {
    host.remove();
  }
}
