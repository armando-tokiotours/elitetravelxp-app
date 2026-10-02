/** Client helper — record a successful payment into the central ledger. */

export type RecordPaymentInput = {
  pnr: string;
  kind:
    | "concierge_deposit"
    | "tour_deposit"
    | "tour_partial"
    | "tour_full"
    | "other";
  amountEur: number;
  currency?: string;
  orderId?: string | null;
  path?: string | null;
  guestEmail?: string;
  guestName?: string;
  builder?: string;
  notes?: string;
  estimatedTotalEur?: number;
};

export async function recordPaymentSuccess(
  input: RecordPaymentInput
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch("/api/payments/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pnr: input.pnr,
        kind: input.kind,
        amountEur: input.amountEur,
        currency: input.currency || "EUR",
        provider: "revolut",
        orderId: input.orderId,
        path: input.path,
        guestEmail: input.guestEmail,
        guestName: input.guestName,
        builder: input.builder,
        notes: input.notes,
        estimatedTotalEur: input.estimatedTotalEur,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      id?: string;
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, error: data.error || "Could not record payment." };
    }
    return { ok: true, id: data.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not record payment.",
    };
  }
}
