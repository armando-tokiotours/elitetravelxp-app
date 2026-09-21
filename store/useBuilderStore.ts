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
  sortSelectedToursChronologically,
  syncTourDerived,
  type SelectedTour,
  type SelectedToursByCity,
} from "@/lib/selectedTours";
import { canAddTourOnDate } from "@/lib/tourValidator";
import {
  BUILDER_ALL_STEPS_COMPLETE,
  clampHighestUnlockedStep,
} from "@/lib/builderSteps";
import type { ExperienceProfile } from "@/lib/experienceProfiler";
import { coerceExperienceProfile } from "@/lib/experienceProfiler";
import {
  generateTempPNR,
  isValidBookingPNR,
  normalizeBookingPNR,
  promoteTempToOfficial,
  resolveOfficialPNR,
  type BookingStatus,
} from "@/utils/pnr";

export type { BookingStatus } from "@/utils/pnr";

export type {
  ChauffeurSelections,
  DailyChauffeurSelection,
  DriverMode,
} from "@/lib/chauffeurSelections";
export type { SelectedTour, SelectedToursByCity } from "@/lib/selectedTours";

export type CityTransitType = "unset" | "self" | "public" | "private";
export type CityVisitType = "stay" | "arrival" | "departure";
export type TransitTicketType = "ic_card" | "shinkansen_reserved" | "none";

export interface LocationStop {
  /** Unique instance id for the itinerary array (DnD / React key) */
  key: string;
  /** PocketBase cities collection id */
  cityId: string;
  nights: number;
  /** Stay nights vs 0-night arrival/departure waypoint */
  visitType: CityVisitType;
  /** Transit mode to the *next* stop (next city, or departure hub on the last stop) */
  transitType: CityTransitType;
  /** When public: concierge pre-books tickets / IC cards for this leg */
  needsTicket?: boolean;
  ticketType?: TransitTicketType;
  /** Estimated € per passenger for pre-booked tickets */
  ticketPricePerPax?: number;
}

export function coerceTransitType(
  value: unknown
): CityTransitType {
  if (value === "private") return "private";
  if (value === "public") return "public";
  if (value === "self") return "self";
  return "unset";
}

function normalizeLocation(
  l: Partial<LocationStop> & { cityId: string; key?: string },
  index = 0,
  length = 1
): LocationStop {
  const visitType = coerceVisitTypeForPosition(l.visitType, index, length);
  const transitType = coerceTransitType(l.transitType);
  const nights =
    visitType === "stay"
      ? Math.max(1, Math.min(90, Math.round(Number(l.nights) || 1)))
      : 0;
  const needsTicket =
    transitType === "public"
      ? l.needsTicket == null
        ? true
        : Boolean(l.needsTicket)
      : false;
  const ticketType: TransitTicketType =
    transitType !== "public" || !needsTicket
      ? "none"
      : l.ticketType === "ic_card" || l.ticketType === "shinkansen_reserved"
        ? l.ticketType
        : "shinkansen_reserved";
  const ticketPricePerPax =
    needsTicket && ticketType !== "none"
      ? Math.max(
          0,
          Number(l.ticketPricePerPax) ||
            (ticketType === "ic_card" ? 28 : 115)
        )
      : 0;
  const rawKey = typeof l.key === "string" ? l.key.trim() : "";
  return {
    // Never persist/render empty keys — duplicates become React `` key warnings
    key: rawKey || uid(),
    cityId: String(l.cityId || ""),
    visitType,
    nights,
    transitType,
    needsTicket,
    ticketType,
    ticketPricePerPax,
  };
}

export type HubTravelMode = "airport" | "cruise";
export type TravelPace = "fast" | "moderate" | "relaxed" | null;
/** Step 5 pathway: full concierge package vs self-selected experiences */
export type ExperienceService = "concierge" | "tailored" | null;

export type HotelStarRating = 4 | 5;
export type HotelRoomType = "Standard" | "Twin" | "Superior";
export type SeasonTierName = "Low" | "Mid" | "High";

export type HotelRoomCounts = {
  standard: number;
  twin: number;
  superior: number;
};

export interface ActiveSeasonNote {
  crowds: string;
  note: string;
}

