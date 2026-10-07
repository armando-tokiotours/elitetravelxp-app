import { NextResponse } from "next/server";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import { followupDateThreeMonthsBefore } from "@/lib/conciergeEstimateFlow";
import {
  ensureConciergeFeeInLedger,
  sumPaymentsLedgerEur,
  syncOpsHubTotalPaidFromLedger,
} from "@/lib/paymentsLedger";

function normalizePnr(raw: string | null | undefined): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/"/g, "");
}

/**
 * GET /api/bookings/concierge-fee?pnr=
 * Guest hydrate: fee paid + credit amount (not full tour pay).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pnr = normalizePnr(searchParams.get("pnr") || searchParams.get("bookingRef"));
    if (!pnr) {
      return NextResponse.json({ error: "pnr required" }, { status: 400 });
    }

    const pb = await getAdminPocketBase();
    let hub: {
      id?: string;
      concierge_fee_paid?: boolean;
      payment_confirmed?: boolean;
      deposit_amount?: number | string;
      concierge_fee_amount?: number | string;
      tour_payment_status?: string;
      total_paid_eur?: number | string;
    } | null = null;
    try {
      hub = await pb
        .collection("ops_hub")
        .getFirstListItem(`pnr="${pnr}"`, { requestKey: null });
    } catch {
      hub = null;
    }

    const feePaid = Boolean(hub?.concierge_fee_paid);
    const deposit = Math.max(
      0,
      Math.round(
        Number(hub?.concierge_fee_amount) || Number(hub?.deposit_amount) || 0
      )
    );
    let feeCreditEur = feePaid ? deposit || 60 : 0;
    let totalPaidEur = Math.max(
      0,
      Math.round(Number(hub?.total_paid_eur) || 0)
    );

    // Backfill missing fee row, then sum ALL payments (fee + milestones)
    if (feePaid || feeCreditEur > 0) {
      await ensureConciergeFeeInLedger(pb, pnr, feeCreditEur || deposit || 60);
    }
    const ledgerSum = await sumPaymentsLedgerEur(pb, pnr);
    if (ledgerSum > totalPaidEur) {
      totalPaidEur = ledgerSum;
    } else if (ledgerSum > 0) {
      totalPaidEur = ledgerSum;
    }

    // Soft-heal fee flags from concierge_deposit rows when missing
    if (!feeCreditEur) {
      try {
        const pays = await pb.collection("payments").getFullList<{
          amount_eur?: number | string;
        }>({
          filter: `pnr="${pnr}" && kind="concierge_deposit"`,
          requestKey: null,
        });
        if (pays.length > 0) {
          const amt = Math.max(
            0,
            Math.round(Number(pays[0].amount_eur) || 60)
          );
          feeCreditEur = amt || 60;
        }
      } catch {
        /* payments optional */
      }
    }

    if (totalPaidEur <= 0 && feeCreditEur > 0) {
      totalPaidEur = feeCreditEur;
    } else if (feeCreditEur > 0 && totalPaidEur < feeCreditEur) {
      totalPaidEur = feeCreditEur;
    }

    // Persist healed total so Ops Financial Audit (reads ops_hub) matches guest
    if (hub?.id && totalPaidEur > Math.round(Number(hub.total_paid_eur) || 0)) {
      try {
        const statusUpper = String(hub.tour_payment_status || "").toUpperCase();
        const patch: Record<string, unknown> = {
          total_paid_eur: totalPaidEur,
        };
        if (feeCreditEur > 0) {
          patch.concierge_fee_paid = true;
          patch.concierge_fee_amount = feeCreditEur;
          patch.deposit_amount = feeCreditEur;
          if (
            statusUpper !== "PARTIALLY_PAID" &&
            statusUpper !== "FULLY_PAID"
          ) {
            patch.tour_payment_status =
              totalPaidEur > feeCreditEur ? "PARTIALLY_PAID" : "FEE_PAID";
          }
        }
        if (
          totalPaidEur > feeCreditEur &&
          feeCreditEur > 0 &&
          statusUpper !== "FULLY_PAID"
        ) {
          patch.tour_payment_status = "PARTIALLY_PAID";
          patch.payment_confirmed = false;
        }
        await pb
          .collection("ops_hub")
          .update((hub as { id: string }).id, patch, { requestKey: null });
      } catch {
        /* non-blocking heal */
      }
    }

    const explicitStatus = String(hub?.tour_payment_status || "")
      .trim()
      .toUpperCase();
    const paymentConfirmed = Boolean(hub?.payment_confirmed);
    let tourPaymentStatus =
      explicitStatus === "FULLY_PAID" ||
      explicitStatus === "PARTIALLY_PAID" ||
      explicitStatus === "FEE_PAID" ||
      explicitStatus === "UNPAID"
        ? explicitStatus
        : feeCreditEur > 0
          ? "FEE_PAID"
          : null;
    if (paymentConfirmed || tourPaymentStatus === "FULLY_PAID") {
      tourPaymentStatus = "FULLY_PAID";
    } else if (totalPaidEur > feeCreditEur && feeCreditEur > 0) {
      // Prefer ledger-derived partial over a stale FEE_PAID hub flag
      tourPaymentStatus = "PARTIALLY_PAID";
    }

    return NextResponse.json({
      ok: true,
      pnr,
      concierge_fee_paid: feeCreditEur > 0 || feePaid,
      payment_confirmed: tourPaymentStatus === "FULLY_PAID",
      tour_payment_status: tourPaymentStatus,
      deposit_amount: feeCreditEur || deposit,
      concierge_fee_amount: feeCreditEur || deposit,
      feeCreditEur,
      totalPaidEur,
      total_paid_eur: totalPaidEur,
      /** Alias — single source of truth for guest payment math */
      amountPaid: totalPaidEur,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "concierge-fee lookup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/bookings/concierge-fee
 * After Revolut €60 success → INCOMING + concierge_fee_paid (NOT full tour pay).
 * Or action=save_later → keep DRAFT + followup_date.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: "fee_paid" | "save_later";
      pnr?: string;
      bookingRef?: string;
      amount?: number;
      orderId?: string | null;
      path?: "FULL" | "PARTIAL";
      tourDate?: string | null;
    };

    const pnr = normalizePnr(body.pnr || body.bookingRef);
    if (!pnr) {
      return NextResponse.json({ error: "pnr required" }, { status: 400 });
    }

    const action = body.action === "save_later" ? "save_later" : "fee_paid";
    const pb = await getAdminPocketBase();

    let hub: { id: string; payment_confirmed?: boolean } | null = null;
    try {
      hub = await pb
        .collection("ops_hub")
        .getFirstListItem(`pnr="${pnr}"`, { requestKey: null });
    } catch {
      hub = null;
    }

    if (action === "save_later") {
      const followup = followupDateThreeMonthsBefore(body.tourDate);
      if (hub) {
        const patch: Record<string, unknown> = { status: "draft" };
        if (followup) patch.followup_date = followup;
        await pb
          .collection("ops_hub")
          .update(hub.id, patch, { requestKey: null });
      }
      try {
        const bal = await pb
          .collection("bookings_and_leads")
          .getFirstListItem(`booking_ref="${pnr}"`, { requestKey: null });
        await pb
          .collection("bookings_and_leads")
          .update(bal.id, { status: "lead" }, { requestKey: null });
      } catch {
        /* optional */
      }
      return NextResponse.json({
        ok: true,
        status: "draft",
        followup_date: followup,
      });
    }

    const amount = Math.max(0, Number(body.amount) || 60);
    const path = body.path === "PARTIAL" ? "PARTIAL" : "FULL";

    // Central payments ledger FIRST (idempotent on order_id when present)
    // so hub sync can read the authoritative sum including this fee.
    try {
      const orderId = String(body.orderId || "").trim();
      let skipCreate = false;
      if (orderId) {
        try {
          await pb
            .collection("payments")
            .getFirstListItem(`order_id="${orderId.replace(/"/g, "")}"`, {
              requestKey: null,
            });
          skipCreate = true;
        } catch {
          skipCreate = false;
        }
      }
      if (!skipCreate) {
        // Avoid duplicate fee rows when orderId is empty
        if (!orderId) {
          try {
            await pb
              .collection("payments")
              .getFirstListItem(
                `pnr="${pnr}" && kind="concierge_deposit" && amount_eur=${amount}`,
                { requestKey: null }
              );
            skipCreate = true;
          } catch {
            skipCreate = false;
          }
        }
      }
      if (!skipCreate) {
        await pb.collection("payments").create(
          {
            pnr,
            kind: "concierge_deposit",
            amount_eur: amount,
            currency: "EUR",
            provider: "revolut",
            order_id: orderId,
            path,
            notes: `Concierge deposit (${path})`,
          },
          { requestKey: null }
        );
      }
    } catch {
      /* payments collection may not exist yet on older PB */
    }

    const ledgerSum = await sumPaymentsLedgerEur(pb, pnr);
    const nextPaid = Math.max(ledgerSum, amount);
    let tourPaymentStatus = "FEE_PAID";
    let paymentConfirmed = false;

    if (hub) {
      // €60 concierge deposit is NEVER full tour payment.
      // Never clobber a higher cumulative total (e.g. fee+milestone already recorded).
      const existingHub = hub as {
        id: string;
        payment_confirmed?: boolean;
        total_paid_eur?: number | string;
        tour_payment_status?: string;
      };
      const statusUpper = String(
        existingHub.tour_payment_status || ""
      ).toUpperCase();
      const keepPartialOrFull =
        statusUpper === "PARTIALLY_PAID" || statusUpper === "FULLY_PAID";
      tourPaymentStatus = keepPartialOrFull
        ? String(existingHub.tour_payment_status || "FEE_PAID")
        : nextPaid > amount
          ? "PARTIALLY_PAID"
          : "FEE_PAID";
      paymentConfirmed = Boolean(existingHub.payment_confirmed);
      await pb.collection("ops_hub").update(
        hub.id,
        {
          status: "incoming",
          concierge_fee_paid: true,
          concierge_fee_amount: amount,
          deposit_amount: amount,
          tour_payment_status: tourPaymentStatus,
          payment_confirmed: paymentConfirmed,
          total_paid_eur: nextPaid,
          is_read: false,
        },
        { requestKey: null }
      );
      // Hard guarantee: hub === ledger sum (fee + any prior milestones)
      await syncOpsHubTotalPaidFromLedger(pb, pnr);
    }

    try {
      const bal = await pb
        .collection("bookings_and_leads")
        .getFirstListItem(`booking_ref="${pnr}"`, { requestKey: null });
      await pb.collection("bookings_and_leads").update(
        bal.id,
        { status: "in_progress" },
        { requestKey: null }
      );
    } catch {
      /* optional */
    }

    try {
      await pb.collection("booking_logs").create(
        {
          pnr,
          ops_hub_id: hub?.id || "",
          staff_id: "",
          staff_name: "Guest",
          action_type: "concierge_fee_paid",
          details: `€${amount} concierge fee paid via Revolut (${path})${
            body.orderId ? ` · order ${body.orderId}` : ""
          }`,
        },
        { requestKey: null }
      );
    } catch {
      /* non-blocking */
    }

    const finalPaid = await sumPaymentsLedgerEur(pb, pnr);

    return NextResponse.json({
      ok: true,
      status: "incoming",
      concierge_fee_paid: true,
      payment_confirmed: paymentConfirmed,
      tour_payment_status: tourPaymentStatus,
      deposit_amount: amount,
      concierge_fee_amount: amount,
      feeCreditEur: amount,
      totalPaidEur: Math.max(finalPaid, nextPaid, amount),
      total_paid_eur: Math.max(finalPaid, nextPaid, amount),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "concierge-fee update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
