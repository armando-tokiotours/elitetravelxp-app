"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Car, Check, Clock, Footprints, Train, TrainFront } from "lucide-react";
import type { BuilderConfig, PbCity, PbTour } from "@/lib/pocketbase/client";
import { cityPhoto, pbFileUrl } from "@/lib/pocketbase/client";
import { PB_THUMBS } from "@/lib/mediaStandards";
import {
  formatMinutes,
  formatSingleDayDisplayDate,
  totalScheduledMinutes,
  useSingleDayBuilderStore,
  type IntraCityTransport,
} from "@/store/useSingleDayBuilderStore";
import { useLazyModalMount } from "@/components/builder/modals/useLazyModalMount";
import { CityLanguageSelect } from "@/components/builder/CityLanguageSelect";
import { GoldLight } from "@/components/branding/GoldLight";
import { resolveSingleDayCityThumbnail } from "@/config/mediaConfig";
import { SingleDayProgressBar } from "@/components/builder-single/SingleDayProgressBar";
import { MovementDetailModal } from "@/components/builder-s/MovementDetailModal";
import { ExplainerTriggerButton } from "@/components/builder/ExplainerTriggerButton";

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

type SEditId =
  | "duration"
  | "guests"
  | "locations"
  | "tours"
  | "logistics"
  | null;

const WIDGET_SHELL =
  "w-full bg-[#0A1017]/90 border border-white/10 rounded-[22px] p-4 text-left relative overflow-hidden shadow-xl hover:border-amber-500/40 transition-all active:scale-95";

const HALF = `${WIDGET_SHELL} h-36`;

const START_TIMES = [
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
] as const;

