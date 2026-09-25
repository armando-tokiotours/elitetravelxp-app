"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  fetchBuilderConfig,
  ruleBool,
  type BuilderConfig,
  type PbAccommodation,
} from "@/lib/pocketbase/client";
import {
  calculateBuilderQuote,
  formatEstimateSummary,
  formatUsd,
} from "@/lib/builder-pricing";
import { ELITE_CONCIERGE_FEE } from "@/lib/eliteConcierge";
import { hydrateStoresFromPreEliteBrief } from "@/lib/preEliteHydrate";
import { useBuilderStore } from "@/store/useBuilderStore";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";
import { useItineraryStore } from "@/store/useItineraryStore";
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
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<BuilderConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const state = useBuilderStore();
  const [guestBadge, setGuestBadge] = useState({
    name: "Guest Brief",
    email: "",
  });
  const setArrival = useBuilderStore((s) => s.setArrivalTransferId);
  const setDeparture = useBuilderStore((s) => s.setDepartureTransferId);
  const setTransit = useBuilderStore((s) => s.setTransitModeId);
  const addLocation = useBuilderStore((s) => s.addLocation);
  const revalidateBuilderUnlock = useBuilderStore(
    (s) => s.revalidateBuilderUnlock
  );
  const ensureTempBookingRef = useBuilderStore((s) => s.ensureTempBookingRef);
  const setTripMode = useBuilderStore((s) => s.setTripMode);

  useEffect(() => {
    const syncGuestBadge = () => {
      const it = useItineraryStore.getState();
      const pre = usePreBuilderStore.getState();
      let storedName = "";
      let storedEmail = "";
      try {
        const raw = localStorage.getItem("travelxp-itinerary-profile");
        if (raw) {
          const parsed = JSON.parse(raw) as {
            state?: { clientName?: string; clientEmail?: string };
          };
          storedName = String(parsed.state?.clientName || "").trim();
          storedEmail = String(parsed.state?.clientEmail || "")
            .trim()
            .toLowerCase();
        }
      } catch {
        /* ignore */
      }

      const name = (
        it.clientName ||
        pre.fullName ||
        pre.lastPayload?.fullName ||
        storedName ||
        ""
      ).trim();
      const email = (
        it.clientEmail ||
        pre.email ||
        pre.lastPayload?.email ||
        storedEmail ||
        ""
      )
        .trim()
        .toLowerCase();

      if (name && !it.clientName) it.setClientName(name);
      if (email && !it.clientEmail) it.setClientEmail(email);

      setGuestBadge({
        name: name || "Guest Brief",
        email,
      });
    };

    useBuilderStore.persist.rehydrate();
    void Promise.all([
      usePreBuilderStore.persist.rehydrate(),
      useItineraryStore.persist.rehydrate(),
    ]).finally(syncGuestBadge);

    const unsubIt = useItineraryStore.subscribe(syncGuestBadge);
    const unsubPre = usePreBuilderStore.subscribe(syncGuestBadge);
    const unsubHydrate = useBuilderStore.persist.onFinishHydration(() => {
      ensureTempBookingRef();
      setTripMode("multi_day");
    });
    if (useBuilderStore.persist.hasHydrated()) {
      ensureTempBookingRef();
      setTripMode("multi_day");
    }
    return () => {
      unsubIt();
      unsubPre();
      unsubHydrate();
    };
  }, [ensureTempBookingRef, setTripMode]);

  // Pre-elite brief → builder when arriving with ?ref=
  useEffect(() => {
    const ref = String(searchParams.get("ref") || "")
      .trim()
      .toUpperCase();
    if (!ref) return;

    const pre = usePreBuilderStore.getState();
    if (pre.bookingRef === ref && pre.lastPayload?.itineraryData) {
      // Always re-sync so duration / arrival / PNR match the brief (no stale mismatch).
      hydrateStoresFromPreEliteBrief({
        bookingRef: ref,
        fullName: pre.lastPayload.fullName,
        email: pre.lastPayload.email,
        itineraryData: pre.lastPayload.itineraryData,
      });
      setGuestBadge({
        name: (pre.lastPayload.fullName || "").trim() || "Guest Brief",
        email: (pre.lastPayload.email || "").trim().toLowerCase(),
      });
      return;
    }

    // Opening builder with an existing lead ref still advances draft → in_progress
    void import("@/lib/bookingLifecycle").then(({ requestAdvanceBookingInProgress }) =>
      requestAdvanceBookingInProgress(ref)
    );
  }, [searchParams]);

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
        // Seed a single default city only when the route is empty — nights
        // match Step 1 duration (no hardcoded Tokyo 5 + Kamakura 5).
        const after = useBuilderStore.getState();
        const middle = after.locations.filter(
          (l) =>
            !l.isTransitHub &&
            l.key !== "__transit_arrival__" &&
            l.key !== "__transit_departure__"
        );
        if (middle.length === 0 && data.cities[0]) {
          addLocation(data.cities[0].id);
          useBuilderStore
            .getState()
            .redistributeStayNights(
              useBuilderStore.getState().durationDays
            );
        } else if (middle.length > 0) {
          const assigned = middle.reduce((sum, l) => sum + (l.nights || 0), 0);
          if (assigned !== after.durationDays) {
            useBuilderStore
              .getState()
              .redistributeStayNights(after.durationDays);
          }
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
        brandEyebrow="TOKIOTOURS"
        brandTitle="Builder"
        expandOnHover
      />
      <div className={`${APP_SIDEBAR_RAIL_PAD} min-h-screen bg-transparent`}>
        <div className="builder-theme relative min-h-screen bg-transparent text-white [color-scheme:dark]">
          {/* Mobile-only top chrome — never shown on md+ (sidebar is primary) */}
          <header className="absolute inset-x-0 top-0 z-40 flex items-center gap-2 border-b border-white/10 bg-[#0D1117]/70 px-4 py-3 backdrop-blur-md lg:hidden">
            <MobileAppNav
              brandEyebrow="TOKIOTOURS"
              brandTitle="Builder"
            />
            <div className="min-w-0 flex-1" />
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-700/80 bg-zinc-900/90 px-4 py-2 font-godiva text-xs font-bold uppercase tracking-widest text-white shadow-lg transition-all hover:bg-[#075473] sm:text-sm"
              aria-label="TOKIOTOURS home"
            >
              TOKIOTOURS
            </Link>
          </header>

          <div className="relative bg-transparent">
            <BuilderHero branding={config?.branding ?? null} />

            {/* Transparent overlap — sits in the soft gradient (no solid edge / hard cut) */}
            <div className="relative z-20 -mt-20 w-full bg-transparent sm:-mt-28">
              <div className="px-3 pb-8 sm:px-4">
                <div className="tokio-glass-sheet mx-auto max-w-3xl rounded-t-3xl border border-white/10">
                  <div className="overflow-hidden rounded-t-3xl px-5 py-5 sm:px-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#F29727]">
                          Your Trip To
                        </p>
                        <h2 className="-mt-0.5 font-display text-[1.93rem] font-black text-white sm:text-[2.21rem]">
                          JAPAN
                        </h2>
                      </div>
                      <div className="shrink-0 space-y-0.5 text-right">
                        <p className="text-sm font-bold tracking-wide text-white sm:text-base">
                          {guestBadge.name}
                        </p>
                        {guestBadge.email ? (
                          <p className="max-w-[14rem] truncate text-xs font-semibold text-[#075473] sm:max-w-[18rem]">
                            {guestBadge.email}
                          </p>
                        ) : null}
                      </div>
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
                        defaultOpen={null}
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
                      onClick={() => {
                        const email =
                          guestBadge.email ||
                          useItineraryStore.getState().clientEmail ||
                          "";
                        const ref =
                          state.confirmedBookingRef ||
                          state.tempBookingRef ||
                          "";
                        if (email && ref) {
                          void import("@/lib/syncBookingLead").then(
                            ({ syncMultiDayBookingLead }) =>
                              syncMultiDayBookingLead({
                                bookingRef: ref,
                                email,
                                state: useBuilderStore.getState(),
                                cityNames,
                                status: "lead",
                                quote: quote
                                  ? { min: quote.min, max: quote.max }
                                  : null,
                              })
                          );
                        }
                      }}
                      className="no-print flex w-full flex-col items-center rounded-2xl border border-zinc-800 bg-[#121212] px-6 py-4 text-center shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-sm transition-colors hover:border-[#075473]/60"
                    >
                      <span className="text-base font-extrabold tracking-wide text-white">
                        ✨ VIEW / PRINT ITINERARY
                      </span>
                      <span className="mt-1 text-xs text-zinc-400">
                        Your trip is saved automatically.
                        {quote ? (
                          <>
                            {" · "}
                            <span className="text-[#075473]">
                              Est. {formatUsd(quote.min)}–{formatUsd(quote.max)}
                            </span>
                          </>
                        ) : null}
                      </span>
                    </Link>
                  ) : (
                    <div className="flex w-full flex-col items-center rounded-2xl border border-[#2C2C2E] bg-[#F6A724]/95 px-6 py-3.5 text-center shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm">
                      <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#075473]">
                        Estimate
                      </span>
                      {quote ? (
                        <span className="mt-1 flex flex-col items-center gap-0.5 text-sm text-[#F5EFE6]">
                          <span className="font-semibold">
                            {formatEstimateSummary({
                              min: quote.min,
                              max: quote.max,
                              conciergeActive:
                                state.isEliteConcierge ||
                                state.experienceService === "concierge",
                              conciergeFee: ELITE_CONCIERGE_FEE,
                            })}
                          </span>
                          {quote.min > 0 || quote.max > 0 ? (
                            <span className="font-normal text-zinc-300">
                              {state.isEliteConcierge ||
                              state.experienceService === "concierge"
                                ? "Elite Concierge design deposit included"
                                : "Selected options and experiences"}
                            </span>
                          ) : null}
                        </span>
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
              className="fixed bottom-[7.5rem] left-1/2 z-[110] w-[min(92vw,28rem)] -translate-x-1/2 rounded-xl border border-[#075473]/50 bg-[#1a1510] px-4 py-3 text-center text-sm text-[#F3D9C4] shadow-lg md:bottom-28"
            >
              {toast}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
