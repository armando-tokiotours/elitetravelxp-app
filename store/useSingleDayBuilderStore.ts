import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GuestSpecialRequirements } from "@/lib/guestSpecialRequirements";
import {
  EMPTY_GUEST_SPECIAL_REQUIREMENTS,
  guestSpecialRequirementsChoicesComplete,
  migrateUnsetGuestSpecialRequirements,
  normalizeGuestSpecialRequirements,
} from "@/lib/guestSpecialRequirements";
import {
  clampCustomTourHours,
  resolveTourHoursTier,
} from "@/lib/tourHoursTier";
import type { ExperienceTimingIntent } from "@/lib/experienceTiming";

export type { ExperienceTimingIntent } from "@/lib/experienceTiming";

export type TourDurationHours = 6 | 8;
export type GuidePreference = "private_guide" | "local_host" | "self_paced";
/** Preferred day movement. `walk` kept for stop-level / legacy only. */
export type IntraCityTransport =
  | "walk"
  | "subway"
  | "private_driver"
  | "mix";
export type DayBlockId = "morning" | "afternoon" | "evening";
export type SingleDayTravelPace = "fast" | "moderate" | "relaxed" | null;

export const TOUR_HOUR_PRESETS: TourDurationHours[] = [6, 8];

export interface DayStop {
  id: string;
  location: string;
  experience: string;
  durationMinutes: number;
  transportToNext: IntraCityTransport;
}

export interface DayBlock {
  id: DayBlockId;
  label: string;
  stops: DayStop[];
}

/** Experience selections owned by Builder S only (not useBuilderStore). */
export interface SingleDaySelectedExperience {
  tourId: string;
  title: string;
  selectedLanguage: string;
  duration_hours: number;
  price?: number;
  /** tours.access_type — drives Ops ticketer demand */
  access_type?: string;
  /** Catalog category: tour | activity | cluster | place — badge + tickets */
  category?: string;
  /** experiences_and_places.entry_type when sourced from EAP */
  entry_type?: string;
  /**
   * Ticket / place / activity extras sit outside the guide-hour budget.
   * Guided tour stops keep this false/undefined for capacity checks.
   */
  is_extra?: boolean;
  /**
   * Guest intent for extras: during tour / after tour / other day.
   * Guided stops leave this unset.
   */
  timingIntent?: ExperienceTimingIntent;
  /** Required when timingIntent === other_day — date Ticketer buys for */
  ticketDate?: string | null;
  /** Cached Ops/ticketer internal note */
  opsTimingNote?: string;
}

