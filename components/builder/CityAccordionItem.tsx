"use client";

import { Reorder, useDragControls } from "framer-motion";
import type { PbCity } from "@/lib/pocketbase/client";
import type { SeasonalMatch } from "@/lib/seasonalMatcher";
import type {
  CityTransitType,
  CityVisitType,
  LocationStop,
} from "@/store/useBuilderStore";
import { coerceTransitType } from "@/store/useBuilderStore";
import { allowedVisitTypesForIndex } from "@/lib/locationRules";
import { ConciergeSuggestionCard } from "./ConciergeSuggestionCard";
import { CityThumb } from "./CityThumb";

export function CityAccordionItem({
  loc,
  city,
  dateLabel,
  fromLabel,
  index,
  totalLocations,
  expanded,
  onToggle,
  suggestions,
  selectedTourIds,
  onNights,
  onVisitType,
  onTransit,
  onRemove,
  onAddTour,
}: {
  loc: LocationStop;
  city?: PbCity;
  dateLabel: string;
  fromLabel: string;
  index: number;
  totalLocations: number;
  expanded: boolean;
  onToggle: () => void;
  suggestions: SeasonalMatch[];
  selectedTourIds: string[];
  onNights: (n: number) => void;
  onVisitType: (t: CityVisitType) => void;
  onTransit: (t: CityTransitType) => void;
  onRemove: () => void;
  onAddTour: (tourId: string) => void;
}) {
  const controls = useDragControls();
  const name = city?.name ?? "City";
  const transit: CityTransitType = coerceTransitType(loc.transitType);
  const allowedVisitTypes = allowedVisitTypesForIndex(index, totalLocations);
  const visitType: CityVisitType = allowedVisitTypes.includes(loc.visitType)
    ? loc.visitType
    : "stay";
  const isStay = visitType === "stay";
  const isLast = index === totalLocations - 1;

  return (
    <Reorder.Item
      value={loc}
      dragListener={false}
      dragControls={controls}
      className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-[0_2px_12px_rgba(11,31,58,0.04)]"
    >
      {expanded ? (
        <div>
          <div className="relative">
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

          <div className="px-4 pb-4 pt-3">
            <div className="flex w-full flex-col gap-1 overflow-hidden sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div className="flex min-w-0 flex-col gap-1 overflow-hidden">
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
                <span className="shrink-0 rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-semibold capitalize text-[#C4A35A]">
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

            <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                  From
                </p>
                <p className="break-words text-sm font-medium leading-tight text-white">
                  {fromLabel}
                </p>
              </div>

              {!isLast ? (
                <div className="text-right">
                  <p className="mb-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
                    Travel to next
                  </p>
                  {transit === "unset" ? (
                    <p className="mb-1.5 text-[10px] font-medium text-amber-400">
                      ⚠️ Not configured
                    </p>
                  ) : null}
                  <div className="inline-flex flex-wrap justify-end rounded-full border border-zinc-700 bg-zinc-950 p-0.5">
                    <TransitPill
                      active={transit === "self"}
                      onClick={() => onTransit("self")}
                      label="Self"
                      hint="€0"
                    />
                    <TransitPill
                      active={transit === "public"}
                      onClick={() => onTransit("public")}
                      label="Public"
                      hint="Train"
                    />
                    <TransitPill
                      active={transit === "private"}
                      onClick={() => onTransit("private")}
                      label="Private"
                      hint="Car"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {suggestions.map((m) => (
              <ConciergeSuggestionCard
                key={`${m.highlight.id}-${m.cityId}`}
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
        <div className="flex items-stretch gap-0">
          <div className="flex items-center pl-2">
            <DragHandle controls={controls} />
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-2 text-left"
          >
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
              <span className="block break-words text-sm font-semibold leading-tight text-white">
                {name}
              </span>
              <span className="text-xs text-[#C4A35A]">
                {isStay
                  ? `${loc.nights} night${loc.nights === 1 ? "" : "s"}`
                  : visitType === "arrival"
                    ? "Arrival · 0 nights"
                    : "Departure · 0 nights"}
              </span>
            </span>
            {dateLabel ? (
              <span className="shrink-0 text-xs text-zinc-400">
                <span className="mr-0.5 text-[#C4A35A]">›</span>
                {dateLabel.toLowerCase()}
              </span>
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
          ? "bg-[#0B1F3A] text-white ring-1 ring-[#C4A35A]/50"
          : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function TransitPill({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-[#0B1F3A] text-white ring-1 ring-[#C4A35A]/50"
          : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
      }`}
    >
      {label}
      <span
        className={`ml-1 font-normal ${active ? "text-white/70" : "text-zinc-500"}`}
      >
        ({hint})
      </span>
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
          : "text-[#C4A35A]"
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
