import { NextResponse } from "next/server";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import { upsertBookingsAndLeads } from "@/lib/bookingsAndLeads";
import { BRAND_URL } from "@/lib/brand";
import { generatePNR, normalizeBookingPNR } from "@/utils/pnr";
import { normalizeTiming } from "@/lib/preEliteBuilder";

/**
 * POST /api/agent/draft-booking
 * Staff intake: mint a draft JPN- PNR + bookings / bookings_and_leads rows,
 * return a production magic link for WhatsApp / email.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const guestName = String(body?.guestName || body?.fullName || "").trim();
    const guestEmail = String(body?.guestEmail || body?.email || "")
      .trim()
      .toLowerCase();

    if (!guestName || guestName.length < 2) {
      return NextResponse.json(
        { error: "Guest name is required." },
        { status: 400 }
      );
    }
    if (!guestEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
      return NextResponse.json(
        { error: "A valid guest email is required." },
        { status: 400 }
      );
    }

    const pb = await getAdminPocketBase();
    let bookingRef = generatePNR();
    for (let i = 0; i < 8; i++) {
      try {
        await pb
          .collection("bookings")
          .getFirstListItem(
            `booking_ref="${bookingRef.replace(/"/g, "")}"`,
            { requestKey: null }
          );
        bookingRef = generatePNR();
      } catch {
        break;
      }
    }
    bookingRef = normalizeBookingPNR(bookingRef);

    // Minimal valid Pre-Elite brief so /manage retrieve can hydrate.
    // Guest completes travel style / dates via the builder after opening the link.
    const timing = normalizeTiming({ totalDays: 7 });
    const itineraryData = JSON.stringify({
      travelStyle: "premium_comfort",
      interests: ["culture_heritage"],
      tripMotivation: "first_time",
      painPoints: ["language_transit"],
      tripType: "multi_day",
      dates: timing.formattedString,
      timing,
      whatsapp: "",
      groupSize: { adults: 2, children: 0 },
      staffDraft: true,
      highestUnlockedStep: 1,
    });

    const record = await pb.collection("bookings").create({
      booking_ref: bookingRef,
      full_name: guestName,
      email: guestEmail,
      whatsapp: "",
      status: "draft",
      itinerary_data: itineraryData,
    });

    const lead = await upsertBookingsAndLeads({
      bookingRef,
      email: guestEmail,
      type: "multi_day",
      status: "draft",
      primaryCity: "Tokyo",
      tourDate: null,
      guests: { adults: 2, kids: 0 },
      durationValue: 7,
      selections: {
        locationCityIds: [],
        hotelByCity: {},
        experienceIds: [],
        durationDays: 7,
      },
    });

    if (!lead.ok) {
      return NextResponse.json(
        { error: lead.error || "Could not register bookings_and_leads." },
        { status: 500 }
      );
    }

    const magicLink = `${BRAND_URL}/trip/${encodeURIComponent(bookingRef)}?email=${encodeURIComponent(guestEmail)}`;

    return NextResponse.json({
      ok: true,
      id: record.id,
      bookingRef,
      pnr: bookingRef,
      guestName,
      guestEmail,
      status: "draft",
      magicLink,
      leadId: lead.id,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Draft booking failed.";
    console.warn("[agent/draft-booking]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
