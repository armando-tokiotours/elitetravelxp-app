import { NextResponse } from "next/server";
import {
  isTempBookingRef,
  isValidBookingPNR,
  normalizeBookingPNR,
} from "@/utils/pnr";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import { findBookingsAndLeadsByRef } from "@/lib/bookingsAndLeads";

/**
 * Prefill guest name/email for Send / Print from the original booking request.
 * Lookup by booking ref only (session already holds the PNR).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const pnr = normalizeBookingPNR(
      String(body?.pnr || body?.bookingRef || body?.reference || "")
    );

    if (!isValidBookingPNR(pnr) && !isTempBookingRef(pnr)) {
      return NextResponse.json(
        { error: "A valid booking reference is required." },
        { status: 400 }
      );
    }

    const lead = await findBookingsAndLeadsByRef(pnr);
    if (lead) {
      const sel = (lead.selections || {}) as unknown as Record<string, unknown>;
      const nameFromSel = String(
        sel.fullName || sel.guestName || sel.contactName || ""
      ).trim();
      return NextResponse.json({
        ok: true,
        bookingRef: lead.booking_ref || pnr,
        email: String(lead.email || "").trim().toLowerCase(),
        fullName: nameFromSel,
        source: "bookings_and_leads",
      });
    }

    // Pre-elite bookings table (original request mail)
    try {
      const pb = await getAdminPocketBase();
      const safePnr = pnr.replace(/"/g, "");
      const row = await pb
        .collection("bookings")
        .getFirstListItem(`booking_ref="${safePnr}"`, { requestKey: null });
      return NextResponse.json({
        ok: true,
        bookingRef: String(
          (row as { booking_ref?: string }).booking_ref || pnr
        ).toUpperCase(),
        email: String((row as { email?: string }).email || "")
          .trim()
          .toLowerCase(),
        fullName: String((row as { full_name?: string }).full_name || "").trim(),
        source: "bookings",
      });
    } catch {
      /* none */
    }

    return NextResponse.json({ ok: false, found: false }, { status: 404 });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Contact lookup failed.",
      },
      { status: 500 }
    );
  }
}
