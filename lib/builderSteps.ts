/**
 * Sequential Builder step validation + unlock helpers.
 * Steps: 1 Duration → 2 Arrival → 3 Locations → 4 Hotels → 5 Tours → 6 Drivers
 */

import {
  accommodatedHotelGuests,
  getHotelAllocationStatus,
  type HotelRoomCounts,
  type StandardOccupancy,
} from "@/lib/hotelCalculator";

export const BUILDER_STEP_COUNT = 6;
/** highestUnlockedStep after Step 6 is saved (past the last accordion step). */
export const BUILDER_ALL_STEPS_COMPLETE = BUILDER_STEP_COUNT + 1;

export const BUILDER_SECTION_IDS = [
  "",
  "section-duration",
  "section-arrival",
  "section-locations",
  "section-hotels",
  "section-tours",
  "section-drivers",
] as const;

export type BuilderStepSnapshot = {
  arrivalDate: string | null;
  durationDays: number;
  adults: number;
  children: number;
  arrivalTransferId: string | null;
  departureTransferId: string | null;
  locations: Array<{
    cityId: string;
    nights: number;
    visitType?: string;
  }>;
  cityHotels: Record<
    string,
    {
      needsHotel?: boolean;
      rooms?: HotelRoomCounts;
      standardOccupancy?: StandardOccupancy | number;
    }
  >;
};

function stayCityIds(locations: BuilderStepSnapshot["locations"]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const loc of locations) {
    if (loc.visitType && loc.visitType !== "stay") continue;
    if (loc.nights <= 0) continue;
    if (!seen.has(loc.cityId)) {
      seen.add(loc.cityId);
      ids.push(loc.cityId);
    }
  }
  return ids;
}

function hotelNeedsAndRooms(
  cityHotels: BuilderStepSnapshot["cityHotels"],
  cityId: string
): {
  needsHotel: boolean;
  rooms: HotelRoomCounts;
  standardOccupancy: StandardOccupancy;
} {
  const raw = cityHotels[cityId];
  return {
    needsHotel: raw?.needsHotel ?? false,
    rooms: raw?.rooms ?? { standard: 0, twin: 0, superior: 0 },
    standardOccupancy: Number(raw?.standardOccupancy) === 1 ? 1 : 2,
  };
}

export function isBuilderStepComplete(
  step: number,
  state: BuilderStepSnapshot
): boolean {
  const totalGuests = state.adults + state.children;

  switch (step) {
    case 1:
      return (
        Boolean(state.arrivalDate) &&
        state.durationDays > 0 &&
        totalGuests > 0
      );
    case 2:
      return Boolean(state.arrivalTransferId && state.departureTransferId);
    case 3:
      return state.locations.length >= 1;
    case 4: {
      if (totalGuests <= 0) return false;
      const cities = stayCityIds(state.locations);
      if (cities.length === 0) return false;
      const needing = cities.filter(
        (id) => hotelNeedsAndRooms(state.cityHotels, id).needsHotel
      );
      if (needing.length === 0) return true;
      return needing.every((cityId) => {
        const pref = hotelNeedsAndRooms(state.cityHotels, cityId);
        const status = getHotelAllocationStatus(
          pref.rooms,
          totalGuests,
          pref.standardOccupancy
        );
        return status.accommodatedGuests >= totalGuests;
      });
    }
    case 5:
    case 6:
      return true;
    default:
      return false;
  }
}

export function builderStepIncompleteMessage(
  step: number,
  state?: BuilderStepSnapshot
): string {
  if (step === 1 && state) {
    if (!state.arrivalDate) return "Please select an arrival date first.";
    if (!(state.durationDays > 0)) return "Please choose a trip duration first.";
    if (state.adults + state.children <= 0)
      return "Please set at least one guest before continuing.";
  }
  if (step === 2 && state) {
    if (!state.arrivalTransferId)
      return "Please select an arrival hub first.";
    if (!state.departureTransferId)
      return "Please select a departure hub first.";
  }
  switch (step) {
    case 1:
      return "Please set trip duration, arrival date, and guests before continuing.";
    case 2:
      return "Please select arrival and departure hubs before continuing.";
    case 3:
      return "Please add at least one city before continuing.";
    case 4:
      return "Please allocate rooms for all guests (or turn off hotels) before continuing.";
    case 5:
      return "Please choose tours & experiences (or skip) before continuing.";
    default:
      return "Please complete this step before continuing.";
  }
}

/**
 * If an earlier unlocked step becomes invalid, clamp so the user cannot
 * jump past it until they re-validate via Continue.
 */
export function clampHighestUnlockedStep(
  highest: number,
  state: BuilderStepSnapshot
): number {
  const capped = Math.max(
    1,
    Math.min(BUILDER_ALL_STEPS_COMPLETE, Math.floor(highest) || 1)
  );
  for (let step = 1; step < capped && step <= BUILDER_STEP_COUNT; step++) {
    if (!isBuilderStepComplete(step, state)) return step;
  }
  return capped;
}

export function canOpenBuilderStep(
  step: number,
  highestUnlockedStep: number
): boolean {
  return (
    step >= 1 &&
    step <= BUILDER_STEP_COUNT &&
    step <= highestUnlockedStep
  );
}

/** Convenience for hotel math consumers / tests. */
export function cityHotelGuestsCovered(
  state: BuilderStepSnapshot,
  cityId: string
): boolean {
  const totalGuests = state.adults + state.children;
  const pref = hotelNeedsAndRooms(state.cityHotels, cityId);
  if (!pref.needsHotel) return true;
  return (
    accommodatedHotelGuests(pref.rooms, pref.standardOccupancy) >= totalGuests
  );
}
