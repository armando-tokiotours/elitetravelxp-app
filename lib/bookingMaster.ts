/**
 * Assemble Silo 3 pockets for one PNR (owner/ops master view).
 */

import type PocketBase from "pocketbase";
import type { OpsDispatchRow } from "@/lib/opsDispatch";
import type { OpsMoneyRow } from "@/lib/opsMoney";
import type { OpsTicketsRow } from "@/lib/opsTickets";
import type { OpsHubRow } from "@/components/staff/opsHubClient";

export type BookingMasterBundle = {
  pnr: string;
  hub: OpsHubRow | null;
  dispatch: OpsDispatchRow | null;
  money: OpsMoneyRow | null;
  tickets: OpsTicketsRow | null;
  /** `bookings_and_leads.type` (single_day | multi_day | experience_only) — Journey routing discriminator. */
  leadType?: string | null;
};

function safePnr(pnr: string): string {
  return String(pnr || "")
    .trim()
    .toUpperCase()
    .replace(/"/g, "");
}

async function firstOrNull<T>(
  fn: () => Promise<T>
): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export async function loadBookingMasterByPnr(
  pb: PocketBase,
  pnrRaw: string
): Promise<BookingMasterBundle> {
  const pnr = safePnr(pnrRaw);
  const [hub, dispatch, money, tickets, bal] = await Promise.all([
    firstOrNull(() =>
      pb
        .collection("ops_hub")
        .getFirstListItem<OpsHubRow>(`pnr="${pnr}"`, { requestKey: null })
    ),
    firstOrNull(() =>
      pb
        .collection("ops_dispatch")
        .getFirstListItem<OpsDispatchRow>(`pnr="${pnr}"`, { requestKey: null })
    ),
    firstOrNull(() =>
      pb
        .collection("ops_money")
        .getFirstListItem<OpsMoneyRow>(`pnr="${pnr}"`, { requestKey: null })
    ),
    firstOrNull(() =>
      pb
        .collection("ops_tickets")
        .getFirstListItem<OpsTicketsRow>(`pnr="${pnr}"`, { requestKey: null })
    ),
    firstOrNull(() =>
      pb
        .collection("bookings_and_leads")
        .getFirstListItem<{ type?: string }>(`booking_ref="${pnr}"`, {
          requestKey: null,
        })
    ),
  ]);
  return { pnr, hub, dispatch, money, tickets, leadType: bal?.type || null };
}
