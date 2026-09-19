"use client";

import { useMemo, useState } from "react";
import { Car, ChevronRight } from "lucide-react";
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
import { BUILDER_ALL_STEPS_COMPLETE } from "@/lib/builderSteps";
import { useBuilderStore } from "@/store/useBuilderStore";
import { SectionBlock } from "./ui";
import { SectionContinue } from "./SectionContinue";
import { ExplainerTriggerButton } from "./ExplainerTriggerButton";
import { CityTransportModal } from "./modals/CityTransportModal";
import { formatUsd } from "@/lib/builder-pricing";

export function DriversTransportSection({
  cities = [],
  cityNames,
  vehicles = [],
  chauffeurRates = [],
}: {
  cities?: PbCity[];
  cityNames: Record<string, string>;
  vehicles?: PbVehicle[];
  chauffeurRates?: PbChauffeurRate[];
}) {
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
  const conciergeLocked = isEliteConcierge || experienceService === "concierge";

  const [activeCityId, setActiveCityId] = useState<string | null>(null);

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
      stops.push({ key: loc.key || loc.cityId, cityId: loc.cityId });
    }
    return stops;
  }, [locations]);

  const cityMap = useMemo(() => {
    const m: Record<string, PbCity> = {};
    for (const c of cities) m[c.id] = c;
    return m;
  }, [cities]);

  const subtotal = useMemo(() => {
    let min = 0;
    let max = 0;
    for (const stop of stayStops) {
      const citySelections = chauffeurSelections[stop.cityId] ?? {};
      const activeCount = Object.values(citySelections).filter((sel) =>
        isBillableChauffeurDay(sel)
      ).length;
      if (activeCount === 0) continue;
      const quote = priceFleetChauffeurDay({
        cityId: stop.cityId,
        totalPax,
        vehicles,
        rates: chauffeurRates,
      });
      if (quote?.fromRates && quote.min > 0) {
        min += quote.min * activeCount;
        max += quote.max * activeCount;
      }
    }
    return { min, max };
  }, [stayStops, chauffeurSelections, totalPax, vehicles, chauffeurRates]);

  const summary = conciergeLocked
    ? "Included with Elite Concierge"
    : chauffeurDayCount === 0
      ? "No private driver days yet"
      : `${chauffeurDayCount} driver day${chauffeurDayCount === 1 ? "" : "s"}`;

  const activeStop = stayStops.find((s) => s.cityId === activeCityId);
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

  return (
    <SectionBlock
      number={6}
      title="Drivers & City Transport"
      id="section-drivers"
      icon="car"
      summary={summary}
    >
      {experienceService === "concierge" || isEliteConcierge ? (
        <div className="mb-4 rounded-2xl border border-[#B85304]/40 bg-[#B85304]/15 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent-500">
            ✨ Elite Concierge Active
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-300">
            Private chauffeur and city transfer picks are deactivated. Your
            dedicated concierge will curate drivers and logistics 1:1 and price
            them in your bespoke quotation.
          </p>
        </div>
      ) : null}

      <div className="mb-4">
        <ExplainerTriggerButton
          featureKey="daily_transport_explainer"
          title="Watch: Why you need private daily transport"
        />
      </div>

      {conciergeLocked ? (
        <p className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950 p-4 text-sm text-zinc-400">
          Remove Elite Concierge in Step 5 to configure a-la-carte private
          drivers again.
        </p>
      ) : stayStops.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950 p-4 text-sm text-zinc-400">
          Add stay cities in Step 3 to configure private chauffeurs and city
          transport.
        </p>
      ) : (
        <div className="space-y-3">
          {stayStops.map((stop) => {
            const city = cityMap[stop.cityId];
            const name = cityNames[stop.cityId] ?? city?.name ?? "City";
            const citySelections = chauffeurSelections[stop.cityId] ?? {};
            const driverDays = Object.values(citySelections).filter((sel) =>
              isBillableChauffeurDay(sel)
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
            const fleet =
              quote?.fleet?.label?.replace("×", "x") ?? null;
            const filename = city ? cityPhoto(city) : "";
            const img =
              filename && city
                ? pbFileUrl(city.collectionId, city.id, filename, "200x140")
                : "";

            return (
              <button
                key={stop.key}
                type="button"
                onClick={() => setActiveCityId(stop.cityId)}
                className="flex w-full items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-left transition hover:border-[#B85304]/40 hover:bg-zinc-800/80 sm:p-4"
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
                    {driverDays === 0
                      ? "Self-arranged / not set"
                      : `${driverDays} private driver day${
                          driverDays === 1 ? "" : "s"
                        }`}
                    {fleet ? ` · ${fleet}` : ""}
                    {rateLabel ? ` · ${rateLabel}/day` : ""}
                  </span>
                </span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-zinc-600"
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent-500">
          City Transfers & Drivers
        </p>
        {conciergeLocked ? (
          <>
            <p className="mt-1 text-sm font-semibold text-white">
              Included with Elite Concierge
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              A-la-carte driver fees are zeroed. Your specialist prices private
              transport in the bespoke quotation.
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm font-semibold text-white">
              {chauffeurDayCount === 0
                ? "No private chauffeur days selected"
                : `${chauffeurDayCount} billable driver day${
                    chauffeurDayCount === 1 ? "" : "s"
                  }`}
            </p>
            {subtotal.min > 0 ? (
              <p className="mt-1 text-xs text-zinc-400">
                Est. {formatUsd(subtotal.min)}
                {subtotal.max > subtotal.min
                  ? ` – ${formatUsd(subtotal.max)}`
                  : ""}{" "}
                for private city transport
              </p>
            ) : (
              <p className="mt-1 text-xs text-zinc-500">
                Choose Private Chauffeur or Point-to-Point per city day for
                pricing.
              </p>
            )}
          </>
        )}
      </div>

      <SectionContinue
        next={BUILDER_ALL_STEPS_COMPLETE}
        label="Save & View Itinerary"
        savedLabel="✓ Saved — View Itinerary →"
        href="/builder/itinerary"
      />

      {activeStop && !conciergeLocked ? (
        <CityTransportModal
          open={Boolean(activeCityId)}
          onClose={() => setActiveCityId(null)}
          cityName={activeName}
          cityId={activeStop.cityId}
          dayOptions={activeDayOptions}
          daySelections={activeSelections}
          selectedTours={selectedToursMap[activeStop.cityId] ?? []}
          dailyRateLabel={dailyLabel}
          fleetLabel={fleetLabel}
          arrivalDateMissing={!arrivalDate}
          onSetDayMode={(date, mode) =>
            setChauffeurDayMode(activeStop.cityId, date, mode)
          }
          onToggleDayTour={(date, tourId) =>
            toggleChauffeurDayTour(activeStop.cityId, date, tourId)
          }
        />
      ) : null}
    </SectionBlock>
  );
}
