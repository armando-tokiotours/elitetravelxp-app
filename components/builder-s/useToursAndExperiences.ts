"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import {
  tourPrice,
  type PbCity,
  type PbTour,
} from "@/lib/pocketbase/client";
import { tourDurationHours } from "@/lib/tourValidator";
import {
  CLUSTER_DAY_MAX_HOURS,
  CLUSTER_SOFT_MAX_COUNT,
  clusterDurationHours,
  countsTowardGuideHours,
  filterCatalogByCity,
  filterCatalogBySegment,
  filterCatalogByTab,
  isClusterItem,
  isGuideBudgetCatalogItem,
  isPlaceItem,
  selectedClusterRows,
  selectedExtraHoursTotal,
  selectedGuideHoursTotal,
  type CatalogItem,
  type ExperiencesPlacesSegment,
  type ExperiencesPlacesTab,
} from "@/lib/experiencesPlaces";
import { calculateTimeSlots } from "@/lib/singleDayTimeSlots";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import {
  useSingleDayBuilderStore,
  type SingleDaySelectedExperience,
} from "@/store/useSingleDayBuilderStore";
import { useActiveMatchProfile } from "@/store/useQuizStore";
import type { ExperienceTimingResult } from "@/components/builder-s/ExperienceTimingModal";
import { formatExperienceTimingLabel } from "@/lib/experienceTiming";

export type ToursAndExperiencesProps = {
  open: boolean;
  onClose: () => void;
  /** Fired when Done closes — advances guided pulsar to transport. */
  onConfirmed?: () => void;
  catalog: PbTour[];
  selectedCity: PbCity | null;
  /** Optional: jump to full route / schedule modal */
  onEditRoute?: () => void;
};

/**
 * Shared catalog / budget / selection logic for Tours & Experiences
 * Web + Mobile full-page views.
 */
