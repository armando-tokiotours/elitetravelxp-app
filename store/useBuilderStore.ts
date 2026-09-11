import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface LocationStop {
  /** Stable client id for DnD */
  key: string;
  cityId: string;
  nights: number;
}

export type HubTravelMode = "airport" | "cruise";

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
  transitModeId: string | null;
  selectedTourIds: string[];
  needDriver: boolean;
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
  addLocation: (cityId: string) => void;
  removeLocation: (key: string) => void;
  setLocationNights: (key: string, nights: number) => void;
  reorderLocations: (locations: LocationStop[]) => void;
  setTransitModeId: (id: string | null) => void;
  toggleTour: (tourId: string) => void;
  setSelectedTourIds: (ids: string[]) => void;
  setNeedDriver: (v: boolean) => void;
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
  transitModeId: null,
  selectedTourIds: [],
  needDriver: false,
};

function uid() {
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
          // Clear hub if it no longer matches the selected mode (handled in UI too)
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

      addLocation: (cityId) =>
        set((s) => {
          if (s.locations.some((l) => l.cityId === cityId)) return s;
          return {
            locations: [...s.locations, { key: uid(), cityId, nights: 1 }],
          };
        }),

      removeLocation: (key) =>
        set((s) => ({
          locations: s.locations.filter((l) => l.key !== key),
        })),

      setLocationNights: (key, nights) =>
        set((s) => ({
          locations: s.locations.map((l) =>
            l.key === key
              ? { ...l, nights: Math.max(1, Math.min(90, nights)) }
              : l
          ),
        })),

      reorderLocations: (locations) => set({ locations }),

      setTransitModeId: (id) => set({ transitModeId: id }),

      toggleTour: (tourId) =>
        set((s) => ({
          selectedTourIds: s.selectedTourIds.includes(tourId)
            ? s.selectedTourIds.filter((id) => id !== tourId)
            : [...s.selectedTourIds, tourId],
        })),

      setSelectedTourIds: (ids) => set({ selectedTourIds: ids }),
      setNeedDriver: (v) => set({ needDriver: v }),

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
        transitModeId: s.transitModeId,
        selectedTourIds: s.selectedTourIds,
        needDriver: s.needDriver,
      }),
    }
  )
);
