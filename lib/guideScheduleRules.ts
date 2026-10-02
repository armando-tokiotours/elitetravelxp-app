/**
 * Guide daily workload / schedule overlap rules for Ops dispatch.
 * Cap: 9h/day. Second booking only for night tours ≤ 3h within the cap.
 */

import type PocketBase from "pocketbase";
import { normalizeGuideConfirmStatus } from "@/lib/guideConfirmStatus";

export type GuideDayBooking = {
  pnr: string;
  guideId: string;
  startDate: string; // YYYY-MM-DD
  hours: number;
  isNightTour: boolean;
  guideStatus: string;
};

export type GuideWorkloadResult = {
  canAssign: boolean;
  totalHoursToday: number;
  existingHoursToday: number;
  conflictingPnrs: string[];
  reason: string | null;
};

const DAY_CAP_HOURS = 9;
const NIGHT_TOUR_MAX_HOURS = 3;

export function toDateKey(raw?: string | null): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function isNightTourHours(hours: number, label?: string | null): boolean {
  const h = Math.max(0, Number(hours) || 0);
  const text = String(label || "").toLowerCase();
  if (text.includes("night")) return true;
  return h > 0 && h <= NIGHT_TOUR_MAX_HOURS;
}

/**
 * Evaluate whether a guide can take another assignment on targetDate.
 * Existing bookings for the same PNR are ignored (re-assign / same tour).
 */
export function evaluateGuideWorkload(input: {
  guideId: string;
  targetDateStr: string;
  targetHours: number;
  isTargetNightTour: boolean;
  existingBookings: GuideDayBooking[];
  excludePnr?: string | null;
}): GuideWorkloadResult {
  const guideId = String(input.guideId || "").trim();
  const targetDate = toDateKey(input.targetDateStr);
  const targetHours = Math.max(0, Number(input.targetHours) || 0) || 6;
  const exclude = String(input.excludePnr || "")
    .trim()
    .toUpperCase();

  if (!guideId || !targetDate) {
    return {
      canAssign: true,
      totalHoursToday: targetHours,
      existingHoursToday: 0,
      conflictingPnrs: [],
      reason: null,
    };
  }

  const guideDayBookings = input.existingBookings.filter((b) => {
    if (String(b.guideId || "").trim() !== guideId) return false;
    if (toDateKey(b.startDate) !== targetDate) return false;
    if (exclude && String(b.pnr || "").toUpperCase() === exclude) return false;
    const status = String(b.guideStatus || "").toLowerCase();
    if (status === "refused" || status === "cancelled") return false;
    return true;
  });

  if (guideDayBookings.length === 0) {
    return {
      canAssign: true,
      totalHoursToday: targetHours,
      existingHoursToday: 0,
      conflictingPnrs: [],
      reason: null,
    };
  }

  const existingHoursToday = guideDayBookings.reduce(
    (sum, b) => sum + (Math.max(0, Number(b.hours) || 0) || 6),
    0
  );
  const newTotalHours = existingHoursToday + targetHours;
  const conflictingPnrs = guideDayBookings.map((b) =>
    String(b.pnr || "").toUpperCase()
  );

  // RULE 1: Daily working cap of 9 hours
  if (newTotalHours > DAY_CAP_HOURS) {
    return {
      canAssign: false,
      totalHoursToday: newTotalHours,
      existingHoursToday,
      conflictingPnrs,
      reason: `Exceeds 9-hour daily limit (${existingHoursToday}h booked + ${targetHours}h requested = ${newTotalHours}h). Conflict: ${conflictingPnrs.join(", ")}.`,
    };
  }

  // RULE 2: Second assignment only for night tours ≤ 3h
  if (!input.isTargetNightTour || targetHours > NIGHT_TOUR_MAX_HOURS) {
    return {
      canAssign: false,
      totalHoursToday: newTotalHours,
      existingHoursToday,
      conflictingPnrs,
      reason: `Guide already assigned to ${conflictingPnrs[0]} on this date. Second assignment is restricted to night tours ≤ ${NIGHT_TOUR_MAX_HOURS} hours (within 9h day cap).`,
    };
  }

  return {
    canAssign: true,
    totalHoursToday: newTotalHours,
    existingHoursToday,
    conflictingPnrs,
    reason: `Night tour exemption (${existingHoursToday}h day + ${targetHours}h night = ${newTotalHours}h).`,
  };
}

