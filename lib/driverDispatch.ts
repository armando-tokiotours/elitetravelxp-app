/**
 * Per-leg driver / transit dispatch for Ops Tab 4.
 *
 * Legs are derived from invoice cart (`ops_hub.extras.agent_services`) via
 * `isTransitServiceItem`. Assignment state lives in
 * `ops_hub.extras.driver_dispatch` (no separate dead-end collection).
 * PNR-level driver board still uses `ops_dispatch` (assignDriver / postDriverBoard).
 */

import type PocketBase from "pocketbase";
import {
  isActiveAgentService,
  isTransitServiceItem,
  parseOpsHubExtras,
  type ServiceLineItem,
} from "@/lib/agentServices";
import {
  formatGuideJobDateLabel,
  normalizeTourDateIso,
  servicesFromHub,
} from "@/lib/guideJobs";
import {
  assignDriver,
  postDriverBoard,
  type OpsDispatchRow,
} from "@/lib/opsDispatch";
import { invoiceVehicleDisplayName } from "@/lib/builder-pricing";
import { calculateTransferVehicle } from "@/lib/transferVehicle";
import type { OpsHubRow } from "@/components/staff/opsHubClient";
import type { OpsGuestRequirements } from "@/lib/opsGuestRequirements";

export type DriverLegStatus = "UNASSIGNED" | "ASSIGNED" | "OPEN_BOARD";

export type DriverDispatchLegSaved = {
  serviceLineId: string;
  pickup?: string;
  dropoff?: string;
  assignedDriverId?: string;
  assignedDriverName?: string;
  status?: DriverLegStatus | string;
  vehicleTier?: string;
  updatedAt?: string;
};

export type DriverDispatchLeg = {
  id: string;
  serviceLineId: string;
  title: string;
  category: string;
  serviceDate: string;
  dayLabel: string;
  city: string;
  pax: number;
  priceEur: number;
  vehicleTier: string;
  pickup: string;
  dropoff: string;
  assignedDriverId: string;
  assignedDriverName: string;
  status: DriverLegStatus;
};

/**
 * Strip Suica / PASMO preload wording from driver-facing titles.
 * Suica is Ticketer-only — Mix cart lines often embed it in the chauffeur label.
 */
export function stripSuicaFromDriverTitle(title: string): string {
  let t = String(title || "").trim();
  if (!t) return "Private chauffeur / transfer";

  t = t.replace(
    /\s*\+\s*Suica\s*\/?\s*PASMO\s*preload[^(]*(\([^)]*\))?/gi,
    ""
  );
  t = t.replace(/\s*\+\s*Suica\s+preload[^(]*(\([^)]*\))?/gi, "");
  t = t.replace(
    /\s*Suica\s*\/?\s*PASMO\s*preload[^(]*(\([^)]*\))?/gi,
    ""
  );
  t = t.replace(/\s*Suica\s+preload[^(]*(\([^)]*\))?/gi, "");
  t = t.replace(/\s*\+\s*Suica\b[^(]*(\([^)]*\))?/gi, "");
  t = t.replace(/\bSuica\s*\/?\s*PASMO\b[^(]*(\([^)]*\))?/gi, "");
  t = t.replace(/\bSuica\b[^(]*(\([^)]*\))?/gi, "");

  t = t.replace(/\s*[+·,]\s*$/g, "");
  t = t.replace(/^\s*[+·,]\s*/g, "");
  t = t.replace(/\s{2,}/g, " ").trim();

  return t || "Private chauffeur / transfer";
}

/** € amount for Suica preload when embedded in a Mix / transit title (for price cleanup). */
export function suicaEurEmbeddedInTitle(title: string): number {
  const raw = String(title || "");
  const withQty = raw.match(/Suica[^€]*€\s*([\d.,]+)\s*[x×]\s*(\d+)/i);
  if (withQty) {
    const per = Number(String(withQty[1]).replace(/,/g, ""));
    const qty = Number(withQty[2]);
    if (Number.isFinite(per) && Number.isFinite(qty)) {
      return Math.max(0, Math.round(per * qty));
    }
  }
  const solo = raw.match(/Suica[^€]*€\s*([\d.,]+)/i);
  if (solo) {
    const n = Number(String(solo[1]).replace(/,/g, ""));
    if (Number.isFinite(n)) return Math.max(0, Math.round(n));
  }
  return 0;
}

/**
 * Default PICKUP from guest logistics: hub notes → meeting point → hotel.
 * Placeholders from Language & Meeting Point still count — drivers need a start point.
 */
