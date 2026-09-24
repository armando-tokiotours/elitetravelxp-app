import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import type { BuilderState } from "@/store/useBuilderStore";
import type { QuoteResult } from "@/lib/builder-pricing";
import {
  chauffeurDaysFromSelections,
  isBillableChauffeurDay,
} from "@/lib/chauffeurSelections";
import { travelPaceLabel } from "@/lib/travelPace";
import { formatHotelRoomsSummary } from "@/lib/hotelCalculator";
import { normalizeCityHotelPref } from "@/store/useBuilderStore";

function brandLogoPath(): string | null {
  const candidates = [
    path.join(process.cwd(), "public/images/tokiotours-logo.png"),
    path.join(process.cwd(), "public/brand/tokiotours-logo.png"),
    path.join(process.cwd(), "public/images/tokiotours-logo.jpg"),
    path.join(process.cwd(), "public/brand/tokiotours-logo.jpg"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export type ItineraryPdfInput = {
  bookingRef: string;
  contactName?: string;
  contactEmail?: string;
  state: BuilderState;
  quote: QuoteResult | null;
  departureDate: string | null;
  cityNames?: Record<string, string>;
};

function money(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "TBD";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function bullet(doc: PDFKit.PDFDocument, text: string) {
  doc.fillColor("#5C6570").fontSize(9).text(`  • ${text}`, { width: 480 });
}

/**
 * Full itemized itinerary PDF for email attachment —
 * travel window, route/stays, hotels, tours, chauffeur, price range.
 */
export async function buildItineraryPdf(
  input: ItineraryPdfInput
): Promise<Buffer> {
  const {
    bookingRef,
    contactName,
    contactEmail,
    state,
    quote,
    departureDate,
    cityNames = {},
  } = input;

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 48, bottom: 48, left: 48, right: 48 },
    info: {
      Title: `Japan Journey · ${bookingRef}`,
      Author: "TOKIOTOURS",
      Subject: "Private itinerary quotation",
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const cityName = (id: string) => cityNames[id] || id;
  const stays = state.locations.filter(
    (l) => l.visitType === "stay" || !l.visitType
  );
  const totalGuests = Math.max(0, state.adults + state.children);
  const pace = travelPaceLabel(state.travelPace);

  const logoPath = brandLogoPath();
  if (logoPath) {
    try {
      const logoW = 48;
      const pageW =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;
      doc.image(logoPath, doc.page.margins.left + (pageW - logoW) / 2, doc.y, {
        width: logoW,
        height: logoW,
        fit: [logoW, logoW],
        align: "center",
      });
      doc.moveDown(0.6);
    } catch {
      // continue without logo if embed fails
    }
  }

  doc
    .fillColor("#075473")
    .fontSize(10)
    .text("TOKIOTOURS", { align: "center" });
  doc
    .fillColor("#0B1F3A")
    .fontSize(22)
    .text("Japan Journey Design", { align: "center" });
  doc.moveDown(0.3);
  doc
    .fillColor("#5C6570")
    .fontSize(11)
    .text(`Booking PNR: ${bookingRef}`, { align: "center" });
  if (contactName || contactEmail) {
    doc.text(
      [contactName, contactEmail].filter(Boolean).join(" · "),
      { align: "center" }
    );
  }
  doc
    .moveDown(0.4)
    .text(
      `Prepared ${new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })}`,
      { align: "center" }
    );

  // ── Travel Window & Guests ──
  doc.moveDown(1);
  section(doc, "Travel window & guests");
  line(doc, "Arrival date", fmtDate(state.arrivalDate));
  line(doc, "Departure date", fmtDate(departureDate));
  line(doc, "Total days", `${state.durationDays} days`);
  if (pace) line(doc, "Travel pace", `${pace} Pace`);
  line(
    doc,
    "Guests",
    `${state.adults} adult${state.adults === 1 ? "" : "s"}, ${state.children} child${state.children === 1 ? "" : "ren"} (${totalGuests} total)`
  );

  // ── Arrival & departure hubs / VIP transfers ──
  doc.moveDown(0.55);
  section(doc, "Arrival & departure hubs");
  line(
    doc,
    "Arrival hub",
    `${state.arrivalMode === "cruise" ? "Cruise" : "Flight"}${
      state.airportPickup ? " · VIP private pickup" : ""
    }`
  );
  line(
    doc,
    "Departure hub",
    `${state.departureMode === "cruise" ? "Cruise" : "Flight"}${
      state.airportDropoff ? " · VIP private drop-off" : ""
    }`
  );
  if (state.arrivalTransitType && state.arrivalTransitType !== "unset") {
    line(
      doc,
      "Hub → first city",
      `${state.arrivalTransitType}${
        state.arrivalNeedsTicket
          ? ` · ticket ${state.arrivalTicketType || ""}`
          : ""
      }`
    );
  }

  // ── Route & Stays ──
  doc.moveDown(0.55);
  section(doc, "Route & stays breakdown");
  if (stays.length === 0) {
    doc.fillColor("#8A8278").fontSize(10).text("No city stays configured yet.");
  } else {
    const routeSummary = stays
      .map(
        (l) =>
          `${cityName(l.cityId)} ${l.nights} night${l.nights === 1 ? "" : "s"}`
      )
      .join(", ");
    doc
      .fillColor("#0B1F3A")
      .fontSize(10)
      .text(routeSummary, { width: 500 });
    doc.moveDown(0.35);
    for (const loc of stays) {
      line(
        doc,
        cityName(loc.cityId),
        `${loc.nights} night${loc.nights === 1 ? "" : "s"}`
      );
      if (loc.transitType && loc.transitType !== "unset") {
        bullet(
          doc,
          `Onward transit: ${loc.transitType}${
            loc.needsTicket ? ` · ${loc.ticketType || "ticket"}` : ""
          }`
        );
      }
    }
  }

  // ── Selected Accommodations ──
  doc.moveDown(0.55);
  section(doc, "Selected accommodations");
  if (stays.length === 0) {
    doc.fillColor("#8A8278").fontSize(10).text("No hotel stays configured.");
  } else {
    for (const loc of stays) {
      const prefRaw = state.cityHotels?.[loc.cityId];
      const pref = prefRaw
        ? normalizeCityHotelPref(prefRaw, loc.cityId, state.roomCount)
        : null;
      const wantsHotel = pref
        ? pref.needsHotel
        : Boolean(state.needHotels);
      if (!wantsHotel) {
        line(doc, cityName(loc.cityId), "Self-arranged (no hotel)");
        continue;
      }
      const star = pref
        ? `${pref.starRating}-Star Tier`
        : `${state.hotelTier === "5-star" ? "5" : "4"}-Star Tier`;
      const roomsLabel = pref
        ? formatHotelRoomsSummary(pref.rooms, pref.standardOccupancy)
        : `${state.roomCount} room(s)`;
      line(doc, cityName(loc.cityId), `${star} · ${roomsLabel}`);
      if (pref?.breakfast) bullet(doc, "Breakfast included");
    }
  }

  // ── Tours & Chauffeur ──
  doc.moveDown(0.55);
  section(doc, "Tours & chauffeur services");

  if (state.experienceService === "concierge" || state.isEliteConcierge) {
    bullet(doc, "Experience pathway: Elite Concierge (day-by-day design)");
  } else if (state.experienceService === "tailored") {
    bullet(doc, "Experience pathway: Tailored Experiences");
  }

  let hasTours = false;
  for (const loc of stays) {
    const tours = state.selectedTours?.[loc.cityId] ?? [];
    if (!tours.length) continue;
    hasTours = true;
    doc
      .fillColor("#0B1F3A")
      .fontSize(10)
      .text(`${cityName(loc.cityId)} experiences:`, { width: 500 });
    for (const t of tours) {
      const when = t.scheduledDate ? ` · ${fmtDate(t.scheduledDate)}` : "";
      bullet(
        doc,
        `${t.title || t.tourId}${t.selectedLanguage ? ` (${t.selectedLanguage})` : ""}${when}`
      );
    }
  }
  if (!hasTours && !(state.experienceService === "concierge" || state.isEliteConcierge)) {
    doc
      .fillColor("#8A8278")
      .fontSize(10)
      .text("No daily experiences selected yet.");
  }

  const chauffeurMap =
    state.chauffeurSelections &&
    Object.keys(state.chauffeurSelections).length > 0
      ? state.chauffeurSelections
      : null;
  const chauffeurDays = chauffeurMap
    ? chauffeurDaysFromSelections(chauffeurMap)
    : state.chauffeurDays ?? {};

  const chauffeurEntries = Object.entries(chauffeurDays).filter(
    ([, dates]) => (dates?.length ?? 0) > 0
  );
  if (chauffeurEntries.length || state.airportPickup || state.airportDropoff) {
    doc.moveDown(0.25);
    doc
      .fillColor("#0B1F3A")
      .fontSize(10)
      .text("Private driver / transfers:", { width: 500 });
    if (state.airportPickup) {
      bullet(doc, "VIP arrival airport/cruise pickup");
    }
    if (state.airportDropoff) {
      bullet(doc, "VIP departure airport/cruise drop-off");
    }
    for (const [cityId, dates] of chauffeurEntries) {
      for (const date of dates) {
        const sel = chauffeurMap?.[cityId]?.[date];
        if (sel && !isBillableChauffeurDay(sel)) continue;
        const mode =
          sel?.mode === "by_tour"
            ? "by-tour chauffeur"
            : sel?.mode === "full_day"
              ? "full-day chauffeur"
              : "private chauffeur";
        bullet(doc, `${cityName(cityId)} · ${fmtDate(date)} · ${mode}`);
      }
    }
  }

  // ── Price Range Summary ──
  if (quote) {
    doc.moveDown(0.9);
    section(doc, "Price range summary");
    doc
      .fillColor("#0B1F3A")
      .fontSize(16)
      .text(`${money(quote.min)} – ${money(quote.max)}`, { align: "center" });
    const guests = Math.max(1, totalGuests);
    doc
      .fillColor("#5C6570")
      .fontSize(10)
      .text(
        `Est. ${money(Math.round(quote.min / guests))} – ${money(Math.round(quote.max / guests))} per person`,
        { align: "center" }
      );
  }

  doc.moveDown(1.5);
  doc
    .fillColor("#8A8278")
    .fontSize(9)
    .text(
      "This document reflects your saved trip builder selections — route, hotels, private transfers, and experiences. Use your email and booking PNR anytime to reload and edit your itinerary. Final quotation is confirmed by your TOKIOTOURS consultant.",
      { align: "center" }
    );
  doc.moveDown(0.5);
  doc
    .fillColor("#0B1F3A")
    .fontSize(10)
    .text("tokiotours-app.com", { align: "center" });

  doc.end();
  return done;
}

function section(doc: PDFKit.PDFDocument, title: string) {
  doc
    .fillColor("#075473")
    .fontSize(9)
    .text(title.toUpperCase(), { characterSpacing: 1.2 });
  doc.moveDown(0.25);
}

function line(doc: PDFKit.PDFDocument, left: string, right: string) {
  doc.fillColor("#0B1F3A").fontSize(10);
  const y = doc.y;
  doc.text(left, { continued: false, width: 280 });
  doc.text(right, 320, y, { width: 220, align: "right" });
  doc.moveDown(0.15);
}
