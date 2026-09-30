"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Car } from "lucide-react";
import type {
  PbChauffeurRate,
  PbCity,
  PbVehicle,
} from "@/lib/pocketbase/client";
import { cityPhoto, pbFileUrl } from "@/lib/pocketbase/client";
import {
  countBillableChauffeurDays,
  isBillableChauffeurDay,
} from "@/lib/chauffeurSelections";
import { chauffeurDaysForCity } from "@/lib/dateCascade";
import {
  formatTransferPriceRange,
  priceFleetChauffeurDay,
} from "@/lib/vehicleAllocator";
import { useBuilderStore } from "@/store/useBuilderStore";
import { travelStyleTierRules } from "@/lib/preEliteHydrate";
import { CityTransportModal } from "./CityTransportModal";
import { ExplainerTriggerButton } from "../ExplainerTriggerButton";
import { GoldLight } from "@/components/branding/GoldLight";

/**
 * Full-screen Drivers & City Transport editor (widget / progress step 6).
 */
export function DriversEditorModal({
  open,
  onClose,
  cities = [],
  cityNames,
  vehicles = [],
  chauffeurRates = [],
}: {
  open: boolean;
  onClose: () => void;
  cities?: PbCity[];
  cityNames: Record<string, string>;
  vehicles?: PbVehicle[];
  chauffeurRates?: PbChauffeurRate[];
}) {
  const [mounted, setMounted] = useState(false);
  const [activeCityId, setActiveCityId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(true);

  const locations = useBuilderStore((s) => s.locations);
  const arrivalDate = useBuilderStore((s) => s.arrivalDate);
  const adults = useBuilderStore((s) => s.adults);
  const children = useBuilderStore((s) => s.children);
  const chauffeurSelections = useBuilderStore((s) => s.chauffeurSelections);
  const selectedToursMap = useBuilderStore((s) => s.selectedTours);
  const setChauffeurDayMode = useBuilderStore((s) => s.setChauffeurDayMode);
  const toggleChauffeurDayTour = useBuilderStore(
    (s) => s.toggleChauffeurDayTour
  );
  const experienceService = useBuilderStore((s) => s.experienceService);
  const isEliteConcierge = useBuilderStore((s) => s.isEliteConcierge);
  const preEliteTravelStyle = useBuilderStore((s) => s.preEliteTravelStyle);
  const tierRules = travelStyleTierRules(preEliteTravelStyle);
  const allowPrivate = tierRules.allowPrivateChauffeur;
  const conciergeLocked = isEliteConcierge || experienceService === "concierge";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    setShowConfirm(true);
  }, [open]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const totalPax = adults + children;
  const chauffeurDayCount = countBillableChauffeurDays(chauffeurSelections);

  const stayStops = useMemo(() => {
    const seen = new Set<string>();
    const stops: { key: string; cityId: string }[] = [];
    for (const loc of locations) {
      if (loc.visitType && loc.visitType !== "stay") continue;
      if (loc.nights <= 0) continue;
      if (seen.has(loc.cityId)) continue;
      seen.add(loc.cityId);
      stops.push({
        key: loc.key?.trim() || loc.cityId || `driver-${seen.size}`,
        cityId: loc.cityId,
      });
    }
    return stops;
  }, [locations]);

  const cityMap = useMemo(() => {
    const m: Record<string, PbCity> = {};
    for (const c of cities) m[c.id] = c;
    return m;
  }, [cities]);

  const activeCity = activeCityId ? cityMap[activeCityId] : undefined;
  const activeName = activeCityId
    ? cityNames[activeCityId] ?? activeCity?.name ?? "City"
    : "";
  const activeDayOptions = activeCityId
    ? chauffeurDaysForCity(arrivalDate, locations, activeCityId)
    : [];
  const activeSelections = activeCityId
    ? chauffeurSelections[activeCityId] ?? {}
    : {};
  const activeQuote = activeCityId
    ? priceFleetChauffeurDay({
        cityId: activeCityId,
        totalPax,
        vehicles,
        rates: chauffeurRates,
      })
    : null;
  const dailyLabel =
    activeQuote?.fromRates && activeQuote.min > 0
      ? formatTransferPriceRange(activeQuote.min, activeQuote.max)
      : null;
  const fleetLabel =
    activeQuote?.fleet?.label?.replace("×", "x") ?? null;

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence
      onExitComplete={() => {
        document.body.style.overflow = "";
      }}
    >
      {open ? (
        <motion.div
          key="drivers-editor"
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Drivers and city transport"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="tokio-modal-backdrop absolute inset-0 cursor-default"
            onClick={onClose}
          />
          <motion.div
            className="tokio-modal-content relative z-[1] flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden border border-white/10 sm:h-[min(92dvh,44rem)] sm:max-h-[min(92dvh,44rem)] sm:max-w-lg sm:rounded-3xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="tokio-modal-chrome flex shrink-0 items-center gap-3 border-b px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-5 sm:pt-5">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-white transition hover:border-zinc-500"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#075473]">
                  Configure
                </p>
                <h3 className="truncate font-display text-xl text-white sm:text-2xl">
                  Drivers &amp; Transport
                </h3>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 pb-[max(7rem,env(safe-area-inset-bottom))] sm:px-5">
              {showConfirm ? (
                <div className="flex flex-col gap-4">
                  <p className="font-godiva text-lg uppercase tracking-wide text-white">
                    Transport confirmation
                  </p>
                  <p className="text-sm text-zinc-400">
                    Review how you move between cities and days. Public rail may
                    need tickets (Suica/PASMO); private chauffeurs are assigned
                    after Ops confirms.
                  </p>
                  <ul className="space-y-2 rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-zinc-300">
                    <li>
                      · Legs: {stayStops.length} stay city
                      {stayStops.length === 1 ? "" : "ies"}
                    </li>
                    <li>
                      · Private chauffeur days: {chauffeurDayCount}
                    </li>
                    <li>
                      · Tickets / Suica: configure per city on the next screen
                    </li>
                  </ul>
                  <ExplainerTriggerButton
                    featureKey="public_transport_explainer"
                    title="Public transport &amp; Suica explained"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(false)}
                    className="rounded-xl bg-[#075473] px-4 py-3 text-xs font-bold tracking-wider text-white uppercase"
                  >
                    Continue to drivers
                  </button>
                </div>
              ) : (
                <>
              {conciergeLocked ? (
                <div className="group relative overflow-hidden rounded-2xl border border-[#075473]/40 bg-[#075473]/15 px-4 py-3">
                  <GoldLight color="#F6A724" placement="top-center" active />
                  <div className="relative z-10">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#F6A724]">
                      Elite Concierge Active
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-300">
                      Private chauffeur picks are curated 1:1 in your bespoke
                      quotation.
                    </p>
                  </div>
                </div>
              ) : null}

              {allowPrivate && !conciergeLocked ? (
                <ExplainerTriggerButton
                  featureKey="daily_transport_explainer"
                  title="Watch: Why you need private daily transport"
                />
              ) : null}

              <p className="text-xs text-zinc-400">
                {conciergeLocked
                  ? "Included with Elite Concierge"
                  : !allowPrivate
                    ? "Public Transit & Walking Guide"
                    : chauffeurDayCount === 0
                      ? "No private driver days yet"
                      : `${chauffeurDayCount} driver day${chauffeurDayCount === 1 ? "" : "s"}`}
              </p>

              {conciergeLocked ? null : stayStops.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950 p-4 text-sm text-zinc-400">
                  Add stay cities first to configure private chauffeurs.
                </p>
              ) : (
                <div className="space-y-3">
                  {stayStops.map((stop) => {
                    const city = cityMap[stop.cityId];
                    const name =
                      cityNames[stop.cityId] ?? city?.name ?? "City";
                    const citySelections =
                      chauffeurSelections[stop.cityId] ?? {};
                    const driverDays = Object.values(citySelections).filter(
                      (sel) => isBillableChauffeurDay(sel)
                    ).length;
                    const quote = priceFleetChauffeurDay({
                      cityId: stop.cityId,
                      totalPax,
                      vehicles,
                      rates: chauffeurRates,
                    });
                    const rateLabel =
                      quote?.fromRates && quote.min > 0
                        ? formatTransferPriceRange(quote.min, quote.max)
                        : null;
                    const filename = city ? cityPhoto(city) : "";
                    const img =
                      filename && city
                        ? pbFileUrl(
                            city.collectionId,
                            city.id,
                            filename,
                            "200x140"
                          )
                        : "";

                    return (
                      <button
                        key={stop.key}
                        type="button"
                        onClick={() => setActiveCityId(stop.cityId)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-left transition hover:border-[#075473]/40"
                      >
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img}
                            alt=""
                            className="h-14 w-20 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-sky-400">
                            <Car className="h-5 w-5" aria-hidden />
                          </div>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-white">
                            {name}
                          </span>
                          <span className="mt-0.5 block text-xs text-zinc-400">
                            {driverDays > 0
                              ? `${driverDays} driver day${driverDays === 1 ? "" : "s"}`
                              : "Tap to configure"}
                            {rateLabel ? ` · ${rateLabel}/day` : ""}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
                </>
              )}
            </div>

            <div className="tokio-modal-chrome shrink-0 border-t px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
              <button
                type="button"
                onClick={showConfirm ? () => setShowConfirm(false) : onClose}
                className="w-full rounded-full bg-[#054F70] py-3 text-sm font-semibold text-white transition hover:bg-[#043d57]"
              >
                {showConfirm ? "Continue" : "Done"}
              </button>
            </div>
          </motion.div>

          {activeCityId && !conciergeLocked ? (
            <CityTransportModal
              open={Boolean(activeCityId)}
              onClose={() => setActiveCityId(null)}
              cityName={activeName}
              cityId={activeCityId}
              dayOptions={activeDayOptions}
              daySelections={activeSelections}
              selectedTours={selectedToursMap[activeCityId] ?? []}
              dailyRateLabel={dailyLabel}
              fleetLabel={fleetLabel}
              arrivalDateMissing={!arrivalDate}
              onSetDayMode={(date, mode) =>
                setChauffeurDayMode(activeCityId, date, mode)
              }
              onToggleDayTour={(date, tourId) =>
                toggleChauffeurDayTour(activeCityId, date, tourId)
              }
            />
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
