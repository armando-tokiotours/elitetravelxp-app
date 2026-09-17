import PDFDocument from "pdfkit";
import type { BuilderState } from "@/store/useBuilderStore";
import type { QuoteResult } from "@/lib/builder-pricing";

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

/** Build a concise PDF summary buffer (no browser print). */
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
      Author: "Elite Travel Experiences",
      Subject: "Private itinerary quotation",
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc
    .fillColor("#C4A35A")
    .fontSize(10)
    .text("ELITE TRAVEL EXPERIENCES", { align: "center" });
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

  doc.moveDown(1);
  section(doc, "Travel window");
  line(doc, "Duration", `${state.durationDays} days`);
  line(doc, "Arrival", fmtDate(state.arrivalDate));
  line(doc, "Departure", fmtDate(departureDate));
  if (state.travelPace) {
    line(
      doc,
      "Travel pace",
      state.travelPace.charAt(0).toUpperCase() + state.travelPace.slice(1)
    );
  }

  doc.moveDown(0.6);
  section(doc, "Guests");
  line(
    doc,
    "Party",
    `${state.adults} adult${state.adults === 1 ? "" : "s"}, ${state.children} child${state.children === 1 ? "" : "ren"}`
  );

  doc.moveDown(0.6);
  section(doc, "Route & stays");
  const stays = state.locations.filter(
    (l) => l.visitType === "stay" || !l.visitType
  );
  if (stays.length === 0) {
    doc.fillColor("#8A8278").fontSize(10).text("No stays configured yet.");
  } else {
    for (const loc of stays) {
      const name = cityNames[loc.cityId] || loc.cityId;
      line(
        doc,
        name,
        `${loc.nights} night${loc.nights === 1 ? "" : "s"}`
      );
      const tours = state.selectedTours?.[loc.cityId] ?? [];
      for (const t of tours.slice(0, 8)) {
        doc
          .fillColor("#5C6570")
          .fontSize(9)
          .text(`  · ${t.title}${t.selectedLanguage ? ` (${t.selectedLanguage})` : ""}`);
      }
      if (tours.length > 8) {
        doc
          .fillColor("#8A8278")
          .fontSize(9)
          .text(`  · +${tours.length - 8} more experiences`);
      }
    }
  }

  if (state.experienceService === "concierge" || state.isEliteConcierge) {
    doc.moveDown(0.4);
    doc
      .fillColor("#0B1F3A")
      .fontSize(10)
      .text("Experience pathway: Elite Concierge (day-by-day design)");
  }

  if (quote) {
    doc.moveDown(1);
    section(doc, "Experience Japan Range");
    doc
      .fillColor("#0B1F3A")
      .fontSize(16)
      .text(`${money(quote.min)} – ${money(quote.max)}`, { align: "center" });
    const guests = Math.max(1, state.adults + state.children);
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
      "This document reflects your saved trip builder selections. Use your email and booking PNR anytime to reload and edit your itinerary. Final quotation is confirmed by your Elite Travel consultant.",
      { align: "center" }
    );
  doc.moveDown(0.5);
  doc
    .fillColor("#0B1F3A")
    .fontSize(10)
    .text("travelexperiencesgroup.com", { align: "center" });

  doc.end();
  return done;
}

function section(doc: PDFKit.PDFDocument, title: string) {
  doc
    .fillColor("#C4A35A")
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
