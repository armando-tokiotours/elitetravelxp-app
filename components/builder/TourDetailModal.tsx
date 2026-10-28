"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, X } from "lucide-react";
import type { PbTour } from "@/lib/pocketbase/client";
import {
  pickFamilyMaster,
  tourFamilyKey,
  type TourFamily,
} from "@/lib/tourFamilies";
import { tourLanguageChoices } from "@/lib/tourLanguages";
import { TourDetailPanel } from "./TourDetailPanel";
import { DesktopSafeViewport } from "@/components/layout/DesktopSafeViewport";
import {
  DiscoverReelBottomSheet,
  DiscoverReelTopNav,
  tourMatchesReelCategory,
  tourMatchesReelTab,
  type ReelCategoryFilter,
  type ReelSheetMode,
  type ReelTopTab,
} from "@/components/discover/DiscoverReelChrome";
import { isBestMatchTour } from "@/lib/experienceProfiler";
import { useActiveMatchProfile } from "@/store/useQuizStore";

function resolveQuickAddLanguage(
  tour: PbTour,
  defaultLanguage?: string
): string {
  const choices = tourLanguageChoices(tour.languages);
  const preferred = (defaultLanguage || "").trim().toUpperCase();
  if (preferred && choices.some((c) => c.code === preferred)) {
    return preferred;
  }
  if (choices.length === 1) return choices[0].code;
  const en = choices.find((c) => c.code === "EN");
  if (en) return en.code;
  return choices[0]?.code || preferred || "EN";
}

/**
 * Discover experience feed — full-viewport vertical scroll (Reels-style).
 * One slide per tour FAMILY (master product), never one slide per
 * duration variant: 6h / 8h live inside the single master card and
 * switching them only swaps the selected variant (price / duration /
 * description / languages) — the card, pager count and the master's
 * `{masterId}_1` photo stay the same.
 *
 * IG-style overlays (action rail, caption, top tabs, bottom sheet) live
 * on each fullscreen slide via DiscoverReelChrome.
 */
