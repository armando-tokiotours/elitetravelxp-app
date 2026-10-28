"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ChevronDown,
  Compass,
  GripVertical,
  MapPinned,
  Ticket,
  X,
} from "lucide-react";
import { DailyTimeBudgetBar } from "@/components/builder/DailyTimeBudgetBar";
import { TourDetailPanel } from "@/components/builder/TourDetailPanel";
import { CrimsonGlow } from "@/components/branding/CrimsonGlow";
import {
  CLUSTER_DAY_MAX_HOURS,
  EXPERIENCES_PLACES_SEGMENTS,
  EXPERIENCES_PLACES_TABS,
  countsTowardGuideHours,
  formatDurationBadge,
} from "@/lib/experiencesPlaces";
import { isBestMatchTour } from "@/lib/experienceProfiler";
import { GuideTimeMeter } from "./GuideTimeMeter";
import type { ToursAndExperiencesViewModel } from "./useToursAndExperiences";

type Vm = ToursAndExperiencesViewModel;

export function ToursExperiencesHeader({
  onClose,
  dense,
}: {
  onClose: () => void;
  dense?: boolean;
}) {
  return (
    <div
      className={`relative mx-auto flex w-full shrink-0 items-center justify-between border-b border-white/10 ${
        dense
          ? "max-w-6xl pb-3 pt-[max(0.5rem,env(safe-area-inset-top))]"
          : "max-w-2xl pb-4 pt-[max(0.5rem,env(safe-area-inset-top))]"
      }`}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Back"
        className={`flex items-center gap-2 font-bold uppercase tracking-wider text-gray-300 transition hover:text-white ${
          dense ? "text-xs" : "min-h-11 text-sm"
        }`}
      >
        <ArrowLeft
          className={dense ? "h-4 w-4" : "h-5 w-5"}
          aria-hidden
        />
        <span>Back</span>
      </button>
      <h3
        className={`pointer-events-none absolute inset-x-0 truncate px-16 text-center font-bold uppercase tracking-widest text-[#0080A3] ${
          dense ? "text-xs" : "text-sm"
        }`}
      >
        Tours &amp; Experiences
      </h3>
      <div className="w-12 shrink-0" aria-hidden />
    </div>
  );
}

export function ToursExperiencesBudget({
  vm,
  dense,
}: {
  vm: Vm;
  dense?: boolean;
}) {
  const {
    usedGuideHours,
    tourHours,
    extraHours,
    selectedRows,
    clusterRows,
    segment,
    hasDayGuide,
  } = vm;

  return (
    <div
      className={`shrink-0 border-b border-white/10 ${
        dense ? "py-2" : "py-3"
      }`}
    >
      <GuideTimeMeter
        usedGuideHours={usedGuideHours}
        tourHours={tourHours}
        stopCount={selectedRows.length}
        extraHours={extraHours}
        dense={dense}
      />
      {clusterRows.length > 0 || segment === "places" ? (
        <div className={dense ? "mt-2" : "mt-2.5"}>
          <DailyTimeBudgetBar
            selectedClusters={clusterRows.map((r) => ({
              title: r.title,
              duration_hours: r.duration_hours,
            }))}
            hasGuide={hasDayGuide}
            maxHours={CLUSTER_DAY_MAX_HOURS}
          />
        </div>
      ) : null}
    </div>
  );
}

