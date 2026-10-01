import { NextResponse } from "next/server";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import {
  guideGuestDisplay,
  guideConfirmClientLabel,
  normalizeGuideConfirmStatus,
} from "@/lib/guideConfirmStatus";
import { toCanonicalStatus, toPassStatusLabel } from "@/lib/bookingStatus";
import { coerceStatusWithPayment } from "@/lib/paymentGate";

/**
 * GET ?pnr= — live Ops snapshot from collections (no client guessing).
 * Guest Day Services: confirmed guide/driver only when payment_confirmed.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pnr = String(searchParams.get("pnr") || "")
      .trim()
      .toUpperCase()
      .replace(/"/g, "");
    if (!pnr) {
      return NextResponse.json({ error: "pnr required" }, { status: 400 });
    }
    const pb = await getAdminPocketBase();

    let hubStatus: string | null = null;
    let paymentConfirmed = false;
    let assignedAgent: string | null = null;
    let hubTicketsNeeded = false;
    let hubDriverNeeded = false;
    let hubGuideNeeded = true;

    try {
      const hub = await pb.collection("ops_hub").getFirstListItem(
        `pnr="${pnr}"`,
        { requestKey: null }
      );
      hubStatus = String(hub.status || "").trim() || null;
      paymentConfirmed = Boolean(hub.payment_confirmed);
      assignedAgent = String(hub.assigned_agent || "").trim() || null;
      hubTicketsNeeded = Boolean(hub.tickets_needed);
      hubDriverNeeded = Boolean(hub.driver_needed);
      hubGuideNeeded = hub.guide_needed !== false;
    } catch {
      /* hub missing */
    }

    if (!hubStatus) {
      try {
        const bal = await pb
          .collection("bookings_and_leads")
          .getFirstListItem(`booking_ref="${pnr}"`, { requestKey: null });
        hubStatus = String(bal.status || "").trim() || null;
      } catch {
        /* ignore */
      }
    }

    const canonicalRaw = hubStatus ? toCanonicalStatus(hubStatus) : null;
    const canonical = canonicalRaw
      ? coerceStatusWithPayment(canonicalRaw, paymentConfirmed)
      : null;
    const passStatus = canonical ? toPassStatusLabel(canonical) : null;

    let guideNameRaw: string | null = null;
    let guideStatus = normalizeGuideConfirmStatus("unassigned");
    let driverNameRaw: string | null = null;
    let driverMode = "unassigned";
    let guideNeeded = hubGuideNeeded;
    let driverNeeded = hubDriverNeeded;
    let ticketsNeeded = hubTicketsNeeded;

    try {
      const row = await pb.collection("ops_dispatch").getFirstListItem(
        `pnr="${pnr}"`,
        { requestKey: null }
      );
      guideNameRaw = String(row.assigned_guide || "").trim() || null;
      guideStatus = normalizeGuideConfirmStatus(String(row.guide_mode || ""), {
        boardVisible: Boolean(row.guide_board_visible),
        assignedGuideId: String(row.assigned_guide_id || ""),
        guideResponse: String(row.guide_response || ""),
      });
      driverNameRaw = String(row.assigned_driver || "").trim() || null;
      driverMode = String(row.driver_mode || "unassigned").trim() || "unassigned";
      if (row.guide_needed != null) guideNeeded = Boolean(row.guide_needed);
      if (row.driver_needed != null) driverNeeded = Boolean(row.driver_needed);
      if (row.tickets_needed != null) ticketsNeeded = Boolean(row.tickets_needed);
    } catch {
      /* dispatch missing */
    }

    let ticketStatus = "none";
    try {
      const tix = await pb.collection("ops_tickets").getFirstListItem(
        `pnr="${pnr}"`,
        { requestKey: null }
      );
      ticketStatus = String(tix.ticket_status || "none").trim() || "none";
      if (ticketStatus !== "none") ticketsNeeded = true;
    } catch {
      /* tickets missing */
    }

    const guestGuide = guideGuestDisplay({
      status: guideStatus,
      guideName: guideNameRaw,
      paymentConfirmed,
    });

    // Driver guest: name only after payment
    const driverGuestName =
      paymentConfirmed && driverNameRaw ? driverNameRaw : null;
    const driverGuestLabel = !driverNameRaw
      ? "No driver assigned yet"
      : paymentConfirmed
        ? driverNameRaw
        : "Waiting for payment confirmation";

    // Tickets: purchase / confirmed stub only after payment
    const ticketsPurchaseAllowed = paymentConfirmed && ticketsNeeded;
    const ticketGuestLabel =
      !ticketsNeeded || ticketStatus === "none"
        ? null
        : !paymentConfirmed
          ? "Waiting for payment confirmation"
          : ticketStatus === "done"
            ? "Tickets purchased"
            : "Tickets pending purchase";

    return NextResponse.json({
      pnr,
      status: canonical,
      passStatus,
      paymentConfirmed,
      assignedAgent,
      /** Guest Day Services — payment-gated */
      guide: guestGuide.showConfirmed ? guestGuide.name : null,
      guideName: guideNameRaw,
      guideStatus,
      guideLabel: guestGuide.label,
      guideConfirmed: guestGuide.showConfirmed,
      driver: driverGuestName,
      driverName: driverNameRaw,
      driverLabel: driverGuestLabel,
      driverMode,
      guideNeeded,
      driverNeeded,
      ticketsNeeded,
      ticketStatus,
      ticketsPurchaseAllowed,
      ticketGuestLabel,
      // staff raw (unused by guest but handy)
      guideLabelStaff: guideConfirmClientLabel(guideStatus, guideNameRaw),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
