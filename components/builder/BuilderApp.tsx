"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  brandingLogoUrl,
  fetchBuilderConfig,
  ruleBool,
  type BuilderConfig,
} from "@/lib/pocketbase/client";
import {
  calculateBuilderQuote,
  formatUsd,
} from "@/lib/builder-pricing";
import { useBuilderStore } from "@/store/useBuilderStore";
import { AppShell } from "@/components/layout/AppShell";
import { ArrivalDepartureSection } from "./ArrivalDepartureSection";
import { BuilderAccordionProvider } from "./BuilderAccordion";
import { BuilderHero } from "./BuilderHero";
import { BottomNav } from "./BottomNav";
import { HotelsGuestsSection } from "./HotelsGuestsSection";
import { LocationsNightsSection } from "./LocationsNightsSection";
import { ProgressBar } from "./ProgressBar";
import { ToursDriverSection } from "./ToursDriverSection";
import { TripDurationSection } from "./TripDurationSection";

export function BuilderApp() {
  const [config, setConfig] = useState<BuilderConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const state = useBuilderStore();
  const setArrival = useBuilderStore((s) => s.setArrivalTransferId);
  const setDeparture = useBuilderStore((s) => s.setDepartureTransferId);
  const setTransit = useBuilderStore((s) => s.setTransitModeId);
  const addLocation = useBuilderStore((s) => s.addLocation);

  useEffect(() => {
    useBuilderStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchBuilderConfig();
        if (cancelled) return;
        setConfig(data);

        const snap = useBuilderStore.getState();
        if (!snap.arrivalTransferId) {
          const firstAirport =
            data.hubs.find((h) => h.type === "Airport") || data.hubs[0];
          if (firstAirport) setArrival(firstAirport.id);
          else if (data.transfers[0]) setArrival(data.transfers[0].id);
        }
        if (!snap.departureTransferId) {
          const airports = data.hubs.filter((h) => h.type === "Airport");
          const second = airports[1] || airports[0] || data.hubs[0];
          if (second) setDeparture(second.id);
          else if (data.transfers[1] || data.transfers[0]) {
            setDeparture(data.transfers[1]?.id ?? data.transfers[0].id);
          }
        }
        if (!snap.transitModeId && data.transitModes[0]) {
          setTransit(data.transitModes[0].id);
        }
        if (snap.locations.length === 0 && data.cities.length >= 2) {
          addLocation(data.cities[0].id);
          addLocation(data.cities[1].id);
          const keys = useBuilderStore.getState().locations;
          if (keys[0])
            useBuilderStore.getState().setLocationNights(keys[0].key, 5);
          if (keys[1])
            useBuilderStore.getState().setLocationNights(keys[1].key, 5);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "Unable to load trip configuration from PocketBase."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addLocation, setArrival, setDeparture, setTransit]);

  const quote = useMemo(() => {
    if (!config) return null;
    return calculateBuilderQuote(state, config);
  }, [config, state]);

  const cityNames = useMemo(() => {
    if (!config) return {};
    return Object.fromEntries(config.cities.map((c) => [c.id, c.name]));
  }, [config]);

  const logoSrc = brandingLogoUrl(config?.branding ?? null);

  return (
    <AppShell
      heroMode
      transparentHeader
      logoSrc={logoSrc || undefined}
      hideBottomPad
    >
      <div className="relative">
        <BuilderHero branding={config?.branding ?? null} />

        {/* Full-width cream shell — masks fixed parallax leaking past card margins */}
        <div className="relative z-20 w-full bg-[#F5F0E8]">
          <div className="-mt-14 px-3 pb-8 sm:-mt-16 sm:px-4">
            <div className="mx-auto max-w-3xl rounded-t-3xl border border-[#E8E2D9] border-b-0 bg-[#FBF8F2] shadow-[0_-8px_40px_rgba(11,31,58,0.12)]">
              <div className="overflow-hidden rounded-t-3xl border-b border-[#E8E2D9] px-5 py-5 sm:px-6">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#C4A35A]">
                  Your Trip Builder
                </p>
                <h2 className="mt-1 font-display text-2xl text-[#0B1F3A] sm:text-3xl">
                  Design your Japan journey
                </h2>
              </div>

              <div className="px-4 pb-40 pt-0 sm:px-6">
                {loading ? (
                  <p className="rounded-2xl bg-white/70 p-8 text-center text-sm text-[#8A8278]">
                    Loading your trip builder…
                  </p>
                ) : error ? (
                  <div className="rounded-2xl border border-red-200 bg-white p-6 text-sm text-red-700">
                    <p className="font-semibold">PocketBase unavailable</p>
                    <p className="mt-2 text-[#5C6570]">{error}</p>
                  </div>
                ) : config ? (
                  <BuilderAccordionProvider defaultOpen={1}>
                    <ProgressBar />
                    <div className="mt-6 flex flex-col gap-4">
                      <TripDurationSection
                        seasonTiers={config.seasonTiers}
                      />
                      <ArrivalDepartureSection hubs={config.hubs} />
                    <LocationsNightsSection
                      cities={config.cities}
                      hubs={config.hubs}
                      cityMovements={config.cityMovements}
                      transitModes={config.transitModes}
                      seasonalHighlights={config.seasonalHighlights}
                    />
                    <HotelsGuestsSection
                      accommodations={config.accommodations}
                      cities={config.cities}
                      maxAdultsPerRoom={Number(
                        config.rules.max_adults_per_room || 3
                      )}
                    />
                      <ToursDriverSection
                        tours={config.tours}
                        cityNames={cityNames}
                        allowToursOnTravelDays={ruleBool(
                          config.rules,
                          "allow_tours_on_travel_days",
                          false
                        )}
                        seasonalHighlights={config.seasonalHighlights}
                      />
                    </div>
                  </BuilderAccordionProvider>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Sticky CTA — below BottomNav (z-40), well below modals (z-[100]) */}
        <div className="fixed inset-x-0 bottom-[3.75rem] z-30 px-4 pb-2 md:bottom-6">
          <div className="mx-auto max-w-3xl">
            <Link
              href="/builder/print"
              className="flex w-full flex-col items-center rounded-2xl bg-[#0B1F3A] px-6 py-4 text-center shadow-[0_12px_40px_rgba(11,31,58,0.35)] transition hover:bg-[#143052]"
            >
              <span className="text-base font-semibold tracking-wide text-white">
                ✨ VIEW / PRINT ITINERARY
              </span>
              <span className="mt-1 text-xs text-white/65">
                Your trip is saved automatically.
                {quote
                  ? ` · Est. ${formatUsd(quote.min)}–${formatUsd(quote.max)}`
                  : ""}
              </span>
            </Link>
          </div>
        </div>

        <BottomNav />
      </div>
    </AppShell>
  );
}