export interface SingleDayBuilderState {
  /** Always 1 for Builder S — never synced to multi-day durationDays. */
  totalDays: 1;
  tourDate: string | null;
  adults: number;
  children: number;
  /** Dietary / mobility / notes → PB guest_special_requirements */
  guestSpecialRequirements: GuestSpecialRequirements;
  guestSpecialRequirementsAcked: boolean;
  /** Tour length in hours (presets 6/8 or custom 5–10). */
  tourHours: number;
  tourHoursCustom: boolean;
  /** True when duration is 9–10h (day-trip / needs ops confirmation). */
  needsAgentConfirmation: boolean;
  travelPace: SingleDayTravelPace;
  startTime: string;
  guidePreference: GuidePreference;
  cityFocus: string;
  /** Preferred guided language code for the city (EN, JA, …). */
  preferredTourLanguage: string;
  /** Hotel name or station hub for morning pick-up. */
  meetingPoint: string;
  /** Display title (hotel/hub) from Geoapify. */
  meetingPointName?: string;
  meetingPointLat?: number | null;
  meetingPointLng?: number | null;
  meetingPointPlaceId?: string;
  /** True after Meeting Point & Language step is confirmed (guests may skip map). */
  meetingLogisticsConfirmed: boolean;
  /** Preferred intra-city movement for the day. */
  preferredMovement: IntraCityTransport | null;
  /** Rail / IC answers when Subway is chosen (same as Multi Public). */
  guestHasJRPass: boolean | null;
  guestHasICCard: boolean | null;
  guestNeedsTransitHelp: boolean | null;
  /** Subway: TokioTours prepares physical Suica (TIX flag). */
  suicaNeeded: boolean;
  /** Optional preload estimate € per guest when suicaNeeded. */
  suicaValueEur: number;
  blocks: DayBlock[];
  selectedExperiences: SingleDaySelectedExperience[];
  /** Transport catalog picks → Ticketer (same as multi). */
  selectedTransportProducts: import("@/lib/transportProducts").TransportTicketLine[];
  /** True after Save & Continue on Experiences (allows empty / skip). */
  experiencesStepDone: boolean;
  setTourDate: (iso: string | null) => void;
  setAdults: (n: number) => void;
  setChildren: (n: number) => void;
  setGuestSpecialRequirements: (reqs: GuestSpecialRequirements) => void;
  ackGuestSpecialRequirements: () => void;
  setTourHours: (hours: number) => void;
  setTourHoursCustom: (custom: boolean) => void;
  setTravelPace: (pace: SingleDayTravelPace) => void;
  setStartTime: (time: string) => void;
  setGuidePreference: (pref: GuidePreference) => void;
  setCityFocus: (city: string) => void;
  /**
   * Switch tour city and clear city-bound meeting point + experiences.
   * Used after City Change Confirmation.
   */
  changeCityFocus: (city: string) => void;
  setPreferredTourLanguage: (code: string) => void;
  setMeetingPoint: (value: string) => void;
  setMeetingPointCoords: (lat: number | null, lng: number | null) => void;
  setMeetingPointDetails: (details: {
    name: string;
    address: string;
    lat: number | null;
    lng: number | null;
    placeId?: string;
  }) => void;
  setMeetingLogisticsConfirmed: (confirmed: boolean) => void;
  setPreferredMovement: (value: IntraCityTransport | null) => void;
  setGuestTransitPasses: (answers: {
    guestHasJRPass?: boolean;
    guestHasICCard?: boolean;
    guestNeedsTransitHelp?: boolean;
  }) => void;
  setSuicaPreference: (opts: {
    suicaNeeded: boolean;
    suicaValueEur?: number;
  }) => void;
  addExperience: (row: SingleDaySelectedExperience) => void;
  removeExperience: (tourId: string) => void;
  reorderExperiences: (fromIndex: number, toIndex: number) => void;
  addTransportProduct: (
    line: import("@/lib/transportProducts").TransportTicketLine
  ) => void;
  removeTransportProduct: (productId: string) => void;
  setExperiencesStepDone: (done: boolean) => void;
  addStop: (blockId: DayBlockId) => void;
  updateStop: (
    blockId: DayBlockId,
    stopId: string,
    patch: Partial<Omit<DayStop, "id">>
  ) => void;
  removeStop: (blockId: DayBlockId, stopId: string) => void;
  reset: () => void;
}

function uid() {
  return `stop_${Math.random().toString(36).slice(2, 9)}`;
}

function emptyStop(): DayStop {
  return {
    id: uid(),
    location: "",
    experience: "",
    durationMinutes: 60,
    transportToNext: "walk",
  };
}

/** Empty day blocks — live stops live in `selectedExperiences`, not mock rows. */
const initialBlocks: DayBlock[] = [
  { id: "morning", label: "Morning", stops: [] },
  { id: "afternoon", label: "Afternoon", stops: [] },
  { id: "evening", label: "Evening", stops: [] },
];

const initialState = {
  totalDays: 1 as const,
  tourDate: null as string | null,
  adults: 2,
  children: 0,
  guestSpecialRequirements: { ...EMPTY_GUEST_SPECIAL_REQUIREMENTS },
  guestSpecialRequirementsAcked: false,
  tourHours: 6,
  tourHoursCustom: false,
  needsAgentConfirmation: false,
  travelPace: null as SingleDayTravelPace,
  startTime: "09:00",
  guidePreference: "private_guide" as GuidePreference,
  cityFocus: "Tokyo",
  preferredTourLanguage: "EN",
  meetingPoint: "",
  meetingPointName: "",
  meetingPointLat: null as number | null,
  meetingPointLng: null as number | null,
  meetingPointPlaceId: "",
  meetingLogisticsConfirmed: false,
  preferredMovement: null as IntraCityTransport | null,
  guestHasJRPass: null as boolean | null,
  guestHasICCard: null as boolean | null,
  guestNeedsTransitHelp: null as boolean | null,
  suicaNeeded: false,
  suicaValueEur: 15,
  blocks: initialBlocks,
  selectedExperiences: [] as SingleDaySelectedExperience[],
  selectedTransportProducts: [] as import("@/lib/transportProducts").TransportTicketLine[],
  experiencesStepDone: false,
};

