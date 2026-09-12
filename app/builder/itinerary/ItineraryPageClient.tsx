"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, FileText, Plane } from "lucide-react";
import {
  fetchBuilderConfig,
  type BuilderConfig,
} from "@/lib/pocketbase/client";
import { calculateBuilderQuote, formatUsd } from "@/lib/builder-pricing";
import { submitBookingRequest } from "@/lib/bookingRequest";
import { calculateCityDateRanges } from "@/lib/dateCascade";
import { allocateFleet } from "@/lib/vehicleAllocator";
import { useBuilderStore } from "@/store/useBuilderStore";
import { BottomNav } from "@/components/builder/BottomNav";
import { PrintItineraryDocument } from "@/components/builder/PrintItineraryDocument";
import {
  TravelDossierView,
  resolveHub,
} from "@/components/builder/TravelDossierView";

type ViewMode = "dossier" | "invoice";

export default function ItineraryPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = useBuilderStore();
  const departureDate = useBuilderStore((s) => s.departureDate);
  const [config, setConfig] = useState<BuilderConfig | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("dossier");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  useEffect(() => {
    useBuilderStore.persist.rehydrate();
    fetchBuilderConfig().then(setConfig).catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    const v = searchParams.get("view");
    if (v === "invoice" || v === "print") setViewMode("invoice");
    if (v === "dossier") setViewMode("dossier");
  }, [searchParams]);

  const quote = useMemo(
    () => (config ? calculateBuilderQuote(state, config) : null),
    [config, state]
  );

  const totalPax = state.adults + state.children;
  const depIso = departureDate();

  const arrivalHub = resolveHub(config, state.arrivalTransferId);
  const departureHub = resolveHub(config, state.departureTransferId);

  const dateRanges = useMemo(
    () => calculateCityDateRanges(state.arrivalDate, state.locations),
    [state.arrivalDate, state.locations]
  );

  const fleetLabel = useMemo(() => {
    if (!config?.vehicles?.length || totalPax <= 0) return null;
    const fleet = allocateFleet(totalPax, config.vehicles);
    if (!fleet.units.length) return null;
    return `${fleet.label.replace("×", "x")} (${totalPax} pax)`;
  }, [config?.vehicles, totalPax]);

  const setMode = (mode: ViewMode) => {
    setViewMode(mode);
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", mode);
    router.replace(`/builder/itinerary?${params.toString()}`, {
      scroll: false,
    });
  };

  const handleRequestPay = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitBookingRequest({
        state,
        quote,
        departureDate: depIso,
      });
      setSubmittedRef(result.reference);
    } catch (e) {
      setSubmitError(
        e instanceof Error
          ? e.message
          : "Could not submit booking request. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="builder-theme min-h-screen bg-[#F5F0E8] pb-36 text-[#0B1F3A] md:pb-32">
      <header className="no-print border-b border-[#E8E2D9] bg-[#FBF8F2] px-4 py-5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#C4A35A]">
          My Itinerary
        </p>
        <h1 className="mt-1 font-display text-3xl">Your Japan Journey</h1>
        <p className="mt-1 text-sm text-[#8A8278]">
          Switch between travel dossier and private quotation.
        </p>

        <div
          className="mt-4 inline-flex rounded-full border border-[#E8E2D9] bg-white p-1 shadow-sm"
          role="tablist"
          aria-label="Itinerary view"
        >
          <ToggleBtn
            active={viewMode === "dossier"}
            onClick={() => setMode("dossier")}
            icon={<Plane className="h-3.5 w-3.5" />}
            label="Travel Dossier"
          />
          <ToggleBtn
            active={viewMode === "invoice"}
            onClick={() => setMode("invoice")}
            icon={<FileText className="h-3.5 w-3.5" />}
            label="Invoice / Print"
          />
        </div>

        {viewMode === "invoice" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/builder"
              className="rounded-full border border-[#D9D2C7] bg-white px-4 py-2 text-sm font-semibold text-[#0B1F3A]"
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
        ) : (
          <div className="mt-4">
            <Link
              href="/builder"
              className="inline-flex rounded-full border border-[#0B1F3A]/20 bg-white px-4 py-2.5 text-sm font-semibold text-[#0B1F3A]"
            >
              Continue editing
            </Link>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {viewMode === "dossier" ? (
          <TravelDossierView
            state={state}
            config={config}
            departureIso={depIso}
            dateRanges={dateRanges}
            fleetLabel={fleetLabel}
            arrivalHub={arrivalHub}
            departureHub={departureHub}
          />
        ) : (
          <div className="print-document rounded-2xl border border-[#E8E2D9] bg-white px-4 py-6 sm:px-6">
            <PrintItineraryDocument embedded showToolbar={false} />
          </div>
        )}
      </main>

      <div className="no-print sticky-action-bar fixed inset-x-0 bottom-[3.75rem] z-30 px-3 pb-2 md:bottom-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-2xl bg-[#0B1F3A] px-4 py-3 shadow-[0_12px_40px_rgba(11,31,58,0.4)] sm:px-5 sm:py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-[#C4A35A]">
              Grand Total
            </p>
            <p className="truncate font-display text-lg text-white sm:text-xl">
              {quote
                ? `Est. ${formatUsd(quote.min)} – ${formatUsd(quote.max)}`
                : "Calculating…"}
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={handleRequestPay}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#C4A35A] px-3.5 py-2.5 text-sm font-semibold text-[#0B1F3A] transition hover:bg-[#d4b56a] disabled:opacity-60 sm:px-5 sm:py-3"
          >
            {submitting ? "Submitting…" : "Request & Pay"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        {submitError ? (
          <p className="mx-auto mt-2 max-w-3xl rounded-lg bg-red-50 px-3 py-2 text-center text-xs text-red-700">
            {submitError}
          </p>
        ) : null}
      </div>

      {submittedRef ? (
        <div className="no-print fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#C4A35A]">
              Request received
            </p>
            <h2 className="mt-2 font-display text-2xl text-[#0B1F3A]">
              Booking {submittedRef}
            </h2>
            <p className="mt-2 text-sm text-[#5C6570]">
              Your itinerary was saved. An Elite Travel consultant will confirm
              the 30% deposit and final quotation shortly. Stripe checkout can
              be completed once your deposit link is issued.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setSubmittedRef(null);
                  setMode("invoice");
                }}
                className="flex-1 rounded-full bg-[#0B1F3A] py-2.5 text-sm font-semibold text-white"
              >
                View quotation
              </button>
              <button
                type="button"
                onClick={() => setSubmittedRef(null)}
                className="flex-1 rounded-full border border-[#D9D2C7] py-2.5 text-sm font-semibold text-[#0B1F3A]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="no-print">
        <BottomNav />
      </div>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition sm:text-sm ${
        active
          ? "bg-[#0B1F3A] text-white"
          : "text-[#5C6570] hover:text-[#0B1F3A]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
