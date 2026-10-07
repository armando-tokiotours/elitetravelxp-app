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
import { DEFAULT_CONCIERGE_FEE_EUR } from "@/lib/conciergeEstimateFlow";
import { getConciergeFeeCreditEur } from "@/lib/feeCredit";
import {
  ItemizedInvoiceTable,
  invoicePackageRangeEur,
  toFlatInvoiceRow,
} from "@/components/invoice/ItemizedInvoiceTable";
import {
  InvoiceBriefEstimateBox,
  InvoiceMetaList,
  InvoiceMetaRow,
} from "@/components/invoice/InvoiceBriefChrome";
import { MobileDossierLayout } from "@/components/guest/MobileDossierLayout";
import { FlatInvoiceBrief } from "@/components/ops/FlatInvoiceBrief";
import { formatEur } from "@/lib/singleDayPricing";
import { buildMultiDayInvoiceItems } from "@/lib/itemizedInvoice";
import {
  resolveGuestInvoiceItems,
  type PriceMode,
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
  totalPaidEur,
  finalApprovedPrice = null,
}: {
  embedded?: boolean;
  showToolbar?: boolean;
  onPrintRequest?: () => void;
  feeCreditEur?: number;
  totalPaidEur?: number;
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
  const [priceModeFromServer, setPriceModeFromServer] =
    useState<PriceMode | null>(null);

  const clientName = useItineraryStore((s) => s.clientName);
  const clientEmail = useItineraryStore((s) => s.clientEmail);
  const preName = usePreBuilderStore(
    (s) => s.fullName || s.lastPayload?.fullName || ""
  );
  const preEmail = usePreBuilderStore(
    (s) => s.email || s.lastPayload?.email || ""
  );
  const guestName = (clientName || preName || "").trim() || "Guest";
  const guestEmail = (clientEmail || preEmail || "").trim().toLowerCase();

  const pnr = activeBookingRef({
    tempBookingRef: state.tempBookingRef,
    confirmedBookingRef: state.confirmedBookingRef,
    bookingStatus: state.bookingStatus,
  });
  const creditEur =
    feeCreditEur != null && feeCreditEur > 0
      ? feeCreditEur
      : getConciergeFeeCreditEur(pnr);
  const paidTowardTour = Math.max(
    0,
    Math.round(Number(totalPaidEur) || 0),
    creditEur
  );

  useEffect(() => {
    useBuilderStore.persist.rehydrate();
    setReady(true);
    fetchBuilderConfig({ includeAccommodations: true })
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  const baseItems = useMemo(
    () => buildMultiDayInvoiceItems(state, config),
    [state, config]
  );

  useEffect(() => {
    const ref = String(pnr || "").trim();
    if (!ref || ref.startsWith("TMP-")) {
      setAgentServices([]);
      setApprovedFromServer(null);
      setPriceModeFromServer(null);
      return;
    }
    let cancelled = false;
    const applyAgentPayload = (data: {
      services?: ServiceLineItem[];
      finalApprovedPrice?: number | null;
      priceMode?: PriceMode | string | null;
    }) => {
      setAgentServices(data.services || []);
      setApprovedFromServer(
        data.finalApprovedPrice != null &&
          Number.isFinite(Number(data.finalApprovedPrice)) &&
          Number(data.finalApprovedPrice) > 0
          ? Math.round(Number(data.finalApprovedPrice))
          : null
      );
      setPriceModeFromServer(
        data.priceMode === "exact"
          ? "exact"
          : data.priceMode === "estimate"
            ? "estimate"
            : null
      );
    };
    const load = () => {
      void fetch(`/api/bookings/agent-services?pnr=${encodeURIComponent(ref)}`, {
        cache: "no-store",
      })
        .then((r) => (r.ok ? r.json() : null))
        .then(
          (data: {
            services?: ServiceLineItem[];
            finalApprovedPrice?: number | null;
            priceMode?: PriceMode | string | null;
          } | null) => {
            if (cancelled || !data) return;
            applyAgentPayload(data);
            if ((data.services || []).length === 0 && baseItems.length > 0) {
              void import("@/lib/syncGuestInvoiceCart").then(
                ({ syncGuestInvoiceCart }) =>
                  syncGuestInvoiceCart({
                    pnr: ref,
                    items: baseItems,
                  }).then((result) => {
                    if (cancelled || !result.ok || !result.seeded) return;
                    void fetch(
                      `/api/bookings/agent-services?pnr=${encodeURIComponent(ref)}`,
                      { cache: "no-store" }
                    )
                      .then((r) => (r.ok ? r.json() : null))
                      .then(
                        (again: {
                          services?: ServiceLineItem[];
                          finalApprovedPrice?: number | null;
                          priceMode?: PriceMode | string | null;
                        } | null) => {
                          if (cancelled || !again) return;
                          applyAgentPayload(again);
                        }
                      );
                  })
              );
            }
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
  }, [pnr, baseItems]);
  // Prefer ops_hub.extras.agent_services when Ops has saved a cart;
  // otherwise keep the local builder-derived estimate.
  const items = useMemo(
    () => resolveGuestInvoiceItems(baseItems, agentServices),
    [baseItems, agentServices]
  );

  const lockedApproved =
    finalApprovedPrice != null &&
    Number.isFinite(finalApprovedPrice) &&
    finalApprovedPrice > 0
      ? Math.round(finalApprovedPrice)
      : approvedFromServer != null && approvedFromServer > 0
        ? approvedFromServer
        : null;
  const guestPriceMode = priceModeFromServer;

  const totalGuests = Math.max(1, state.adults + state.children);
  const pace = travelPaceLabel(state.travelPace);
  const { packageMinEur, packageMaxEur } = invoicePackageRangeEur(items);
  const feeCreditAmount =
    creditEur > 0 ? creditEur : DEFAULT_CONCIERGE_FEE_EUR;

  const cityHubLabel = useMemo(() => {
    const cityById = new Map(
      (config?.cities || []).map((c) => [c.id, c.name] as const)
    );
    const names = (state.locations || [])
      .filter((stop) => !stop.isTransitHub && stop.nights > 0)
      .map((stop) => cityById.get(stop.cityId) || "")
      .filter(Boolean);
    const unique = [...new Set(names)];
    return unique.length > 0 ? unique.join(" → ") : "—";
  }, [config?.cities, state.locations]);

  const estPerPerson =
    totalGuests > 0 ? Math.round(packageMinEur / totalGuests) : 0;

  if (!ready) {
    return (
      <p className="p-10 text-center text-sm text-zinc-500">
        Loading itinerary…
      </p>
    );
  }

  const tripDetails = (
    <>
      <InvoiceMetaRow label="Guest" value={guestName} />
      <InvoiceMetaRow label="Email" value={guestEmail || "—"} />
      <InvoiceMetaRow label="City Hub" value={cityHubLabel} />
      <InvoiceMetaRow
        label="Date & Duration"
        value={`${formatDisplayDate(state.arrivalDate)} – ${formatDisplayDate(departureDate())} · ${state.durationDays} day${state.durationDays === 1 ? "" : "s"}`}
      />
      <InvoiceMetaRow
        label="Guests"
        value={`${state.adults} adult${state.adults === 1 ? "" : "s"}${
          state.children
            ? `, ${state.children} child${state.children === 1 ? "" : "ren"}`
            : ""
        }`}
      />
      <InvoiceMetaRow
        label="Language / Guide"
        value={state.preferredTourLanguage || "EN"}
      />
      {pace ? <InvoiceMetaRow label="Travel Pace" value={pace} /> : null}
      <InvoiceMetaRow
        label="Est. / Person"
        value={formatEur(estPerPerson)}
      />
    </>
  );

  const estimateBox = (
    <InvoiceBriefEstimateBox
      pnr={pnr}
      guestName={guestName}
      partySize={totalGuests}
      packageMinEur={packageMinEur}
      packageMaxEur={packageMaxEur}
      finalApprovedPrice={lockedApproved}
      priceMode={guestPriceMode}
    />
  );

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
            ? "print:max-w-none"
            : "mx-auto max-w-3xl px-4 py-8 sm:px-6"
        }
      >
        {/* PNR lives in InvoiceBriefEstimateBox — keep badge desktop-only */}
        <div className="no-print mb-5 hidden md:block">
          <BookingRefBadge
            tempBookingRef={state.tempBookingRef}
            confirmedBookingRef={state.confirmedBookingRef}
            bookingStatus={state.bookingStatus}
            variant="inline"
          />
        </div>

        {/* Mobile — exactly 3 sibling boxes */}
        <MobileDossierLayout
          tripDetails={tripDetails}
          estimate={estimateBox}
          itemized={
            <FlatInvoiceBrief
              items={items.map(toFlatInvoiceRow)}
              depositAmount={creditEur}
              totalPaidEur={paidTowardTour}
              finalApprovedPrice={lockedApproved}
              priceMode={guestPriceMode}
            />
          }
        />

        {/* Desktop — Box 1 + estimate/table (no nested mobile cards); mobile brief prints */}
        <div className="hidden space-y-5 print:hidden md:block">
          <InvoiceMetaList>{tripDetails}</InvoiceMetaList>
          <ItemizedInvoiceTable
            pnr={pnr}
            guestName={guestName}
            partySize={totalGuests}
            items={items}
            conciergeFeePaid={creditEur > 0 || paidTowardTour > 0}
            conciergeFeeAmount={feeCreditAmount}
            totalPaidEur={paidTowardTour}
            finalApprovedPrice={lockedApproved}
            priceMode={guestPriceMode}
            composition="desktop"
          />
        </div>
      </article>
    </div>
  );
}