export function ToursExperiencesTimeline({
  vm,
  dense,
}: {
  vm: Vm;
  dense?: boolean;
}) {
  const {
    selectedRows,
    timelineOpen,
    setTimelineOpen,
    startTime,
    onEditRoute,
    timedStops,
    dragIndex,
    onDragStart,
    onDragOver,
    onDragEnd,
    removeExperience,
  } = vm;

  if (selectedRows.length === 0) return null;

  return (
    <div
      className={`shrink-0 border-b border-white/10 ${
        dense ? "py-2.5" : "py-3"
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTimelineOpen((v) => !v)}
          aria-expanded={timelineOpen}
          aria-label={
            timelineOpen ? "Collapse day timeline" : "Expand day timeline"
          }
          className={`flex min-w-0 flex-1 items-center gap-2 text-left ${
            dense ? "" : "min-h-11"
          }`}
        >
          <ChevronDown
            className={`shrink-0 text-white/70 transition-transform duration-200 ${
              dense ? "h-3.5 w-3.5" : "h-4 w-4"
            } ${timelineOpen ? "rotate-0" : "-rotate-90"}`}
            aria-hidden
          />
          <p
            className={`min-w-0 flex-1 truncate font-bold uppercase tracking-widest text-white ${
              dense ? "text-[10px]" : "text-xs"
            }`}
          >
            Your day timeline · drag to reorder · starts {startTime || "09:00"}
          </p>
          <span
            className={`shrink-0 rounded-full bg-white/10 px-2 py-0.5 font-bold uppercase tracking-wider text-white/70 ${
              dense ? "text-[9px]" : "text-[10px]"
            }`}
          >
            {selectedRows.length}
          </span>
        </button>
        {onEditRoute ? (
          <button
            type="button"
            onClick={onEditRoute}
            className={`shrink-0 font-bold uppercase tracking-wider text-[#075473] hover:underline ${
              dense ? "text-[10px]" : "min-h-11 text-xs"
            }`}
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
            className={`mt-2 space-y-1.5 overflow-hidden ${
              dense ? "" : "space-y-2"
            }`}
          >
            {selectedRows.map((row, index) => {
              const slot = timedStops[index];
              const isExtra = !countsTowardGuideHours(row);
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
                  className={`relative flex cursor-grab items-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-[#0D1117]/80 active:cursor-grabbing ${
                    dense ? "px-2.5 py-2" : "min-h-12 px-3 py-3"
                  } ${
                    dragIndex === index
                      ? "opacity-70 ring-1 ring-[#075473]"
                      : ""
                  }`}
                >
                  <CrimsonGlow placement="left-drag" />
                  <div className="relative z-10 flex min-w-0 flex-1 items-center gap-2">
                    <GripVertical
                      className={`shrink-0 text-white/35 ${
                        dense ? "h-4 w-4" : "h-5 w-5"
                      }`}
                    />
                    <span
                      className={`flex shrink-0 items-center justify-center rounded-full bg-[#075473] font-bold text-white ${
                        dense
                          ? "h-5 w-5 text-[10px]"
                          : "h-6 w-6 text-[11px]"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate font-medium text-white ${
                        dense ? "text-xs" : "text-sm"
                      }`}
                    >
                      {row.title}
                      {isExtra ? (
                        <span className="ml-1.5 text-[9px] font-bold tracking-wider text-[#DC6E8A] uppercase">
                          {row.timingIntent === "during_tour"
                            ? "During tour"
                            : row.timingIntent === "after_tour"
                              ? "After tour"
                              : row.timingIntent === "other_day"
                                ? row.ticketDate
                                  ? `Other day · ${String(row.ticketDate).slice(0, 10)}`
                                  : "Other day"
                                : "Extra"}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-geosans text-[10px] font-semibold text-[#1BA58A]">
                      {slot?.timeSlot ?? "—"}
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold text-[#F6A724]">
                      {formatDurationBadge(row.duration_hours)}
                    </span>
                    <button
                      type="button"
                      title="Remove stop"
                      aria-label={`Remove ${row.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeExperience(row.tourId);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="shrink-0 rounded-md p-1 text-gray-500 transition hover:bg-white/10 hover:text-red-400"
                    >
                      <X
                        className={dense ? "h-3.5 w-3.5" : "h-4 w-4"}
                        strokeWidth={2.5}
                        aria-hidden
                      />
                    </button>
                  </div>
                </li>
              );
            })}
          </motion.ol>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function ToursExperiencesSegments({
  vm,
  dense,
}: {
  vm: Vm;
  dense?: boolean;
}) {
  const { segment, setSegment, setTab } = vm;

  return (
    <div
      className={`shrink-0 border-b border-white/10 pb-0.5 ${
        dense ? "pt-2" : "pt-3"
      }`}
    >
      <div
        role="tablist"
        aria-label="Tours, experiences, or areas"
        className={`mx-auto grid w-full grid-cols-3 gap-0.5 rounded-full bg-white/5 p-0.5 ${
          dense ? "max-w-md" : "max-w-lg"
        }`}
      >
        {EXPERIENCES_PLACES_SEGMENTS.map((s) => {
          const selected = segment === s.id;
          const Icon =
            s.id === "places"
              ? MapPinned
              : s.id === "activity"
                ? Ticket
                : Compass;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={selected}
              title={s.label}
              onClick={() => {
                setSegment(s.id);
                if (s.id === "places") setTab("all");
              }}
              className={`inline-flex items-center justify-center gap-1 rounded-full font-semibold transition ${
                dense
                  ? "py-1.5 text-[11px]"
                  : "min-h-11 gap-1.5 py-2.5 text-sm"
              } ${
                selected
                  ? "bg-[#075473] text-white shadow-sm"
                  : "text-white/55 hover:text-white"
              }`}
            >
              <Icon
                className={`shrink-0 ${dense ? "h-3 w-3" : "h-4 w-4"}`}
                aria-hidden
              />
              {s.shortLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ToursExperiencesVibeFilters({
  vm,
  dense,
}: {
  vm: Vm;
  dense?: boolean;
}) {
  const { segment, tab, setTab } = vm;

  if (segment === "places") {
    return (
      <p
        className={`shrink-0 border-b border-white/10 text-white/40 ${
          dense ? "py-2 text-[10px]" : "py-3 text-xs"
        }`}
      >
        Free-roam neighborhoods — no itemized cost · each area uses the{" "}
        {CLUSTER_DAY_MAX_HOURS}h day meter
      </p>
    );
  }

  return (
    <div
      className={`flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        dense ? "py-2" : "gap-1.5 py-3"
      }`}
      role="tablist"
      aria-label="Vibe filters"
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
            className={`shrink-0 rounded-full font-bold uppercase tracking-wider transition ${
              dense
                ? "px-3 py-1.5 text-[10px]"
                : "min-h-11 px-4 py-2.5 text-xs"
            } ${
              active
                ? "bg-[#075473] text-white"
                : "bg-[#0D141C] text-white/55 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function ToursExperiencesFeed({
  vm,
  dense,
  className,
}: {
  vm: Vm;
  dense?: boolean;
  className?: string;
}) {
  const {
    selectedCity,
    filtered,
    segment,
    selectedRows,
    guests,
    experienceProfile,
    preferredTourLanguage,
    toggleItem,
  } = vm;

  return (
    <div
      className={
        className ??
        `min-h-0 flex-1 overflow-y-auto ${
          dense ? "space-y-5 py-3 pb-6" : "space-y-6 py-4 pb-8"
        }`
      }
    >
      {!selectedCity ? (
        <p className={`text-white/50 ${dense ? "text-sm" : "text-base"}`}>
          Choose a city focus first.
        </p>
      ) : filtered.length === 0 ? (
        <p className={`text-white/50 ${dense ? "text-sm" : "text-base"}`}>
          {segment === "places"
            ? `No areas & neighborhoods for ${selectedCity.name} yet.`
            : segment === "activity"
              ? `No experiences & tickets for ${selectedCity.name} yet.`
              : `No guided tours for ${selectedCity.name} yet.`}
        </p>
      ) : (
        filtered.map((item, index) => {
          const booked = selectedRows.find((r) => r.tourId === item.id);
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
  );
}

export function ToursExperiencesDone({
  onDone,
  dense,
}: {
  onDone: () => void;
  dense?: boolean;
}) {
  return (
    <div
      className={`shrink-0 border-t border-white/10 pb-[max(0.25rem,env(safe-area-inset-bottom))] ${
        dense ? "py-3" : "py-4"
      }`}
    >
      <button
        type="button"
        onClick={onDone}
        className={`w-full rounded-full bg-[#054F70] font-semibold text-white transition hover:bg-[#043d57] ${
          dense ? "py-3 text-sm" : "min-h-12 py-3.5 text-base"
        }`}
      >
        Done →
      </button>
    </div>
  );
}

export function ToursExperiencesToast({
  toast,
  dense,
}: {
  toast: string | null;
  dense?: boolean;
}) {
  if (!toast) return null;
  return (
    <div
      role="status"
      className={`absolute left-1/2 z-20 max-w-[90%] -translate-x-1/2 rounded-xl border border-[#075473]/50 bg-[#1a1510] text-center text-[#F3D9C4] shadow-lg ${
        dense
          ? "bottom-20 px-3 py-2 text-xs"
          : "bottom-24 px-4 py-3 text-sm"
      }`}
    >
      {toast}
    </div>
  );
}
