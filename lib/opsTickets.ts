/**
 * Silo 3 ops_tickets pocket — ticketer status/notes by PNR.
 * Dual-writes to ops_hub during cutover.
 */

import type PocketBase from "pocketbase";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";

export type TicketStatus = "none" | "needed" | "ordered" | "done";

export type OpsTicketsRow = {
  id: string;
  pnr: string;
  ticket_status?: TicketStatus | string;
  ticket_notes?: string;
  assigned_ticketer_id?: string;
};

function safePnr(pnr: string): string {
  return String(pnr || "")
    .trim()
    .toUpperCase()
    .replace(/"/g, "");
}

export async function ensureTicketsRow(
  pb: PocketBase,
  pnrRaw: string
): Promise<OpsTicketsRow> {
  const pnr = safePnr(pnrRaw);
  if (!pnr) throw new Error("pnr required");
  try {
    return await pb
      .collection("ops_tickets")
      .getFirstListItem<OpsTicketsRow>(`pnr="${pnr}"`, { requestKey: null });
  } catch {
    return (await pb.collection("ops_tickets").create(
      {
        pnr,
        ticket_status: "none",
        ticket_notes: "",
        assigned_ticketer_id: "",
      },
      { requestKey: null }
    )) as OpsTicketsRow;
  }
}

async function dualWriteHubTickets(
  pb: PocketBase,
  pnr: string,
  patch: Record<string, unknown>
): Promise<void> {
  try {
    const hub = await pb
      .collection("ops_hub")
      .getFirstListItem(`pnr="${pnr}"`, { requestKey: null });
    await pb.collection("ops_hub").update(hub.id, patch, { requestKey: null });
  } catch {
    /* ignore after hub thin */
  }
}

export async function updateTicketsByPnr(
  pb: PocketBase,
  pnrRaw: string,
  patch: Partial<Omit<OpsTicketsRow, "id" | "pnr">>
): Promise<OpsTicketsRow> {
  const pnr = safePnr(pnrRaw);
  const row = await ensureTicketsRow(pb, pnr);
  const updated = (await pb
    .collection("ops_tickets")
    .update(row.id, patch, { requestKey: null })) as OpsTicketsRow;
  await dualWriteHubTickets(pb, pnr, {
    ticket_status: updated.ticket_status,
    ticket_notes: updated.ticket_notes,
    assigned_ticketer_id: updated.assigned_ticketer_id,
  });
  return updated;
}

export async function loadTickets(
  pb: PocketBase,
  filter?: string
): Promise<OpsTicketsRow[]> {
  return pb.collection("ops_tickets").getFullList<OpsTicketsRow>({
    sort: "-updated",
    filter: filter || undefined,
    requestKey: null,
  });
}

export async function ensureTicketsForPnrAdmin(pnrRaw: string): Promise<void> {
  try {
    const pb = await getAdminPocketBase();
    await ensureTicketsRow(pb, pnrRaw);
  } catch (err) {
    console.warn(
      "[ops_tickets]",
      err instanceof Error ? err.message : "ensure failed"
    );
  }
}
