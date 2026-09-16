import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  canAppendCity,
  coerceVisitTypeForPosition,
  correctLocationVisitTypes,
  hasConsecutiveDuplicateCities,
} from "@/lib/locationRules";
import {
  chauffeurDaysFromSelections,
  countBillableChauffeurDays,
  emptyChauffeurSelection,
  migrateLegacyChauffeurDays,
  upsertChauffeurSelection,
  type ChauffeurSelections,
  type DailyChauffeurSelection,
  type DriverMode,
} from "@/lib/chauffeurSelections";
import {
  migrateLegacySelectedTours,
  syncTourDerived,
  type SelectedTour,
  type SelectedToursByCity,
} from "@/lib/selectedTours";
import { canAddTourOnDate } from "@/lib/tourValidator";

export type {
  ChauffeurSelections,
  DailyChauffeurSelection,
  DriverMode,
} from "@/lib/chauffeurSelections";
export type { SelectedTour, SelectedToursByCity } from "@/lib/selectedTours";

export type CityTransitType = "public" | "private";
export type CityVisitType = "stay" | "arrival" | "departure";

export interface LocationStop {
  /** Unique instance id for the itinerary array (DnD / React key) */
  key: string;
  /** PocketBase cities collection id */
  cityId: string;
  nights: number;
  /** Stay nights vs 0-night arrival/departure waypoint */
  visitType: CityVisitType;
  /** Transit mode to the *next* city (ignored on last stop) */
  transitType: CityTransitType;
}

function normalizeLocation(
  l: Partial<LocationStop> & { cityId: string; key: string },
  index = 0,
  length = 1
): LocationStop {
  const visitType = coerceVisitTypeForPosition(l.visitType, index, length);
  const transitType: CityTransitType =
    l.transitType === "private" ? "private" : "public";
  const nights =
    visitType === "stay"
      ? Math.max(1, Math.min(90, Math.round(Number(l.nights) || 1)))
      : 0;
  return {
    key: l.key,
    cityId: l.cityId,
    visitType,
    nights,
    transitType,
  };
}

export type HubTravelMode = "airport" | "cruise";

export type HotelStarRating = 3 | 4 | 5;
export type HotelRoomType = "Standard" | "Twin" | "Superior";
export type SeasonTierName = "Low" | "Mid" | "High";

export interface ActiveSeasonNote {
  crowds: string;
  note: string;
}

export interface CityHotelPref {
  cityId: string;
  needsHotel: boolean;
  starRating: HotelStarRating;
  roomType: HotelRoomType;
  breakfast: boolean;
}

export interface BuilderState {
  durationDays: number;
  /** True when user chose Custom instead of 10/14/21 presets */
  durationCustom: boolean;
  /** ISO date YYYY-MM-DD — trip start / first city night */
  arrivalDate: string | null;
  /** Flight vs cruise filter for arrival hub dropdown */
  arrivalMode: HubTravelMode;
  /** Flight vs cruise filter for departure hub dropdown */
  departureMode: HubTravelMode;
  /** Selected hub id (airport or cruise terminal) */
  arrivalTransferId: string | null;
  departureTransferId: string | null;
  airportPickup: boolean;
  airportDropoff: boolean;
  needHotels: boolean;
  hotelTier: "4-star" | "5-star";
  roomCount: number;
  roomType: string;
  adults: number;
  children: number;
  locations: LocationStop[];
  /** Per-city hotel preferences (keyed by cityId) */
  cityHotels: Record<string, CityHotelPref>;
  transitModeId: string | null;
  /**
   * Date-bound experiences: cityId → scheduled tours.
   * Source of truth for Step 5 + chauffeur-by-tour sync.
   */
  selectedTours: SelectedToursByCity;
  /** @deprecated unique tour ids — derived from selectedTours */
  selectedTourIds: string[];
  /** @deprecated city → tour ids — derived from selectedTours */
  selectedToursByCity: Record<string, string[]>;
  /** Premium all-inclusive concierge package */
  isEliteConcierge: boolean;
  /**
   * Per-city, per-day chauffeur booking:
   * cityId → date → { mode, selectedTourIds }
   */
  chauffeurSelections: ChauffeurSelections;
  /**
   * @deprecated derived from chauffeurSelections — kept for older summary UIs
   * cityId → ISO dates with an active driver booking
   */
  chauffeurDays: Record<string, string[]>;
  /** @deprecated derived — true when any chauffeur day is billable */
  needDriver: boolean;
  /** Resolved from season_tiers for the chosen arrival date */
  activeSeasonTier: SeasonTierName | null;
  activeSeasonNote: ActiveSeasonNote | null;
}

