"use client";

import { useCallback, useEffect, useState } from "react";
import type PocketBase from "pocketbase";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import { toCanonicalStatus } from "@/lib/bookingStatus";

export type OpsHubRow = {
  id: string;
  pnr: string;
  source?: string;
  detail_collection?: string;
  detail_id?: string;
  status?: string;
  primary_city?: string;
  tour_date?: string;
  guest_summary?: string;
  assigned_guide?: string;
  assigned_driver?: string;
  assigned_guide_id?: string;
  assigned_driver_id?: string;
  assigned_ticketer_id?: string;
  assigned_agent_id?: string;
  assigned_agent?: string;
  /** Concierge agent accept: none | pending | accepted */
  agent_response?: string;
  ticket_status?: string;
  ticket_notes?: string;
  pickup_notes?: string;
  special_requests?: unknown;
  guide_pay_jpy?: number;
  driver_pay_jpy?: number;
  ticket_cost_jpy?: number;
  tour_count?: number;
  tickets_needed?: boolean;
  driver_needed?: boolean;
  guide_needed?: boolean;
  payment_confirmed?: boolean;
  /** Ops inbox: false/undefined = unread (blue dot) */
  is_read?: boolean;
  /** €60 concierge commitment fee settled */
  concierge_fee_paid?: boolean;
  /** Amount of concierge fee credited (€) */
  concierge_fee_amount?: number;
  /** UNPAID | FEE_PAID | PARTIALLY_PAID | FULLY_PAID */
  tour_payment_status?: string;
  /** Cumulative EUR paid (fee + progress + full) */
  total_paid_eur?: number;
  /** Cached package estimate for pending balance */
  estimated_total_eur?: number;
  /** Scheduled draft follow-up (YYYY-MM-DD) */
  followup_date?: string;
  /** Temporary ticketer → guest direct chat */
  ticketer_direct_chat_enabled?: boolean;
  /** Temporary driver → guest direct chat */
  driver_direct_chat_enabled?: boolean;
  /** Agent custom services / bonuses / approved price JSON */
  extras?: unknown;
  deposit_amount?: number;
  /** Staff id of last CRM touch */
  last_action_by?: string;
  /** ISO date of last CRM touch */
  last_action_date?: string;
  /** Trip end (for Post-Tour). Falls back to tour_date when empty. */
  end_date?: string;
  /** Concierge marked client final briefing sent */
  client_briefing_sent?: boolean;
  /** PocketBase system field */
  updated?: string;
  created?: string;
};

export type StaffOption = {
  id: string;
  email: string;
  name?: string;
  role?: string;
  /** Profile photo URL (e.g. /api/staff/avatar/[id]?v=…) when staff_profiles.photo is set. */
  avatarUrl?: string;
  photoUrl?: string;
  /** Raw staff_profiles.photo filename, when loaded. */
  photo?: string;
};

/** Attach /api/staff/avatar URLs from staff_profiles.photo (GuideDispatchTab pattern). */
async function enrichStaffOptionsWithAvatars(
  pb: PocketBase,
  list: StaffOption[]
): Promise<StaffOption[]> {
  if (!list.length) return list;
  try {
    const profiles = await pb
      .collection("staff_profiles")
      .getFullList<{ staff_id?: string; photo?: string }>({
        requestKey: null,
      })
      .catch(() => []);
    const photoByStaff = new Map<string, string>();
    for (const sp of profiles) {
      const sid = String(sp.staff_id || "").trim();
      const file = String(sp.photo || "").trim();
      if (!sid || !file) continue;
      photoByStaff.set(
        sid,
        `/api/staff/avatar/${encodeURIComponent(sid)}?v=${encodeURIComponent(file)}`
      );
    }
    if (!photoByStaff.size) return list;
    return list.map((s) => {
      const avatarUrl =
        String(s.avatarUrl || s.photoUrl || "").trim() ||
        photoByStaff.get(s.id);
      return avatarUrl ? { ...s, avatarUrl } : s;
    });
  } catch {
    return list;
  }
}

export async function loadOpsHub(
  pb: PocketBase,
  filter?: string
): Promise<OpsHubRow[]> {
  return pb.collection("ops_hub").getFullList<OpsHubRow>({
    sort: "-created,-updated",
    filter: filter || undefined,
    requestKey: null,
  });
}

export async function loadStaffByRole(
  pb: PocketBase,
  role: "guide" | "driver" | "ticketer" | "agent" | "ops" | "owner"
): Promise<StaffOption[]> {
  try {
    return await pb.collection("staff").getFullList<StaffOption>({
      filter: `role="${role}" && active != false`,
      sort: "name,email",
      requestKey: null,
    });
  } catch {
    return [];
  }
}

