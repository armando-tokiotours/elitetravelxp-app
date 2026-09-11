import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface LocationStop {
  /** Stable client id for DnD */
  key: string;
  cityId: string;
  nights: number;
}

export interface BuilderState {
  durationDays: number;
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
  reset: () => void;
}

const initialState: BuilderState = {
  durationDays: 10,
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

export const useBuilderStore = create<BuilderState & BuilderActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setDurationDays: (days) => set({ durationDays: days }),
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
          selectedTourIds: s.selectedTourIds, // pruned in UI against available cities
        })),

      setLocationNights: (key, nights) =>
        set((s) => ({
          locations: s.locations.map((l) =>
            l.key === key
              ? { ...l, nights: Math.max(1, Math.min(30, nights)) }
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

      reset: () => set(initialState),
    }),
    {
      name: "elite-travel-builder",
      skipHydration: true,
      partialize: (s) => ({
        durationDays: s.durationDays,
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