const TRANSPORT_OPTIONS: {
  id: IntraCityTransport;
  label: string;
  icon: typeof Footprints;
  spotlight: string;
}[] = [
  { id: "walk", label: "Walk", icon: Footprints, spotlight: "#DC6E8A" },
  { id: "subway", label: "Public / Suica", icon: Train, spotlight: "#054F70" },
  {
    id: "private_driver",
    label: "Private / taxi",
    icon: Car,
    spotlight: "#F6A724",
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
}: {
  config: BuilderConfig | null;
  catalog: PbTour[];
  selectedCity: PbCity | null;
  onSelectCity: (city: PbCity) => void;
}) {
  const [activeEditModal, setActiveEditModal] = useState<SEditId>(null);
  const [movementModal, setMovementModal] =
    useState<IntraCityTransport | null>(null);

  const durationMounted = useLazyModalMount(activeEditModal === "duration");
  const guestsMounted = useLazyModalMount(activeEditModal === "guests");
  const cityMounted = useLazyModalMount(activeEditModal === "locations");
  const toursMounted = useLazyModalMount(activeEditModal === "tours");
  const logisticsMounted = useLazyModalMount(activeEditModal === "logistics");

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
  const preferredMovement = useSingleDayBuilderStore(
    (s) => s.preferredMovement
  );
  const preferredTourLanguage = useSingleDayBuilderStore(
    (s) => s.preferredTourLanguage
  );
  const blocks = useSingleDayBuilderStore((s) => s.blocks);
  const setStartTime = useSingleDayBuilderStore((s) => s.setStartTime);
  const setMeetingPoint = useSingleDayBuilderStore((s) => s.setMeetingPoint);
  const setPreferredTourLanguage = useSingleDayBuilderStore(
    (s) => s.setPreferredTourLanguage
  );
  const setPreferredMovement = useSingleDayBuilderStore(
    (s) => s.setPreferredMovement
  );

  const openEditModal = useCallback((id: Exclude<SEditId, null>) => {
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

  return (
    <>
      <SingleDayProgressBar />
      <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6">
        <div>
          <button
            type="button"
            onClick={() => openEditModal("locations")}
            className={`${WIDGET_SHELL} flex items-center justify-between`}
          >
            <div
              className="pointer-events-none absolute -right-10 -top-10 z-0 h-32 w-32 select-none rounded-full opacity-30 blur-2xl"
              style={{
                background:
                  "radial-gradient(circle, #E60F43 0%, rgba(230,15,67,0) 70%)",
              }}
              aria-hidden
            />
            <div className="relative z-10 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-lg text-cyan-400">
                <span aria-hidden>⛩️</span>
              </div>
              <div>
                <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                  CITY FOCUS
                </span>
                <h3 className="mt-0.5 text-sm font-bold uppercase text-white">
                  {cityFocus || "Choose a city"}
                </h3>
              </div>
            </div>
            <span className="relative z-10 text-sm text-zinc-500" aria-hidden>
              ✏️
            </span>
          </button>
          <WidgetLabel>City</WidgetLabel>
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          <div>
            <button
              type="button"
              onClick={() => openEditModal("duration")}
              className={HALF}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl" aria-hidden>
                  📅
                </span>
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-amber-400">
                  DAY
                </span>
              </div>
              <div className="mt-3">
                <h3 className="font-godiva text-lg font-black leading-none text-white">
                  {tourHours}H TOUR
                </h3>
                <p className="mt-1 font-mono text-[11px] text-zinc-300">
                  {dateText || "Set Tour Date"}
                </p>
              </div>
            </button>
            <WidgetLabel>Hours &amp; Date</WidgetLabel>
          </div>

          <div>
            <button
              type="button"
              onClick={() => openEditModal("guests")}
              className={HALF}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl" aria-hidden>
                  👥
                </span>
                <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-400">
                  PARTY
                </span>
              </div>
              <div className="mt-3">
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

        <div>
          <button
            type="button"
            onClick={() => openEditModal("tours")}
            className={`${WIDGET_SHELL} h-[13.5rem] p-0`}
          >
            {selectedExperiences.length === 0 ? (
              <div className="relative flex h-full flex-col overflow-hidden bg-gradient-to-b from-[#1a2840] to-[#0A1017]">
                <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-16 text-center">
                  <p className="font-godiva text-base font-bold uppercase leading-snug text-white">
                    No experiences or tours chosen
                  </p>
                  <p className="mt-2 font-mono text-[11px] font-bold tracking-wider text-pink-400 uppercase">
                    I&apos;m boring…
                  </p>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/cat-2.png"
                  alt=""
                  aria-hidden
                  className="pointer-events-none absolute bottom-0 left-1/2 z-0 h-[6.5rem] w-auto -translate-x-1/2 select-none object-contain object-bottom"
                />
              </div>
            ) : (
              <div className="flex h-full w-full flex-col">
                {selectedExperiences.slice(0, 4).map((exp) => (
                  <div
                    key={exp.tourId}
                    className="relative min-h-0 flex-1 overflow-hidden border-b border-black/40 last:border-b-0"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-[#3a1a2e] to-[#0B1F3A]" />
                    <div
                      className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent"
                      aria-hidden
                    />
                    <div className="relative z-10 flex h-full items-end px-3 pb-2">
                      <p className="line-clamp-1 font-godiva text-xs font-bold uppercase tracking-wide text-white drop-shadow">
                        {exp.title}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </button>
          <WidgetLabel>Tours &amp; Experiences</WidgetLabel>
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          <div>
            <button
              type="button"
              onClick={() => openEditModal("logistics")}
              className={`${WIDGET_SHELL} flex min-h-[12rem] flex-col justify-between p-4`}
            >
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-400">
                  <TrainFront className="h-5 w-5" aria-hidden />
                </span>
                <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-400">
                  MOVE
                </span>
              </div>
              <div className="mt-auto">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Transport
                </p>
                <h3 className="mt-1 font-godiva text-lg font-black uppercase leading-tight text-white">
                  {transportLabel}
                </h3>
                <p className="mt-1 font-mono text-[10px] text-zinc-400">
                  Starts {startTime}
                  {meetingPoint ? ` · ${meetingPoint}` : ""}
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
          seasonTiers={config?.seasonTiers ?? []}
        />
      ) : null}

      {guestsMounted ? (
        <SingleDayGuestsEditorModal
          open={activeEditModal === "guests"}
          onClose={() => setActiveEditModal(null)}
        />
      ) : null}

      {cityMounted ? (
        <CityFocusModal
          open={activeEditModal === "locations"}
          onClose={() => setActiveEditModal(null)}
          cities={cities}
          cityFocus={cityFocus}
          onSelectCity={(city) => {
            onSelectCity(city);
            setActiveEditModal(null);
          }}
        />
      ) : null}

      {toursMounted ? (
        <ExperiencesPlacesModal
          open={activeEditModal === "tours"}
          onClose={() => setActiveEditModal(null)}
          catalog={catalog}
          selectedCity={selectedCity}
        />
      ) : null}

      {logisticsMounted ? (
        <LogisticsModal
          open={activeEditModal === "logistics"}
          onClose={() => setActiveEditModal(null)}
          startTime={startTime}
          setStartTime={setStartTime}
          meetingPoint={meetingPoint}
          setMeetingPoint={setMeetingPoint}
          selectedCity={selectedCity}
          preferredTourLanguage={preferredTourLanguage}
          setPreferredTourLanguage={setPreferredTourLanguage}
          preferredMovement={preferredMovement}
          onOpenMovement={setMovementModal}
          scheduled={scheduled}
          tourHours={tourHours}
        />
      ) : null}

      <MovementDetailModal
        movementId={movementModal}
        selected={preferredMovement}
        onClose={() => setMovementModal(null)}
        onSelect={(id) => {
          setPreferredMovement(id);
          setMovementModal(null);
        }}
      />
    </>
  );
}

function CityFocusModal({
  open,
  onClose,
  cities,
  cityFocus,
  onSelectCity,
}: {
  open: boolean;
  onClose: () => void;
  cities: PbCity[];
  cityFocus: string;
  onSelectCity: (city: PbCity) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="city-focus"
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="tokio-modal-backdrop absolute inset-0"
            onClick={onClose}
          />
          <motion.div
            className="tokio-modal-content relative z-[1] flex h-[min(90dvh,40rem)] w-full flex-col overflow-hidden border border-white/10 sm:max-w-lg sm:rounded-3xl"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
          >
            <div className="tokio-modal-chrome flex shrink-0 items-center gap-3 border-b px-4 py-4">
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h3 className="font-display text-xl text-white">City Focus</h3>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {cities.map((city) => {
                  const on =
                    cityFocus.trim().toLowerCase() ===
                    city.name.trim().toLowerCase();
                  const filename = cityPhoto(city);
                  const pbImg =
                    filename && city.collectionId
                      ? pbFileUrl(city.collectionId, city.id, filename, {
                          thumb: PB_THUMBS.card,
                          format: "webp",
                        })
                      : "";
                  const img = resolveSingleDayCityThumbnail(city.name, pbImg);
                  return (
                    <button
                      key={city.id}
                      type="button"
                      onClick={() => onSelectCity(city)}
                      className={`relative overflow-hidden rounded-xl border text-left ${
                        on
                          ? "border-[#075473] ring-2 ring-[#075473]"
                          : "border-white/10"
                      }`}
                    >
                      <div className="relative h-24 bg-zinc-900">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                        {on ? (
                          <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#1BA58A]">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate px-2 py-2 text-xs font-bold text-white">
                        {city.name}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

function LogisticsModal({
  open,
  onClose,
  startTime,
  setStartTime,
  meetingPoint,
  setMeetingPoint,
  selectedCity,
  preferredTourLanguage,
  setPreferredTourLanguage,
  preferredMovement,
  onOpenMovement,
  scheduled,
  tourHours,
}: {
  open: boolean;
  onClose: () => void;
  startTime: string;
  setStartTime: (v: string) => void;
  meetingPoint: string;
  setMeetingPoint: (v: string) => void;
  selectedCity: PbCity | null;
  preferredTourLanguage: string;
  setPreferredTourLanguage: (v: string) => void;
  preferredMovement: IntraCityTransport | null;
  onOpenMovement: (m: IntraCityTransport) => void;
  scheduled: number;
  tourHours: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const overBudget = scheduled > tourHours * 60;

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="logistics"
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="tokio-modal-backdrop absolute inset-0"
            onClick={onClose}
          />
          <motion.div
            className="tokio-modal-content relative z-[1] flex h-[min(92dvh,44rem)] w-full flex-col overflow-hidden border border-white/10 sm:max-w-lg sm:rounded-3xl"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
          >
            <div className="tokio-modal-chrome flex shrink-0 items-center gap-3 border-b px-4 py-4">
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h3 className="font-display text-xl text-white">
                Drivers &amp; Transport
              </h3>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5">
              <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-zinc-300">
                <p className="font-godiva text-base uppercase tracking-wide text-white">
                  How you move today
                </p>
                <p className="mt-2 text-xs text-zinc-400">
                  Public rail may need tickets (Suica/PASMO). Private chauffeur /
                  taxi is assigned after Ops confirms.
                </p>
                <div className="mt-3 space-y-2">
                  <ExplainerTriggerButton
                    featureKey="public_transport_explainer"
                    title="Public transport &amp; Suica explained"
                  />
                  <ExplainerTriggerButton
                    featureKey="daily_transport_explainer"
                    title="Watch: Why you need private daily transport"
                  />
                </div>
              </div>
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white">
                  Start time
                </p>
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-white/15 bg-[#121212] px-3 py-3 text-base text-white"
                >
                  {START_TIMES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white">
                  Meeting point
                </p>
                <input
                  type="text"
                  value={meetingPoint}
                  onChange={(e) => setMeetingPoint(e.target.value)}
                  placeholder="e.g. Park Hyatt Tokyo lobby"
                  className="w-full rounded-xl border border-white/15 bg-[#121212] px-3 py-3 text-base text-white placeholder:text-white/30"
                />
              </div>
              {selectedCity ? (
                <CityLanguageSelect
                  cityName={selectedCity.name}
                  availableLanguages={selectedCity.available_languages}
                  value={preferredTourLanguage}
                  onChange={setPreferredTourLanguage}
                />
              ) : (
                <p className="text-xs text-white/45">
                  Choose a city focus to unlock tour languages.
                </p>
              )}
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white">
                  Preferred movement
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {TRANSPORT_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const on = preferredMovement === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onOpenMovement(opt.id)}
                        className={`group relative flex flex-col items-center gap-1.5 overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]/70 px-2 py-3 text-[10px] ${
                          on ? "ring-2 ring-[#075473] text-white" : "text-white/70"
                        }`}
                      >
                        <GoldLight
                          color={opt.spotlight}
                          placement="top-center"
                          active={on}
                        />
                        <span className="relative z-10 flex flex-col items-center gap-1.5">
                          <Icon className="h-4 w-4 text-cyan-400" />
                          {opt.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
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
            <div className="tokio-modal-chrome border-t px-4 py-4">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-full bg-[#054F70] py-3 text-sm font-semibold text-white"
              >
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