export interface CityHotelPref {
  cityId: string;
  needsHotel: boolean;
  starRating: HotelStarRating;
  /** Mixed room quantities (Standard / Twin / Superior) */
  rooms: HotelRoomCounts;
  /** Guests per Standard room (1 or 2) */
  standardOccupancy: 1 | 2;
  breakfast: boolean;
  /** @deprecated migrated into `rooms` */
  roomType?: HotelRoomType;
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
   * Hub → first city transit (Arrival connector on the Travel Dossier).
   * Separate from airport VIP pickup.
   */
  arrivalTransitType: CityTransitType;
  arrivalNeedsTicket: boolean;
  arrivalTicketType: TransitTicketType;
  arrivalTicketPricePerPax: number;
  /**
   * Date-bound experiences: cityId → scheduled tours.
   * Source of truth for Step 5 + chauffeur-by-tour sync.
   */
  selectedTours: SelectedToursByCity;
  /** @deprecated unique tour ids — derived from selectedTours */
  selectedTourIds: string[];
  /** @deprecated city → tour ids — derived from selectedTours */
  selectedToursByCity: Record<string, string[]>;
  /** Premium all-inclusive concierge package (derived from experienceService) */
  isEliteConcierge: boolean;
  /** Step 5: Elite Concierge vs Tailored Experiences pathway */
  experienceService: ExperienceService;
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
  /** Highest Builder accordion step the user may open (1–5) */
  highestUnlockedStep: number;
  /** Preferred itinerary intensity */
  travelPace: TravelPace;
  /** Non-AI Experience Profiler quiz result (activity matcher) */
  experienceProfile: ExperienceProfile | null;
  /** Resolved from season_tiers for the chosen arrival date */
  activeSeasonTier: SeasonTierName | null;
  activeSeasonNote: ActiveSeasonNote | null;
  /**
   * Dual-stage booking reference lifecycle:
   * - draft: tempBookingRef (TMP-…) while building
   * - requested / deposit_paid / confirmed: confirmedBookingRef (JPN-…) locked
   */
  tempBookingRef: string;
  confirmedBookingRef: string | null;
  bookingStatus: BookingStatus;
  /** Client-stated target trip budget in EUR (Custom Budget Matcher) */
  customBudgetTarget: number | null;
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
  setArrivalTransitType: (transitType: CityTransitType) => void;
  /** Save mode + optional public-rail ticket pre-book preference for a leg. */
  setLocationTransitChoice: (
    key: string,
    choice: {
      mode: CityTransitType;
      needsTicket?: boolean;
      ticketType?: TransitTicketType;
      ticketPricePerPax?: number;
    }
  ) => void;
  setArrivalTransitChoice: (choice: {
    mode: CityTransitType;
    needsTicket?: boolean;
    ticketType?: TransitTicketType;
    ticketPricePerPax?: number;
  }) => void;
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
  /** Replace all date-bound tour selections (used by Tailored Experiences draft commit). */
  commitSelectedTours: (selectedTours: SelectedToursByCity) => void;
  setSelectedTourIds: (ids: string[]) => void;
  setEliteConcierge: (v: boolean) => void;
  setExperienceService: (service: ExperienceService) => void;
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
  setTravelPace: (pace: TravelPace) => void;
  setExperienceProfile: (profile: ExperienceProfile | null) => void;
  setCustomBudgetTarget: (amount: number | null) => void;
  /** Unlock up to `step` after Continue validation (never decreases). */
  unlockBuilderStep: (step: number) => void;
  /** Clamp unlock after earlier steps become incomplete. */
  revalidateBuilderUnlock: () => void;
  setHighestUnlockedStep: (step: number) => void;
  /**
   * Hydrate builder state from a saved quotation / booking payload
   * (e.g. Manage My Booking). Forces step unlock to 5.
   */
  loadSavedItinerary: (payload: unknown) => void;
  hydrateFromSnapshot: (snapshot: Partial<BuilderState>) => void;
  /** Ensure a temp TMP- ref exists for this browser session. */
  ensureTempBookingRef: () => string;
  /**
   * Lock an official JPN- PNR after Print/Request or Revolut deposit.
   * Status: requested | deposit_paid | confirmed.
   */
  confirmBookingRef: (
    ref: string,
    status?: Exclude<BookingStatus, "draft">
  ) => void;
  /** Active code for UI / checkout (confirmed if locked, else temp). */
  displayBookingRef: () => string;
  /** Official JPN- code for payment / email (promotes TMP- body when draft). */
  officialBookingRef: () => string;
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
  needHotels: false,
  hotelTier: "5-star",
  roomCount: 1,
  roomType: "King",
  adults: 2,
  children: 0,
  locations: [],
  cityHotels: {},
  transitModeId: null,
  arrivalTransitType: "unset",
  arrivalNeedsTicket: false,
  arrivalTicketType: "none",
  arrivalTicketPricePerPax: 0,
  selectedTours: {},
  selectedTourIds: [],
  selectedToursByCity: {},
  isEliteConcierge: false,
  experienceService: null,
  chauffeurSelections: {},
  chauffeurDays: {},
  needDriver: false,
  highestUnlockedStep: 1,
  travelPace: null,
  experienceProfile: null,
  activeSeasonTier: null,
  activeSeasonNote: null,
  tempBookingRef: "",
  confirmedBookingRef: null,
  bookingStatus: "draft",
  customBudgetTarget: null,
};

