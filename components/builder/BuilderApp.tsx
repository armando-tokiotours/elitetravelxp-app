"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  fetchBuilderConfig,
  type BuilderConfig,
} from "@/lib/pocketbase/client";
import {
  calculateBuilderQuote,
  formatUsd,
} from "@/lib/builder-pricing";
import { useBuilderStore } from "@/store/useBuilderStore";
import { ArrivalDepartureSection } from "./ArrivalDepartureSection";
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

        // Sensible defaults once config loads (only if empty)
        const snap = useBuilderStore.getState();
        if (!snap.arrivalTransferId && data.transfers[0]) {
          setArrival(data.transfers[0].id);
        }
        if (!snap.departureTransferId && data.transfers[1]) {
          setDeparture(data.transfers[1]?.id ?? data.transfers[0].id);
        }
        if (!snap.transitModeId && data.transitModes[0]) {
          setTransit(data.transitModes[0].id);
        }
        if (snap.locations.length === 0 && data.cities.length >= 2) {
          addLocation(data.cities[0].id);
          addLocation(data.cities[1].id);
          // Set nights to match default 10-day trip after adds
          const keys = useBuilderStore.getState().locations;
          if (keys[0]) useBuilderStore.getState().setLocationNights(keys[0].key, 5);
          if (keys[1]) useBuilderStore.getState().setLocationNights(keys[1].key, 5);
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

  return (
    <div className="builder-theme relative min-h-screen bg-[#F5F0E8] text-[#0B1F3A]">
      <SakuraBackdrop />

      <header className="relative z-10 border-b border-[#E8E2D9]/80 bg-[#FBF8F2]/85 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 pb-4 pt-5 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#C4A35A]">
                Elite Travel Experiences Group
              </p>
              <h1 className="mt-1 font-display text-3xl leading-tight text-[#0B1F3A] sm:text-4xl">
                Build Your Japan Journey
              </h1>
            </div>
            <LogoMark />
          </div>
          <ProgressBar />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-4 pb-40 pt-6 sm:px-6">
        {loading ? (
          <p className="rounded-2xl bg-white/70 p-8 text-center text-sm text-[#8A8278]">
            Loading your trip builder…
          </p>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-white p-6 text-sm text-red-700">
            <p className="font-semibold">PocketBase unavailable</p>
            <p className="mt-2 text-[#5C6570]">{error}</p>
            <p className="mt-3 text-xs text-[#8A8278]">
              Start the backend with{" "}
              <code className="rounded bg-[#F5F0E8] px-1">
                npm run pb
              </code>{" "}
              then{" "}
              <code className="rounded bg-[#F5F0E8] px-1">
                npm run pb:seed
              </code>
              .
            </p>
          </div>
        ) : config ? (
          <div className="flex flex-col gap-4">
            <TripDurationSection />
            <ArrivalDepartureSection transfers={config.transfers} />
            <HotelsGuestsSection accommodations={config.accommodations} />
            <LocationsNightsSection
              cities={config.cities}
              transitModes={config.transitModes}
            />
            <ToursDriverSection tours={config.tours} cityNames={cityNames} />
          </div>
        ) : null}
      </main>

      {/* Sticky CTA */}
      <div className="fixed inset-x-0 bottom-[3.75rem] z-30 px-4 pb-2 md:bottom-6">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/builder/itinerary"
            className="flex w-full flex-col items-center rounded-2xl bg-[#0B1F3A] px-6 py-4 text-center shadow-[0_12px_40px_rgba(11,31,58,0.35)] transition hover:bg-[#143052]"
          >
            <span className="text-base font-semibold tracking-wide text-white">
              ✨ VIEW YOUR ITINERARY
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
  );
}

function LogoMark() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#C4A35A]/50 bg-white shadow-sm">
      <span className="font-display text-lg text-[#C4A35A]">ET</span>
    </div>
  );
}

function SakuraBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        className="absolute -right-8 -top-4 h-48 w-48 text-[#C4A35A]/20"
        viewBox="0 0 200 200"
        fill="none"
      >
        <path
          d="M100 40c8 18 28 28 28 28s-10 20-8 38c2 18-20 34-20 34s-22-16-20-34c2-18-8-38-8-38s20-10 28-28z"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <path
          d="M60 90c12 10 18 28 18 28s-18 12-28 24c-10 12-32 8-32 8s4-22 14-34c10-12 28-18 28-18z"
          stroke="currentColor"
          strokeWidth="1.1"
        />
        <circle cx="150" cy="70" r="3" fill="currentColor" opacity="0.5" />
        <circle cx="40" cy="50" r="2" fill="currentColor" opacity="0.4" />
      </svg>
      <svg
        className="absolute -left-6 top-40 h-40 w-40 text-[#C4A35A]/15"
        viewBox="0 0 200 200"
        fill="none"
      >
        <path
          d="M100 30c10 22 35 34 35 34s-12 24-10 46 24 42 24 42-28-18-26-42 10-46 10-46-25-12-33-34z"
          stroke="currentColor"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}
