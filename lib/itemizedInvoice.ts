/**
 * Build itemized invoice rows from Builder S / M selections for the Invoice tab.
 */

import type { BuilderConfig } from "@/lib/pocketbase/client";
import {
  calculateInvoiceBreakdown,
  invoiceVehicleLine,
} from "@/lib/builder-pricing";
import { calculateTourPrice } from "@/lib/tourPricing";
import { ELITE_CONCIERGE_FEE } from "@/lib/eliteConcierge";
import {
  calculateSingleDayQuote,
} from "@/lib/singleDayPricing";
import { countsTowardGuideHours } from "@/lib/experiencesPlaces";
import type { SelectedTour } from "@/lib/selectedTours";
import type { BuilderState } from "@/store/useBuilderStore";
import type {
  GuidePreference,
  SingleDaySelectedExperience,
} from "@/store/useSingleDayBuilderStore";
import type { InvoiceItem } from "@/components/invoice/ItemizedInvoiceTable";

export { mergeInvoiceWithAgentServices } from "@/lib/agentServices";
export type { ServiceLineItem } from "@/lib/agentServices";

export function buildSingleDayInvoiceItems(input: {
  guidePreference: GuidePreference;
  tourHours: number;
  selectedExperiences: SingleDaySelectedExperience[];
  conciergeActive?: boolean;
  preferredMovement?: import("@/store/useSingleDayBuilderStore").IntraCityTransport | null;
  suicaNeeded?: boolean;
  suicaValueEur?: number;
  guests?: number;
}): InvoiceItem[] {
  const quote = calculateSingleDayQuote({
    guidePreference: input.guidePreference,
    tourHours: input.tourHours,
    experiencePrices: (input.selectedExperiences || []).map(
      (e) => Number(e.price) || 0
    ),
    conciergeActive: input.conciergeActive,
    preferredMovement: input.preferredMovement,
    suicaNeeded: input.suicaNeeded,
    suicaValueEur: input.suicaValueEur,
    guests: input.guests,
  });

  const items: InvoiceItem[] = [];

  for (const line of quote.lines) {
    if (line.id === "experiences") continue; // expand per stop below
    items.push({
      id: line.id,
      category: line.id === "concierge" ? "Concierge" : "Transit",
      title: line.label,
      status: "ACCEPTED",
      basePriceEur: Math.round(line.amountEur),
    });
  }

  const experiences = input.selectedExperiences || [];
  if (experiences.length === 0) {
    items.push({
      id: "exp-none",
      category: "Tours",
      title: "Selected tours & activities",
      status: "OPTIONAL",
      basePriceEur: 0,
      notes: "No tours selected yet",
    });
  } else {
    experiences.forEach((exp, idx) => {
      const price = Math.round(Number(exp.price) || 0);
      const isTour = countsTowardGuideHours(exp);
      items.push({
        id: `exp-${exp.tourId || idx}`,
        category: isTour ? "Tours" : "Ticket / extra",
        title: exp.title || (isTour ? "Tour" : "Activity"),
        status: "ACCEPTED",
        basePriceEur: price,
        notes: price > 0 ? undefined : "Included / price TBD",
      });
    });
  }

  // Guide preference is Ops dispatch metadata only — not billed here
  // (tour catalog price already covers the guided City Tour).

  return items;
}

