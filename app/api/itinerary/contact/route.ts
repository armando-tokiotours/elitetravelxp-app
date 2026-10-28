import { NextResponse } from "next/server";
import {
  isTempBookingRef,
  isValidBookingPNR,
  normalizeBookingPNR,
} from "@/utils/pnr";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import {
  expandMultiDaySelectionsToState,
  expandSingleDaySelectionsToState,
  findBookingsAndLeadsByRef,
} from "@/lib/bookingsAndLeads";
import { deriveTourPaymentStatus } from "@/lib/tourPaymentStatus";

type OpsPaymentSlice = {
  feeCreditEur: number;
  totalPaidEur: number;
  estimatedTotalEur: number;
  tourPaymentStatus: string | null;
  conciergeFeePaid: boolean;
  paymentConfirmed: boolean;
};

/** Read-only ops_hub payment slice for the builder badge (no ledger heal). */
async function opsPaymentForPnr(pnr: string): Promise<OpsPaymentSlice> {
  const empty: OpsPaymentSlice = {
    feeCreditEur: 0,
    totalPaidEur: 0,
    estimatedTotalEur: 0,
    tourPaymentStatus: null,
    conciergeFeePaid: false,
    paymentConfirmed: false,
  };
  try {
    const pb = await getAdminPocketBase();
    const hub = (await pb
      .collection("ops_hub")
      .getFirstListItem(`pnr="${pnr.replace(/"/g, "")}"`, {
        requestKey: null,
      })) as {
      concierge_fee_paid?: boolean;
      payment_confirmed?: boolean;
      deposit_amount?: number | string;
      concierge_fee_amount?: number | string;
      tour_payment_status?: string;
      total_paid_eur?: number | string;
      estimated_total_eur?: number | string;
    };
    const feeAmount = Math.max(
      0,
      Math.round(
        Number(hub.concierge_fee_amount) || Number(hub.deposit_amount) || 0
      )
    );
    const totalPaidEur = Math.max(
      0,
      Math.round(Number(hub.total_paid_eur) || 0)
    );
    const status = deriveTourPaymentStatus({
      concierge_fee_paid: hub.concierge_fee_paid,
      payment_confirmed: hub.payment_confirmed,
      tour_payment_status: hub.tour_payment_status,
      deposit_amount: feeAmount || null,
      concierge_fee_amount: feeAmount || null,
    });
    const feeCreditEur = hub.concierge_fee_paid
      ? feeAmount || 60
      : status === "FEE_PAID"
        ? feeAmount || totalPaidEur || 60
        : 0;
    return {
      feeCreditEur,
      totalPaidEur: Math.max(totalPaidEur, feeCreditEur),
      estimatedTotalEur: Math.max(
        0,
        Math.round(Number(hub.estimated_total_eur) || 0)
      ),
      tourPaymentStatus: status === "UNPAID" ? null : status,
      conciergeFeePaid: Boolean(hub.concierge_fee_paid) || feeCreditEur > 0,
      paymentConfirmed: status === "FULLY_PAID",
    };
  } catch {
    return empty;
  }
}

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
      let nameFromSel = String(
        sel.fullName || sel.guestName || sel.contactName || ""
      ).trim();
      let whatsappFromSel = String(
        sel.whatsapp || sel.guestPhone || sel.contactPhone || sel.phone || ""
      ).trim();
      // BAL has no guest_name/phone columns — Pre-Elite contact lives on `bookings`.
      if (!nameFromSel || !whatsappFromSel) {
        try {
          const pb = await getAdminPocketBase();
          const row = await pb
            .collection("bookings")
            .getFirstListItem<{
              full_name?: string;
              whatsapp?: string;
            }>(`booking_ref="${pnr.replace(/"/g, "")}"`, {
              requestKey: null,
            });
          if (!nameFromSel) {
            nameFromSel = String(row.full_name || "").trim();
          }
          if (!whatsappFromSel) {
            whatsappFromSel = String(row.whatsapp || "").trim();
          }
        } catch {
          /* no bookings row */
        }
      }
      return NextResponse.json({
        ok: true,
        bookingRef: lead.booking_ref || pnr,
        email: String(lead.email || "").trim().toLowerCase(),
        fullName: nameFromSel,
        whatsapp: whatsappFromSel,
        // Journey routing discriminator (bookings_and_leads.type) so builder
        // guards can force Single-Day vs Multi-Day mode for this PNR.
        type: lead.type || null,
        source: "bookings_and_leads",
        status: lead.status || null,
        // Ref-only builder pre-hydration: the same expansion Retrieve /
        // Manage Booking apply, so ?ref= edit mode needn't ask for email.
        singleDay:
          lead.type === "single_day"
            ? expandSingleDaySelectionsToState(lead)
            : null,
        multiDay:
          lead.type === "multi_day"
            ? expandMultiDaySelectionsToState(lead)
            : null,
        payment: await opsPaymentForPnr(pnr),
      });
    }

    // Pre-elite bookings table (original request mail)
    try {
      const pb = await getAdminPocketBase();
      const safePnr = pnr.replace(/"/g, "");
      const row = await pb
        .collection("bookings")
        .getFirstListItem(`booking_ref="${safePnr}"`, { requestKey: null });
      // Pre-Elite briefs carry their trip type inside itinerary_data.
      let briefType: string | null = null;
      let briefSingleDay: Record<string, unknown> | null = null;
      try {
        const parsed = JSON.parse(
          String((row as { itinerary_data?: string }).itinerary_data || "")
        ) as {
          tripType?: string;
          trip_type?: string;
          type?: string;
          timing?: { startDate?: string };
          groupSize?: { adults?: number; children?: number };
        };
        briefType = parsed.tripType || parsed.trip_type || parsed.type || null;
        if (briefType === "single_day") {
          const start = String(parsed.timing?.startDate || "").slice(0, 10);
          briefSingleDay = {
            tourDate: /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : null,
            adults: Math.max(1, Number(parsed.groupSize?.adults) || 1),
            children: Math.max(0, Number(parsed.groupSize?.children) || 0),
          };
        }
      } catch {
        /* non-JSON brief — type unknown */
      }
      return NextResponse.json({
        ok: true,
        bookingRef: String(
          (row as { booking_ref?: string }).booking_ref || pnr
        ).toUpperCase(),
        email: String((row as { email?: string }).email || "")
          .trim()
          .toLowerCase(),
        fullName: String((row as { full_name?: string }).full_name || "").trim(),
        whatsapp: String((row as { whatsapp?: string }).whatsapp || "").trim(),
        type: briefType,
        source: "bookings",
        status: String((row as { status?: string }).status || "") || null,
        singleDay: briefSingleDay,
        payment: await opsPaymentForPnr(pnr),
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
