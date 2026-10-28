"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Clock, MapPin, TrainFront } from "lucide-react";
import type { BuilderConfig, PbCity, PbTour } from "@/lib/pocketbase/client";
import {
  cityPhoto,
  getPocketBase,
  pbFileUrl,
  tourPhoto,
  tourPrice,
} from "@/lib/pocketbase/client";
import { PB_THUMBS } from "@/lib/mediaStandards";
import {
  formatMinutes,
  formatSingleDayDisplayDate,
  useSingleDayBuilderStore,
  type IntraCityTransport,
} from "@/store/useSingleDayBuilderStore";
import {
  countsTowardGuideHours,
  filterCatalogByCity,
  isGuideBudgetCatalogItem,
  selectedExtraHoursTotal,
  selectedGuideHoursTotal,
  selectedHoursTotal,
  type CatalogItem,
} from "@/lib/experiencesPlaces";
import { GuideTimeMeter } from "@/components/builder-s/GuideTimeMeter";
import { useBuilderStore } from "@/store/useBuilderStore";
import { useLazyModalMount } from "@/components/builder/modals/useLazyModalMount";
import { CityLanguageSelect } from "@/components/builder/CityLanguageSelect";
import { CatalogSlotImg } from "@/components/catalog/CatalogSlotPhoto";
import { ensureCatalogPlaceholder } from "@/lib/catalogMedia";
import { tourPhotoOwnerId } from "@/lib/tourFamilies";
import { TimelineMascotRow } from "@/components/branding/TimelineMascotRow";
import { BuilderEditModalShell } from "@/components/builder/modals/BuilderEditModalShell";
import {
  MeetingPointPlacesPicker,
  type MeetingPointResolved,
} from "@/components/builder/MeetingPointPlacesPicker";
import { LazyVideo } from "@/components/ui/LazyVideo";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";
import { TripRangeMiniCalendar } from "@/components/builder/TripRangeMiniCalendar";
import { TransitPassQuestionnaire } from "@/components/builder/TransitPassQuestionnaire";
import { languageFlag, languageToCode } from "@/lib/tourLanguages";
import {
  OPEN_DISCOVER_EVENT,
  type OpenDiscoverEventDetail,
} from "@/components/navigation/AppNavDock";
import {
  getWidgetPulsarClass,
  WidgetApprovedCheck,
  WidgetCallingPulse,
} from "@/components/branding/WidgetCallingPulse";
import { syncSingleDayBookingLead } from "@/lib/syncBookingLead";
import { useItineraryStore } from "@/store/useItineraryStore";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";

const SingleDayTripDetailModal = dynamic(
  () =>
    import("@/components/builder-s/SingleDayTripDetailModal").then((m) => ({
      default: m.SingleDayTripDetailModal,
    })),
  { ssr: false }
);

const SingleDayGuestsEditorModal = dynamic(
  () =>
    import("@/components/builder-s/SingleDayGuestsEditorModal").then((m) => ({
      default: m.SingleDayGuestsEditorModal,
    })),
  { ssr: false }
);

const ExperiencesPlacesModal = dynamic(
  () =>
    import("@/components/builder-s/ExperiencesPlacesModal").then((m) => ({
      default: m.ExperiencesPlacesModal,
    })),
  { ssr: false }
);

const DiscoverOverlay = dynamic(
  () =>
    import("@/components/discover/DiscoverOverlay").then((m) => ({
      default: m.DiscoverOverlay,
    })),
  { ssr: false }
);

const CityFocusModal = dynamic(
  () =>
    import("@/components/builder/modals/CityFocusModal").then((m) => ({
      default: m.CityFocusModal,
    })),
  { ssr: false }
);

const MovementDetailModal = dynamic(
  () =>
    import("@/components/builder-s/MovementDetailModal").then((m) => ({
      default: m.MovementDetailModal,
    })),
  { ssr: false }
);

type SEditId =
  | "duration"
  | "guests"
  | "locations"
  | "tours"
  | "logistics"
  | "meeting"
  | null;

type GlowStep =
  | "city"
  | "hours"
  | "guests"
  | "language"
  | "meeting"
  | "tours"
  | "transport"
  | "save";

type PulsarStep =
  | "city"
  | "duration"
  | "guests"
  | "meeting"
  | "tours"
  | "transport"
  | "save";

/** Sequential approval order for Express Pass guided flow. */
const APPROVAL_FLOW = [
  "city",
  "duration",
  "guests",
  "meeting",
  "tours",
  "transport",
] as const;
type ApprovalStep = (typeof APPROVAL_FLOW)[number];

const MODAL_TO_APPROVAL: Partial<Record<Exclude<SEditId, null>, ApprovalStep>> =
  {
    locations: "city",
    duration: "duration",
    guests: "guests",
    meeting: "meeting",
    tours: "tours",
    logistics: "transport",
  };

/** Outer shell — no overflow-hidden (clips calling pulse). Clip media on an inner layer. */
const WIDGET_SHELL =
  "w-full bg-[#0A1017]/90 border rounded-[22px] p-4 text-left relative overflow-visible shadow-xl hover:border-amber-500/40 transition-all active:scale-95 group";

const WIDGET_SHELL_LOCKED =
  "w-full bg-[#0A1017]/70 border rounded-[22px] p-4 text-left relative overflow-visible border-white/5 opacity-55 cursor-not-allowed shadow-none";

const HALF = `${WIDGET_SHELL} h-36`;

const TRANSPORT_OPTIONS: {
  id: IntraCityTransport;
  label: string;
  subtitle: string;
  brandingKey: string;
}[] = [
  {
    id: "subway",
    label: "Public Transport",
    subtitle: "IC card + guided subway & rail transfers",
    brandingKey: "transit_subway",
  },
  {
    id: "private_driver",
    label: "Private Driver",
    subtitle: "Door-to-door chartered vehicle",
    brandingKey: "transit_private_driver",
  },
  {
    id: "mix",
    label: "Mix (Private & Public)",
    subtitle: "Balanced combination of private transfers & local rail",
    brandingKey: "transit_mix",
  },
];

function WidgetLabel({
  children,
  muted,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <span
      className={`mt-1 block text-center font-mono text-[10px] ${
        muted ? "text-slate-500" : "text-slate-600"
      }`}
    >
      {children}
    </span>
  );
}

/**
 * Builder S — iOS widget grid (no accordion sections).
 */
