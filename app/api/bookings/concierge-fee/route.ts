import { NextResponse } from "next/server";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import { followupDateThreeMonthsBefore } from "@/lib/conciergeEstimateFlow";

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

    // Soft-heal from payments ledger when ops flags were inverted / missing fields
    if (!feeCreditEur) {
      try {
        const pays = await pb.collection("payments").getFullList({
          filter: `pnr="${pnr}" && kind="concierge_deposit"`,
          requestKey: null,
        });
        if (pays.length > 0) {
          const amt = Math.max(
            0,
            Math.round(Number(pays[0].amount_eur) || 60)
          );
          feeCreditEur = amt || 60;
          if (hub?.id) {
            try {
              await pb.collection("ops_hub").update(
                (hub as { id: string }).id,
                {
                  concierge_fee_paid: true,
                  concierge_fee_amount: feeCreditEur,
                  deposit_amount: feeCreditEur,
                  tour_payment_status: "FEE_PAID",
                  payment_confirmed: false,
                },
                { requestKey: null }
              );
            } catch {
              /* fields may not exist yet */
            }
          }
        }
      } catch {
        /* payments optional */
      }
    }

    return NextResponse.json({
      ok: true,
      pnr,
      concierge_fee_paid: feeCreditEur > 0 || feePaid,
      payment_confirmed:
        feeCreditEur > 0 ? false : Boolean(hub?.payment_confirmed),
      tour_payment_status:
        feeCreditEur > 0
          ? "FEE_PAID"
          : hub?.tour_payment_status || null,
      deposit_amount: feeCreditEur || deposit,
      concierge_fee_amount: feeCreditEur || deposit,
      feeCreditEur,
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

    if (hub) {
      // €60 concierge deposit is NEVER full tour payment
      await pb.collection("ops_hub").update(
        hub.id,
        {
          status: "incoming",
          concierge_fee_paid: true,
          concierge_fee_amount: amount,
          deposit_amount: amount,
          tour_payment_status: "FEE_PAID",
          payment_confirmed: false,
          total_paid_eur: amount,
          is_read: false,
        },
        { requestKey: null }
      );
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

    // Central payments ledger (idempotent on order_id when present)
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

    return NextResponse.json({
      ok: true,
      status: "incoming",
      concierge_fee_paid: true,
      payment_confirmed: false,
      tour_payment_status: "FEE_PAID",
      deposit_amount: amount,
      concierge_fee_amount: amount,
      feeCreditEur: amount,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "concierge-fee update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
