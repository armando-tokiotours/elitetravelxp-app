"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  getBuilderEAttractions,
  tourRequiresTicketBadge,
} from "@/lib/experiencesApi";
import {
  brandingAttractionsWidgetUrl,
  fetchSiteBranding,
  getPocketBase,
  pbFileUrl,
  tourPhoto,
  type PbCity,
  type PbTour,
} from "@/lib/pocketbase/client";
import { DesktopSafeViewport } from "@/components/layout/DesktopSafeViewport";
import { TourDetailModal } from "@/components/builder/TourDetailModal";
import { useBuilderEStore } from "@/store/useBuilderEStore";
import { showSystemMessage } from "@/store/useSystemMessageStore";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";

const CITY_FILTERS = [
  "ALL CITIES",
  "TOKYO",
  "KYOTO",
  "OSAKA",
  "HAKONE",
] as const;

const STYLE_FILTERS = [
  "ALL STYLES",
  "FOOD & DRINK",
  "CULTURE & TEMPLE",
  "THEME PARKS",
  "ANIME & GAMING",
  "NATURE",
] as const;

type CityFilter = (typeof CITY_FILTERS)[number];
type StyleFilter = (typeof STYLE_FILTERS)[number];

const STYLE_TO_VIBES: Record<string, string[]> = {
  "FOOD & DRINK": ["foodie"],
  "CULTURE & TEMPLE": ["culture"],
  "THEME PARKS": ["modern", "multi_vibe"],
  "ANIME & GAMING": ["modern"],
  NATURE: ["nature"],
};

function cityNameOf(tour: PbTour): string {
  return (tour.expand?.city_id?.name || "").trim();
}

function matchesCity(tour: PbTour, filter: CityFilter): boolean {
  if (filter === "ALL CITIES") return true;
  const name = cityNameOf(tour).toUpperCase();
  return name.includes(filter) || name === filter;
}

function matchesStyle(tour: PbTour, filter: StyleFilter): boolean {
  if (filter === "ALL STYLES") return true;
  const vibes = (tour.vibe_tags || []).map((v) => String(v).toLowerCase());
  const wanted = STYLE_TO_VIBES[filter] || [];
  if (wanted.some((w) => vibes.includes(w))) return true;
  const title = tour.title.toLowerCase();
  if (filter === "THEME PARKS" && /disney|universal|teamlab|park/.test(title))
    return true;
  if (
    filter === "ANIME & GAMING" &&
    /anime|ghibli|pokemon|gaming|nintendo/.test(title)
  )
    return true;
  if (filter === "FOOD & DRINK" && /food|ramen|sushi|culinary|izakaya/.test(title))
    return true;
  if (
    filter === "CULTURE & TEMPLE" &&
    /temple|shrine|museum|heritage|tea/.test(title)
  )
    return true;
  if (filter === "NATURE" && /nature|hike|fuji|garden|onsen/.test(title))
    return true;
  return false;
}

function thumbUrl(tour: PbTour): string {
  const raw = tourPhoto(tour);
  if (!raw) return "";
  if (raw.startsWith("http") || raw.startsWith("/")) return raw;
  return pbFileUrl(tour.collectionId || "tours", tour.id, raw) || raw;
}

