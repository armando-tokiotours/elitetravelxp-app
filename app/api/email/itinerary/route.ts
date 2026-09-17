import { NextResponse } from "next/server";
import {
  itineraryQuotationEmailHtml,
  itineraryQuotationEmailText,
  sendTransactionalMail,
} from "@/lib/mail";

/**
 * Send Japan Journey quotation email via Resend (PDF attachment).
 * Prefer /api/itinerary/print-request for full save+PNR+PDF generation.
 * This route is for resending when PDF is already available (base64).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email || "")
      .trim()
      .toLowerCase();
    const bookingRef = String(body?.bookingRef || "").trim();
    const pdfBase64 = String(body?.pdfBase64 || "").trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }
    if (!bookingRef) {
      return NextResponse.json(
        { error: "bookingRef is required." },
        { status: 400 }
      );
    }
    if (!pdfBase64) {
      return NextResponse.json(
        { error: "pdfBase64 attachment is required." },
        { status: 400 }
      );
    }

    const pdf = Buffer.from(pdfBase64, "base64");
    const mail = await sendTransactionalMail({
      to: email,
      subject: `Your Japan Journey Quotation & Itinerary [${bookingRef}]`,
      text: itineraryQuotationEmailText({ email, bookingRef }),
      html: itineraryQuotationEmailHtml({ email, bookingRef }),
      attachments: [
        {
          filename: `Japan-Itinerary-${bookingRef}.pdf`,
          content: pdf,
          contentType: "application/pdf",
        },
      ],
    });

    if (!mail.sent) {
      return NextResponse.json(
        { error: mail.reason || "Email is not configured." },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true, id: mail.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Email failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
