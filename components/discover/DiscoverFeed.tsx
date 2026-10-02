"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  cityPhoto,
  fetchDiscoverConfig,
  pbFileUrl,
  tourMediaType,
  tourPhoto,
  tourPrice,
  type DiscoverConfig,
  type PbCity,
  type PbTour,
} from "@/lib/pocketbase/client";
import { PB_THUMBS } from "@/lib/mediaThumbs";
import { chauffeurDaysForCity } from "@/lib/dateCascade";
import {
  canAddTourOnDate,
  getAvailableHours,
  TOUR_DAY_PACKED_MESSAGE,
  tourDurationHours,
} from "@/lib/tourValidator";
import {
  isGuideBudgetCatalogItem,
  selectedGuideHoursTotal,
  type CatalogItem,
} from "@/lib/experiencesPlaces";
import { useBuilderStore } from "@/store/useBuilderStore";
import {
  formatSingleDayDisplayDate,
  useSingleDayBuilderStore,
} from "@/store/useSingleDayBuilderStore";
import { useActiveMatchProfile } from "@/store/useQuizStore";
import { BottomNav } from "@/components/builder/BottomNav";
import { ExperienceProfilerModal } from "@/components/quiz/ExperienceProfilerModal";
import { ScheduleTourDaySheet } from "@/components/builder/ScheduleTourDaySheet";
import { TourDetailModal } from "@/components/builder/TourDetailModal";
import { ActivityMatcherVideoCard } from "@/components/discover/ActivityMatcherVideoCard";
import { DiscoverMatchesPanel } from "@/components/discover/DiscoverMatchesPanel";
import { ActivityMatchReelModal } from "@/components/modals/ActivityMatchReelModal";
import { buildMatchReelSlides } from "@/lib/matchReel";
import { rankToursByProfile, isBestMatchTour } from "@/lib/experienceProfiler";
import { useItineraryStore } from "@/store/useItineraryStore";
import { Play } from "lucide-react";
import {
  AppSidebar,
  APP_SIDEBAR_RAIL_PAD,
  MobileAppNav,
} from "@/components/navigation/AppSidebar";
import { CrimsonGlow } from "@/components/branding/CrimsonGlow";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

type ProfileTab = "tours" | "experiences" | "matches" | "places";