export interface BuilderActions {
  setDurationDays: (days: number) => void;
  setDurationCustom: (v: boolean) => void;
  setArrivalDate: (iso: string | null) => void;
  setArrivalMode: (mode: HubTravelMode) => void;
  setDepartureMode: (mode: HubTravelMode) => void;
  setArrivalTransferId: (id: string | null) => void;
  setDepartureTransferId: (id: string | null) => void;
  setAirportPickup: (v: boolean) => void;
  setAirportDropoff: (v: boolean) => void;
  setNeedHotels: (v: boolean) => void;
  setHotelTier: (tier: "4-star" | "5-star") => void;
  setRoomCount: (n: number) => void;
  setRoomType: (t: string) => void;
  setAdults: (n: number) => void;
  setChildren: (n: number) => void;
  setCityHotel: (cityId: string, patch: Partial<CityHotelPref>) => void;
  ensureCityHotels: (cityIds: string[]) => void;
  addLocation: (cityId: string) => boolean;
  removeLocation: (key: string) => void;
  setLocationNights: (key: string, nights: number) => void;
  setLocationVisitType: (key: string, visitType: CityVisitType) => void;
  setLocationTransitType: (key: string, transitType: CityTransitType) => void;
  /** Returns false when reorder would create consecutive duplicate cities. */
  reorderLocations: (locations: LocationStop[]) => boolean;
  setTransitModeId: (id: string | null) => void;
  toggleTour: (tourId: string) => void;
  /**
   * Remove a city tour, or toggle without a date (legacy).
   * Prefer addCityTour / removeCityTour for date-bound booking.
   */
  toggleCityTour: (cityId: string, tourId: string) => boolean;
  /** Schedule a tour on a specific stay date (required for chauffeur-by-tour). */
  addCityTour: (cityId: string, tour: SelectedTour) => boolean;
  removeCityTour: (cityId: string, tourId: string) => void;
  setSelectedTourIds: (ids: string[]) => void;
  setEliteConcierge: (v: boolean) => void;
  setNeedDriver: (v: boolean) => void;
  setChauffeurDay: (cityId: string, date: string, on: boolean) => void;
  setChauffeurDaysForCity: (cityId: string, dates: string[]) => void;
  setChauffeurDayMode: (
    cityId: string,
    date: string,
    mode: DriverMode
  ) => void;
  toggleChauffeurDayTour: (
    cityId: string,
    date: string,
    tourId: string
  ) => void;
  setChauffeurSelection: (
    cityId: string,
    date: string,
    selection: DailyChauffeurSelection | null
  ) => void;
  setActiveSeason: (
    tier: SeasonTierName | null,
    note: ActiveSeasonNote | null
  ) => void;
  totalGuests: () => number;
  totalNights: () => number;
  /** Checkout / leave Japan day = arrival + durationDays */
  departureDate: () => string | null;
  reset: () => void;
}

const initialState: BuilderState = {
  durationDays: 10,
  durationCustom: false,
  arrivalDate: null,
  arrivalMode: "airport",
  departureMode: "airport",
  arrivalTransferId: null,
  departureTransferId: null,
  airportPickup: true,
  airportDropoff: true,
  needHotels: true,
  hotelTier: "5-star",
  roomCount: 1,
  roomType: "King",
  adults: 2,
  children: 0,
  locations: [],
  cityHotels: {},
  transitModeId: null,
  selectedTours: {},
  selectedTourIds: [],
  selectedToursByCity: {},
  isEliteConcierge: false,
  chauffeurSelections: {},
  chauffeurDays: {},
  needDriver: false,
  activeSeasonTier: null,
  activeSeasonNote: null,
};

function syncChauffeurDerived(selections: ChauffeurSelections) {
  const chauffeurDays = chauffeurDaysFromSelections(selections);
  return {
    chauffeurSelections: selections,
    chauffeurDays,
    needDriver: countBillableChauffeurDays(selections) > 0,
  };
}

function scrubTourFromChauffeur(
  selections: ChauffeurSelections,
  cityId: string,
  tourId: string
): ChauffeurSelections {
  const city = selections[cityId];
  if (!city) return selections;
  let changed = false;
  const nextCity: Record<string, DailyChauffeurSelection> = {};
  for (const [date, sel] of Object.entries(city)) {
    if (sel.mode !== "by_tour") {
      nextCity[date] = sel;
      continue;
    }
    const ids = (sel.selectedTourIds ?? []).filter((id) => id !== tourId);
    if (ids.length !== (sel.selectedTourIds ?? []).length) changed = true;
    if (ids.length === 0) {
      changed = true;
      continue;
    }
    nextCity[date] = { mode: "by_tour", selectedTourIds: ids };
  }
  if (!changed) return selections;
  const out = { ...selections };
  if (Object.keys(nextCity).length === 0) delete out[cityId];
  else out[cityId] = nextCity;
  return out;
}

