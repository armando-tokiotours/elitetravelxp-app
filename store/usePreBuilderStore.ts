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
  /** True when brief was loaded from Manage / email link (already in DB). */
  isAlreadySaved: boolean;
  /**
   * TEMPORARY_UNSAVED = quiz done, no PocketBase contact yet.
   * SAVED = contact captured / server draft exists.
   */
  pnrDraftStatus: "TEMPORARY_UNSAVED" | "SAVED" | null;
  /** Server/local count of boarding-pass emails dispatched for this PNR. */
  emailSentCount: number;
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
  markTemporaryDraft: (payload: {
    bookingRef: string;
    itineraryData: string;
  }) => void;
  markSubmitted: (payload: PreEliteBookingPayload) => void;
  /** Mark session as retrieved from email/Manage — unlocks Trip Builder. */
  markRetrievedFromManage: (opts?: { emailSentCount?: number }) => void;
  bumpEmailSentCount: (count?: number) => void;
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
      isAlreadySaved: false,
      pnrDraftStatus: null,
      emailSentCount: 0,

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

      markTemporaryDraft: ({ bookingRef, itineraryData }) => {
        try {
          window.localStorage.setItem("pnr_draft_status", "TEMPORARY_UNSAVED");
        } catch {
          /* private mode */
        }
        set({
          bookingRef,
          submittedAt: new Date().toISOString(),
          lastPayload: {
            bookingRef,
            fullName: get().fullName.trim() || "Guest",
            email: get().email.trim().toLowerCase(),
            whatsapp: get().whatsapp.trim(),
            status: "draft",
            itineraryData,
          },
          isAlreadySaved: false,
          pnrDraftStatus: "TEMPORARY_UNSAVED",
          emailSentCount: 0,
        });
      },

      markSubmitted: (payload) => {
        try {
          window.localStorage.setItem("pnr_draft_status", "SAVED");
        } catch {
          /* private mode */
        }
        set({
          bookingRef: payload.bookingRef,
          submittedAt: new Date().toISOString(),
          lastPayload: payload,
          // Fresh qualification — email not sent until Save & Email
          isAlreadySaved: true,
          pnrDraftStatus: "SAVED",
          emailSentCount: 0,
          fullName: payload.fullName || get().fullName,
          email: payload.email || get().email,
        });
      },

      markRetrievedFromManage: ({ emailSentCount } = {}) =>
        set({
          isAlreadySaved: true,
          emailSentCount: Math.max(1, Number(emailSentCount) || 1),
        }),

      bumpEmailSentCount: (count) =>
        set({
          emailSentCount:
            typeof count === "number" && count >= 0
              ? count
              : get().emailSentCount + 1,
          isAlreadySaved: true,
        }),

      reset: () =>
        set({
          ...emptyDraft(),
          step: 1,
          bookingRef: null,
          submittedAt: null,
          lastPayload: null,
          isAlreadySaved: false,
          pnrDraftStatus: null,
          emailSentCount: 0,
        }),
    }),
    {
      name: "pre-elite-builder",
      version: 5,
      migrate: (persisted) => {
        if (!persisted || typeof persisted !== "object") {
          return {
            ...emptyDraft(),
            step: 1,
            isAlreadySaved: false,
            pnrDraftStatus: null,
            emailSentCount: 0,
          };
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
          isAlreadySaved: Boolean(p.isAlreadySaved),
          pnrDraftStatus:
            p.pnrDraftStatus === "TEMPORARY_UNSAVED" || p.pnrDraftStatus === "SAVED"
              ? p.pnrDraftStatus
              : p.isAlreadySaved
                ? "SAVED"
                : null,
          emailSentCount: Math.max(0, Number(p.emailSentCount) || 0),
        };
      },
    }
  )
);
