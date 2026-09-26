/**
 * ops_payouts — staff earnings per PNR (guide/driver). Separate from guest ops_money.
 */

import type PocketBase from "pocketbase";

export type PayoutStatus = "pending" | "paid" | "hold";
export type PayoutRole = "guide" | "driver";

export type OpsPayoutRow = {
  id: string;
  pnr: string;
  staff_id: string;
  staff_name?: string;
  role: PayoutRole | string;
  amount_jpy?: number;
  status?: PayoutStatus | string;
  notes?: string;
};

function safePnr(pnr: string): string {
  return String(pnr || "")
    .trim()
    .toUpperCase()
    .replace(/"/g, "");
}

export async function ensurePayout(
  pb: PocketBase,
  opts: {
    pnr: string;
    staffId: string;
    staffName?: string;
    role: PayoutRole;
    amountJpy?: number;
  }
): Promise<OpsPayoutRow> {
  const pnr = safePnr(opts.pnr);
  const staffId = String(opts.staffId || "").trim();
  if (!pnr || !staffId) throw new Error("pnr and staffId required");
  try {
    return await pb
      .collection("ops_payouts")
      .getFirstListItem<OpsPayoutRow>(
        `pnr="${pnr}" && staff_id="${staffId}" && role="${opts.role}"`,
        { requestKey: null }
      );
  } catch {
    return (await pb.collection("ops_payouts").create(
      {
        pnr,
        staff_id: staffId,
        staff_name: opts.staffName || "",
        role: opts.role,
        amount_jpy: opts.amountJpy ?? 0,
        status: "pending",
      },
      { requestKey: null }
    )) as OpsPayoutRow;
  }
}

export async function upsertPayout(
  pb: PocketBase,
  opts: {
    pnr: string;
    staffId: string;
    staffName?: string;
    role: PayoutRole;
    amountJpy?: number;
    status?: PayoutStatus;
    notes?: string;
  }
): Promise<OpsPayoutRow> {
  const row = await ensurePayout(pb, opts);
  const patch: Record<string, unknown> = {};
  if (opts.staffName !== undefined) patch.staff_name = opts.staffName;
  if (opts.amountJpy !== undefined) patch.amount_jpy = opts.amountJpy;
  if (opts.status !== undefined) patch.status = opts.status;
  if (opts.notes !== undefined) patch.notes = opts.notes;
  if (Object.keys(patch).length === 0) return row;
  return (await pb
    .collection("ops_payouts")
    .update(row.id, patch, { requestKey: null })) as OpsPayoutRow;
}

export async function loadPayoutsForStaff(
  pb: PocketBase,
  staffId: string
): Promise<OpsPayoutRow[]> {
  const id = String(staffId || "").trim();
  if (!id) return [];
  return pb.collection("ops_payouts").getFullList<OpsPayoutRow>({
    filter: `staff_id="${id}"`,
    sort: "-updated",
    requestKey: null,
  });
}

export async function loadAllPayouts(
  pb: PocketBase,
  filter?: string
): Promise<OpsPayoutRow[]> {
  return pb.collection("ops_payouts").getFullList<OpsPayoutRow>({
    filter: filter || undefined,
    sort: "-updated",
    requestKey: null,
  });
}
