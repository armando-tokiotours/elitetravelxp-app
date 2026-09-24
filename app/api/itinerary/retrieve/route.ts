import { NextResponse } from "next/server";
import {
  isTempBookingRef,
  isValidBookingPNR,
  normalizeBookingPNR,
} from "@/utils/pnr";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import { findBookingsAndLeads } from "@/lib/bookingsAndLeads";

type PreEliteBrief = {
  bookingRef: string;
  fullName: string;
  email: string;
  itineraryData: string;
  status?: string;
};

async function findPreEliteBrief(
  pnr: string,
  email: string
): Promise<PreEliteBrief | null> {
  try {
    const pb = await getAdminPocketBase();
    const safePnr = pnr.replace(/"/g, "");
    const safeEmail = email.replace(/"/g, "");
    try {
      const row = await pb.collection("bookings").getFirstListItem(
        `booking_ref="${safePnr}" && email="${safeEmail}"`,
        { requestKey: null }
      );
      const itineraryData = String(
        (row as { itinerary_data?: string }).itinerary_data || ""
      );
      if (!itineraryData) return null;
      return {
        bookingRef: String(
          (row as { booking_ref?: string }).booking_ref || pnr
        ).toUpperCase(),
        fullName: String((row as { full_name?: string }).full_name || ""),
        email: String((row as { email?: string }).email || email)
          .trim()
          .toLowerCase(),
        itineraryData,
        status: String((row as { status?: string }).status || "draft"),
      };
    } catch {
      // PNR-only then email match (case)
      const byRef = await pb
        .collection("bookings")
        .getFirstListItem(`booking_ref="${safePnr}"`, { requestKey: null });
      const rowEmail = String((byRef as { email?: string }).email || "")
        .trim()
        .toLowerCase();
      if (rowEmail !== email) return null;
      const itineraryData = String(
        (byRef as { itinerary_data?: string }).itinerary_data || ""
      );
      if (!itineraryData) return null;
      return {
        bookingRef: String(
          (byRef as { booking_ref?: string }).booking_ref || pnr
        ).toUpperCase(),
        fullName: String((byRef as { full_name?: string }).full_name || ""),
        email: rowEmail,
        itineraryData,
        status: String((byRef as { status?: string }).status || "draft"),
      };
    }
  } catch {
    return null;
  }
}

/**
 * Reload a saved itinerary by email + booking PNR.
 * Prefers `bookings_and_leads`, attaches Pre-Elite `bookings.itinerary_data`
 * when available so Manage Booking can open /pre-build summary.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email || body?.contactEmail || "")
      .trim()
      .toLowerCase();
    const pnr = normalizeBookingPNR(
      String(body?.pnr || body?.bookingRef || body?.reference || "")
    );

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }
    if (!isValidBookingPNR(pnr) && !isTempBookingRef(pnr)) {
      return NextResponse.json(
        { error: "Enter a valid booking PNR (e.g. JPN-7K9P2X)." },
        { status: 400 }
      );
    }

    const safeEmail = email.replace(/"/g, "");
    const safePnr = pnr.replace(/"/g, "");

    const preElite = await findPreEliteBrief(safePnr, safeEmail);
    const lead = await findBookingsAndLeads(safePnr, safeEmail);

    if (lead) {
      const {
        expandMultiDaySelectionsToState,
        expandSingleDaySelectionsToState,
      } = await import("@/lib/bookingsAndLeads");
      const state =
        lead.type === "single_day"
          ? {
              tripMode: "single_day",
              ...expandSingleDaySelectionsToState(lead),
              confirmedBookingRef: lead.booking_ref,
            }
          : expandMultiDaySelectionsToState(lead);

      // Prefer Pre-Elite itinerary_data; fall back to selections.preEliteBrief
      const sel = (lead.selections || {}) as Record<string, unknown>;
      const embeddedBrief =
        typeof sel.preEliteBrief === "string"
          ? sel.preEliteBrief
          : typeof sel.itineraryData === "string"
            ? sel.itineraryData
            : "";

      return NextResponse.json({
        ok: true,
        bookingRef: lead.booking_ref || pnr,
        id: lead.id,
        status: lead.status,
        contactEmail: lead.email,
        source: "bookings_and_leads",
        type: lead.type,
        quote: null,
        departureDate: null,
        state,
        singleDay:
          lead.type === "single_day"
            ? expandSingleDaySelectionsToState(lead)
            : null,
        preElite: preElite
          ? {
              bookingRef: preElite.bookingRef,
              fullName: preElite.fullName,
              email: preElite.email,
              itineraryData: preElite.itineraryData,
              status: preElite.status,
            }
          : embeddedBrief
            ? {
                bookingRef: lead.booking_ref || pnr,
                fullName: "",
                email: lead.email,
                itineraryData: embeddedBrief,
              }
            : null,
      });
    }

    // Pre-Elite only (no builder lead yet)
    if (preElite) {
      const { parseItineraryData } = await import("@/lib/preEliteBuilder");
      const parsed = parseItineraryData(preElite.itineraryData);
      const tripType = parsed?.tripType || "multi_day";
      return NextResponse.json({
        ok: true,
        bookingRef: preElite.bookingRef,
        id: null,
        status: preElite.status || "draft",
        contactEmail: preElite.email,
        source: "bookings",
        type: tripType,
        quote: null,
        departureDate: null,
        state: {
          confirmedBookingRef: preElite.bookingRef,
          tripMode: tripType === "single_day" ? "single_day" : "multi_day",
          adults: parsed?.groupSize.adults ?? 2,
          children: parsed?.groupSize.children ?? 0,
        },
        singleDay:
          tripType === "single_day"
            ? {
                tourDate: parsed?.timing?.startDate || null,
                adults: parsed?.groupSize.adults ?? 2,
                children: parsed?.groupSize.children ?? 0,
              }
            : null,
        preElite: {
          bookingRef: preElite.bookingRef,
          fullName: preElite.fullName,
          email: preElite.email,
          itineraryData: preElite.itineraryData,
          status: preElite.status,
        },
      });
    }

    // Legacy collections
    const pb = await getAdminPocketBase();
    let record: {
      id: string;
      reference?: string;
      booking_ref?: string;
      contact_email?: string;
      email?: string;
      status?: string;
      quote_min?: number;
      quote_max?: number;
      departure_date?: string;
      payload?: unknown;
    } | null = null;
    let source: "booking_requests" | "quotations" = "booking_requests";

    try {
      record = await pb.collection("booking_requests").getFirstListItem(
        `reference="${safePnr}" && contact_email="${safeEmail}"`,
        { requestKey: null }
      );
      source = "booking_requests";
    } catch {
      try {
        record = await pb.collection("quotations").getFirstListItem(
          `booking_ref="${safePnr}" && email="${safeEmail}"`,
          { requestKey: null }
        );
        source = "quotations";
      } catch {
        return NextResponse.json(
          {
            error:
              "No itinerary found for that email and booking PNR. Check both and try again.",
          },
          { status: 404 }
        );
      }
    }

    if (!record) {
      return NextResponse.json(
        {
          error:
            "No itinerary found for that email and booking PNR. Check both and try again.",
        },
        { status: 404 }
      );
    }

    const found = record;
    const payload =
      found.payload && typeof found.payload === "object"
        ? found.payload
        : {};

    return NextResponse.json({
      ok: true,
      bookingRef: found.reference || found.booking_ref || pnr,
      id: found.id,
      status: found.status,
      contactEmail: found.contact_email || found.email,
      source,
      quote: (payload as { quote?: unknown }).quote ?? {
        min: found.quote_min,
        max: found.quote_max,
      },
      departureDate:
        (payload as { departureDate?: string | null }).departureDate ??
        found.departure_date ??
        null,
      state: payload,
      preElite: null,
    });
  } catch (err) {
    console.error("[itinerary-retrieve]", err);
    const msg =
      err instanceof Error ? err.message : "Unable to retrieve itinerary.";
    const status = msg.includes("PB_ADMIN") ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
