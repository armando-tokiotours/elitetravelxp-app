import { NextResponse } from "next/server";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import {
  ensureConciergeFeeInLedger,
  sumPaymentsLedgerEur,
  syncOpsHubTotalPaidFromLedger,
} from "@/lib/paymentsLedger";

export type PaymentKind =
  | "concierge_deposit"
  | "tour_deposit"
  | "tour_partial"
  | "tour_full"
  | "other";

/**
 * Sync ops_hub from payments ledger (authoritative).
 * Hard guarantee after create OR duplicate order_id heal:
 *   ops_hub.total_paid_eur === sum(payments for PNR)
 */
async function syncOpsHubPaidFromLedger(
  pb: Awaited<ReturnType<typeof getAdminPocketBase>>,
  input: {
    pnr: string;
    kind: PaymentKind;
    amount: number;
    estimatedTotalEur?: number;
  }
): Promise<{ totalPaidEur: number; hubId?: string }> {
  const { pnr, kind, amount } = input;

  try {
    const hub = await pb
      .collection("ops_hub")
      .getFirstListItem<{
        id: string;
        total_paid_eur?: number;
        concierge_fee_amount?: number;
        deposit_amount?: number;
        concierge_fee_paid?: boolean;
        estimated_total_eur?: number;
        status?: string;
        payment_confirmed?: boolean;
        tour_payment_status?: string;
      }>(`pnr="${pnr}"`, { requestKey: null });

    const feeAmt =
      Math.max(0, Math.round(Number(hub.concierge_fee_amount) || 0)) ||
      Math.max(0, Math.round(Number(hub.deposit_amount) || 0)) ||
      (hub.concierge_fee_paid ? 60 : 0);

    // Tour milestones: backfill missing fee ledger row so TOTAL PAID = fee+milestone
    if (
      (kind === "tour_partial" ||
        kind === "tour_deposit" ||
        kind === "tour_full") &&
      (hub.concierge_fee_paid || feeAmt > 0)
    ) {
      await ensureConciergeFeeInLedger(pb, pnr, feeAmt || 60);
    }

    // Hard guarantee: hub total equals ledger sum (fee + milestones).
    const nextPaid = await sumPaymentsLedgerEur(pb, pnr);

    const estimated =
      Math.max(0, Math.round(Number(input.estimatedTotalEur) || 0)) ||
      Math.max(0, Math.round(Number(hub.estimated_total_eur) || 0));

    const patch: Record<string, unknown> = {
      is_read: false,
      total_paid_eur: nextPaid,
    };
    if (estimated > 0) patch.estimated_total_eur = estimated;

    if (kind === "concierge_deposit") {
      patch.concierge_fee_paid = true;
      patch.concierge_fee_amount = amount || feeAmt || 60;
      patch.deposit_amount = amount || feeAmt || 60;
      const existingStatus = String(hub.tour_payment_status || "").toUpperCase();
      if (
        existingStatus !== "PARTIALLY_PAID" &&
        existingStatus !== "FULLY_PAID"
      ) {
        patch.tour_payment_status =
          nextPaid > (amount || feeAmt || 60) ? "PARTIALLY_PAID" : "FEE_PAID";
        patch.payment_confirmed = false;
      }
      if (!hub.status || hub.status === "draft" || hub.status === "lead") {
        patch.status = "incoming";
      }
    } else if (kind === "tour_partial" || kind === "tour_deposit") {
      const remaining =
        estimated > 0 ? Math.max(0, estimated - nextPaid) : null;
      if (remaining != null && remaining <= 1) {
        patch.payment_confirmed = true;
        patch.tour_payment_status = "FULLY_PAID";
        patch.concierge_fee_paid = true;
      } else {
        patch.payment_confirmed = false;
        patch.tour_payment_status = "PARTIALLY_PAID";
        patch.concierge_fee_paid = true;
      }
    } else if (kind === "tour_full") {
      patch.payment_confirmed = true;
      patch.tour_payment_status = "FULLY_PAID";
      patch.concierge_fee_paid = true;
    } else if (amount > 100) {
      patch.payment_confirmed = true;
      patch.tour_payment_status = "FULLY_PAID";
      patch.concierge_fee_paid = true;
    } else if (amount > 0 && amount <= 100 && nextPaid <= amount) {
      // Small "other" — treat as fee only when ledger has nothing larger
      patch.concierge_fee_paid = true;
      patch.concierge_fee_amount = amount;
      patch.deposit_amount = amount;
      patch.tour_payment_status = "FEE_PAID";
      patch.payment_confirmed = false;
    }

    // Always write ledger sum — never leave fee-only after a milestone row exists
    patch.total_paid_eur = nextPaid;

    await pb.collection("ops_hub").update(hub.id, patch, { requestKey: null });

    // Re-verify hard guarantee (guards against concurrent fee POST races)
    const verified = await syncOpsHubTotalPaidFromLedger(pb, pnr);
    return {
      totalPaidEur: verified.totalPaidEur,
      hubId: hub.id,
    };
  } catch {
    const ledgerSum = await sumPaymentsLedgerEur(pb, pnr);
    return { totalPaidEur: Math.max(ledgerSum, amount) };
  }
}

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
      Math.round(Number(body.amountEur ?? body.amount) || 0)
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

    // Idempotent on order_id when present — still heal ops_hub from ledger
    if (orderId) {
      try {
        const existing = await pb
          .collection("payments")
          .getFirstListItem(`order_id="${orderId.replace(/"/g, "")}"`, {
            requestKey: null,
          });
        const synced = await syncOpsHubPaidFromLedger(pb, {
          pnr,
          kind,
          amount,
          estimatedTotalEur: body.estimatedTotalEur,
        });
        return NextResponse.json({
          ok: true,
          id: existing.id,
          duplicate: true,
          totalPaidEur: synced.totalPaidEur,
        });
      } catch {
        /* create new */
      }
    }

    // Fee path often writes the ledger in /api/bookings/concierge-fee first
    // (same orderId or none). Avoid double-counting fee rows.
    if (kind === "concierge_deposit" && !orderId) {
      try {
        const existingFee = await pb
          .collection("payments")
          .getFirstListItem(
            `pnr="${pnr}" && kind="concierge_deposit" && amount_eur=${amount}`,
            { requestKey: null }
          );
        const synced = await syncOpsHubPaidFromLedger(pb, {
          pnr,
          kind,
          amount,
          estimatedTotalEur: body.estimatedTotalEur,
        });
        return NextResponse.json({
          ok: true,
          id: existingFee.id,
          duplicate: true,
          totalPaidEur: synced.totalPaidEur,
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

    const synced = await syncOpsHubPaidFromLedger(pb, {
      pnr,
      kind,
      amount,
      estimatedTotalEur: body.estimatedTotalEur,
    });

    return NextResponse.json({
      ok: true,
      id: row.id,
      totalPaidEur: synced.totalPaidEur,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "payments record failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
