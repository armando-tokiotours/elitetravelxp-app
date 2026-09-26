import { NextResponse } from "next/server";
import {
  generateConfirmedPNR,
  isValidBookingPNR,
  resolveOfficialPNR,
  type BookingStatus,
} from "@/utils/pnr";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import { advanceBookingToInProgress } from "@/lib/bookingLifecycle";
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
  /** Named client PDFs (dossier / invoice). Preferred when present. */
  pdfs?: Array<{ kind?: string; filename: string; base64: string }>;
  /** Which docs the guest chose to email. */
  sendDocs?: { dossier?: boolean; invoice?: boolean };
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

    const storeStatus: BookingStatus = "in_progress";
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
        const hasClientPdf =
          Boolean(pdfBase64) ||
          (Array.isArray(body.pdfs) &&
            body.pdfs.some((p) => String(p?.base64 || "").trim()));
        if (!hasClientPdf) {
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

    // Lightweight bookings_and_leads snapshot (IDs / keys only)
    try {
      const {
        upsertBookingsAndLeads,
        buildMultiDaySelections,
        primaryCityFromMultiDay,
      } = await import("@/lib/bookingsAndLeads");
      await upsertBookingsAndLeads({
        bookingRef,
        email: contactEmail,
        type: state.tripMode === "single_day" ? "single_day" : "multi_day",
        status: "in_progress",
        primaryCity: primaryCityFromMultiDay(state, cityNames),
        tourDate: state.arrivalDate,
        guests: {
          adults: state.adults ?? 0,
          kids: state.children ?? 0,
        },
        durationValue:
          state.tripMode === "single_day"
            ? undefined
            : state.durationDays ?? 0,
        selections: buildMultiDaySelections(state),
        dossierPdfUrl: null,
      });
    } catch (err) {
      console.warn("[send-itinerary] bookings_and_leads skipped:", err);
    }

    // Lead lifecycle: draft → in_progress (never confirmed here)
    const leadRefs = new Set(
      [bookingRef, draftRef, state.confirmedBookingRef, state.tempBookingRef]
        .map((r) => String(r || "").trim().toUpperCase())
        .filter(Boolean)
    );
    for (const ref of leadRefs) {
      await advanceBookingToInProgress(ref);
    }

    // Prefer mobile Chromium PDFs (phone-friendly). Fall back to client/pdfkit.
    let namedPdfs: Array<{ filename: string; content: Buffer }> = [];
    if (Array.isArray(body.pdfs)) {
      for (const p of body.pdfs) {
        const base64 = String(p?.base64 || "").trim();
        const filename = String(p?.filename || "").trim();
        if (!base64 || !filename) continue;
        const content = Buffer.from(base64, "base64");
        if (content.length > 0) namedPdfs.push({ filename, content });
      }
    }

    try {
      const { buildMobileItineraryPdfs } = await import(
        "@/lib/pdf/buildMobileItineraryPdfs"
      );
      const { mobilePdfAvailable } = await import("@/lib/pdf/mobilePdfEngine");
      if (mobilePdfAvailable()) {
        const mobile = await buildMobileItineraryPdfs({
          bookingRef,
          contactName,
          contactEmail,
          state,
          quote,
          departureDate,
          cityNames,
          sendDocs: body.sendDocs,
        });
        if (mobile.length) {
          namedPdfs = mobile.map((p) => ({
            filename: p.filename,
            content: p.content,
          }));
        }
      }
    } catch (mobileErr) {
      console.warn(
        "[send-itinerary] mobile PDF engine failed, using fallback:",
        mobileErr
      );
    }

    let pdf: Buffer | undefined;
    if (namedPdfs.length === 0 && pdfBase64) {
      pdf = Buffer.from(pdfBase64, "base64");
    } else if (namedPdfs.length === 0) {
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

    const attachmentCount =
      namedPdfs.length || (pdf && pdf.length > 0 ? 1 : 0);
    if (attachmentCount === 0) {
      console.error("[send-itinerary] no PDF buffers produced");
      return NextResponse.json(
        {
          ok: false,
          bookingRef,
          error:
            "Could not build the itinerary PDF for email. Please try again or use local Print.",
        },
        { status: 500 }
      );
    }

    console.info("[send-itinerary] mailing with PDFs", {
      bookingRef,
      named: namedPdfs.map((p) => ({
        filename: p.filename,
        bytes: p.content.length,
      })),
      legacyBytes: pdf?.length || 0,
    });

    let mailSent = false;
    let mailNote: string | undefined;
    let mailId: string | undefined;
    try {
      const result = await sendItineraryEmail({
        to: contactEmail,
        bookingRef,
        pdfBuffer: pdf,
        pdfAttachments: namedPdfs.length ? namedPdfs : undefined,
        customerName: contactName || undefined,
        tourType:
          state.tripMode === "single_day" ? "single_day" : "multi_day",
        tourDate:
          state.tripMode === "single_day"
            ? // Prefer single-day tour date if present on state payload
              String(
                (state as { tourDate?: string | null }).tourDate ||
                  state.arrivalDate ||
                  ""
              ) || null
            : state.arrivalDate,
        adults: state.adults,
        children: state.children,
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
