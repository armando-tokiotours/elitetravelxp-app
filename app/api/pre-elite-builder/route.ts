import { NextResponse } from "next/server";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import {
  buildBookingPayload,
  generatePNR,
  normalizeTiming,
  parseItineraryData,
  type PreEliteDraft,
} from "@/lib/preEliteBuilder";
import { sendDraftBoardingPassEmails } from "@/lib/preEliteBoardingPassEmail";

/**
 * Saves a pre-elite qualification lead to PocketBase `bookings`.
 * Does not read or write the trip builder's booking_requests collection.
 * After draft save, dispatches boarding-pass emails to guest + concierge.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tripType =
      body?.tripType === "single_day" || body?.tripType === "multi_day"
        ? body.tripType
        : null;
    const draft: PreEliteDraft = {
      travelStyle: body?.travelStyle ?? null,
      interests: Array.isArray(body?.interests) ? body.interests : [],
      tripMotivation: body?.tripMotivation ?? null,
      painPoints: Array.isArray(body?.painPoints) ? body.painPoints : [],
      tripType,
      fullName: String(body?.fullName || ""),
      email: String(body?.email || ""),
      whatsapp: String(body?.whatsapp || ""),
      timing: normalizeTiming(
        tripType === "single_day"
          ? { ...normalizeTiming(body?.timing ?? body?.dates ?? null), totalDays: 1 }
          : body?.timing ?? body?.dates ?? null
      ),
      adults: Number(body?.adults),
      children: Number(body?.children),
    };

    const pb = await getAdminPocketBase();
    let bookingRef = generatePNR();
    for (let i = 0; i < 6; i++) {
      try {
        await pb
          .collection("bookings")
          .getFirstListItem(`booking_ref="${bookingRef.replace(/"/g, "")}"`);
        bookingRef = generatePNR();
      } catch {
        break;
      }
    }

    const payload = buildBookingPayload(draft, bookingRef);
    if (!payload) {
      return NextResponse.json(
        { error: "Complete every step before submitting." },
        { status: 400 }
      );
    }

    const itinerary = parseItineraryData(payload.itineraryData);
    if (!itinerary) {
      return NextResponse.json(
        { error: "Qualification details could not be read." },
        { status: 400 }
      );
    }

    const record = await pb.collection("bookings").create({
      booking_ref: payload.bookingRef,
      full_name: payload.fullName,
      email: payload.email,
      whatsapp: itinerary.whatsapp,
      status: payload.status,
      itinerary_data: payload.itineraryData,
    });

    const mail = await sendDraftBoardingPassEmails({
      bookingRef: payload.bookingRef,
      fullName: payload.fullName,
      email: payload.email,
      itineraryData: itinerary,
    });

    if (mail.errors.length) {
      console.warn("[pre-elite-builder] boarding-pass mail:", mail.errors);
    }

    return NextResponse.json({
      ok: true,
      id: record.id,
      bookingRef: payload.bookingRef,
      fullName: payload.fullName,
      email: payload.email,
      status: payload.status,
      itineraryData: payload.itineraryData,
      mail: {
        guestSent: mail.guestSent,
        teamSent: mail.teamSent,
        errors: mail.errors,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not save this lead.";
    console.error("[pre-elite-builder]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
