import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  canAppendCity,
  coerceVisitTypeForPosition,
  correctLocationVisitTypes,
  hasConsecutiveDuplicateCities,
} from "@/lib/locationRules";

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
  /** Flat unique tour ids (pricing / print) */
  selectedTourIds: string[];
  /** City id → selected tour ids for Step 5 capacity rules */
  selectedToursByCity: Record<string, string[]>;
  /** Premium all-inclusive concierge package */
  isEliteConcierge: boolean;
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
  /** Add/remove a tour for a specific city. */
  toggleCityTour: (cityId: string, tourId: string) => boolean;
  setSelectedTourIds: (ids: string[]) => void;
  setEliteConcierge: (v: boolean) => void;
  setNeedDriver: (v: boolean) => void;
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
  selectedTourIds: [],
  selectedToursByCity: {},
  isEliteConcierge: false,
  needDriver: false,
  activeSeasonTier: null,
  activeSeasonNote: null,
};

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
      setAdults: (n) => set({ adults: Math.max(0, n) }),
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
        const current = s.selectedToursByCity[cityId] ?? [];
        const isSelected = current.includes(tourId);
        const nextForCity = isSelected
          ? current.filter((id) => id !== tourId)
          : [...current, tourId];

        const selectedToursByCity = { ...s.selectedToursByCity };
        if (nextForCity.length === 0) delete selectedToursByCity[cityId];
        else selectedToursByCity[cityId] = nextForCity;

        const selectedTourIds = Array.from(
          new Set(Object.values(selectedToursByCity).flat())
        );

        set({ selectedToursByCity, selectedTourIds });
        return true;
      },

      setSelectedTourIds: (ids) => set({ selectedTourIds: ids }),

      setEliteConcierge: (v) =>
        set(
          v
            ? {
                isEliteConcierge: true,
                selectedTourIds: [],
                selectedToursByCity: {},
              }
            : { isEliteConcierge: false }
        ),

      setNeedDriver: (v) => set({ needDriver: v }),

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
        const selectedToursByCity =
          p.selectedToursByCity ?? current.selectedToursByCity ?? {};
        const selectedTourIds =
          p.selectedTourIds ??
          Array.from(new Set(Object.values(selectedToursByCity).flat())) ??
          current.selectedTourIds;
        return {
          ...current,
          ...p,
          locations,
          selectedToursByCity,
          selectedTourIds,
          isEliteConcierge: Boolean(p.isEliteConcierge),
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
        selectedTourIds: s.selectedTourIds,
        selectedToursByCity: s.selectedToursByCity,
        isEliteConcierge: s.isEliteConcierge,
        needDriver: s.needDriver,
      }),
    }
  )
);