export function defaultDriverPickup(opts: {
  reqs?: OpsGuestRequirements | null;
  hub?: OpsHubRow | null;
}): string {
  const hubNotes = String(opts.hub?.pickup_notes || "").trim();
  if (hubNotes) return hubNotes;

  const name = String(opts.reqs?.meetingPointName || "").trim();
  const addr = String(opts.reqs?.meetingPointAddress || "").trim();
  const meeting = [name, addr]
    .filter((p) => p && p !== "—")
    .join(" — ");
  if (meeting) return meeting;

  const hotel = String(opts.reqs?.itineraryStops?.[0]?.hotelLabel || "").trim();
  if (hotel && hotel !== "Unset" && hotel !== "—") return hotel;

  return "";
}

function safePnr(pnr: string): string {
  return String(pnr || "")
    .trim()
    .toUpperCase()
    .replace(/"/g, "");
}

function rawExtrasObject(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

export function parseDriverDispatchLegs(
  raw: unknown
): DriverDispatchLegSaved[] {
  const obj = rawExtrasObject(raw);
  const list = Array.isArray(obj.driver_dispatch) ? obj.driver_dispatch : [];
  const out: DriverDispatchLegSaved[] = [];
  for (const row of list) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const serviceLineId = String(r.serviceLineId || r.service_line_id || "").trim();
    if (!serviceLineId) continue;
    out.push({
      serviceLineId,
      pickup: String(r.pickup || "").trim(),
      dropoff: String(r.dropoff || "").trim(),
      assignedDriverId: String(
        r.assignedDriverId || r.assigned_driver_id || ""
      ).trim(),
      assignedDriverName: String(
        r.assignedDriverName || r.assigned_driver_name || ""
      ).trim(),
      status: String(r.status || "UNASSIGNED").trim(),
      vehicleTier: String(r.vehicleTier || r.vehicle_tier || "").trim(),
      updatedAt: String(r.updatedAt || "").trim() || undefined,
    });
  }
  return out;
}

export function normalizeDriverLegStatus(
  raw?: string | null
): DriverLegStatus {
  const v = String(raw || "")
    .trim()
    .toUpperCase();
  if (v === "ASSIGNED" || v === "OPEN_BOARD" || v === "UNASSIGNED") return v;
  if (v === "DIRECT" || v === "CLAIMED" || v === "OFFERED") return "ASSIGNED";
  if (v === "OPEN") return "OPEN_BOARD";
  return "UNASSIGNED";
}

/** Infer vehicle tier from line title text, else party-size catalog heuristic. */
export function inferVehicleTierHint(
  title: string,
  pax: number
): string {
  const t = String(title || "").toLowerCase();
  if (t.includes("alphard")) return "Toyota Alphard (7-seater luxury van)";
  if (t.includes("hiace") || t.includes("grand cabin")) {
    return "Toyota HiAce Grand Cabin (14-seater)";
  }
  if (t.includes("minibus") || t.includes("bus")) {
    return "Minibus / coach";
  }
  if (t.includes("sedan") || t.includes("crown")) return "Standard Sedan";
  if (t.includes("minivan") || t.includes("mpv")) return "Minivan / MPV";
  if (t.includes("van") && !t.includes("private van full")) {
    return calculateTransferVehicle(pax).label;
  }
  const fromPax = invoiceVehicleDisplayName(Math.max(1, pax));
  if (fromPax && fromPax !== "—") return fromPax;
  return calculateTransferVehicle(Math.max(1, pax)).label;
}

export function filterTransitCartItems(
  services: ServiceLineItem[] | null | undefined
): ServiceLineItem[] {
  // Bonus / gift lines stay on Ticketer / cart — never on Driver Dispatch.
  return (services || []).filter(
    (item) =>
      isActiveAgentService(item) &&
      isTransitServiceItem(item) &&
      !item.isBonus
  );
}

function resolveLegDate(
  item: ServiceLineItem,
  hubDate?: string | null
): string {
  return (
    normalizeTourDateIso(item.serviceDate) ||
    normalizeTourDateIso(item.scheduledDate) ||
    normalizeTourDateIso(hubDate) ||
    ""
  );
}

function resolvePax(
  item: ServiceLineItem,
  fallbackPax: number
): number {
  const qty = Math.max(0, Math.round(Number(item.quantity) || 0));
  if (qty > 1) return qty;
  return Math.max(1, fallbackPax);
}

/**
 * Build day-by-day driver cards from cart chauffeur / transfer / vehicle lines.
 * Excludes bonus gifts and strips Suica wording (Ticketer-only).
 */
export function buildDriverDispatchLegs(opts: {
  hub: OpsHubRow;
  services?: ServiceLineItem[] | null;
  paxCount?: number;
  dispatch?: OpsDispatchRow | null;
  /** Prefill empty pickup from Language & Meeting Point / hotel logistics. */
  defaultPickup?: string | null;
  /** Optional city label (hub.primary_city / guest logistics). */
  city?: string | null;
  reqs?: OpsGuestRequirements | null;
}): DriverDispatchLeg[] {
  const services = opts.services ?? servicesFromHub(opts.hub);
  const transit = filterTransitCartItems(services);
  const saved = parseDriverDispatchLegs(opts.hub.extras);
  const byId = new Map(saved.map((s) => [s.serviceLineId, s]));
  const fallbackPax = Math.max(1, Math.round(Number(opts.paxCount) || 1));
  const defaultPickup =
    String(opts.defaultPickup || "").trim() ||
    defaultDriverPickup({ reqs: opts.reqs, hub: opts.hub });
  const city =
    String(opts.city || "").trim() ||
    String(opts.hub.primary_city || "").trim() ||
    String(opts.reqs?.itineraryStops?.[0]?.cityName || "").trim();

  const legs = transit.map((item, index) => {
    const prev = byId.get(item.id);
    const serviceDate = resolveLegDate(item, opts.hub.tour_date);
    const pax = resolvePax(item, fallbackPax);
    const rawTitle = String(item.title || "").trim();
    const title = stripSuicaFromDriverTitle(rawTitle);
    const vehicleTier =
      String(prev?.vehicleTier || "").trim() ||
      inferVehicleTierHint(rawTitle || title, pax);
    const assignedDriverId = String(prev?.assignedDriverId || "").trim();
    const assignedDriverName = String(prev?.assignedDriverName || "").trim();
    let status = normalizeDriverLegStatus(prev?.status);
    if (assignedDriverId && status === "UNASSIGNED") status = "ASSIGNED";
    if (!assignedDriverId && status === "ASSIGNED") status = "UNASSIGNED";

    const rawPrice = Math.max(0, Math.round(Number(item.finalPriceEur) || 0));
    const suicaEur = suicaEurEmbeddedInTitle(rawTitle);
    const priceEur = Math.max(0, rawPrice - suicaEur);

    const savedPickup = String(prev?.pickup || "").trim();

    return {
      id: item.id || `transit-${index}`,
      serviceLineId: item.id,
      title,
      category: String(item.category || "TRANSPORT"),
      serviceDate,
      dayLabel: formatGuideJobDateLabel(serviceDate),
      city,
      pax,
      priceEur,
      vehicleTier,
      pickup: savedPickup || defaultPickup,
      dropoff: String(prev?.dropoff || "").trim(),
      assignedDriverId,
      assignedDriverName,
      status,
    } satisfies DriverDispatchLeg;
  });

  return legs.sort((a, b) => {
    const da = a.serviceDate || "";
    const db = b.serviceDate || "";
    if (da !== db) return da.localeCompare(db);
    return a.title.localeCompare(b.title);
  });
}

function mergeDriverDispatchIntoExtras(
  existing: unknown,
  legs: DriverDispatchLegSaved[]
): Record<string, unknown> {
  const base = rawExtrasObject(existing);
  const parsed = parseOpsHubExtras(existing);
  return {
    ...base,
    agent_services: parsed.agent_services || base.agent_services || [],
    final_approved_price:
      parsed.final_approved_price ?? base.final_approved_price ?? null,
    price_mode: parsed.price_mode ?? base.price_mode,
    pending_discount_request:
      parsed.pending_discount_request ?? base.pending_discount_request ?? null,
    driver_dispatch: legs,
  };
}

async function loadHubByPnr(
  pb: PocketBase,
  pnrRaw: string
): Promise<OpsHubRow> {
  const pnr = safePnr(pnrRaw);
  return pb.collection("ops_hub").getFirstListItem<OpsHubRow>(`pnr="${pnr}"`, {
    requestKey: null,
  });
}

/** Persist one leg’s pickup/dropoff/driver into ops_hub.extras.driver_dispatch. */
export async function saveDriverLegAssignment(
  pb: PocketBase,
  opts: {
    pnr: string;
    leg: Pick<
      DriverDispatchLeg,
      | "serviceLineId"
      | "pickup"
      | "dropoff"
      | "assignedDriverId"
      | "assignedDriverName"
      | "vehicleTier"
      | "status"
    >;
    byStaffId?: string;
    /** Also roll up to PNR-level ops_dispatch when a driver is set. */
    syncDispatchBoard?: boolean;
  }
): Promise<DriverDispatchLegSaved[]> {
  const hub = await loadHubByPnr(pb, opts.pnr);
  const prev = parseDriverDispatchLegs(hub.extras);
  const status = normalizeDriverLegStatus(
    opts.leg.status ||
      (opts.leg.assignedDriverId ? "ASSIGNED" : "UNASSIGNED")
  );
  const nextRow: DriverDispatchLegSaved = {
    serviceLineId: opts.leg.serviceLineId,
    pickup: String(opts.leg.pickup || "").trim(),
    dropoff: String(opts.leg.dropoff || "").trim(),
    assignedDriverId: String(opts.leg.assignedDriverId || "").trim(),
    assignedDriverName: String(opts.leg.assignedDriverName || "").trim(),
    vehicleTier: String(opts.leg.vehicleTier || "").trim(),
    status,
    updatedAt: new Date().toISOString(),
  };
  const others = prev.filter((r) => r.serviceLineId !== nextRow.serviceLineId);
  const next = [...others, nextRow];
  const extras = mergeDriverDispatchIntoExtras(hub.extras, next);

  const patch: Record<string, unknown> = {
    extras,
    driver_needed: true,
  };
  // Surface first non-empty pickup into hub notes for driver portal legacy view
  const pickupNote = nextRow.pickup;
  if (pickupNote && !String(hub.pickup_notes || "").trim()) {
    patch.pickup_notes = pickupNote;
  }

  await pb.collection("ops_hub").update(hub.id, patch, { requestKey: null });

  if (opts.syncDispatchBoard !== false) {
    if (nextRow.assignedDriverId) {
      await assignDriver(pb, {
        pnr: opts.pnr,
        staffId: nextRow.assignedDriverId,
        staffName: nextRow.assignedDriverName || "Driver",
        byStaffId: opts.byStaffId,
      });
    }
  }

  return next;
}

/** Mark leg open on board + post PNR to existing ops_dispatch driver board. */
export async function postDriverLegToBoard(
  pb: PocketBase,
  opts: {
    pnr: string;
    leg: Pick<
      DriverDispatchLeg,
      | "serviceLineId"
      | "pickup"
      | "dropoff"
      | "vehicleTier"
    >;
    byStaffId?: string;
  }
): Promise<DriverDispatchLegSaved[]> {
  const saved = await saveDriverLegAssignment(pb, {
    pnr: opts.pnr,
    byStaffId: opts.byStaffId,
    syncDispatchBoard: false,
    leg: {
      serviceLineId: opts.leg.serviceLineId,
      pickup: opts.leg.pickup,
      dropoff: opts.leg.dropoff,
      vehicleTier: opts.leg.vehicleTier,
      assignedDriverId: "",
      assignedDriverName: "",
      status: "OPEN_BOARD",
    },
  });
  await postDriverBoard(pb, {
    pnr: opts.pnr,
    byStaffId: opts.byStaffId,
  });
  return saved;
}

/** Clear per-leg driver assignment (keeps pickup / drop-off / vehicle). */
export async function clearDriverLeg(
  pb: PocketBase,
  opts: {
    pnr: string;
    serviceLineId: string;
    byStaffId?: string;
  }
): Promise<DriverDispatchLegSaved[]> {
  const hub = await loadHubByPnr(pb, opts.pnr);
  const prev = parseDriverDispatchLegs(hub.extras);
  const existing = prev.find((r) => r.serviceLineId === opts.serviceLineId);
  return saveDriverLegAssignment(pb, {
    pnr: opts.pnr,
    byStaffId: opts.byStaffId,
    syncDispatchBoard: false,
    leg: {
      serviceLineId: opts.serviceLineId,
      pickup: existing?.pickup || "",
      dropoff: existing?.dropoff || "",
      vehicleTier: existing?.vehicleTier || "",
      assignedDriverId: "",
      assignedDriverName: "",
      status: "UNASSIGNED",
    },
  });
}

export function formatDriverLegPriceEur(priceEur: number): string {
  return `€${Math.max(0, Math.round(priceEur)).toLocaleString("en-US")}`;
}
