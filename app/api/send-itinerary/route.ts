import { NextResponse } from "next/server";
import { TEAM_EMAIL_CONFIG } from "@/lib/emailConfigStore";
import {
  MailDispatchError,
  resolveMailConfigured,
  sendItineraryEmail,
} from "@/lib/email";
import { handleSendItinerary } from "@/lib/sendItinerary";

/**
 * POST /api/send-itinerary
 *
 * Mode A: { email, bookingRef, pdfBase64?, customerName? } → Bluehost SMTP / Resend
 * Mode B: { contactEmail, state, quote, pdfBase64?, … } → save PNR + email
 * Credentials / templates / BCC from config/emailConfig.json (Team Email Settings).
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

  // Mode B: full builder save + email (PrintRequestModal / SendPdfModal)
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
    if (!resolveMailConfigured()) {
      return NextResponse.json(
        {
          error:
            "Mail not configured. Check TEAM_EMAIL_CONFIG / SMTP_* env or RESEND_API_KEY.",
        },
        { status: 401 }
      );
    }

    const email = String(body.email || body.contactEmail || "")
      .trim()
      .toLowerCase();
    const bookingRef = String(body.bookingRef || "").trim();
    const customerName = String(
      body.customerName || body.contactName || body.fullName || ""
    ).trim();
    const pdfBase64 = String(body.pdfBase64 || "").trim();

    if (!email) {
      return NextResponse.json(
        { error: "Email address is required" },
        { status: 400 }
      );
    }
    if (!bookingRef) {
      return NextResponse.json(
        { error: "Missing required parameter: bookingRef" },
        { status: 400 }
      );
    }

    const pdfBuffer = pdfBase64
      ? Buffer.from(pdfBase64, "base64")
      : Buffer.from("");

    const tourTypeRaw = String(body.tourType || body.tripMode || "")
      .trim()
      .toLowerCase();
    const tourType =
      tourTypeRaw === "single_day" || tourTypeRaw === "single-day"
        ? ("single_day" as const)
        : tourTypeRaw === "multi_day" || tourTypeRaw === "multi-day"
          ? ("multi_day" as const)
          : undefined;

    const result = await sendItineraryEmail({
      to: email,
      bookingRef,
      pdfBuffer,
      customerName: customerName || undefined,
      tourType,
      tourDate: String(body.tourDate || body.arrivalDate || "").trim() || null,
      adults: Number(body.adults) || undefined,
      children: Number(body.children ?? body.kids) || undefined,
    });

    // Lead lifecycle: proposal email ⇒ in_progress
    const { advanceBookingToInProgress } = await import(
      "@/lib/bookingLifecycle"
    );
    await advanceBookingToInProgress(bookingRef);

    return NextResponse.json({
      success: true,
      message: `Proposal emailed successfully to guest & team (${TEAM_EMAIL_CONFIG.routing.bccRecipient})!`,
      id: result.id,
    });
  } catch (err: unknown) {
    console.error("Bluehost SMTP Dispatch Error:", err);
    if (err instanceof MailDispatchError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message =
      err instanceof Error ? err.message : "Failed to dispatch email";
    const status = /auth|api key|unauthorized|forbidden|smtp/i.test(message)
      ? 401
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
