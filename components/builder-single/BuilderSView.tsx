"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, Clock, MapPin, TrainFront } from "lucide-react";
import type { BuilderConfig, PbCity, PbTour } from "@/lib/pocketbase/client";
import { cityPhoto, pbFileUrl, tourPhoto } from "@/lib/pocketbase/client";
import { PB_THUMBS } from "@/lib/mediaStandards";
import {
  formatMinutes,
  formatSingleDayDisplayDate,
  totalScheduledMinutes,
  useSingleDayBuilderStore,
  type IntraCityTransport,
} from "@/store/useSingleDayBuilderStore";
import { useBuilderStore } from "@/store/useBuilderStore";
import { useLazyModalMount } from "@/components/builder/modals/useLazyModalMount";
import { CityLanguageSelect } from "@/components/builder/CityLanguageSelect";
import { resolveSingleDayCityThumbnail } from "@/config/mediaConfig";
import { SingleDayProgressBar } from "@/components/builder-single/SingleDayProgressBar";
import { BuilderEditModalShell } from "@/components/builder/modals/BuilderEditModalShell";
import { MeetingPointPlacesPicker } from "@/components/builder/MeetingPointPlacesPicker";
import { LazyVideo } from "@/components/ui/LazyVideo";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";
import { SelfArrangeMicroTable } from "@/components/builder/SelfArrangeMicroTable";
import { TripRangeMiniCalendar } from "@/components/builder/TripRangeMiniCalendar";
import { TransitPassQuestionnaire } from "@/components/builder/TransitPassQuestionnaire";
import type { GeoapifyPlace } from "@/lib/geoapify";
import { languageFlag, languageToCode } from "@/lib/tourLanguages";
import {
  getWidgetPulsarClass,
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

/** Outer shell — no overflow-hidden (clips calling pulse). Clip media on an inner layer. */
const WIDGET_SHELL =
  "w-full bg-[#0A1017]/90 border rounded-[22px] p-4 text-left relative overflow-visible shadow-xl hover:border-amber-500/40 transition-all active:scale-95 group";

const HALF = `${WIDGET_SHELL} h-36`;

const TRANSPORT_OPTIONS: {
  id: IntraCityTransport;
  label: string;
  brandingKey: string;
}[] = [
  {
    id: "walk",
    label: "Walk",
    brandingKey: "transit_walk",
  },
  {
    id: "subway",
    label: "Public / Suica",
    brandingKey: "transit_subway",
  },
  {
    id: "private_driver",
    label: "Private / taxi",
    brandingKey: "transit_private_driver",
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
        muted ? "text-zinc-500" : "text-zinc-400"
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
}: {
  config: BuilderConfig | null;
  catalog: PbTour[];
  selectedCity: PbCity | null;
  onSelectCity: (city: PbCity) => void;
  /** Lets parent pulse Save & View when guided flow reaches the end. */
  onActivePulsarStepChange?: (step: PulsarStep | null) => void;
}) {
  const [activeEditModal, setActiveEditModal] = useState<SEditId>(null);
  const [movementModal, setMovementModal] =
    useState<IntraCityTransport | null>(null);
  const [transitPassOpen, setTransitPassOpen] = useState(false);
  /** After city change confirm, force guided pulsar onto Hours & Date. */
  const [pulsarOverride, setPulsarOverride] = useState<GlowStep | null>(null);
  const [activePulsarStep, setActivePulsarStep] = useState<PulsarStep | null>(
    "city"
  );

  const durationMounted = useLazyModalMount(activeEditModal === "duration");
  const guestsMounted = useLazyModalMount(activeEditModal === "guests");
  const cityMounted = useLazyModalMount(activeEditModal === "locations");
  const toursMounted = useLazyModalMount(activeEditModal === "tours");
  const logisticsMounted = useLazyModalMount(activeEditModal === "logistics");
  const meetingMounted = useLazyModalMount(activeEditModal === "meeting");

  const tourDate = useSingleDayBuilderStore((s) => s.tourDate);
  const tourHours = useSingleDayBuilderStore((s) => s.tourHours);
  const adults = useSingleDayBuilderStore((s) => s.adults);
  const children = useSingleDayBuilderStore((s) => s.children);
  const travelPace = useSingleDayBuilderStore((s) => s.travelPace);
  const cityFocus = useSingleDayBuilderStore((s) => s.cityFocus);
  const selectedExperiences = useSingleDayBuilderStore(
    (s) => s.selectedExperiences
  );
  const startTime = useSingleDayBuilderStore((s) => s.startTime);
  const meetingPoint = useSingleDayBuilderStore((s) => s.meetingPoint);
  const meetingPointName = useSingleDayBuilderStore((s) => s.meetingPointName);
  const meetingPointLat = useSingleDayBuilderStore((s) => s.meetingPointLat);
  const meetingPointLng = useSingleDayBuilderStore((s) => s.meetingPointLng);
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
  const blocks = useSingleDayBuilderStore((s) => s.blocks);
  const setPreferredMovement = useSingleDayBuilderStore(
    (s) => s.setPreferredMovement
  );
  const specialNeeds = useBuilderStore((s) => s.specialNeeds);

  const openEditModal = useCallback((id: Exclude<SEditId, null>) => {
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
  }, []);

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
      ? "Private / taxi"
      : preferredMovement === "subway"
        ? "Public / Suica"
        : preferredMovement === "walk"
          ? "Walk"
          : "Set transport";

  const cities = config?.cities ?? [];
  const scheduled = totalScheduledMinutes(blocks);

  const cityThumb = useMemo(() => {
    if (!cityFocus.trim()) return "";
    const city =
      selectedCity &&
      selectedCity.name.trim().toLowerCase() === cityFocus.trim().toLowerCase()
        ? selectedCity
        : cities.find(
            (c) => c.name.trim().toLowerCase() === cityFocus.trim().toLowerCase()
          ) ?? null;
    const filename = city ? cityPhoto(city) : "";
    const pbImg =
      city && filename && city.collectionId
        ? pbFileUrl(city.collectionId, city.id, filename, {
            thumb: PB_THUMBS.card,
            format: "webp",
          })
        : "";
    return resolveSingleDayCityThumbnail(cityFocus, pbImg);
  }, [cityFocus, cities, selectedCity]);

  const nextGlow = useMemo((): GlowStep | null => {
    if (pulsarOverride === "hours" && cityFocus.trim()) return "hours";
    if (pulsarOverride === "guests" && cityFocus.trim() && tourDate) {
      return "guests";
    }
    if (pulsarOverride === "meeting" && cityFocus.trim() && tourDate) {
      if (!meetingPoint.trim()) return "meeting";
    }
    if (pulsarOverride === "tours" && meetingPoint.trim()) return "tours";
    if (pulsarOverride === "transport" && selectedExperiences.length > 0) {
      return "transport";
    }
    if (pulsarOverride === "save" && preferredMovement != null) return "save";
    if (!cityFocus.trim()) return "city";
    if (!tourDate) return "hours";
    if (travelPace === null || specialNeeds.length === 0) return "guests";
    if (!meetingPoint.trim()) return "meeting";
    if (selectedExperiences.length === 0) return "tours";
    if (preferredMovement == null) return "transport";
    return "save";
  }, [
    pulsarOverride,
    cityFocus,
    tourDate,
    travelPace,
    specialNeeds.length,
    meetingPoint,
    selectedExperiences.length,
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

  const experienceBands = useMemo(() => {
    const byId = Object.fromEntries(catalog.map((t) => [t.id, t]));
    return selectedExperiences.slice(0, 4).map((exp) => {
      const tour = byId[exp.tourId];
      const filename = tour ? tourPhoto(tour) : "";
      const photoUrl =
        tour && filename && tour.collectionId
          ? pbFileUrl(tour.collectionId, tour.id, filename, {
              thumb: PB_THUMBS.card,
              format: "webp",
            })
          : "";
      return {
        key: exp.tourId,
        title: tour?.title || exp.title,
        photoUrl,
      };
    });
  }, [catalog, selectedExperiences]);

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
      <SingleDayProgressBar />
      <div className="mx-auto w-full max-w-2xl space-y-5 overflow-visible px-4 py-6">
        <div className="overflow-visible">
          <button
            type="button"
            aria-label={
              cityFocus.trim()
                ? `Edit city focus: ${cityFocus}`
                : "Choose city focus"
            }
            onClick={() => openEditModal("locations")}
            className={`${WIDGET_SHELL} ${getWidgetPulsarClass(activePulsarStep, "city")} h-[14.5rem] p-0`}
          >
            <WidgetCallingPulse active={activePulsarStep === "city"} />
            {cityFocus.trim() && cityThumb ? (
              <div className="absolute inset-0 z-0 overflow-hidden rounded-[22px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cityThumb}
                  alt={cityFocus ? `${cityFocus} city` : "City focus"}
                  width={600}
                  height={400}
                  className="absolute inset-0 h-full w-full object-cover"
                />
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
              </div>
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
                  Tap to choose city
                </span>
              </div>
            )}
          </button>
          <WidgetLabel>City</WidgetLabel>
        </div>

        <div className="grid grid-cols-2 items-start gap-3.5 overflow-visible">
          <div className="overflow-visible">
            <button
              type="button"
              aria-label="Edit tour hours and date"
              onClick={() => openEditModal("duration")}
              className={`${WIDGET_SHELL} ${getWidgetPulsarClass(activePulsarStep, "duration")} min-h-[11.5rem] p-3.5`}
            >
              <WidgetCallingPulse active={activePulsarStep === "duration"} />
              <div className="relative z-10 flex justify-end">
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
              onClick={() => openEditModal("guests")}
              className={`${WIDGET_SHELL} ${getWidgetPulsarClass(activePulsarStep, "guests")} min-h-[11.5rem] p-4`}
            >
              <WidgetCallingPulse active={activePulsarStep === "guests"} />
              <div className="relative z-10 flex items-center justify-between">
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
            onClick={() => openEditModal("meeting")}
            className={`${WIDGET_SHELL} ${getWidgetPulsarClass(activePulsarStep, "meeting")} h-40 p-0`}
          >
            <WidgetCallingPulse active={activePulsarStep === "meeting"} />
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
              <div className="flex justify-end">
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
          <WidgetLabel>Language &amp; Meeting Point</WidgetLabel>
        </div>

        <div className="overflow-visible">
          <button
            type="button"
            aria-label="Edit selected experiences"
            onClick={() => openEditModal("tours")}
            className={`${WIDGET_SHELL} ${getWidgetPulsarClass(activePulsarStep, "tours")} h-[13.5rem] p-0`}
          >
            <WidgetCallingPulse active={activePulsarStep === "tours"} />
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
                    {band.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={band.photoUrl}
                        alt={band.title || "Selected experience"}
                        width={600}
                        height={200}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-[#3a1a2e] to-[#0B1F3A]" />
                    )}
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
              onClick={() => openEditModal("logistics")}
              className={`${WIDGET_SHELL} ${getWidgetPulsarClass(activePulsarStep, "transport")} flex min-h-[12rem] flex-col justify-between p-4`}
            >
              <WidgetCallingPulse active={activePulsarStep === "transport"} />
              <div className="relative z-10 flex items-center justify-between">
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
            <div className="relative flex min-h-[12rem] w-full flex-col items-center justify-center overflow-hidden rounded-[22px] border border-dashed border-white/5 bg-[#0A1017]/50 p-4 text-center">
              <span className="text-2xl opacity-40" aria-hidden>
                🌸
              </span>
              <span className="mt-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                Concierge Note
              </span>
              <span className="mt-0.5 font-sans text-[11px] text-zinc-400">
                Customized on submission
              </span>
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
            onSelectCity(city);
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

      {logisticsMounted ? (
        <LogisticsModal
          open={activeEditModal === "logistics"}
          onClose={() => setActiveEditModal(null)}
          startTime={startTime}
          preferredMovement={preferredMovement}
          onOpenMovement={(id) => {
            if (id === "subway") {
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
          city={selectedCity}
          cityName={cityFocus || selectedCity?.name || "City"}
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
          if (id === "subway" && extras) {
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
  const [draft, setDraft] = useState<GeoapifyPlace | null>(null);
  const [langDraft, setLangDraft] = useState(preferredTourLanguage || "EN");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setLangDraft(preferredTourLanguage || "EN");
    if (
      meetingPointLat != null &&
      meetingPointLng != null &&
      Number.isFinite(meetingPointLat) &&
      Number.isFinite(meetingPointLng)
    ) {
      setDraft({
        name: meetingPointName || meetingPoint || "",
        address: meetingPoint || meetingPointName || "",
        city: "",
        lat: meetingPointLat,
        lng: meetingPointLng,
        placeId: "",
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

  const canConfirm =
    Boolean(draft?.name || draft?.address) &&
    draft?.lat != null &&
    draft?.lng != null &&
    Number.isFinite(draft.lat) &&
    Number.isFinite(draft.lng) &&
    Boolean(String(langDraft || "").trim());

  const persistAndClose = async () => {
    if (!draft || !canConfirm) return;
    setSaving(true);
    setPreferredTourLanguage(langDraft || "EN");
    setMeetingPointDetails({
      name: draft.name,
      address: draft.address || draft.name,
      lat: draft.lat,
      lng: draft.lng,
      placeId: draft.placeId,
    });

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
      title="Meeting Point & Language"
      mounted={mounted}
      footer={
        <button
          type="button"
          disabled={!canConfirm || saving}
          onClick={() => void persistAndClose()}
          className="w-full rounded-full bg-[#054F70] py-3 text-sm font-semibold text-white transition hover:bg-[#043d57] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving…" : "Confirm Meeting Point & Language"}
        </button>
      }
    >
      <div className="space-y-6">
        <MeetingPointPlacesPicker
          initialName={meetingPointName || ""}
          initialAddress={meetingPoint || ""}
          lat={meetingPointLat ?? null}
          lng={meetingPointLng ?? null}
          onResolved={setDraft}
        />

        <div className="border-t border-white/10 pt-5">
          {selectedCity ? (
            <CityLanguageSelect
              cityName={selectedCity.name}
              availableLanguages={selectedCity.available_languages}
              value={langDraft}
              onChange={setLangDraft}
            />
          ) : (
            <p className="text-xs text-white/45">
              Choose a city focus to unlock tour languages.
            </p>
          )}
        </div>
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
  city,
  cityName,
}: {
  open: boolean;
  onClose: () => void;
  startTime: string;
  preferredMovement: IntraCityTransport | null;
  onOpenMovement: (m: IntraCityTransport) => void;
  scheduled: number;
  tourHours: number;
  city?: PbCity | null;
  cityName: string;
}) {
  const [mounted, setMounted] = useState(false);
  const ensureBrandingLoaded = useSiteBrandingStore((s) => s.ensureLoaded);
  const getItem = useSiteBrandingStore((s) => s.getItem);
  const brandingItems = useSiteBrandingStore((s) => s.itemsByKey);
  void brandingItems;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    void ensureBrandingLoaded();
  }, [open, ensureBrandingLoaded]);

  const overBudget = scheduled > tourHours * 60;

  return (
    <BuilderEditModalShell
      open={open}
      onClose={onClose}
      title="Transport"
      mounted={mounted}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-full bg-[#054F70] py-3 text-sm font-semibold text-white"
        >
          Done
        </button>
      }
    >
      <div className="space-y-5">
              <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-zinc-300">
                <p className="font-godiva text-base uppercase tracking-wide text-white">
                  How you move today
                </p>
                <p className="mt-2 text-xs text-zinc-400">
                  Public rail may need tickets (Suica/PASMO). Private chauffeur /
                  taxi is assigned after Ops confirms.
                </p>
              </div>
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white">
                  Preferred movement
                </p>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-2.5 sm:overflow-visible sm:px-0 sm:pb-0">
                  {TRANSPORT_OPTIONS.map((opt) => {
                    const item = getItem(opt.brandingKey);
                    const on = preferredMovement === opt.id;
                    const otherSelected =
                      preferredMovement != null && !on;
                    const media = item.mediaUrl || item.posterUrl;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="button"
                        aria-pressed={on}
                        aria-label={`Select ${opt.label} movement`}
                        onClick={() => onOpenMovement(opt.id)}
                        className={`group relative w-[9.5rem] shrink-0 overflow-hidden rounded-2xl border text-left transition duration-300 sm:w-auto ${
                          on
                            ? "scale-[1.02] border-[#075473] opacity-100 shadow-lg ring-2 ring-[#075473]"
                            : otherSelected
                              ? "border-white/5 opacity-40 grayscale-[30%]"
                              : "border-white/10 opacity-100"
                        }`}
                      >
                        <span className="relative block aspect-[3/4] w-full bg-zinc-900">
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
                          ) : media ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={media}
                              alt={`${opt.label} transport option`}
                              width={300}
                              height={400}
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                          <span
                            className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"
                            aria-hidden
                          />
                          {on ? (
                            <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#D9718C] text-white">
                              <Check className="h-3.5 w-3.5" strokeWidth={3} />
                            </span>
                          ) : null}
                          <span className="absolute inset-x-0 bottom-0 p-2.5">
                            <span className="block font-display text-base text-white">
                              {item.title || opt.label}
                            </span>
                            {item.subtitle ? (
                              <span className="mt-0.5 block text-[10px] leading-snug text-zinc-300">
                                {item.subtitle}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {preferredMovement === "walk" ? (
                  <SelfArrangeMicroTable
                    city={city}
                    nights={1}
                    cityName={cityName}
                  />
                ) : null}
              </div>
              <div
                className={`flex items-center justify-between rounded-2xl border border-white/10 px-3 py-2.5 text-xs ${
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
