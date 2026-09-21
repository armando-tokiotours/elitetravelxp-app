import { NextResponse } from "next/server";
import {
  generateConfirmedPNR,
  isValidBookingPNR,
  resolveOfficialPNR,
  type BookingStatus,
} from "@/utils/pnr";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import { buildItineraryPdf } from "@/lib/itineraryPdf";
import { sendItineraryEmail, resolveMailConfigured } from "@/lib/email";
import { TEAM_EMAIL_CONFIG } from "@/lib/emailConfigStore";
import type { BuilderState } from "@/store/useBuilderStore";
import type { QuoteResult } from "@/lib/builder-pricing";

export type SendItineraryBody = {
  contactEmail?: string;
  contactName?: string;
  email?: string;
  fullName?: string;
  state?: BuilderState;
  quote?: QuoteResult | null;
  departureDate?: string | null;
  cityNames?: Record<string, string>;
  /** Draft TMP-… from the builder session. */
  tempBookingRef?: string;
  /** @deprecated Send tempBookingRef; server resolves official JPN-. */
  bookingRef?: string;
  /** Optional client-rendered PDF (base64) — skips server pdfkit when set. */
  pdfBase64?: string;
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

function formatPbError(err: unknown): string {
  if (!err || typeof err !== "object") return String(err);
  const e = err as {
    message?: string;
    data?: { message?: string; data?: Record<string, { message?: string }> };
  };
  const fieldMsgs = e.data?.data
    ? Object.entries(e.data.data)
        .map(([k, v]) => `${k}: ${v?.message || "invalid"}`)
        .join("; ")
    : "";
  return [e.data?.message || e.message || "Failed to create record", fieldMsgs]
    .filter(Boolean)
    .join(" — ");
}

/**
 * Save full builder itinerary, email PDF via Resend (client PDF preferred).
 */
export async function handleSendItinerary(
  request: Request
): Promise<NextResponse> {
  try {
    const body = (await request.json()) as SendItineraryBody;
    const contactEmail = String(body?.contactEmail || body?.email || "")
      .trim()
      .toLowerCase();
    const contactName = String(body?.contactName || body?.fullName || "").trim();
    const state = body?.state;
    const quote = body?.quote ?? null;
    const departureDate = body?.departureDate ?? null;
    const cityNames = body?.cityNames ?? {};
    const pdfBase64 = String(body?.pdfBase64 || "").trim();

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

    const createFields = {
      reference: bookingRef,
      status: "quoted" as string,
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
    };

    let record: { id: string };
    try {
      record = await pb.collection("booking_requests").create(createFields);
    } catch (createErr) {
      // Schema may not include `quoted` yet — retry with a legacy status.
      console.warn(
        "[send-itinerary] create with quoted failed, retrying pending_deposit:",
        createErr
      );
      try {
        record = await pb.collection("booking_requests").create({
          ...createFields,
          status: "pending_deposit",
        });
      } catch (retryErr) {
        const detail = formatPbError(retryErr);
        console.error("[send-itinerary] booking_requests create failed:", detail);
        // Continue without PB row — still email if we have a PDF
        record = { id: "" };
        if (!pdfBase64) {
          return NextResponse.json(
            {
              error: `Failed to create record: ${detail}`,
              bookingRef,
            },
            { status: 500 }
          );
        }
      }
    }

    // Best-effort dual-write for Manage Booking (quotations collection)
    if (record.id) {
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
    }

    // Prefer client-rendered PDF; fall back to pdfkit only when needed
    let pdf: Buffer;
    if (pdfBase64) {
      pdf = Buffer.from(pdfBase64, "base64");
    } else {
      pdf = await buildItineraryPdf({
        bookingRef,
        contactName,
        contactEmail,
        state,
        quote,
        departureDate,
        cityNames,
      });
    }

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
          recordId: record.id || null,
        }),
      }).catch(() => {});
    }

    // Mail configured (SMTP or Resend) but delivery failed → surface to UI
    const mailConfigured = resolveMailConfigured();
    if (!mailSent && mailConfigured) {
      return NextResponse.json(
        {
          ok: false,
          bookingRef,
          id: record.id || null,
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
      id: record.id || null,
      mailSent,
      mailId,
      mailNote: mailSent ? undefined : mailNote,
      message: mailSent
        ? `Proposal emailed to you and copy sent to ${TEAM_EMAIL_CONFIG.routing.bccRecipient}. Your booking PNR is ${bookingRef}.`
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
