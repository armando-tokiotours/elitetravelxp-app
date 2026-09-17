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
import { cityPhoto, pbFileUrl } from "@/lib/pocketbase/client";
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
import { BuilderPortalSheet } from "../BuilderPortalSheet";
import { CityAccordionItem } from "../CityAccordionItem";

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
            <div className="flex flex-shrink-0 items-center gap-4 border-b border-zinc-800 bg-[#0a0a0a] p-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-white transition hover:border-zinc-500"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C4A35A]">
                  Configure
                </p>
                <h3 className="truncate font-display text-2xl text-white">
                  Locations &amp; Nights
                </h3>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 pb-12">
              {routeToast ? (
                <div
                  role="status"
                  className="rounded-xl border border-[#C4A35A]/50 bg-zinc-950 px-3.5 py-2.5 text-sm text-[#E8D5A3]"
                >
                  {routeToast}
                </div>
              ) : null}

              {routeWarnings.map((w) => (
                <div
                  key={w.type}
                  className={`rounded-xl px-3.5 py-3 text-sm ${
                    w.type === "inefficient"
                      ? "border border-[#C4A35A]/35 bg-zinc-950 text-zinc-300"
                      : "border border-[#C4A35A]/50 bg-zinc-950 text-[#E8D5A3]"
                  }`}
                >
                  <p className="font-semibold text-white">
                    {w.type === "inefficient" ? "💡 " : "⚠️ "}
                    {w.title}
                  </p>
                  <p className="mt-1 leading-relaxed">{w.body}</p>
                </div>
              ))}

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
                  className="flex flex-col gap-4"
                >
                  {locations.map((loc, index) => {
                    const prev = index > 0 ? locations[index - 1] : null;
                    const fromLabel =
                      index === 0
                        ? hubShortName(arrivalHub)
                        : cityMap[prev!.cityId]?.name ?? "Previous city";
                    const range = dateByKey[loc.key];
                    return (
                      <CityAccordionItem
                        key={loc.key}
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
                className="w-full rounded-full border border-dashed border-[#C4A35A] bg-zinc-950 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-40"
              >
                + Add Location
              </button>
            </div>

            <div className="flex flex-shrink-0 flex-col gap-3 border-t border-zinc-800 bg-[#0a0a0a]/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md">
              <div
                className={`rounded-xl px-4 py-3 text-sm font-medium ${
                  matches
                    ? "bg-emerald-950/90 text-emerald-400"
                    : "bg-amber-950/90 text-amber-400"
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
                const filename = cityPhoto(city);
                const img = filename
                  ? pbFileUrl(city.collectionId, city.id, filename, "100x100")
                  : "";
                const disabled = !canAppendCity(locations, city.id);
                return (
                  <li key={city.id}>
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
                          : "border-zinc-700 bg-zinc-800 text-zinc-200 hover:border-[#C4A35A]"
                      }`}
                    >
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={img}
                          alt=""
                          className="h-11 w-11 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-11 w-11 rounded-lg bg-zinc-700" />
                      )}
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
