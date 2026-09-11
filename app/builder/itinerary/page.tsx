"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  fetchBuilderConfig,
  transferLocation,
  tourPrice,
  type BuilderConfig,
} from "@/lib/pocketbase/client";
import {
  calculateBuilderQuote,
  formatUsd,
} from "@/lib/builder-pricing";
import { useBuilderStore } from "@/store/useBuilderStore";
import { BottomNav } from "@/components/builder/BottomNav";

export default function ItineraryPage() {
  const state = useBuilderStore();
  const [config, setConfig] = useState<BuilderConfig | null>(null);

  useEffect(() => {
    useBuilderStore.persist.rehydrate();
    fetchBuilderConfig().then(setConfig).catch(() => setConfig(null));
  }, []);

  const quote = useMemo(
    () => (config ? calculateBuilderQuote(state, config) : null),
    [config, state]
  );

  const cityName = (id: string) =>
    config?.cities.find((c) => c.id === id)?.name ?? id;

  const arrival = config?.transfers.find(
    (t) => t.id === state.arrivalTransferId
  );
  const departure = config?.transfers.find(
    (t) => t.id === state.departureTransferId
  );
  const transit = config?.transitModes.find(
    (t) => t.id === state.transitModeId
  );

  return (
    <div className="builder-theme min-h-screen bg-[#F5F0E8] pb-28 text-[#0B1F3A]">
      <header className="border-b border-[#E8E2D9] bg-[#FBF8F2] px-4 py-5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#C4A35A]">
          My Itinerary
        </p>
        <h1 className="mt-1 font-display text-3xl">Your Japan Journey</h1>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <Card title="Overview">
          <Row label="Duration" value={`${state.durationDays} days`} />
          <Row
            label="Guests"
            value={`${state.adults + state.children} (${state.adults} adults, ${state.children} children)`}
          />
          <Row label="Arrival" value={arrival ? transferLocation(arrival) : "—"} />
          <Row
            label="Departure"
            value={departure ? transferLocation(departure) : "—"}
          />
          <Row
            label="Pickup / Drop-off"
            value={`${state.airportPickup ? "Yes" : "No"} / ${state.airportDropoff ? "Yes" : "No"}`}
          />
          <Row
            label="Hotels"
            value={
              state.needHotels
                ? `${state.hotelTier} · ${state.roomCount}× ${state.roomType}`
                : "Not required"
            }
          />
          <Row label="Transit" value={transit?.label ?? "—"} />
          <Row label="Driver" value={state.needDriver ? "Yes" : "No"} />
        </Card>

        <Card title="Route">
          {state.locations.length === 0 ? (
            <p className="text-sm text-[#8A8278]">No locations yet.</p>
          ) : (
            <ol className="space-y-3">
              {state.locations.map((loc, i) => (
                <li
                  key={loc.key}
                  className="flex items-center justify-between border-b border-[#EEE8DF] pb-2"
                >
                  <span>
                    <span className="mr-2 text-xs text-[#C4A35A]">
                      {i + 1}.
                    </span>
                    {cityName(loc.cityId)}
                  </span>
                  <span className="text-sm text-[#5C6570]">
                    {loc.nights} nights
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card title="Tours">
          {state.selectedTourIds.length === 0 ? (
            <p className="text-sm text-[#8A8278]">No tours selected.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {state.selectedTourIds.map((id) => {
                const tour = config?.tours.find((t) => t.id === id);
                return (
                  <li key={id} className="flex justify-between gap-3">
                    <span>{tour?.title ?? id}</span>
                    <span className="text-[#5C6570]">
                      {tour ? formatUsd(tourPrice(tour)) : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {quote ? (
          <Card title="Estimate">
            <p className="font-display text-3xl text-[#0B1F3A]">
              {formatUsd(quote.min)} – {formatUsd(quote.max)}
            </p>
            <p className="mt-1 text-sm text-[#8A8278]">
              Vehicles: {quote.vehiclesNeeded}
            </p>
          </Card>
        ) : null}

        <Link
          href="/builder"
          className="block rounded-full border border-[#0B1F3A] py-3 text-center text-sm font-semibold"
        >
          ← Back to Builder
        </Link>
      </main>
      <BottomNav />
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#E8E2D9] bg-white p-5">
      <h2 className="mb-3 font-display text-xl">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#F3EEE6] py-2 text-sm last:border-0">
      <span className="text-[#8A8278]">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
