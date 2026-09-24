import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TourDurationHours = 3 | 6 | 8;
export type GuidePreference = "private_guide" | "local_host" | "self_paced";
export type IntraCityTransport = "walk" | "subway" | "private_driver";
export type DayBlockId = "morning" | "afternoon" | "evening";
export type SingleDayTravelPace = "fast" | "moderate" | "relaxed" | null;

export const TOUR_HOUR_PRESETS: TourDurationHours[] = [3, 6, 8];

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
}

export interface SingleDayBuilderState {
  /** Always 1 for Builder S — never synced to multi-day durationDays. */
  totalDays: 1;
  tourDate: string | null;
  adults: number;
  children: number;
  /** Tour length in hours (presets 3/6/8 or custom ≥ 1). */
  tourHours: number;
  tourHoursCustom: boolean;
  travelPace: SingleDayTravelPace;
  startTime: string;
  guidePreference: GuidePreference;
  cityFocus: string;
  /** Preferred guided language code for the city (EN, JA, …). */
  preferredTourLanguage: string;
  blocks: DayBlock[];
  selectedExperiences: SingleDaySelectedExperience[];
  /** True after Save & Continue on Experiences (allows empty / skip). */
  experiencesStepDone: boolean;
  setTourDate: (iso: string | null) => void;
  setAdults: (n: number) => void;
  setChildren: (n: number) => void;
  setTourHours: (hours: number) => void;
  setTourHoursCustom: (custom: boolean) => void;
  setTravelPace: (pace: SingleDayTravelPace) => void;
  setStartTime: (time: string) => void;
  setGuidePreference: (pref: GuidePreference) => void;
  setCityFocus: (city: string) => void;
  setPreferredTourLanguage: (code: string) => void;
  addExperience: (row: SingleDaySelectedExperience) => void;
  removeExperience: (tourId: string) => void;
  reorderExperiences: (fromIndex: number, toIndex: number) => void;
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

const initialBlocks: DayBlock[] = [
  {
    id: "morning",
    label: "Morning",
    stops: [
      {
        id: "m1",
        location: "Asakusa",
        experience: "Senso-ji & Nakamise walk",
        durationMinutes: 90,
        transportToNext: "subway",
      },
    ],
  },
  {
    id: "afternoon",
    label: "Afternoon",
    stops: [
      {
        id: "a1",
        location: "Yanaka",
        experience: "Hidden temple lanes & café stop",
        durationMinutes: 120,
        transportToNext: "walk",
      },
    ],
  },
  {
    id: "evening",
    label: "Evening",
    stops: [
      {
        id: "e1",
        location: "Golden Gai",
        experience: "Intimate bar hop with host",
        durationMinutes: 90,
        transportToNext: "walk",
      },
    ],
  },
];

const initialState = {
  totalDays: 1 as const,
  tourDate: null as string | null,
  adults: 2,
  children: 0,
  tourHours: 6,
  tourHoursCustom: false,
  travelPace: null as SingleDayTravelPace,
  startTime: "09:00",
  guidePreference: "private_guide" as GuidePreference,
  cityFocus: "Tokyo",
  preferredTourLanguage: "EN",
  blocks: initialBlocks,
  selectedExperiences: [] as SingleDaySelectedExperience[],
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
      setTourHours: (tourHours) => {
        const next = Math.max(1, Math.min(16, Math.round(tourHours) || 1));
        const isPreset = ([3, 6, 8] as number[]).includes(next);
        set({
          tourHours: next,
          ...(isPreset ? { tourHoursCustom: false } : {}),
        });
      },
      setTourHoursCustom: (tourHoursCustom) => set({ tourHoursCustom }),
      setTravelPace: (travelPace) => set({ travelPace }),
      setStartTime: (startTime) => set({ startTime }),
      setGuidePreference: (guidePreference) => set({ guidePreference }),
      setCityFocus: (cityFocus) =>
        set({ cityFocus, experiencesStepDone: false }),
      setPreferredTourLanguage: (preferredTourLanguage) =>
        set({ preferredTourLanguage: preferredTourLanguage || "EN" }),
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
          experiencesStepDone: false,
        }),
    }),
    {
      name: "single-day-builder",
      version: 5,
      migrate: (persisted, version) => {
        const p = (persisted || {}) as Record<string, unknown>;
        if (version < 3) {
          const rawHours = Number(p.tourHours);
          const tourHours = Number.isFinite(rawHours) && rawHours >= 1
            ? rawHours
            : 6;
          const isPreset = ([3, 6, 8] as number[]).includes(tourHours);
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
