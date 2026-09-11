"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  fetchBuilderConfig,
  transferLocation,
  tourPrice,
  type BuilderConfig,
  type PbHub,
  type PbTransfer,
} from "@/lib/pocketbase/client";
import { calculateBuilderQuote, formatUsd } from "@/lib/builder-pricing";
import {
  formatDisplayDate,
  useBuilderStore,
} from "@/store/useBuilderStore";

/** Formal luxury quotation / print document from persisted builder state. */
export function PrintItineraryDocument() {
  const state = useBuilderStore();
  const departureDate = useBuilderStore((s) => s.departureDate);
  const [config, setConfig] = useState<BuilderConfig | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    useBuilderStore.persist.rehydrate();
    setReady(true);
    fetchBuilderConfig().then(setConfig).catch(() => setConfig(null));
  }, []);

  const quote = useMemo(
    () => (config ? calculateBuilderQuote(state, config) : null),
    [config, state]
  );

  const cityName = (id: string) =>
    config?.cities.find((c) => c.id === id)?.name ?? id;

  const arrival =
    config?.hubs.find((h) => h.id === state.arrivalTransferId) ||
    config?.transfers.find((t) => t.id === state.arrivalTransferId);
  const departure =
    config?.hubs.find((h) => h.id === state.departureTransferId) ||
    config?.transfers.find((t) => t.id === state.departureTransferId);
  const transit = config?.transitModes.find(
    (t) => t.id === state.transitModeId
  );

  if (!ready) {
    return (
      <p className="p-10 text-center text-sm text-[#8A8278]">
        Loading itinerary…
      </p>
    );
  }

  return (
    <div className="print-document min-h-screen bg-[#F5F0E8] text-[#0B1F3A]">
      <div className="no-print border-b border-[#E8E2D9] bg-[#FBF8F2] px-4 py-4">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#C4A35A]">
              Elite Travel Experiences
            </p>
            <h1 className="font-display text-2xl">View / Print Itinerary</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/builder"
              className="rounded-full border border-[#D9D2C7] px-4 py-2 text-sm"
            >
              ← Edit builder
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-full bg-[#0B1F3A] px-5 py-2 text-sm font-semibold text-white"
            >
              Print / Save PDF
            </button>
          </div>
        </div>
      </div>

      <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6 print:max-w-none print:px-0 print:py-0">
        <header className="border-b border-[#C4A35A]/40 pb-6 text-center">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.4em] text-[#C4A35A]">
            Private Quotation
          </p>
          <h2 className="mt-2 font-display text-4xl text-[#0B1F3A]">
            Japan Journey Design
          </h2>
          <p className="mt-2 text-sm text-[#8A8278]">
            Prepared for your review ·{" "}
            {new Date().toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </header>

        <section className="mt-8 grid gap-6 sm:grid-cols-2">
          <Block title="Travel window">
            <Line label="Duration" value={`${state.durationDays} days`} />
            <Line
              label="Arrival date"
              value={formatDisplayDate(state.arrivalDate)}
            />
            <Line
              label="Departure date"
              value={formatDisplayDate(departureDate())}
            />
          </Block>
          <Block title="Arrival & departure hubs">
            <Line
              label="Arrive"
              value={
                arrival
                  ? "name" in arrival
                    ? `${(arrival as PbHub).name}${
                        state.arrivalMode === "cruise" ? " · Cruise" : " · Flight"
                      }`
                    : transferLocation(arrival as PbTransfer)
                  : "—"
              }
            />
            <Line
              label="Depart"
              value={
                departure
                  ? "name" in departure
                    ? `${(departure as PbHub).name}${
                        state.departureMode === "cruise"
                          ? " · Cruise"
                          : " · Flight"
                      }`
                    : transferLocation(departure as PbTransfer)
                  : "—"
              }
            />
            <Line
              label="Pickup"
              value={state.airportPickup ? "Yes" : "No"}
            />
            <Line
              label="Drop-off"
              value={state.airportDropoff ? "Yes" : "No"}
            />
          </Block>
        </section>

        <section className="mt-6">
          <Block title="Guests & accommodation">
            <Line
              label="Guests"
              value={`${state.adults + state.children} (${state.adults} adults, ${state.children} children)`}
            />
            <Line
              label="Hotels"
              value={
                state.needHotels
                  ? `${state.hotelTier} · ${state.roomCount}× ${state.roomType}`
                  : "Not required"
              }
            />
            <Line label="Inter-city transit" value={transit?.label ?? "—"} />
            <Line
              label="Private chauffeur"
              value={state.needDriver ? "Requested" : "Not requested"}
            />
          </Block>
        </section>

        <section className="mt-6">
          <h3 className="font-display text-2xl text-[#0B1F3A]">
            Route & nights
          </h3>
          {state.locations.length === 0 ? (
            <p className="mt-2 text-sm text-[#8A8278]">No cities selected yet.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {state.locations.map((loc, i) => (
                <li
                  key={loc.key}
                  className="flex items-baseline justify-between border-b border-[#EEE8DF] py-2 text-sm"
                >
                  <span>
                    <span className="mr-2 text-[#C4A35A]">{i + 1}.</span>
                    {cityName(loc.cityId)}
                  </span>
                  <span className="text-[#8A8278]">
                    {loc.nights} night{loc.nights === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="mt-6">
          <h3 className="font-display text-2xl text-[#0B1F3A]">
            Guided experiences
          </h3>
          {state.selectedTourIds.length === 0 ? (
            <p className="mt-2 text-sm text-[#8A8278]">No tours selected yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {state.selectedTourIds.map((id) => {
                const tour = config?.tours.find((t) => t.id === id);
                return (
                  <li
                    key={id}
                    className="flex justify-between border-b border-[#EEE8DF] py-2 text-sm"
                  >
                    <span>
                      {tour?.title ?? id}
                      {tour ? (
                        <span className="mt-0.5 block text-xs text-[#8A8278]">
                          {cityName(tour.city_id)}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-[#0B1F3A]">
                      {tour ? formatUsd(tourPrice(tour)) : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {quote ? (
          <section className="mt-8 rounded-2xl border border-[#C4A35A]/45 bg-[#FBF6EA] p-6 text-center print:border print:bg-white">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#C4A35A]">
              Estimated investment
            </p>
            <p className="mt-2 font-display text-3xl text-[#0B1F3A]">
              {formatUsd(quote.min)} – {formatUsd(quote.max)}
            </p>
            <p className="mt-2 text-xs text-[#8A8278]">
              Indicative range based on current Source of Truth pricing. Final
              quotation confirmed by your Elite Travel consultant.
            </p>
          </section>
        ) : null}

        <footer className="mt-10 border-t border-[#E8E2D9] pt-6 text-center text-xs text-[#8A8278]">
          <p className="font-display text-lg text-[#0B1F3A]">
            Elite Travel Experiences
          </p>
          <p className="mt-1">travelexperiencesgroup.com</p>
          <p className="mt-3">
            This document reflects your saved trip builder selections. A 30%
            deposit may be required to secure guides and rooms once flights are
            confirmed.
          </p>
        </footer>
      </article>
    </div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#E8E2D9] bg-white p-4 print:border print:shadow-none">
      <h3 className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#C4A35A]">
        {title}
      </h3>
      <dl className="space-y-2">{children}</dl>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-[#8A8278]">{label}</dt>
      <dd className="text-right font-medium text-[#0B1F3A]">{value}</dd>
    </div>
  );
}
