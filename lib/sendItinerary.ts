import { NextResponse } from "next/server";
import {
  generateConfirmedPNR,
  isValidBookingPNR,
  resolveOfficialPNR,
  type BookingStatus,
} from "@/utils/pnr";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import { buildItineraryPdf } from "@/lib/itineraryPdf";
import { sendItineraryEmail, resolveResendApiKey } from "@/lib/email";
import type { BuilderState } from "@/store/useBuilderStore";
import type { QuoteResult } from "@/lib/builder-pricing";

export type SendItineraryBody = {
  contactEmail?: string;
  contactName?: string;
  state?: BuilderState;
  quote?: QuoteResult | null;
  departureDate?: string | null;
  cityNames?: Record<string, string>;
  /** Draft TMP-… from the builder session. */
  tempBookingRef?: string;
  /** @deprecated Send tempBookingRef; server resolves official JPN-. */
  bookingRef?: string;
};

async function allocateUniquePnr(
  pb: Awaited<ReturnType<typeof getAdminPocketBase>>,
  preferred?: string
): Promise<string> {
  const candidates: string[] = [];
  if (preferred && isValidBookingPNR(preferred)) {
    candidates.push(preferred);
  } else if (preferred) {
    candidates.push(resolveOfficialPNR(preferred));
  }
  for (let i = 0; i < 8; i++) candidates.push(generateConfirmedPNR());

  for (const ref of candidates) {
    try {
      await pb.collection("booking_requests").getFirstListItem(
        `reference="${ref.replace(/"/g, "")}"`
      );
    } catch {
      return ref; // not found → free
    }
  }
  throw new Error("Unable to allocate a unique booking PNR. Please retry.");
}

/**
 * Save full builder itinerary, generate PDF server-side, email via Resend/SMTP.
 * Avoids client window.print() crashes.
 */
export async function handleSendItinerary(
  request: Request
): Promise<NextResponse> {
  try {
    const body = (await request.json()) as SendItineraryBody;
    const contactEmail = String(body?.contactEmail || "")
      .trim()
      .toLowerCase();
    const contactName = String(body?.contactName || "").trim();
    const state = body?.state;
    const quote = body?.quote ?? null;
    const departureDate = body?.departureDate ?? null;
    const cityNames = body?.cityNames ?? {};

    if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }
    if (!state || typeof state !== "object") {
      return NextResponse.json(
        { error: "Itinerary state is required." },
        { status: 400 }
      );
    }

    const pb = await getAdminPocketBase();
    const draftRef =
      String(body?.tempBookingRef || body?.bookingRef || "").trim() ||
      undefined;
    const bookingRef = await allocateUniquePnr(pb, draftRef);

    const depositPercent = 10;
    const depositMin = quote ? Math.round(quote.min * 0.1) : 0;
    const depositMax = quote ? Math.round(quote.max * 0.1) : 0;

    const storeStatus: BookingStatus = "requested";
    const payload = {
      ...state,
      departureDate,
      quote,
      depositPercent,
      depositMin,
      depositMax,
      contactEmail,
      contactName,
      tempBookingRef: draftRef ?? state.tempBookingRef,
      confirmedBookingRef: bookingRef,
      bookingRef,
      bookingStatus: storeStatus,
      submittedAt: new Date().toISOString(),
      source: "send_itinerary",
    };

    const record = await pb.collection("booking_requests").create({
      reference: bookingRef,
      status: "quoted",
      guest_label: `${state.adults ?? 0} adults, ${state.children ?? 0} children`,
      adults: state.adults ?? 0,
      children: state.children ?? 0,
      arrival_date: state.arrivalDate || "",
      departure_date: departureDate || "",
      quote_min: quote?.min ?? 0,
      quote_max: quote?.max ?? 0,
      contact_email: contactEmail,
      notes: contactName ? `Contact: ${contactName}` : "",
      payload,
    });

    // Best-effort dual-write for Manage Booking (quotations collection)
    try {
      await pb.collection("quotations").create({
        booking_ref: bookingRef,
        email: contactEmail,
        payload,
        status: "sent",
      });
    } catch (err) {
      console.warn("[send-itinerary] quotations write skipped:", err);
    }

    const pdf = await buildItineraryPdf({
      bookingRef,
      contactName,
      contactEmail,
      state,
      quote,
      departureDate,
      cityNames,
    });

    let mailSent = false;
    let mailNote: string | undefined;
    let mailId: string | undefined;
    try {
      const result = await sendItineraryEmail({
        to: contactEmail,
        bookingRef,
        pdfBuffer: pdf,
        customerName: contactName || undefined,
      });
      mailSent = true;
      mailId = result.id;
    } catch (err) {
      console.error("[send-itinerary] mail error", err);
      mailNote =
        err instanceof Error ? err.message : "Email delivery failed.";
    }

    const webhook = process.env.ITINERARY_WEBHOOK_URL;
    if (webhook) {
      fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "send_itinerary",
          bookingRef,
          contactEmail,
          contactName,
          quote,
          recordId: record.id,
        }),
      }).catch(() => {});
    }

    // Resend configured but delivery failed → surface to the PDF button UI
    const mailConfigured = Boolean(resolveResendApiKey());
    if (!mailSent && mailConfigured) {
      return NextResponse.json(
        {
          ok: false,
          bookingRef,
          id: record.id,
          mailSent: false,
          error:
            mailNote ||
            "Itinerary was saved, but the PDF email could not be delivered. Check RESEND_API_KEY / MAIL_FROM domain verification.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      success: true,
      bookingRef,
      id: record.id,
      mailSent,
      mailId,
      mailNote: mailSent ? undefined : mailNote,
      message: mailSent
        ? `Saved and emailed. Your booking PNR is ${bookingRef}.`
        : `Saved with PNR ${bookingRef}. Email could not be sent yet — keep your PNR to retrieve this itinerary.`,
    });
  } catch (err) {
    console.error("[send-itinerary]", err);
    const msg =
      err instanceof Error ? err.message : "Unable to send itinerary.";
    const status = msg.includes("PB_ADMIN") ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
