/**
 * Agency B2B negotiated tour rate lookup.
 */

import type PocketBase from "pocketbase";
import {
  calculateTourPrice,
  type TourPriceGuests,
  type TourPriceSource,
} from "@/lib/tourPricing";

export type AgencyTourRate = {
  id: string;
  agency: string;
  tour: string;
  item_title?: string;
  negotiated_price?: number;
  currency?: string;
  is_active?: boolean;
};

export async function getAgencyTourRate(
  pb: PocketBase,
  agencyId: string,
  tourId: string
): Promise<AgencyTourRate | null> {
  const agency = String(agencyId || "").trim();
  const tour = String(tourId || "").trim();
  if (!agency || !tour) return null;
  try {
    return await pb.collection("agency_tour_rates").getFirstListItem<AgencyTourRate>(
      `agency="${agency}" && tour="${tour}" && is_active=true`,
      { requestKey: null }
    );
  } catch {
    return null;
  }
}

/**
 * Prefer negotiated agency price; else retail tier math.
 */
export async function resolveAgencyTourPrice(
  pb: PocketBase,
  opts: {
    agencyId?: string | null;
    tourId: string;
    guests: TourPriceGuests | number;
    retailTour: TourPriceSource;
  }
): Promise<{ amount: number; isNegotiated: boolean; currency?: string }> {
  if (opts.agencyId) {
    const row = await getAgencyTourRate(pb, opts.agencyId, opts.tourId);
    const negotiated = Number(row?.negotiated_price);
    if (row && Number.isFinite(negotiated) && negotiated > 0) {
      return {
        amount: negotiated,
        isNegotiated: true,
        currency: row.currency || "EUR",
      };
    }
  }
  return {
    amount: calculateTourPrice(opts.guests, opts.retailTour),
    isNegotiated: false,
    currency: "EUR",
  };
}
