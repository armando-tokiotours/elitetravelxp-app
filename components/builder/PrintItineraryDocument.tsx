"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import {
  fetchBuilderConfig,
  transferLocation,
  type BuilderConfig,
  type PbHub,
  type PbTransfer,
} from "@/lib/pocketbase/client";
import {
  calculateBuilderQuote,
  calculateInvoiceBreakdown,
  formatUsd,
  invoiceVehicleLine,
} from "@/lib/builder-pricing";
import {
  isBillableChauffeurDay,
} from "@/lib/chauffeurSelections";
import { calculateCityDateRanges } from "@/lib/dateCascade";
import {
  formatDisplayDate,
  normalizeCityHotelPref,
  useBuilderStore,
  type BuilderState,
  type LocationStop,
} from "@/store/useBuilderStore";
import { formatHotelRoomsSummary } from "@/lib/hotelCalculator";
import { sortSelectedToursChronologically } from "@/lib/selectedTours";
import { travelPaceLabel } from "@/lib/travelPace";
import { BookingRefBadge } from "@/components/builder/BookingRefBadge";
import { ticketTypeLabel } from "@/lib/transitTickets";
import { buildCityMap, getCityName } from "@/lib/cityLabels";
import {
  ELITE_CONCIERGE_CREDIT_LABEL,
  ELITE_CONCIERGE_FEE,
  ELITE_CONCIERGE_FEE_LABEL,
} from "@/lib/eliteConcierge";
import { activeBookingRef } from "@/utils/pnr";
import { BRAND_DOMAIN } from "@/lib/brand";

