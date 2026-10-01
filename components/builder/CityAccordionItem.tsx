"use client";

import { Reorder, useDragControls } from "framer-motion";
import { ArrowDown, Lock } from "lucide-react";
import type { PbCity } from "@/lib/pocketbase/client";
import { formatCityDateSingle } from "@/lib/dateCascade";
import type { SeasonalMatch } from "@/lib/seasonalMatcher";
import type {
  CityVisitType,
  LocationStop,
} from "@/store/useBuilderStore";
import { isTransitHubStop } from "@/lib/transitHubs";
import { allowedVisitTypesForIndex } from "@/lib/locationRules";
import { CrimsonGlow } from "@/components/branding/CrimsonGlow";
import { GoldLight } from "@/components/branding/GoldLight";
import { ConciergeSuggestionCard } from "./ConciergeSuggestionCard";
import { CityThumb } from "./CityThumb";

export function CityAccordionItem({
  loc,
  city,
  displayName,
  dateLabel,
  startDate,
  endDate,
  fromLabel,
  showFromLabel = true,
  index,
  totalLocations,
  expanded,
  onToggle,
  suggestions,
  selectedTourIds,
  onNights,
  onVisitType,
  onTransit: _onTransit,
  onRemove,
  onAddTour,
}: {
  loc: LocationStop;
  city?: PbCity;
  /** Override label (airport / port hub name) */
  displayName?: string;
  dateLabel: string;
  startDate?: string;
  endDate?: string;
  fromLabel: string;
  /** Hide FROM origin on first overnight city (airport is Step 2). */
  showFromLabel?: boolean;
  index: number;
  totalLocations: number;
  expanded: boolean;
  onToggle: () => void;
  suggestions: SeasonalMatch[];
  selectedTourIds: string[];
  onNights: (n: number) => void;
  onVisitType: (t: CityVisitType) => void;
  /** @deprecated Transit is set in Transport section, not Locations. */
  onTransit?: (t: import("@/store/useBuilderStore").CityTransitType) => void;
  onRemove: () => void;
  onAddTour: (tourId: string) => void;
}) {
  void _onTransit;
  const controls = useDragControls();
  const locked = isTransitHubStop(loc);
  const name = displayName || city?.name || "City";
  const allowedVisitTypes = allowedVisitTypesForIndex(index, totalLocations);
  const visitType: CityVisitType = locked
    ? loc.visitType === "departure"
      ? "departure"
      : "arrival"
    : allowedVisitTypes.includes(loc.visitType)
      ? loc.visitType
      : "stay";
  const isStay = !locked && visitType === "stay";
  const nightsOk = isStay ? loc.nights >= 1 : true;
  const isConfigured = nightsOk;
  const nightsStatusClass = isConfigured
    ? "text-emerald-400"
    : "text-[#075473]";

  if (locked) {
    return (
      <Reorder.Item
        value={loc}
        dragListener={false}
        className="group relative w-full overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900/80"
      >
        <GoldLight color="#054F70" placement="left-center" active />
        <div
          className="relative z-10 flex items-center gap-3 px-3 py-3"
          title="Auto-set from Step 2 (Arrival/Departure)"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 text-lg">
            {visitType === "departure" ? "🛫" : "🛬"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-zinc-200">{name}</p>
            <p className="text-[11px] text-zinc-500">
              Auto-set from Step 2 (Arrival/Departure)
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-400">
            0n
          </span>
          <Lock className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
        </div>
      </Reorder.Item>
    );
  }

  return (
    <Reorder.Item
      value={loc}
      dragListener={false}
      dragControls={controls}
      className="relative w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-[0_2px_12px_rgba(11,31,58,0.04)]"
    >
      <CrimsonGlow placement="left-drag" />
      {expanded ? (
        <div className="relative z-10">
          <div className="relative overflow-hidden rounded-t-2xl">
            <div className="absolute left-2 top-2 z-10">
              <DragHandle controls={controls} onLight />
            </div>
            <button
              type="button"
              aria-label="Remove location"
              onClick={onRemove}
              className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-lg leading-none text-white backdrop-blur-sm hover:bg-black/50"
            >
              ×
            </button>
            <button
              type="button"
              onClick={onToggle}
              className="relative block h-36 w-full overflow-hidden sm:h-40"
              aria-label={`Collapse ${name}`}
            >
              <CityThumb
                city={city}
                name={name}
                alt={name}
                thumb="800x400"
                className="h-full w-full object-cover"
              />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-8">
                <span className="font-display text-2xl text-white">{name}</span>
              </span>
            </button>
          </div>

          <div className="w-full overflow-visible px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
            <div className="flex w-full flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="break-words text-sm font-semibold leading-tight text-white sm:font-display sm:text-2xl sm:font-normal">
                  {name}
                </h3>
                {dateLabel ? (
                  <p className="text-sm capitalize leading-tight text-zinc-400">
                    {dateLabel.toLowerCase()}
                  </p>
                ) : null}
                <p className="text-[11px] text-zinc-500">
                  Nights in this city only — hotels are set in Step 4.
                </p>
              </div>
              {isStay ? (
                <NightStepper value={loc.nights} onChange={onNights} />
              ) : (
                <span className="shrink-0 rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-semibold capitalize text-[#F2F2F2]">
                  {visitType} · 0 nights
                </span>
              )}
            </div>

            <div className="mt-3">
              <p className="mb-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
                Visit type
              </p>
              <div className="inline-flex flex-wrap rounded-full border border-zinc-700 bg-zinc-950 p-0.5">
                {allowedVisitTypes.map((value) => (
                  <VisitPill
                    key={value}
                    active={visitType === value}
                    onClick={() => onVisitType(value)}
                    label={
                      value === "stay"
                        ? "City nights"
                        : value === "arrival"
                          ? "Arrival"
                          : "Departure"
                    }
                  />
                ))}
              </div>
            </div>

            {showFromLabel ? (
              <div className="relative z-30 mt-4 w-full overflow-visible rounded-xl border-t border-zinc-800/80 bg-[#121212] p-3 pt-3 sm:p-3.5">
                <div className="shrink-0 min-w-max">
                  <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    From
                  </span>
                  <p className="whitespace-nowrap text-xs font-semibold text-white">
                    {fromLabel}
                  </p>
                </div>
              </div>
            ) : null}

            {suggestions.map((m, index) => (
              <ConciergeSuggestionCard
                key={`season-${index}-${m.highlight?.id || "h"}-${m.cityId || "c"}`}
                match={m}
                tourAlreadyAdded={
                  !!m.highlight.suggested_tour_id &&
                  selectedTourIds.includes(m.highlight.suggested_tour_id)
                }
                onAddTour={onAddTour}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex items-stretch gap-0">
          <div className="flex items-center pl-2">
            <DragHandle controls={controls} />
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="flex min-w-0 flex-1 items-stretch gap-2 py-2.5 pr-2 text-left"
          >
            {/* Photo + city/nights on top; transport spans under both */}
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg">
                  <CityThumb
                    city={city}
                    name={name}
                    alt=""
                    thumb="200x200"
                    className="h-full w-full object-cover"
                  />
                </span>
                <span className="min-w-0 flex-1 overflow-hidden">
                  <span className="flex items-center gap-1.5">
                    <span className="block break-words text-sm font-semibold leading-tight text-white">
                      {name}
                    </span>
                  </span>
                  <span className={`text-xs font-medium ${nightsStatusClass}`}>
                    {isStay
                      ? `${loc.nights} night${loc.nights === 1 ? "" : "s"}`
                      : visitType === "arrival"
                        ? "Arrival · 0 nights"
                        : "Departure · 0 nights"}
                  </span>
                </span>
              </span>
            </span>
            {dateLabel || startDate ? (
              <CityDateStack
                label={dateLabel}
                startDate={startDate}
                endDate={endDate}
              />
            ) : null}
          </button>
          <div className="flex items-center pr-1">
            <RemoveButton onClick={onRemove} />
          </div>
        </div>
      )}
    </Reorder.Item>
  );
}

function CityDateStack({
  label,
  startDate,
  endDate,
}: {
  label: string;
  startDate?: string;
  endDate?: string;
}) {
  const start =
    (startDate && formatCityDateSingle(startDate).toLowerCase()) || "";
  const end =
    endDate && endDate !== startDate
      ? formatCityDateSingle(endDate).toLowerCase()
      : "";

  if (start && end) {
    return (
      <span className="flex shrink-0 flex-col items-end gap-0.5 text-right text-[10px] leading-tight text-zinc-400">
        <span>{start}</span>
        <ArrowDown className="h-3 w-3 text-[#075473]" aria-hidden />
        <span>{end}</span>
      </span>
    );
  }

  if (start) {
    return (
      <span className="shrink-0 text-[10px] text-zinc-400">{start}</span>
    );
  }

  // Fallback: split "a–b" style labels
  const parts = label
    .toLowerCase()
    .split(/[–—-]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return (
      <span className="flex shrink-0 flex-col items-end gap-0.5 text-right text-[10px] leading-tight text-zinc-400">
        <span>{parts[0]}</span>
        <ArrowDown className="h-3 w-3 text-[#075473]" aria-hidden />
        <span>{parts.slice(1).join(" ")}</span>
      </span>
    );
  }

  return label ? (
    <span className="shrink-0 text-[10px] text-zinc-400">{label.toLowerCase()}</span>
  ) : null;
}

function VisitPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-[#0B1F3A] text-white ring-1 ring-[#075473]/50"
          : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function NightStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="inline-flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        aria-label="Fewer nights"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 text-white"
      >
        −
      </button>
      <span className="min-w-[1.25rem] text-center text-sm font-semibold text-white">
        {value}
      </span>
      <button
        type="button"
        aria-label="More nights"
        onClick={() => onChange(value + 1)}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 text-white"
      >
        +
      </button>
      <span className="ml-0.5 text-xs text-zinc-400">nights</span>
    </div>
  );
}

function DragHandle({
  controls,
  onLight = false,
}: {
  controls: ReturnType<typeof useDragControls>;
  onLight?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label="Drag to reorder"
      onPointerDown={(e) => controls.start(e)}
      className={`cursor-grab touch-none rounded-md px-1.5 py-1.5 active:cursor-grabbing ${
        onLight
          ? "bg-black/35 text-white backdrop-blur-sm"
          : "text-white"
      }`}
    >
      <svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor">
        <rect x="0" y="0" width="14" height="2" rx="1" />
        <rect x="0" y="5" width="14" height="2" rx="1" />
        <rect x="0" y="10" width="14" height="2" rx="1" />
      </svg>
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Remove location"
      onClick={onClick}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-950 hover:text-[#8A3B2A]"
    >
      ×
    </button>
  );
}
