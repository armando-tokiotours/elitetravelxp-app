/**
 * Silo 3 ops_money pocket — owner pay + guest deposit/refund by PNR.
 */

import type PocketBase from "pocketbase";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";

export type GuestPayStatus =
  | "unpaid"
  | "deposit_10"
  | "deposit_30"
  | "paid"
  | "refunded"
  | "partial_refund";

export type OpsMoneyRow = {
  id: string;
  pnr: string;
  guide_pay_jpy?: number;
  driver_pay_jpy?: number;
  ticket_cost_jpy?: number;
  tour_count?: number;
  guest_pay_status?: GuestPayStatus | string;
  guest_paid_jpy?: number;
  guest_refund_jpy?: number;
  notes?: string;
  assigned_guide?: string;
};

function safePnr(pnr: string): string {
  return String(pnr || "")
    .trim()
    .toUpperCase()
    .replace(/"/g, "");
}

export async function ensureMoneyRow(
  pb: PocketBase,
  pnrRaw: string
): Promise<OpsMoneyRow> {
  const pnr = safePnr(pnrRaw);
  if (!pnr) throw new Error("pnr required");
  try {
    return await pb
      .collection("ops_money")
      .getFirstListItem<OpsMoneyRow>(`pnr="${pnr}"`, { requestKey: null });
  } catch {
    return (await pb.collection("ops_money").create(
      {
        pnr,
        guest_pay_status: "unpaid",
        guide_pay_jpy: 0,
        driver_pay_jpy: 0,
        ticket_cost_jpy: 0,
        tour_count: 0,
        guest_paid_jpy: 0,
        guest_refund_jpy: 0,
      },
      { requestKey: null }
    )) as OpsMoneyRow;
  }
}

export async function updateMoneyByPnr(
  pb: PocketBase,
  pnrRaw: string,
  patch: Partial<
    Omit<OpsMoneyRow, "id" | "pnr">
  >
): Promise<OpsMoneyRow> {
  const row = await ensureMoneyRow(pb, pnrRaw);
  return (await pb
    .collection("ops_money")
    .update(row.id, patch, { requestKey: null })) as OpsMoneyRow;
}

export async function loadAllMoney(
  pb: PocketBase
): Promise<OpsMoneyRow[]> {
  return pb.collection("ops_money").getFullList<OpsMoneyRow>({
    sort: "-updated",
    requestKey: null,
  });
}

export async function ensureMoneyForPnrAdmin(pnrRaw: string): Promise<void> {
  try {
    const pb = await getAdminPocketBase();
    await ensureMoneyRow(pb, pnrRaw);
  } catch (err) {
    console.warn(
      "[ops_money]",
      err instanceof Error ? err.message : "ensure failed"
    );
  }
}
