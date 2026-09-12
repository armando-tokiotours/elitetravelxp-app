import { getPocketBase } from "@/lib/pocketbase/client";
import type { QuoteResult } from "@/lib/builder-pricing";
import type { BuilderState } from "@/store/useBuilderStore";

export interface BookingRequestResult {
  id: string;
  reference: string;
}

function makeReference(arrivalDate: string | null): string {
  const y = arrivalDate?.slice(0, 4) || String(new Date().getFullYear());
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `JPN-${y}-${suffix}`;
}

/** Persist full builder snapshot as a deposit / booking request. */
export async function submitBookingRequest(opts: {
  state: BuilderState;
  quote: QuoteResult | null;
  departureDate: string | null;
  contactEmail?: string;
}): Promise<BookingRequestResult> {
  const { state, quote, departureDate, contactEmail } = opts;
  const pb = getPocketBase();
  const reference = makeReference(state.arrivalDate);

  const record = await pb.collection("booking_requests").create({
    reference,
    status: "pending_deposit",
    guest_label: `${state.adults} adults, ${state.children} children`,
    adults: state.adults,
    children: state.children,
    arrival_date: state.arrivalDate || "",
    departure_date: departureDate || "",
    quote_min: quote?.min ?? 0,
    quote_max: quote?.max ?? 0,
    contact_email: contactEmail || "",
    payload: {
      ...state,
      departureDate,
      quote,
      submittedAt: new Date().toISOString(),
    },
  });

  return { id: record.id, reference: record.reference || reference };
}
