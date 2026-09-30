/**
 * Derive Ops demand flags from guest itinerary selections.
 * Ticketer / driver / guide portals only surface jobs when needed.
 */

import type PocketBase from "pocketbase";
import type { BuilderState } from "@/store/useBuilderStore";
import type { SingleDayBuilderState } from "@/store/useSingleDayBuilderStore";
import { ensureDispatchRow } from "@/lib/opsDispatch";
import { ensureTicketsRow, updateTicketsByPnr } from "@/lib/opsTickets";

export type OpsDemandFlags = {
  ticketsNeeded: boolean;
  driverNeeded: boolean;
  guideNeeded: boolean;
};

export function demandFromMultiDay(
  state: Pick<
    BuilderState,
    | "locations"
    | "selectedTours"
    | "arrivalNeedsTicket"
    | "chauffeurSelections"
    | "chauffeurDays"
  >
): OpsDemandFlags {
  const locations = state.locations || [];
  let ticketsNeeded = Boolean(state.arrivalNeedsTicket);
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

  return { ticketsNeeded, driverNeeded, guideNeeded };
}

export function demandFromSingleDay(
  state: Pick<
    SingleDayBuilderState,
    "selectedExperiences" | "preferredMovement" | "guidePreference"
  >
): OpsDemandFlags {
  const transit = String(state.preferredMovement || "").toLowerCase();
  const guide = String(state.guidePreference || "").toLowerCase();
  const ticketsNeeded =
    transit.includes("suica") ||
    transit.includes("pasmo") ||
    transit.includes("ticket") ||
    transit.includes("public") ||
    transit.includes("rail") ||
    transit.includes("train");
  const driverNeeded =
    transit.includes("private") ||
    transit.includes("chauffeur") ||
    transit.includes("driver");
  const guideNeeded =
    (state.selectedExperiences || []).length > 0 ||
    guide.includes("guide") ||
    guide.includes("private");

  return { ticketsNeeded, driverNeeded, guideNeeded };
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
  if (demand.ticketsNeeded) {
    const row = await ensureTicketsRow(pb, pnr);
    const cur = String(row.ticket_status || "none");
    if (cur === "none" || cur === "") {
      await updateTicketsByPnr(pb, pnr, { ticket_status: "needed" });
    }
  } else {
    const row = await ensureTicketsRow(pb, pnr);
    const cur = String(row.ticket_status || "none");
    if (cur === "needed" && !row.assigned_ticketer_id) {
      await updateTicketsByPnr(pb, pnr, { ticket_status: "none" });
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
