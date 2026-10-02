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
import { ItemizedInvoiceTable } from "@/components/invoice/ItemizedInvoiceTable";
import { buildSingleDayInvoiceItems } from "@/lib/itemizedInvoice";
import { getConciergeFeeCreditEur } from "@/lib/feeCredit";
import { ELITE_CONCIERGE_FEE } from "@/lib/eliteConcierge";
import { activeBookingRef } from "@/utils/pnr";
import {
  mergeInvoiceWithAgentServices,
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
  finalApprovedPrice = null,
}: {
  embedded?: boolean;
  showToolbar?: boolean;
  onPrintRequest?: () => void;
  feeCreditEur?: number;
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

  const [agentServices, setAgentServices] = useState<ServiceLineItem[]>([]);
  const [approvedFromServer, setApprovedFromServer] = useState<number | null>(
    null
  );

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

  const items = useMemo(
    () => mergeInvoiceWithAgentServices(baseItems, agentServices),
    [baseItems, agentServices]
  );

  const lockedApproved =
    finalApprovedPrice != null && Number.isFinite(finalApprovedPrice)
      ? Math.round(finalApprovedPrice)
      : approvedFromServer;

  const baseTotal = items
    .filter((i) => i.status === "ACCEPTED")
    .reduce((s, i) => s + i.basePriceEur, 0);
  const pax = Math.max(1, adults + children);
  const guests = `${adults} adult${adults === 1 ? "" : "s"}, ${children} child${children === 1 ? "" : "ren"}`;
  const dateLabel = formatSingleDayDisplayDate(tourDate) || "Date TBD";

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

      <article className="mx-auto max-w-3xl space-y-5 overflow-hidden px-1 py-2 sm:px-2">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Meta label="Guest" value={guestName} />
          <Meta label="Email" value={guestEmail || "—"} />
          <Meta label="City Hub" value={cityFocus.trim() || "—"} />
          <Meta label="Date & Duration" value={`${dateLabel} · ${tourHours}h`} />
          <Meta label="Guests" value={guests} />
          <Meta
            label="Language / Guide"
            value={`${preferredTourLanguage || "EN"} · ${guidePreferenceLabel(guidePreference)} · ${formatClock12h(startTime || "09:00")}`}
          />
          {meetingPoint ? (
            <Meta label="Meeting point" value={meetingPoint} />
          ) : null}
          <Meta
            label="Est. / person / hour"
            value={formatEur(
              singleDayPerPersonHourEur(baseTotal, pax, tourHours)
            )}
          />
        </dl>

        <ItemizedInvoiceTable
          pnr={pnr}
          guestName={guestName}
          partySize={pax}
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
