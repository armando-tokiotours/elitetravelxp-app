import type { PbHub, PbTransfer } from "@/lib/pocketbase/client";
import { transferLocation } from "@/lib/pocketbase/client";
import { countBillableChauffeurDays } from "@/lib/chauffeurSelections";
import {
  formatDisplayDate,
  type BuilderState,
} from "@/store/useBuilderStore";

function hubLabel(
  id: string | null,
  hubs: PbHub[],
  transfers: PbTransfer[]
): string {
  if (!id) return "—";
  const hub = hubs.find((h) => h.id === id);
  if (hub) return hub.name.replace(/\s*\([^)]*\)\s*$/, "").trim() || hub.name;
  const t = transfers.find((x) => x.id === id);
  return t ? transferLocation(t) : "—";
}

/** Compact at-a-glance lines for collapsed accordion headers. */
export function builderSectionSummaries(
  state: BuilderState,
  opts?: {
    hubs?: PbHub[];
    transfers?: PbTransfer[];
    cityNames?: Record<string, string>;
  }
): Record<1 | 2 | 3 | 4 | 5, string> {
  const hubs = opts?.hubs ?? [];
  const transfers = opts?.transfers ?? [];
  const cityNames = opts?.cityNames ?? {};

  const durationBits = [`${state.durationDays} day${state.durationDays === 1 ? "" : "s"}`];
  if (state.arrivalDate) {
    durationBits.push(formatDisplayDate(state.arrivalDate));
  }

  const arrive = hubLabel(state.arrivalTransferId, hubs, transfers);
  const depart = hubLabel(state.departureTransferId, hubs, transfers);
  const arrivalBits = [
    `${arrive} → ${depart}`,
    state.airportPickup ? "Pickup: Yes" : "Pickup: No",
  ];

  const hotelCities = Object.values(state.cityHotels || {}).filter(
    (h) => h.needsHotel
  );
  const hotelBits =
    hotelCities.length > 0
      ? [
          `${hotelCities.length} hotel stop${hotelCities.length === 1 ? "" : "s"}`,
          `${state.adults + state.children} guest${state.adults + state.children === 1 ? "" : "s"}`,
        ]
      : state.needHotels
        ? [
            state.hotelTier === "5-star" ? "5-Star" : "4-Star",
            `${state.adults + state.children} guest${state.adults + state.children === 1 ? "" : "s"}`,
          ]
        : [
            "No hotels",
            `${state.adults + state.children} guest${state.adults + state.children === 1 ? "" : "s"}`,
          ];

  const locBits =
    state.locations.length === 0
      ? "No cities yet"
      : state.locations
          .map((l) => {
            const name = cityNames[l.cityId] ?? "City";
            return `${name} (${l.nights}n)`;
          })
          .join(", ");

  const tourCount = state.selectedTourIds.length;
  const tourBits = [
    tourCount === 0
      ? "No tours"
      : `${tourCount} tour${tourCount === 1 ? "" : "s"} selected`,
    `Chauffeur: ${
      countBillableChauffeurDays(state.chauffeurSelections) > 0
        ? `${countBillableChauffeurDays(state.chauffeurSelections)} day(s)`
        : state.needDriver
          ? "Yes"
          : "No"
    }`,
  ];

  return {
    1: durationBits.join(" · "),
    2: arrivalBits.join(" · "),
    3: locBits,
    4: hotelBits.join(" · "),
    5: tourBits.join(" · "),
  };
}
