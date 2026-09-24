"use client";

import { useCallback, useState } from "react";
import { CITIES, HUBS, HOTEL_TIERS, ROOM_TYPES, TOUR_PACKAGES, TRANSIT_MODES } from "@/config/pricing-data";
import { calculateQuotation, formatUsd } from "@/lib/pricing-engine";
import { useItineraryStore, totalRooms } from "@/store/useItineraryStore";
import { ModuleShell } from "./ModuleShell";

export function ExportActions() {
  const state = useItineraryStore();
  const [showPrint, setShowPrint] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const quotation = calculateQuotation(state);

  const handlePrint = useCallback(() => {
    setShowPrint(true);
    // Allow modal to paint before print dialog
    requestAnimationFrame(() => {
      setTimeout(() => window.print(), 150);
    });
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitMsg(null);
    setSubmitError(null);
    try {
      const res = await fetch("/api/submit-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...state,
          quotation: {
            min: quotation.min,
            max: quotation.max,
            vehicles: quotation.vehicles,
            lines: quotation.lines,
          },
          submittedAt: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setSubmitMsg(
        data.message ||
          "Your request has been received. Our concierge team will respond shortly."
      );
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Unable to submit request."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <ModuleShell
        step={11}
        title="Export & Quotation Actions"
        description="Download a print-ready quotation or submit your preferences to our concierge desk."
      >
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="client-name"
              className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/45"
            >
              Full Name
            </label>
            <input
              id="client-name"
              value={state.clientName}
              onChange={(e) =>
                useItineraryStore.getState().setClientName(e.target.value)
              }
              className="w-full border border-white/15 bg-transparent px-3 py-2.5 text-sm text-white outline-none focus:border-[#D4AF37]"
              placeholder="Your name"
            />
          </div>
          <div>
            <label
              htmlFor="client-email"
              className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/45"
            >
              Email
            </label>
            <input
              id="client-email"
              type="email"
              value={state.clientEmail}
              onChange={(e) =>
                useItineraryStore.getState().setClientEmail(e.target.value)
              }
              className="w-full border border-white/15 bg-transparent px-3 py-2.5 text-sm text-white outline-none focus:border-[#D4AF37]"
              placeholder="you@example.com"
            />
          </div>
        </div>
        <div className="mb-6">
          <label
            htmlFor="client-notes"
            className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/45"
          >
            Notes
          </label>
          <textarea
            id="client-notes"
            rows={3}
            value={state.clientNotes}
            onChange={(e) =>
              useItineraryStore.getState().setClientNotes(e.target.value)
            }
            className="w-full border border-white/15 bg-transparent px-3 py-2.5 text-sm text-white outline-none focus:border-[#D4AF37]"
            placeholder="Special requests, dietary needs, celebration details…"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handlePrint}
            className="border border-[#D4AF37] bg-transparent px-6 py-3 text-sm tracking-[0.15em] text-[#D4AF37] uppercase transition hover:bg-[#D4AF37] hover:text-[#0B0B0C]"
          >
            Print / Download PDF
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !state.clientEmail}
            className="bg-[#D4AF37] px-6 py-3 text-sm tracking-[0.15em] text-[#0B0B0C] uppercase transition hover:bg-[#e0c04a] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Submitting…" : "Submit Request"}
          </button>
        </div>

        {submitMsg ? (
          <p className="mt-4 text-sm text-[#D4AF37]">{submitMsg}</p>
        ) : null}
        {submitError ? (
          <p className="mt-4 text-sm text-red-300">{submitError}</p>
        ) : null}
      </ModuleShell>

      {/* Print-ready modal — visible on screen when open; forced visible for print */}
      {showPrint ? (
        <div className="print-modal fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 no-print-hide">
          <div className="print-sheet relative my-8 w-full max-w-3xl bg-white p-10 text-[#111] shadow-2xl">
            <button
              type="button"
              onClick={() => setShowPrint(false)}
              className="absolute right-4 top-4 border border-[#111]/20 px-3 py-1 text-xs uppercase tracking-wider text-[#111] no-print"
            >
              Close
            </button>
            <PrintQuotationContent />
            <div className="mt-8 flex gap-3 no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="bg-[#111] px-5 py-2 text-sm text-white"
              >
                Print
              </button>
              <button
                type="button"
                onClick={() => setShowPrint(false)}
                className="border border-[#111]/30 px-5 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function PrintQuotationContent() {
  const state = useItineraryStore();
  const q = calculateQuotation(state);
  const tier = HOTEL_TIERS.find((t) => t.id === state.hotelTier);
  const transit = TRANSIT_MODES.find((t) => t.id === state.transitMode);
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <article className="print-content">
      <header className="border-b border-[#D4AF37] pb-6">
        <p className="text-[0.65rem] uppercase tracking-[0.4em] text-[#8a7420]">
          TOKIOTOURS
        </p>
        <h1 className="mt-2 font-display text-3xl text-[#111]">
          Japan Itinerary Quotation
        </h1>
        <p className="mt-1 text-sm text-[#555]">{date}</p>
        {state.clientName || state.clientEmail ? (
          <p className="mt-3 text-sm text-[#333]">
            Prepared for{" "}
            <strong>{state.clientName || "Valued Guest"}</strong>
            {state.clientEmail ? ` · ${state.clientEmail}` : ""}
          </p>
        ) : null}
      </header>

      <section className="mt-8 grid gap-4 text-sm sm:grid-cols-2">
        <PrintRow label="Duration" value={`${state.durationDays} days`} />
        <PrintRow
          label="Guests"
          value={`${state.totalGuests} (${state.adults} adults / ${state.children} children)`}
        />
        <PrintRow
          label="Arrival"
          value={HUBS.find((h) => h.id === state.arrivalHub)?.label ?? "—"}
        />
        <PrintRow
          label="Departure"
          value={HUBS.find((h) => h.id === state.departureHub)?.label ?? "—"}
        />
        <PrintRow
          label="Transfers"
          value={`Pickup: ${state.pickupTransfer ? "Yes" : "No"} · Drop-off: ${state.dropoffTransfer ? "Yes" : "No"}`}
        />
        <PrintRow
          label="Accommodation"
          value={
            state.needHotels
              ? `${tier?.label} · ${totalRooms(state.rooms)} rooms`
              : "Not required"
          }
        />
        <PrintRow label="Transit" value={transit?.label ?? "—"} />
        <PrintRow label="Vehicles" value={q.vehicles.summary} />
      </section>

      {state.needHotels ? (
        <section className="mt-6">
          <h3 className="border-b border-[#ddd] pb-2 font-display text-lg">
            Rooms
          </h3>
          <ul className="mt-2 space-y-1 text-sm">
            {state.rooms
              .filter((r) => r.count > 0)
              .map((r) => (
                <li key={r.type}>
                  {ROOM_TYPES.find((t) => t.id === r.type)?.label}: {r.count}
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-6">
        <h3 className="border-b border-[#ddd] pb-2 font-display text-lg">
          Cities & Nights
        </h3>
        <ul className="mt-2 space-y-1 text-sm">
          {state.cityNights.map((c) => (
            <li key={c.cityId}>
              {CITIES.find((x) => x.id === c.cityId)?.label}: {c.nights} night
              {c.nights === 1 ? "" : "s"}
            </li>
          ))}
        </ul>
      </section>

      {state.selectedTours.length > 0 ? (
        <section className="mt-6">
          <h3 className="border-b border-[#ddd] pb-2 font-display text-lg">
            Guided Tours
          </h3>
          <ul className="mt-2 space-y-1 text-sm">
            {state.selectedTours.map((id) => {
              const tour = TOUR_PACKAGES.find((t) => t.id === id);
              return tour ? <li key={id}>{tour.name}</li> : null;
            })}
          </ul>
          {state.privateChauffeur ? (
            <p className="mt-2 text-sm">Private chauffeur: Yes</p>
          ) : null}
        </section>
      ) : null}

      <section className="mt-8 border-t-2 border-[#D4AF37] pt-6">
        <p className="text-xs uppercase tracking-[0.3em] text-[#8a7420]">
          Estimated Price Range
        </p>
        <p className="mt-2 font-display text-4xl text-[#111]">
          {formatUsd(q.min)} – {formatUsd(q.max)}
        </p>
        <p className="mt-2 text-xs text-[#666]">
          This quotation is indicative and subject to seasonal availability,
          hotel confirmation, and final itinerary refinement by TOKIOTOURS
          Experiences.
        </p>
      </section>

      <section className="mt-6">
        <h3 className="border-b border-[#ddd] pb-2 font-display text-lg">
          Cost Breakdown
        </h3>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="text-[#666]">
              <th className="pb-2 font-normal">Item</th>
              <th className="pb-2 text-right font-normal">Min</th>
              <th className="pb-2 text-right font-normal">Max</th>
            </tr>
          </thead>
          <tbody>
            {q.lines.map((line) => (
              <tr key={line.label} className="border-t border-[#eee]">
                <td className="py-2 pr-4">{line.label}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatUsd(line.min)}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatUsd(line.max)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {state.clientNotes ? (
        <section className="mt-6">
          <h3 className="border-b border-[#ddd] pb-2 font-display text-lg">
            Client Notes
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-[#444]">
            {state.clientNotes}
          </p>
        </section>
      ) : null}

      <footer className="mt-10 border-t border-[#ddd] pt-4 text-xs text-[#888]">
        tokiotours-app.com · TOKIOTOURS
      </footer>
    </article>
  );
}

function PrintRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[#888]">
        {label}
      </p>
      <p className="mt-0.5 text-[#222]">{value}</p>
    </div>
  );
}
