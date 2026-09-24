import { NextResponse } from "next/server";
import {
  generateConfirmedPNR,
  isValidBookingPNR,
  resolveOfficialPNR,
  type BookingStatus,
} from "@/utils/pnr";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import type { BuilderState } from "@/store/useBuilderStore";
import type { QuoteResult } from "@/lib/builder-pricing";

/**
 * Upsert booking_requests by PNR (admin). Used after Revolut payment
 * so guests can attach payment to a prior Print/Request row.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const state = body?.state as BuilderState | undefined;
    const quote = (body?.quote ?? null) as QuoteResult | null;
    const departureDate = body?.departureDate ?? null;
    const contactEmail = String(body?.contactEmail || "")
      .trim()
      .toLowerCase();
    const contactName = String(body?.contactName || "").trim();
    const contactPhone = String(body?.contactPhone || "").trim();
    const preferred = String(body?.reference || "").trim();
    const payment = body?.payment ?? null;
    const depositPercent = Number(body?.depositPercent ?? 10);
    const depositMin = Number(body?.depositMin ?? 0);
    const depositMax = Number(body?.depositMax ?? 0);

    if (!state || typeof state !== "object") {
      return NextResponse.json(
        { error: "Itinerary state is required." },
        { status: 400 }
      );
    }

    const pb = await getAdminPocketBase();
    let reference = isValidBookingPNR(preferred)
      ? preferred
      : resolveOfficialPNR(preferred || state.tempBookingRef);

    if (!isValidBookingPNR(reference)) {
      reference = generateConfirmedPNR();
    }

    for (let i = 0; i < 6; i++) {
      try {
        await pb
          .collection("booking_requests")
          .getFirstListItem(`reference="${reference.replace(/"/g, "")}"`);
        reference = generateConfirmedPNR();
      } catch {
        break;
      }
    }

    const storeStatus: BookingStatus = "in_progress";

    const fields = {
      reference,
      status: payment?.amountPaid ? "pending_deposit" : "quoted",
      guest_label: `${state.adults ?? 0} adults, ${state.children ?? 0} children`,
      adults: state.adults ?? 0,
      children: state.children ?? 0,
      arrival_date: state.arrivalDate || "",
      departure_date: departureDate || "",
      quote_min: quote?.min ?? 0,
      quote_max: quote?.max ?? 0,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      notes: [
        contactName ? `Contact: ${contactName}` : "",
        contactPhone ? `Phone: ${contactPhone}` : "",
        state.customBudgetTarget
          ? `Custom budget target: €${Math.round(Number(state.customBudgetTarget))}`
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
      payload: {
        ...state,
        custom_budget_target: state.customBudgetTarget ?? null,
        departureDate,
        quote,
        depositPercent,
        depositMin,
        depositMax,
        payment,
        tempBookingRef: state.tempBookingRef,
        confirmedBookingRef: reference,
        bookingRef: reference,
        bookingStatus: storeStatus,
        contactEmail,
        contactName,
        contactPhone,
        submittedAt: new Date().toISOString(),
      },
    };

    let record;
    try {
      const existing = await pb
        .collection("booking_requests")
        .getFirstListItem(`reference="${reference.replace(/"/g, "")}"`);
      record = await pb.collection("booking_requests").update(existing.id, {
        ...fields,
        contact_email: contactEmail || existing.contact_email || "",
        contact_phone: contactPhone || existing.contact_phone || "",
        payload: {
          ...(typeof existing.payload === "object" && existing.payload
            ? existing.payload
            : {}),
          ...fields.payload,
        },
      });
    } catch {
      record = await pb.collection("booking_requests").create(fields);
    }

    // Lead lifecycle: payment / upsert ⇒ in_progress on bookings lead
    try {
      const { advanceBookingToInProgress } = await import(
        "@/lib/bookingLifecycle"
      );
      await advanceBookingToInProgress(reference);
      if (state.confirmedBookingRef) {
        await advanceBookingToInProgress(String(state.confirmedBookingRef));
      }
    } catch {
      /* non-blocking */
    }

    // Lightweight bookings_and_leads snapshot (IDs only)
    try {
      const {
        upsertBookingsAndLeads,
        buildMultiDaySelections,
        buildSingleDaySelections,
        primaryCityFromMultiDay,
      } = await import("@/lib/bookingsAndLeads");

      const singleDay = body?.singleDay as
        | {
            cityFocus?: string;
            cityId?: string;
            tourDate?: string | null;
            adults?: number;
            children?: number;
            tourHours?: number;
            startTime?: string;
            travelPace?: string | null;
            guidePreference?: string;
            selectedExperiences?: Array<{ tourId: string }>;
            transitOption?: string;
          }
        | undefined;

      if (state.tripMode === "single_day" && singleDay) {
        await upsertBookingsAndLeads({
          bookingRef: reference,
          email: contactEmail,
          type: "single_day",
          status: payment?.amountPaid ? "quoted" : "in_progress",
          primaryCity: singleDay.cityFocus || "",
          tourDate: singleDay.tourDate ?? null,
          guests: {
            adults: Number(singleDay.adults) || 0,
            kids: Number(singleDay.children) || 0,
          },
          durationValue: Number(singleDay.tourHours) || 0,
          selections: buildSingleDaySelections({
            cityFocus: singleDay.cityFocus || "",
            cityId: singleDay.cityId,
            startTime: singleDay.startTime || "09:00",
            travelPace:
              singleDay.travelPace === "fast" ||
              singleDay.travelPace === "moderate" ||
              singleDay.travelPace === "relaxed"
                ? singleDay.travelPace
                : null,
            guidePreference:
              (singleDay.guidePreference as
                | "private_guide"
                | "local_host"
                | "self_paced") || "private_guide",
            selectedExperiences: (singleDay.selectedExperiences || []).map(
              (e) => ({
                tourId: e.tourId,
                title: "",
                selectedLanguage: "",
                duration_hours: 0,
              })
            ),
            tourHours: Number(singleDay.tourHours) || 6,
            transitOption: singleDay.transitOption,
          }),
        });
      } else {
        await upsertBookingsAndLeads({
          bookingRef: reference,
          email: contactEmail,
          type: "multi_day",
          status: payment?.amountPaid ? "quoted" : "in_progress",
          primaryCity: primaryCityFromMultiDay(state),
          tourDate: state.arrivalDate,
          guests: {
            adults: state.adults ?? 0,
            kids: state.children ?? 0,
          },
          durationValue: state.durationDays ?? 0,
          selections: buildMultiDaySelections(state),
        });
      }
    } catch (err) {
      console.warn("[itinerary-upsert] bookings_and_leads skipped:", err);
    }

    return NextResponse.json({
      ok: true,
      id: record.id,
      reference: record.reference || reference,
    });
  } catch (err) {
    console.error("[itinerary-upsert]", err);
    const msg =
      err instanceof Error ? err.message : "Unable to save booking.";
    const status = msg.includes("PB_ADMIN") ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
