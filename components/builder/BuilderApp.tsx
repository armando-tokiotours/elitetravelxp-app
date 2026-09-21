"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Ticket } from "lucide-react";
import {
  fetchBuilderConfig,
  ruleBool,
  type BuilderConfig,
  type PbAccommodation,
} from "@/lib/pocketbase/client";
import {
  calculateBuilderQuote,
  formatUsd,
} from "@/lib/builder-pricing";
import { useBuilderStore } from "@/store/useBuilderStore";
import {
  AppSidebar,
  APP_SIDEBAR_RAIL_PAD,
  MobileAppNav,
} from "@/components/navigation/AppSidebar";
import { ManageBookingModal } from "@/components/modals/ManageBookingModal";
import { ArrivalDepartureSection } from "./ArrivalDepartureSection";
import { BuilderAccordionProvider } from "./BuilderAccordion";
import { BuilderHero } from "./BuilderHero";
import { BottomNav } from "./BottomNav";
import { HotelsGuestsSection } from "./HotelsGuestsSection";
import { LocationsNightsSection } from "./LocationsNightsSection";
import { ProgressBar } from "./ProgressBar";
import { ToursDriverSection } from "./ToursDriverSection";
import { DriversTransportSection } from "./DriversTransportSection";
import { TripDurationSection } from "./TripDurationSection";
import { BookingRefBadge } from "./BookingRefBadge";
import { NewBookingResetButton } from "./NewBookingResetButton";

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

  const [manageOpen, setManageOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const handleAccommodationsLoaded = useCallback(
    (rows: PbAccommodation[]) => {
      setConfig((prev) => (prev ? { ...prev, accommodations: rows } : prev));
    },
    []
  );

  return (
    <>
      <AppSidebar
        brandEyebrow="Elite Travel"
        brandTitle="Builder"
        expandOnHover
      />
      <div className={`${APP_SIDEBAR_RAIL_PAD} min-h-screen bg-[#000000]`}>
        <div className="builder-theme relative min-h-screen bg-[#000000] text-white [color-scheme:dark]">
          {/* Mobile-only top chrome — never shown on md+ (sidebar is primary) */}
          <header className="absolute inset-x-0 top-0 z-40 flex items-center gap-2 border-b border-white/10 bg-[#000000]/70 px-4 py-3 backdrop-blur-md lg:hidden">
            <MobileAppNav
              brandEyebrow="Elite Travel"
              brandTitle="Builder"
            />
            <div className="min-w-0 flex-1" />
            <button
              type="button"
              onClick={() => setManageOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#2C2C2E] bg-[#1C1C1E] px-2.5 py-2 text-[0.65rem] font-semibold uppercase tracking-wider text-[#F5EFE6] transition hover:border-[#B85304] hover:text-white sm:px-3"
              aria-label="Manage Booking"
            >
              <Ticket className="h-3.5 w-3.5 text-[#B85304]" />
              <span className="hidden sm:inline">Manage Booking</span>
              <span className="sm:hidden">Booking</span>
            </button>
          </header>

          <div className="relative">
            <BuilderHero branding={config?.branding ?? null} />

            {/* Full-width Jet Black shell — masks any hero photo leak past card margins */}
            <div className="relative z-20 w-full bg-[#000000]">
              <div className="-mt-14 px-3 pb-8 sm:-mt-16 sm:px-4">
                <div className="mx-auto max-w-3xl rounded-t-3xl border border-[#2C2C2E] border-b-0 bg-[#1C1C1E]/45 shadow-[0_-8px_40px_rgba(0,0,0,0.55)]">
                  <div className="overflow-hidden rounded-t-3xl border-b border-[#2C2C2E] px-5 py-5 sm:px-6">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#E2C498]">
                        Your Trip Builder
                      </p>
                      <h2 className="mt-1 font-display text-[1.4375rem] text-[#F5EFE6] sm:text-[1.725rem]">
                        JAPAN
                      </h2>
                    </div>
                    <div className="mt-3 flex w-full items-stretch gap-2">
                      <div className="min-w-0 flex-1">
                        <BookingRefBadge
                          tempBookingRef={state.tempBookingRef}
                          confirmedBookingRef={state.confirmedBookingRef}
                          bookingStatus={state.bookingStatus}
                        />
                      </div>
                      <NewBookingResetButton />
                    </div>
                  </div>

                  <div className="px-0 pb-40 pt-0">
                    {loading ? (
                      <p className="mx-4 rounded-2xl border border-[#2C2C2E] bg-[#121212]/70 p-8 text-center text-sm text-zinc-400 sm:mx-6">
                        Loading your trip builder…
                      </p>
                    ) : error ? (
                      <div className="mx-4 rounded-2xl border border-red-900/60 bg-[#121212] p-6 text-sm text-red-300 sm:mx-6">
                        <p className="font-semibold">PocketBase unavailable</p>
                        <p className="mt-2 text-zinc-400">{error}</p>
                      </div>
                    ) : config ? (
                      <BuilderAccordionProvider
                        key={state.tempBookingRef || "draft"}
                        defaultOpen={1}
                      >
                        <ProgressBar />
                        <div className="space-y-4 px-4 pt-4 sm:px-6">
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
                            cities={config.cities}
                            maxAdultsPerRoom={Number(
                              config.rules.max_adults_per_room || 3
                            )}
                            onAccommodationsLoaded={handleAccommodationsLoaded}
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
                          />
                          <DriversTransportSection
                            cities={config.cities}
                            cityNames={cityNames}
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

            {/* Sticky CTA — estimate from Step 4; print CTA from Step 6 */}
            {state.highestUnlockedStep >= 4 ? (
              <div className="no-print sticky-action-bar fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 px-4 pb-2 md:bottom-6 lg:pl-16">
                <div className="mx-auto max-w-3xl">
                  {state.highestUnlockedStep >= 6 ? (
                    <Link
                      href="/builder/itinerary"
                      className="no-print flex w-full flex-col items-center rounded-2xl border border-zinc-800 bg-[#121212] px-6 py-4 text-center shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-sm transition-colors hover:border-[#B85304]/60"
                    >
                      <span className="text-base font-extrabold tracking-wide text-white">
                        ✨ VIEW / PRINT ITINERARY
                      </span>
                      <span className="mt-1 text-xs text-zinc-400">
                        Your trip is saved automatically.
                        {quote ? (
                          <>
                            {" · "}
                            <span className="text-[#D9BB96]">
                              Est. {formatUsd(quote.min)}–{formatUsd(quote.max)}
                            </span>
                          </>
                        ) : null}
                      </span>
                    </Link>
                  ) : (
                    <div className="flex w-full flex-col items-center rounded-2xl border border-[#2C2C2E] bg-[#1E2D4A]/95 px-6 py-3.5 text-center shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm">
                      <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#E2C498]">
                        Estimate
                      </span>
                      {quote ? (
                        quote.min <= 0 && quote.max <= 0 ? (
                          <span className="mt-1 flex flex-col items-center gap-0.5 text-sm text-[#F5EFE6]">
                            <span className="font-semibold">
                              Est. {formatUsd(0)} · No add-ons selected
                            </span>
                          </span>
                        ) : (
                          <span className="mt-1 flex flex-col items-center gap-0.5 text-sm text-[#F5EFE6]">
                            <span className="font-semibold">
                              Est. {formatUsd(quote.min)}–{formatUsd(quote.max)}
                            </span>
                            <span className="font-normal text-zinc-300">
                              Selected options and experiences
                            </span>
                          </span>
                        )
                      ) : (
                        <span className="mt-1 text-sm font-semibold text-[#F5EFE6]">
                          Building your trip…
                        </span>
                      )}
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

          <ManageBookingModal
            open={manageOpen}
            onClose={() => setManageOpen(false)}
            onSuccess={(ref) => {
              setToast(`Itinerary ${ref} loaded successfully`);
            }}
          />
          {toast ? (
            <div
              role="status"
              className="fixed bottom-[7.5rem] left-1/2 z-[110] w-[min(92vw,28rem)] -translate-x-1/2 rounded-xl border border-[#B85304]/50 bg-[#1a1510] px-4 py-3 text-center text-sm text-[#F3D9C4] shadow-lg md:bottom-28"
            >
              {toast}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
