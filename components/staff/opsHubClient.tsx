"use client";

import { useCallback, useEffect, useState } from "react";
import type PocketBase from "pocketbase";
import { formatPbError } from "@/lib/pocketbase/admin-schema";

export type OpsHubRow = {
  id: string;
  pnr: string;
  source?: string;
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
  ticket_status?: string;
  ticket_notes?: string;
  pickup_notes?: string;
  guide_pay_jpy?: number;
  driver_pay_jpy?: number;
  ticket_cost_jpy?: number;
  tour_count?: number;
};

export type StaffOption = {
  id: string;
  email: string;
  name?: string;
  role?: string;
};

export async function loadOpsHub(
  pb: PocketBase,
  filter?: string
): Promise<OpsHubRow[]> {
  return pb.collection("ops_hub").getFullList<OpsHubRow>({
    sort: "-tour_date,-updated",
    filter: filter || undefined,
    requestKey: null,
  });
}

export async function loadStaffByRole(
  pb: PocketBase,
  role: "guide" | "driver" | "ticketer" | "agent"
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

export function OpsStatusBadge({ status }: { status?: string }) {
  const s = status || "incoming";
  return (
    <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400">
      {s}
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

  return { rows, loading, error, reload, setRows };
}