function syncChauffeurDerived(selections: ChauffeurSelections) {
  const chauffeurDays = chauffeurDaysFromSelections(selections);
  return {
    chauffeurSelections: selections,
    chauffeurDays,
    needDriver: countBillableChauffeurDays(selections) > 0,
  };
}

/** Keys restored from a PocketBase quotation / localStorage snapshot. */
const BUILDER_PERSIST_KEYS = [
  "durationDays",
  "durationCustom",
  "arrivalDate",
  "arrivalMode",
  "departureMode",
  "arrivalTransferId",
  "departureTransferId",
  "airportPickup",
  "airportDropoff",
  "needHotels",
  "hotelTier",
  "roomCount",
  "roomType",
  "adults",
  "children",
  "locations",
  "cityHotels",
  "transitModeId",
  "arrivalTransitType",
  "arrivalNeedsTicket",
  "arrivalTicketType",
  "arrivalTicketPricePerPax",
  "selectedTours",
  "selectedTourIds",
  "selectedToursByCity",
  "isEliteConcierge",
  "experienceService",
  "chauffeurSelections",
  "chauffeurDays",
  "needDriver",
  "highestUnlockedStep",
  "travelPace",
  "experienceProfile",
  "tempBookingRef",
  "confirmedBookingRef",
  "bookingStatus",
  "customBudgetTarget",
] as const satisfies readonly (keyof BuilderState)[];

function pickBuilderPayload(raw: unknown): Partial<BuilderState> {
  if (!raw || typeof raw !== "object") return {};
  const src = raw as Record<string, unknown>;
  // Support nested shapes from API wrappers
  const nested =
    src.payload && typeof src.payload === "object"
      ? (src.payload as Record<string, unknown>)
      : src.state && typeof src.state === "object"
        ? (src.state as Record<string, unknown>)
        : src;
  const out: Partial<BuilderState> = {};
  for (const key of BUILDER_PERSIST_KEYS) {
    if (key in nested && nested[key] !== undefined) {
      (out as Record<string, unknown>)[key] = nested[key];
    }
  }
  // API wrappers may stash the locked PNR as bookingRef / reference
  if (!out.confirmedBookingRef) {
    const locked =
      (typeof nested.bookingRef === "string" && nested.bookingRef) ||
      (typeof nested.confirmedBookingRef === "string" &&
        nested.confirmedBookingRef) ||
      (typeof nested.reference === "string" && nested.reference) ||
      "";
    if (locked && isValidBookingPNR(locked)) {
      out.confirmedBookingRef = normalizeBookingPNR(locked);
      const ps = nested.bookingStatus;
      if (
        ps === "requested" ||
        ps === "deposit_paid" ||
        ps === "confirmed"
      ) {
        out.bookingStatus = ps;
      } else if (!out.bookingStatus || out.bookingStatus === "draft") {
        out.bookingStatus = "requested";
      }
    }
  }
  return out;
}

