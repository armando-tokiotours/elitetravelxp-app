"use client";

import { Reorder } from "framer-motion";
import {
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { canAppendCity } from "@/lib/locationRules";
import type { PbCity, PbHub } from "@/lib/pocketbase/client";
import { getCityName } from "@/lib/cityLabels";
import type { validateCityRoute } from "@/lib/routeValidator";
import {
  matchesForCity,
  type matchSeasonalHighlights,
} from "@/lib/seasonalMatcher";
import type {
  CityTransitType,
  CityVisitType,
  LocationStop,
} from "@/store/useBuilderStore";
import { useHybridTooltip } from "@/hooks/useHybridTooltip";
import { BuilderPortalSheet } from "../BuilderPortalSheet";
import { CityAccordionItem } from "../CityAccordionItem";
import { CityThumb } from "../CityThumb";

export function LocationsEditorModal({
  open,
  onClose,
  locations,
  cities,
  cityMap,
  dateByKey,
  arrivalHub,
  hubShortName,
  expandedKey,
  setExpandedKey,
  seasonalMatches,
  selectedTourIds,
  routeWarnings,
  routeToast,
  totalNights,
  durationDays,
  matches,
  lastCityId,
  pickerOpen,
  setPickerOpen,
  onReorder,
  onNights,
  onVisitType,
  onTransit,
  onRemove,
  onAddTour,
  onAddCity,
}: {
  open: boolean;
  onClose: () => void;
  locations: LocationStop[];
  cities: PbCity[];
  cityMap: Record<string, PbCity>;
  dateByKey: Record<string, { label?: string }>;
  arrivalHub: PbHub | null;
  hubShortName: (hub: PbHub | null) => string;
  expandedKey: string | null;
  setExpandedKey: Dispatch<SetStateAction<string | null>>;
  seasonalMatches: ReturnType<typeof matchSeasonalHighlights>;
  selectedTourIds: string[];
  routeWarnings: ReturnType<typeof validateCityRoute>;
  routeToast: string | null;
  totalNights: number;
  durationDays: number;
  matches: boolean;
  lastCityId: string | null;
  pickerOpen: boolean;
  setPickerOpen: (v: boolean) => void;
  onReorder: (next: LocationStop[]) => void;
  onNights: (key: string, n: number) => void;
  onVisitType: (key: string, t: CityVisitType) => void;
  onTransit: (key: string, t: CityTransitType) => void;
  onRemove: (key: string) => void;
  onAddTour: (id: string) => void;
  onAddCity: (cityId: string) => boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
  }, [open]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence
      onExitComplete={() => {
        document.body.style.overflow = "";
      }}
    >
      {open ? (
        <motion.div
          key="locations-editor"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Edit route"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#0a0a0a] md:h-[85vh] md:max-w-2xl md:rounded-2xl md:border md:border-zinc-800"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="flex flex-shrink-0 items-start gap-3 border-b border-zinc-800 bg-[#0a0a0a] p-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back"
                className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-white transition hover:border-zinc-500"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D9BB96]">
                  Configure
                </p>
                <div className="mt-0.5 flex items-start justify-between gap-3">
                  <h3 className="font-display text-2xl font-extrabold leading-tight text-white">
                    Locations &amp;
                    <br />
                    Nights
                  </h3>
                  {routeWarnings[0] || !matches ? (
                    <RouteNoticeBadge
                      message={
                        routeWarnings[0]
                          ? routeWarnings[0].body || routeWarnings[0].title
                          : `Nights total ${totalNights} — need ${durationDays} for your trip.`
                      }
                    />
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Time in each city only — hotels come in Step 4
                </p>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 pb-12 sm:px-5">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-400">
                Set how many nights you spend in each city and how you travel
                between stops. Accommodation is optional and configured next
                under{" "}
                <span className="font-semibold text-[#F3D9C4]">Hotels</span>.
              </div>

              {routeToast ? (
                <div
                  role="status"
                  className="rounded-xl border border-[#B85304]/50 bg-zinc-950 px-3.5 py-2.5 text-sm text-[#F3D9C4]"
                >
                  {routeToast}
                </div>
              ) : null}

              {routeWarnings.length > 1
                ? routeWarnings.slice(1).map((w) => (
                    <div
                      key={w.type}
                      className={`rounded-xl px-3.5 py-3 text-sm ${
                        w.type === "inefficient"
                          ? "border border-[#B85304]/35 bg-zinc-950 text-zinc-300"
                          : "border border-[#B85304]/50 bg-zinc-950 text-[#F3D9C4]"
                      }`}
                    >
                      <p className="font-semibold text-white">
                        {w.type === "inefficient" ? "💡 " : "⚠️ "}
                        {w.title}
                      </p>
                      <p className="mt-1 leading-relaxed">{w.body}</p>
                    </div>
                  ))
                : null}

              {locations.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950 px-4 py-6 text-center text-sm text-zinc-400">
                  Add cities to shape your route. Drag to reorder. The same city
                  can appear more than once, but not consecutively.
                </p>
              ) : (
                <Reorder.Group
                  axis="y"
                  values={locations}
                  onReorder={onReorder}
                  className="flex w-full flex-col gap-4 overflow-visible"
                >
                  {locations.map((loc, index) => {
                    const prev = index > 0 ? locations[index - 1] : null;
                    const fromLabel =
                      index === 0
                        ? hubShortName(arrivalHub)
                        : cityMap[prev!.cityId]?.name ||
                          getCityName(prev!.cityId);
                    const range = dateByKey[loc.key];
                    return (
                      <CityAccordionItem
                        key={loc.key || `loc-${index}`}
                        loc={loc}
                        city={cityMap[loc.cityId]}
                        dateLabel={range?.label ?? ""}
                        fromLabel={fromLabel}
                        index={index}
                        totalLocations={locations.length}
                        expanded={expandedKey === loc.key}
                        onToggle={() =>
                          setExpandedKey((k) =>
                            k === loc.key ? null : loc.key
                          )
                        }
                        suggestions={matchesForCity(
                          seasonalMatches,
                          loc.cityId
                        )}
                        selectedTourIds={selectedTourIds}
                        onNights={(n) => onNights(loc.key, n)}
                        onVisitType={(t) => onVisitType(loc.key, t)}
                        onTransit={(t) => onTransit(loc.key, t)}
                        onRemove={() => onRemove(loc.key)}
                        onAddTour={onAddTour}
                      />
                    );
                  })}
                </Reorder.Group>
              )}

              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                disabled={cities.length === 0}
                className="w-full rounded-full border border-dashed border-[#B85304] bg-zinc-950 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-40"
              >
                + Add Location
              </button>
            </div>

            <div className="flex flex-shrink-0 flex-col gap-3 border-t border-zinc-800 bg-[#0a0a0a]/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md">
              <div
                className={`rounded-xl px-4 py-3 text-sm font-medium ${
                  matches
                    ? "bg-emerald-950/90 text-emerald-400"
                    : "bg-accent-950/90 text-accent-500"
                }`}
              >
                Total nights: {totalNights}{" "}
                {matches
                  ? `(Matches your ${durationDays}-day trip)`
                  : `(Should match your ${durationDays}-day trip)`}
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={!matches}
                className="w-full rounded-full bg-[#0B1F3A] py-3 text-sm font-semibold text-white transition hover:bg-[#143052] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Done
              </button>
            </div>
          </motion.div>

          <BuilderPortalSheet
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            title="Add Location"
          >
            {lastCityId ? (
              <p className="mb-3 text-xs text-zinc-400">
                You can add a city again later for a round-trip, but not
                immediately after itself.
              </p>
            ) : null}
            <ul className="space-y-2">
              {cities.map((city) => {
                const disabled = !canAppendCity(locations, city.id);
                return (
                  <li key={city.id || `pick-${city.name}`}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        if (!onAddCity(city.id)) return;
                        setPickerOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                        disabled
                          ? "cursor-not-allowed border-zinc-700 bg-zinc-800 opacity-50"
                          : "border-zinc-700 bg-zinc-800 text-zinc-200 hover:border-[#B85304]"
                      }`}
                    >
                      <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg">
                        <CityThumb
                          city={city}
                          name={city.name}
                          alt=""
                          thumb="100x100"
                          className="h-full w-full object-cover"
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-zinc-200">
                          {city.name}
                        </span>
                        {disabled ? (
                          <span className="text-xs text-zinc-400">
                            Already last in your route
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </BuilderPortalSheet>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

function RouteNoticeBadge({ message }: { message: string }) {
  const {
    isOpen,
    containerRef,
    onMouseEnter,
    onMouseLeave,
    onToggleClick,
  } = useHybridTooltip();

  return (
    <div
      ref={containerRef}
      className="relative z-50 inline-block shrink-0"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        type="button"
        onClick={onToggleClick}
        aria-expanded={isOpen}
        aria-describedby={isOpen ? "route-notice-tooltip" : undefined}
        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#B85304]/60 bg-[#B85304]/15 px-3 py-1.5 text-xs font-bold text-[#B85304] shadow-sm transition hover:bg-[#B85304]/30 active:scale-95"
      >
        <span>⚠️ Route Notice</span>
      </button>
      {isOpen ? (
        <div
          id="route-notice-tooltip"
          role="tooltip"
          className="absolute right-0 top-full z-50 mt-2 w-64 max-w-[260px] rounded-xl border border-[#B85304]/40 bg-[#D9BB96] p-3 text-left text-[11px] font-semibold leading-tight text-[#000000] shadow-2xl animate-in fade-in duration-150"
        >
          <div
            className="absolute bottom-full right-4 border-[6px] border-transparent border-b-[#D9BB96]"
            aria-hidden
          />
          <p className="leading-snug">{message}</p>
        </div>
      ) : null}
    </div>
  );
}
