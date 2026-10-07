"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatEur,
  guidePreferenceLabel,
  singleDayPerPersonHourEur,
} from "@/lib/singleDayPricing";
import {
  formatSingleDayDisplayDate,
  useSingleDayBuilderStore,
} from "@/store/useSingleDayBuilderStore";
import { useBuilderStore } from "@/store/useBuilderStore";
import { useItineraryStore } from "@/store/useItineraryStore";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";
import { formatClock12h } from "@/lib/singleDayTimeSlots";
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
import { buildSingleDayInvoiceItems } from "@/lib/itemizedInvoice";
import { getConciergeFeeCreditEur } from "@/lib/feeCredit";
import { DEFAULT_CONCIERGE_FEE_EUR } from "@/lib/conciergeEstimateFlow";
import { activeBookingRef } from "@/utils/pnr";
import {
  resolveGuestInvoiceItems,
  type PriceMode,
  type ServiceLineItem,
} from "@/lib/agentServices";

/**
 * Single-Day INVOICE tab — formal itemized financial estimate (no timeline).
 */
export function SingleDayInvoicePrint({
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
  /** Fee + progress payments — used for remaining balance. */
  totalPaidEur?: number;
  finalApprovedPrice?: number | null;
} = {}) {
  const tourDate = useSingleDayBuilderStore((s) => s.tourDate);
  const adults = useSingleDayBuilderStore((s) => s.adults);
  const children = useSingleDayBuilderStore((s) => s.children);
  const tourHours = useSingleDayBuilderStore((s) => s.tourHours);
  const startTime = useSingleDayBuilderStore((s) => s.startTime);
  const cityFocus = useSingleDayBuilderStore((s) => s.cityFocus);
  const guidePreference = useSingleDayBuilderStore((s) => s.guidePreference);
  const meetingPoint = useSingleDayBuilderStore((s) => s.meetingPoint);
  const preferredTourLanguage = useSingleDayBuilderStore(
    (s) => s.preferredTourLanguage
  );
  const selectedExperiences = useSingleDayBuilderStore(
    (s) => s.selectedExperiences
  );
  const preferredMovement = useSingleDayBuilderStore((s) => s.preferredMovement);
  const suicaNeeded = useSingleDayBuilderStore((s) => s.suicaNeeded);
  const suicaValueEur = useSingleDayBuilderStore((s) => s.suicaValueEur);

  const tempBookingRef = useBuilderStore((s) => s.tempBookingRef);
  const confirmedBookingRef = useBuilderStore((s) => s.confirmedBookingRef);
  const bookingStatus = useBuilderStore((s) => s.bookingStatus);
  const isEliteConcierge = useBuilderStore((s) => s.isEliteConcierge);
  const experienceService = useBuilderStore((s) => s.experienceService);
  const conciergeActive =
    isEliteConcierge || experienceService === "concierge";

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
    tempBookingRef,
    confirmedBookingRef,
    bookingStatus,
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

  const [agentServices, setAgentServices] = useState<ServiceLineItem[]>([]);
  const [approvedFromServer, setApprovedFromServer] = useState<number | null>(
    null
  );
  const [priceModeFromServer, setPriceModeFromServer] =
    useState<PriceMode | null>(null);

  const baseItems = useMemo(
    () =>
      buildSingleDayInvoiceItems({
        guidePreference,
        tourHours,
        selectedExperiences,
        conciergeActive,
        preferredMovement,
        suicaNeeded,
        suicaValueEur,
        guests: Math.max(1, adults + children),
      }),
    [
      guidePreference,
      tourHours,
      selectedExperiences,
      conciergeActive,
      preferredMovement,
      suicaNeeded,
      suicaValueEur,
      adults,
      children,
    ]
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
      const services = data.services || [];
      setAgentServices(services);
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
            // Seed Ops cart from local estimate when extras are still empty
            if ((data.services || []).length === 0 && baseItems.length > 0) {
              void import("@/lib/syncGuestInvoiceCart").then(
                ({ syncGuestInvoiceCart }) =>
                  syncGuestInvoiceCart({
                    pnr: ref,
                    items: baseItems,
                  }).then((result) => {
                    if (cancelled || !result.ok || !result.seeded) return;
                    // Re-fetch so guest + Ops share the same persisted cart
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

  const baseTotal = items
    .filter((i) => i.status === "ACCEPTED")
    .reduce((s, i) => s + i.basePriceEur, 0);
  const pax = Math.max(1, adults + children);
  const guests = `${adults} adult${adults === 1 ? "" : "s"}, ${children} child${children === 1 ? "" : "ren"}`;
  const dateLabel = formatSingleDayDisplayDate(tourDate) || "Date TBD";
  const { packageMinEur, packageMaxEur } = invoicePackageRangeEur(items);
  const feeCreditAmount =
    creditEur > 0 ? creditEur : DEFAULT_CONCIERGE_FEE_EUR;

  const tripDetails = (
    <>
      <InvoiceMetaRow label="Guest" value={guestName} />
      <InvoiceMetaRow label="Email" value={guestEmail || "—"} />
      <InvoiceMetaRow label="City Hub" value={cityFocus.trim() || "—"} />
      <InvoiceMetaRow
        label="Date & Duration"
        value={`${dateLabel} · ${tourHours}h`}
      />
      <InvoiceMetaRow label="Guests" value={guests} />
      <InvoiceMetaRow
        label="Language / Guide"
        value={`${preferredTourLanguage || "EN"} · ${guidePreferenceLabel(guidePreference)} · ${formatClock12h(startTime || "09:00")}`}
      />
      {meetingPoint ? (
        <InvoiceMetaRow label="Meeting Point" value={meetingPoint} />
      ) : null}
      <InvoiceMetaRow
        label="Est. / Person / Hour"
        value={formatEur(
          singleDayPerPersonHourEur(baseTotal, pax, tourHours)
        )}
      />
    </>
  );

  const estimateBox = (
    <InvoiceBriefEstimateBox
      pnr={pnr}
      guestName={guestName}
      partySize={pax}
      packageMinEur={packageMinEur}
      packageMaxEur={packageMaxEur}
      finalApprovedPrice={lockedApproved}
      priceMode={guestPriceMode}
    />
  );

  return (
    <div
      id="single-day-invoice-content"
      className={`print-document text-white ${
        embedded ? "" : "min-h-screen bg-[#05080C]"
      }`}
    >
      {!embedded && showToolbar ? (
        <div className="no-print border-b border-white/10 bg-[#0D1117] px-4 py-4">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">
              Single-Day Invoice
            </p>
            <button
              type="button"
              onClick={() =>
                onPrintRequest ? onPrintRequest() : window.print()
              }
              className="rounded-full bg-[#075473] px-5 py-2 text-sm font-semibold text-white"
            >
              Print / Save PDF
            </button>
          </div>
        </div>
      ) : null}

      <article className="mx-auto max-w-3xl overflow-hidden px-1 py-2 sm:px-2">
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

        {/* Desktop — formal table; mobile FlatInvoiceBrief prints instead */}
        <div className="hidden space-y-5 print:hidden md:block">
          <InvoiceMetaList>{tripDetails}</InvoiceMetaList>
          <ItemizedInvoiceTable
            pnr={pnr}
            guestName={guestName}
            partySize={pax}
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
