"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
    fetchBuilderConfig().then(setConfig).catch(() => setConfig(null));
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
      className={`print-document text-[#0B1F3A] ${
        embedded ? "" : "min-h-screen bg-[#F5F0E8]"
      }`}
    >
      {!embedded && showToolbar ? (
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
        <header className="border-b border-[#C4A35A]/40 pb-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="text-center sm:text-left">
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
            </div>
            <div className="no-print shrink-0">
              <BookingRefBadge
                tempBookingRef={state.tempBookingRef}
                confirmedBookingRef={state.confirmedBookingRef}
                bookingStatus={state.bookingStatus}
                variant="inline"
              />
            </div>
          </div>
        </header>

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
              left={`Arrive: ${hubLabel(arrival)} · ${
                state.arrivalMode === "cruise" ? "Cruise" : "Flight"
              }`}
              right=""
            />
            <DetailRow
              left={
                state.airportPickup
                  ? `VIP Pickup: Yes · Vehicle: ${vehicleLine}`
                  : "VIP Pickup: No"
              }
              right=""
            />
            <DetailRow
              left={`Depart: ${hubLabel(departure)} · ${
                state.departureMode === "cruise" ? "Cruise" : "Flight"
              }`}
              right=""
            />
            <DetailRow
              left={
                state.airportDropoff
                  ? `VIP Drop-off: Yes · Vehicle: ${vehicleLine}`
                  : "VIP Drop-off: No"
              }
              right=""
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
                      right="Accommodation Self-Arranged (No Hotel Required)"
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
                label="Experiences & Transport Subtotal"
                min={breakdown.experiences.min}
                max={breakdown.experiences.max}
              />
            ) : null}
          </InvoiceCard>
        </section>

        {quote ? (
          <section className="mt-8 rounded-2xl border border-[#C4A35A]/45 bg-[#FBF6EA] p-6 text-center print:border print:bg-white">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#C4A35A]">
              Experience Japan Range
            </p>
            <p className="mt-2 font-display text-3xl text-[#0B1F3A]">
              {formatUsd(quote.min)} – {formatUsd(quote.max)}
            </p>
            {(() => {
              const guests = Math.max(1, totalGuests);
              const minPP = Math.round(quote.min / guests);
              const maxPP = Math.round(quote.max / guests);
              return (
                <p className="mt-1 text-sm text-[#5C6570]">
                  Est. {formatUsd(minPP)} – {formatUsd(maxPP)} per person
                  {guests > 1 ? ` · ${guests} guests` : ""}
                </p>
              );
            })()}
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
  const isWaypoint =
    loc.visitType === "arrival" || loc.visitType === "departure";
  const tours = sortSelectedToursChronologically(
    state.selectedTours[loc.cityId] ?? []
  );
  const chauffeurByDate = state.chauffeurSelections[loc.cityId] ?? {};
  const chauffeurDays = Object.entries(chauffeurByDate).filter(([, sel]) =>
    isBillableChauffeurDay(sel)
  ).length;

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

  if (isWaypoint) {
    return (
      <div className="border-b border-[#EEE8DF] py-3 last:border-b-0">
        <p className="text-sm font-semibold text-[#0B1F3A]">
          {cityLabel}
          <span className="ml-2 text-xs font-normal text-[#8A8278]">
            {loc.visitType === "arrival"
              ? "Arrival waypoint"
              : "Departure waypoint"}
          </span>
        </p>
        {transitIn ? (
          <p className="mt-1 text-xs text-[#5C6570]">{transitIn}</p>
        ) : null}
        {ticketLine ? (
          <p className="mt-0.5 text-xs text-amber-800/80">{ticketLine}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="border-b border-[#EEE8DF] py-3 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
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

      <ul className="mt-2 space-y-1.5">
        {transitIn ? (
          <li className="text-xs text-[#5C6570]">{transitIn}</li>
        ) : null}
        {ticketLine ? (
          <li className="text-xs text-amber-800/80">{ticketLine}</li>
        ) : null}

        {!state.isEliteConcierge &&
          tours.map((row) => {
            const catalog = config?.tours.find((t) => t.id === row.tourId);
            const hours = catalog?.duration_hours ?? row.duration_hours;
            return (
              <li
                key={`${row.tourId}-${row.scheduledDate}`}
                className="text-xs text-[#5C6570]"
              >
                {row.title}
                {hours ? ` · ${hours}h` : ""}
                {row.selectedLanguage
                  ? ` · ${row.selectedLanguage} Guide`
                  : ""}
              </li>
            );
          })}

        {chauffeurDays > 0 ? (
          <li className="text-xs text-[#5C6570]">
            {chauffeurDays} Day{chauffeurDays === 1 ? "" : "s"} Private
            Chauffeur · {vehicleLine}
          </li>
        ) : null}

        {!state.isEliteConcierge &&
        tours.length === 0 &&
        chauffeurDays === 0 &&
        !transitIn ? (
          <li className="text-xs text-[#8A8278]">
            No experiences or private chauffeur days yet
          </li>
        ) : null}
      </ul>
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
    <div className="rounded-2xl border border-[#E8E2D9] bg-white p-4 sm:p-5 print:border print:shadow-none">
      <h3 className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#C4A35A]">
        {title}
      </h3>
      <div>{children}</div>
    </div>
  );
}

function DetailRow({ left, right }: { left: string; right: string }) {
  return (
    <div className="flex w-full flex-col gap-1 overflow-hidden border-b border-[#F0EBE3] py-2 text-sm last:border-b-0 sm:flex-row sm:justify-between sm:gap-4">
      <span className="min-w-0 break-words leading-tight text-[#5C6570]">
        {left}
      </span>
      {right ? (
        <span className="break-words text-left font-medium leading-tight text-[#0B1F3A] sm:shrink-0 sm:text-right">
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
  label: string;
  min: number;
  max: number;
}) {
  return (
    <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-4 font-bold text-[#0B1F3A]">
      <span className="text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <span className="text-sm">
        {min <= 0 && max <= 0
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
