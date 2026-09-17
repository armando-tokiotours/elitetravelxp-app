import { NextResponse } from "next/server";
import {
  isValidBookingPNR,
  normalizeBookingPNR,
} from "@/utils/pnr";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";

/**
 * Reload a saved itinerary by email + booking PNR.
 * Returns the builder payload so the client can hydrate Zustand.
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
    if (!isValidBookingPNR(pnr)) {
      return NextResponse.json(
        { error: "Enter a valid booking PNR (e.g. JPN-7K9P2X)." },
        { status: 400 }
      );
    }

    const pb = await getAdminPocketBase();
    const safeEmail = email.replace(/"/g, "");
    const safePnr = pnr.replace(/"/g, "");

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

    try {
      record = await pb
        .collection("booking_requests")
        .getFirstListItem(
          `reference="${safePnr}" && contact_email="${safeEmail}"`
        );
    } catch {
      try {
        record = await pb
          .collection("quotations")
          .getFirstListItem(
            `booking_ref="${safePnr}" && email="${safeEmail}"`
          );
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
      quote: (payload as { quote?: unknown }).quote ?? {
        min: found.quote_min,
        max: found.quote_max,
      },
      departureDate:
        (payload as { departureDate?: string | null }).departureDate ??
        found.departure_date ??
        null,
      state: payload,
    });
  } catch (err) {
    console.error("[itinerary-retrieve]", err);
    const msg =
      err instanceof Error ? err.message : "Unable to retrieve itinerary.";
    const status = msg.includes("PB_ADMIN") ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