export const useSingleDayBuilderStore = create<SingleDayBuilderState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setTourDate: (tourDate) => set({ tourDate }),
      setAdults: (adults) => set({ adults: Math.max(1, Math.min(20, adults)) }),
      setChildren: (children) =>
        set({ children: Math.max(0, Math.min(20, children)) }),
      setGuestSpecialRequirements: (reqs) => {
        const next = normalizeGuestSpecialRequirements(reqs);
        set({
          guestSpecialRequirements: next,
          // null ≠ acked — only when both Dietary & Mobility are Yes/No
          guestSpecialRequirementsAcked:
            guestSpecialRequirementsChoicesComplete(next),
        });
      },
      ackGuestSpecialRequirements: () => {
        const reqs = get().guestSpecialRequirements;
        if (!guestSpecialRequirementsChoicesComplete(reqs)) return;
        set({ guestSpecialRequirementsAcked: true });
      },
      setTourHours: (tourHours) => {
        const next = clampCustomTourHours(tourHours);
        const { needsAgentConfirmation } = resolveTourHoursTier(next);
        set({
          tourHours: next,
          needsAgentConfirmation,
        });
      },
      setTourHoursCustom: (tourHoursCustom) => set({ tourHoursCustom }),
      setTravelPace: (travelPace) => set({ travelPace }),
      setStartTime: (startTime) => set({ startTime }),
      setGuidePreference: (guidePreference) => set({ guidePreference }),
      setCityFocus: (cityFocus) =>
        set({ cityFocus, experiencesStepDone: false }),
      changeCityFocus: (cityFocus) =>
        set({
          cityFocus: String(cityFocus || "").trim(),
          meetingPoint: "",
          meetingPointName: "",
          meetingPointLat: null,
          meetingPointLng: null,
          meetingPointPlaceId: "",
          meetingLogisticsConfirmed: false,
          selectedExperiences: [],
          experiencesStepDone: false,
          preferredTourLanguage: "EN",
        }),
      setPreferredTourLanguage: (preferredTourLanguage) =>
        set({ preferredTourLanguage: preferredTourLanguage || "EN" }),
      setMeetingPoint: (meetingPoint) =>
        set({
          meetingPoint: String(meetingPoint ?? ""),
          meetingPointName: String(meetingPoint ?? ""),
        }),
      setMeetingPointCoords: (lat, lng) =>
        set({
          meetingPointLat:
            lat == null || !Number.isFinite(lat) ? null : lat,
          meetingPointLng:
            lng == null || !Number.isFinite(lng) ? null : lng,
        }),
      setMeetingPointDetails: ({ name, address, lat, lng, placeId }) =>
        set({
          meetingPointName: String(name || "").trim(),
          meetingPoint: String(address || name || "").trim(),
          meetingPointLat:
            lat == null || !Number.isFinite(lat) ? null : lat,
          meetingPointLng:
            lng == null || !Number.isFinite(lng) ? null : lng,
          meetingPointPlaceId: String(placeId || "").trim(),
        }),
      setMeetingLogisticsConfirmed: (meetingLogisticsConfirmed) =>
        set({ meetingLogisticsConfirmed: Boolean(meetingLogisticsConfirmed) }),
      setPreferredMovement: (preferredMovement) => set({ preferredMovement }),
      setGuestTransitPasses: (answers) =>
        set((state) => {
          const guestHasJRPass =
            typeof answers.guestHasJRPass === "boolean"
              ? answers.guestHasJRPass
              : state.guestHasJRPass;
          const guestHasICCard =
            typeof answers.guestHasICCard === "boolean"
              ? answers.guestHasICCard
              : state.guestHasICCard;
          const guestNeedsTransitHelp =
            typeof answers.guestNeedsTransitHelp === "boolean"
              ? answers.guestNeedsTransitHelp
              : state.guestNeedsTransitHelp;
          return {
            guestHasJRPass,
            guestHasICCard,
            guestNeedsTransitHelp,
            // Help arranging passes / no IC → Suica prepare for Ticketer
            suicaNeeded:
              guestHasICCard === false || guestNeedsTransitHelp === true,
          };
        }),
      setSuicaPreference: (opts) =>
        set({
          suicaNeeded: Boolean(opts.suicaNeeded),
          suicaValueEur: Math.max(
            0,
            Number(opts.suicaValueEur) || get().suicaValueEur || 15
          ),
          guestHasICCard: opts.suicaNeeded ? false : true,
          guestNeedsTransitHelp: Boolean(opts.suicaNeeded),
        }),
      setExperiencesStepDone: (experiencesStepDone) =>
        set({ experiencesStepDone }),

      addExperience: (row) =>
        set({
          selectedExperiences: [
            ...get().selectedExperiences.filter((e) => e.tourId !== row.tourId),
            row,
          ],
          experiencesStepDone: true,
        }),

      removeExperience: (tourId) =>
        set({
          selectedExperiences: get().selectedExperiences.filter(
            (e) => e.tourId !== tourId
          ),
        }),

      addTransportProduct: (line) => {
        const without = (get().selectedTransportProducts || []).filter(
          (x) => x.productId !== line.productId
        );
        set({ selectedTransportProducts: [...without, line] });
      },

      removeTransportProduct: (productId) =>
        set({
          selectedTransportProducts: (
            get().selectedTransportProducts || []
          ).filter((x) => x.productId !== productId),
        }),

      reorderExperiences: (fromIndex, toIndex) => {
        const list = [...get().selectedExperiences];
        if (
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= list.length ||
          toIndex >= list.length ||
          fromIndex === toIndex
        ) {
          return;
        }
        const [item] = list.splice(fromIndex, 1);
        list.splice(toIndex, 0, item);
        set({ selectedExperiences: list });
      },

      addStop: (blockId) =>
        set({
          blocks: get().blocks.map((block) =>
            block.id === blockId
              ? { ...block, stops: [...block.stops, emptyStop()] }
              : block
          ),
        }),

      updateStop: (blockId, stopId, patch) =>
        set({
          blocks: get().blocks.map((block) => {
            if (block.id !== blockId) return block;
            return {
              ...block,
              stops: block.stops.map((stop) =>
                stop.id === stopId ? { ...stop, ...patch } : stop
              ),
            };
          }),
        }),

      removeStop: (blockId, stopId) =>
        set({
          blocks: get().blocks.map((block) => {
            if (block.id !== blockId) return block;
            return {
              ...block,
              stops: block.stops.filter((stop) => stop.id !== stopId),
            };
          }),
        }),

      reset: () =>
        set({
          ...initialState,
          blocks: initialBlocks.map((b) => ({
            ...b,
            stops: b.stops.map((s) => ({ ...s })),
          })),
          selectedExperiences: [],
          selectedTransportProducts: [],
          experiencesStepDone: false,
        }),
    }),
    {
      name: "single-day-builder",
      version: 13,
      migrate: (persisted, version) => {
        const p = (persisted || {}) as Record<string, unknown>;
        if (version < 3) {
          const rawHours = Number(p.tourHours);
          const tourHours = Number.isFinite(rawHours) && rawHours >= 1
            ? rawHours
            : 6;
          const isPreset = (TOUR_HOUR_PRESETS as number[]).includes(tourHours);
          return {
            ...initialState,
            ...p,
            totalDays: 1 as const,
            tourDate:
              typeof p.tourDate === "string" ? p.tourDate : null,
            adults: typeof p.adults === "number" ? p.adults : 2,
            children: typeof p.children === "number" ? p.children : 0,
            tourHours,
            tourHoursCustom:
              typeof p.tourHoursCustom === "boolean"
                ? p.tourHoursCustom
                : !isPreset,
            travelPace:
              p.travelPace === "fast" ||
              p.travelPace === "moderate" ||
              p.travelPace === "relaxed"
                ? p.travelPace
                : null,
            preferredTourLanguage:
              typeof p.preferredTourLanguage === "string"
                ? p.preferredTourLanguage
                : "EN",
            selectedExperiences: Array.isArray(p.selectedExperiences)
              ? (p.selectedExperiences as SingleDaySelectedExperience[])
              : [],
            selectedTransportProducts: Array.isArray(
              p.selectedTransportProducts
            )
              ? p.selectedTransportProducts
              : [],
            experiencesStepDone: Boolean(p.experiencesStepDone),
          } as SingleDayBuilderState;
        }
        if (version < 4) {
          return {
            ...(p as unknown as SingleDayBuilderState),
            experiencesStepDone: Boolean(p.experiencesStepDone),
            preferredTourLanguage:
              typeof p.preferredTourLanguage === "string"
                ? p.preferredTourLanguage
                : "EN",
          };
        }
        if (version < 5) {
          return {
            ...(p as unknown as SingleDayBuilderState),
            preferredTourLanguage:
              typeof p.preferredTourLanguage === "string"
                ? p.preferredTourLanguage
                : "EN",
          };
        }
        if (version < 6) {
          return {
            ...(p as unknown as SingleDayBuilderState),
            selectedTransportProducts: Array.isArray(
              p.selectedTransportProducts
            )
              ? (p.selectedTransportProducts as import("@/lib/transportProducts").TransportTicketLine[])
              : [],
          };
        }
        if (version < 7) {
          return {
            ...(p as unknown as SingleDayBuilderState),
            meetingPointLat:
              typeof p.meetingPointLat === "number" ? p.meetingPointLat : null,
            meetingPointLng:
              typeof p.meetingPointLng === "number" ? p.meetingPointLng : null,
          };
        }
        if (version < 8) {
          return {
            ...(p as unknown as SingleDayBuilderState),
            meetingPointName:
              typeof p.meetingPointName === "string"
                ? p.meetingPointName
                : typeof p.meetingPoint === "string"
                  ? p.meetingPoint
                  : "",
            meetingPointPlaceId:
              typeof p.meetingPointPlaceId === "string"
                ? p.meetingPointPlaceId
                : "",
          };
        }
        if (version < 9) {
          return {
            ...(p as unknown as SingleDayBuilderState),
            suicaNeeded: Boolean(p.suicaNeeded),
            suicaValueEur:
              typeof p.suicaValueEur === "number" && p.suicaValueEur > 0
                ? p.suicaValueEur
                : 15,
          };
        }
        if (version < 10) {
          const prior = p as unknown as SingleDayBuilderState;
          return {
            ...prior,
            meetingLogisticsConfirmed:
              prior.meetingLogisticsConfirmed === true ||
              Boolean(String(prior.meetingPoint || "").trim()),
          };
        }
        if (version < 11) {
          const prior = p as unknown as SingleDayBuilderState;
          const raw = Number(prior.tourHours);
          // Drop legacy 3h preset → 6h; clamp custom into 5–10.
          const normalized =
            raw === 3 ? 6 : Number.isFinite(raw) ? clampCustomTourHours(raw) : 6;
          const isPreset = (TOUR_HOUR_PRESETS as number[]).includes(normalized);
          const { needsAgentConfirmation } = resolveTourHoursTier(normalized);
          return {
            ...prior,
            tourHours: normalized,
            tourHoursCustom: isPreset
              ? false
              : typeof prior.tourHoursCustom === "boolean"
                ? prior.tourHoursCustom
                : true,
            needsAgentConfirmation,
          };
        }
        if (version < 12) {
          const prior = p as unknown as SingleDayBuilderState;
          const acked = prior.guestSpecialRequirementsAcked === true;
          const guestSpecialRequirements = migrateUnsetGuestSpecialRequirements(
            prior.guestSpecialRequirements,
            acked
          );
          return {
            ...prior,
            guestSpecialRequirements,
            guestSpecialRequirementsAcked:
              acked &&
              guestSpecialRequirementsChoicesComplete(guestSpecialRequirements),
          };
        }
        if (version < 13) {
          const prior = p as unknown as SingleDayBuilderState;
          // Drop legacy mock Senso-ji / Yanaka / Golden Gai seed blocks.
          return {
            ...prior,
            blocks: initialBlocks.map((b) => ({
              ...b,
              stops: b.stops.map((s) => ({ ...s })),
            })),
          };
        }
        return p as unknown as SingleDayBuilderState;
      },
    }
  )
);

export function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function totalScheduledMinutes(blocks: DayBlock[]): number {
  return blocks.reduce(
    (sum, block) =>
      sum + block.stops.reduce((s, stop) => s + (stop.durationMinutes || 0), 0),
    0
  );
}

export function formatSingleDayDisplayDate(
  iso: string | null | undefined
): string {
  if (!iso) return "";
  // Accept "2026-09-25", "2026-09-25T00:00:00.000Z", "2026-09-24 00:00:00.000Z"
  const raw = String(iso).trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sept",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${day} ${months[mo - 1]} ${y}`;
}
