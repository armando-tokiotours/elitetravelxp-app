import { NextResponse } from "next/server";
import { parseItineraryData } from "@/lib/preEliteBuilder";
import { sendDraftBoardingPassEmails } from "@/lib/preEliteBoardingPassEmail";
import { recordBookingLeadEmailSent } from "@/lib/bookingsAndLeads";

/**
 * Sends Draft Boarding Pass emails to guest + concierge.
 * Only invoked from explicit "Save & Email" / resend on /pre-build.
 * Updates bookings_and_leads email audit counters.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const bookingRef = String(body?.bookingRef || "").trim();
    const fullName = String(body?.fullName || "").trim();
    const email = String(body?.email || "")
      .trim()
      .toLowerCase();
    const itineraryData = body?.itineraryData;

    if (!bookingRef || !fullName || !email) {
      return NextResponse.json(
        { error: "bookingRef, fullName, and email are required." },
        { status: 400 }
      );
    }

    const itinerary =
      typeof itineraryData === "string"
        ? parseItineraryData(itineraryData)
        : typeof itineraryData === "object" && itineraryData
          ? parseItineraryData(JSON.stringify(itineraryData))
          : null;

    if (!itinerary) {
      return NextResponse.json(
        { error: "Valid itineraryData is required." },
        { status: 400 }
      );
    }

    const result = await sendDraftBoardingPassEmails({
      bookingRef,
      fullName,
      email,
      itineraryData: itinerary,
    });

    let emailSentCount: number | undefined;
    if (result.guestSent || result.teamSent) {
      const audit = await recordBookingLeadEmailSent({
        bookingRef,
        email,
        type: itinerary.tripType === "single_day" ? "single_day" : "multi_day",
        fullName,
        itinerarySnippet: {
          _v: 1,
          source: "pre_elite",
          tripType: itinerary.tripType,
          timing: itinerary.timing,
        },
      });
      emailSentCount = audit.emailSentCount;
    }

    return NextResponse.json({
      ok: result.guestSent || result.teamSent,
      guestSent: result.guestSent,
      teamSent: result.teamSent,
      errors: result.errors,
      emailSentCount,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not send boarding-pass email.";
    console.error("[send-prebuilder-brief]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