function uid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `loc_${Math.random().toString(36).slice(2, 10)}`;
}

/** Add N calendar days to YYYY-MM-DD (local). */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function formatDisplayDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function defaultCityHotel(cityId: string): CityHotelPref {
  return {
    cityId,
    needsHotel: true,
    starRating: 4,
    roomType: "Standard",
    breakfast: true,
  };
}

export const useBuilderStore = create<BuilderState & BuilderActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setDurationDays: (days) =>
        set({ durationDays: Math.max(1, Math.round(days) || 1) }),
      setDurationCustom: (v) => set({ durationCustom: v }),
      setArrivalDate: (iso) => set({ arrivalDate: iso }),
      setArrivalMode: (mode) =>
        set((s) => ({
          arrivalMode: mode,
          arrivalTransferId: s.arrivalTransferId,
        })),
      setDepartureMode: (mode) =>
        set((s) => ({
          departureMode: mode,
          departureTransferId: s.departureTransferId,
        })),
      setArrivalTransferId: (id) => set({ arrivalTransferId: id }),
      setDepartureTransferId: (id) => set({ departureTransferId: id }),
      setAirportPickup: (v) => set({ airportPickup: v }),
      setAirportDropoff: (v) => set({ airportDropoff: v }),
      setNeedHotels: (v) => set({ needHotels: v }),
      setHotelTier: (tier) => set({ hotelTier: tier }),
      setRoomCount: (n) => set({ roomCount: Math.max(1, n) }),
      setRoomType: (t) => set({ roomType: t }),
      setAdults: (n) => set({ adults: Math.max(1, n) }),
      setChildren: (n) => set({ children: Math.max(0, n) }),

      setCityHotel: (cityId, patch) =>
        set((s) => ({
          cityHotels: {
            ...s.cityHotels,
            [cityId]: {
              ...(s.cityHotels[cityId] || defaultCityHotel(cityId)),
              ...patch,
              cityId,
            },
          },
        })),

      ensureCityHotels: (cityIds) =>
        set((s) => {
          const next = { ...s.cityHotels };
          let changed = false;
          for (const id of cityIds) {
            if (!next[id]) {
              next[id] = defaultCityHotel(id);
              changed = true;
            }
          }
          return changed ? { cityHotels: next } : s;
        }),

      addLocation: (cityId) => {
        const s = get();
        if (!canAppendCity(s.locations, cityId)) return false;
        set({
          locations: correctLocationVisitTypes([
            ...s.locations,
            normalizeLocation(
              {
                key: uid(),
                cityId,
                nights: 1,
                visitType: "stay",
                transitType: "public",
              },
              s.locations.length,
              s.locations.length + 1
            ),
          ]),
          cityHotels: {
            ...s.cityHotels,
            [cityId]: s.cityHotels[cityId] || defaultCityHotel(cityId),
          },
        });
        return true;
      },

      removeLocation: (key) =>
        set((s) => {
          const removed = s.locations.find((l) => l.key === key);
          const locations = correctLocationVisitTypes(
            s.locations.filter((l) => l.key !== key)
          );
          const stillUsed = removed
            ? locations.some((l) => l.cityId === removed.cityId)
            : true;
          const cityHotels = { ...s.cityHotels };
          if (removed && !stillUsed) delete cityHotels[removed.cityId];
          return { locations, cityHotels };
        }),

      setLocationNights: (key, nights) =>
        set((s) => ({
          locations: s.locations.map((l) => {
            if (l.key !== key) return l;
            if (l.visitType !== "stay") return { ...l, nights: 0 };
            return {
              ...l,
              nights: Math.max(1, Math.min(90, Math.round(nights) || 1)),
            };
          }),
        })),

      setLocationVisitType: (key, visitType) =>
        set((s) => {
          const index = s.locations.findIndex((l) => l.key === key);
          if (index < 0) return s;
          const coerced = coerceVisitTypeForPosition(
            visitType,
            index,
            s.locations.length
          );
          // Reject Arrival/Departure when invalid for this position
          if (
            (visitType === "arrival" || visitType === "departure") &&
            coerced !== visitType
          ) {
            return s;
          }
          return {
            locations: s.locations.map((l) => {
              if (l.key !== key) return l;
              if (coerced === "stay") {
                return {
                  ...l,
                  visitType: "stay" as const,
                  nights: l.nights > 0 ? l.nights : 1,
                };
              }
              return { ...l, visitType: coerced, nights: 0 };
            }),
          };
        }),

      setLocationTransitType: (key, transitType) =>
        set((s) => ({
          locations: s.locations.map((l) =>
            l.key === key ? { ...l, transitType } : l
          ),
        })),

      reorderLocations: (locations) => {
        if (hasConsecutiveDuplicateCities(locations)) return false;
        set({
          locations: correctLocationVisitTypes(
            locations.map((l, i) =>
              normalizeLocation(l, i, locations.length)
            )
          ),
        });
        return true;
      },

      setTransitModeId: (id) => set({ transitModeId: id }),

      toggleTour: (tourId) =>
        set((s) => {
          const selectedTourIds = s.selectedTourIds.includes(tourId)
            ? s.selectedTourIds.filter((id) => id !== tourId)
            : [...s.selectedTourIds, tourId];
          return { selectedTourIds };
        }),

      toggleCityTour: (cityId, tourId) => {
        const s = get();
        if (s.isEliteConcierge) return false;
        const current = s.selectedTours[cityId] ?? [];
        const isSelected = current.some((t) => t.tourId === tourId);
        let nextRows: SelectedTour[];
        if (isSelected) {
          nextRows = current.filter((t) => t.tourId !== tourId);
        } else {
          nextRows = [
            ...current,
            {
              tourId,
              title: tourId,
              duration_hours: 0,
              scheduledDate: "",
              price: 0,
            },
          ];
        }
        const selectedTours = { ...s.selectedTours };
        if (nextRows.length === 0) delete selectedTours[cityId];
        else selectedTours[cityId] = nextRows;

        // Drop chauffeur-by-tour refs when removing
        let chauffeurSelections = s.chauffeurSelections;
        if (isSelected) {
          chauffeurSelections = scrubTourFromChauffeur(
            chauffeurSelections,
            cityId,
            tourId
          );
        }

        set({
          ...syncTourDerived(selectedTours),
          ...syncChauffeurDerived(chauffeurSelections),
        });
        return true;
      },

      addCityTour: (cityId, tour) => {
        const s = get();
        if (s.isEliteConcierge) return false;
        if (!tour.scheduledDate) return false;
        const current = s.selectedTours[cityId] ?? [];
        const without = current.filter((t) => t.tourId !== tour.tourId);
        const duration_hours = Number(tour.duration_hours) || 0;
        const check = canAddTourOnDate({
          selectedRows: without,
          scheduledDate: tour.scheduledDate,
          newTourDurationHours: duration_hours,
          tourId: tour.tourId,
        });
        if (!check.ok) return false;
        const selectedTours = {
          ...s.selectedTours,
          [cityId]: [
            ...without,
            {
              tourId: tour.tourId,
              title: tour.title,
              duration_hours,
              scheduledDate: tour.scheduledDate,
              price: Number(tour.price) || 0,
              ...(tour.customDuration ? { customDuration: true } : {}),
            },
          ],
        };
        set(syncTourDerived(selectedTours));
        return true;
      },

      removeCityTour: (cityId, tourId) => {
        const s = get();
        const current = s.selectedTours[cityId] ?? [];
        if (!current.some((t) => t.tourId === tourId)) return;
        const nextRows = current.filter((t) => t.tourId !== tourId);
        const selectedTours = { ...s.selectedTours };
        if (nextRows.length === 0) delete selectedTours[cityId];
        else selectedTours[cityId] = nextRows;
        set({
          ...syncTourDerived(selectedTours),
          ...syncChauffeurDerived(
            scrubTourFromChauffeur(s.chauffeurSelections, cityId, tourId)
          ),
        });
      },

      setSelectedTourIds: (ids) => set({ selectedTourIds: ids }),

      setEliteConcierge: (v) =>
        set(
          v
            ? {
                isEliteConcierge: true,
                ...syncTourDerived({}),
              }
            : { isEliteConcierge: false }
        ),

      setNeedDriver: (v) =>
        set(() =>
          v
            ? { needDriver: true }
            : syncChauffeurDerived({})
        ),

      setChauffeurDay: (cityId, date, on) =>
        set((s) => {
          const next = upsertChauffeurSelection(
            s.chauffeurSelections,
            cityId,
            date,
            on ? emptyChauffeurSelection("full_day") : null
          );
          return syncChauffeurDerived(next);
        }),

      setChauffeurDaysForCity: (cityId, dates) =>
        set((s) => {
          let next: ChauffeurSelections = { ...s.chauffeurSelections };
          delete next[cityId];
          for (const date of dates) {
            next = upsertChauffeurSelection(
              next,
              cityId,
              date,
              emptyChauffeurSelection("full_day")
            );
          }
          return syncChauffeurDerived(next);
        }),

      setChauffeurDayMode: (cityId, date, mode) =>
        set((s) => {
          const current =
            s.chauffeurSelections[cityId]?.[date] ??
            emptyChauffeurSelection("none");
          const nextSel: DailyChauffeurSelection | null =
            mode === "none"
              ? null
              : {
                  mode,
                  selectedTourIds:
                    mode === "by_tour" ? current.selectedTourIds ?? [] : [],
                };
          return syncChauffeurDerived(
            upsertChauffeurSelection(
              s.chauffeurSelections,
              cityId,
              date,
              nextSel
            )
          );
        }),

      toggleChauffeurDayTour: (cityId, date, tourId) =>
        set((s) => {
          const current =
            s.chauffeurSelections[cityId]?.[date] ??
            emptyChauffeurSelection("by_tour");
          const setIds = new Set(current.selectedTourIds ?? []);
          if (setIds.has(tourId)) setIds.delete(tourId);
          else setIds.add(tourId);
          return syncChauffeurDerived(
            upsertChauffeurSelection(s.chauffeurSelections, cityId, date, {
              mode: "by_tour",
              selectedTourIds: Array.from(setIds),
            })
          );
        }),

      setChauffeurSelection: (cityId, date, selection) =>
        set((s) =>
          syncChauffeurDerived(
            upsertChauffeurSelection(
              s.chauffeurSelections,
              cityId,
              date,
              selection
            )
          )
        ),

      setActiveSeason: (tier, note) =>
        set({ activeSeasonTier: tier, activeSeasonNote: note }),

      totalGuests: () => {
        const s = get();
        return s.adults + s.children;
      },

      totalNights: () =>
        get().locations.reduce((sum, l) => sum + l.nights, 0),

      departureDate: () => {
        const { arrivalDate, durationDays } = get();
        if (!arrivalDate || durationDays < 1) return null;
        return addDaysIso(arrivalDate, durationDays);
      },

      reset: () => set(initialState),
    }),
    {
      name: "elite-travel-builder",
      skipHydration: true,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<BuilderState>;
        const raw = (p.locations ?? current.locations).map((l) =>
          normalizeLocation(l)
        );
        const locations = correctLocationVisitTypes(raw);
        const selectedTours: SelectedToursByCity =
          p.selectedTours && Object.keys(p.selectedTours).length > 0
            ? p.selectedTours
            : migrateLegacySelectedTours(
                p.selectedToursByCity ?? current.selectedToursByCity,
                p.selectedTourIds ?? current.selectedTourIds
              );
        const tourDerived = syncTourDerived(selectedTours);
        const chauffeurSelections =
          p.chauffeurSelections &&
          Object.keys(p.chauffeurSelections).length > 0
            ? p.chauffeurSelections
            : migrateLegacyChauffeurDays(
                p.chauffeurDays ?? current.chauffeurDays
              );
        const derived = syncChauffeurDerived(chauffeurSelections);
        return {
          ...current,
          ...p,
          locations,
          ...tourDerived,
          isEliteConcierge: Boolean(p.isEliteConcierge),
          ...derived,
        };
      },
      partialize: (s) => ({
        durationDays: s.durationDays,
        durationCustom: s.durationCustom,
        arrivalDate: s.arrivalDate,
        arrivalMode: s.arrivalMode,
        departureMode: s.departureMode,
        arrivalTransferId: s.arrivalTransferId,
        departureTransferId: s.departureTransferId,
        airportPickup: s.airportPickup,
        airportDropoff: s.airportDropoff,
        needHotels: s.needHotels,
        hotelTier: s.hotelTier,
        roomCount: s.roomCount,
        roomType: s.roomType,
        adults: s.adults,
        children: s.children,
        locations: s.locations,
        cityHotels: s.cityHotels,
        transitModeId: s.transitModeId,
        selectedTours: s.selectedTours,
        selectedTourIds: s.selectedTourIds,
        selectedToursByCity: s.selectedToursByCity,
        isEliteConcierge: s.isEliteConcierge,
        chauffeurSelections: s.chauffeurSelections,
        chauffeurDays: s.chauffeurDays,
        needDriver: s.needDriver,
      }),
    }
  )
);
