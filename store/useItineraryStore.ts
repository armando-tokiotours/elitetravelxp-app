import { create } from "zustand";
import type {
  CityId,
  HotelTier,
  HubId,
  RoomType,
  TransitMode,
} from "@/config/pricing-data";

export interface RoomAllocation {
  type: RoomType;
  count: number;
}

export interface CityNights {
  cityId: CityId;
  nights: number;
}

export interface ItineraryState {
  // Module 1
  durationDays: number;
  isCustomDuration: boolean;

  // Module 2
  totalGuests: number;
  adults: number;
  children: number;

  // Modules 3 & 4
  arrivalHub: HubId | null;
  departureHub: HubId | null;

  // Module 5
  pickupTransfer: boolean;
  dropoffTransfer: boolean;

  // Module 6
  needHotels: boolean;
  hotelTier: HotelTier;
  rooms: RoomAllocation[];

  // Module 7
  cityNights: CityNights[];

  // Module 8
  selectedTours: string[];
  privateChauffeur: boolean;

  // Module 9
  transitMode: TransitMode;

  // Client contact (submit)
  clientName: string;
  clientEmail: string;
  clientNotes: string;
}

export interface ItineraryActions {
  setDurationDays: (days: number) => void;
  setCustomDuration: (enabled: boolean, days?: number) => void;

  setTotalGuests: (n: number) => void;
  setAdults: (n: number) => void;
  setChildren: (n: number) => void;

  setArrivalHub: (hub: HubId) => void;
  setDepartureHub: (hub: HubId) => void;

  setPickupTransfer: (v: boolean) => void;
  setDropoffTransfer: (v: boolean) => void;

  setNeedHotels: (v: boolean) => void;
  setHotelTier: (tier: HotelTier) => void;
  setRoomCount: (type: RoomType, count: number) => void;

  toggleCity: (cityId: CityId) => void;
  setCityNights: (cityId: CityId, nights: number) => void;

  toggleTour: (tourId: string) => void;
  setPrivateChauffeur: (v: boolean) => void;

  setTransitMode: (mode: TransitMode) => void;

  setClientName: (v: string) => void;
  setClientEmail: (v: string) => void;
  setClientNotes: (v: string) => void;

  reset: () => void;
}

const defaultRooms: RoomAllocation[] = [
  { type: "king", count: 1 },
  { type: "twin", count: 0 },
  { type: "executive-suite", count: 0 },
];

const initialState: ItineraryState = {
  durationDays: 10,
  isCustomDuration: false,
  totalGuests: 2,
  adults: 2,
  children: 0,
  arrivalHub: "narita",
  departureHub: "haneda",
  pickupTransfer: true,
  dropoffTransfer: true,
  needHotels: true,
  hotelTier: "5-star",
  rooms: defaultRooms,
  cityNights: [
    { cityId: "tokyo", nights: 4 },
    { cityId: "kyoto", nights: 3 },
    { cityId: "osaka", nights: 3 },
  ],
  selectedTours: [],
  privateChauffeur: false,
  transitMode: "shinkansen",
  clientName: "",
  clientEmail: "",
  clientNotes: "",
};

export const useItineraryStore = create<ItineraryState & ItineraryActions>(
  (set) => ({
    ...initialState,

    setDurationDays: (days) =>
      set({ durationDays: Math.max(1, Math.min(60, days)) }),

    setCustomDuration: (enabled, days) =>
      set((s) => ({
        isCustomDuration: enabled,
        durationDays: enabled
          ? days ?? s.durationDays
          : [10, 14, 21].includes(s.durationDays)
            ? s.durationDays
            : 10,
      })),

    setTotalGuests: (n) =>
      set((s) => {
        const total = Math.max(1, n);
        const adults = Math.min(s.adults, total);
        const children = Math.max(0, total - adults);
        return { totalGuests: total, adults, children };
      }),

    setAdults: (n) =>
      set((s) => {
        const adults = Math.max(0, Math.min(n, s.totalGuests));
        return { adults, children: s.totalGuests - adults };
      }),

    setChildren: (n) =>
      set((s) => {
        const children = Math.max(0, Math.min(n, s.totalGuests));
        return { children, adults: s.totalGuests - children };
      }),

    setArrivalHub: (hub) => set({ arrivalHub: hub }),
    setDepartureHub: (hub) => set({ departureHub: hub }),

    setPickupTransfer: (v) => set({ pickupTransfer: v }),
    setDropoffTransfer: (v) => set({ dropoffTransfer: v }),

    setNeedHotels: (v) => set({ needHotels: v }),
    setHotelTier: (tier) => set({ hotelTier: tier }),

    setRoomCount: (type, count) =>
      set((s) => ({
        rooms: s.rooms.map((r) =>
          r.type === type ? { ...r, count: Math.max(0, count) } : r
        ),
      })),

    toggleCity: (cityId) =>
      set((s) => {
        const exists = s.cityNights.some((c) => c.cityId === cityId);
        if (exists) {
          return {
            cityNights: s.cityNights.filter((c) => c.cityId !== cityId),
            selectedTours: s.selectedTours.filter(
              (id) => !id.startsWith(cityId) && !id.includes(cityId)
            ),
          };
        }
        return {
          cityNights: [...s.cityNights, { cityId, nights: 1 }],
        };
      }),

    setCityNights: (cityId, nights) =>
      set((s) => ({
        cityNights: s.cityNights.map((c) =>
          c.cityId === cityId
            ? { ...c, nights: Math.max(0, Math.min(30, nights)) }
            : c
        ),
      })),

    toggleTour: (tourId) =>
      set((s) => ({
        selectedTours: s.selectedTours.includes(tourId)
          ? s.selectedTours.filter((id) => id !== tourId)
          : [...s.selectedTours, tourId],
      })),

    setPrivateChauffeur: (v) => set({ privateChauffeur: v }),
    setTransitMode: (mode) => set({ transitMode: mode }),

    setClientName: (v) => set({ clientName: v }),
    setClientEmail: (v) => set({ clientEmail: v }),
    setClientNotes: (v) => set({ clientNotes: v }),

    reset: () => set(initialState),
  })
);

/** Selectors / derived helpers */
export function totalAssignedNights(cityNights: CityNights[]): number {
  return cityNights.reduce((sum, c) => sum + c.nights, 0);
}

export function totalRooms(rooms: RoomAllocation[]): number {
  return rooms.reduce((sum, r) => sum + r.count, 0);
}
