"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  cityPhoto,
  fetchBuilderConfig,
  pbFileUrl,
  tourMediaType,
  tourPhoto,
  tourPrice,
  type BuilderConfig,
  type PbCity,
  type PbTour,
} from "@/lib/pocketbase/client";
import { chauffeurDaysForCity } from "@/lib/dateCascade";
import {
  canAddTourOnDate,
  getAvailableHours,
  TOUR_DAY_PACKED_MESSAGE,
  tourDurationHours,
} from "@/lib/tourValidator";
import { useBuilderStore } from "@/store/useBuilderStore";
import { BottomNav } from "@/components/builder/BottomNav";
import { ScheduleTourDaySheet } from "@/components/builder/ScheduleTourDaySheet";
import { TourDetailModal } from "@/components/builder/TourDetailModal";
import { Play } from "lucide-react";

type ProfileTab = "tours" | "experiences" | "info";

export function DiscoverFeed() {
  const [config, setConfig] = useState<BuilderConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState<ProfileTab>("tours");
  const [modalSlide, setModalSlide] = useState<number | null>(null);
  const [pickingTour, setPickingTour] = useState<PbTour | null>(null);
  const [pendingLanguage, setPendingLanguage] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const locations = useBuilderStore((s) => s.locations);
  const arrivalDate = useBuilderStore((s) => s.arrivalDate);
  const selectedToursMap = useBuilderStore((s) => s.selectedTours);
  const addCityTour = useBuilderStore((s) => s.addCityTour);
  const removeCityTour = useBuilderStore((s) => s.removeCityTour);
  const isEliteConcierge = useBuilderStore((s) => s.isEliteConcierge);
  const adults = useBuilderStore((s) => s.adults);
  const children = useBuilderStore((s) => s.children);
  const guests = useMemo(
    () => ({ adults, children }),
    [adults, children]
  );

  useEffect(() => {
    useBuilderStore.persist.rehydrate();
    fetchBuilderConfig()
      .then((data) => {
        setConfig(data);
        const active = data.cities.filter((c) => c.is_active !== false);
        if (active[0]) setSelectedCityId(active[0].id);
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

  const cities = useMemo(
    () => (config?.cities ?? []).filter((c) => c.is_active !== false),
    [config]
  );

  const cityTours = useMemo(() => {
    if (!selectedCityId || !config) return [];
    return config.tours.filter(
      (t) => t.city_id === selectedCityId && t.is_active !== false
    );
  }, [config, selectedCityId]);

  /** Guided tours vs activities for Discover tabs */
  const tourItems = useMemo(
    () =>
      cityTours.filter((t) => {
        const cat = String(t.category || "tour").toLowerCase();
        return cat !== "activity";
      }),
    [cityTours]
  );
  const experienceTours = useMemo(
    () =>
      cityTours.filter((t) => {
        const cat = String(t.category || "").toLowerCase();
        return cat === "activity";
      }),
    [cityTours]
  );

  const selectedCity = cities.find((c) => c.id === selectedCityId);
  const cityName = selectedCity?.name ?? "City";
  const selectedTours = selectedCityId
    ? selectedToursMap[selectedCityId] ?? []
    : [];
  const dayOptions = selectedCityId
    ? chauffeurDaysForCity(arrivalDate, locations, selectedCityId)
    : [];

  const gridTours =
    profileTab === "experiences" ? experienceTours : tourItems;

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
            "Elite Concierge is on — individual tours are managed by your concierge.",
        };
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
        ...(tour.languages?.length ? { languages: tour.languages } : {}),
      });
      if (ok) setToast(`Added · ${tour.title}`);
      return {
        ok,
        message: ok ? undefined : TOUR_DAY_PACKED_MESSAGE,
      };
    },
    [addCityTour, guests, isEliteConcierge, selectedCityId, selectedTours]
  );

  const handleAddFromModal = (tour: PbTour, selectedLanguage: string) => {
    const booked = selectedTours.find((t) => t.tourId === tour.id);
    if (booked) {
      if (selectedCityId) removeCityTour(selectedCityId, tour.id);
      setToast("Removed from itinerary");
      return;
    }
    if (!selectedLanguage.trim()) {
      setToast("Select a preferred language before adding this experience.");
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

  const cityImg = selectedCity
    ? (() => {
        const filename = cityPhoto(selectedCity);
        return filename && selectedCity.collectionId
          ? pbFileUrl(
              selectedCity.collectionId,
              selectedCity.id,
              filename,
              "200x200"
            )
          : "";
      })()
    : "";

  const cityBio = (selectedCity?.description ?? "").trim();

  return (
    <div className="builder-theme relative min-h-[100dvh] bg-black text-white">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-black/95 text-white backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div>
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.28em] text-[#C4A35A]">
              Elite Travel
            </p>
            <h1 className="font-display text-xl leading-tight">Discover</h1>
          </div>
          <Link
            href="/builder"
            className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/90"
          >
            Builder
          </Link>
        </div>
      </header>

      <div
        className="mx-auto flex max-w-lg snap-x snap-mandatory gap-4 overflow-x-auto border-b border-zinc-800 bg-black px-4 py-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Cities"
      >
        {loading ? (
          <p className="text-sm text-white/50">Loading cities…</p>
        ) : cities.length === 0 ? (
          <p className="text-sm text-white/50">No cities yet.</p>
        ) : (
          cities.map((city) => (
            <CityStory
              key={city.id}
              city={city}
              active={city.id === selectedCityId}
              onSelect={() => setSelectedCityId(city.id)}
            />
          ))
        )}
      </div>

      {toast ? (
        <div
          role="status"
          className="fixed left-1/2 top-[7.5rem] z-50 max-w-[90vw] -translate-x-1/2 rounded-xl border border-[#C4A35A]/50 bg-[#F7EFD9] px-3.5 py-2.5 text-center text-sm text-[#6B5420] shadow-lg"
        >
          ⚠️ {toast}
        </div>
      ) : null}

      <main className="mx-auto max-w-lg bg-black pb-32 md:pb-12">
        {loading || !selectedCity ? (
          <p className="py-16 text-center text-sm text-zinc-500">
            {loading ? "Loading…" : "Select a city"}
          </p>
        ) : (
          <>
            {/* Profile header */}
            <div className="flex items-center gap-6 p-4 text-white">
              {cityImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cityImg}
                  alt=""
                  className="h-20 w-20 shrink-0 rounded-full border border-zinc-700 object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 font-display text-2xl text-[#C4A35A]">
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
                </div>
                {cityBio ? (
                  <p className="mt-2 line-clamp-2 text-sm text-zinc-400">
                    {cityBio}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Tabs */}
            <div className="sticky top-0 z-30 flex justify-around border-b border-t border-zinc-800 bg-black py-3">
              {(
                [
                  { id: "tours" as const, label: "Tours" },
                  { id: "experiences" as const, label: "Experiences" },
                  { id: "info" as const, label: "Extra Info" },
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
            {profileTab === "info" ? (
              <div className="space-y-3 px-4 py-6 text-sm text-zinc-300">
                <h3 className="text-base font-semibold text-white">
                  About {cityName}
                </h3>
                {cityBio ? (
                  <p className="whitespace-pre-wrap leading-relaxed text-zinc-400">
                    {cityBio}
                  </p>
                ) : (
                  <p className="text-zinc-500">
                    No extra info published for this city yet.
                  </p>
                )}
                <p className="text-xs text-zinc-500">
                  {tourItems.length} tour{tourItems.length === 1 ? "" : "s"} ·{" "}
                  {experienceTours.length} experience
                  {experienceTours.length === 1 ? "" : "s"}
                </p>
              </div>
            ) : gridTours.length === 0 ? (
              <p className="col-span-3 px-4 py-10 text-center text-sm text-zinc-500">
                No {profileTab === "experiences" ? "experiences" : "tours"}{" "}
                available for this city yet.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-1 pb-32">
                {gridTours.map((tour, index) => (
                  <TourThumb
                    key={tour.id}
                    tour={tour}
                    booked={selectedTours.some((t) => t.tourId === tour.id)}
                    onClick={() => setModalSlide(index)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <TourDetailModal
        open={modalSlide !== null && gridTours.length > 0}
        tours={gridTours}
        initialSlide={modalSlide ?? 0}
        guests={guests}
        isTourSelected={(id) => selectedTours.some((t) => t.tourId === id)}
        scheduledLabelFor={(id) => {
          const row = selectedTours.find((t) => t.tourId === id);
          if (!row?.scheduledDate) return null;
          return (
            dayOptions.find((d) => d.date === row.scheduledDate)?.label ??
            row.scheduledDate
          );
        }}
        bookedLanguageFor={(id) => {
          const row = selectedTours.find((t) => t.tourId === id);
          return row?.selectedLanguage || null;
        }}
        onClose={() => setModalSlide(null)}
        onAdd={(tour, lang) => handleAddFromModal(tour, lang)}
      />

      <ScheduleTourDaySheet
        open={!!pickingTour && !!pendingLanguage}
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

      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  );
}

function TourThumb({
  tour,
  booked,
  onClick,
}: {
  tour: PbTour;
  booked: boolean;
  onClick: () => void;
}) {
  const isVideo = tourMediaType(tour) === "Video";
  const thumbFile = tourPhoto(tour);
  const mediaFile = tour.media_file || tour.cover_photo || tour.image || "";
  const thumbUrl =
    thumbFile && tour.collectionId
      ? pbFileUrl(tour.collectionId, tour.id, thumbFile, "300x300")
      : mediaFile && tour.collectionId && !isVideo
        ? pbFileUrl(tour.collectionId, tour.id, mediaFile, "300x300")
        : "";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={tour.title}
      className="group relative aspect-square cursor-pointer bg-zinc-900"
    >
      {thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl}
          alt=""
          className="h-full w-full object-cover transition group-hover:opacity-90"
        />
      ) : isVideo && mediaFile && tour.collectionId ? (
        <video
          src={pbFileUrl(tour.collectionId, tour.id, mediaFile)}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-end bg-gradient-to-br from-[#1a3355] to-[#0B1F3A] p-2">
          <span className="line-clamp-3 text-left text-[10px] font-medium text-white/90">
            {tour.title}
          </span>
        </div>
      )}
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
      {isVideo ? (
        <span className="absolute right-1.5 top-1.5 text-white drop-shadow-md">
          <Play className="h-3.5 w-3.5 fill-white" aria-hidden />
        </span>
      ) : null}
      {booked ? (
        <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[9px] font-semibold text-[#E8D5A3]">
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
}: {
  city: PbCity;
  active: boolean;
  onSelect: () => void;
}) {
  const filename = cityPhoto(city);
  const src =
    filename && city.collectionId
      ? pbFileUrl(city.collectionId, city.id, filename, "200x200")
      : "";

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className="flex w-[4.5rem] shrink-0 snap-start flex-col items-center gap-1.5"
    >
      <span
        className={`rounded-full p-[2px] ${
          active
            ? "bg-gradient-to-tr from-[#C4A35A] via-[#E8D5A3] to-[#C4A35A]"
            : "bg-white/25"
        }`}
      >
        <span className="block rounded-full bg-black p-[2px]">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1a3355] font-display text-lg text-[#C4A35A]">
              {city.name.slice(0, 1)}
            </span>
          )}
        </span>
      </span>
      <span
        className={`w-full truncate text-center text-[0.65rem] ${
          active ? "font-semibold text-white" : "text-white/60"
        }`}
      >
        {city.name}
      </span>
    </button>
  );
}
