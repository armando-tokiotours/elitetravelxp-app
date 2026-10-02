import { NextResponse } from "next/server";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import {
  isTempBookingRef,
  isValidBookingPNR,
  normalizeBookingPNR,
} from "@/utils/pnr";
import { upsertBookingsAndLeads } from "@/lib/bookingsAndLeads";
import {
  applyOpsDemandForPnr,
  type OpsDemandFlags,
} from "@/lib/opsDemand";

/**
 * POST /api/bookings/experience-only
 * Builder E → `bookings` (booking_type EXPERIENCE_ONLY) + BAL + ops demand.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const bookingRef = normalizeBookingPNR(
      String(body?.bookingRef || body?.booking_ref || body?.pnr || "")
    );
    const email = String(body?.email || "")
      .trim()
      .toLowerCase();
    const fullName = String(body?.fullName || body?.full_name || "").trim();
    const statusRaw = String(body?.status || "draft").toLowerCase();
    const status =
      statusRaw === "in_progress" || statusRaw === "confirmed"
        ? statusRaw
        : "draft";
    const category = String(body?.category || "").toUpperCase();
    const whatsapp = String(body?.whatsapp || body?.guestWhatsapp || "")
      .trim()
      .slice(0, 40);
    const payload =
      body?.payload && typeof body.payload === "object" ? body.payload : {};
    const primaryCity = String(body?.primaryCity || "Tokyo").trim() || "Tokyo";
    const tourDate = body?.tourDate ? String(body.tourDate).slice(0, 10) : null;
    const guests = (body?.guests || {}) as { adults?: number; kids?: number };
    const demandIn = (body?.demand || {}) as Partial<OpsDemandFlags>;

    if (!isValidBookingPNR(bookingRef) && !isTempBookingRef(bookingRef)) {
      return NextResponse.json(
        { error: "A valid booking_ref (PNR) is required." },
        { status: 400 }
      );
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "A valid email is required." },
        { status: 400 }
      );
    }
    if (!["DRIVER", "EXPERIENCE", "TRANSIT"].includes(category)) {
      return NextResponse.json(
        { error: "category must be DRIVER, EXPERIENCE, or TRANSIT." },
        { status: 400 }
      );
    }

    const itineraryPayload = JSON.stringify({
      booking_type: "EXPERIENCE_ONLY",
      category,
      ...payload,
    });

    const pb = await getAdminPocketBase();
    let bookingId: string | null = null;
    try {
      const existing = await pb
        .collection("bookings")
        .getFirstListItem(`booking_ref="${bookingRef}"`, {
          requestKey: null,
        });
      const updated = await pb.collection("bookings").update(
        existing.id,
        {
          full_name: fullName || existing.full_name || "",
          email,
          whatsapp: whatsapp || existing.whatsapp || "",
          status,
          booking_type: "EXPERIENCE_ONLY",
          itinerary_data: itineraryPayload,
        },
        { requestKey: null }
      );
      bookingId = updated.id;
    } catch {
      const created = await pb.collection("bookings").create(
        {
          booking_ref: bookingRef,
          full_name: fullName || "Guest",
          email,
          whatsapp,
          status,
          booking_type: "EXPERIENCE_ONLY",
          itinerary_data: itineraryPayload,
        },
        { requestKey: null }
      );
      bookingId = created.id;
    }

    const balStatus =
      status === "in_progress"
        ? "in_progress"
        : status === "confirmed"
          ? "confirmed"
          : "draft";

    const bal = await upsertBookingsAndLeads({
      bookingRef,
      email,
      type: "experience_only",
      status: balStatus,
      primaryCity,
      tourDate,
      guests: {
        adults: Number(guests.adults) || 1,
        kids: Number(guests.kids) || 0,
      },
      durationValue: 1,
      durationLabel: "Builder E · micro-service",
      citiesList: primaryCity,
      cityNames: [primaryCity],
      selections: {
        _v: 1,
        source: "builder_e",
        booking_type: "EXPERIENCE_ONLY",
        category,
        ...payload,
      },
    });

    const demand: OpsDemandFlags = {
      ticketsNeeded: Boolean(demandIn.ticketsNeeded),
      driverNeeded: Boolean(demandIn.driverNeeded),
      guideNeeded: Boolean(demandIn.guideNeeded),
      ticketLines: Array.isArray(demandIn.ticketLines)
        ? demandIn.ticketLines
        : [],
    };
    try {
      await applyOpsDemandForPnr(pb, bookingRef, demand);
    } catch (err) {
      console.warn(
        "[bookings/experience-only] demand",
        err instanceof Error ? err.message : err
      );
    }

    return NextResponse.json({
      ok: true,
      bookingId,
      balId: bal.id,
      bookingRef,
    });
  } catch (err) {
    console.error("[bookings/experience-only]", err);
    const msg =
      err instanceof Error ? err.message : "Unable to save experience booking.";
    const code = msg.includes("PB_ADMIN") ? 503 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