export function useToursAndExperiences({
  open,
  onClose,
  onConfirmed,
  catalog,
  selectedCity,
  onEditRoute,
}: ToursAndExperiencesProps) {
  const tourHours = useSingleDayBuilderStore((s) => s.tourHours);
  const tourDate = useSingleDayBuilderStore((s) => s.tourDate);
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
  const [segment, setSegment] = useState<ExperiencesPlacesSegment>("activity");
  const [tab, setTab] = useState<ExperiencesPlacesTab>("all");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [pendingTiming, setPendingTiming] = useState<{
    item: CatalogItem;
    lang: string;
    hours: number;
  } | null>(null);

  useModalDismiss(open, onClose);

  const guests = useMemo(
    () => ({ adults, children }),
    [adults, children]
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setSegment("activity");
    setTab("all");
    setQuizOpen(false);
  }, [open]);

  const selectVibeTab = (next: ExperiencesPlacesTab) => {
    setTab(next);
    if (next === "matches") {
      setQuizOpen(true);
    }
  };

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

  const usedGuideHours = selectedGuideHoursTotal(selectedRows);
  const extraHours = selectedExtraHoursTotal(selectedRows);
  const clusterRows = useMemo(
    () => selectedClusterRows(selectedRows, cityItems),
    [selectedRows, cityItems]
  );
  const clusterHours = useMemo(
    () =>
      clusterRows.reduce((sum, r) => sum + clusterDurationHours(r), 0),
    [clusterRows]
  );
  const timedStops = useMemo(
    () => calculateTimeSlots(startTime || "09:00", selectedRows),
    [startTime, selectedRows]
  );
  const overBudget = usedGuideHours > tourHours + 0.01;
  const budgetPct = Math.min(
    100,
    tourHours > 0 ? (usedGuideHours / tourHours) * 100 : 0
  );
  const hasDayGuide = usedGuideHours > 0.01 || tourHours > 0;

  const commitExperience = (
    item: CatalogItem,
    lang: string,
    hours: number,
    timing?: ExperienceTimingResult
  ) => {
    const countsTowardGuide = isGuideBudgetCatalogItem(item);
    // Guided Tours are mutually exclusive — new tour swaps out the current one.
    // Duration occupies the full guide meter (e.g. 6h/6h).
    let replacedTourTitle: string | null = null;
    if (countsTowardGuide) {
      for (const r of selectedRows) {
        if (countsTowardGuideHours(r) && r.tourId !== item.id) {
          if (!replacedTourTitle) replacedTourTitle = r.title || null;
          removeExperience(r.tourId);
        }
      }
    }
    const rowHours = countsTowardGuide ? tourHours : hours;
    const row: SingleDaySelectedExperience = {
      tourId: item.id,
      title: item.title,
      selectedLanguage: lang,
      duration_hours: rowHours,
      price: tourPrice(item, guests),
      access_type: String(item.access_type || "").trim() || undefined,
      category: String(item.category || "").trim() || undefined,
      entry_type: String(item.entry_type || "").trim() || undefined,
      is_extra: !countsTowardGuide,
      ...(timing
        ? {
            timingIntent: timing.timingIntent,
            ticketDate: timing.ticketDate,
            opsTimingNote: timing.opsTimingNote,
          }
        : {}),
    };
    addExperience(row);
    setToast(
      timing
        ? `Added · ${item.title} (${formatExperienceTimingLabel(timing.timingIntent)})`
        : countsTowardGuide
          ? replacedTourTitle
            ? `Replaced · ${item.title} (was ${replacedTourTitle})`
            : `Added · ${item.title}`
          : `Added extra · ${item.title}`
    );
  };

  const toggleItem = (item: CatalogItem, selectedLanguage?: string) => {
    const booked = selectedRows.find((r) => r.tourId === item.id);
    if (booked) {
      removeExperience(item.id);
      setToast("Removed from day");
      return;
    }
    const isClusterOrPlace = isClusterItem(item) || isPlaceItem(item);
    const hours = isClusterOrPlace
      ? clusterDurationHours(item)
      : tourDurationHours(item);
    const countsTowardGuide = isGuideBudgetCatalogItem(item);
    // Places / Areas — multiple allowed up to the daily time budget.
    if (isClusterOrPlace) {
      if (clusterRows.length >= CLUSTER_SOFT_MAX_COUNT) {
        setToast(
          `Standard day is ~${CLUSTER_SOFT_MAX_COUNT} areas (${CLUSTER_DAY_MAX_HOURS}h). Remove one before adding another.`
        );
        return;
      }
      if (clusterHours + hours > CLUSTER_DAY_MAX_HOURS + 0.25) {
        setToast(
          `Only ${(CLUSTER_DAY_MAX_HOURS - clusterHours).toFixed(1)}h left in the ${CLUSTER_DAY_MAX_HOURS}h areas day budget.`
        );
        return;
      }
    }
    // Guided Tours: never block on remaining hours — selecting another tour
    // replaces the current one and fills the guide meter.
    // Experiences & Tickets: sit outside the guide meter as add-ons — never
    // gated on usedGuideHours / tourHours (even when a 6h tour is selected).
    const lang =
      selectedLanguage ||
      preferredTourLanguage ||
      item.languages?.[0] ||
      "EN";
    if (!lang) {
      setToast("Select a preferred language before adding this experience.");
      return;
    }
    // Experiences & Tickets extras → ask during / after / other day
    if (!countsTowardGuide && !isClusterOrPlace) {
      setPendingTiming({ item, lang, hours });
      return;
    }
    commitExperience(item, lang, hours);
  };

  const confirmTiming = (result: ExperienceTimingResult) => {
    if (!pendingTiming) return;
    const { item, lang, hours } = pendingTiming;
    setPendingTiming(null);
    commitExperience(item, lang, hours, result);
  };

  const cancelTiming = () => setPendingTiming(null);

  const onDragStart = (index: number) => setDragIndex(index);
  const onDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex == null || dragIndex === index) return;
    reorderExperiences(dragIndex, index);
    setDragIndex(index);
  };
  const onDragEnd = () => setDragIndex(null);

  const handleDone = () => {
    onConfirmed?.();
    onClose();
  };

  return {
    open,
    onClose,
    onEditRoute,
    mounted,
    segment,
    setSegment,
    tab,
    setTab: selectVibeTab,
    quizOpen,
    setQuizOpen,
    dragIndex,
    toast,
    timelineOpen,
    setTimelineOpen,
    removeExperience,
    guests,
    selectedCity,
    filtered,
    selectedRows,
    tourHours,
    tourDate,
    startTime,
    usedGuideHours,
    extraHours,
    clusterRows,
    overBudget,
    budgetPct,
    hasDayGuide,
    timedStops,
    preferredTourLanguage,
    experienceProfile,
    toggleItem,
    pendingTiming,
    confirmTiming,
    cancelTiming,
    onDragStart,
    onDragOver,
    onDragEnd,
    handleDone,
  };
}

export type ToursAndExperiencesViewModel = ReturnType<
  typeof useToursAndExperiences
>;
