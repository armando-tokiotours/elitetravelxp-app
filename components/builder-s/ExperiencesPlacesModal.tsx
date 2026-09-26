"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Clock,
  GripVertical,
  MapPin,
  Plus,
  X,
} from "lucide-react";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import {
  pbFileUrl,
  tourMediaFile,
  tourMediaType,
  tourPhoto,
  tourPrice,
  type PbCity,
  type PbTour,
} from "@/lib/pocketbase/client";
import { PB_THUMBS } from "@/lib/mediaStandards";
import { tourDurationHours } from "@/lib/tourValidator";
import {
  EXPERIENCES_PLACES_TABS,
  filterCatalogByCity,
  filterCatalogByTab,
  formatDurationBadge,
  isPlaceItem,
  selectedHoursTotal,
  type CatalogItem,
  type ExperiencesPlacesTab,
} from "@/lib/experiencesPlaces";
import { calculateTimeSlots } from "@/lib/singleDayTimeSlots";
import { resolveSingleDayReelPoster } from "@/config/mediaConfig";
import { CrimsonGlow } from "@/components/branding/CrimsonGlow";
import {
  useSingleDayBuilderStore,
  type SingleDaySelectedExperience,
} from "@/store/useSingleDayBuilderStore";
import { useActiveMatchProfile } from "@/store/useQuizStore";
import { LazyVideo } from "@/components/ui/LazyVideo";

/**
 * Builder S — full Experiences & Places configure modal
 * (category tabs, time budget, add/reorder day timeline).
 */
