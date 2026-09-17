import { NextResponse } from "next/server";
import { sendItineraryEmail } from "@/lib/email";
import { handleSendItinerary } from "@/lib/sendItinerary";

/**
 * POST /api/send-itinerary
 *
 * Mode A (spec): { email, bookingRef, pdfBase64?, customerName? }
 *   → email PDF via Resend (BCC armando@tokiotours.nl)
 *
 * Mode B (builder): { contactEmail, state, quote, … }
 *   → save PNR, generate PDF server-side, then email
 */
export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { error: "Expected application/json body." },
      { status: 400 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Mode B: full builder save + server PDF (PrintRequestModal)
  if (body.state && typeof body.state === "object") {
    return handleSendItinerary(
      new Request(req.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    );
  }

  // Mode A: direct email dispatch with client-supplied PDF
  try {
    const email = String(body.email || body.contactEmail || "")
      .trim()
      .toLowerCase();
    const bookingRef = String(body.bookingRef || "").trim();
    const customerName = String(
      body.customerName || body.contactName || ""
    ).trim();
    const pdfBase64 = String(body.pdfBase64 || "").trim();

    if (!email || !bookingRef) {
      return NextResponse.json(
        { error: "Missing required parameters: email or bookingRef" },
        { status: 400 }
      );
    }

    const pdfBuffer = pdfBase64
      ? Buffer.from(pdfBase64, "base64")
      : Buffer.from("");

    const result = await sendItineraryEmail({
      to: email,
      bookingRef,
      pdfBuffer,
      customerName: customerName || undefined,
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message || "Failed to send email" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Itinerary sent successfully",
      id: result.data?.id,
    });
  } catch (err: unknown) {
    console.error("Email Dispatch Error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to send email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
