import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  emptyDraft,
  emptyTiming,
  isTripType,
  normalizeTiming,
  type InterestId,
  type MotivationId,
  type PainPointId,
  type PreEliteBookingPayload,
  type PreEliteDraft,
  type TravelStyleId,
  type TripType,
} from "@/lib/preEliteBuilder";

interface PreBuilderState extends PreEliteDraft {
  step: number;
  bookingRef: string | null;
  submittedAt: string | null;
  lastPayload: PreEliteBookingPayload | null;
  setStep: (step: number) => void;
  setTravelStyle: (travelStyle: TravelStyleId) => void;
  toggleInterest: (id: InterestId) => void;
  setTripMotivation: (tripMotivation: MotivationId) => void;
  togglePainPoint: (id: PainPointId) => void;
  setTripType: (tripType: TripType) => void;
  setContact: (
    patch: Partial<
      Pick<
        PreEliteDraft,
        | "fullName"
        | "email"
        | "whatsapp"
        | "timing"
        | "adults"
        | "children"
        | "tripType"
      >
    >
  ) => void;
  markSubmitted: (payload: PreEliteBookingPayload) => void;
  reset: () => void;
}

const initial = emptyDraft();

export const usePreBuilderStore = create<PreBuilderState>()(
  persist(
    (set, get) => ({
      ...initial,
      step: 1,
      bookingRef: null,
      submittedAt: null,
      lastPayload: null,

      setStep: (step) => set({ step }),

      setTravelStyle: (travelStyle) => set({ travelStyle }),

      toggleInterest: (id) => {
        const current = get().interests;
        set({
          interests: current.includes(id)
            ? current.filter((item) => item !== id)
            : [...current, id],
        });
      },

      setTripMotivation: (tripMotivation) => set({ tripMotivation }),

      togglePainPoint: (id) => {
        const current = get().painPoints;
        set({
          painPoints: current.includes(id)
            ? current.filter((item) => item !== id)
            : [...current, id],
        });
      },

      setTripType: (tripType) => {
        const timing =
          tripType === "single_day"
            ? normalizeTiming({ ...get().timing, totalDays: 1 })
            : get().timing;
        set({ tripType, timing });
      },

      setContact: (patch) => {
        const nextTripType = patch.tripType ?? get().tripType;
        let timing = patch.timing
          ? normalizeTiming(patch.timing)
          : get().timing;
        if (nextTripType === "single_day") {
          timing = normalizeTiming({ ...timing, totalDays: 1 });
        }
        set({
          ...patch,
          ...(patch.timing || nextTripType === "single_day" ? { timing } : {}),
        });
      },

      markSubmitted: (payload) =>
        set({
          bookingRef: payload.bookingRef,
          submittedAt: new Date().toISOString(),
          lastPayload: payload,
        }),

      reset: () =>
        set({
          ...emptyDraft(),
          step: 1,
          bookingRef: null,
          submittedAt: null,
          lastPayload: null,
        }),
    }),
    {
      name: "pre-elite-builder",
      version: 3,
      migrate: (persisted) => {
        if (!persisted || typeof persisted !== "object") {
          return { ...emptyDraft(), step: 1 };
        }
        const p = persisted as Record<string, unknown>;
        const timing =
          p.timing != null
            ? normalizeTiming(p.timing)
            : typeof p.dates === "string" && p.dates.trim()
              ? {
                  ...emptyTiming(),
                  formattedString: String(p.dates).trim(),
                  targetMonth: String(p.dates).trim(),
                }
              : emptyTiming();
        const tripType = isTripType(p.tripType) ? p.tripType : null;
        const { dates: _legacyDates, ...rest } = p as {
          dates?: unknown;
        } & Record<string, unknown>;
        return {
          ...rest,
          timing:
            tripType === "single_day"
              ? normalizeTiming({ ...timing, totalDays: 1 })
              : timing,
          tripType,
        };
      },
    }
  )
);