/** Agent + Ops + Owner staff for booking in-charge assignment. */
export async function loadAssignableConciergeStaff(
  pb: PocketBase
): Promise<StaffOption[]> {
  try {
    const list = await pb.collection("staff").getFullList<StaffOption>({
      filter:
        `(role="agent" || role="ops" || role="owner") && active != false`,
      sort: "name,email",
      requestKey: null,
    });
    return enrichStaffOptionsWithAvatars(pb, list);
  } catch {
    // Fallback: role filter may fail on older schemas — merge per-role lists
    const [agents, ops, owners] = await Promise.all([
      loadStaffByRole(pb, "agent"),
      loadStaffByRole(pb, "ops"),
      loadStaffByRole(pb, "owner"),
    ]);
    const byId = new Map<string, StaffOption>();
    for (const s of [...agents, ...ops, ...owners]) {
      if (s?.id) byId.set(s.id, s);
    }
    const merged = Array.from(byId.values()).sort((a, b) =>
      String(a.name || a.email || "").localeCompare(
        String(b.name || b.email || "")
      )
    );
    return enrichStaffOptionsWithAvatars(pb, merged);
  }
}

export function OpsStatusBadge({
  status,
  compact = false,
  surface = "dark",
}: {
  status?: string;
  /** Smaller sizing for Ops sidebar list cards only */
  compact?: boolean;
  /** Cream list rows need darker badge text; dark is the default elsewhere */
  surface?: "dark" | "cream";
}) {
  const canonical = toCanonicalStatus(status || "draft");
  const label = canonical.replace(/_/g, " ");
  const onCream = surface === "cream";
  const tone =
    canonical === "draft"
      ? onCream
        ? "border-slate-300 bg-slate-100 text-slate-600"
        : "border-gray-500/30 bg-gray-500/20 text-gray-400"
      : canonical === "incoming"
        ? onCream
          ? "border-amber-700/35 bg-amber-100 text-amber-900"
          : "border-amber-500/30 bg-amber-500/20 text-amber-300"
        : canonical === "cancelled"
          ? onCream
            ? "border-red-600/40 bg-red-50 text-red-700"
            : "border-red-500/40 bg-red-500/20 text-red-300"
          : canonical === "confirmed" ||
              canonical === "in_ops" ||
              canonical === "done"
            ? onCream
              ? "border-emerald-700/35 bg-emerald-50 text-emerald-800"
              : "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
            : onCream
              ? "border-slate-300 bg-slate-100 text-slate-600"
              : "border-zinc-700 bg-zinc-900 text-zinc-400";
  const size = compact
    ? "px-1 py-0.5 text-[7.5px]"
    : "px-2 py-0.5 text-[10px]";
  return (
    <span
      className={`rounded-md border tracking-wider uppercase ${size} ${tone}`}
    >
      {label}
    </span>
  );
}

export function useOpsHubList(
  getClient: () => PocketBase,
  filter?: string | (() => string | undefined)
) {
  const [rows, setRows] = useState<OpsHubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pb = getClient();
      const f = typeof filter === "function" ? filter() : filter;
      setRows(await loadOpsHub(pb, f));
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setLoading(false);
    }
  }, [getClient, filter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Live inbox: create / update / delete on ops_hub (read dots, new leads, status)
  useEffect(() => {
    const pb = getClient();
    let unsub: (() => void) | undefined;
    void pb
      .collection("ops_hub")
      .subscribe("*", (e) => {
        const record = e.record as unknown as OpsHubRow;
        if (!record?.id) return;
        setRows((prev) => {
          if (e.action === "create") {
            if (prev.some((r) => r.id === record.id)) {
              return prev.map((r) =>
                r.id === record.id ? { ...r, ...record } : r
              );
            }
            return [record, ...prev];
          }
          if (e.action === "update") {
            const exists = prev.some((r) => r.id === record.id);
            if (!exists) return [record, ...prev];
            return prev.map((r) =>
              r.id === record.id ? { ...r, ...record } : r
            );
          }
          if (e.action === "delete") {
            return prev.filter((r) => r.id !== record.id);
          }
          return prev;
        });
      })
      .then((u) => {
        unsub = u;
      })
      .catch(() => {
        /* realtime optional if PB realtime disabled */
      });

    return () => {
      try {
        unsub?.();
      } catch {
        /* ignore */
      }
      void pb.collection("ops_hub").unsubscribe("*").catch(() => {});
    };
  }, [getClient]);

  return { rows, loading, error, reload, setRows };
}