export function ExperiencesPlacesModal({
  open,
  onClose,
  catalog,
  selectedCity,
  onEditRoute,
}: {
  open: boolean;
  onClose: () => void;
  catalog: PbTour[];
  selectedCity: PbCity | null;
  /** Optional: jump to full route / schedule modal */
  onEditRoute?: () => void;
}) {
  const tourHours = useSingleDayBuilderStore((s) => s.tourHours);
  const startTime = useSingleDayBuilderStore((s) => s.startTime);
  const adults = useSingleDayBuilderStore((s) => s.adults);
  const children = useSingleDayBuilderStore((s) => s.children);
  const selectedRows = useSingleDayBuilderStore((s) => s.selectedExperiences);
  const addExperience = useSingleDayBuilderStore((s) => s.addExperience);
  const removeExperience = useSingleDayBuilderStore((s) => s.removeExperience);
  const reorderExperiences = useSingleDayBuilderStore(
    (s) => s.reorderExperiences
  );
  const preferredTourLanguage = useSingleDayBuilderStore(
    (s) => s.preferredTourLanguage
  );
  const experienceProfile = useActiveMatchProfile();

  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<ExperiencesPlacesTab>("all");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useModalDismiss(open, onClose);

  const guests = useMemo(
    () => ({ adults, children }),
    [adults, children]
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setTab("all");
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const cityItems = useMemo(() => {
    const items = catalog as CatalogItem[];
    return filterCatalogByCity(
      items,
      selectedCity?.id,
      selectedCity?.name
    );
  }, [catalog, selectedCity]);

  const filtered = useMemo(
    () => filterCatalogByTab(cityItems, tab, experienceProfile),
    [cityItems, tab, experienceProfile]
  );

  const usedHours = selectedHoursTotal(selectedRows);
  const timedStops = useMemo(
    () => calculateTimeSlots(startTime || "09:00", selectedRows),
    [startTime, selectedRows]
  );
  const overBudget = usedHours > tourHours + 0.01;
  const budgetPct = Math.min(
    100,
    tourHours > 0 ? (usedHours / tourHours) * 100 : 0
  );

  const toggleItem = (item: CatalogItem) => {
    const booked = selectedRows.some((r) => r.tourId === item.id);
    if (booked) {
      removeExperience(item.id);
      setToast("Removed from day");
      return;
    }
    const hours = tourDurationHours(item);
    if (usedHours + hours > tourHours + 0.25) {
      setToast(
        `Only ${(tourHours - usedHours).toFixed(1)}h left in your ${tourHours}h day.`
      );
      return;
    }
    const row: SingleDaySelectedExperience = {
      tourId: item.id,
      title: item.title,
      selectedLanguage: preferredTourLanguage || item.languages?.[0] || "EN",
      duration_hours: hours,
      price: tourPrice(item, guests),
    };
    addExperience(row);
    setToast(`Added · ${item.title}`);
  };

  const onDragStart = (index: number) => setDragIndex(index);
  const onDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex == null || dragIndex === index) return;
    reorderExperiences(dragIndex, index);
    setDragIndex(index);
  };
  const onDragEnd = () => setDragIndex(null);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence
      onExitComplete={() => {
        document.body.style.overflow = "";
      }}
    >
      {open ? (
        <motion.div
          key="experiences-places-modal"
          className="fixed inset-0 z-[110] flex items-stretch justify-center bg-[#05080C]/55 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Experiences and Places"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default"
            onClick={onClose}
          />
          <motion.div
            className="relative z-[1] flex h-[100dvh] max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden border border-white/10 bg-[#05080C]/92 shadow-2xl backdrop-blur-3xl sm:rounded-2xl md:max-w-4xl lg:max-w-5xl"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-2 pt-[max(0.35rem,env(safe-area-inset-top))]">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition hover:border-white/30"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#1BA58A]">
                  {selectedCity?.name || "City"} · Builder Single Day
                </p>
                <h3 className="truncate font-godiva text-xl uppercase tracking-wider text-white sm:text-2xl">
                  Experiences & Places
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white"
              >
                <X className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </div>

            {/* Time budget */}
            <div className="shrink-0 border-b border-white/10 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs text-white/70">
                  <Clock className="h-3.5 w-3.5 text-[#F6A724]" />
                  Selected:{" "}
                  <span
                    className={`font-semibold ${
                      overBudget ? "text-[#E60F43]" : "text-white"
                    }`}
                  >
                    {formatDurationBadge(usedHours)}
                  </span>
                  <span className="text-white/40">/</span>
                  <span className="font-semibold text-white">
                    {formatDurationBadge(tourHours)} Available
                  </span>
                </p>
                <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                  {selectedRows.length} stop
                  {selectedRows.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    overBudget ? "bg-[#E60F43]" : "bg-[#1BA58A]"
                  }`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
            </div>

            {/* Day timeline (reorderable + live times) */}
            {selectedRows.length > 0 ? (
              <div className="shrink-0 border-b border-white/10 px-4 py-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#1BA58A]">
                    Your day timeline · drag to reorder · starts{" "}
                    {startTime || "09:00"}
                  </p>
                  {onEditRoute ? (
                    <button
                      type="button"
                      onClick={onEditRoute}
                      className="text-[10px] font-bold uppercase tracking-wider text-[#075473] hover:underline"
                    >
                      Full schedule →
                    </button>
                  ) : null}
                </div>
                <ol className="space-y-1.5">
                  {selectedRows.map((row, index) => {
                    const slot = timedStops[index];
                    return (
                      <li
                        key={row.tourId}
                        draggable
                        onDragStart={() => onDragStart(index)}
                        onDragOver={(e) => onDragOver(e, index)}
                        onDragEnd={onDragEnd}
                        className={`relative flex cursor-grab items-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-[#0D1117]/80 px-2.5 py-2 active:cursor-grabbing ${
                          dragIndex === index
                            ? "opacity-70 ring-1 ring-[#075473]"
                            : ""
                        }`}
                      >
                        <CrimsonGlow placement="left-drag" />
                        <div className="relative z-10 flex min-w-0 flex-1 items-center gap-2">
                        <GripVertical className="h-4 w-4 shrink-0 text-white/35" />
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#075473] text-[10px] font-bold text-white">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-white">
                          {row.title}
                        </span>
                        <span className="shrink-0 font-geosans text-[10px] font-semibold text-[#1BA58A]">
                          {slot?.timeSlot ?? "—"}
                        </span>
                        <span className="shrink-0 text-[10px] font-semibold text-[#F6A724]">
                          {formatDurationBadge(row.duration_hours)}
                        </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ) : null}

            {/* Category tabs */}
            <div
              className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 px-3 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="tablist"
              aria-label="Category filters"
            >
              {EXPERIENCES_PLACES_TABS.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(t.id)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition ${
                      active
                        ? "bg-[#075473] text-white"
                        : "border border-white/10 bg-white/5 text-white/55 hover:border-white/25 hover:text-white"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Feed */}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 pb-6">
              {!selectedCity ? (
                <p className="text-sm text-white/50">
                  Choose a city focus first.
                </p>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-white/50">
                  No items in this category for {selectedCity.name} yet.
                </p>
              ) : (
                filtered.map((item) => {
                  const booked = selectedRows.some(
                    (r) => r.tourId === item.id
                  );
                  const hours = tourDurationHours(item);
                  const place = isPlaceItem(item);
                  const loc = item.google_location;
                  const mediaType = tourMediaType(item);
                  const mediaFile = tourMediaFile(item) || tourPhoto(item);
                  const pbMedia =
                    mediaFile && item.collectionId
                      ? pbFileUrl(
                          item.collectionId,
                          item.id,
                          mediaFile,
                          {
                            thumb:
                              mediaType === "Video"
                                ? undefined
                                : PB_THUMBS.card,
                            format:
                              mediaType === "Video" ? undefined : "webp",
                          }
                        )
                      : "";
                  const poster = resolveSingleDayReelPoster(pbMedia);

                  return (
                    <article
                      key={item.id}
                      className={`overflow-hidden rounded-2xl border transition ${
                        booked
                          ? "border-[#1BA58A]/60 bg-[#0D1117]/90"
                          : "border-white/10 bg-[#0D1117]/70"
                      }`}
                      data-place-id={loc?.place_id || undefined}
                      data-lat={loc?.lat ?? undefined}
                      data-lng={loc?.lng ?? undefined}
                    >
                      <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-900 sm:aspect-[16/9]">
                        {pbMedia && mediaType === "Video" ? (
                          <LazyVideo
                            src={pbMedia}
                            poster={poster}
                            muted
                            loop
                            playsInline
                            autoPlay
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : poster ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={poster}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                "/brand/hero-single-day.jpg";
                            }}
                          />
                        ) : (
                          <div className="flex h-full items-end bg-gradient-to-br from-[#1a3355] to-[#0B1F3A] p-4">
                            <span className="font-godiva text-sm uppercase text-white/70">
                              {item.title}
                            </span>
                          </div>
                        )}
                        <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#F6A724]">
                          {formatDurationBadge(hours)}
                        </span>
                        {place ? (
                          <span className="absolute right-2 top-2 rounded-full bg-[#075473]/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                            Place
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-start gap-3 p-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-sm font-semibold text-white">
                            {item.title}
                          </h4>
                          {item.description ? (
                            <p className="mt-0.5 line-clamp-2 text-xs text-white/45">
                              {item.description}
                            </p>
                          ) : null}
                          {loc?.address ? (
                            <p className="mt-1.5 flex items-start gap-1 text-[10px] text-white/40">
                              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                              <span className="line-clamp-1">{loc.address}</span>
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleItem(item)}
                          className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-[11px] font-bold transition ${
                            booked
                              ? "bg-[#1BA58A] text-white"
                              : "border border-white/15 bg-white/5 text-white hover:border-[#075473] hover:bg-[#075473]/30"
                          }`}
                        >
                          {booked ? (
                            <>
                              <Check className="h-3.5 w-3.5" strokeWidth={3} />
                              Added
                            </>
                          ) : (
                            <>
                              <Plus className="h-3.5 w-3.5" />
                              Add to Day
                            </>
                          )}
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            <div className="shrink-0 border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-full bg-[#054F70] py-3 text-sm font-semibold text-white transition hover:bg-[#043d57]"
              >
                Done
              </button>
            </div>

            {toast ? (
              <div
                role="status"
                className="absolute bottom-20 left-1/2 z-20 max-w-[90%] -translate-x-1/2 rounded-xl border border-[#075473]/50 bg-[#1a1510] px-3 py-2 text-center text-xs text-[#F3D9C4] shadow-lg"
              >
                {toast}
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
