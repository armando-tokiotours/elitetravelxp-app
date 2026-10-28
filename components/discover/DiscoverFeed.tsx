"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { CatalogSlotImg } from "@/components/catalog/CatalogSlotPhoto";
import { groupToursByFamily } from "@/lib/tourFamilies";
import { MobileAppNav } from "@/components/navigation/AppSidebar";
import {
  MOBILE_HEADER_SCROLLED_GLOSS,
  useMobileHeaderScrolled,
} from "@/components/navigation/MobileTopChrome";
import { CrimsonGlow } from "@/components/branding/CrimsonGlow";
import { FoxConfirmModal } from "@/components/branding/FoxConfirmModal";

type ProfileTab = "tours" | "experiences" | "matches" | "places";

/** Fox city gates on Discover — entry (no trip city) or cross-city Add. */
type FoxCityGate =
  | {
      kind: "no_city";
      /** Set when Add was attempted before a trip city exists. */
      tour?: PbTour;
      language?: string;
    }
  | {
      kind: "cross_city";
      tour: PbTour;
      language: string;
      cityName: string;
    };

export function DiscoverFeed() {
  // Same mobile glossy-blue-on-scroll as MobileTopChrome (shared hook).
  const headerScrolled = useMobileHeaderScrolled();
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
  const [foxGate, setFoxGate] = useState<FoxCityGate | null>(null);
  const [storesHydrated, setStoresHydrated] = useState(false);
  /** Entry "no city" prompt once per Discover visit (Cancel must not loop). */
  const entryNoCityPromptedRef = useRef(false);

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
  const changeCityFocus = useSingleDayBuilderStore((s) => s.changeCityFocus);

  const isSingle = tripMode === "single_day";

  const hasTripCity = useMemo(() => {
    if (isSingle) return Boolean(sdCityFocus.trim());
    return locations.some((l) => Boolean(l.cityId));
  }, [isSingle, locations, sdCityFocus]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.all([
        Promise.resolve(useBuilderStore.persist.rehydrate()),
        Promise.resolve(useSingleDayBuilderStore.persist.rehydrate()),
      ]).catch(() => undefined);
      if (!cancelled) setStoresHydrated(true);
    })();
    fetchDiscoverConfig()
      .then((data) => {
        if (cancelled) return;
        setConfig(data);
        if (data.cities[0]) setSelectedCityId(data.cities[0].id);
      })
      .catch(() => {
        if (!cancelled) setConfig(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Entering Discover with no trip city → fox asks to confirm/pick.
  useEffect(() => {
    if (
      loading ||
      !storesHydrated ||
      !config ||
      entryNoCityPromptedRef.current
    ) {
      return;
    }
    if (hasTripCity) return;
    entryNoCityPromptedRef.current = true;
    setFoxGate({ kind: "no_city" });
  }, [config, hasTripCity, loading, storesHydrated]);

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

  // One card per tour FAMILY (master product); durations live inside
  // the card as variants — never 6 near-identical cards for 4h/6h/8h.
  const gridFamilies = useMemo(
    () => groupToursByFamily(gridTours),
    [gridTours]
  );
  const tourFamilyCount = useMemo(
    () => groupToursByFamily(tourItems).length,
    [tourItems]
  );
  const experienceFamilyCount = useMemo(
    () => groupToursByFamily(experienceTours).length,
    [experienceTours]
  );

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
    // Read store after optional city apply so day options aren't stale.
    const cityId = selectedCityId || tour.city_id || null;
    const snap = useBuilderStore.getState();
    const days = cityId
      ? chauffeurDaysForCity(snap.arrivalDate, snap.locations, cityId)
      : [];
    const cityRows = cityId ? snap.selectedTours[cityId] ?? [] : [];
    if (!snap.arrivalDate || days.length === 0) {
      setToast(
        "Add this city and set arrival dates in the Builder before scheduling."
      );
      return;
    }
    if (days.length === 1) {
      const day = days[0];
      const hours = tourDurationHours(tour);
      const available = getAvailableHours(cityRows, day.date);
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

  const applyDiscoverCityToTrip = useCallback(() => {
    if (!selectedCity) return false;
    if (isSingle) {
      const same =
        sdCityFocus.trim().toLowerCase() ===
        selectedCity.name.trim().toLowerCase();
      if (same) {
        setCityFocus(selectedCity.name);
      } else if (sdCityFocus.trim()) {
        // Builder already had a different city — reset city-bound picks.
        changeCityFocus(selectedCity.name);
      } else {
        setCityFocus(selectedCity.name);
      }
      return true;
    }
    if (!selectedCity.id) return false;
    if (!locations.some((l) => l.cityId === selectedCity.id)) {
      addLocation(selectedCity.id);
    }
    return true;
  }, [
    addLocation,
    changeCityFocus,
    isSingle,
    locations,
    sdCityFocus,
    selectedCity,
    setCityFocus,
  ]);

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
    // No trip city yet → confirm/pick before adding.
    if (!hasTripCity) {
      setFoxGate({
        kind: "no_city",
        tour,
        language: selectedLanguage,
      });
      return;
    }
    // Builder has a city; Discover city differs → change city + add?
    if (!bookingHasCity) {
      setFoxGate({
        kind: "cross_city",
        tour,
        language: selectedLanguage,
        cityName: selectedCity?.name ?? "this city",
      });
      return;
    }
    proceedAdd(tour, selectedLanguage);
  };

  const dismissFoxGate = () => setFoxGate(null);

  const confirmFoxGatePrimary = () => {
    const gate = foxGate;
    if (!gate) return;
    setFoxGate(null);
    const ok = applyDiscoverCityToTrip();
    if (!ok) {
      setToast("Missing city on this experience.");
      return;
    }
    if (gate.kind === "no_city") {
      if (gate.tour && gate.language) {
        proceedAdd(gate.tour, gate.language);
      } else {
        setToast(
          `Trip city set · ${selectedCity?.name ?? "city"}. Browse and add when ready.`
        );
      }
      return;
    }
    // cross_city: change city + add
    proceedAdd(gate.tour, gate.language);
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
      {/* No AppSidebar / legacy BottomNav here: app/discover/layout.tsx
          mounts the same magic-nav AppNavDock as the builders (desktop
          rail + mobile bottom dock; disc on Discover for 1-Day or Explore
          for VIP). Rail/dock clearance comes from that layout
          (lg:pl-16 / pb-20), not a pad here. */}
      <div className="min-h-[100dvh] bg-transparent">
        <header
          data-scrolled={headerScrolled ? "true" : "false"}
          className={`sticky top-0 z-40 text-white transition-[background-color,box-shadow,backdrop-filter] duration-300 ease-out lg:hidden ${
            headerScrolled
              ? `border-b border-white/10 ${MOBILE_HEADER_SCROLLED_GLOSS}`
              : "border-b border-transparent bg-transparent"
          }`}
        >
          <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3 lg:max-w-xl">
            <div className="flex min-w-0 items-center gap-3">
              <MobileAppNav
                brandEyebrow="TOKIOTOURS"
                brandTitle="Discover"
                hideManageBooking
              />
              <div className="min-w-0">
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.28em] text-[#D91147]">
                  TOKIOTOURS
                </p>
                <h1 className="font-display text-xl leading-tight">Discover</h1>
              </div>
            </div>
            {/* Builder → homepage journey-type / sector option selection
                (Single Day · VIP Tickets · Multi Day cards, screenshot 3).
                `/#options` lands directly on that finale — GridSequenceHero
                scrolls to the option cards when the hash is present.
                Previously this went straight to /builder (Multi-Day). */}
            <Link
              href="/#options"
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
                      {tourFamilyCount}
                    </span>{" "}
                    <span className="text-zinc-400">Tours</span>
                  </span>
                  <span>
                    <span className="font-semibold text-white">
                      {experienceFamilyCount}
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
                {gridFamilies.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-zinc-500">
                    No{" "}
                    {profileTab === "experiences" ? "experiences" : "tours"}{" "}
                    available for this city yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-1">
                    {gridFamilies.map((family) => {
                      const masterIndex = gridTours.findIndex(
                        (t) => t.id === family.master.id
                      );
                      return (
                        <TourThumb
                          key={family.key}
                          tour={family.master}
                          displayTitle={family.title}
                          durations={family.variants
                            .map((v) => Number(v.duration_hours) || 0)
                            .filter((h) => h > 0)}
                          booked={family.variants.some((v) =>
                            bookedTourIds.includes(v.id)
                          )}
                          recommended={family.variants.some((v) =>
                            isBestMatchTour(v, experienceProfile)
                          )}
                          onClick={() =>
                            setModalSlide(masterIndex >= 0 ? masterIndex : 0)
                          }
                        />
                      );
                    })}
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
        cityName={cityName}
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

      <FoxConfirmModal
        open={foxGate?.kind === "no_city"}
        title="No city on your trip yet"
        body={`Yes = use ${cityName} for your trip${
          foxGate?.kind === "no_city" && foxGate.tour
            ? " and add this experience"
            : ""
        }. Cancel = keep browsing.`}
        primaryLabel={
          foxGate?.kind === "no_city" && foxGate.tour
            ? "Yes · use city & add"
            : "Yes · use city"
        }
        onPrimary={confirmFoxGatePrimary}
        onCancel={dismissFoxGate}
        ariaLabel="No city on your trip yet"
      />

      <FoxConfirmModal
        open={foxGate?.kind === "cross_city"}
        title={
          foxGate?.kind === "cross_city"
            ? `${foxGate.cityName} isn't on your trip`
            : "Another city"
        }
        body={
          foxGate?.kind === "cross_city"
            ? `This activity is for ${foxGate.cityName}. Change your trip city to ${foxGate.cityName} and add this tour?`
            : ""
        }
        primaryLabel="Yes · change & add"
        secondaryLabel="No · keep city"
        onPrimary={confirmFoxGatePrimary}
        onSecondary={dismissFoxGate}
        onCancel={dismissFoxGate}
        ariaLabel="City not on your trip"
      />

      <ExperienceProfilerModal
        open={quizOpen}
        onClose={() => setQuizOpen(false)}
      />
    </div>
  );
}

function TourThumb({
  tour,
  displayTitle,
  durations = [],
  booked,
  recommended = false,
  onClick,
}: {
  tour: PbTour;
  /** Clean family title (hours stripped) — one card per product. */
  displayTitle?: string;
  /** Variant durations inside this family, e.g. [6, 8]. */
  durations?: number[];
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
      <CatalogSlotImg
        recordId={tour.id}
        fallbackSrc={thumbUrl}
        className="h-full w-full object-cover transition-all duration-300 group-hover:scale-105 group-hover:brightness-90"
        emptyClassName="h-full w-full bg-gradient-to-br from-[#1a3355] to-[#0B1F3A] transition-all duration-300 group-hover:brightness-90"
      />

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
          {displayTitle || tour.title}
        </h4>
      </div>
      {durations.length > 1 ? (
        <div className="absolute bottom-1.5 left-1.5 z-20 flex gap-1">
          {durations.map((h) => (
            <span
              key={h}
              className="rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm"
            >
              {h}h
            </span>
          ))}
        </div>
      ) : null}
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
          <CatalogSlotImg
            recordId={city.id}
            fallbackSrc={src}
            className="h-14 w-14 rounded-full object-cover transition-transform duration-300 group-hover:scale-110 sm:h-16 sm:w-16"
            emptyClassName="h-14 w-14 rounded-full bg-[#1a3355] sm:h-16 sm:w-16"
          />
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
