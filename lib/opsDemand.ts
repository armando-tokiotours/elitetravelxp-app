/**
 * Derive Ops demand flags from guest itinerary selections.
 * Ticketer / driver / guide portals only surface jobs when needed.
 */

import type PocketBase from "pocketbase";
import type { BuilderState } from "@/store/useBuilderStore";
import type { SingleDayBuilderState } from "@/store/useSingleDayBuilderStore";
import type { TransportTicketLine } from "@/lib/transportProducts";
import { ensureDispatchRow } from "@/lib/opsDispatch";
import { ensureTicketsRow, updateTicketsByPnr } from "@/lib/opsTickets";

export type OpsDemandFlags = {
  ticketsNeeded: boolean;
  driverNeeded: boolean;
  guideNeeded: boolean;
  ticketLines?: TransportTicketLine[];
};

export function demandFromMultiDay(
  state: Pick<
    BuilderState,
    | "locations"
    | "selectedTours"
    | "arrivalNeedsTicket"
    | "chauffeurSelections"
    | "chauffeurDays"
    | "selectedTransportProducts"
  >
): OpsDemandFlags {
  const locations = state.locations || [];
  const ticketLines = [...(state.selectedTransportProducts || [])];
  let ticketsNeeded =
    Boolean(state.arrivalNeedsTicket) || ticketLines.length > 0;
  let driverNeeded = false;
  let guideNeeded = Object.values(state.selectedTours || {}).some(
    (rows) => Array.isArray(rows) && rows.length > 0
  );

  for (const loc of locations) {
    if (loc.transitType === "public" && loc.needsTicket) ticketsNeeded = true;
    if (loc.transitType === "private") driverNeeded = true;
    const ticketType = String(loc.ticketType || "").toLowerCase();
    if (
      ticketType.includes("suica") ||
      ticketType.includes("pasmo") ||
      ticketType === "ic_card"
    ) {
      ticketsNeeded = true;
    }
  }

  const chauffeurs = state.chauffeurSelections;
  if (chauffeurs && typeof chauffeurs === "object") {
    for (const byDate of Object.values(chauffeurs)) {
      if (byDate && Object.keys(byDate).length > 0) driverNeeded = true;
    }
  }
  const days = state.chauffeurDays;
  if (days && typeof days === "object") {
    for (const list of Object.values(days)) {
      if (Array.isArray(list) && list.length > 0) driverNeeded = true;
    }
  }

  return { ticketsNeeded, driverNeeded, guideNeeded, ticketLines };
}

export function demandFromSingleDay(
  state: Pick<
    SingleDayBuilderState,
    | "selectedExperiences"
    | "preferredMovement"
    | "guidePreference"
    | "selectedTransportProducts"
  >
): OpsDemandFlags {
  const transit = String(state.preferredMovement || "").toLowerCase();
  const guide = String(state.guidePreference || "").toLowerCase();
  const ticketLines = [...(state.selectedTransportProducts || [])];
  const ticketsNeeded =
    ticketLines.length > 0 ||
    transit.includes("suica") ||
    transit.includes("pasmo") ||
    transit.includes("ticket") ||
    transit.includes("public") ||
    transit.includes("rail") ||
    transit.includes("train") ||
    transit.includes("subway");
  const driverNeeded =
    transit.includes("private") ||
    transit.includes("chauffeur") ||
    transit.includes("driver");
  const guideNeeded =
    (state.selectedExperiences || []).length > 0 ||
    guide.includes("guide") ||
    guide.includes("private");

  return { ticketsNeeded, driverNeeded, guideNeeded, ticketLines };
}

/** Persist demand onto ops_dispatch + ops_hub + ops_tickets. */
export async function applyOpsDemandForPnr(
  pb: PocketBase,
  pnrRaw: string,
  demand: OpsDemandFlags
): Promise<void> {
  const pnr = String(pnrRaw || "")
    .trim()
    .toUpperCase();
  if (!pnr || pnr.startsWith("TMP-")) return;

  const dispatch = await ensureDispatchRow(pb, pnr);
  await pb.collection("ops_dispatch").update(
    dispatch.id,
    {
      tickets_needed: demand.ticketsNeeded,
      driver_needed: demand.driverNeeded,
      guide_needed: demand.guideNeeded,
    },
    { requestKey: null }
  );

  try {
    const hub = await pb
      .collection("ops_hub")
      .getFirstListItem(`pnr="${pnr}"`, { requestKey: null });
    await pb.collection("ops_hub").update(
      hub.id,
      {
        tickets_needed: demand.ticketsNeeded,
        driver_needed: demand.driverNeeded,
        guide_needed: demand.guideNeeded,
      },
      { requestKey: null }
    );
  } catch {
    /* hub may not exist yet */
  }

  await ensureTicketsRow(pb, pnr);
  const lines = demand.ticketLines || [];
  if (demand.ticketsNeeded) {
    const row = await ensureTicketsRow(pb, pnr);
    const cur = String(row.ticket_status || "none");
    const patch: Record<string, unknown> = {
      ticket_lines: lines,
    };
    if (cur === "none" || cur === "") {
      patch.ticket_status = "needed";
    }
    await updateTicketsByPnr(pb, pnr, patch);
  } else {
    const row = await ensureTicketsRow(pb, pnr);
    const cur = String(row.ticket_status || "none");
    if (cur === "needed" && !row.assigned_ticketer_id) {
      await updateTicketsByPnr(pb, pnr, {
        ticket_status: "none",
        ticket_lines: [],
      });
    } else if (lines.length > 0) {
      await updateTicketsByPnr(pb, pnr, { ticket_lines: lines });
    }
  }
}

export async function applyOpsDemandForPnrAdmin(
  pnrRaw: string,
  demand: OpsDemandFlags
): Promise<void> {
  try {
    const { getAdminPocketBase } = await import("@/lib/pocketbase/admin");
    const pb = await getAdminPocketBase();
    await applyOpsDemandForPnr(pb, pnrRaw, demand);
  } catch (err) {
    console.warn(
      "[ops_demand]",
      err instanceof Error ? err.message : "apply failed"
    );
  }
}
