import { NextResponse } from "next/server";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import { sendBookingMessage } from "@/lib/bookingMessages";
import { updateTicketsByPnr } from "@/lib/opsTickets";

/**
 * POST /api/ops/notify-ticketer
 * { pnr, ticketTitle, paymentReady? }
 * Posts procurement task to TICKETS (TIX) channel and sets ticket_status=needed
 * when deposit / 30% is secured (or paymentReady forced).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      pnr?: string;
      ticketTitle?: string;
      paymentReady?: boolean;
      opsHubId?: string;
    };

    const pnr = String(body.pnr || "")
      .trim()
      .toUpperCase();
    const ticketTitle = String(body.ticketTitle || "").trim();
    if (!pnr) {
      return NextResponse.json({ error: "pnr required" }, { status: 400 });
    }
    if (!ticketTitle) {
      return NextResponse.json(
        { error: "ticketTitle required" },
        { status: 400 }
      );
    }

    const pb = await getAdminPocketBase();

    let opsHubId = String(body.opsHubId || "").trim();
    let tourPay = "";
    let feePaid = false;
    let paymentConfirmed = false;

    try {
      const hub = await pb.collection("ops_hub").getFirstListItem<{
        id: string;
        tour_payment_status?: string;
        concierge_fee_paid?: boolean;
        payment_confirmed?: boolean;
      }>(`pnr="${pnr.replace(/"/g, "")}"`, { requestKey: null });
      opsHubId = opsHubId || hub.id;
      tourPay = String(hub.tour_payment_status || "")
        .trim()
        .toUpperCase();
      feePaid = Boolean(hub.concierge_fee_paid);
      paymentConfirmed = Boolean(hub.payment_confirmed);
    } catch {
      /* hub optional */
    }

    const paymentReady =
      body.paymentReady === true ||
      feePaid ||
      paymentConfirmed ||
      tourPay === "FEE_PAID" ||
      tourPay === "PARTIALLY_PAID" ||
      tourPay === "FULLY_PAID";

    const statusLine = paymentReady
      ? "Deposit / progress secured — Ticketer action required."
      : "Ticket added to quote — procure when deposit or 30% is paid.";

    await sendBookingMessage(pb, {
      pnr,
      opsHubId: opsHubId || null,
      channel: "TICKETS",
      senderName: "SYSTEM",
      senderRole: "OPS_COORDINATOR",
      topic: "TICKETS",
      message: [
        `🎟️ NEW TICKET PROCUREMENT TASK`,
        `PNR: ${pnr}`,
        `Item: ${ticketTitle}`,
        `Status: ${statusLine}`,
      ].join("\n"),
    });

    let ticketStatus: "needed" | "none" = "none";
    if (paymentReady) {
      await updateTicketsByPnr(pb, pnr, {
        ticket_status: "needed",
        ticket_notes: `Auto: ${ticketTitle}`,
      });
      ticketStatus = "needed";
      try {
        if (opsHubId) {
          await pb.collection("ops_hub").update(
            opsHubId,
            { tickets_needed: true, ticket_status: "needed" },
            { requestKey: null }
          );
        }
      } catch {
        /* ignore */
      }
    } else {
      try {
        if (opsHubId) {
          await pb.collection("ops_hub").update(
            opsHubId,
            { tickets_needed: true },
            { requestKey: null }
          );
        }
      } catch {
        /* ignore */
      }
    }

    return NextResponse.json({
      ok: true,
      success: true,
      paymentReady,
      ticketStatus,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to dispatch ticketer rule alert",
      },
      { status: 500 }
    );
  }
}
