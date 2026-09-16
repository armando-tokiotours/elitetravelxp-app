"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  cityPhoto,
  fetchBuilderConfig,
  pbFileUrl,
  tourMediaFile,
  tourMediaType,
  tourPrice,
  type BuilderConfig,
  type PbCity,
  type PbTour,
} from "@/lib/pocketbase/client";
import { formatUsd } from "@/lib/builder-pricing";
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

export function DiscoverFeed() {
  const [config, setConfig] = useState<BuilderConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [pickingTour, setPickingTour] = useState<PbTour | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const locations = useBuilderStore((s) => s.locations);
  const arrivalDate = useBuilderStore((s) => s.arrivalDate);
  const selectedToursMap = useBuilderStore((s) => s.selectedTours);
  const addCityTour = useBuilderStore((s) => s.addCityTour);
  const removeCityTour = useBuilderStore((s) => s.removeCityTour);
  const isEliteConcierge = useBuilderStore((s) => s.isEliteConcierge);

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

  const selectedCity = cities.find((c) => c.id === selectedCityId);
  const cityName = selectedCity?.name ?? "City";
  const selectedTours = selectedCityId
    ? selectedToursMap[selectedCityId] ?? []
    : [];
  const dayOptions = selectedCityId
    ? chauffeurDaysForCity(arrivalDate, locations, selectedCityId)
    : [];

  const tryAddTour = useCallback(
    (tour: PbTour, scheduledDate: string) => {
      if (!selectedCityId) return { ok: false as const };
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
        price: tourPrice(tour),
      });
      if (ok) setToast(`Added · ${tour.title}`);
      return {
        ok,
        message: ok ? undefined : TOUR_DAY_PACKED_MESSAGE,
      };
    },
    [addCityTour, isEliteConcierge, selectedCityId, selectedTours]
  );

  const handleAddClick = (tour: PbTour) => {
    const booked = selectedTours.find((t) => t.tourId === tour.id);
    if (booked) {
      if (selectedCityId) removeCityTour(selectedCityId, tour.id);
      setToast("Removed from itinerary");
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
      const result = tryAddTour(tour, day.date);
      if (!result.ok && result.message) setToast(result.message);
      return;
    }
    setPickingTour(tour);
  };

  return (
    <div className="builder-theme relative min-h-[100dvh] bg-[#0a0a0a] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/90 text-white backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-3">
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

        <div
          className="mx-auto flex max-w-6xl snap-x snap-mandatory gap-4 overflow-x-auto px-4 py-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
      </header>

      {toast ? (
        <div
          role="status"
          className="fixed left-1/2 top-[7.5rem] z-50 max-w-[90vw] -translate-x-1/2 rounded-xl border border-[#C4A35A]/50 bg-[#F7EFD9] px-3.5 py-2.5 text-center text-sm text-[#6B5420] shadow-lg"
        >
          ⚠️ {toast}
        </div>
      ) : null}

      <main
        key={selectedCityId ?? "none"}
        className="mx-auto flex max-w-6xl flex-col overflow-y-auto px-0 pb-32 pt-2 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-0 md:px-4 lg:grid-cols-3 md:pb-12"
      >
        {loading ? (
          <p className="col-span-full py-16 text-center text-sm text-white/50">
            Loading experiences…
          </p>
        ) : cityTours.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="font-display text-2xl text-white/90">{cityName}</p>
            <p className="text-sm text-white/50">
              No experiences published for this city yet.
            </p>
          </div>
        ) : (
          cityTours.map((tour) => {
            const booked = selectedTours.some((t) => t.tourId === tour.id);
            return (
              <DiscoverTourCard
                key={tour.id}
                tour={tour}
                cityName={cityName}
                booked={booked}
                onAdd={() => handleAddClick(tour)}
              />
            );
          })
        )}
      </main>

      <ScheduleTourDaySheet
        open={!!pickingTour}
        tour={pickingTour}
        cityName={cityName}
        dayOptions={dayOptions}
        selectedTours={selectedTours}
        onClose={() => setPickingTour(null)}
        onSelectDay={(date) =>
          pickingTour ? tryAddTour(pickingTour, date) : { ok: false }
        }
        onToast={setToast}
      />

      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
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

function DiscoverTourCard({
  tour,
  cityName,
  booked,
  onAdd,
}: {
  tour: PbTour;
  cityName: string;
  booked: boolean;
  onAdd: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaType = tourMediaType(tour);
  const filename = tourMediaFile(tour);
  const mediaUrl =
    filename && tour.collectionId
      ? pbFileUrl(tour.collectionId, tour.id, filename)
      : "";
  const hours = tourDurationHours(tour);
  const price = tourPrice(tour);
  const priceMin = price > 0 ? price : 0;
  const priceMax = priceMin > 0 ? Math.round(priceMin * 1.15) : 0;
  const description = (tour.description ?? "").trim();
  const showMoreToggle = description.length > 90;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.4) {
          void el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: [0.4] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mediaUrl]);

  const priceLabel =
    priceMin > 0
      ? priceMax > priceMin
        ? `From ${formatUsd(priceMin)} – ${formatUsd(priceMax)}`
        : `From ${formatUsd(priceMin)}`
      : null;
  const detailBits = [
    hours > 0 ? `${hours} hours` : null,
    priceLabel,
  ].filter(Boolean);

  return (
    <article className="mb-8 flex flex-col overflow-hidden rounded-t-2xl">
      {/* White header */}
      <div className="flex items-center justify-between gap-3 bg-white px-4 py-3 text-black">
        <h2 className="min-w-0 truncate text-base leading-snug">
          <span className="font-display text-xl font-black uppercase tracking-wide text-black sm:text-2xl">
            {cityName},
          </span>
          <span className="ml-1.5 align-middle text-base font-normal text-gray-800">
            {tour.title}
          </span>
        </h2>
        {hours > 0 ? (
          <span className="shrink-0 text-sm font-medium text-gray-700">
            {hours} hours
          </span>
        ) : null}
      </div>

      {/* 1:1 media */}
      <div className="relative aspect-square w-full bg-black">
        {mediaUrl && mediaType === "Video" ? (
          <video
            ref={videoRef}
            key={mediaUrl}
            src={mediaUrl}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a3355] to-[#0B1F3A]" />
        )}
      </div>

      {/* Dark footer — merges with page */}
      <div className="flex flex-col gap-1 bg-transparent px-4 py-3 text-white">
        {detailBits.length > 0 ? (
          <p className="text-xs text-gray-400">{detailBits.join(" · ")}</p>
        ) : null}

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {description ? (
              <>
                <p
                  className={`text-sm leading-relaxed text-white/90 ${
                    isExpanded ? "" : "line-clamp-2"
                  }`}
                >
                  {description}
                </p>
                {showMoreToggle ? (
                  <button
                    type="button"
                    onClick={() => setIsExpanded((v) => !v)}
                    className="mt-1 cursor-pointer text-sm text-gray-400 hover:text-white"
                  >
                    {isExpanded ? "Less." : "More."}
                  </button>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-gray-500">No description yet.</p>
            )}
          </div>

          <button
            type="button"
            onClick={onAdd}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              booked
                ? "border border-[#C4A35A] bg-[#C4A35A]/15 text-[#E8D5A3]"
                : "bg-[#0B1F3A] text-white hover:bg-[#143052]"
            }`}
          >
            {booked ? "✓ Added" : "+ Add"}
          </button>
        </div>
      </div>
    </article>
  );
}
