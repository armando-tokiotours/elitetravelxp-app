/**
 * When Ops changes status on ops_hub, mirror to bookings_and_leads or agency_orders.
 */

import type PocketBase from "pocketbase";
import {
  toBookingsAndLeadsStatus,
  toCanonicalStatus,
} from "@/lib/bookingStatus";

export async function syncDetailStatusFromOpsHub(
  pb: PocketBase,
  hub: {
    source?: string;
    detail_collection?: string;
    detail_id?: string;
    pnr?: string;
  },
  nextStatus: string
): Promise<void> {
  const canonical = toCanonicalStatus(nextStatus);
  const detailId = String(hub.detail_id || "").trim();
  const collection =
    hub.detail_collection ||
    (hub.source === "agency" ? "agency_orders" : "bookings_and_leads");

  if (!detailId) {
    // Fallback: resolve by PNR
    const pnr = String(hub.pnr || "")
      .trim()
      .toUpperCase()
      .replace(/"/g, "");
    if (!pnr) return;
    if (collection === "agency_orders") {
      try {
        const row = await pb
          .collection("agency_orders")
          .getFirstListItem(`booking_ref="${pnr}"`, { requestKey: null });
        await pb
          .collection("agency_orders")
          .update(row.id, { status: canonical }, { requestKey: null });
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      const row = await pb
        .collection("bookings_and_leads")
        .getFirstListItem(`booking_ref="${pnr}"`, { requestKey: null });
      await pb.collection("bookings_and_leads").update(
        row.id,
        { status: toBookingsAndLeadsStatus(canonical) },
        { requestKey: null }
      );
    } catch {
      /* ignore */
    }
    return;
  }

  if (collection === "agency_orders") {
    await pb
      .collection("agency_orders")
      .update(detailId, { status: canonical }, { requestKey: null });
    return;
  }

  await pb.collection("bookings_and_leads").update(
    detailId,
    { status: toBookingsAndLeadsStatus(canonical) },
    { requestKey: null }
  );
}
