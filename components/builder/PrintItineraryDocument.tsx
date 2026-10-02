"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  fetchBuilderConfig,
  type BuilderConfig,
} from "@/lib/pocketbase/client";
import { formatDisplayDate, useBuilderStore } from "@/store/useBuilderStore";
import { useItineraryStore } from "@/store/useItineraryStore";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";
import { travelPaceLabel } from "@/lib/travelPace";
import { BookingRefBadge } from "@/components/builder/BookingRefBadge";
import { activeBookingRef } from "@/utils/pnr";
import { ELITE_CONCIERGE_FEE } from "@/lib/eliteConcierge";
import { getConciergeFeeCreditEur } from "@/lib/feeCredit";
import { ItemizedInvoiceTable } from "@/components/invoice/ItemizedInvoiceTable";
import { buildMultiDayInvoiceItems } from "@/lib/itemizedInvoice";
import {
  mergeInvoiceWithAgentServices,
  type ServiceLineItem,
} from "@/lib/agentServices";

/**
 * Multi-day INVOICE tab — formal itemized financial estimate (no visual timeline).
 */
export function PrintItineraryDocument({
  embedded = false,
  showToolbar = true,
  onPrintRequest,
  feeCreditEur,
  finalApprovedPrice = null,
}: {
  embedded?: boolean;
  showToolbar?: boolean;
  onPrintRequest?: () => void;
  feeCreditEur?: number;
  finalApprovedPrice?: number | null;
} = {}) {
  const state = useBuilderStore();
  const departureDate = useBuilderStore((s) => s.departureDate);
  const [config, setConfig] = useState<BuilderConfig | null>(null);
  const [ready, setReady] = useState(false);
  const [agentServices, setAgentServices] = useState<ServiceLineItem[]>([]);
  const [approvedFromServer, setApprovedFromServer] = useState<number | null>(
    null
  );

  const clientName = useItineraryStore((s) => s.clientName);
  const preName = usePreBuilderStore(
    (s) => s.fullName || s.lastPayload?.fullName || ""
  );
  const guestName = (clientName || preName || "").trim() || "Guest";

  const pnr = activeBookingRef({
    tempBookingRef: state.tempBookingRef,
    confirmedBookingRef: state.confirmedBookingRef,
    bookingStatus: state.bookingStatus,
  });
  const creditEur =
    feeCreditEur != null && feeCreditEur > 0
      ? feeCreditEur
      : getConciergeFeeCreditEur(pnr);

  useEffect(() => {
    useBuilderStore.persist.rehydrate();
    setReady(true);
    fetchBuilderConfig({ includeAccommodations: true })
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    const ref = String(pnr || "").trim();
    if (!ref || ref.startsWith("TMP-")) {
      setAgentServices([]);
      setApprovedFromServer(null);
      return;
    }
    let cancelled = false;
    const load = () => {
      void fetch(`/api/bookings/agent-services?pnr=${encodeURIComponent(ref)}`, {
        cache: "no-store",
      })
        .then((r) => (r.ok ? r.json() : null))
        .then(
          (data: {
            services?: ServiceLineItem[];
            finalApprovedPrice?: number | null;
          } | null) => {
            if (cancelled || !data) return;
            setAgentServices(data.services || []);
            setApprovedFromServer(
              data.finalApprovedPrice != null &&
                Number.isFinite(Number(data.finalApprovedPrice))
                ? Math.round(Number(data.finalApprovedPrice))
                : null
            );
          }
        )
        .catch(() => {
          /* ignore */
        });
    };
    load();
    const t = window.setInterval(load, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [pnr]);

  const baseItems = useMemo(
    () => buildMultiDayInvoiceItems(state, config),
    [state, config]
  );
  const items = useMemo(
    () => mergeInvoiceWithAgentServices(baseItems, agentServices),
    [baseItems, agentServices]
  );

  const lockedApproved =
    finalApprovedPrice != null && Number.isFinite(finalApprovedPrice)
      ? Math.round(finalApprovedPrice)
      : approvedFromServer;

  const totalGuests = Math.max(1, state.adults + state.children);
  const pace = travelPaceLabel(state.travelPace);

  if (!ready) {
    return (
      <p className="p-10 text-center text-sm text-zinc-500">
        Loading itinerary…
      </p>
    );
  }

  return (
    <div
      id="itinerary-invoice-content"
      className={`print-document text-white ${
        embedded ? "" : "min-h-screen bg-[#05080C]"
      }`}
    >
      {!embedded && showToolbar ? (
        <div className="no-print border-b border-white/10 bg-[#0D1117] px-4 py-4">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#F6A724]">
                TOKIOTOURS
              </p>
              <h1 className="font-display text-2xl text-white">
                Estimated Quotation
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/builder"
                className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80"
              >
                ← Edit builder
              </Link>
              <button
                type="button"
                onClick={() =>
                  onPrintRequest
                    ? onPrintRequest()
                    : (window.location.href =
                        "/builder/itinerary?view=invoice")
                }
                className="rounded-full bg-[#075473] px-5 py-2 text-sm font-semibold text-white"
              >
                Send / Save PDF
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <article
        className={
          embedded
            ? "space-y-5 print:max-w-none"
            : "mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6"
        }
      >
        <div className="no-print">
          <BookingRefBadge
            tempBookingRef={state.tempBookingRef}
            confirmedBookingRef={state.confirmedBookingRef}
            bookingStatus={state.bookingStatus}
            variant="inline"
          />
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Meta
            label="Travel window"
            value={`${formatDisplayDate(state.arrivalDate)} – ${formatDisplayDate(departureDate())}`}
          />
          <Meta
            label="Duration"
            value={`${state.durationDays} day${state.durationDays === 1 ? "" : "s"}`}
          />
          <Meta
            label="Party"
            value={`${state.adults} adult${state.adults === 1 ? "" : "s"}${
              state.children
                ? `, ${state.children} child${state.children === 1 ? "" : "ren"}`
                : ""
            }`}
          />
          {pace ? <Meta label="Travel pace" value={pace} /> : null}
        </dl>

        <ItemizedInvoiceTable
          pnr={pnr}
          guestName={guestName}
          partySize={totalGuests}
          items={items}
          conciergeFeePaid={creditEur > 0}
          conciergeFeeAmount={creditEur > 0 ? creditEur : ELITE_CONCIERGE_FEE}
          finalApprovedPrice={lockedApproved}
        />
      </article>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
      <dt className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-white/40">
        {label}
      </dt>
      <dd className="mt-0.5 font-semibold text-white">{value}</dd>
    </div>
  );
}
