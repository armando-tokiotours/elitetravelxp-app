/**
 * Build mobile dossier / invoice PDF buffers from builder send payload.
 */

import QRCode from "qrcode";
import type { BuilderState } from "@/store/useBuilderStore";
import type { QuoteResult } from "@/lib/builder-pricing";
import {
  buildDossierQrUrl,
  buildRouteBreakdown,
  formatGuestCountText,
  formatPassDateLine,
} from "@/lib/dossier/bookingPassHelpers";
import { htmlToMobilePdf, mobilePdfAvailable } from "@/lib/pdf/mobilePdfEngine";
import {
  generateMobileInvoiceHtml,
  generateMobilePassHtml,
  type MobileInvoicePdfData,
  type MobilePassPdfData,
} from "@/lib/pdfTemplates/mobileDossierPdf";
import { travelPaceLabel } from "@/lib/travelPace";

export type MobilePdfBuildInput = {
  bookingRef: string;
  contactName?: string;
  contactEmail?: string;
  state: BuilderState;
  quote?: QuoteResult | null;
  departureDate?: string | null;
  cityNames?: Record<string, string>;
  sendDocs?: { dossier?: boolean; invoice?: boolean };
};

function cityName(
  id: string,
  map: Record<string, string>
): string {
  return map[id] || id;
}

function isSingle(state: BuilderState): boolean {
  return state.tripMode === "single_day";
}

async function qrDataUrl(value: string): Promise<string | undefined> {
  try {
    return await QRCode.toDataURL(value, {
      margin: 1,
      width: 240,
      errorCorrectionLevel: "M",
      color: { dark: "#0A1017", light: "#FFFFFF" },
    });
  } catch {
    return undefined;
  }
}

export function buildMobilePassData(
  input: MobilePdfBuildInput
): MobilePassPdfData {
  const { bookingRef, contactName, state, cityNames = {} } = input;
  const single = isSingle(state);
  const adults = state.adults ?? 2;
  const children = state.children ?? 0;
  const tourDate = String(
    (state as { tourDate?: string | null }).tourDate ||
      state.arrivalDate ||
      ""
  );
  const dep = input.departureDate || null;

  const dossierPath = single
    ? "/builder-single/itinerary"
    : "/builder/itinerary";
  const dossierUrl = buildDossierQrUrl(bookingRef, dossierPath);

  const startTime =
    String((state as { startTime?: string }).startTime || "09:00").slice(0, 5);
  const tourHours = Number((state as { tourHours?: number }).tourHours) || 6;
  const endH = Math.min(23, Number(startTime.slice(0, 2)) + tourHours);
  const endTime = `${String(endH).padStart(2, "0")}:${startTime.slice(3, 5)}`;

  const route = buildRouteBreakdown(state.locations || [], (id) =>
    cityName(id, cityNames)
  );
  const routeLines = route.map(
    (r) => `${r.city} · ${r.nights} night${r.nights === 1 ? "" : "s"}`
  );

  const pace = travelPaceLabel(state.travelPace) || "Private";

  return {
    pnrCode: bookingRef,
    guestName: (contactName || "Guest").toUpperCase(),
    partyText: formatGuestCountText(adults, children),
    travelStyle: pace.toUpperCase(),
    tripType: single ? "single" : "multi",
    passLabel: single ? "Japan Day Tour Pass" : "Japan Multi-Day Pass",
    leftCode: single ? startTime : "NRT",
    leftLabel: single ? "Start / Pickup" : "Arrival Hub",
    rightCode: single ? endTime : "HND",
    rightLabel: single ? "Finish / Drop-off" : "Departure Hub",
    durationText: single
      ? `${tourHours} HOURS`
      : `${Math.max(1, state.durationDays || route.length || 1)} DAYS`,
    startDateText: formatPassDateLine(tourDate || state.arrivalDate),
    endDateText: formatPassDateLine(dep),
    singleDayHighlights: single
      ? String(
          (state as { cityFocus?: string }).cityFocus ||
            cityNames[state.locations?.[0]?.cityId || ""] ||
            "TOKYO"
        ).toUpperCase()
      : undefined,
    routeLines: single ? undefined : routeLines,
    dossierUrl,
  };
}

export function buildMobileInvoiceData(
  input: MobilePdfBuildInput
): MobileInvoicePdfData {
  const { bookingRef, contactName, state, quote, cityNames = {} } = input;
  const single = isSingle(state);
  const adults = state.adults ?? 2;
  const children = state.children ?? 0;
  const tourDate = String(
    (state as { tourDate?: string | null }).tourDate ||
      state.arrivalDate ||
      ""
  );

  const lineItems: Array<{ label: string; detail?: string }> = [];
  if (single) {
    lineItems.push({
      label: "Single-day private package",
      detail: String(
        (state as { cityFocus?: string }).cityFocus || "Tokyo"
      ),
    });
  } else {
    for (const loc of state.locations || []) {
      const name = cityName(loc.cityId, cityNames);
      if (!name) continue;
      lineItems.push({
        label: name,
        detail: `${Math.max(0, Number(loc.nights) || 0)} nights`,
      });
    }
  }

  return {
    pnrCode: bookingRef,
    guestName: (contactName || "Guest").toUpperCase(),
    partyText: formatGuestCountText(adults, children),
    quoteMin: quote?.min ?? null,
    quoteMax: quote?.max ?? null,
    currency: "EUR",
    lineItems,
    tourDateText: formatPassDateLine(tourDate) || undefined,
    notes: [
      "Private quotation — subject to availability.",
      "Team copy BCC on Send / Print confirmation.",
    ],
  };
}

export async function buildMobileItineraryPdfs(
  input: MobilePdfBuildInput
): Promise<Array<{ kind: "dossier" | "invoice"; filename: string; content: Buffer }>> {
  if (!mobilePdfAvailable()) {
    throw new Error("Mobile PDF engine unavailable (Chromium missing).");
  }

  let dossier = input.sendDocs?.dossier ?? true;
  let invoice = input.sendDocs?.invoice ?? true;
  if (!dossier && !invoice) dossier = true;

  const out: Array<{
    kind: "dossier" | "invoice";
    filename: string;
    content: Buffer;
  }> = [];
  const ref = input.bookingRef || "draft";

  if (dossier) {
    const pass = buildMobilePassData(input);
    pass.qrDataUrl = await qrDataUrl(pass.dossierUrl || pass.pnrCode);
    const content = await htmlToMobilePdf(generateMobilePassHtml(pass));
    out.push({
      kind: "dossier",
      filename: `Tokiotours-Dossier-${ref}.pdf`,
      content,
    });
  }

  if (invoice) {
    const inv = buildMobileInvoiceData(input);
    const content = await htmlToMobilePdf(generateMobileInvoiceHtml(inv));
    out.push({
      kind: "invoice",
      filename: `Tokiotours-Invoice-${ref}.pdf`,
      content,
    });
  }

  return out;
}
