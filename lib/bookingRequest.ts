import type { QuoteResult } from "@/lib/builder-pricing";
import type { BuilderState } from "@/store/useBuilderStore";
import { generateConfirmedPNR } from "@/utils/pnr";

export interface BookingRequestResult {
  id: string;
  reference: string;
}

/** Persist full builder snapshot via server upsert (admin PocketBase). */
export async function submitBookingRequest(opts: {
  state: BuilderState;
  quote: QuoteResult | null;
  departureDate: string | null;
  contactEmail?: string;
  contactName?: string;
  contactPhone?: string;
  depositPercent?: number;
  depositMin?: number;
  depositMax?: number;
  /** Prefer an already-issued reference (e.g. from Revolut checkout). */
  reference?: string;
  payment?: {
    paymentType?: string;
    amountPaid?: number;
    currency?: string;
    orderId?: string | null;
    provider?: string;
  };
}): Promise<BookingRequestResult> {
  const {
    state,
    quote,
    departureDate,
    contactEmail,
    contactName,
    contactPhone,
    depositPercent = 10,
    depositMin,
    depositMax,
    reference: preferredRef,
    payment,
  } = opts;

  const resolvedDepositMin =
    depositMin ?? (quote ? Math.round(quote.min * (depositPercent / 100)) : 0);
  const resolvedDepositMax =
    depositMax ?? (quote ? Math.round(quote.max * (depositPercent / 100)) : 0);

  const res = await fetch("/api/itinerary/upsert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      state,
      quote,
      departureDate,
      contactEmail,
      contactName,
      contactPhone,
      depositPercent,
      depositMin: resolvedDepositMin,
      depositMax: resolvedDepositMax,
      reference: preferredRef?.trim() || generateConfirmedPNR(),
      payment: payment ?? null,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || "Could not save booking request.");
  }

  return {
    id: String(data.id || ""),
    reference: String(data.reference || preferredRef || ""),
  };
}
