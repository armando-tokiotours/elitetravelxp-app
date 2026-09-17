/** Tiered tour / experience pricing by guest count. */

export type TourPriceGuests = {
  adults: number;
  children: number;
};

/** Fields read by the pricing engine (tiered + legacy fallbacks). */
export type TourPriceSource = {
  price_1_pax?: number | null;
  price_2_pax?: number | null;
  price_3_pax?: number | null;
  price_4_pax?: number | null;
  price_extra_pax?: number | null;
  /** @deprecated removed from schema; kept for stale client caches */
  base_price?: number | null;
  price_per_person?: number | null;
  price?: number | null;
};

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? x : 0;
}

function hasTieredRates(tour: TourPriceSource): boolean {
  return (
    n(tour.price_1_pax) > 0 ||
    n(tour.price_2_pax) > 0 ||
    n(tour.price_3_pax) > 0 ||
    n(tour.price_4_pax) > 0
  );
}

/**
 * Total tour cost for the party (not per person).
 * For 5+ guests: price_4_pax + (extra × price_extra_pax).
 * Falls back to legacy per-person × pax when tier fields are empty.
 */
export function calculateTourPrice(
  guests: TourPriceGuests | number,
  tour: TourPriceSource
): number {
  const totalPax =
    typeof guests === "number"
      ? Math.max(0, Math.floor(guests))
      : Math.max(
          0,
          Math.floor(Number(guests.adults) || 0) +
            Math.floor(Number(guests.children) || 0)
        );

  if (totalPax === 0) return 0;

  if (hasTieredRates(tour)) {
    if (totalPax === 1) return n(tour.price_1_pax);
    if (totalPax === 2) return n(tour.price_2_pax);
    if (totalPax === 3) return n(tour.price_3_pax);
    if (totalPax === 4) return n(tour.price_4_pax);
    const base4 = n(tour.price_4_pax);
    const extra = n(tour.price_extra_pax);
    return base4 + (totalPax - 4) * extra;
  }

  // Legacy: single unit price was per person
  const unit = n(tour.base_price ?? tour.price_per_person ?? tour.price);
  return unit * totalPax;
}

/** Compact admin / list hint: "€120–€400 · +€80" */
export function formatTourTierSummary(tour: TourPriceSource): string {
  if (!hasTieredRates(tour)) {
    const unit = n(tour.base_price ?? tour.price_per_person ?? tour.price);
    return unit > 0 ? `€${unit}/person` : "";
  }
  const one = n(tour.price_1_pax);
  const four = n(tour.price_4_pax);
  const extra = n(tour.price_extra_pax);
  const bits: string[] = [];
  if (one > 0 && four > 0) bits.push(`€${one}–€${four}`);
  else if (one > 0) bits.push(`from €${one}`);
  else if (four > 0) bits.push(`€${four} (4 pax)`);
  if (extra > 0) bits.push(`+€${extra}/extra`);
  return bits.join(" · ");
}
