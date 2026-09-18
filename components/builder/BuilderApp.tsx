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
import { BookingRefBadge } from "./BookingRefBadge";

export function BuilderApp() {
  const [config, setConfig] = useState<BuilderConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const state = useBuilderStore();
  const setArrival = useBuilderStore((s) => s.setArrivalTransferId);
  const setDeparture = useBuilderStore((s) => s.setDepartureTransferId);
  const setTransit = useBuilderStore((s) => s.setTransitModeId);
  const addLocation = useBuilderStore((s) => s.addLocation);
  const revalidateBuilderUnlock = useBuilderStore(
    (s) => s.revalidateBuilderUnlock
  );
  const ensureTempBookingRef = useBuilderStore((s) => s.ensureTempBookingRef);

  useEffect(() => {
    useBuilderStore.persist.rehydrate();
    ensureTempBookingRef();
  }, [ensureTempBookingRef]);

  // Re-validation: clamp unlock when earlier steps become incomplete
  useEffect(() => {
    revalidateBuilderUnlock();
  }, [
    state.arrivalDate,
    state.durationDays,
    state.adults,
    state.children,
    state.arrivalTransferId,
    state.departureTransferId,
    state.locations,
    state.cityHotels,
    revalidateBuilderUnlock,
  ]);

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
      dark
      logoSrc={logoSrc || undefined}
      hideBottomPad
    >
      <div className="relative">
        <BuilderHero branding={config?.branding ?? null} />

        {/* Full-width dark shell — masks fixed parallax leaking past card margins */}
        <div className="relative z-20 w-full bg-[#0a0a0a]">
          <div className="-mt-14 px-3 pb-8 sm:-mt-16 sm:px-4">
            <div className="mx-auto max-w-3xl rounded-t-3xl border border-zinc-800 border-b-0 bg-[#111111] shadow-[0_-8px_40px_rgba(0,0,0,0.55)]">
              <div className="overflow-hidden rounded-t-3xl border-b border-zinc-800 px-5 py-5 sm:px-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#C4A35A]">
                      Your Trip Builder
                    </p>
                    <h2 className="mt-1 font-display text-2xl text-white sm:text-3xl">
                      Design your Japan journey
                    </h2>
                  </div>
                  <BookingRefBadge
                    tempBookingRef={state.tempBookingRef}
                    confirmedBookingRef={state.confirmedBookingRef}
                    bookingStatus={state.bookingStatus}
                  />
                </div>
              </div>

              <div className="px-4 pb-40 pt-0 sm:px-6">
                {loading ? (
                  <p className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8 text-center text-sm text-zinc-400">
                    Loading your trip builder…
                  </p>
                ) : error ? (
                  <div className="rounded-2xl border border-red-900/60 bg-zinc-900 p-6 text-sm text-red-300">
                    <p className="font-semibold">PocketBase unavailable</p>
                    <p className="mt-2 text-zinc-400">{error}</p>
                  </div>
                ) : config ? (
                  <BuilderAccordionProvider defaultOpen={1}>
                    <ProgressBar />
                    <div className="mt-6 flex flex-col gap-4">
                      <TripDurationSection
                        seasonTiers={config.seasonTiers}
                      />
                      <ArrivalDepartureSection
                        hubs={config.hubs}
                        vehicles={config.vehicles}
                        airportTransfers={config.airportTransfers}
                      />
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
                        cities={config.cities}
                        cityNames={cityNames}
                        allowToursOnTravelDays={ruleBool(
                          config.rules,
                          "allow_tours_on_travel_days",
                          false
                        )}
                        seasonalHighlights={config.seasonalHighlights}
                        vehicles={config.vehicles}
                        chauffeurRates={config.chauffeurRates}
                      />
                    </div>
                  </BuilderAccordionProvider>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Sticky CTA — estimate from Step 4; print CTA from Step 5 */}
        {state.highestUnlockedStep >= 4 ? (
          <div className="no-print sticky-action-bar fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 px-4 pb-2 md:bottom-6">
            <div className="mx-auto max-w-3xl">
              {state.highestUnlockedStep >= 5 ? (
                <Link
                  href="/builder/itinerary"
                  className="no-print flex w-full flex-col items-center rounded-2xl border border-[#C4A35A]/40 bg-[#0B1F3A] px-6 py-4 text-center shadow-[0_12px_40px_rgba(0,0,0,0.55)] transition hover:bg-[#143052]"
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
              ) : (
                <div className="flex w-full flex-col items-center rounded-2xl border border-zinc-800 bg-zinc-950/95 px-6 py-3.5 text-center shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm">
                  <span className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                    Estimate
                  </span>
                  <span className="mt-1 text-sm font-semibold text-white">
                    {quote
                      ? `Est. ${formatUsd(quote.min)}–${formatUsd(quote.max)}`
                      : "Building your trip…"}
                  </span>
                  <span className="mt-1 text-[11px] text-zinc-500">
                    Complete all steps to view your itinerary
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : null}

        <BottomNav />
      </div>
    </AppShell>
  );
}