export function BuilderSView({
  config,
  catalog,
  selectedCity,
  onSelectCity,
  onActivePulsarStepChange,
  headerSlot,
  stripTitleSlot,
  stripTrailingSlot,
}: {
  config: BuilderConfig | null;
  catalog: PbTour[];
  selectedCity: PbCity | null;
  onSelectCity: (city: PbCity) => void;
  /** Lets parent pulse Save & View when guided flow reaches the end. */
  onActivePulsarStepChange?: (step: PulsarStep | null) => void;
  /** Rendered in the sticky dark header (with mascot) in place of the old timeline. */
  headerSlot?: React.ReactNode;
  /** Centred title inside the guest strip, on the guest-name line. */
  stripTitleSlot?: React.ReactNode;
  /** Control to the right of the strip mascot (e.g. restart). */
  stripTrailingSlot?: React.ReactNode;
}) {
  const [activeEditModal, setActiveEditModal] = useState<SEditId>(null);
  const [showDiscover, setShowDiscover] = useState(false);
  const [movementModal, setMovementModal] =
    useState<IntraCityTransport | null>(null);
  const [transitPassOpen, setTransitPassOpen] = useState(false);
  /** After city change confirm, force guided pulsar onto Hours & Date. */
  const [pulsarOverride, setPulsarOverride] = useState<GlowStep | null>(null);
  const [activePulsarStep, setActivePulsarStep] = useState<PulsarStep | null>(
    "city"
  );
  /** City requires explicit ✓ approval before Hours & Date unlocks. */
  const [cityApproved, setCityApproved] = useState(false);
  const [approvedCityName, setApprovedCityName] = useState("");

  const durationMounted = useLazyModalMount(activeEditModal === "duration");
  const guestsMounted = useLazyModalMount(activeEditModal === "guests");
  const cityMounted = useLazyModalMount(activeEditModal === "locations");
  const toursMounted = useLazyModalMount(activeEditModal === "tours");
  const logisticsMounted = useLazyModalMount(activeEditModal === "logistics");
  const meetingMounted = useLazyModalMount(activeEditModal === "meeting");

  const bookingStatus = useBuilderStore((s) => s.bookingStatus);
  const confirmedBookingRef = useBuilderStore((s) => s.confirmedBookingRef);
  /**
   * Confirmed / in-progress bookings (logged-in PNR, not draft) skip guided
   * gating + pulsar and unlock every widget for free editing.
   */
  const isConfirmedBooking =
    Boolean(confirmedBookingRef) && bookingStatus !== "draft";

  const tourDate = useSingleDayBuilderStore((s) => s.tourDate);
  const tourHours = useSingleDayBuilderStore((s) => s.tourHours);
  const adults = useSingleDayBuilderStore((s) => s.adults);
  const children = useSingleDayBuilderStore((s) => s.children);
  const travelPace = useSingleDayBuilderStore((s) => s.travelPace);
  const cityFocus = useSingleDayBuilderStore((s) => s.cityFocus);
  const selectedExperiences = useSingleDayBuilderStore(
    (s) => s.selectedExperiences
  );
  const addExperience = useSingleDayBuilderStore((s) => s.addExperience);
  const removeExperience = useSingleDayBuilderStore((s) => s.removeExperience);
  const startTime = useSingleDayBuilderStore((s) => s.startTime);
  const meetingPoint = useSingleDayBuilderStore((s) => s.meetingPoint);
  const meetingPointName = useSingleDayBuilderStore((s) => s.meetingPointName);
  const meetingPointLat = useSingleDayBuilderStore((s) => s.meetingPointLat);
  const meetingPointLng = useSingleDayBuilderStore((s) => s.meetingPointLng);
  const meetingLogisticsConfirmed = useSingleDayBuilderStore(
    (s) => s.meetingLogisticsConfirmed
  );
  const preferredMovement = useSingleDayBuilderStore(
    (s) => s.preferredMovement
  );
  const guestHasJRPass = useSingleDayBuilderStore((s) => s.guestHasJRPass);
  const guestHasICCard = useSingleDayBuilderStore((s) => s.guestHasICCard);
  const suicaNeeded = useSingleDayBuilderStore((s) => s.suicaNeeded);
  const suicaValueEur = useSingleDayBuilderStore((s) => s.suicaValueEur);
  const guestNeedsTransitHelp = useSingleDayBuilderStore(
    (s) => s.guestNeedsTransitHelp
  );
  const setGuestTransitPasses = useSingleDayBuilderStore(
    (s) => s.setGuestTransitPasses
  );
  const setSuicaPreference = useSingleDayBuilderStore(
    (s) => s.setSuicaPreference
  );
  const setBuilderTransitPasses = useBuilderStore((s) => s.setGuestTransitPasses);
  const preferredTourLanguage = useSingleDayBuilderStore(
    (s) => s.preferredTourLanguage
  );
  const setPreferredMovement = useSingleDayBuilderStore(
    (s) => s.setPreferredMovement
  );
  const guestCount = adults + children;
  const dateText = tourDate ? formatSingleDayDisplayDate(tourDate) : null;
  const paceLabel =
    travelPace === "fast"
      ? "Fast pace"
      : travelPace === "relaxed"
        ? "Relaxed pace"
        : travelPace === "moderate"
          ? "Balanced pace"
          : "Set pace";
  const transportLabel =
    preferredMovement === "private_driver"
      ? "Private Driver"
      : preferredMovement === "subway"
        ? "Public Transport"
        : preferredMovement === "mix"
          ? "Mix (Private & Public)"
          : preferredMovement === "walk"
            ? "Walk"
            : "Set transport";

  const cities = config?.cities ?? [];
  /** Live selected stops — not legacy mock `blocks` (Senso-ji seed). */
  const scheduled = Math.round(selectedHoursTotal(selectedExperiences) * 60);

  const focusedCity = useMemo(() => {
    if (!cityFocus.trim()) return null;
    return selectedCity &&
      selectedCity.name.trim().toLowerCase() === cityFocus.trim().toLowerCase()
      ? selectedCity
      : (cities.find(
          (c) => c.name.trim().toLowerCase() === cityFocus.trim().toLowerCase()
        ) ?? null);
  }, [cityFocus, cities, selectedCity]);

  /** Legacy PocketBase cover only — the widget photo itself resolves
   * slot-first via CatalogSlotImg (`{cityId}_1.webp`). The old static
   * `/images/cities/{slug}-thumb.jpg` resolver 404'd (empty directory). */
  const cityThumb = useMemo(() => {
    const city = focusedCity;
    const filename = city ? cityPhoto(city) : "";
    return city && filename && city.collectionId
      ? pbFileUrl(city.collectionId, city.id, filename, {
          thumb: PB_THUMBS.card,
          format: "webp",
        })
      : "";
  }, [focusedCity]);

  // Self-heal the focused city's own slot (named placeholder if no
  // photo yet) — staff-only server-side, silent no-op for guests.
  useEffect(() => {
    if (!focusedCity?.id) return;
    const token = getPocketBase().authStore.token || "";
    void ensureCatalogPlaceholder(focusedCity.id, focusedCity.name, token).catch(
      () => false
    );
  }, [focusedCity?.id, focusedCity?.name]);

  const meetingStepDone =
    meetingLogisticsConfirmed ||
    Boolean((meetingPointName || "").trim() || meetingPoint.trim());

  // Keep city approval tied to the currently focused city name
  useEffect(() => {
    const focus = cityFocus.trim();
    if (!focus) {
      setCityApproved(false);
      setApprovedCityName("");
      return;
    }
    if (
      approvedCityName &&
      approvedCityName.toLowerCase() !== focus.toLowerCase()
    ) {
      setCityApproved(false);
    }
  }, [cityFocus, approvedCityName]);

  const stepComplete: Record<ApprovalStep, boolean> = useMemo(() => {
    const hasCity = Boolean(cityFocus.trim());
    // Explicit ✓ — or already progressed past city on a restored draft
    const cityDone =
      hasCity &&
      (cityApproved ||
        Boolean(tourDate) ||
        meetingStepDone ||
        selectedExperiences.length > 0 ||
        preferredMovement != null);
    return {
      city: cityDone,
      duration: Boolean(tourDate),
      // Guests & Pace card = party size + pace. Dietary/mobility reqs are
      // gated by the modal's own Done button; conflating their (possibly
      // migrated-to-pending) state here kept this card pulsing forever
      // after a save/reload even with guests + pace set.
      guests: travelPace !== null && guestCount > 0,
      meeting: meetingStepDone,
      tours: selectedExperiences.length > 0,
      transport: preferredMovement != null,
    };
  }, [
    cityFocus,
    cityApproved,
    tourDate,
    travelPace,
    guestCount,
    meetingStepDone,
    selectedExperiences.length,
    preferredMovement,
  ]);

  const activeApprovalStep: ApprovalStep | null = useMemo(() => {
    for (const step of APPROVAL_FLOW) {
      if (!stepComplete[step]) return step;
    }
    return null;
  }, [stepComplete]);

  const canOpenApprovalStep = useCallback(
    (step: ApprovalStep) => {
      if (isConfirmedBooking) return true; // paid / restored booking — full unlock
      if (!activeApprovalStep) return true; // all done — allow edits
      return (
        APPROVAL_FLOW.indexOf(step) <=
        APPROVAL_FLOW.indexOf(activeApprovalStep)
      );
    },
    [activeApprovalStep, isConfirmedBooking]
  );

  const openEditModal = useCallback(
    (id: Exclude<SEditId, null>) => {
      const step = MODAL_TO_APPROVAL[id];
      if (step && !canOpenApprovalStep(step)) return;
      if (
        id === "duration" ||
        id === "tours" ||
        id === "meeting" ||
        id === "logistics" ||
        id === "guests"
      ) {
        setPulsarOverride(null);
      }
      setActiveEditModal(id);
    },
    [canOpenApprovalStep]
  );

  const nextGlow = useMemo((): GlowStep | null => {
    // Confirmed / paid bookings: no guided pulsar
    if (isConfirmedBooking) return null;
    // Respect sequential approval — pulse only the active unlocked step
    if (activeApprovalStep === "city") return "city";
    if (activeApprovalStep === "duration") return "hours";
    if (activeApprovalStep === "guests") return "guests";
    if (activeApprovalStep === "meeting") return "meeting";
    if (activeApprovalStep === "tours") return "tours";
    if (activeApprovalStep === "transport") return "transport";
    if (pulsarOverride === "save" || preferredMovement != null) return "save";
    return "save";
  }, [
    isConfirmedBooking,
    activeApprovalStep,
    pulsarOverride,
    preferredMovement,
  ]);

  useEffect(() => {
    const map: Record<string, PulsarStep> = {
      city: "city",
      hours: "duration",
      guests: "guests",
      meeting: "meeting",
      tours: "tours",
      transport: "transport",
      save: "save",
    };
    if (!nextGlow) {
      setActivePulsarStep(null);
      return;
    }
    setActivePulsarStep(map[nextGlow] ?? "city");
  }, [nextGlow]);

  useEffect(() => {
    onActivePulsarStepChange?.(activePulsarStep);
  }, [activePulsarStep, onActivePulsarStepChange]);

  const meetMapBg = useMemo(() => {
    const hasMeeting =
      Boolean((meetingPointName || "").trim() || meetingPoint.trim()) ||
      (meetingPointLat != null &&
        meetingPointLng != null &&
        Number.isFinite(meetingPointLat) &&
        Number.isFinite(meetingPointLng));
    // After a meeting point is picked, use the Tokyo metro map canvas
    return hasMeeting ? "/brand/tokyo-metro-map.png" : "";
  }, [meetingPoint, meetingPointName, meetingPointLat, meetingPointLng]);

  /** Slot-first photos (`/uploads/catalog/{id}_1.webp`) — same as city
   * widget / Discover. Legacy PB cover fields are often empty after the
   * catalog-media migration (e.g. 2 Faces, Teamlab). */
  const experienceBands = useMemo(() => {
    const byId = Object.fromEntries(catalog.map((t) => [t.id, t]));
    return selectedExperiences.slice(0, 4).map((exp) => {
      const tour = byId[exp.tourId];
      const recordId = tour?.id || exp.tourId;
      const filename = tour ? tourPhoto(tour) : "";
      const fallbackSrc =
        tour && filename && tour.collectionId
          ? pbFileUrl(tour.collectionId, tour.id, filename, {
              thumb: PB_THUMBS.card,
              format: "webp",
            })
          : "";
      return {
        key: exp.tourId,
        title: tour?.title || exp.title,
        recordId,
        inheritRecordId: tour ? tourPhotoOwnerId(tour, catalog) : "",
        fallbackSrc,
      };
    });
  }, [catalog, selectedExperiences]);

  const discoverTours = useMemo(
    () =>
      filterCatalogByCity(
        catalog as CatalogItem[],
        focusedCity?.id ?? selectedCity?.id,
        focusedCity?.name ?? selectedCity?.name
      ),
    [catalog, focusedCity, selectedCity]
  );

  const openToursOrDiscover = useCallback(() => {
    if (!canOpenApprovalStep("tours")) return;
    // Always reopen Discover Reels — never the old ExperiencesPlacesModal
    setShowDiscover(true);
  }, [canOpenApprovalStep]);

  // AppNavDock Discover → same overlay as Tours & Experiences (ack so dock
  // does not also navigate to /discover).
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<OpenDiscoverEventDetail>).detail;
      detail?.acknowledge?.();
      setShowDiscover(true);
    };
    window.addEventListener(OPEN_DISCOVER_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_DISCOVER_EVENT, onOpen);
  }, []);

  const meetLabel =
    (meetingPointName || "").trim() ||
    meetingPoint.trim() ||
    "Set meeting point";
  const meetAddress =
    meetingPoint.trim() &&
    meetingPoint.trim() !== (meetingPointName || "").trim()
      ? meetingPoint.trim()
      : "Hotel / Hub Pick-Up";
  const langCode = languageToCode(preferredTourLanguage || "EN") || "EN";
  const langBadge = `lenguaje: ${languageFlag(preferredTourLanguage || "EN")} ${langCode}`;

  return (
    <>
      {headerSlot ? (
        <div className="sticky top-[3.75rem] z-40 w-[100dvw] max-w-[100dvw] [margin-left:calc(50%-50dvw)] [margin-right:calc(50%-50dvw)] overflow-visible border-b border-black/[0.06] bg-[#faf9f4]/90 px-3 py-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)] backdrop-blur-md lg:top-0 sm:px-6 lg:w-[calc(100dvw-4rem)] lg:max-w-[calc(100dvw-4rem)] lg:[margin-left:calc(50%_-_50dvw_+_2rem)] lg:[margin-right:calc(50%_-_50dvw_+_2rem)]">
          {/* Full-bleed cream strip under MobileTopChrome — flat cream,
              soft bottom elevation so scrolling content reads underneath.
              Mascot may overflow below; outer stays overflow-visible. */}
          <div className="relative z-10">
            <TimelineMascotRow
              variant="single"
              centerSlot={stripTitleSlot}
              trailingSlot={stripTrailingSlot}
            >
              {headerSlot}
            </TimelineMascotRow>
          </div>
        </div>
      ) : null}
      <div className="mx-auto w-full max-w-2xl space-y-5 overflow-visible px-4 py-6">
        <div className="overflow-visible">
          <div
            className={`${WIDGET_SHELL} ${getWidgetPulsarClass(activePulsarStep, "city")} relative h-[14.5rem] p-0`}
          >
            <WidgetCallingPulse
              active={activePulsarStep === "city"}
              tone="white"
            />
            <button
              type="button"
              aria-label={
                cityFocus.trim()
                  ? `Edit city focus: ${cityFocus}`
                  : "Choose city focus"
              }
              onClick={() => {
                // Always open full city selector — approve only via ticket-gate drag-up
                openEditModal("locations");
              }}
              className="absolute inset-0 z-0 overflow-hidden rounded-[22px] text-left"
            >
              {cityFocus.trim() && (focusedCity || cityThumb) ? (
                <>
                  {focusedCity ? (
                    <CatalogSlotImg
                      recordId={focusedCity.id}
                      fallbackSrc={cityThumb}
                      alt={cityFocus ? `${cityFocus} city` : "City focus"}
                      className="absolute inset-0 h-full w-full object-cover"
                      emptyClassName="absolute inset-0 bg-gradient-to-br from-[#1a3355] to-[#0B1F3A]"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cityThumb}
                      alt={cityFocus ? `${cityFocus} city` : "City focus"}
                      width={600}
                      height={400}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent"
                    aria-hidden
                  />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                      CITY FOCUS
                    </span>
                    <h3 className="mt-1 font-godiva text-xl font-black uppercase text-white">
                      {cityFocus}
                    </h3>
                  </div>
                </>
              ) : cityFocus.trim() ? (
                <div className="relative z-10 flex h-full flex-col justify-end overflow-hidden rounded-[22px] bg-gradient-to-br from-[#1a3355] to-[#0B1F3A] p-4">
                  <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                    CITY FOCUS
                  </span>
                  <h3 className="mt-1 font-godiva text-xl font-black uppercase text-white">
                    {cityFocus}
                  </h3>
                </div>
              ) : (
                <div className="relative z-10 flex h-full flex-col items-center justify-center gap-1 px-4 text-center">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                    City focus
                  </span>
                  <span className="text-sm font-bold uppercase text-zinc-400">
                    Tap photo to choose city
                  </span>
                </div>
              )}
            </button>

            {/* Top-right bare check — cyan only after ticket-gate insert */}
            <WidgetApprovedCheck show={isConfirmedBooking || stepComplete.city} />
          </div>
          <WidgetLabel>City</WidgetLabel>
        </div>

        <div className="grid grid-cols-2 items-start gap-3.5 overflow-visible">
          <div className="overflow-visible">
            <button
              type="button"
              aria-label="Edit tour hours and date"
              disabled={!canOpenApprovalStep("duration")}
              onClick={() => openEditModal("duration")}
              className={`${
                canOpenApprovalStep("duration")
                  ? `${WIDGET_SHELL} ${getWidgetPulsarClass(activePulsarStep, "duration")}`
                  : WIDGET_SHELL_LOCKED
              } min-h-[11.5rem] p-3.5`}
            >
              <WidgetCallingPulse
                active={activePulsarStep === "duration"}
                tone="white"
              />
              <WidgetApprovedCheck
                show={isConfirmedBooking || stepComplete.duration}
              />
              <div className="relative z-10 flex justify-start">
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-amber-400">
                  DAY
                </span>
              </div>
              <div className="relative z-10 mt-1">
                <h3 className="font-godiva text-lg font-black leading-none text-white sm:text-xl">
                  {tourHours}H TOUR
                </h3>
                <p className="mt-1 font-mono text-[11px] text-zinc-300">
                  {dateText
                    ? `${dateText} · ${startTime || "09:00"}`
                    : "Set Tour Date"}
                </p>
                <TripRangeMiniCalendar arrivalDate={tourDate} tripDays={1} />
              </div>
            </button>
            <WidgetLabel>Hours &amp; Date</WidgetLabel>
          </div>

          <div className="overflow-visible">
            <button
              type="button"
              aria-label="Edit guests and travel pace"
              disabled={!canOpenApprovalStep("guests")}
              onClick={() => openEditModal("guests")}
              className={`${
                canOpenApprovalStep("guests")
                  ? `${WIDGET_SHELL} ${getWidgetPulsarClass(activePulsarStep, "guests")}`
                  : WIDGET_SHELL_LOCKED
              } min-h-[11.5rem] p-4`}
            >
              <WidgetCallingPulse
                active={activePulsarStep === "guests"}
                tone="white"
              />
              <WidgetApprovedCheck
                show={isConfirmedBooking || stepComplete.guests}
              />
              <div className="relative z-10 flex items-center gap-2">
                <span className="text-xl" aria-hidden>
                  👥
                </span>
                <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-400">
                  PARTY
                </span>
              </div>
              <div className="relative z-10 mt-3">
                <h3 className="font-godiva text-lg font-black leading-none text-white">
                  {guestCount || 2} GUESTS
                </h3>
                <p className="mt-1 font-mono text-[11px] text-zinc-300">
                  {paceLabel}
                </p>
              </div>
            </button>
            <WidgetLabel>Guests &amp; Pace</WidgetLabel>
          </div>
        </div>

        <div className="overflow-visible">
          <button
            type="button"
            aria-label="Edit meeting point and language"
            disabled={!canOpenApprovalStep("meeting")}
            onClick={() => openEditModal("meeting")}
            className={`${
              canOpenApprovalStep("meeting")
                ? `${WIDGET_SHELL} ${getWidgetPulsarClass(activePulsarStep, "meeting")}`
                : WIDGET_SHELL_LOCKED
            } h-40 p-0`}
          >
            <WidgetCallingPulse
              active={activePulsarStep === "meeting"}
              tone="white"
            />
            <WidgetApprovedCheck
              show={isConfirmedBooking || stepComplete.meeting}
            />
            <div className="absolute inset-0 z-0 overflow-hidden rounded-[22px] bg-[#0A1017]">
              {meetMapBg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={meetMapBg}
                  alt="Meeting point map"
                  width={800}
                  height={400}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div
                  className="absolute inset-0 bg-gradient-to-br from-[#1a2840] to-[#0A1017]"
                  aria-hidden
                />
              )}
              <div
                className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/30 backdrop-blur-[1px]"
                aria-hidden
              />
            </div>

            <div className="relative z-10 flex h-full flex-col justify-between p-4 text-left">
              <div className="flex justify-start">
                <span className="rounded-full border border-white/20 bg-black/70 px-3 py-1 text-xs font-bold text-amber-400">
                  {langBadge}
                </span>
              </div>

              <div className="min-w-0">
                <div className="flex items-start gap-2">
                  <MapPin
                    className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 font-godiva text-base font-black leading-tight text-white">
                      {meetLabel}
                    </h3>
                    <p className="mt-1 line-clamp-2 font-mono text-[11px] text-zinc-300">
                      {meetAddress}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </button>
          <WidgetLabel>Language & Meeting Point</WidgetLabel>
        </div>

        <div className="overflow-visible">
          <button
            type="button"
            aria-label="Edit selected experiences"
            disabled={!canOpenApprovalStep("tours")}
            onClick={openToursOrDiscover}
            className={`${
              canOpenApprovalStep("tours")
                ? `${WIDGET_SHELL} ${getWidgetPulsarClass(activePulsarStep, "tours")}`
                : WIDGET_SHELL_LOCKED
            } h-[13.5rem] p-0`}
          >
            <WidgetCallingPulse
              active={activePulsarStep === "tours"}
              tone="white"
            />
            <WidgetApprovedCheck
              show={isConfirmedBooking || stepComplete.tours}
            />
            {selectedExperiences.length === 0 ? (
              <div className="absolute inset-0 z-0 overflow-hidden rounded-[22px] bg-gradient-to-b from-[#1a2840] to-[#0A1017]">
                <div className="relative z-10 flex h-full flex-1 flex-col items-center justify-center px-4 pb-16 text-center">
                  <p className="font-godiva text-base font-bold uppercase leading-snug text-white">
                    Pick an experience or tour
                  </p>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/cat-2.png"
                  alt="Tokiotours cat mascot"
                  width={160}
                  height={160}
                  className="pointer-events-none absolute bottom-0 left-1/2 z-0 h-[6.5rem] w-auto -translate-x-1/2 select-none object-contain object-bottom"
                />
              </div>
            ) : (
              <div className="absolute inset-0 z-0 flex h-full w-full flex-col overflow-hidden rounded-[22px]">
                {experienceBands.map((band) => (
                  <div
                    key={band.key}
                    className="relative min-h-0 flex-1 overflow-hidden border-b border-black/40 last:border-b-0"
                  >
                    <CatalogSlotImg
                      recordId={band.recordId}
                      inheritRecordId={band.inheritRecordId}
                      fallbackSrc={band.fallbackSrc}
                      alt={band.title || "Selected experience"}
                      className="absolute inset-0 h-full w-full object-cover"
                      emptyClassName="absolute inset-0 bg-gradient-to-br from-[#3a1a2e] to-[#0B1F3A]"
                    />
                    <div
                      className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent"
                      aria-hidden
                    />
                    <div className="relative z-10 flex h-full items-end px-3 pb-2">
                      <p className="line-clamp-1 font-godiva text-xs font-bold uppercase tracking-wide text-white drop-shadow">
                        {band.title}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </button>
          <WidgetLabel>Tours &amp; Experiences</WidgetLabel>
        </div>

        <div className="grid grid-cols-2 gap-3.5 overflow-visible">
          <div className="overflow-visible">
            <button
              type="button"
              aria-label="Edit transport and logistics"
              disabled={!canOpenApprovalStep("transport")}
              onClick={() => openEditModal("logistics")}
              className={`${
                canOpenApprovalStep("transport")
                  ? `${WIDGET_SHELL} ${getWidgetPulsarClass(activePulsarStep, "transport")}`
                  : WIDGET_SHELL_LOCKED
              } flex min-h-[12rem] flex-col justify-between p-4`}
            >
              <WidgetCallingPulse
                active={activePulsarStep === "transport"}
                tone="white"
              />
              <WidgetApprovedCheck
                show={isConfirmedBooking || stepComplete.transport}
              />
              <div className="relative z-10 flex items-center gap-2">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-400">
                  <TrainFront className="h-5 w-5" aria-hidden />
                </span>
                <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-400">
                  MOVE
                </span>
              </div>
              <div className="relative z-10 mt-auto">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Transport
                </p>
                <h3 className="mt-1 font-godiva text-lg font-black uppercase leading-tight text-white">
                  {transportLabel}
                </h3>
                <p className="mt-1 font-mono text-[10px] text-zinc-400">
                  Starts {startTime}
                </p>
              </div>
            </button>
            <WidgetLabel>Transport</WidgetLabel>
          </div>

          <div>
            <div
              className="relative flex min-h-[12rem] w-full flex-col justify-center overflow-hidden rounded-[22px] border border-dashed border-white/5 bg-[#23262c] p-3.5 text-left"
              aria-label="Guide time status overview"
            >
              <span className="mb-2 font-mono text-[9px] uppercase tracking-widest text-zinc-500">
                Concierge Note
              </span>
              <GuideTimeMeter
                usedGuideHours={selectedGuideHoursTotal(selectedExperiences)}
                tourHours={tourHours}
                stopCount={selectedExperiences.length}
                extraHours={selectedExtraHoursTotal(selectedExperiences)}
                dense
                readOnly
              />
            </div>
            <WidgetLabel muted>Status Overview</WidgetLabel>
          </div>
        </div>
      </div>

      {durationMounted ? (
        <SingleDayTripDetailModal
          open={activeEditModal === "duration"}
          onClose={() => setActiveEditModal(null)}
          onConfirmed={() => {
            setPulsarOverride("guests");
          }}
          seasonTiers={config?.seasonTiers ?? []}
        />
      ) : null}

      {guestsMounted ? (
        <SingleDayGuestsEditorModal
          open={activeEditModal === "guests"}
          onClose={() => setActiveEditModal(null)}
          onConfirmed={() => {
            // Advance guided pulsar to Row 3 (Language & Meeting) without clearing the ring
            setPulsarOverride("meeting");
          }}
          selectedCity={selectedCity}
        />
      ) : null}

      {cityMounted ? (
        <CityFocusModal
          open={activeEditModal === "locations"}
          onClose={() => setActiveEditModal(null)}
          cities={cities}
          cityFocus={cityFocus}
          onConfirmCityChange={(city) => {
            const nextName = city.name.trim();
            const same =
              cityFocus.trim().toLowerCase() === nextName.toLowerCase();
            if (!same) {
              onSelectCity(city);
            }
            // Ticket-gate insert locks city + advances pulsar to Hours & Date
            setCityApproved(true);
            setApprovedCityName(nextName);
            setPulsarOverride("hours");
            setActiveEditModal(null);
          }}
        />
      ) : null}

      {toursMounted ? (
        <ExperiencesPlacesModal
          open={activeEditModal === "tours"}
          onClose={() => setActiveEditModal(null)}
          onConfirmed={() => {
            setPulsarOverride("transport");
          }}
          catalog={catalog}
          selectedCity={selectedCity}
        />
      ) : null}

      <DiscoverOverlay
        open={showDiscover}
        onClose={() => {
          setShowDiscover(false);
          if (useSingleDayBuilderStore.getState().selectedExperiences.length > 0) {
            setPulsarOverride("transport");
          }
        }}
        tours={discoverTours}
        cityName={focusedCity?.name ?? selectedCity?.name ?? ""}
        cityId={focusedCity?.id ?? selectedCity?.id ?? null}
        guests={{ adults, children }}
        itineraryMode="single_day"
        defaultLanguage={
          languageToCode(preferredTourLanguage || "EN") || "EN"
        }
        closeOnAdd
        onSelectExperience={({ tour, language, durationHours }) => {
          const countsTowardGuide = isGuideBudgetCatalogItem(
            tour as CatalogItem
          );
          const hours =
            Number(durationHours) > 0
              ? Number(durationHours)
              : Number(tour.duration_hours) || 0;
          // One guided tour slot — Discover confirms replace; still clear
          // leftover guide rows before adding the new stop.
          if (countsTowardGuide) {
            for (const row of useSingleDayBuilderStore.getState()
              .selectedExperiences) {
              if (countsTowardGuideHours(row) && row.tourId !== tour.id) {
                removeExperience(row.tourId);
              }
            }
          }
          addExperience({
            tourId: tour.id,
            title: tour.title,
            selectedLanguage: language || languageToCode(preferredTourLanguage || "EN") || "EN",
            duration_hours: hours,
            price: tourPrice(tour, { adults, children }),
            access_type: String(tour.access_type || "").trim() || undefined,
            category: String(tour.category || "").trim() || undefined,
            entry_type: String(tour.entry_type || "").trim() || undefined,
            is_extra: !countsTowardGuide,
          });
          return true;
        }}
      />

      {logisticsMounted ? (
        <LogisticsModal
          open={activeEditModal === "logistics"}
          onClose={() => setActiveEditModal(null)}
          startTime={startTime}
          preferredMovement={preferredMovement}
          onOpenMovement={(id) => {
            if (id === "subway" || id === "mix") {
              const needPass =
                guestHasJRPass == null ||
                guestHasICCard == null ||
                guestNeedsTransitHelp == null;
              if (needPass) {
                setTransitPassOpen(true);
                return;
              }
            }
            setMovementModal(id);
          }}
          scheduled={scheduled}
          tourHours={tourHours}
        />
      ) : null}

      {meetingMounted ? (
        <MeetingPointModal
          open={activeEditModal === "meeting"}
          onClose={() => setActiveEditModal(null)}
          selectedCity={selectedCity}
          onConfirmed={() => {
            setPulsarOverride("tours");
            setActiveEditModal(null);
          }}
        />
      ) : null}

      <MovementDetailModal
        movementId={movementModal}
        selected={preferredMovement}
        partySize={Math.max(1, adults + children)}
        initialNeedsSuica={suicaNeeded}
        initialSuicaValueEur={suicaValueEur}
        onClose={() => setMovementModal(null)}
        onSelect={(id, extras) => {
          setPreferredMovement(id);
          if ((id === "subway" || id === "mix") && extras) {
            setSuicaPreference({
              suicaNeeded: Boolean(extras.needsSuica),
              suicaValueEur: extras.suicaValueEur,
            });
          }
          if (id === "walk" || id === "private_driver") {
            setSuicaPreference({ suicaNeeded: false, suicaValueEur: 0 });
          }
          // Stay on Logistics 3-option screen — only clear detail layer
          setMovementModal(null);
          setPulsarOverride("save");
        }}
      />

      <TransitPassQuestionnaire
        open={transitPassOpen}
        onClose={() => setTransitPassOpen(false)}
        initial={{
          guestHasJRPass,
          guestHasICCard,
          guestNeedsTransitHelp,
        }}
        confirmLabel="Continue with Subway"
        onSave={(answers) => {
          setGuestTransitPasses(answers);
          setBuilderTransitPasses(answers);
          setPreferredMovement("subway");
          setTransitPassOpen(false);
          setMovementModal("subway");
          setPulsarOverride("save");
        }}
      />
    </>
  );
}

function MeetingPointModal({
  open,
  onClose,
  onConfirmed,
  selectedCity,
}: {
  open: boolean;
  onClose: () => void;
  onConfirmed: () => void;
  selectedCity: PbCity | null;
}) {
  const [mounted, setMounted] = useState(false);
  const meetingPoint = useSingleDayBuilderStore((s) => s.meetingPoint);
  const meetingPointName = useSingleDayBuilderStore((s) => s.meetingPointName);
  const meetingPointLat = useSingleDayBuilderStore((s) => s.meetingPointLat);
  const meetingPointLng = useSingleDayBuilderStore((s) => s.meetingPointLng);
  const preferredTourLanguage = useSingleDayBuilderStore(
    (s) => s.preferredTourLanguage
  );
  const setMeetingPointDetails = useSingleDayBuilderStore(
    (s) => s.setMeetingPointDetails
  );
  const setPreferredTourLanguage = useSingleDayBuilderStore(
    (s) => s.setPreferredTourLanguage
  );
  const setMeetingLogisticsConfirmed = useSingleDayBuilderStore(
    (s) => s.setMeetingLogisticsConfirmed
  );
  const [draft, setDraft] = useState<MeetingPointResolved | null>(null);
  const [langDraft, setLangDraft] = useState(preferredTourLanguage || "EN");
  const [saving, setSaving] = useState(false);
  const [confirmClicked, setConfirmClicked] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setConfirmClicked(false);
      return;
    }
    setLangDraft(preferredTourLanguage || "EN");
    setConfirmClicked(false);
    const name = String(meetingPointName || "").trim();
    const address = String(meetingPoint || "").trim();
    const hasText = Boolean(name || address);
    const hasCoords =
      meetingPointLat != null &&
      meetingPointLng != null &&
      Number.isFinite(meetingPointLat) &&
      Number.isFinite(meetingPointLng);
    if (hasText || hasCoords) {
      setDraft({
        name: name || address,
        address: address || name,
        city: "",
        lat: hasCoords ? (meetingPointLat as number) : null,
        lng: hasCoords ? (meetingPointLng as number) : null,
        placeId: hasCoords ? "" : "custom:restored",
      });
    } else {
      setDraft(null);
    }
  }, [
    open,
    meetingPoint,
    meetingPointName,
    meetingPointLat,
    meetingPointLng,
    preferredTourLanguage,
  ]);

  const meetingLabel = String(draft?.name || draft?.address || "").trim();
  const meetingOk = Boolean(meetingLabel);
  const langOk = Boolean(String(langDraft || "").trim());
  const showMeetingHint = confirmClicked && !meetingOk;

  useEffect(() => {
    if (meetingOk) setConfirmClicked(false);
  }, [meetingOk]);

  const persistAndClose = async () => {
    if (!meetingOk || !langOk || !draft) return;
    setSaving(true);
    setPreferredTourLanguage(langDraft || "EN");
    const text = String(draft.address || draft.name || "").trim();
    const hasCoords =
      draft.lat != null &&
      draft.lng != null &&
      Number.isFinite(draft.lat) &&
      Number.isFinite(draft.lng);
    setMeetingPointDetails({
      name: String(draft.name || draft.address || "").trim() || text,
      address: text,
      lat: hasCoords ? draft.lat : null,
      lng: hasCoords ? draft.lng : null,
      placeId: hasCoords ? draft.placeId || "" : draft.placeId || `custom:${text.toLowerCase().replace(/\s+/g, "-").slice(0, 64)}`,
    });
    setMeetingLogisticsConfirmed(true);

    try {
      const bookingRef =
        useBuilderStore.getState().confirmedBookingRef ||
        useBuilderStore.getState().tempBookingRef ||
        "";
      const email = (
        useItineraryStore.getState().clientEmail ||
        usePreBuilderStore.getState().email ||
        usePreBuilderStore.getState().lastPayload?.email ||
        ""
      )
        .trim()
        .toLowerCase();
      if (bookingRef && email) {
        await syncSingleDayBookingLead({
          bookingRef,
          email,
          state: useSingleDayBuilderStore.getState(),
        });
      }
    } catch {
      /* local store already updated */
    } finally {
      setSaving(false);
      onConfirmed();
    }
  };

  return (
    <BuilderEditModalShell
      open={open}
      onClose={onClose}
      title="Language & Meeting Point"
      mounted={mounted}
      variant="fullPage"
      footer={
        <button
          type="button"
          disabled={saving || (meetingOk && !langOk)}
          onClick={() => {
            if (!meetingOk) {
              setConfirmClicked(true);
              return;
            }
            if (!langOk) return;
            void persistAndClose();
          }}
          className={`w-full rounded-full bg-[#054F70] py-3 text-sm font-semibold text-white transition hover:bg-[#043d57] disabled:cursor-not-allowed disabled:opacity-40 ${
            !meetingOk ? "opacity-40" : ""
          }`}
        >
          {saving ? "Saving…" : "Confirm Meeting Point & Language →"}
        </button>
      }
    >
      <div className="space-y-10">
        <section className="relative space-y-2 overflow-visible">
          <div className="relative">
            <div
              className="pointer-events-none absolute right-[-12px] top-0 z-20 -translate-y-[55%]"
              aria-hidden
            >
              <div className="relative">
                {showMeetingHint ? (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute -top-10 right-10 z-30 max-w-[16rem] whitespace-normal rounded-xl border border-white/20 bg-[#0080A3] px-3 py-1.5 text-right font-mono text-[11px] font-bold leading-snug text-white shadow-lg sm:max-w-none sm:whitespace-nowrap"
                  >
                    Please enter your hotel or meeting point!
                    <div className="absolute -bottom-1 right-4 h-2 w-2 rotate-45 bg-[#0080A3]" />
                  </motion.div>
                ) : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/fox-peek.webp"
                  alt=""
                  className="h-24 w-auto object-contain object-right drop-shadow-[0_8px_16px_rgba(0,0,0,0.55)] sm:h-28"
                  draggable={false}
                />
              </div>
            </div>
            <p className="mb-3 pr-20 text-[10px] font-bold uppercase tracking-widest text-[#0A1017]">
              Meeting point
            </p>
            <MeetingPointPlacesPicker
              key={
                open
                  ? `mp:${meetingPointName}|${meetingPoint}|${meetingPointLat}|${meetingPointLng}`
                  : "mp:closed"
              }
              initialName={meetingPointName || ""}
              initialAddress={meetingPoint || ""}
              lat={meetingPointLat ?? null}
              lng={meetingPointLng ?? null}
              onResolved={setDraft}
            />
          </div>
        </section>

        <section className="border-t border-black/10 pt-8">
          {selectedCity ? (
            <CityLanguageSelect
              cityName={selectedCity.name}
              availableLanguages={selectedCity.available_languages}
              value={langDraft}
              onChange={setLangDraft}
            />
          ) : (
            <p className="text-xs text-[#64748b]">
              Choose a city focus to unlock tour languages.
            </p>
          )}
        </section>
      </div>
    </BuilderEditModalShell>
  );
}

function LogisticsModal({
  open,
  onClose,
  startTime,
  preferredMovement,
  onOpenMovement,
  scheduled,
  tourHours,
}: {
  open: boolean;
  onClose: () => void;
  startTime: string;
  preferredMovement: IntraCityTransport | null;
  onOpenMovement: (m: IntraCityTransport) => void;
  scheduled: number;
  tourHours: number;
}) {
  const [mounted, setMounted] = useState(false);
  const ensureBrandingLoaded = useSiteBrandingStore((s) => s.ensureLoaded);
  const getItem = useSiteBrandingStore((s) => s.getItem);
  const brandingItems = useSiteBrandingStore((s) => s.itemsByKey);
  void brandingItems;

  const guestHasJRPass = useSingleDayBuilderStore((s) => s.guestHasJRPass);
  const guestHasICCard = useSingleDayBuilderStore((s) => s.guestHasICCard);
  const guestNeedsTransitHelp = useSingleDayBuilderStore(
    (s) => s.guestNeedsTransitHelp
  );
  const setGuestTransitPasses = useSingleDayBuilderStore(
    (s) => s.setGuestTransitPasses
  );
  const setBuilderTransitPasses = useBuilderStore(
    (s) => s.setGuestTransitPasses
  );

  const syncTransitPasses = (answers: {
    guestHasJRPass?: boolean;
    guestHasICCard?: boolean;
    guestNeedsTransitHelp?: boolean;
  }) => {
    setGuestTransitPasses(answers);
    const nextJr =
      typeof answers.guestHasJRPass === "boolean"
        ? answers.guestHasJRPass
        : guestHasJRPass;
    const nextIc =
      typeof answers.guestHasICCard === "boolean"
        ? answers.guestHasICCard
        : guestHasICCard;
    const nextHelp =
      typeof answers.guestNeedsTransitHelp === "boolean"
        ? answers.guestNeedsTransitHelp
        : guestNeedsTransitHelp;
    if (nextJr != null && nextIc != null && nextHelp != null) {
      setBuilderTransitPasses({
        guestHasJRPass: nextJr,
        guestHasICCard: nextIc,
        guestNeedsTransitHelp: nextHelp,
      });
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    void ensureBrandingLoaded();
  }, [open, ensureBrandingLoaded]);

  const overBudget = scheduled > tourHours * 60;
  const icAnswered =
    guestHasICCard != null || guestNeedsTransitHelp != null;
  const icOwnCard =
    icAnswered &&
    guestHasICCard === true &&
    guestNeedsTransitHelp !== true;
  const icNeedsAssistance =
    icAnswered &&
    (guestHasICCard === false || guestNeedsTransitHelp === true);

  return (
    <BuilderEditModalShell
      open={open}
      onClose={onClose}
      title="Transport"
      mounted={mounted}
      variant="fullPage"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-full bg-[#054F70] py-3 text-sm font-semibold text-white"
        >
          Done →
        </button>
      }
    >
      <div className="space-y-8">
              <section>
                <p className="font-godiva text-base uppercase tracking-wide text-[#0A1017]">
                  How you move today
                </p>
                <p className="mt-2 text-xs text-zinc-400">
                  Public rail requires IC cards (Suica/PASMO). Private driver is
                  assigned after Ops confirmation.
                </p>
              </section>
              <section>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {TRANSPORT_OPTIONS.map((opt) => {
                    const item = getItem(opt.brandingKey);
                    const on = preferredMovement === opt.id;
                    const media = item.mediaUrl || item.posterUrl;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="button"
                        aria-pressed={on}
                        aria-label={`Select ${opt.label} movement`}
                        onClick={() => onOpenMovement(opt.id)}
                        className={`relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-2xl border bg-[#0D141C] p-5 text-left transition ${
                          on
                            ? "border-[#0080A3] shadow-lg shadow-[#0080A3]/20"
                            : "border-white/10 hover:border-white/25"
                        }`}
                      >
                        {media ? (
                          <span className="pointer-events-none absolute inset-0 opacity-30">
                            {item.isVideo && item.mediaUrl ? (
                              <LazyVideo
                                src={item.mediaUrl}
                                poster={item.posterUrl || undefined}
                                muted
                                loop
                                playsInline
                                autoPlay
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={media}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            )}
                            <span
                              className="absolute inset-0 bg-gradient-to-t from-[#0D141C] via-[#0D141C]/80 to-[#0D141C]/40"
                              aria-hidden
                            />
                          </span>
                        ) : null}
                        <span
                          className={`absolute top-4 right-4 z-20 text-sm font-bold transition ${
                            on ? "text-[#0080A3]" : "text-gray-600"
                          }`}
                          aria-hidden
                        >
                          ✓
                        </span>
                        <span className="relative z-10 mt-auto space-y-2">
                          <span className="block text-sm font-bold uppercase tracking-wider text-white">
                            {item.title || opt.label}
                          </span>
                          <span className="block text-[10px] leading-tight text-gray-400">
                            {item.subtitle || opt.subtitle}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0D141C] p-5">
                <div>
                  <p className="font-godiva text-sm uppercase tracking-wider text-white">
                    IC Card &amp; Transit Assistance
                  </p>
                  <p className="mt-1.5 text-xs text-zinc-400">
                    Tell Ops whether you already hold Suica/PASMO and a JR Pass,
                    or need purchasing help.
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    IC Card (Suica / PASMO)
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      aria-pressed={icOwnCard}
                      onClick={() =>
                        syncTransitPasses({
                          guestHasICCard: true,
                          guestNeedsTransitHelp: false,
                        })
                      }
                      className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${
                        icOwnCard
                          ? "border-[#0080A3] bg-[#0080A3]/20 text-white"
                          : "border-white/10 bg-black/30 text-zinc-400 hover:border-white/25 hover:text-white"
                      }`}
                    >
                      I have my own IC card
                    </button>
                    <button
                      type="button"
                      aria-pressed={icNeedsAssistance}
                      onClick={() =>
                        syncTransitPasses({
                          guestHasICCard: false,
                          guestNeedsTransitHelp: true,
                        })
                      }
                      className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${
                        icNeedsAssistance
                          ? "border-[#0080A3] bg-[#0080A3]/20 text-white"
                          : "border-white/10 bg-black/30 text-zinc-400 hover:border-white/25 hover:text-white"
                      }`}
                    >
                      Need assistance / purchasing Suica
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    JR Rail Pass
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      aria-pressed={guestHasJRPass === true}
                      onClick={() =>
                        syncTransitPasses({ guestHasJRPass: true })
                      }
                      className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${
                        guestHasJRPass === true
                          ? "border-[#0080A3] bg-[#0080A3]/20 text-white"
                          : "border-white/10 bg-black/30 text-zinc-400 hover:border-white/25 hover:text-white"
                      }`}
                    >
                      Yes, I have a JR Pass
                    </button>
                    <button
                      type="button"
                      aria-pressed={guestHasJRPass === false}
                      onClick={() =>
                        syncTransitPasses({ guestHasJRPass: false })
                      }
                      className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${
                        guestHasJRPass === false
                          ? "border-[#0080A3] bg-[#0080A3]/20 text-white"
                          : "border-white/10 bg-black/30 text-zinc-400 hover:border-white/25 hover:text-white"
                      }`}
                    >
                      No JR Pass
                    </button>
                  </div>
                </div>
              </section>

              <div
                className={`flex items-center justify-between bg-[#0D141C] px-3 py-2.5 text-xs ${
                  overBudget ? "text-[#DC6E8A]" : "text-white/60"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Scheduled {formatMinutes(scheduled)}
                </span>
                <span>
                  Capacity {tourHours}h · starts {startTime}
                </span>
              </div>
      </div>
    </BuilderEditModalShell>
  );
}
