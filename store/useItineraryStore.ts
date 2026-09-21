import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  CityId,
  HotelTier,
  HubId,
  RoomType,
  TransitMode,
} from "@/config/pricing-data";
import {
  generateTempPNR,
  promoteTempToOfficial,
  resolveOfficialPNR,
  type BookingStatus,
} from "@/utils/pnr";

export type { BookingStatus };

export interface RoomAllocation {
  type: RoomType;
  count: number;
}

export interface CityNights {
  cityId: CityId;
  nights: number;
}

/** Persisted Experience Profiler result (global across Builder / Discover). */
export interface UserTravelProfile {
  vibe: "culture" | "foodie" | "modern" | "nature";
  pace: "relaxed" | "standard" | "active";
  crowdStyle: "hidden_gems" | "classic" | "balanced";
  isCompleted: boolean;
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
  /** Elite Concierge pathway (legacy itinerary store) */
  hasEliteConcierge: boolean;
  /** Design deposit (€) — credited 100% toward final trip on booking */
  eliteConciergeFee: number;
  /** Non-AI Experience Profiler tag e.g. foodie_relaxed */
  userProfileTag: string | null;
  /** Full travel-style profile from Match Quiz */
  userProfile: UserTravelProfile | null;

  // Module 9
  transitMode: TransitMode;

  // Client contact (submit)
  clientName: string;
  clientEmail: string;
  clientNotes: string;

  /** Draft TMP-… while building; locked JPN-… after request/deposit */
  tempBookingRef: string;
  confirmedBookingRef: string | null;
  bookingStatus: BookingStatus;
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
  setHasEliteConcierge: (v: boolean) => void;
  setUserProfileTag: (tag: string | null) => void;
  setUserProfile: (profile: UserTravelProfile | null) => void;
  clearUserProfile: () => void;

  setTransitMode: (mode: TransitMode) => void;

  setClientName: (v: string) => void;
  setClientEmail: (v: string) => void;
  setClientNotes: (v: string) => void;

  ensureTempBookingRef: () => string;
  confirmBookingRef: (
    ref: string,
    status?: Exclude<BookingStatus, "draft">
  ) => void;
  displayBookingRef: () => string;
  officialBookingRef: () => string;

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
  needHotels: false,
  hotelTier: "5-star",
  rooms: defaultRooms,
  cityNights: [
    { cityId: "tokyo", nights: 4 },
    { cityId: "kyoto", nights: 3 },
    { cityId: "osaka", nights: 3 },
  ],
  selectedTours: [],
  privateChauffeur: false,
  hasEliteConcierge: false,
  eliteConciergeFee: 50,
  userProfileTag: null,
  userProfile: null,
  transitMode: "shinkansen",
  clientName: "",
  clientEmail: "",
  clientNotes: "",
  tempBookingRef: "",
  confirmedBookingRef: null,
  bookingStatus: "draft",
};

function coerceUserProfile(raw: unknown): UserTravelProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<UserTravelProfile>;
  if (
    !p.vibe ||
    !["culture", "foodie", "modern", "nature"].includes(p.vibe) ||
    !p.pace ||
    !["relaxed", "standard", "active"].includes(p.pace) ||
    !p.crowdStyle ||
    !["hidden_gems", "classic", "balanced"].includes(p.crowdStyle)
  ) {
    return null;
  }
  return {
    vibe: p.vibe,
    pace: p.pace,
    crowdStyle: p.crowdStyle,
    isCompleted: Boolean(p.isCompleted ?? true),
  };
}

export const useItineraryStore = create<ItineraryState & ItineraryActions>()(
  persist(
    (set, get) => ({
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
      setHasEliteConcierge: (v) => set({ hasEliteConcierge: v }),
      setUserProfileTag: (tag) => set({ userProfileTag: tag }),
      setUserProfile: (profile) =>
        set({
          userProfile: profile,
          userProfileTag: profile
            ? `${
                profile.vibe === "culture" ? "cultural" : profile.vibe
              }_${profile.pace}`
            : null,
        }),
      clearUserProfile: () =>
        set({ userProfile: null, userProfileTag: null }),
      setTransitMode: (mode) => set({ transitMode: mode }),

      setClientName: (v) => set({ clientName: v }),
      setClientEmail: (v) => set({ clientEmail: v }),
      setClientNotes: (v) => set({ clientNotes: v }),

      ensureTempBookingRef: () => {
        const s = get();
        if (s.tempBookingRef && /^TMP-[A-Z2-9]{6}$/i.test(s.tempBookingRef)) {
          return s.tempBookingRef;
        }
        const next = generateTempPNR();
        set({ tempBookingRef: next });
        return next;
      },

      confirmBookingRef: (ref, status = "confirmed") => {
        set({
          confirmedBookingRef: promoteTempToOfficial(ref),
          bookingStatus: status,
        });
      },

      displayBookingRef: () => {
        const s = get();
        return s.confirmedBookingRef || s.tempBookingRef;
      },

      officialBookingRef: () => {
        const s = get();
        if (s.confirmedBookingRef) return s.confirmedBookingRef;
        return resolveOfficialPNR(s.tempBookingRef);
      },

      reset: () =>
        set({
          ...initialState,
          cityNights: [],
          selectedTours: [],
          privateChauffeur: false,
          hasEliteConcierge: false,
          pickupTransfer: false,
          dropoffTransfer: false,
          needHotels: false,
          tempBookingRef: generateTempPNR(),
          confirmedBookingRef: null,
          bookingStatus: "draft",
        }),
    }),
    {
      name: "travelxp-itinerary-profile",
      partialize: (s) => ({
        userProfile: s.userProfile,
        userProfileTag: s.userProfileTag,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ItineraryState>;
        return {
          ...current,
          userProfile: coerceUserProfile(p.userProfile) ?? current.userProfile,
          userProfileTag:
            typeof p.userProfileTag === "string" || p.userProfileTag === null
              ? p.userProfileTag
              : current.userProfileTag,
        };
      },
    }
  )
);

/** Selectors / derived helpers */
export function totalAssignedNights(cityNights: CityNights[]): number {
  return cityNights.reduce((sum, c) => sum + c.nights, 0);
}

export function totalRooms(rooms: RoomAllocation[]): number {
  return rooms.reduce((sum, r) => sum + r.count, 0);
}
