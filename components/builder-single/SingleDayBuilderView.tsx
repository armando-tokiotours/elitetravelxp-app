"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Clock, Footprints, Train, Car } from "lucide-react";
import {
  APP_SIDEBAR_RAIL_PAD,
  AppSidebar,
  MobileAppNav,
} from "@/components/navigation/AppSidebar";
import { BottomNav } from "@/components/builder/BottomNav";
import { BookingRefBadge } from "@/components/builder/BookingRefBadge";
import {
  fetchBuilderConfig,
  fetchExperiencesAndPlaces,
  mapEapToTour,
  pbFileUrl,
  cityPhoto,
  type BuilderConfig,
  type PbCity,
  type PbTour,
} from "@/lib/pocketbase/client";
import { PB_THUMBS } from "@/lib/mediaStandards";
import { hydrateStoresFromPreEliteBrief } from "@/lib/preEliteHydrate";
import { useBuilderStore } from "@/store/useBuilderStore";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";
import {
  formatMinutes,
  totalScheduledMinutes,
  useSingleDayBuilderStore,
  type IntraCityTransport,
} from "@/store/useSingleDayBuilderStore";
import { BuilderAccordionProvider, useBuilderAccordionOptional } from "@/components/builder/BuilderAccordion";
import { SectionBlock } from "@/components/builder/ui";
import { NewBookingResetButton } from "@/components/builder/NewBookingResetButton";
import { SingleDayTripDurationSection } from "@/components/builder-s/SingleDayTripDurationSection";
import { SingleDayExperiencesSection } from "@/components/builder-s/SingleDayExperiencesSection";
import { MovementDetailModal } from "@/components/builder-s/MovementDetailModal";
import { CityLanguageSelect } from "@/components/builder/CityLanguageSelect";
import { SingleDayBuilderHero } from "@/components/builder-single/SingleDayBuilderHero";
import { SingleDayProgressBar } from "@/components/builder-single/SingleDayProgressBar";
import {
  resolveSingleDayCityThumbnail,
  readBuilderSHeroLocalCache,
  SINGLE_DAY_BUILDER_HERO_KEY,
} from "@/config/mediaConfig";
import {
  isSingleDayStep2Complete,
  singleDayStepIncompleteMessage,
} from "@/lib/singleDaySteps";
import {
  builderSDisplayCity,
  builderSTagline,
  resolveBuilderSHeroCopy,
} from "@/config/teamConfig";
import { useItineraryStore } from "@/store/useItineraryStore";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";

const TRANSPORT_OPTIONS: {
  id: IntraCityTransport;
  label: string;
  icon: typeof Footprints;
}[] = [
  { id: "walk", label: "Walking", icon: Footprints },
  { id: "subway", label: "Subway", icon: Train },
  { id: "private_driver", label: "Private driver", icon: Car },
];

const START_TIMES = [
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
] as const;

const GLASS_CARD =
  "rounded-2xl border border-white/10 bg-[#0D1117]/70 backdrop-blur-md";

