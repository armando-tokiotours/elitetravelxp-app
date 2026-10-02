/**
 * Silo 3 ops hub — light PNR-keyed pointer + ops fields.
 * Failures are logged and swallowed so Silo 1 never breaks.
 */

import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import type { BookingLeadStatus } from "@/lib/bookingsAndLeads";
import {
  mapLeadStatusToOpsHub,
  type OpsHubStatus,
} from "@/lib/bookingStatus";

export type OpsHubSource = "direct" | "agency";

export type OpsHubDetailCollection =
  | "bookings_and_leads"
  | "agency_orders";

export type { OpsHubStatus };
export { mapLeadStatusToOpsHub };

export interface UpsertOpsHubFromDirectInput {
  pnr: string;
  detailId: string;
  status?: BookingLeadStatus | OpsHubStatus | string | null;
  primaryCity?: string | null;
  tourDate?: string | null;
  /** Inclusive trip end date (YYYY-MM-DD). Derived from duration when omitted. */
  endDate?: string | null;
  /** Used to derive endDate when endDate is missing (multi-day nights/days). */
  durationDays?: number | null;
  guestSummary?: string | null;
  /** Cached package estimate for Ops financial audit / balance settlement */
  estimatedTotalEur?: number | null;
  /**
   * When true (default on guest save), mark inbox unread so Ops re-reviews.
   * Pass false for silent admin syncs.
   */
  markUnread?: boolean;
}

function safePnr(pnr: string): string {
  return String(pnr || "")
    .trim()
    .toUpperCase()
    .replace(/"/g, "");
}

export function formatGuestSummary(guests?: {
  adults?: number;
  kids?: number;
  children?: number;
} | null): string {
  if (!guests) return "";
  const adults = Math.max(0, Number(guests.adults) || 0);
  const kids = Math.max(
    0,
    Number(guests.kids ?? guests.children) || 0
  );
  const parts: string[] = [];
  if (adults > 0) {
    parts.push(`${adults} adult${adults === 1 ? "" : "s"}`);
  }
  if (kids > 0) {
    parts.push(`${kids} kid${kids === 1 ? "" : "s"}`);
  }
  return parts.join(", ");
}

/**
 * Upsert ops_hub row for a Silo 1 (direct) bookings_and_leads record.
 * Non-blocking: returns ok:false on failure; never throws to callers who await it safely.
 */
export async function upsertOpsHubFromDirect(
  input: UpsertOpsHubFromDirectInput
): Promise<{ ok: boolean; id?: string; created?: boolean; error?: string }> {
  const pnr = safePnr(input.pnr);
  const detailId = String(input.detailId || "").trim();
  if (!pnr || !detailId) {
    return { ok: false, error: "pnr and detailId are required." };
  }

  const tourDateRaw = input.tourDate
    ? String(input.tourDate).slice(0, 10)
    : "";
  let endDateRaw = input.endDate ? String(input.endDate).slice(0, 10) : "";
  if (!endDateRaw && tourDateRaw) {
    const days = Math.max(0, Number(input.durationDays) || 0);
    if (days > 1) {
      const d = new Date(`${tourDateRaw}T12:00:00`);
      if (!Number.isNaN(d.getTime())) {
        d.setDate(d.getDate() + (days - 1));
        endDateRaw = d.toISOString().slice(0, 10);
      }
    } else {
      endDateRaw = tourDateRaw;
    }
  }

  const markUnread = input.markUnread !== false;
  const fields: Record<string, unknown> = {
    pnr,
    source: "direct" as OpsHubSource,
    detail_collection: "bookings_and_leads" as OpsHubDetailCollection,
    detail_id: detailId,
    status: mapLeadStatusToOpsHub(input.status),
    primary_city: String(input.primaryCity || "").trim() || "Tokyo",
    guest_summary: String(input.guestSummary || "").trim(),
    // Tour bookings (single 3/6/8h + multi) always need guide desk visibility.
    guide_needed: true,
  };
  if (tourDateRaw) fields.tour_date = tourDateRaw;
  if (endDateRaw) fields.end_date = endDateRaw;
  if (markUnread) fields.is_read = false;
  const estimated = Math.max(0, Math.round(Number(input.estimatedTotalEur) || 0));
  if (estimated > 0) fields.estimated_total_eur = estimated;

  try {
    const pb = await getAdminPocketBase();
    let existing: { id: string } | null = null;
    try {
      existing = await pb
        .collection("ops_hub")
        .getFirstListItem(`pnr="${pnr}"`, { requestKey: null });
    } catch {
      existing = null;
    }

    if (existing) {
      const updated = await pb
        .collection("ops_hub")
        .update(existing.id, fields, { requestKey: null });
      void ensurePocketRowsForPnr(pnr);
      return { ok: true, id: updated.id, created: false };
    }

    const created = await pb
      .collection("ops_hub")
      .create({ ...fields, is_read: false }, { requestKey: null });
    void ensurePocketRowsForPnr(pnr);
    return { ok: true, id: created.id, created: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "ops_hub upsert failed";
    console.warn("[ops_hub]", message);
    return { ok: false, error: message };
  }
}

/** Ensure Silo 3 role pockets exist for a PNR (non-blocking). */
export function ensurePocketRowsForPnr(pnr: string): void {
  void import("@/lib/opsDispatch").then(({ ensureDispatchForPnrAdmin }) =>
    ensureDispatchForPnrAdmin(pnr)
  );
  void import("@/lib/opsMoney").then(({ ensureMoneyForPnrAdmin }) =>
    ensureMoneyForPnrAdmin(pnr)
  );
  void import("@/lib/opsTickets").then(({ ensureTicketsForPnrAdmin }) =>
    ensureTicketsForPnrAdmin(pnr)
  );
}