export function TourDetailModal({
  open,
  tours,
  initialSlide = 0,
  guests,
  onClose,
  onAdd,
  isTourSelected,
  scheduledLabelFor,
  bookedLanguageFor,
  backLabel = "Back to Discover",
  hidePrice = false,
  cityName = "",
  zIndexClass = "z-[210]",
  defaultLanguage,
  quickAdd = false,
}: {
  open: boolean;
  tours: PbTour[];
  initialSlide?: number;
  guests: { adults: number; children: number };
  onClose: () => void;
  onAdd: (tour: PbTour, selectedLanguage: string) => void;
  isTourSelected?: (tourId: string) => boolean;
  scheduledLabelFor?: (tourId: string) => string | null;
  bookedLanguageFor?: (tourId: string) => string | null;
  backLabel?: string;
  hidePrice?: boolean;
  /** Selected Discover city — shown on reel captions + bottom sheet */
  cityName?: string;
  /** Overlay z-index (Builder Discover uses z-[999]) */
  zIndexClass?: string;
  /** Preferred language code for instant + / Select & Add */
  defaultLanguage?: string;
  /**
   * When true, + adds immediately with resolved language and does not
   * open the detail sheet first (Builder Discover / Select & return).
   */
  quickAdd?: boolean;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  /** Selected duration-variant id per family key (defaults to master). */
  const [variantByFamily, setVariantByFamily] = useState<
    Record<string, string>
  >({});
  const [reelTab, setReelTab] = useState<ReelTopTab>("tours");
  const [categoryFilter, setCategoryFilter] =
    useState<ReelCategoryFilter>("all");
  const [sheetMode, setSheetMode] = useState<ReelSheetMode>(null);
  const [areasConfirmOpen, setAreasConfirmOpen] = useState(false);
  const experienceProfile = useActiveMatchProfile();

  // One slide per family, in the caller's (ranked) order. Variants are
  // sorted by duration inside the family; the master is the family's
  // photo / identity owner.
  const allFamilies = useMemo<TourFamily<PbTour>[]>(() => {
    const byKey = new Map<string, PbTour[]>();
    const order: string[] = [];
    for (const tour of tours) {
      const key = tourFamilyKey(tour);
      const list = byKey.get(key);
      if (list) list.push(tour);
      else {
        byKey.set(key, [tour]);
        order.push(key);
      }
    }
    return order.map((key) => {
      const rows = byKey.get(key) ?? [];
      const variants = [...rows].sort(
        (a, b) =>
          (Number(a.duration_hours) || 999) -
            (Number(b.duration_hours) || 999) ||
          String(a.title || "").localeCompare(String(b.title || ""))
      );
      const master = pickFamilyMaster(rows);
      return {
        key,
        title:
          String(master.title || "")
            .replace(/\s*,?\s*\d+(?:\.\d+)?\s*h(?:ours?)?\b/gi, " ")
            .replace(/\s{2,}/g, " ")
            .trim() || master.id,
        master,
        variants,
      };
    });
  }, [tours]);

  const families = useMemo(() => {
    const byType = allFamilies.filter((f) =>
      f.variants.some((v) => tourMatchesReelTab(v, reelTab))
    );
    let list = byType.length > 0 ? byType : allFamilies;
    if (categoryFilter === "all") return list;
    if (categoryFilter === "matches") {
      const matched = list.filter((f) =>
        f.variants.some((v) => isBestMatchTour(v, experienceProfile))
      );
      return matched.length > 0 ? matched : list;
    }
    const byCat = list.filter((f) =>
      f.variants.some((v) => tourMatchesReelCategory(v, categoryFilter))
    );
    return byCat.length > 0 ? byCat : list;
  }, [allFamilies, reelTab, categoryFilter, experienceProfile]);

  const startTourIndex = Math.max(
    0,
    Math.min(initialSlide, Math.max(0, tours.length - 1))
  );
  const startTour = tours[startTourIndex];
  const startFamilyIndex = Math.max(
    0,
    startTour
      ? families.findIndex((f) =>
          f.variants.some((v) => v.id === startTour.id)
        )
      : 0
  );

  const selectedVariantFor = useCallback(
    (family: TourFamily<PbTour>): PbTour => {
      const pickedId = variantByFamily[family.key];
      const picked = family.variants.find((v) => v.id === pickedId);
      if (picked) return picked;
      // The slide the caller opened on wins for its own family,
      // otherwise the master is the default variant shown.
      if (startTour && family.variants.some((v) => v.id === startTour.id)) {
        return startTour;
      }
      return family.master;
    },
    [variantByFamily, startTour]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Back to Builder / close: clear sheet + filters so reopen is not stale.
  useEffect(() => {
    if (open) return;
    setSheetMode(null);
    setReelTab("tours");
    setCategoryFilter("all");
    setVariantByFamily({});
    setActiveSlide(0);
    setAreasConfirmOpen(false);
  }, [open]);

  const handleReelTabChange = useCallback(
    (tab: ReelTopTab) => {
      if (tab === "areas") {
        setAreasConfirmOpen(true);
        return;
      }
      setAreasConfirmOpen(false);
      setReelTab(tab);
    },
    []
  );

  useLayoutEffect(() => {
    if (!open || families.length === 0) return;
    setSheetMode(null);
    setVariantByFamily({});
    setActiveSlide(startFamilyIndex);
    const node = slideRefs.current[startFamilyIndex];
    if (node) {
      node.scrollIntoView({
        block: "start",
        behavior: "instant" as ScrollBehavior,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, startFamilyIndex, families.length]);

  // Type / category filter change: jump to first matching family (skip on open).
  const reelFilterMounted = useRef(false);
  useLayoutEffect(() => {
    if (!open) {
      reelFilterMounted.current = false;
      return;
    }
    if (!reelFilterMounted.current) {
      reelFilterMounted.current = true;
      return;
    }
    setActiveSlide(0);
    setSheetMode(null);
    const node = slideRefs.current[0];
    if (node) {
      node.scrollIntoView({
        block: "start",
        behavior: "instant" as ScrollBehavior,
      });
    }
  }, [reelTab, categoryFilter, open]);

  const updateActiveFromScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const mid = el.scrollTop + el.clientHeight * 0.35;
    let best = 0;
    let bestDist = Infinity;
    slideRefs.current.forEach((node, i) => {
      if (!node) return;
      const top = node.offsetTop;
      const dist = Math.abs(top - mid + el.clientHeight * 0.15);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setActiveSlide(best);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!open || !el) return;
    el.addEventListener("scroll", updateActiveFromScroll, { passive: true });
    return () => el.removeEventListener("scroll", updateActiveFromScroll);
  }, [open, updateActiveFromScroll]);

  const scrollToSlide = useCallback(
    (index: number) => {
      const next = Math.max(0, Math.min(index, families.length - 1));
      const node = slideRefs.current[next];
      if (!node) return;
      node.scrollIntoView({ block: "start", behavior: "smooth" });
      setActiveSlide(next);
    },
    [families.length]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (sheetMode) {
          setSheetMode(null);
          return;
        }
        onClose();
        return;
      }
      if (sheetMode) return;
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        scrollToSlide(activeSlide + 1);
      }
      if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        scrollToSlide(activeSlide - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, activeSlide, scrollToSlide, sheetMode]);

  if (!mounted || !open || families.length === 0) return null;

  const activeFamily = families[activeSlide] ?? families[0];
  const activeTour = activeFamily
    ? selectedVariantFor(activeFamily)
    : undefined;

  const resolvedCity =
    cityName ||
    activeTour?.expand?.city_id?.name ||
    "";

  return createPortal(
    <AnimatePresence>
      {open ? (
        <DesktopSafeViewport
          onClose={onClose}
          maxWidth="max-w-md"
          zIndexClass={zIndexClass}
          backdropClassName="bg-black/85 backdrop-blur-md"
        >
          <motion.div
            className="relative flex h-full min-h-0 w-full max-w-md flex-col overflow-hidden bg-[#05080C]"
            role="dialog"
            aria-modal="true"
            aria-label={activeTour?.title ?? "Tour details"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Compact back / close above Reels tabs (safe-area) */}
            <div className="pointer-events-none absolute left-3 right-3 top-[max(0.5rem,env(safe-area-inset-top))] z-40 flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/20 bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white shadow-lg backdrop-blur-md transition active:scale-95"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-[#F6A724]" aria-hidden />
                <span className="max-w-[7rem] truncate">{backLabel}</span>
              </button>
              {families.length > 1 ? (
                <span className="pointer-events-none rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white/80 backdrop-blur-md">
                  {activeSlide + 1} / {families.length}
                </span>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="pointer-events-auto rounded-full border border-white/20 bg-black/55 p-1.5 text-white shadow-lg backdrop-blur-md transition active:scale-95"
              >
                <X className="h-3.5 w-3.5 text-zinc-300" aria-hidden />
              </button>
            </div>

            <DiscoverReelTopNav
              activeTab={reelTab}
              onTabChange={handleReelTabChange}
              onOpenFilter={() => setSheetMode("filter")}
            />

            {/* Vertical feed: one full-frame slide per family (master card) */}
            <div
              ref={trackRef}
              className="h-full min-h-0 w-full touch-pan-y snap-y snap-mandatory overflow-x-hidden overflow-y-auto overscroll-y-contain"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {families.map((family, index) => {
                const tour = selectedVariantFor(family);
                return (
                  <section
                    key={family.key}
                    ref={(node) => {
                      slideRefs.current[index] = node;
                    }}
                    aria-label={tour.title}
                    className="box-border h-full min-h-full w-full snap-start snap-always overflow-hidden"
                  >
                    <TourDetailPanel
                      tour={tour}
                      cityName={resolvedCity}
                      familyMasterId={family.master.id}
                      durationVariants={family.variants}
                      onSelectVariant={(variant) =>
                        setVariantByFamily((prev) => ({
                          ...prev,
                          [family.key]: variant.id,
                        }))
                      }
                      guests={guests}
                      mediaActive={index === activeSlide && !sheetMode}
                      selected={isTourSelected?.(tour.id) ?? false}
                      scheduledLabel={scheduledLabelFor?.(tour.id) ?? null}
                      bookedLanguage={bookedLanguageFor?.(tour.id) ?? null}
                      hidePrice={hidePrice}
                      expandDescription
                      fullscreen
                      onOpenReelOptions={() => setSheetMode("options")}
                      onOpenReelDetail={() => setSheetMode("detail")}
                      onReelQuickAdd={() => {
                        if (isTourSelected?.(tour.id)) {
                          onAdd(tour, "");
                          return;
                        }
                        if (quickAdd) {
                          onAdd(
                            tour,
                            resolveQuickAddLanguage(tour, defaultLanguage)
                          );
                          return;
                        }
                        // Standalone Discover: open detail for language pick
                        setSheetMode("detail");
                      }}
                      onAdd={(lang) => {
                        if (isTourSelected?.(tour.id)) {
                          onAdd(tour, "");
                          return;
                        }
                        if (lang) {
                          onAdd(tour, lang);
                          return;
                        }
                        if (quickAdd) {
                          onAdd(
                            tour,
                            resolveQuickAddLanguage(tour, defaultLanguage)
                          );
                        }
                      }}
                    />
                  </section>
                );
              })}
            </div>

            <DiscoverReelBottomSheet
              mode={sheetMode}
              tour={activeTour ?? null}
              cityName={resolvedCity}
              durationVariants={activeFamily?.variants}
              selected={
                activeTour ? (isTourSelected?.(activeTour.id) ?? false) : false
              }
              bookedLanguage={
                activeTour
                  ? bookedLanguageFor?.(activeTour.id) ?? null
                  : null
              }
              defaultLanguage={defaultLanguage}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              onClose={() => setSheetMode(null)}
              onSelectVariant={(variant) => {
                if (!activeFamily) return;
                setVariantByFamily((prev) => ({
                  ...prev,
                  [activeFamily.key]: variant.id,
                }));
              }}
              onOpenDetail={() => setSheetMode("detail")}
              onAdd={(lang) => {
                if (!activeTour) return;
                const resolved =
                  lang.trim() ||
                  resolveQuickAddLanguage(activeTour, defaultLanguage);
                onAdd(activeTour, resolved);
                if (resolved) setSheetMode(null);
              }}
            />

            {areasConfirmOpen ? (
              <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm">
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="areas-personalize-title"
                  className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#111A24] p-5 shadow-2xl"
                >
                  <p
                    id="areas-personalize-title"
                    className="font-godiva text-lg font-bold uppercase tracking-wide text-white"
                  >
                    Do you want to personalize the tour?
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-white/65">
                    Areas lets you build a custom places route. Pre-made Tours
                    &amp; Experiences stay in this feed.
                  </p>
                  <div className="mt-5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAreasConfirmOpen(false)}
                      className="flex-1 rounded-2xl border border-white/15 bg-white/5 py-3 text-sm font-semibold text-white/85 transition active:scale-[0.99]"
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAreasConfirmOpen(false);
                        onClose();
                        router.push("/discover/places");
                      }}
                      className="flex-1 rounded-2xl bg-[#075473] py-3 text-sm font-bold text-white transition hover:bg-[#0A6C93] active:scale-[0.99]"
                    >
                      Yes
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </motion.div>
        </DesktopSafeViewport>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