export function buildMultiDayInvoiceItems(
  state: BuilderState,
  config: BuilderConfig | null
): InvoiceItem[] {
  const items: InvoiceItem[] = [];
  const guests = Math.max(1, (state.adults || 0) + (state.children || 0));
  const concierge =
    state.isEliteConcierge || state.experienceService === "concierge";

  if (!config) {
    items.push({
      id: "loading",
      category: "System",
      title: "Loading pricing catalog…",
      status: "OPTIONAL",
      basePriceEur: 0,
    });
    return items;
  }

  const breakdown = calculateInvoiceBreakdown(state, config);

  // Arrival / departure hubs
  if (state.airportPickup) {
    const share = Math.round(breakdown.hubs.min / (state.airportDropoff ? 2 : 1));
    items.push({
      id: "hub-pickup",
      category: "Airport transfer",
      title: "Arrival airport pickup",
      status: "ACCEPTED",
      basePriceEur: Math.max(0, share),
      notes: invoiceVehicleLine(guests),
    });
  } else {
    items.push({
      id: "hub-pickup-off",
      category: "Airport transfer",
      title: "Arrival airport pickup",
      status: "DECLINED",
      basePriceEur: 0,
      notes: "Not requested",
    });
  }

  if (state.airportDropoff) {
    const share = Math.round(
      breakdown.hubs.min / (state.airportPickup ? 2 : 1)
    );
    items.push({
      id: "hub-dropoff",
      category: "Airport transfer",
      title: "Departure airport drop-off",
      status: "ACCEPTED",
      basePriceEur: Math.max(0, share),
    });
  } else {
    items.push({
      id: "hub-dropoff-off",
      category: "Airport transfer",
      title: "Departure airport drop-off",
      status: "DECLINED",
      basePriceEur: 0,
      notes: "Not requested",
    });
  }

  // Hotels rollup
  if (breakdown.hotels.min > 0) {
    items.push({
      id: "hotels",
      category: "Accommodation",
      title: "TokioTours hotel stays",
      status: "ACCEPTED",
      basePriceEur: Math.round(breakdown.hotels.min),
      notes: "Per selected cities / nights / room mix",
    });
  } else {
    items.push({
      id: "hotels-self",
      category: "Accommodation",
      title: "Hotel stays",
      status: state.needHotels ? "OPTIONAL" : "DECLINED",
      basePriceEur: 0,
      notes: state.needHotels
        ? "Self-arranged or unset"
        : "Guest self-books hotels",
    });
  }

  // Tours / experiences
  if (concierge) {
    items.push({
      id: "concierge-package",
      category: "Concierge",
      title: "Elite Concierge curation package",
      status: "ACCEPTED",
      basePriceEur: Math.round(
        breakdown.conciergeFee || ELITE_CONCIERGE_FEE
      ),
      notes: "Daily itinerary curated 1:1 — tours quoted after planning",
    });
  } else {
    const tourRows: SelectedTour[] = [];
    for (const rows of Object.values(state.selectedTours ?? {})) {
      for (const row of rows || []) {
        tourRows.push(row);
      }
    }
    if (tourRows.length === 0 && (state.selectedTourIds || []).length > 0) {
      for (const id of state.selectedTourIds) {
        tourRows.push({
          tourId: id,
          title: "",
          duration_hours: 0,
          scheduledDate: "",
          selectedLanguage: "",
          price: 0,
        });
      }
    }

    if (tourRows.length === 0) {
      items.push({
        id: "tours-none",
        category: "Experiences",
        title: "Guided tours & experiences",
        status: "OPTIONAL",
        basePriceEur: 0,
        notes: "No tours selected yet",
      });
    } else {
      for (const row of tourRows) {
        const tour = config.tours.find((t) => t.id === row.tourId);
        const title =
          tour?.title || row.title || "Guided experience";
        const price = tour
          ? calculateTourPrice(
              { adults: state.adults, children: state.children },
              tour
            )
          : Number(row.price) || 0;
        items.push({
          id: `tour-${row.tourId}`,
          category: "Experiences",
          title: String(title),
          status: "ACCEPTED",
          basePriceEur: Math.round(price),
        });
      }
    }
  }

  // Experiences category residual (chauffeur / transit tickets) when not in tour lines
  const toursSum = items
    .filter((i) => i.category === "Experiences" && i.status === "ACCEPTED")
    .reduce((s, i) => s + i.basePriceEur, 0);
  const conciergeSum = items
    .filter((i) => i.category === "Concierge" && i.status === "ACCEPTED")
    .reduce((s, i) => s + i.basePriceEur, 0);
  const residual = Math.round(
    breakdown.experiences.min - toursSum - conciergeSum
  );
  if (residual > 5) {
    items.push({
      id: "transport-misc",
      category: "Transport",
      title: "Private chauffeur / transit tickets",
      status: "ACCEPTED",
      basePriceEur: residual,
      notes: "Day cars, Shinkansen, IC cards & catalog transit",
    });
  }

  // Tailored vs unset experience service
  if (!concierge && state.experienceService !== "tailored") {
    items.push({
      id: "svc-tailored-off",
      category: "Service tier",
      title: "Tailored experiences package",
      status: "OPTIONAL",
      basePriceEur: 0,
      notes: "Not activated",
    });
  }

  return items;
}
