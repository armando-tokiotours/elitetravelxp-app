/**
 * Derive Ops demand flags from guest itinerary selections.
 * Ticketer / driver / guide portals only surface jobs when needed.
 *
 * Tickets needed when:
 * - transport products / Suica / public rail picks
 * - selected experiences with access_type Ticket / Admission / VIP / Time-sensitive
 * - legacy title heuristics (teamLab, Ghibli, …) when access_type missing
 */

import type PocketBase from "pocketbase";
import type { BuilderState } from "@/store/useBuilderStore";
import type { SingleDayBuilderState } from "@/store/useSingleDayBuilderStore";
import type { TransportTicketLine } from "@/lib/transportProducts";
import {
  accessTypeNeedsTicketer,
  accessTypePurchaseMode,
  accessTypeStaffLabel,
  experienceNeedsEntryTicket,
  type ExperienceAccessTicketLine,
} from "@/lib/accessType";
import { ensureDispatchRow } from "@/lib/opsDispatch";
import { ensureTicketsRow, updateTicketsByPnr } from "@/lib/opsTickets";

export type OpsDemandFlags = {
  ticketsNeeded: boolean;
  driverNeeded: boolean;
  guideNeeded: boolean;
  ticketLines?: Array<TransportTicketLine | ExperienceAccessTicketLine>;
};

function experienceTicketLinesFromRows(
  rows: Array<{
    tourId?: string;
    title?: string;
    access_type?: string;
  }>
): ExperienceAccessTicketLine[] {
  const out: ExperienceAccessTicketLine[] = [];
  for (const e of rows) {
    const access = String(e.access_type || "").trim();
    const needs =
      accessTypeNeedsTicketer(access) ||
      experienceNeedsEntryTicket({
        title: e.title,
        access_type: access || null,
      });
    if (!needs) continue;
    const resolved =
      access ||
      (experienceNeedsEntryTicket({ title: e.title })
        ? "direct_ticket"
        : "");
    out.push({
      tourId: e.tourId,
      name: String(e.title || "Experience").trim() || "Experience",
      qty: 1,
      accessType: resolved || "direct_ticket",
      purchaseMode: accessTypePurchaseMode(resolved || "direct_ticket"),
    });
  }
  return out;
}

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
  const ticketLines: Array<TransportTicketLine | ExperienceAccessTicketLine> = [
    ...(state.selectedTransportProducts || []),
  ];
  let ticketsNeeded =
    Boolean(state.arrivalNeedsTicket) || ticketLines.length > 0;
  let driverNeeded = false;
  // Multi-day tour days always need a guide desk decision (assign / board / none).
  const guideNeeded = true;

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

  const tourRows: Array<{
    tourId?: string;
    title?: string;
    access_type?: string;
  }> = [];
  const selected = state.selectedTours || {};
  for (const list of Object.values(selected)) {
    for (const t of list || []) {
      tourRows.push({
        tourId: t.tourId,
        title: t.title,
        access_type: (t as { access_type?: string }).access_type,
      });
    }
  }
  const expLines = experienceTicketLinesFromRows(tourRows);
  if (expLines.length > 0) {
    ticketsNeeded = true;
    ticketLines.push(...expLines);
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
    | "tourHours"
  >
): OpsDemandFlags {
  const transit = String(state.preferredMovement || "").toLowerCase();
  const ticketLines: Array<TransportTicketLine | ExperienceAccessTicketLine> = [
    ...(state.selectedTransportProducts || []),
  ];
  const expLines = experienceTicketLinesFromRows(
    (state.selectedExperiences || []).map((e) => ({
      tourId: e.tourId,
      title: e.title,
      access_type: e.access_type,
    }))
  );
  if (expLines.length > 0) ticketLines.push(...expLines);

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
  // 3h / 6h / 8h (and any single-day tour) always need guide desk — Ops decides assign or not.
  const guideNeeded = true;

  return { ticketsNeeded, driverNeeded, guideNeeded, ticketLines };
}

/**
 * Look up tours.access_type for IDs missing on the client snapshot,
 * then merge into demand (heals TeamLab-style activities already booked).
 */
export async function enrichDemandFromTourCatalog(
  pb: PocketBase,
  demand: OpsDemandFlags,
  tourIds: string[]
): Promise<OpsDemandFlags> {
  const ids = [...new Set(tourIds.map((id) => String(id || "").trim()).filter(Boolean))];
  if (ids.length === 0) return demand;

  const lines = [...(demand.ticketLines || [])];
  const haveTour = new Set(
    lines
      .map((l) => String((l as ExperienceAccessTicketLine).tourId || "").trim())
      .filter(Boolean)
  );
  let ticketsNeeded = demand.ticketsNeeded;

  for (const id of ids) {
    if (haveTour.has(id)) continue;
    try {
      const tour = await pb.collection("tours").getOne<{
        id: string;
        title?: string;
        name?: string;
        access_type?: string;
        is_self_guided?: boolean;
        description?: string;
      }>(id, { requestKey: null });
      const access = String(tour.access_type || "").trim();
      const title = String(tour.title || tour.name || id).trim();
      const needs =
        accessTypeNeedsTicketer(access) ||
        experienceNeedsEntryTicket({
          title,
          description: tour.description,
          access_type: access,
          is_self_guided: tour.is_self_guided,
        });
      if (!needs) continue;
      const resolved =
        access ||
        (experienceNeedsEntryTicket({ title }) ? "direct_ticket" : "direct_ticket");
      ticketsNeeded = true;
      lines.push({
        tourId: id,
        name: `${title} · ${accessTypeStaffLabel(resolved)}`,
        qty: 1,
        accessType: resolved,
        purchaseMode: accessTypePurchaseMode(resolved),
      });
      haveTour.add(id);
    } catch {
      /* skip missing tour */
    }
  }

  return {
    ...demand,
    ticketsNeeded,
    ticketLines: lines,
  };
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
  if (!pnr) return;

  // TMP leads still get demand flags on ops_hub so Ops can assign before PNR finalizes.
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

/** Extract tour IDs from BAL selections JSON. */
export function tourIdsFromSelections(selections: unknown): string[] {
  if (!selections || typeof selections !== "object") return [];
  const s = selections as Record<string, unknown>;
  const ids: string[] = [];
  if (Array.isArray(s.selectedExperienceIds)) {
    for (const id of s.selectedExperienceIds) {
      if (id) ids.push(String(id));
    }
  }
  if (Array.isArray(s.experienceIds)) {
    for (const id of s.experienceIds) {
      if (id) ids.push(String(id));
    }
  }
  if (Array.isArray(s.experienceSchedule)) {
    for (const row of s.experienceSchedule) {
      const tid = (row as { tourId?: string })?.tourId;
      if (tid) ids.push(String(tid));
    }
  }
  return [...new Set(ids)];
}
