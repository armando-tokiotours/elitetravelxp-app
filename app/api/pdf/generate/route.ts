import { NextResponse } from "next/server";
import type { BuilderState } from "@/store/useBuilderStore";
import type { QuoteResult } from "@/lib/builder-pricing";
import { buildMobileItineraryPdfs } from "@/lib/pdf/buildMobileItineraryPdfs";
import { mobilePdfAvailable } from "@/lib/pdf/mobilePdfEngine";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  pnrCode?: string;
  bookingRef?: string;
  contactName?: string;
  contactEmail?: string;
  state?: BuilderState;
  quote?: QuoteResult | null;
  departureDate?: string | null;
  cityNames?: Record<string, string>;
  sendDocs?: { dossier?: boolean; invoice?: boolean };
  /** When true, return first PDF as binary download instead of JSON. */
  download?: boolean;
};

/**
 * Mobile-first PDF (430px viewport, dark theme, #E60F43 glow).
 * POST JSON → { ok, pdfs: [{ kind, filename, base64 }] } or binary download.
 */
export async function POST(req: Request) {
  try {
    if (!mobilePdfAvailable()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Chromium is not installed. Set PUPPETEER_EXECUTABLE_PATH or install chromium in the container.",
        },
        { status: 503 }
      );
    }

    const body = (await req.json()) as Body;
    const bookingRef = String(body.pnrCode || body.bookingRef || "")
      .trim()
      .toUpperCase();
    if (!bookingRef) {
      return NextResponse.json(
        { ok: false, error: "bookingRef / pnrCode is required." },
        { status: 400 }
      );
    }
    if (!body.state || typeof body.state !== "object") {
      return NextResponse.json(
        { ok: false, error: "Itinerary state is required." },
        { status: 400 }
      );
    }

    const pdfs = await buildMobileItineraryPdfs({
      bookingRef,
      contactName: body.contactName,
      contactEmail: body.contactEmail,
      state: body.state,
      quote: body.quote ?? null,
      departureDate: body.departureDate ?? null,
      cityNames: body.cityNames ?? {},
      sendDocs: body.sendDocs,
    });

    if (body.download && pdfs[0]) {
      const first = pdfs[0];
      return new NextResponse(new Uint8Array(first.content), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${first.filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json({
      ok: true,
      bookingRef,
      engine: "mobile-puppeteer",
      pdfs: pdfs.map((p) => ({
        kind: p.kind,
        filename: p.filename,
        base64: p.content.toString("base64"),
      })),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "PDF generation failed.";
    console.error("[api/pdf/generate]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