/** Shared hydrate path for localStorage persist + Manage My Booking. */
export function mergePersistedBuilderState(
  persisted: unknown,
  current: BuilderState
): BuilderState {
  const p = pickBuilderPayload(persisted);
  const rawLocs = p.locations ?? current.locations;
  const seenKeys = new Set<string>();
  const raw = rawLocs.map((l, i) => {
    let loc = normalizeLocation(l, i, rawLocs.length);
    if (!loc.key || seenKeys.has(loc.key)) {
      loc = { ...loc, key: uid() };
    }
    seenKeys.add(loc.key);
    return loc;
  });
  const locations = correctLocationVisitTypes(raw);
  const selectedToursRaw: SelectedToursByCity =
    p.selectedTours && Object.keys(p.selectedTours).length > 0
      ? p.selectedTours
      : migrateLegacySelectedTours(
          p.selectedToursByCity ?? current.selectedToursByCity,
          p.selectedTourIds ?? current.selectedTourIds
        );
  const selectedTours: SelectedToursByCity = {};
  for (const [cityId, rows] of Object.entries(selectedToursRaw)) {
    selectedTours[cityId] = sortSelectedToursChronologically(
      (rows ?? []).map((row) => ({
        ...row,
        selectedLanguage: String(row.selectedLanguage || "").trim(),
      }))
    );
  }
  const tourDerived = syncTourDerived(selectedTours);
  const chauffeurSelections =
    p.chauffeurSelections && Object.keys(p.chauffeurSelections).length > 0
      ? p.chauffeurSelections
      : migrateLegacyChauffeurDays(p.chauffeurDays ?? current.chauffeurDays);
  const derived = syncChauffeurDerived(chauffeurSelections);
  const roomCount = Math.max(
    1,
    Number(p.roomCount) || current.roomCount || 1
  );
  const cityHotelsRaw = p.cityHotels ?? current.cityHotels ?? {};
  const cityHotels: Record<string, CityHotelPref> = {};
  for (const [id, pref] of Object.entries(cityHotelsRaw)) {
    cityHotels[id] = normalizeCityHotelPref(
      pref as CityHotelPref,
      id,
      roomCount
    );
  }
  return {
    ...current,
    ...p,
    locations,
    ...tourDerived,
    isEliteConcierge: Boolean(
      p.experienceService === "concierge" ||
        (p.experienceService == null && p.isEliteConcierge)
    ),
    experienceService:
      p.experienceService === "concierge" || p.experienceService === "tailored"
        ? p.experienceService
        : p.isEliteConcierge
          ? "concierge"
          : null,
    ...derived,
    roomCount,
    cityHotels,
    highestUnlockedStep: clampHighestUnlockedStep(
      Number(p.highestUnlockedStep) || current.highestUnlockedStep || 1,
      {
        arrivalDate: p.arrivalDate ?? current.arrivalDate,
        durationDays: p.durationDays ?? current.durationDays,
        adults: p.adults ?? current.adults,
        children: p.children ?? current.children,
        arrivalTransferId: p.arrivalTransferId ?? current.arrivalTransferId,
        departureTransferId:
          p.departureTransferId ?? current.departureTransferId,
        locations,
        cityHotels,
      }
    ),
    travelPace: (["fast", "moderate", "relaxed"] as const).includes(
      p.travelPace as "fast"
    )
      ? (p.travelPace as "fast" | "moderate" | "relaxed")
      : current.travelPace,
    experienceProfile: (() => {
      const coerced = coerceExperienceProfile(p.experienceProfile);
      return coerced ?? current.experienceProfile;
    })(),
    arrivalTransitType: coerceTransitType(p.arrivalTransitType),
    arrivalNeedsTicket:
      coerceTransitType(p.arrivalTransitType) === "public"
        ? p.arrivalNeedsTicket != null
          ? Boolean(p.arrivalNeedsTicket)
          : current.arrivalNeedsTicket
        : false,
    arrivalTicketType:
      p.arrivalTicketType === "ic_card" ||
      p.arrivalTicketType === "shinkansen_reserved" ||
      p.arrivalTicketType === "none"
        ? p.arrivalTicketType
        : current.arrivalTicketType,
    arrivalTicketPricePerPax: Math.max(
      0,
      Number(
        p.arrivalTicketPricePerPax ?? current.arrivalTicketPricePerPax ?? 0
      ) || 0
    ),
    activeSeasonTier: current.activeSeasonTier,
    activeSeasonNote: current.activeSeasonNote,
    tempBookingRef:
      typeof p.tempBookingRef === "string" && p.tempBookingRef
        ? normalizeBookingPNR(p.tempBookingRef)
        : current.tempBookingRef || "",
    confirmedBookingRef: (() => {
      const raw = p.confirmedBookingRef;
      if (typeof raw === "string" && raw.trim()) {
        return normalizeBookingPNR(raw);
      }
      return current.confirmedBookingRef;
    })(),
    bookingStatus: (() => {
      const s = p.bookingStatus;
      if (
        s === "draft" ||
        s === "requested" ||
        s === "deposit_paid" ||
        s === "confirmed"
      ) {
        return s;
      }
      return p.confirmedBookingRef || current.confirmedBookingRef
        ? current.bookingStatus === "draft"
          ? "confirmed"
          : current.bookingStatus
        : current.bookingStatus || "draft";
    })(),
    customBudgetTarget: (() => {
      if (!("customBudgetTarget" in p)) return current.customBudgetTarget;
      if (p.customBudgetTarget == null) return null;
      const n = Number(p.customBudgetTarget);
      return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
    })(),
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
    needsHotel: false,
    starRating: 4,
    rooms: { standard: 0, twin: 0, superior: 0 },
    standardOccupancy: 2,
    breakfast: true,
  };
}

