/**
 * Silo 3 ops hub — light PNR-keyed pointer + ops fields.
 * Failures are logged and swallowed so Silo 1 never breaks.
 */

import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import type { BookingLeadStatus } from "@/lib/bookingsAndLeads";

export type OpsHubSource = "direct" | "agency";

export type OpsHubDetailCollection =
  | "bookings_and_leads"
  | "agency_orders";

export type OpsHubStatus =
  | "incoming"
  | "quoted"
  | "confirmed"
  | "in_ops"
  | "done"
  | "cancelled";

export interface UpsertOpsHubFromDirectInput {
  pnr: string;
  detailId: string;
  status?: BookingLeadStatus | OpsHubStatus | string | null;
  primaryCity?: string | null;
  tourDate?: string | null;
  guestSummary?: string | null;
}

function safePnr(pnr: string): string {
  return String(pnr || "")
    .trim()
    .toUpperCase()
    .replace(/"/g, "");
}

/** Map bookings_and_leads lifecycle → ops_hub board status. */
export function mapLeadStatusToOpsHub(
  status?: string | null
): OpsHubStatus {
  const s = String(status || "").toLowerCase();
  if (s === "quoted") return "quoted";
  if (s === "confirmed") return "confirmed";
  if (s === "cancelled") return "cancelled";
  if (s === "in_ops" || s === "done") return s as OpsHubStatus;
  if (s === "incoming") return "incoming";
  // lead | in_progress | unknown → incoming
  return "incoming";
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
  const fields: Record<string, unknown> = {
    pnr,
    source: "direct" as OpsHubSource,
    detail_collection: "bookings_and_leads" as OpsHubDetailCollection,
    detail_id: detailId,
    status: mapLeadStatusToOpsHub(input.status),
    primary_city: String(input.primaryCity || "").trim() || "Tokyo",
    guest_summary: String(input.guestSummary || "").trim(),
  };
  if (tourDateRaw) fields.tour_date = tourDateRaw;

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
      .create(fields, { requestKey: null });
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
