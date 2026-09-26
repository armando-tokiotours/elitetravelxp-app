import PDFDocument from "pdfkit";
import type { ApplePassPayload } from "@/lib/wallet/downloadApplePass";
import { publicSiteOrigin } from "@/lib/publicSiteOrigin";

/**
 * One-page Japan Pass PDF for manual save / share when .pkpass signing
 * certificates are not configured on the server.
 */
export async function generatePassPdfBuffer(
  payload: ApplePassPayload
): Promise<Buffer> {
  const origin = publicSiteOrigin();
  const dossierUrl =
    payload.qrValue ||
    `${origin}/builder/itinerary?ref=${encodeURIComponent(payload.pnrCode)}&view=dossier`;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 48,
      info: {
        Title: `TOKIOTOURS Japan Pass · ${payload.pnrCode}`,
        Author: "TOKIOTOURS",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const isSingle = payload.tripType === "single";

    doc
      .fontSize(11)
      .fillColor("#075473")
      .text("TOKIOTOURS", { continued: false });
    doc
      .moveDown(0.3)
      .fontSize(22)
      .fillColor("#0A1017")
      .text("JAPAN PASS", { continued: false });
    doc
      .moveDown(0.2)
      .fontSize(10)
      .fillColor("#64748B")
      .text(
        isSingle ? "Day Tour Pass · Manual download" : "Multi-day Pass · Manual download"
      );

    doc.moveDown(1);
    doc
      .roundedRect(48, doc.y, 500, 72, 8)
      .fillAndStroke("#0F172A", "#334155");
    const boxY = doc.y - 72;
    doc
      .fillColor("#F6A724")
      .fontSize(10)
      .text("BOOKING REFERENCE", 64, boxY + 14);
    doc
      .fillColor("#FFFFFF")
      .fontSize(22)
      .font("Helvetica-Bold")
      .text(payload.pnrCode, 64, boxY + 32);
    doc.font("Helvetica");

    doc.moveDown(2);
    doc.fillColor("#0A1017").fontSize(11);
    const rows: [string, string][] = [
      ["Guest", payload.guestName || "GUEST"],
      ["Party", payload.partyText || "—"],
      ["Style", payload.travelStyle || "—"],
      ["Experience", payload.experienceType || "—"],
      [
        "Dates",
        [payload.startDateText, payload.endDateText]
          .filter(Boolean)
          .join(" → ") || "—",
      ],
      [
        "Route",
        `${payload.originCode || "NRT"} → ${payload.destinationCode || "HND"}`,
      ],
    ];
    for (const [label, value] of rows) {
      doc
        .fillColor("#64748B")
        .fontSize(9)
        .text(label.toUpperCase(), { continued: false, width: 120 });
      doc
        .fillColor("#0A1017")
        .fontSize(12)
        .text(value, { continued: false });
      doc.moveDown(0.45);
    }

    if (payload.routeBreakdown?.length) {
      doc.moveDown(0.5);
      doc.fillColor("#075473").fontSize(11).text("Route breakdown");
      doc.moveDown(0.3);
      for (const stop of payload.routeBreakdown) {
        doc
          .fillColor("#0A1017")
          .fontSize(10)
          .text(
            `• ${stop.city}${stop.nights ? ` · ${stop.nights} night(s)` : ""}`
          );
      }
    }

    doc.moveDown(1.2);
    doc
      .fillColor("#64748B")
      .fontSize(9)
      .text("Open booking on the website:");
    doc
      .fillColor("#075473")
      .fontSize(9)
      .text(dossierUrl, { link: dossierUrl, underline: true });

    doc.moveDown(1.5);
    doc
      .fillColor("#94A3B8")
      .fontSize(8)
      .text(
        "This PDF is your manual Japan Pass copy. A signed Apple Wallet (.pkpass) file requires Apple Developer certificates on the server. Keep this PDF or open the booking link above on your phone.",
        { width: 500 }
      );

    doc.end();
  });
}