export function DiscoverFeed() {
  const [config, setConfig] = useState<DiscoverConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState<ProfileTab>("tours");
  const [modalSlide, setModalSlide] = useState<number | null>(null);
  const [pickingTour, setPickingTour] = useState<PbTour | null>(null);
  const [pendingLanguage, setPendingLanguage] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [reelOpen, setReelOpen] = useState(false);
  const [cityMismatch, setCityMismatch] = useState<{
    tour: PbTour;
    language: string;
    cityName: string;
  } | null>(null);

  const tripMode = useBuilderStore((s) => s.tripMode);
  const locations = useBuilderStore((s) => s.locations);
  const arrivalDate = useBuilderStore((s) => s.arrivalDate);
  const selectedToursMap = useBuilderStore((s) => s.selectedTours);
  const addCityTour = useBuilderStore((s) => s.addCityTour);
  const removeCityTour = useBuilderStore((s) => s.removeCityTour);
  const addLocation = useBuilderStore((s) => s.addLocation);
  const isEliteConcierge = useBuilderStore((s) => s.isEliteConcierge);
  const experienceProfile = useActiveMatchProfile();
  const userProfile = useItineraryStore((s) => s.userProfile);
  const adults = useBuilderStore((s) => s.adults);
  const children = useBuilderStore((s) => s.children);
  const guests = useMemo(
    () => ({ adults, children }),
    [adults, children]
  );

  const sdTourDate = useSingleDayBuilderStore((s) => s.tourDate);
  const sdCityFocus = useSingleDayBuilderStore((s) => s.cityFocus);
  const sdExperiences = useSingleDayBuilderStore((s) => s.selectedExperiences);
  const addExperience = useSingleDayBuilderStore((s) => s.addExperience);
  const removeExperience = useSingleDayBuilderStore((s) => s.removeExperience);
  const setCityFocus = useSingleDayBuilderStore((s) => s.setCityFocus);

  const isSingle = tripMode === "single_day";

  useEffect(() => {
    useBuilderStore.persist.rehydrate();
    fetchDiscoverConfig()
      .then((data) => {
        setConfig(data);
        if (data.cities[0]) setSelectedCityId(data.cities[0].id);
      })
      .catch(() => setConfig(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    setProfileTab("tours");
    setModalSlide(null);
  }, [selectedCityId]);

  useEffect(() => {
    setModalSlide(null);
  }, [profileTab]);

  const cities = useMemo(() => config?.cities ?? [], [config]);

  const cityTours = useMemo(() => {
    if (!selectedCityId || !config) return [];
    return config.tours.filter((t) => t.city_id === selectedCityId);
  }, [config, selectedCityId]);

  /** Guided tours vs activities vs landmark places for Discover tabs */
  const tourItems = useMemo(() => {
    const list = cityTours.filter((t) => {
      const et = String(t.entry_type || "").toLowerCase();
      if (et === "place") return false;
      const cat = String(t.category || "tour").toLowerCase();
      return cat !== "activity" && cat !== "place";
    });
    return rankToursByProfile(list, experienceProfile);
  }, [cityTours, experienceProfile]);
  const experienceTours = useMemo(() => {
    const list = cityTours.filter((t) => {
      const et = String(t.entry_type || "").toLowerCase();
      if (et === "place") return false;
      const cat = String(t.category || "").toLowerCase();
      return cat === "activity";
    });
    return rankToursByProfile(list, experienceProfile);
  }, [cityTours, experienceProfile]);
  const placeItems = useMemo(() => {
    return cityTours.filter((t) => {
      const et = String(t.entry_type || "").toLowerCase();
      if (et === "place") return true;
      return String(t.category || "").toLowerCase() === "place";
    });
  }, [cityTours]);

  const selectedCity = cities.find((c) => c.id === selectedCityId);
  const cityName = selectedCity?.name ?? "City";
  const selectedTours = selectedCityId
    ? selectedToursMap[selectedCityId] ?? []
    : [];

  const bookingHasCity = useMemo(() => {
    if (!selectedCity) return false;
    if (isSingle) {
      return (
        sdCityFocus.trim().toLowerCase() ===
        selectedCity.name.trim().toLowerCase()
      );
    }
    return locations.some((l) => l.cityId === selectedCity.id);
  }, [isSingle, locations, sdCityFocus, selectedCity]);

  const dayOptions = useMemo(() => {
    if (!selectedCityId) return [];
    if (isSingle) {
      if (!sdTourDate || !bookingHasCity) return [];
      return [
        {
          date: sdTourDate,
          tripDay: 1,
          label: `Tour day · ${formatSingleDayDisplayDate(sdTourDate)}`,
        },
      ];
    }
    return chauffeurDaysForCity(arrivalDate, locations, selectedCityId);
  }, [
    arrivalDate,
    bookingHasCity,
    isSingle,
    locations,
    sdTourDate,
    selectedCityId,
  ]);

  const bookedTourIds = isSingle
    ? sdExperiences.map((e) => e.tourId)
    : selectedTours.map((t) => t.tourId);

  const gridTours =
    profileTab === "experiences"
      ? experienceTours
      : profileTab === "places"
        ? placeItems
        : tourItems;

  const reelSlides = useMemo(
    () =>
      buildMatchReelSlides({
        cityTours,
        cityName,
        profile: experienceProfile,
        bookedTourIds,
        limit: 8,
      }),
    [cityTours, cityName, experienceProfile, bookedTourIds]
  );

  const tryAddSingle = useCallback(
    (tour: PbTour, selectedLanguage: string) => {
      if (!selectedLanguage.trim()) {
        return {
          ok: false as const,
          message: "Select a preferred language before adding this experience.",
        };
      }
      if (!sdTourDate) {
        return {
          ok: false as const,
          message: "Set your tour date in Builder S before adding experiences.",
        };
      }
      if (sdExperiences.some((e) => e.tourId === tour.id)) {
        removeExperience(tour.id);
        setToast("Removed from itinerary");
        return { ok: true as const };
      }
      const hours = tourDurationHours(tour);
      const cap = useSingleDayBuilderStore.getState().tourHours;
      const countsTowardGuide = isGuideBudgetCatalogItem(tour as CatalogItem);
      const usedGuide = selectedGuideHoursTotal(sdExperiences);
      if (countsTowardGuide && usedGuide + hours > cap + 0.01) {
        return { ok: false as const, message: TOUR_DAY_PACKED_MESSAGE };
      }
      addExperience({
        tourId: tour.id,
        title: tour.title,
        selectedLanguage: selectedLanguage.trim(),
        duration_hours: hours,
        price: tourPrice(tour, guests),
        access_type: String(tour.access_type || "").trim() || undefined,
        is_extra: !countsTowardGuide,
      });
      setToast(`Added · ${tour.title}`);
      return { ok: true as const };
    },
    [addExperience, guests, removeExperience, sdExperiences, sdTourDate]
  );

  const tryAddTour = useCallback(
    (tour: PbTour, scheduledDate: string, selectedLanguage: string) => {
      if (!selectedCityId) return { ok: false as const };
      if (!selectedLanguage.trim()) {
        return {
          ok: false as const,
          message: "Select a preferred language before adding this experience.",
        };
      }
      if (isEliteConcierge) {
        return {
          ok: false as const,
          message:
            "Elite Concierge is on. Individual tours are managed by your concierge.",
        };
      }
      if (isSingle) {
        return tryAddSingle(tour, selectedLanguage);
      }
      const check = canAddTourOnDate({
        selectedRows: selectedTours,
        scheduledDate,
        newTourDurationHours: tourDurationHours(tour),
        tourId: tour.id,
      });
      if (!check.ok) {
        return {
          ok: false as const,
          message: check.message ?? TOUR_DAY_PACKED_MESSAGE,
        };
      }
      const ok = addCityTour(selectedCityId, {
        tourId: tour.id,
        title: tour.title,
        duration_hours: tourDurationHours(tour),
        scheduledDate,
        selectedLanguage: selectedLanguage.trim(),
        price: tourPrice(tour, guests),
        access_type: String(tour.access_type || "").trim() || undefined,
        ...(tour.languages?.length ? { languages: tour.languages } : {}),
      });
      if (ok) setToast(`Added · ${tour.title}`);
      return {
        ok,
        message: ok ? undefined : TOUR_DAY_PACKED_MESSAGE,
      };
    },
    [
      addCityTour,
      guests,
      isEliteConcierge,
      isSingle,
      selectedCityId,
      selectedTours,
      tryAddSingle,
    ]
  );

  const proceedAdd = (tour: PbTour, selectedLanguage: string) => {
    if (isSingle) {
      const result = tryAddSingle(tour, selectedLanguage);
      if (!result.ok && result.message) setToast(result.message);
      return;
    }
    if (!arrivalDate || dayOptions.length === 0) {
      setToast(
        "Add this city and set arrival dates in the Builder before scheduling."
      );
      return;
    }
    if (dayOptions.length === 1) {
      const day = dayOptions[0];
      const hours = tourDurationHours(tour);
      const available = getAvailableHours(selectedTours, day.date);
      if (hours > available) {
        setToast(TOUR_DAY_PACKED_MESSAGE);
        return;
      }
      const result = tryAddTour(tour, day.date, selectedLanguage);
      if (!result.ok && result.message) setToast(result.message);
      return;
    }
    setPendingLanguage(selectedLanguage);
    setModalSlide(null);
    setPickingTour(tour);
  };

  const handleAddFromModal = (tour: PbTour, selectedLanguage: string) => {
    if (isSingle) {
      const booked = sdExperiences.some((e) => e.tourId === tour.id);
      if (booked) {
        removeExperience(tour.id);
        setToast("Removed from itinerary");
        return;
      }
    } else {
      const booked = selectedTours.find((t) => t.tourId === tour.id);
      if (booked) {
        if (selectedCityId) removeCityTour(selectedCityId, tour.id);
        setToast("Removed from itinerary");
        return;
      }
    }
    if (!selectedLanguage.trim()) {
      setToast("Select a preferred language before adding this experience.");
      return;
    }
    if (!bookingHasCity) {
      setCityMismatch({
        tour,
        language: selectedLanguage,
        cityName: selectedCity?.name ?? "this city",
      });
      return;
    }
    proceedAdd(tour, selectedLanguage);
  };

  const cityImg = selectedCity
    ? (() => {
        const filename = cityPhoto(selectedCity);
        return filename && selectedCity.collectionId
          ? pbFileUrl(
              selectedCity.collectionId,
              selectedCity.id,
              filename,
              { thumb: PB_THUMBS.chip, format: "webp" }
            )
          : "";
      })()
    : "";

  const cityBio = (selectedCity?.description ?? "").trim();

  return (
    <div className="builder-theme tokio-ambient-bg relative min-h-[100dvh] bg-transparent text-white">
      <AppSidebar
        brandEyebrow="TOKIOTOURS"
        brandTitle="Discover"
        expandOnHover
      />

      <div className={`${APP_SIDEBAR_RAIL_PAD} min-h-[100dvh] bg-transparent`}>
        <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0D1117]/70 text-white backdrop-blur-md lg:hidden">
          <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3 lg:max-w-xl">
            <div className="flex min-w-0 items-center gap-3">
              <MobileAppNav
                brandEyebrow="TOKIOTOURS"
                brandTitle="Discover"
              />
              <div className="min-w-0">
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.28em] text-[#075473]">
                  TOKIOTOURS
                </p>
                <h1 className="font-display text-xl leading-tight">Discover</h1>
              </div>
            </div>
            <Link
              href="/builder"
              className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/90"
            >
              Builder
            </Link>
          </div>
        </header>

        {/* Full-width city avatar bar — breaks out of content max-width */}
        <div className="w-full border-b border-white/5 bg-[#0D1117]/50 pb-4 backdrop-blur-md">
          <div
            className="w-full overflow-x-auto px-4 pt-4 sm:px-8 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="Cities"
          >
            <div className="mx-auto flex min-w-max items-center justify-start gap-4 sm:justify-center">
              {loading ? (
                <p className="text-sm text-white/50">Loading cities…</p>
              ) : cities.length === 0 ? (
                <p className="text-sm text-white/50">No cities yet.</p>
              ) : (
                cities.map((city, i) => (
                  <CityStory
                    key={city.id || `city-${i}`}
                    city={city}
                    active={city.id === selectedCityId}
                    onSelect={() => setSelectedCityId(city.id)}
                    eager={i < 4}
                  />
                ))
              )}
            </div>
          </div>
        </div>

      {toast ? (
        <div
          role="status"
          className="fixed left-1/2 top-[7.5rem] z-50 max-w-[90vw] -translate-x-1/2 rounded-xl border border-[#075473]/50 bg-[#FAF0E6] px-3.5 py-2.5 text-center text-sm text-[#632502] shadow-lg"
        >
          ⚠️ {toast}
        </div>
      ) : null}

      <main className="mx-auto max-w-lg bg-transparent px-4 pb-32 md:pb-12 lg:max-w-xl lg:px-8">
        {loading || !selectedCity ? (
          <p className="py-16 text-center text-sm text-zinc-500">
            {loading ? "Loading…" : "Select a city"}
          </p>
        ) : (
          <>
            {/* Destination header */}
            <div className="relative mx-auto mt-3 flex max-w-lg items-center gap-6 overflow-hidden rounded-2xl border border-white/10 bg-[#0A1017]/80 p-4 text-white shadow-2xl backdrop-blur-md lg:max-w-none">
              <CrimsonGlow placement="right" />
              <div className="relative z-10 flex w-full items-center gap-6">
              {cityImg ? (
                <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl border-2 border-[#075473] shadow-xl sm:h-28 sm:w-28">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cityImg}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-[#075473] bg-zinc-900/80 font-display text-2xl text-[#075473] shadow-xl backdrop-blur-sm sm:h-28 sm:w-28">
                  {cityName.slice(0, 1)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-2xl font-bold">{cityName}</h2>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  <span>
                    <span className="font-semibold text-white">
                      {tourItems.length}
                    </span>{" "}
                    <span className="text-zinc-400">Tours</span>
                  </span>
                  <span>
                    <span className="font-semibold text-white">
                      {experienceTours.length}
                    </span>{" "}
                    <span className="text-zinc-400">Experiences</span>
                  </span>
                  <span>
                    <span className="font-semibold text-white">
                      {placeItems.length}
                    </span>{" "}
                    <span className="text-zinc-400">Places</span>
                  </span>
                </div>
                {cityBio ? (
                  <p className="mt-2 line-clamp-2 text-sm text-zinc-400">
                    {cityBio}
                  </p>
                ) : null}
              </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="sticky top-0 z-30 mt-3 flex justify-around border-b border-t border-white/10 bg-[#0D1117]/70 py-3 backdrop-blur-md">
              {(
                [
                  { id: "tours" as const, label: "Tours" },
                  { id: "experiences" as const, label: "Experiences" },
                  { id: "places" as const, label: "Places" },
                  { id: "matches" as const, label: "Your Matches" },
                ] as const
              ).map((tab) => {
                const active = profileTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setProfileTab(tab.id)}
                    className={`relative px-2 pb-2 text-xs font-semibold uppercase tracking-wider ${
                      active ? "text-white" : "text-zinc-500"
                    }`}
                  >
                    {tab.label}
                    {active ? (
                      <span className="absolute inset-x-0 -bottom-[13px] h-0.5 bg-white" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Tab panels */}
            {profileTab === "matches" ? (
              <DiscoverMatchesPanel
                cityName={cityName}
                experienceProfile={experienceProfile}
                userProfile={userProfile}
                tours={cityTours}
                onRetakeQuiz={() => setQuizOpen(true)}
                onPlayReel={() => setReelOpen(true)}
              />
            ) : (
              <>
                {gridTours.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-zinc-500">
                    No{" "}
                    {profileTab === "experiences" ? "experiences" : "tours"}{" "}
                    available for this city yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-1">
                    {gridTours.map((tour, index) => (
                      <TourThumb
                        key={tour.id || `tour-${index}`}
                        tour={tour}
                        booked={bookedTourIds.includes(tour.id)}
                        recommended={isBestMatchTour(tour, experienceProfile)}
                        onClick={() => setModalSlide(index)}
                      />
                    ))}
                  </div>
                )}

                {/* Matcher CTA sits below the photo grid */}
                <div className="px-4 pb-8 pt-5">
                  <ActivityMatcherVideoCard
                    onOpenQuiz={() => setQuizOpen(true)}
                    onWatch={() => setReelOpen(true)}
                  />
                </div>
              </>
            )}
          </>
        )}
      </main>
      </div>

      <ActivityMatchReelModal
        open={reelOpen}
        onClose={() => setReelOpen(false)}
        slides={reelSlides}
        experienceProfile={experienceProfile}
        userProfile={userProfile}
      />

      <TourDetailModal
        open={modalSlide !== null && gridTours.length > 0}
        tours={gridTours}
        initialSlide={modalSlide ?? 0}
        guests={guests}
        hidePrice
        isTourSelected={(id) => bookedTourIds.includes(id)}
        scheduledLabelFor={(id) => {
          if (isSingle) {
            if (!sdExperiences.some((e) => e.tourId === id) || !sdTourDate) {
              return null;
            }
            return `Tour day · ${formatSingleDayDisplayDate(sdTourDate)}`;
          }
          const row = selectedTours.find((t) => t.tourId === id);
          if (!row?.scheduledDate) return null;
          return (
            dayOptions.find((d) => d.date === row.scheduledDate)?.label ??
            row.scheduledDate
          );
        }}
        bookedLanguageFor={(id) => {
          if (isSingle) {
            return (
              sdExperiences.find((e) => e.tourId === id)?.selectedLanguage ||
              null
            );
          }
          const row = selectedTours.find((t) => t.tourId === id);
          return row?.selectedLanguage || null;
        }}
        onClose={() => setModalSlide(null)}
        onAdd={(tour, lang) => handleAddFromModal(tour, lang)}
      />

      <ScheduleTourDaySheet
        open={!!pickingTour && !!pendingLanguage && !isSingle}
        tour={pickingTour}
        cityName={cityName}
        dayOptions={dayOptions}
        selectedTours={selectedTours}
        onClose={() => {
          setPickingTour(null);
          setPendingLanguage("");
        }}
        onSelectDay={(date) =>
          pickingTour
            ? tryAddTour(pickingTour, date, pendingLanguage)
            : { ok: false }
        }
        onToast={setToast}
      />

      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {cityMismatch ? (
                <motion.div
                  key="city-mismatch-fox"
                  className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 px-4 pb-8 sm:items-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  role="dialog"
                  aria-modal="true"
                  aria-label="City not on your trip"
                >
                  <motion.div
                    className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-[#0D1117] p-5 shadow-2xl"
                    initial={{ y: 24, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 24, opacity: 0 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/brand/fox-peek.webp"
                      alt=""
                      className="mx-auto h-28 w-auto object-contain"
                    />
                    <p className="mt-3 text-center font-godiva text-lg uppercase tracking-wide text-white">
                      {cityMismatch.cityName} isn&apos;t on your trip
                    </p>
                    <p className="mt-2 text-center text-sm text-zinc-400">
                      Yes = add this city / another day. No = change your tour
                      city to {cityMismatch.cityName}.
                    </p>
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className="rounded-xl bg-[#075473] px-3 py-3 text-xs font-bold uppercase tracking-wider text-white"
                        onClick={() => {
                          const pending = cityMismatch;
                          setCityMismatch(null);
                          if (!pending.tour.city_id) {
                            setToast("Missing city on this experience.");
                            return;
                          }
                          if (isSingle) {
                            const city = cities.find(
                              (c) => c.id === pending.tour.city_id
                            );
                            if (city) setCityFocus(city.name);
                            proceedAdd(pending.tour, pending.language);
                            return;
                          }
                          addLocation(pending.tour.city_id);
                          proceedAdd(pending.tour, pending.language);
                        }}
                      >
                        Yes · add
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-white/20 bg-black/40 px-3 py-3 text-xs font-bold uppercase tracking-wider text-white"
                        onClick={() => {
                          const pending = cityMismatch;
                          setCityMismatch(null);
                          const city = cities.find(
                            (c) => c.id === pending.tour.city_id
                          );
                          if (isSingle) {
                            if (city) setCityFocus(city.name);
                            proceedAdd(pending.tour, pending.language);
                            return;
                          }
                          // Change city: if not on route, add it then schedule
                          if (
                            city &&
                            !locations.some((l) => l.cityId === city.id)
                          ) {
                            addLocation(city.id);
                          }
                          proceedAdd(pending.tour, pending.language);
                        }}
                      >
                        No · change city
                      </button>
                    </div>
                    <button
                      type="button"
                      className="mt-3 w-full text-center text-[11px] text-zinc-500 underline"
                      onClick={() => setCityMismatch(null)}
                    >
                      Cancel
                    </button>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}

      <div className="lg:hidden">
        <BottomNav />
      </div>
      <ExperienceProfilerModal
        open={quizOpen}
        onClose={() => setQuizOpen(false)}
      />
    </div>
  );
}

function TourThumb({
  tour,
  booked,
  recommended = false,
  onClick,
}: {
  tour: PbTour;
  booked: boolean;
  recommended?: boolean;
  onClick: () => void;
}) {
  const isVideo = tourMediaType(tour) === "Video";
  const thumbFile = tourPhoto(tour);
  const thumbUrl =
    thumbFile && tour.collectionId
      ? pbFileUrl(tour.collectionId, tour.id, thumbFile, {
          thumb: PB_THUMBS.card,
          format: "webp",
        })
      : "";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={tour.title}
      className="group relative aspect-[3/4] cursor-pointer overflow-hidden rounded-sm border border-zinc-800/60 bg-[#0D1117]/60 backdrop-blur-sm"
    >
      {thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl}
          alt=""
          width={600}
          height={400}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-all duration-300 group-hover:scale-105 group-hover:brightness-90"
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-[#1a3355] to-[#0B1F3A] transition-all duration-300 group-hover:brightness-90" />
      )}

      {/* Base dim + bottom scrim for title contrast; +10% darken on hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[5] bg-black/20 transition-all duration-300 group-hover:bg-black/30 group-active:bg-black/30"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[6] h-2/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-opacity duration-300"
      />

      {/* Pure white title — high contrast on hover / touch */}
      <div className="pointer-events-none absolute inset-0 z-10 flex items-end justify-center p-2.5 pb-3 text-center opacity-0 transition-all duration-300 group-hover:opacity-100 group-active:opacity-100 sm:items-center sm:pb-2.5">
        <h4 className="line-clamp-3 break-words text-[10px] font-extrabold uppercase leading-tight tracking-wider text-white drop-shadow-md whitespace-normal [text-shadow:0_1px_3px_rgba(0,0,0,0.85),0_2px_8px_rgba(0,0,0,0.55)] sm:text-xs">
          {tour.title}
        </h4>
      </div>
      {recommended ? (
        <span className="absolute left-1 top-1 z-20 flex items-center gap-1 rounded-full bg-accent-500/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
          ⭐ Match
        </span>
      ) : null}
      {isVideo ? (
        <span className="absolute right-1.5 top-1.5 z-20 text-white drop-shadow-md">
          <Play className="h-3.5 w-3.5 fill-white" aria-hidden />
        </span>
      ) : null}
      {booked ? (
        <span
          className={`absolute z-20 rounded bg-[#075473] px-1.5 py-0.5 text-[8px] font-bold text-white shadow ${
            recommended ? "left-1 top-7" : "left-1 top-1"
          }`}
        >
          Added
        </span>
      ) : null}
    </button>
  );
}

function CityStory({
  city,
  active,
  onSelect,
  eager = false,
}: {
  city: PbCity;
  active: boolean;
  onSelect: () => void;
  /** First few pills load eagerly so the strip paints fast */
  eager?: boolean;
}) {
  const filename = cityPhoto(city);
  const src =
    filename && city.collectionId
      ? pbFileUrl(city.collectionId, city.id, filename, {
          thumb: PB_THUMBS.pill,
          format: "webp",
        })
      : "";

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className="group flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 transition-transform active:scale-95"
    >
      <span
        className={`rounded-full p-[2px] transition-colors ${
          active
            ? "bg-gradient-to-tr from-[#075473] via-[#F3D9C4] to-[#075473]"
            : "bg-white/25 group-hover:bg-[#F6A724]/80"
        }`}
      >
        <span className="block rounded-full bg-[#05080C]/90 p-[2px] backdrop-blur-sm">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              width={64}
              height={64}
              loading={eager ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={eager ? "high" : "auto"}
              className="h-14 w-14 rounded-full object-cover transition-transform duration-300 group-hover:scale-110 sm:h-16 sm:w-16"
            />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1a3355] font-display text-lg text-[#075473] sm:h-16 sm:w-16">
              {city.name.slice(0, 1)}
            </span>
          )}
        </span>
      </span>
      <span
        className={`mt-0.5 w-full truncate text-center text-[11px] font-medium transition-colors sm:text-xs ${
          active
            ? "font-semibold text-white"
            : "text-gray-400 group-hover:text-white"
        }`}
      >
        {city.name}
      </span>
    </button>
  );
}
