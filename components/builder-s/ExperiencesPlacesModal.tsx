"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ChevronDown,
  Clock,
  GripVertical,
  X,
} from "lucide-react";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import {
  tourPrice,
  type PbCity,
  type PbTour,
} from "@/lib/pocketbase/client";
import { tourDurationHours } from "@/lib/tourValidator";
import {
  EXPERIENCES_PLACES_TABS,
  filterCatalogByCity,
  filterCatalogBySegment,
  filterCatalogByTab,
  formatDurationBadge,
  selectedHoursTotal,
  type CatalogItem,
  type ExperiencesPlacesSegment,
  type ExperiencesPlacesTab,
} from "@/lib/experiencesPlaces";
import { calculateTimeSlots } from "@/lib/singleDayTimeSlots";
import { CrimsonGlow } from "@/components/branding/CrimsonGlow";
import { TourDetailPanel } from "@/components/builder/TourDetailPanel";
import { isBestMatchTour } from "@/lib/experienceProfiler";
import {
  useSingleDayBuilderStore,
  type SingleDaySelectedExperience,
} from "@/store/useSingleDayBuilderStore";
import { useActiveMatchProfile } from "@/store/useQuizStore";

/**
 * Builder S — full Experiences & Places configure modal
 * (category tabs, time budget, add/reorder day timeline).
 */
export function ExperiencesPlacesModal({
  open,
  onClose,
  onConfirmed,
  catalog,
  selectedCity,
  onEditRoute,
}: {
  open: boolean;
  onClose: () => void;
  /** Fired when Done closes — advances guided pulsar to transport. */
  onConfirmed?: () => void;
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
  const [segment, setSegment] = useState<ExperiencesPlacesSegment>("tour");
  const [tab, setTab] = useState<ExperiencesPlacesTab>("all");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);

  useModalDismiss(open, onClose);

  const guests = useMemo(
    () => ({ adults, children }),
    [adults, children]
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setSegment("tour");
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

  const filtered = useMemo(() => {
    const bySegment = filterCatalogBySegment(cityItems, segment);
    return filterCatalogByTab(bySegment, tab, experienceProfile);
  }, [cityItems, segment, tab, experienceProfile]);

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

  const toggleItem = (item: CatalogItem, selectedLanguage?: string) => {
    const booked = selectedRows.find((r) => r.tourId === item.id);
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
    const lang =
      selectedLanguage ||
      preferredTourLanguage ||
      item.languages?.[0] ||
      "EN";
    if (!lang) {
      setToast("Select a preferred language before adding this experience.");
      return;
    }
    const row: SingleDaySelectedExperience = {
      tourId: item.id,
      title: item.title,
      selectedLanguage: lang,
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
          className="fixed inset-0 z-[110] flex flex-col bg-[#0A1017]"
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
            className="relative z-[1] flex h-full w-full flex-col overflow-hidden bg-[#0A1017]"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="sticky top-0 z-20 flex w-full shrink-0 items-center gap-3 border-b border-white/10 bg-[#0A1017]/95 px-4 py-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] backdrop-blur-md">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-godiva text-base uppercase tracking-wider text-white">
                  Tours &amp; Experiences
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
            <div className="shrink-0 border-b border-white/10 px-4 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-[11px] text-white/70">
                  <Clock className="h-3 w-3 text-[#F6A724]" />
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
                <span className="text-[9px] font-medium uppercase tracking-wider text-white/40">
                  {selectedRows.length} stop
                  {selectedRows.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    overBudget
                      ? "bg-[#E60F43]"
                      : "bg-gradient-to-r from-[#054F70] via-[#1BA58A] to-[#E60F43]"
                  }`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
            </div>

            {/* Day timeline accordion (reorderable + live times) */}
            {selectedRows.length > 0 ? (
              <div className="shrink-0 border-b border-white/10 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTimelineOpen((v) => !v)}
                    aria-expanded={timelineOpen}
                    aria-label={
                      timelineOpen
                        ? "Collapse day timeline"
                        : "Expand day timeline"
                    }
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <ChevronDown
                      className={`h-3.5 w-3.5 shrink-0 text-white/70 transition-transform duration-200 ${
                        timelineOpen ? "rotate-0" : "-rotate-90"
                      }`}
                      aria-hidden
                    />
                    <p className="min-w-0 flex-1 truncate text-[10px] font-bold uppercase tracking-widest text-white">
                      Your day timeline · drag to reorder · starts{" "}
                      {startTime || "09:00"}
                    </p>
                    <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/70">
                      {selectedRows.length}
                    </span>
                  </button>
                  {onEditRoute ? (
                    <button
                      type="button"
                      onClick={onEditRoute}
                      className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[#075473] hover:underline"
                    >
                      Full schedule →
                    </button>
                  ) : null}
                </div>

                <AnimatePresence initial={false}>
                  {timelineOpen ? (
                    <motion.ol
                      key="day-timeline-list"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.24, ease: "easeInOut" }}
                      className="mt-2 space-y-1.5 overflow-hidden"
                    >
                      {selectedRows.map((row, index) => {
                        const slot = timedStops[index];
                        return (
                          <li
                            key={
                              row.tourId?.trim() ||
                              `selected-${index}-${row.title || "tour"}`
                            }
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
                    </motion.ol>
                  ) : null}
                </AnimatePresence>
              </div>
            ) : null}

            {/* Tour | Activity segment — centered middle 50% */}
            <div className="shrink-0 border-b border-white/10 px-3 pt-2 pb-0.5">
              <div
                role="tablist"
                aria-label="Tour or activity"
                className="mx-auto grid w-1/2 grid-cols-2 gap-0.5 rounded-full border border-white/15 bg-white/5 p-0.5"
              >
                {(
                  [
                    ["tour", "Tour"],
                    ["activity", "Activity"],
                  ] as const
                ).map(([id, label]) => {
                  const selected = segment === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setSegment(id)}
                      className={`rounded-full py-1 text-xs font-semibold transition ${
                        selected
                          ? "bg-[#075473] text-white shadow-sm"
                          : "text-white/55 hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category / vibe tabs */}
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

            {/* Feed — same Discover / TourDetailPanel cards */}
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-3 pb-6">
              {!selectedCity ? (
                <p className="text-sm text-white/50">
                  Choose a city focus first.
                </p>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-white/50">
                  No items in this category for {selectedCity.name} yet.
                </p>
              ) : (
                filtered.map((item, index) => {
                  const booked = selectedRows.find(
                    (r) => r.tourId === item.id
                  );
                  return (
                    <TourDetailPanel
                      key={
                        item.id?.trim() ||
                        `feed-${index}-${item.title || "item"}`
                      }
                      tour={item}
                      guests={guests}
                      hidePrice
                      recommended={isBestMatchTour(item, experienceProfile)}
                      bookedLanguage={booked?.selectedLanguage || null}
                      defaultLanguage={preferredTourLanguage}
                      selected={Boolean(booked)}
                      onAdd={(lang) => toggleItem(item, lang)}
                    />
                  );
                })
              )}
            </div>

            <div className="shrink-0 border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => {
                  onConfirmed?.();
                  onClose();
                }}
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