/**
 * Load active guide day bookings from ops_dispatch + ops_hub (+ optional hours from payouts).
 */
export async function loadGuideDayBookings(
  pb: PocketBase
): Promise<GuideDayBooking[]> {
  let dispatches: Array<{
    pnr?: string;
    assigned_guide_id?: string;
    guide_mode?: string;
    guide_response?: string;
    guide_board_visible?: boolean;
  }> = [];
  try {
    dispatches = await pb.collection("ops_dispatch").getFullList({
      filter: `assigned_guide_id != ""`,
      requestKey: null,
    });
  } catch {
    return [];
  }

  const active = dispatches.filter((d) => {
    const status = normalizeGuideConfirmStatus(d.guide_mode, {
      boardVisible: Boolean(d.guide_board_visible),
      assignedGuideId: d.assigned_guide_id,
      guideResponse: d.guide_response,
    });
    return (
      status === "guide_confirmed" ||
      status === "pending_guide_acceptance"
    );
  });
  if (active.length === 0) return [];

  const pnrs = [
    ...new Set(
      active
        .map((d) =>
          String(d.pnr || "")
            .trim()
            .toUpperCase()
        )
        .filter(Boolean)
    ),
  ];

  const hubByPnr = new Map<
    string,
    { tour_date?: string; status?: string }
  >();
  try {
    // PocketBase filter length — batch if needed
    const chunk = 40;
    for (let i = 0; i < pnrs.length; i += chunk) {
      const slice = pnrs.slice(i, i + chunk);
      const filter = slice.map((p) => `pnr="${p}"`).join(" || ");
      const hubs = await pb.collection("ops_hub").getFullList<{
        pnr?: string;
        tour_date?: string;
        status?: string;
      }>({ filter, requestKey: null });
      for (const h of hubs) {
        hubByPnr.set(String(h.pnr || "").toUpperCase(), h);
      }
    }
  } catch {
    /* hub optional */
  }

  const hoursByPnr = new Map<string, number>();
  try {
    const asg = await pb.collection("itinerary_guide_assignments").getFullList<{
      pnr?: string;
      tour_duration_hours?: number;
    }>({ requestKey: null });
    for (const a of asg) {
      const p = String(a.pnr || "")
        .trim()
        .toUpperCase();
      const h = Math.max(0, Number(a.tour_duration_hours) || 0);
      if (p && h > 0) hoursByPnr.set(p, h);
    }
  } catch {
    /* optional */
  }

  const out: GuideDayBooking[] = [];
  for (const d of active) {
    const pnr = String(d.pnr || "")
      .trim()
      .toUpperCase();
    const guideId = String(d.assigned_guide_id || "").trim();
    if (!pnr || !guideId) continue;
    const hub = hubByPnr.get(pnr);
    if (String(hub?.status || "").toLowerCase() === "cancelled") continue;
    const startDate = toDateKey(hub?.tour_date);
    if (!startDate) continue;
    const hours = hoursByPnr.get(pnr) || 6;
    const status = normalizeGuideConfirmStatus(d.guide_mode, {
      boardVisible: Boolean(d.guide_board_visible),
      assignedGuideId: d.assigned_guide_id,
      guideResponse: d.guide_response,
    });
    out.push({
      pnr,
      guideId,
      startDate,
      hours,
      isNightTour: isNightTourHours(hours),
      guideStatus: status,
    });
  }
  return out;
}
