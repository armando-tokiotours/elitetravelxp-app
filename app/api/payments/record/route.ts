import { NextResponse } from "next/server";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";

export type PaymentKind =
  | "concierge_deposit"
  | "tour_deposit"
  | "tour_partial"
  | "tour_full"
  | "other";

/**
 * POST /api/payments/record
 * Central ledger row after Revolut (or other) success.
 * Concierge deposit → fee paid only. Tour kinds → payment_confirmed.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      pnr?: string;
      bookingRef?: string;
      kind?: PaymentKind;
      amountEur?: number;
      amount?: number;
      currency?: string;
      provider?: string;
      orderId?: string | null;
      path?: string | null;
      guestEmail?: string;
      guestName?: string;
      builder?: string;
      notes?: string;
      /** Package estimate — used to accumulate total_paid_eur */
      estimatedTotalEur?: number;
    };

    const pnr = String(body.pnr || body.bookingRef || "")
      .trim()
      .toUpperCase()
      .replace(/"/g, "");
    if (!pnr) {
      return NextResponse.json({ error: "pnr required" }, { status: 400 });
    }

    const amount = Math.max(
      0,
      Number(body.amountEur ?? body.amount) || 0
    );
    if (!(amount > 0)) {
      return NextResponse.json(
        { error: "amountEur required" },
        { status: 400 }
      );
    }

    const kind: PaymentKind =
      body.kind === "tour_deposit" ||
      body.kind === "tour_partial" ||
      body.kind === "tour_full" ||
      body.kind === "other"
        ? body.kind
        : "concierge_deposit";

    const orderId = String(body.orderId || "").trim();
    const pb = await getAdminPocketBase();

    // Idempotent on order_id when present
    if (orderId) {
      try {
        const existing = await pb
          .collection("payments")
          .getFirstListItem(`order_id="${orderId.replace(/"/g, "")}"`, {
            requestKey: null,
          });
        return NextResponse.json({
          ok: true,
          id: existing.id,
          duplicate: true,
        });
      } catch {
        /* create new */
      }
    }

    const row = await pb.collection("payments").create(
      {
        pnr,
        kind,
        amount_eur: amount,
        currency: String(body.currency || "EUR").slice(0, 8),
        provider: String(body.provider || "revolut").slice(0, 32),
        order_id: orderId || "",
        path: String(body.path || "").slice(0, 32),
        guest_email: String(body.guestEmail || "")
          .trim()
          .toLowerCase(),
        guest_name: String(body.guestName || "").trim().slice(0, 200),
        builder: String(body.builder || "").slice(0, 32),
        notes: String(body.notes || "").slice(0, 2000),
      },
      { requestKey: null }
    );

    try {
      const hub = await pb
        .collection("ops_hub")
        .getFirstListItem(`pnr="${pnr}"`, { requestKey: null });
      const prevPaid = Math.max(0, Number(hub.total_paid_eur) || 0);
      const feeAmt =
        Math.max(0, Number(hub.concierge_fee_amount) || 0) ||
        Math.max(0, Number(hub.deposit_amount) || 0) ||
        (hub.concierge_fee_paid ? 60 : 0);
      const baseline = prevPaid > 0 ? prevPaid : feeAmt;
      const nextPaid = baseline + amount;
      const estimated =
        Math.max(0, Number(body.estimatedTotalEur) || 0) ||
        Math.max(0, Number(hub.estimated_total_eur) || 0);

      const patch: Record<string, unknown> = {
        is_read: false,
        total_paid_eur: nextPaid,
      };
      if (estimated > 0) patch.estimated_total_eur = estimated;

      if (kind === "concierge_deposit") {
        patch.concierge_fee_paid = true;
        patch.concierge_fee_amount = amount;
        patch.deposit_amount = amount;
        patch.total_paid_eur = amount;
        patch.tour_payment_status = "FEE_PAID";
        patch.payment_confirmed = false;
        if (!hub.status || hub.status === "draft" || hub.status === "lead") {
          patch.status = "incoming";
        }
      } else if (kind === "tour_partial" || kind === "tour_deposit") {
        const remaining =
          estimated > 0 ? Math.max(0, estimated - nextPaid) : null;
        if (remaining != null && remaining <= 1) {
          patch.payment_confirmed = true;
          patch.tour_payment_status = "FULLY_PAID";
        } else {
          patch.payment_confirmed = false;
          patch.tour_payment_status = "PARTIALLY_PAID";
          patch.concierge_fee_paid = true;
        }
      } else if (kind === "tour_full") {
        patch.payment_confirmed = true;
        patch.tour_payment_status = "FULLY_PAID";
        patch.concierge_fee_paid = true;
      } else if (amount <= 100) {
        patch.concierge_fee_paid = true;
        patch.concierge_fee_amount = amount;
        patch.deposit_amount = amount;
        patch.total_paid_eur = amount;
        patch.tour_payment_status = "FEE_PAID";
        patch.payment_confirmed = false;
      } else {
        patch.payment_confirmed = true;
        patch.tour_payment_status = "FULLY_PAID";
      }
      await pb.collection("ops_hub").update(hub.id, patch, { requestKey: null });
    } catch {
      /* ops_hub optional */
    }

    return NextResponse.json({ ok: true, id: row.id });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "payments record failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
