import { NextResponse } from "next/server";
import type { ApplePassPayload } from "@/lib/wallet/downloadApplePass";
import { generatePassPdfBuffer } from "@/lib/wallet/generatePassPdf";
import { generatePkpassBuffer } from "@/lib/wallet/generatePkpass";
import { publicSiteOrigin } from "@/lib/publicSiteOrigin";

export const runtime = "nodejs";

function minimalPayload(pnr: string): ApplePassPayload {
  const origin = publicSiteOrigin();
  return {
    pnrCode: pnr,
    guestName: "GUEST",
    partyText: "—",
    travelStyle: "—",
    tripType: "multi",
    experienceType: "PREMIUM CONCIERGE",
    originCode: "NRT",
    originLabel: "TOKYO ENTRY",
    destinationCode: "HND",
    destinationLabel: "DEPARTURE",
    durationText: "",
    startDateText: "",
    endDateText: "",
    routeBreakdown: [],
    status: "IN_PROGRESS",
    qrValue: `${origin}/builder/itinerary?ref=${encodeURIComponent(pnr)}&view=dossier`,
  };
}

/**
 * GET /api/wallet/pass-file?pnr=JPN-XXXX
 * Always downloads a file for manual save:
 * - signed .pkpass when Apple certs are configured
 * - otherwise a Japan Pass PDF
 *
 * Query: format=pdf|pkpass|auto (default auto)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const pnr = String(url.searchParams.get("pnr") || "")
    .trim()
    .toUpperCase();
  if (!pnr) {
    return NextResponse.json({ error: "pnr is required." }, { status: 400 });
  }

  const format = String(url.searchParams.get("format") || "auto")
    .trim()
    .toLowerCase();
  const payload = minimalPayload(pnr);

  if (format !== "pdf") {
    try {
      const pkpass = await generatePkpassBuffer(payload);
      if (pkpass) {
        return new NextResponse(pkpass as unknown as BodyInit, {
          status: 200,
          headers: {
            "Content-Type": "application/vnd.apple.pkpass",
            "Content-Disposition": `attachment; filename="Tokiotours-${pnr}.pkpass"`,
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        });
      }
    } catch (err) {
      console.error("[wallet/pass-file] pkpass failed:", err);
      if (format === "pkpass") {
        return NextResponse.json(
          {
            error:
              "Apple Wallet .pkpass is not available (signing certificates missing or failed).",
          },
          { status: 503 }
        );
      }
    }
  }

  try {
    const pdf = await generatePassPdfBuffer(payload);
    return new NextResponse(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Tokiotours-Pass-${pnr}.pdf"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (err) {
    console.error("[wallet/pass-file] pdf failed:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Could not generate pass download.",
      },
      { status: 502 }
    );
  }
}