/** Migrate legacy `roomType` + optional count into `rooms`. */
export function normalizeCityHotelPref(
  raw: Partial<CityHotelPref> & { roomType?: HotelRoomType },
  cityId: string,
  fallbackCount = 1
): CityHotelPref {
  const base = defaultCityHotel(cityId);
  const rooms = raw.rooms
    ? {
        standard: Math.max(0, Number(raw.rooms.standard) || 0),
        twin: Math.max(0, Number(raw.rooms.twin) || 0),
        superior: Math.max(0, Number(raw.rooms.superior) || 0),
      }
    : (() => {
        const n = Math.max(1, fallbackCount);
        const t = raw.roomType;
        if (t === "Twin") return { standard: 0, twin: n, superior: 0 };
        if (t === "Superior") return { standard: 0, twin: 0, superior: n };
        return { standard: n, twin: 0, superior: 0 };
      })();

  const starRaw = Number(raw.starRating);
  const starRating: HotelStarRating = starRaw === 5 ? 5 : 4;
  const occRaw = Number(raw.standardOccupancy);
  const standardOccupancy: 1 | 2 = occRaw === 1 ? 1 : 2;

  return {
    cityId,
    needsHotel: raw.needsHotel ?? base.needsHotel,
    starRating,
    rooms,
    standardOccupancy,
    breakfast: raw.breakfast ?? base.breakfast,
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
        set((s) => {
          const prev = normalizeCityHotelPref(
            s.cityHotels[cityId] || defaultCityHotel(cityId),
            cityId,
            s.roomCount
          );
          const next = normalizeCityHotelPref(
            { ...prev, ...patch, cityId },
            cityId,
            s.roomCount
          );
          return {
            cityHotels: {
              ...s.cityHotels,
              [cityId]: next,
            },
          };
        }),

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
                transitType: "unset",
                needsTicket: false,
                ticketType: "none",
                ticketPricePerPax: 0,
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
            l.key === key
              ? {
                  ...l,
                  transitType: coerceTransitType(transitType),
                  ...(transitType === "public"
                    ? {}
                    : {
                        needsTicket: false,
                        ticketType: "none" as const,
                        ticketPricePerPax: 0,
                      }),
                }
              : l
          ),
        })),

      setArrivalTransitType: (transitType) =>
        set(() => {
          const mode = coerceTransitType(transitType);
          return {
            arrivalTransitType: mode,
            ...(mode === "public"
              ? {}
              : {
                  arrivalNeedsTicket: false,
                  arrivalTicketType: "none" as const,
                  arrivalTicketPricePerPax: 0,
                }),
          };
        }),

      setLocationTransitChoice: (key, choice) =>
        set((s) => ({
          locations: s.locations.map((l) => {
            if (l.key !== key) return l;
            const mode = coerceTransitType(choice.mode);
            if (mode !== "public") {
              return {
                ...l,
                transitType: mode,
                needsTicket: false,
                ticketType: "none" as const,
                ticketPricePerPax: 0,
              };
            }
            const needsTicket = Boolean(choice.needsTicket);
            const ticketType: TransitTicketType = !needsTicket
              ? "none"
              : choice.ticketType === "ic_card" ||
                  choice.ticketType === "shinkansen_reserved"
                ? choice.ticketType
                : "none";
            return {
              ...l,
              transitType: "public" as const,
              needsTicket,
              ticketType,
              ticketPricePerPax: needsTicket
                ? Math.max(0, Number(choice.ticketPricePerPax) || 0)
                : 0,
            };
          }),
        })),

      setArrivalTransitChoice: (choice) =>
        set(() => {
          const mode = coerceTransitType(choice.mode);
          if (mode !== "public") {
            return {
              arrivalTransitType: mode,
              arrivalNeedsTicket: false,
              arrivalTicketType: "none" as const,
              arrivalTicketPricePerPax: 0,
            };
          }
          const needsTicket = Boolean(choice.needsTicket);
          const ticketType: TransitTicketType = !needsTicket
            ? "none"
            : choice.ticketType === "ic_card" ||
                choice.ticketType === "shinkansen_reserved"
              ? choice.ticketType
              : "none";
          return {
            arrivalTransitType: "public" as const,
            arrivalNeedsTicket: needsTicket,
            arrivalTicketType: ticketType,
            arrivalTicketPricePerPax: needsTicket
              ? Math.max(0, Number(choice.ticketPricePerPax) || 0)
              : 0,
          };
        }),

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
        if (s.isEliteConcierge || s.experienceService === "concierge") {
          return false;
        }
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
              selectedLanguage: "",
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
        if (s.isEliteConcierge || s.experienceService === "concierge") {
          return false;
        }
        if (!tour.scheduledDate) return false;
        if (!String(tour.selectedLanguage || "").trim()) return false;
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
        const nextRows = sortSelectedToursChronologically([
          ...without,
          {
            tourId: tour.tourId,
            title: tour.title,
            duration_hours,
            scheduledDate: tour.scheduledDate,
            selectedLanguage: String(tour.selectedLanguage).trim(),
            price: Number(tour.price) || 0,
            ...(tour.languages?.length ? { languages: tour.languages } : {}),
            ...(tour.customDuration ? { customDuration: true } : {}),
          },
        ]);
        const selectedTours = {
          ...s.selectedTours,
          [cityId]: nextRows,
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

      commitSelectedTours: (selectedTours) => {
        const next: SelectedToursByCity = {};
        for (const [cityId, rows] of Object.entries(selectedTours ?? {})) {
          const sorted = sortSelectedToursChronologically(rows);
          if (sorted.length) next[cityId] = sorted;
        }
        set(syncTourDerived(next));
      },

      setSelectedTourIds: (ids) => set({ selectedTourIds: ids }),

      setEliteConcierge: (v) =>
        set(
          v
            ? {
                isEliteConcierge: true,
                experienceService: "concierge" as const,
                ...syncTourDerived({}),
                ...syncChauffeurDerived({}),
              }
            : {
                isEliteConcierge: false,
                experienceService: null,
              }
        ),

      setExperienceService: (service) =>
        set(() => {
          if (service === "concierge") {
            return {
              experienceService: "concierge" as const,
              isEliteConcierge: true,
              ...syncTourDerived({}),
              ...syncChauffeurDerived({}),
            };
          }
          if (service === "tailored") {
            return {
              experienceService: "tailored" as const,
              isEliteConcierge: false,
            };
          }
          return {
            experienceService: null,
            isEliteConcierge: false,
          };
        }),

      setNeedDriver: (v) =>
        set((s) => {
          if (s.isEliteConcierge || s.experienceService === "concierge") {
            return s;
          }
          return v ? { needDriver: true } : syncChauffeurDerived({});
        }),

      setChauffeurDay: (cityId, date, on) =>
        set((s) => {
          if (s.isEliteConcierge || s.experienceService === "concierge") {
            return s;
          }
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
          if (s.isEliteConcierge || s.experienceService === "concierge") {
            return s;
          }
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
          if (s.isEliteConcierge || s.experienceService === "concierge") {
            return s;
          }
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
          if (s.isEliteConcierge || s.experienceService === "concierge") {
            return s;
          }
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
        set((s) => {
          if (s.isEliteConcierge || s.experienceService === "concierge") {
            return s;
          }
          return syncChauffeurDerived(
            upsertChauffeurSelection(
              s.chauffeurSelections,
              cityId,
              date,
              selection
            )
          );
        }),

      setActiveSeason: (tier, note) =>
        set({ activeSeasonTier: tier, activeSeasonNote: note }),

      setTravelPace: (pace) =>
        set({
          travelPace:
            pace === "fast" || pace === "moderate" || pace === "relaxed"
              ? pace
              : null,
        }),

      setExperienceProfile: (profile) =>
        set({ experienceProfile: profile }),

      setCustomBudgetTarget: (amount) =>
        set({
          customBudgetTarget:
            amount != null && Number.isFinite(amount) && amount > 0
              ? Math.round(amount)
              : null,
        }),

      unlockBuilderStep: (step) =>
        set((s) => {
          const next = Math.max(
            1,
            Math.min(BUILDER_ALL_STEPS_COMPLETE, Math.floor(step) || 1)
          );
          if (next <= s.highestUnlockedStep) return s;
          return { highestUnlockedStep: next };
        }),

      setHighestUnlockedStep: (step) =>
        set({
          highestUnlockedStep: Math.max(
            1,
            Math.min(BUILDER_ALL_STEPS_COMPLETE, Math.floor(step) || 1)
          ),
        }),

      revalidateBuilderUnlock: () =>
        set((s) => {
          const next = clampHighestUnlockedStep(s.highestUnlockedStep, s);
          if (next === s.highestUnlockedStep) return s;
          return { highestUnlockedStep: next };
        }),

      loadSavedItinerary: (payload) =>
        set((s) => {
          const merged = mergePersistedBuilderState(payload, s);
          const locked =
            merged.confirmedBookingRef ||
            (typeof (payload as { bookingRef?: string })?.bookingRef ===
            "string"
              ? normalizeBookingPNR(
                  (payload as { bookingRef: string }).bookingRef
                )
              : null);
          return {
            ...merged,
            highestUnlockedStep: BUILDER_ALL_STEPS_COMPLETE,
            ...(locked
              ? {
                  confirmedBookingRef: locked,
                  bookingStatus:
                    merged.bookingStatus === "draft"
                      ? ("confirmed" as const)
                      : merged.bookingStatus,
                }
              : {}),
          };
        }),

      hydrateFromSnapshot: (snapshot: Partial<BuilderState>) =>
        set((s) => ({
          ...mergePersistedBuilderState(snapshot, s),
          highestUnlockedStep: BUILDER_ALL_STEPS_COMPLETE,
        })),

      ensureTempBookingRef: () => {
        const s = get();
        if (s.confirmedBookingRef && s.bookingStatus !== "draft") {
          return s.confirmedBookingRef;
        }
        if (s.tempBookingRef && /^TMP-[A-Z2-9]{6}$/i.test(s.tempBookingRef)) {
          return s.tempBookingRef;
        }
        const next = generateTempPNR();
        set({ tempBookingRef: next, bookingStatus: "draft" });
        return next;
      },

      confirmBookingRef: (ref, status = "confirmed") => {
        const official = isValidBookingPNR(ref)
          ? normalizeBookingPNR(ref)
          : promoteTempToOfficial(ref);
        set({
          confirmedBookingRef: official,
          bookingStatus: status,
        });
      },

      displayBookingRef: () => {
        const s = get();
        if (s.bookingStatus === "draft") {
          return s.tempBookingRef || "";
        }
        return s.confirmedBookingRef || s.tempBookingRef || "";
      },

      officialBookingRef: () => {
        const s = get();
        if (s.confirmedBookingRef && s.bookingStatus !== "draft") {
          return s.confirmedBookingRef;
        }
        return resolveOfficialPNR(s.tempBookingRef || generateTempPNR());
      },

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

      reset: () =>
        set({
          ...initialState,
          tempBookingRef: generateTempPNR(),
          confirmedBookingRef: null,
          bookingStatus: "draft",
        }),
    }),
    {
      name: "elite-travel-builder",
      skipHydration: true,
      merge: (persisted, current) => ({
        ...current,
        ...mergePersistedBuilderState(persisted, current),
      }),
      partialize: (s) => {
        const out: Partial<BuilderState> = {};
        for (const key of BUILDER_PERSIST_KEYS) {
          (out as Record<string, unknown>)[key] = s[key];
        }
        return out;
      },
    }
  )
);