export function AttractionsDiscoveryModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState<PbTour[]>([]);
  const [cityFilter, setCityFilter] = useState<CityFilter>("ALL CITIES");
  const [styleFilter, setStyleFilter] = useState<StyleFilter>("ALL STYLES");
  const [reelOpen, setReelOpen] = useState(false);
  const [reelIndex, setReelIndex] = useState(0);
  const [widgetBg, setWidgetBg] = useState("/brand/hero-background.jpg");
  void widgetBg;

  const ensureLoaded = useSiteBrandingStore((s) => s.ensureLoaded);
  const getItem = useSiteBrandingStore((s) => s.getItem);
  const brandingRow = useSiteBrandingStore(
    (s) => s.itemsByKey.builder_e_attractions_widget
  );
  const brandingItem = useMemo(
    () => getItem("builder_e_attractions_widget"),
    [getItem, brandingRow]
  );
  const addCartItem = useBuilderEStore((s) => s.addCartItem);
  const ensureBookingRef = useBuilderEStore((s) => s.ensureBookingRef);
  const setCategory = useBuilderEStore((s) => s.setCategory);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    void ensureLoaded();
    setLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const pb = getPocketBase();
        const [cities, branding] = await Promise.all([
          pb
            .collection("cities")
            .getFullList<PbCity>({ sort: "name" })
            .catch(() => [] as PbCity[]),
          fetchSiteBranding(),
        ]);
        const ticketed = await getBuilderEAttractions(
          cities.filter((c) => c.is_active !== false)
        );
        if (cancelled) return;
        setCatalog(ticketed);
        setWidgetBg(
          brandingAttractionsWidgetUrl(branding) ||
            brandingItem.mediaUrl ||
            "/brand/hero-background.jpg"
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, ensureLoaded, brandingItem.mediaUrl]);

  const filtered = useMemo(
    () =>
      catalog.filter(
        (t) => matchesCity(t, cityFilter) && matchesStyle(t, styleFilter)
      ),
    [catalog, cityFilter, styleFilter]
  );

  if (!mounted || !open) return null;

  return createPortal(
    <>
      <DesktopSafeViewport
        onClose={onClose}
        maxWidth="max-w-lg"
        zIndexClass="z-[190]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#0D1117] p-4">
          <h3 className="font-godiva text-sm tracking-wide text-[#F6A724] uppercase">
            Attractions &amp; Experiences
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-base text-gray-400 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b border-white/5 bg-[#0A1017] px-4 pt-3 pb-1 text-xs">
          {CITY_FILTERS.map((city) => (
            <button
              key={city}
              type="button"
              onClick={() => setCityFilter(city)}
              className={`rounded-full px-3 py-1.5 font-bold whitespace-nowrap transition-colors ${
                cityFilter === city
                  ? "border border-cyan-400 bg-[#075473] text-white"
                  : "border border-white/10 bg-white/5 text-gray-400 hover:bg-white/10"
              }`}
            >
              {city}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto border-b border-white/5 bg-[#0A1017] px-4 py-2 text-[11px]">
          {STYLE_FILTERS.map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => setStyleFilter(style)}
              className={`rounded-lg px-2.5 py-1 font-medium whitespace-nowrap transition-colors ${
                styleFilter === style
                  ? "border border-amber-500/40 bg-amber-500/20 text-amber-300"
                  : "border border-white/5 bg-white/5 text-gray-400 hover:bg-white/10"
              }`}
            >
              {style}
            </button>
          ))}
        </div>

        {/* Full-width horizontal photo cards — no box-in-box squircles */}
        <div className="w-full flex-1 space-y-3 overflow-y-auto bg-[#05080C] p-4">
          {loading ? (
            <p className="py-8 text-center text-xs text-zinc-500">
              Loading ticketed experiences…
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-xs text-zinc-500">
              No ticketed matches. Try ALL CITIES / ALL STYLES.
            </p>
          ) : (
            filtered.map((exp, idx) => {
              const thumb =
                thumbUrl(exp) || "/brand/hero-single-day.jpg";
              const city = cityNameOf(exp) || "Japan";
              const duration = exp.duration_hours
                ? `${exp.duration_hours}h`
                : "";
              return (
                <button
                  key={exp.id}
                  type="button"
                  onClick={() => {
                    setReelIndex(idx);
                    setReelOpen(true);
                  }}
                  className="group relative flex h-24 w-full items-center overflow-hidden rounded-2xl border border-white/10 px-5 text-left shadow-xl transition-all hover:border-[#F6A724]"
                >
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                    style={{ backgroundImage: `url(${thumb})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />
                  <div className="relative z-10 flex w-full items-center justify-between">
                    <div className="min-w-0 space-y-1 pr-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded border border-[#F6A724]/30 bg-[#F6A724]/20 px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider text-[#F6A724] uppercase">
                          {city}
                        </span>
                        {duration ? (
                          <span className="text-[10px] text-gray-300">
                            ⏱ {duration}
                          </span>
                        ) : null}
                        {tourRequiresTicketBadge(exp) ? (
                          <span className="rounded border border-amber-500/30 bg-amber-500/20 px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-amber-300 uppercase">
                            Ticketed
                          </span>
                        ) : null}
                      </div>
                      <h4 className="font-godiva truncate text-base tracking-wide text-white transition-colors group-hover:text-[#F6A724]">
                        {exp.title}
                      </h4>
                    </div>
                    <span className="shrink-0 text-xl text-[#F6A724] transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </DesktopSafeViewport>

      <TourDetailModal
        open={reelOpen}
        tours={filtered}
        initialSlide={reelIndex}
        guests={{ adults: 2, children: 0 }}
        backLabel="Back to Gallery"
        onClose={() => setReelOpen(false)}
        onAdd={(tour, lang) => {
          ensureBookingRef();
          setCategory("EXPERIENCE");
          addCartItem({
            category: "EXPERIENCE",
            label: tour.title,
            summary: [
              cityNameOf(tour),
              tour.duration_hours ? `${tour.duration_hours}h` : "",
              lang,
            ]
              .filter(Boolean)
              .join(" · "),
            payload: {
              tourId: tour.id,
              activityTitle: tour.title,
              guideLanguage: lang || "EN",
              city: cityNameOf(tour),
              description: tour.description || "",
              access_type: tour.access_type || "",
            },
          });
          showSystemMessage({
            text: `Added · ${tour.title}`,
            tone: "info",
          });
          setReelOpen(false);
        }}
      />
    </>,
    document.body
  );
}
