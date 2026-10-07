/**
 * Payments collection helpers — authoritative cash received per PNR.
 */

import type PocketBase from "pocketbase";

export async function sumPaymentsLedgerEur(
  pb: PocketBase,
  pnr: string
): Promise<number> {
  const ref = String(pnr || "")
    .trim()
    .toUpperCase()
    .replace(/"/g, "");
  if (!ref) return 0;
  try {
    const rows = await pb.collection("payments").getFullList<{
      amount_eur?: number | string;
    }>({
      filter: `pnr="${ref}"`,
      requestKey: null,
    });
    return rows.reduce((acc, row) => {
      const n = Math.max(0, Math.round(Number(row.amount_eur) || 0));
      return acc + n;
    }, 0);
  } catch {
    return 0;
  }
}

/**
 * If ops_hub says fee was paid but payments has no concierge_deposit row,
 * backfill one so ledger sum = fee + milestones (not milestones alone).
 */
export async function ensureConciergeFeeInLedger(
  pb: PocketBase,
  pnr: string,
  feeAmountEur?: number
): Promise<void> {
  const ref = String(pnr || "")
    .trim()
    .toUpperCase()
    .replace(/"/g, "");
  if (!ref) return;
  try {
    await pb
      .collection("payments")
      .getFirstListItem(`pnr="${ref}" && kind="concierge_deposit"`, {
        requestKey: null,
      });
    return; // already present
  } catch {
    /* seed below */
  }

  let amount = Math.max(0, Math.round(Number(feeAmountEur) || 0));
  if (!(amount > 0)) {
    try {
      const hub = await pb.collection("ops_hub").getFirstListItem<{
        concierge_fee_paid?: boolean;
        concierge_fee_amount?: number | string;
        deposit_amount?: number | string;
      }>(`pnr="${ref}"`, { requestKey: null });
      if (!hub.concierge_fee_paid) return;
      amount =
        Math.max(0, Math.round(Number(hub.concierge_fee_amount) || 0)) ||
        Math.max(0, Math.round(Number(hub.deposit_amount) || 0)) ||
        60;
    } catch {
      return;
    }
  }
  if (!(amount > 0)) return;

  try {
    await pb.collection("payments").create(
      {
        pnr: ref,
        kind: "concierge_deposit",
        amount_eur: amount,
        currency: "EUR",
        provider: "system",
        order_id: "",
        notes: "Backfilled concierge deposit for ledger sync",
      },
      { requestKey: null }
    );
  } catch {
    /* optional */
  }
}

/**
 * Hard guarantee: ops_hub.total_paid_eur === sum(payments) for this PNR.
 * Call after any successful concierge_deposit / tour_partial / tour_full write.
 * Returns the authoritative ledger sum written to the hub (or computed if hub missing).
 */
export async function syncOpsHubTotalPaidFromLedger(
  pb: PocketBase,
  pnr: string,
  extraPatch?: Record<string, unknown>
): Promise<{ totalPaidEur: number; hubId?: string; synced: boolean }> {
  const ref = String(pnr || "")
    .trim()
    .toUpperCase()
    .replace(/"/g, "");
  if (!ref) return { totalPaidEur: 0, synced: false };

  // Ensure fee row exists when hub says fee paid (avoids milestone-only sums)
  await ensureConciergeFeeInLedger(pb, ref);

  const ledgerSum = await sumPaymentsLedgerEur(pb, ref);

  try {
    const hub = await pb.collection("ops_hub").getFirstListItem<{
      id: string;
      total_paid_eur?: number | string;
    }>(`pnr="${ref}"`, { requestKey: null });

    const prevPaid = Math.max(0, Math.round(Number(hub.total_paid_eur) || 0));
    // Authoritative: hub must equal ledger. Never leave a lower stale fee-only total.
    const totalPaidEur = ledgerSum;

    if (totalPaidEur !== prevPaid || extraPatch) {
      await pb.collection("ops_hub").update(
        hub.id,
        {
          ...(extraPatch || {}),
          total_paid_eur: totalPaidEur,
          is_read: false,
        },
        { requestKey: null }
      );
    }

    return { totalPaidEur, hubId: hub.id, synced: true };
  } catch {
    return { totalPaidEur: ledgerSum, synced: false };
  }
}