/** Formal luxury quotation / print document from persisted builder state. */
export function PrintItineraryDocument({
  embedded = false,
  showToolbar = true,
  onPrintRequest,
}: {
  /** When true, omit page chrome — used inside My Itinerary dual-view. */
  embedded?: boolean;
  showToolbar?: boolean;
  /** Prefer server PDF email over window.print(). */
  onPrintRequest?: () => void;
} = {}) {
  const state = useBuilderStore();
  const departureDate = useBuilderStore((s) => s.departureDate);
  const [config, setConfig] = useState<BuilderConfig | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    useBuilderStore.persist.rehydrate();
    setReady(true);
    fetchBuilderConfig({ includeAccommodations: true })
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  const quote = useMemo(
    () => (config ? calculateBuilderQuote(state, config) : null),
    [config, state]
  );

  const breakdown = useMemo(
    () => (config ? calculateInvoiceBreakdown(state, config) : null),
    [config, state]
  );

  const cityMap = useMemo(
    () => buildCityMap(config?.cities),
    [config?.cities]
  );
  const cityName = (id: string) => getCityName(id, cityMap);

  const arrival =
    config?.hubs.find((h) => h.id === state.arrivalTransferId) ||
    config?.transfers.find((t) => t.id === state.arrivalTransferId);
  const departure =
    config?.hubs.find((h) => h.id === state.departureTransferId) ||
    config?.transfers.find((t) => t.id === state.departureTransferId);

  const dateRanges = useMemo(
    () => calculateCityDateRanges(state.arrivalDate, state.locations),
    [state.arrivalDate, state.locations]
  );

  const totalGuests = state.adults + state.children;
  const vehicleLine = breakdown?.vehicleLine ?? invoiceVehicleLine(totalGuests);

  const stayLocations = state.locations.filter(
    (l) => l.visitType === "stay" || !l.visitType
  );

  if (!ready) {
    return (
      <p className="p-10 text-center text-sm text-[#8A8278]">
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
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/tokiotours-logo.png"
                alt="TOKIOTOURS"
                className="h-10 w-10 rounded-full object-cover"
              />
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#075473]">
                  TOKIOTOURS
                </p>
                <h1 className="font-display text-2xl text-white">View / Print Itinerary</h1>
              </div>
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
                className="rounded-full bg-[#0B1F3A] px-5 py-2 text-sm font-semibold text-white"
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
            ? "print:max-w-none print:px-0 print:py-0"
            : "mx-auto max-w-3xl px-4 py-8 sm:px-6 print:max-w-none print:px-0 print:py-0"
        }
      >
        <header className="border-b border-[#075473]/40 pb-6">
          <div className="text-center sm:text-left">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.4em] text-[#F6A724]">
              Private Quotation
            </p>
            <h2 className="mt-2 font-display text-[1.44rem] leading-tight text-white sm:text-4xl sm:leading-none">
              Japan Journey Design
            </h2>
            <p className="mt-2 text-sm text-white/55">
              Prepared for your review ·{" "}
              {new Date().toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="no-print mt-4 w-full">
            <BookingRefBadge
              tempBookingRef={state.tempBookingRef}
              confirmedBookingRef={state.confirmedBookingRef}
              bookingStatus={state.bookingStatus}
              variant="inline"
            />
          </div>
        </header>

        {/* Japan Booking Pass stub — print / PDF */}
        <section className="mt-6 rounded-2xl border border-[#0A1017]/90 bg-[#0A1017] p-5 text-white print:break-inside-avoid">
          {(() => {
            const pnr =
              activeBookingRef({
                tempBookingRef: state.tempBookingRef,
                confirmedBookingRef: state.confirmedBookingRef,
                bookingStatus: state.bookingStatus,
              }) ||
              state.confirmedBookingRef ||
              state.tempBookingRef ||
              "······";
            const site = `https://${BRAND_DOMAIN}`;
            const dossierHref = `${site}/builder/itinerary?ref=${encodeURIComponent(pnr)}&view=dossier`;
            return (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-dashed border-white/20 pb-3">
                  <p className="text-[11px] font-bold tracking-widest text-[#F6A724] uppercase">
                    Tokiotours Japan Pass
                  </p>
                  <p className="font-mono text-sm font-bold tracking-wider text-cyan-300">
                    REF: {pnr}
                  </p>
                </div>
                <div className="mt-3 space-y-1 text-sm">
                  <p>
                    <span className="text-zinc-400">GUEST:</span>{" "}
                    <span className="font-semibold uppercase">
                      {state.adults} adult
                      {state.adults === 1 ? "" : "s"}
                      {state.children
                        ? `, ${state.children} child${state.children === 1 ? "" : "ren"}`
                        : ""}
                    </span>
                  </p>
                  <p>
                    <span className="text-zinc-400">DATES:</span>{" "}
                    <span className="font-semibold">
                      {formatDisplayDate(state.arrivalDate)} –{" "}
                      {formatDisplayDate(departureDate())}
                    </span>
                  </p>
                  <p>
                    <span className="text-zinc-400">DURATION:</span>{" "}
                    <span className="font-semibold">
                      {state.durationDays} day
                      {state.durationDays === 1 ? "" : "s"}
                    </span>
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 no-print">
                  <a
                    href={dossierHref}
                    className="rounded-xl bg-[#075473] px-3.5 py-2 text-[10px] font-bold tracking-wider text-white uppercase"
                  >
                    Open booking on website
                  </a>
                </div>
                <p className="mt-3 hidden text-[10px] text-zinc-400 print:block">
                  Website: {dossierHref}
                </p>
              </>
            );
          })()}
        </section>

        {/* Travel window */}
        <section className="mt-8">
          <InvoiceCard title="Travel window">
            <DetailRow
              left="Duration"
              right={`${state.durationDays} days`}
            />
            <DetailRow
              left="Arrival date"
              right={formatDisplayDate(state.arrivalDate)}
            />
            <DetailRow
              left="Departure date"
              right={formatDisplayDate(departureDate())}
            />
            {travelPaceLabel(state.travelPace) ? (
              <DetailRow
                left="Travel pace"
                right={`${travelPaceLabel(state.travelPace)} Pace`}
              />
            ) : null}
          </InvoiceCard>
        </section>

        {/* Arrival & Departure Hubs */}
        <section className="mt-4">
          <InvoiceCard title="Arrival & departure hubs">
            <DetailRow
              left="Arrival Hub"
              right={`${hubLabel(arrival)} · ${
                state.arrivalMode === "cruise" ? "Cruise" : "Flight"
              }`}
            />
            <DetailRow
              left="VIP Arrival Pickup"
              right={
                state.airportPickup
                  ? vehicleLine
                  : "Not selected"
              }
            />
            <DetailRow
              left="Departure Hub"
              right={`${hubLabel(departure)} · ${
                state.departureMode === "cruise" ? "Cruise" : "Flight"
              }`}
            />
            <DetailRow
              left="VIP Departure Drop-off"
              right={
                state.airportDropoff
                  ? vehicleLine
                  : "Not selected"
              }
            />
            {breakdown ? (
              <SectionSubtotal
                label="Transfers Subtotal"
                min={breakdown.hubs.min}
                max={breakdown.hubs.max}
              />
            ) : null}
          </InvoiceCard>
        </section>

        {/* Guests & Accommodation */}
        <section className="mt-4">
          <InvoiceCard title="Guests & accommodation">
            <DetailRow
              left="Guests"
              right={`${state.adults} Adult${
                state.adults === 1 ? "" : "s"
              }, ${state.children} Child${state.children === 1 ? "" : "ren"}`}
            />
            {stayLocations.length === 0 ? (
              <p className="py-2 text-sm text-[#8A8278]">
                No hotel stays configured yet.
              </p>
            ) : (
              stayLocations.map((loc) => {
                const prefRaw = state.cityHotels[loc.cityId];
                const pref = prefRaw
                  ? normalizeCityHotelPref(
                      prefRaw,
                      loc.cityId,
                      state.roomCount
                    )
                  : null;
                const wantsHotel = pref
                  ? pref.needsHotel
                  : Boolean(state.needHotels);
                if (!wantsHotel) {
                  return (
                    <DetailRow
                      key={loc.key}
                      left={`${cityName(loc.cityId)} (${loc.nights} Night${
                        loc.nights === 1 ? "" : "s"
                      })`}
                      right="Self-arranged (no hotel)"
                    />
                  );
                }
                const star = pref
                  ? `${pref.starRating}-Star Tier`
                  : `${state.hotelTier === "5-star" ? "5" : "4"}-Star Tier`;
                const rooms = pref
                  ? formatHotelRoomsSummary(
                      pref.rooms,
                      pref.standardOccupancy
                    ) || `${state.roomCount}× Room`
                  : `${state.roomCount}× ${state.roomType}`;
                const breakfast = pref
                  ? pref.breakfast
                    ? "Breakfast Included"
                    : "No Breakfast"
                  : null;
                return (
                  <DetailRow
                    key={loc.key}
                    left={`${cityName(loc.cityId)} (${loc.nights} Night${
                      loc.nights === 1 ? "" : "s"
                    })`}
                    right={[star, rooms, breakfast].filter(Boolean).join(" · ")}
                  />
                );
              })
            )}
            {breakdown ? (
              <SectionSubtotal
                label="Accommodation Subtotal"
                min={breakdown.hotels.min}
                max={breakdown.hotels.max}
              />
            ) : null}
          </InvoiceCard>
        </section>

        {/* Route, Tours & Daily Transport */}
        <section className="mt-4">
          <InvoiceCard title="Route, tours & daily transport">
            {state.experienceService === "concierge" ||
            state.isEliteConcierge ? (
              <>
                <DetailRow
                  left={ELITE_CONCIERGE_FEE_LABEL}
                  right={formatUsd(
                    breakdown?.conciergeFee || ELITE_CONCIERGE_FEE
                  )}
                />
                {(breakdown?.conciergeCredit ?? 0) > 0 ? (
                  <DetailRow
                    left={ELITE_CONCIERGE_CREDIT_LABEL}
                    right={`−${formatUsd(breakdown!.conciergeCredit)}`}
                  />
                ) : null}
              </>
            ) : null}

            {state.locations.length === 0 ? (
              <p className="py-2 text-sm text-[#8A8278]">
                No cities on your route yet.
              </p>
            ) : (
              <>
                {state.arrivalTransitType === "public" &&
                state.arrivalNeedsTicket &&
                (state.arrivalTicketPricePerPax ?? 0) > 0 ? (
                  <DetailRow
                    left={`Arrival rail tickets · ${ticketTypeLabel(
                      state.arrivalTicketType ?? "ic_card"
                    )}`}
                    right={`Est. ${formatUsd(
                      (state.arrivalTicketPricePerPax ?? 0) *
                        Math.max(1, state.adults + state.children)
                    )}`}
                  />
                ) : null}
                {state.locations.map((loc, i) => (
                <CityExperienceBlock
                  key={loc.key}
                  loc={loc}
                  index={i}
                  prev={state.locations[i - 1]}
                  cityLabel={cityName(loc.cityId)}
                  dateLabel={dateRanges[i]?.label ?? ""}
                  state={state}
                  config={config}
                  vehicleLine={vehicleLine}
                />
              ))}
              </>
            )}

            {breakdown ? (
              <SectionSubtotal
                label={["Experiences", "Transport", "Subtotal"]}
                min={breakdown.experiences.min}
                max={breakdown.experiences.max}
              />
            ) : null}
          </InvoiceCard>
        </section>

        {quote ? (
          <section className="mt-8 rounded-2xl border border-[#075473]/50 bg-[#075473]/20 p-6 text-center print:border print:bg-white">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#00B4D8]">
              Experience Japan Range
            </p>
            <p className="mt-2 font-display text-3xl text-white print:text-[#0B1F3A]">
              {formatUsd(quote.min)} – {formatUsd(quote.max)}
            </p>
            {(() => {
              const guests = Math.max(1, totalGuests);
              const minPP = Math.round(quote.min / guests);
              const maxPP = Math.round(quote.max / guests);
              return (
                <p className="mt-1 text-sm text-white/60 print:text-[#5C6570]">
                  Est. {formatUsd(minPP)} – {formatUsd(maxPP)} per person
                  {guests > 1 ? ` · ${guests} guests` : ""}
                </p>
              );
            })()}
            <p className="mt-2 text-xs text-white/45 print:text-[#8A8278]">
              Indicative range based on current Source of Truth pricing. Final
              quotation confirmed by your TOKIOTOURS consultant.
            </p>
            {state.isEliteConcierge ||
            state.experienceService === "concierge" ? (
              <p className="mt-3 rounded-xl border border-[#F6A724]/35 bg-[#F6A724]/10 px-3 py-2 text-left text-xs leading-relaxed text-white/85 print:border-[#075473]/40 print:bg-accent-50 print:text-accent-900">
                <span className="font-bold uppercase tracking-wide text-[#F6A724] print:text-inherit">
                  ✨ Elite Concierge Active
                </span>
                <span className="mt-1 block">
                  Individual tours and private drivers are currently
                  deactivated. Your dedicated concierge will curate your 1-on-1
                  daily itinerary, tours, and transfers, providing a bespoke
                  quotation before final booking.
                </span>
              </p>
            ) : null}
          </section>
        ) : null}

        <footer className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-white/50 print:border-[#E8E2D9] print:text-[#8A8278]">
          <p className="font-display text-lg text-[#E60F43]">
            TOKIOTOURS
          </p>
          <p className="mt-1">tokiotours-app.com</p>
          <p className="mt-3">
            This document reflects your saved trip builder selections. A 10%
            deposit may be required to lock your quotation while a travel expert
            finalizes hotels, guides, and timing.
          </p>
        </footer>
      </article>
    </div>
  );
}

function CityExperienceBlock({
  loc,
  index,
  prev,
  cityLabel,
  dateLabel,
  state,
  config,
  vehicleLine,
}: {
  loc: LocationStop;
  index: number;
  prev?: LocationStop;
  cityLabel: string;
  dateLabel: string;
  state: BuilderState;
  config: BuilderConfig | null;
  vehicleLine: string;
}) {
  const [open, setOpen] = useState(false);
  const isWaypoint =
    loc.visitType === "arrival" || loc.visitType === "departure";
  const tours = sortSelectedToursChronologically(
    state.selectedTours[loc.cityId] ?? []
  );
  const chauffeurByDate = state.chauffeurSelections[loc.cityId] ?? {};
  const chauffeurDays = Object.entries(chauffeurByDate).filter(([, sel]) =>
    isBillableChauffeurDay(sel)
  ).length;
  const concierge =
    state.isEliteConcierge || state.experienceService === "concierge";

  const transitIn =
    prev && index > 0
      ? prev.transitType === "unset"
        ? `Transfer not configured to ${cityLabel}`
        : prev.transitType === "self"
          ? `Self-Arranged / On Your Own to ${cityLabel}`
          : prev.transitType === "private"
            ? `Private Car to ${cityLabel}`
            : `Bullet Train (Shinkansen) to ${cityLabel}`
      : null;

  const ticketLine =
    prev &&
    index > 0 &&
    prev.transitType === "public" &&
    prev.needsTicket &&
    (prev.ticketPricePerPax ?? 0) > 0
      ? `${ticketTypeLabel(prev.ticketType ?? "none")} · Est. ${formatUsd(
          (prev.ticketPricePerPax ?? 0) *
            Math.max(1, state.adults + state.children)
        )}`
      : prev &&
          index > 0 &&
          prev.transitType === "public" &&
          prev.needsTicket === false
        ? "Tickets: self-purchase on site"
        : null;

  const statusParts: string[] = [];
  if (concierge) {
    statusParts.push("Elite Concierge");
  } else {
    if (tours.length > 0) {
      statusParts.push(
        `${tours.length} experience${tours.length === 1 ? "" : "s"}`
      );
    }
    if (chauffeurDays > 0) {
      statusParts.push(
        `${chauffeurDays} chauffeur day${chauffeurDays === 1 ? "" : "s"}`
      );
    }
    if (statusParts.length === 0) {
      if (transitIn && prev?.transitType === "self") {
        statusParts.push("Self-Arranged");
      } else if (transitIn && prev?.transitType === "private") {
        statusParts.push("Private transfer in");
      } else if (transitIn && prev?.transitType === "public") {
        statusParts.push("Rail transfer in");
      } else if (transitIn && prev?.transitType === "unset") {
        statusParts.push("Transfer not set");
      } else {
        statusParts.push("Self-Arranged");
      }
    }
  }
  const statusLabel = statusParts.join(" · ");

  if (isWaypoint) {
    return (
      <div className="border-b border-white/10 py-3 last:border-b-0 print:border-[#EEE8DF]">
        <p className="text-sm font-semibold text-white print:text-[#0B1F3A]">
          {cityLabel}
          <span className="ml-2 text-xs font-normal text-white/50 print:text-[#8A8278]">
            {loc.visitType === "arrival"
              ? "Arrival waypoint"
              : "Departure waypoint"}
          </span>
        </p>
        {transitIn ? (
          <p className="mt-1 text-xs text-white/55 print:text-[#5C6570]">{transitIn}</p>
        ) : null}
        {ticketLine ? (
          <p className="mt-0.5 text-xs text-accent-800/80">{ticketLine}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="border-b border-white/10 last:border-b-0 print:border-[#EEE8DF]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-white/[0.04] print:hidden"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-white">
              {cityLabel}
              <span className="text-white/50">
                {" "}
                · {loc.nights} Night{loc.nights === 1 ? "" : "s"}
              </span>
            </p>
            {dateLabel ? (
              <p className="shrink-0 text-xs text-white/50">{dateLabel}</p>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-white/50">{statusLabel}</p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#F6A724]/80 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {/* Always visible when printing */}
      <div className="hidden print:block">
        <div className="flex items-baseline justify-between gap-3 py-3">
          <p className="text-sm font-semibold text-[#0B1F3A]">
            {cityLabel}
            <span className="text-[#8A8278]">
              {" "}
              · {loc.nights} Night{loc.nights === 1 ? "" : "s"}
            </span>
          </p>
          {dateLabel ? (
            <p className="shrink-0 text-xs text-[#8A8278]">{dateLabel}</p>
          ) : null}
        </div>
      </div>

      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out print:!grid-rows-[1fr] ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr] print:grid-rows-[1fr]"
        }`}
      >
        <div className="overflow-hidden">
          <ul className="space-y-1.5 pb-3 print:pb-3">
            {transitIn ? (
              <li className="text-xs text-white/55 print:text-[#5C6570]">{transitIn}</li>
            ) : null}
            {ticketLine ? (
              <li className="text-xs text-[#F6A724]/80 print:text-accent-800/80">{ticketLine}</li>
            ) : null}

            {!concierge &&
              tours.map((row) => {
                const catalog = config?.tours.find((t) => t.id === row.tourId);
                const hours = catalog?.duration_hours ?? row.duration_hours;
                return (
                  <li
                    key={`${row.tourId}-${row.scheduledDate}`}
                    className="text-xs text-white/55 print:text-[#5C6570]"
                  >
                    {row.title}
                    {hours ? ` · ${hours}h` : ""}
                    {row.selectedLanguage
                      ? ` · ${row.selectedLanguage} Guide`
                      : ""}
                  </li>
                );
              })}

            {concierge ? (
              <li className="text-xs text-white/55 print:text-[#5C6570]">
                Tours &amp; private drivers curated 1:1 by Elite Concierge
              </li>
            ) : chauffeurDays > 0 ? (
              <li className="text-xs text-white/55 print:text-[#5C6570]">
                {chauffeurDays} Day{chauffeurDays === 1 ? "" : "s"} Private
                Chauffeur · {vehicleLine}
              </li>
            ) : null}

            {!concierge &&
            tours.length === 0 &&
            chauffeurDays === 0 &&
            !transitIn ? (
              <li className="text-xs text-white/40 print:text-[#8A8278]">
                No experiences or private chauffeur days yet
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  );
}

function InvoiceCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card dark-card rounded-2xl border border-white/10 bg-[#0D1117]/80 p-4 backdrop-blur-md sm:p-5 print:border print:bg-white print:shadow-none">
      <h3 className="accent-title mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#F6A724] print:text-[#075473]">
        {title}
      </h3>
      <div>{children}</div>
    </div>
  );
}

function DetailRow({ left, right }: { left: string; right: string }) {
  return (
    <div className="detail-row flex w-full items-center justify-between gap-3 border-b border-white/10 py-1.5 last:border-b-0 sm:gap-4 sm:py-2 print:border-[#F0EBE3]">
      <span className="detail-row-label min-w-0 shrink-0 leading-tight text-white/55 sm:shrink print:text-[#5C6570]">
        {left}
      </span>
      {right ? (
        <span className="detail-row-value min-w-0 flex-1 break-words text-right font-semibold leading-tight text-white print:text-[#0B1F3A]">
          {right}
        </span>
      ) : null}
    </div>
  );
}

function SectionSubtotal({
  label,
  min,
  max,
}: {
  label: string | string[];
  min: number;
  max: number;
}) {
  const isZero = min <= 0 && max <= 0;
  const labelText = Array.isArray(label) ? label.join(" ") : label;
  const isExperiences = /experiences/i.test(labelText);
  const labelNode = Array.isArray(label) ? (
    <>
      {label.map((line, i) => (
        <span key={line}>
          {i > 0 ? <br /> : null}
          {line}
        </span>
      ))}
    </>
  ) : (
    label
  );

  if (isZero && isExperiences) {
    return (
      <div className="mt-4 border-t border-white/10 pt-4 font-bold text-white print:border-zinc-200 print:text-[#0B1F3A]">
        <span className="text-xs uppercase tracking-wider text-white/50 print:text-zinc-500">
          {labelNode}: €0 (Self-Arranged)
        </span>
      </div>
    );
  }

  return (
    <div className="mt-4 flex items-start justify-between gap-3 border-t border-white/10 pt-4 font-bold text-white print:border-zinc-200 print:text-[#0B1F3A]">
      <span className="text-xs uppercase tracking-wider text-white/50 print:text-zinc-500">
        {labelNode}
      </span>
      <span className="shrink-0 text-sm">
        {isZero
          ? "—"
          : `Est. ${formatUsd(min)} – ${formatUsd(Math.max(max, min))}`}
      </span>
    </div>
  );
}

function hubLabel(h: PbHub | PbTransfer | undefined): string {
  if (!h) return "Hub TBD";
  if ("name" in h) return (h as PbHub).name;
  return transferLocation(h as PbTransfer);
}