export function SingleDayBuilderView() {
  const searchParams = useSearchParams();
  const [hydrated, setHydrated] = useState(false);
  const [config, setConfig] = useState<BuilderConfig | null>(null);
  const [extraPlaces, setExtraPlaces] = useState<PbTour[]>([]);
  const [guestBadge, setGuestBadge] = useState({
    name: "Guest Brief",
    email: "",
  });
  const [movementModal, setMovementModal] =
    useState<IntraCityTransport | null>(null);

  const setTripMode = useBuilderStore((s) => s.setTripMode);
  const tempBookingRef = useBuilderStore((s) => s.tempBookingRef);
  const confirmedBookingRef = useBuilderStore((s) => s.confirmedBookingRef);
  const bookingStatus = useBuilderStore((s) => s.bookingStatus);
  const ensureTemp = useBuilderStore((s) => s.ensureTempBookingRef);

  const startTime = useSingleDayBuilderStore((s) => s.startTime);
  const tourHours = useSingleDayBuilderStore((s) => s.tourHours);
  const cityFocus = useSingleDayBuilderStore((s) => s.cityFocus);
  const blocks = useSingleDayBuilderStore((s) => s.blocks);
  const meetingPoint = useSingleDayBuilderStore((s) => s.meetingPoint);
  const preferredMovement = useSingleDayBuilderStore(
    (s) => s.preferredMovement
  );
  const preferredTourLanguage = useSingleDayBuilderStore(
    (s) => s.preferredTourLanguage
  );
  const setStartTime = useSingleDayBuilderStore((s) => s.setStartTime);
  const setCityFocus = useSingleDayBuilderStore((s) => s.setCityFocus);
  const setMeetingPoint = useSingleDayBuilderStore((s) => s.setMeetingPoint);
  const setPreferredMovement = useSingleDayBuilderStore(
    (s) => s.setPreferredMovement
  );
  const setPreferredTourLanguage = useSingleDayBuilderStore(
    (s) => s.setPreferredTourLanguage
  );

  useEffect(() => {
    ensureTemp();
    setTripMode("single_day");

    const syncGuestBadge = () => {
      const it = useItineraryStore.getState();
      const pre = usePreBuilderStore.getState();
      const name = (
        it.clientName ||
        pre.fullName ||
        pre.lastPayload?.fullName ||
        "Guest Brief"
      ).trim();
      const email = (
        it.clientEmail ||
        pre.email ||
        pre.lastPayload?.email ||
        ""
      )
        .trim()
        .toLowerCase();
      setGuestBadge({ name: name || "Guest Brief", email });
    };
    syncGuestBadge();

    const ref = searchParams.get("ref");
    if (ref) {
      const pre = usePreBuilderStore.getState();
      if (
        pre.lastPayload?.bookingRef === ref &&
        pre.lastPayload.itineraryData
      ) {
        hydrateStoresFromPreEliteBrief({
          bookingRef: ref,
          fullName: pre.lastPayload.fullName,
          email: pre.lastPayload.email,
          itineraryData: pre.lastPayload.itineraryData,
        });
        syncGuestBadge();
      }
    }

    let cancelled = false;
    void (async () => {
      try {
        const cfg = await fetchBuilderConfig();
        if (cancelled) return;
        setConfig(cfg);
        const eap = await fetchExperiencesAndPlaces();
        if (cancelled) return;
        setExtraPlaces(
          eap
            .filter((r) => r.is_active !== false)
            .map((r) => mapEapToTour(r, cfg.cities))
        );
      } catch {
        if (!cancelled) {
          setConfig(null);
          setExtraPlaces([]);
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount + ref only
  }, [ensureTemp, searchParams, setTripMode]);

  const ensureBranding = useSiteBrandingStore((s) => s.ensureLoaded);
  const getBrandingItem = useSiteBrandingStore((s) => s.getItem);
  const brandingItems = useSiteBrandingStore((s) => s.itemsByKey);
  void brandingItems;

  useEffect(() => {
    void ensureBranding();
  }, [ensureBranding]);

  const heroCopy = (() => {
    const fromPb = resolveBuilderSHeroCopy(
      getBrandingItem(SINGLE_DAY_BUILDER_HERO_KEY)
    );
    const local = readBuilderSHeroLocalCache();
    if (!local) return fromPb;
    return {
      scriptAccent: local.scriptAccent?.trim() || fromPb.scriptAccent,
      mainTitlePrefix: local.mainTitlePrefix?.trim() || fromPb.mainTitlePrefix,
      tagline: local.tagline?.trim() || fromPb.tagline,
    };
  })();
  const displayCity = builderSDisplayCity(cityFocus);
  const dayTagline = builderSTagline(cityFocus, heroCopy.tagline);

  const cities = config?.cities ?? [];
  const selectedCity = useMemo(() => {
    const needle = cityFocus.trim().toLowerCase();
    if (!needle) return null;
    return (
      cities.find((c) => c.name.trim().toLowerCase() === needle) ??
      cities.find((c) => c.name.trim().toLowerCase().includes(needle)) ??
      null
    );
  }, [cities, cityFocus]);

  const experiencesCatalog = useMemo(() => {
    const tours = config?.tours ?? [];
    const ids = new Set(tours.map((t) => t.id));
    return [...tours, ...extraPlaces.filter((p) => !ids.has(p.id))];
  }, [config?.tours, extraPlaces]);

  const scheduled = totalScheduledMinutes(blocks);
  const capacity = tourHours * 60;
  const overBudget = scheduled > capacity;

  const handleSelectCity = (city: PbCity) => {
    setCityFocus(city.name);
  };

  if (!hydrated) {
    return (
      <div className="tokio-ambient-bg flex min-h-dvh items-center justify-center text-sm text-zinc-400">
        Loading single-day builder…
      </div>
    );
  }

  return (
    <>
      <AppSidebar
        brandEyebrow="TOKIOTOURS"
        brandTitle="Builder S"
        expandOnHover
      />
      <div className={`${APP_SIDEBAR_RAIL_PAD} min-h-screen bg-transparent`}>
        <div className="builder-theme relative min-h-screen bg-transparent text-white [color-scheme:dark]">
          <header className="absolute inset-x-0 top-0 z-40 flex items-center gap-2 border-b border-white/10 bg-[#0D1117]/70 px-4 py-3 backdrop-blur-md lg:hidden">
            <MobileAppNav brandEyebrow="TOKIOTOURS" brandTitle="Builder S" />
            <div className="min-w-0 flex-1" />
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-700/80 bg-zinc-900/90 px-4 py-2 font-godiva text-xs font-bold uppercase tracking-widest text-white shadow-lg transition-all hover:bg-[#075473] sm:text-sm"
              aria-label="TOKIOTOURS home"
            >
              TOKIOTOURS
            </Link>
          </header>

          <div className="relative bg-transparent">
            <SingleDayBuilderHero />

            <div className="relative z-20 -mt-20 w-full bg-transparent sm:-mt-28">
              <div className="px-3 pb-8 sm:px-4">
                <div className="tokio-glass-sheet mx-auto max-w-3xl rounded-t-3xl border border-white/10">
                  <div className="overflow-hidden rounded-t-3xl px-5 py-5 sm:px-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#F29727]">
                          {heroCopy.mainTitlePrefix}
                        </p>
                        <h2 className="-mt-0.5 font-godiva text-[1.93rem] font-black uppercase tracking-wider text-white sm:text-[2.21rem]">
                          {displayCity}
                        </h2>
                        <p className="mt-1 max-w-sm font-futura text-xs leading-relaxed text-white/55 sm:text-sm">
                          {dayTagline}
                        </p>
                      </div>
                      <div className="shrink-0 space-y-0.5 text-right">
                        <p className="text-sm font-bold tracking-wide text-white sm:text-base">
                          {guestBadge.name}
                        </p>
                        {guestBadge.email ? (
                          <p className="max-w-[14rem] truncate text-xs font-semibold text-[#075473] sm:max-w-[18rem]">
                            {guestBadge.email}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 flex w-full items-stretch gap-2">
                      <div className="min-w-0 flex-1">
                        <BookingRefBadge
                          tempBookingRef={tempBookingRef}
                          confirmedBookingRef={confirmedBookingRef}
                          bookingStatus={bookingStatus}
                        />
                      </div>
                      <NewBookingResetButton />
                    </div>
                  </div>

                  <div className="px-0 pb-40 pt-0">
                    <BuilderAccordionProvider
                      key={tempBookingRef || "single-day"}
                      defaultOpen={null}
                      unlockAll
                    >
                      <SingleDayProgressBar />
                      <div className="space-y-4 px-4 pt-4 sm:px-6">
{/* §1 Trip Duration */}
            <SingleDayTripDurationSection seasonTiers={config?.seasonTiers ?? []} />

            {/* §2 City Focus */}
            <SectionBlock
              number={2}
              title="City Focus"
              id="section-city-focus"
              icon="map"
              summary={cityFocus || "Choose a city"}
            >
              <div className="grid grid-cols-2 gap-2.5 p-0.5 sm:grid-cols-3 sm:gap-3">
                {cities.map((city) => {
                  const on =
                    cityFocus.trim().toLowerCase() ===
                    city.name.trim().toLowerCase();
                  const hasSelection = Boolean(cityFocus.trim());
                  const filename = cityPhoto(city);
                  const pbImg =
                    filename && city.collectionId
                      ? pbFileUrl(city.collectionId, city.id, filename, {
                          thumb: PB_THUMBS.card,
                          format: "webp",
                        })
                      : "";
                  const img = resolveSingleDayCityThumbnail(city.name, pbImg);
                  const cardClass = on
                    ? "border-[#075473] bg-[#075473]/15 opacity-100 shadow-[0_0_12px_rgba(7,84,115,0.35)] ring-2 ring-[#075473] scale-[1.02] z-10"
                    : hasSelection
                      ? "border-white/5 bg-black/40 opacity-40 grayscale hover:opacity-70 hover:grayscale-0"
                      : "border-white/10 bg-[#05080C]/80 opacity-90 hover:border-white/30";
                  return (
                    <button
                      key={city.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => handleSelectCity(city)}
                      className={`relative flex flex-col overflow-hidden rounded-xl border text-left transition-all duration-300 ${cardClass}`}
                    >
                      <div className="relative h-24 w-full overflow-hidden bg-zinc-900 sm:h-28">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img}
                            alt=""
                            className="h-full w-full object-cover [image-rendering:auto] transition-transform duration-500 hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-end bg-gradient-to-br from-[#1a3355] to-[#0B1F3A] p-2.5">
                            <span className="text-xs font-semibold uppercase tracking-wide text-white/80">
                              {city.name}
                            </span>
                          </div>
                        )}
                        {on ? (
                          <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#1BA58A] text-white shadow-md">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        ) : null}
                      </div>
                      <div className="bg-[#080C10]/90 px-2.5 py-2 text-left">
                        <p className="truncate text-xs font-bold tracking-wide text-white">
                          {city.name}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <SingleDayContinue next={3} />
            </SectionBlock>

            {/* §3 Experiences & Places */}
            <SingleDayExperiencesSection
              catalog={experiencesCatalog}
              selectedCity={selectedCity}
            />

            {/* §4 Start time, meeting point & language */}
            <SectionBlock
              number={4}
              title="Start Time, Meeting Point & Language"
              id="section-transit"
              icon="car"
              summary={`${startTime} · ${
                preferredTourLanguage || "EN"
              }${meetingPoint ? ` · ${meetingPoint}` : ""}`}
            >
              <div className="grid gap-5">
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#1BA58A]">
                    Start time
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {START_TIMES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setStartTime(t)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          startTime === t
                            ? "bg-[#075473] text-white"
                            : `${GLASS_CARD} text-white/70 hover:border-white/30`
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#1BA58A]">
                    Meeting point
                  </p>
                  <p className="mb-2 text-xs text-white/45">
                    Hotel lobby or station hub for morning pick-up.
                  </p>
                  <input
                    type="text"
                    value={meetingPoint}
                    onChange={(e) => setMeetingPoint(e.target.value)}
                    placeholder="e.g. Park Hyatt Tokyo lobby · Tokyo Station Yaesu"
                    className="w-full rounded-xl border border-white/15 bg-[#121212] px-3 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#075473]"
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
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#1BA58A]">
                    Preferred movement
                  </p>
                  <p className="mb-2 text-xs text-white/45">
                    Tap an option for how transfers work during your day.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {TRANSPORT_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const on = preferredMovement === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setMovementModal(opt.id)}
                          className={`${GLASS_CARD} flex flex-col items-center gap-1.5 px-2 py-3 text-[10px] transition ${
                            on
                              ? "ring-2 ring-[#075473] text-white"
                              : "text-white/70 hover:border-white/30"
                          }`}
                        >
                          <Icon className="h-4 w-4 text-cyan-400" />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div
                  className={`flex items-center justify-between px-3 py-2.5 text-xs ${GLASS_CARD} ${
                    overBudget ? "ring-1 ring-[#DC6E8A]/50 text-[#DC6E8A]" : "text-white/60"
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
            </SectionBlock>

                      </div>
                    </BuilderAccordionProvider>

                    <div className="mt-8 flex flex-col gap-3 px-4 sm:flex-row sm:px-6">
                      <button
                        type="button"
                        onClick={() => {
                          const email =
                            guestBadge.email ||
                            useItineraryStore.getState().clientEmail ||
                            "";
                          const ref =
                            confirmedBookingRef || tempBookingRef || "";
                          if (email && ref) {
                            void import("@/lib/syncBookingLead").then(
                              ({ syncSingleDayBookingLead }) =>
                                syncSingleDayBookingLead({
                                  bookingRef: ref,
                                  email,
                                  state: useSingleDayBuilderStore.getState(),
                                  cityId: selectedCity?.id,
                                  status: "lead",
                                })
                            );
                          }
                          window.location.href = "/builder-single/itinerary";
                        }}
                        className="inline-flex flex-1 items-center justify-center rounded-full bg-[#075473] px-5 py-3.5 text-sm font-semibold text-white"
                      >
                        Save day timeline
                      </button>
                      <Link
                        href="/pre-elite-builder"
                        className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-3.5 text-sm text-white/70"
                      >
                        Back to Pre-Build
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <BottomNav />
        </div>
      </div>

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

function SingleDayContinue({ next }: { next: number }) {
  const accordion = useBuilderAccordionOptional();
  const setExperiencesStepDone = useSingleDayBuilderStore(
    (s) => s.setExperiencesStepDone
  );
  if (!accordion) return null;
  return (
    <button
      type="button"
      onClick={() => {
        const snap = useSingleDayBuilderStore.getState();
        if (next === 3) {
          if (
            !isSingleDayStep2Complete({
              tourDate: snap.tourDate,
              tourHours: snap.tourHours,
              adults: snap.adults,
              cityFocus: snap.cityFocus,
              selectedExperienceCount: snap.selectedExperiences.length,
              experiencesStepDone: snap.experiencesStepDone,
            })
          ) {
            accordion.showToast(singleDayStepIncompleteMessage(2));
            return;
          }
        }
        if (next === 4) {
          // Skip or confirm experiences → unlock Transit
          setExperiencesStepDone(true);
        }
        // Force-open next (avoids stale unlock race after setExperiencesStepDone)
        accordion.advanceTo(next);
        requestAnimationFrame(() => {
          document
            .getElementById(
              next === 3
                ? "section-experiences"
                : next === 4
                  ? "section-transit"
                  : "section-city-focus"
            )
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }}
      className="mt-4 flex w-full items-center justify-center rounded-full border border-[#075473]/50 bg-[#05080C]/60 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition hover:border-[#075473] hover:bg-[#075473]/20"
    >
      Save & Continue →
    </button>
  );
}

