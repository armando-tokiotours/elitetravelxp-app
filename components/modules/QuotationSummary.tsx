"use client";

import { useState } from "react";
import { CITIES, HUBS, HOTEL_TIERS, TRANSIT_MODES } from "@/config/pricing-data";
import { calculateQuotation, formatUsd } from "@/lib/pricing-engine";
import { useItineraryStore, totalRooms } from "@/store/useItineraryStore";

export function QuotationSummary() {
  const state = useItineraryStore();
  const quotation = calculateQuotation(state);
  const [expanded, setExpanded] = useState(false);

  const arrival = HUBS.find((h) => h.id === state.arrivalHub);
  const departure = HUBS.find((h) => h.id === state.departureHub);
  const tier = HOTEL_TIERS.find((t) => t.id === state.hotelTier);
  const transit = TRANSIT_MODES.find((t) => t.id === state.transitMode);

  const body = (
    <>
      <dl className="mt-6 space-y-3 border-b border-white/10 pb-6 text-sm">
        <Row label="Duration" value={`${state.durationDays} days`} />
        <Row
          label="Guests"
          value={`${state.totalGuests} (${state.adults} adults, ${state.children} children)`}
        />
        <Row
          label="Cities"
          value={
            state.cityNights.length
              ? state.cityNights
                  .map(
                    (c) =>
                      `${CITIES.find((x) => x.id === c.cityId)?.label} (${c.nights}n)`
                  )
                  .join(", ")
              : "—"
          }
        />
        <Row
          label="Hotels"
          value={
            state.needHotels
              ? `${tier?.label} · ${totalRooms(state.rooms)} rooms`
              : "Not required"
          }
        />
        <Row label="Arrival" value={arrival?.short ?? "—"} />
        <Row label="Departure" value={departure?.short ?? "—"} />
        <Row
          label="Transit"
          value={transit?.label.split("(")[0].trim() ?? "—"}
        />
        <Row label="Vehicles" value={quotation.vehicles.summary} />
        <Row label="Tours" value={`${state.selectedTours.length} selected`} />
      </dl>

      {!quotation.nightsValid ? (
        <p className="mt-4 text-xs leading-relaxed text-red-300">
          Adjust night allocation so total nights equal {quotation.nightsRequired}{" "}
          for a {state.durationDays}-day trip.
        </p>
      ) : null}

      <div className="mt-6">
        <p className="text-[0.65rem] uppercase tracking-[0.3em] text-white/40">
          Estimated Range
        </p>
        <p className="mt-2 font-display text-3xl tracking-wide text-[#D4AF37] sm:text-4xl">
          {formatUsd(quotation.min)}
          <span className="mx-2 text-xl text-white/30">–</span>
          {formatUsd(quotation.max)}
        </p>
        <p className="mt-2 text-xs text-white/40">
          Indicative USD estimate. Final quotation subject to availability.
        </p>
      </div>

      <details className="mt-6 group">
        <summary className="cursor-pointer list-none text-xs uppercase tracking-[0.2em] text-white/50 transition hover:text-[#D4AF37]">
          <span className="group-open:hidden">View breakdown ▸</span>
          <span className="hidden group-open:inline">Hide breakdown ▾</span>
        </summary>
        <ul className="mt-4 max-h-56 space-y-2 overflow-y-auto text-xs text-white/55">
          {quotation.lines.map((line) => (
            <li
              key={line.label}
              className="flex justify-between gap-3 border-b border-white/5 pb-2"
            >
              <span className="leading-snug">{line.label}</span>
              <span className="shrink-0 tabular-nums text-white/70">
                {formatUsd(line.min)}–{formatUsd(line.max)}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </>
  );

  return (
    <>
      {/* Desktop sticky card */}
      <aside className="quotation-card hidden border border-[#D4AF37]/30 bg-[#0F0F11]/95 p-6 shadow-[0_0_60px_rgba(212,175,55,0.06)] backdrop-blur-md lg:block lg:sticky lg:top-8">
        <p className="text-[0.65rem] uppercase tracking-[0.35em] text-[#D4AF37]">
          Live Quotation
        </p>
        <h2 className="mt-2 font-display text-2xl text-white">
          Estimate Summary
        </h2>
        {body}
      </aside>

      {/* Mobile bottom bar */}
      <aside className="quotation-card border border-[#D4AF37]/30 bg-[#0F0F11] lg:hidden">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between gap-4 p-4 text-left"
        >
          <div>
            <p className="text-[0.6rem] uppercase tracking-[0.3em] text-[#D4AF37]">
              Live Quotation
            </p>
            <p className="mt-1 font-display text-xl text-[#D4AF37]">
              {formatUsd(quotation.min)} – {formatUsd(quotation.max)}
            </p>
          </div>
          <span className="text-xs text-white/50">
            {expanded ? "Collapse" : "Details"}
          </span>
        </button>
        {expanded ? <div className="max-h-[55vh] overflow-y-auto px-4 pb-4">{body}</div> : null}
      </aside>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-white/40">{label}</dt>
      <dd className="text-right text-white/85">{value}</dd>
    </div>
  );
}
