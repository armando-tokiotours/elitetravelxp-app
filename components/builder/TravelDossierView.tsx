"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BedDouble,
  CalendarDays,
  Car,
  ChevronDown,
  CircleDot,
  MapPin,
  Pencil,
  PlaneLanding,
  PlaneTakeoff,
  Route,
  Sparkles,
  Ticket,
  TrainFront,
  Users,
} from "lucide-react";
import {
  transferLocation,
  type BuilderConfig,
  type PbHub,
  type PbTransfer,
} from "@/lib/pocketbase/client";
import { buildCityMap, getCityName } from "@/lib/cityLabels";
import { formatCityDateSingle } from "@/lib/dateCascade";
import {
  formatDisplayDate,
  normalizeCityHotelPref,
  useBuilderStore,
  type CityTransitType,
  type LocationStop,
  type BuilderState,
} from "@/store/useBuilderStore";
import { formatHotelRoomsSummary } from "@/lib/hotelCalculator";
import { sortSelectedToursChronologically } from "@/lib/selectedTours";
import { travelPaceLabel } from "@/lib/travelPace";
import { BookingRefBadge } from "@/components/builder/BookingRefBadge";
import { NewBookingResetButton } from "@/components/builder/NewBookingResetButton";
import { type TransitTicketType } from "@/lib/transitTickets";
import {
  InterCityTransitModal,
  type InterCityTransitLeg,
} from "@/components/builder/modals/InterCityTransitModal";

export function TravelDossierView({
  state,
  config,
  departureIso,
  dateRanges,
  fleetLabel,
  arrivalHub,
  departureHub,
}: {
  state: BuilderState;
  config: BuilderConfig | null;
  departureIso: string | null;
  dateRanges: { label: string }[];
  fleetLabel: string | null;
  arrivalHub: PbHub | PbTransfer | null;
  departureHub: PbHub | PbTransfer | null;
}) {
  const setLocationTransitChoice = useBuilderStore(
    (s) => s.setLocationTransitChoice
  );
  const setArrivalTransitChoice = useBuilderStore(
    (s) => s.setArrivalTransitChoice
  );
  const [transitLeg, setTransitLeg] = useState<InterCityTransitLeg | null>(
    null
  );

  const cityMap = useMemo(
    () => buildCityMap(config?.cities),
    [config?.cities]
  );
  const cityName = (id: string) => getCityName(id, cityMap);

  const firstLoc = state.locations.find(
    (l) => l.visitType === "stay" || !l.visitType
  );
  const lastLoc = [...state.locations]
    .reverse()
    .find((l) => l.visitType === "stay" || !l.visitType);
  const firstCityLabel = firstLoc ? cityName(firstLoc.cityId) : null;
  const lastCityLabel = lastLoc ? cityName(lastLoc.cityId) : null;

  const routeParts: string[] = [];
  if (arrivalHub) routeParts.push(hubShort(arrivalHub));
  for (const loc of state.locations) {
    if (loc.visitType === "stay" || !loc.visitType) {
      routeParts.push(cityName(loc.cityId));
    }
  }
  if (departureHub) {
    const d = hubShort(departureHub);
    if (routeParts[routeParts.length - 1] !== d) routeParts.push(d);
  }

  const days = state.durationDays;
  const dateSpan = !state.arrivalDate
    ? "Dates TBD"
    : `${formatDisplayDate(state.arrivalDate)} – ${formatDisplayDate(departureIso)} (${days} Day${days === 1 ? "" : "s"})`;

  const paceLabel = travelPaceLabel(state.travelPace);
  const experienceLabel =
    state.experienceService === "concierge" || state.isEliteConcierge
      ? "Elite Concierge"
      : state.experienceService === "tailored"
        ? "Tailored Experiences"
        : null;

  const arrivalHubLabel = hubFull(arrivalHub) || "Arrival hub";
  const departureHubLabel = hubFull(departureHub) || "Departure hub";
  const totalGuests = Math.max(1, state.adults + state.children);

  const openLeg = (leg: InterCityTransitLeg) => setTransitLeg(leg);

  const saveLeg = (choice: {
    mode: CityTransitType;
    needsTicket: boolean;
    ticketType: TransitTicketType;
    ticketPricePerPax: number;
  }) => {
    if (!transitLeg) return;
    if (transitLeg.storeKey === "__arrival__") {
      setArrivalTransitChoice(choice);
    } else {
      setLocationTransitChoice(transitLeg.storeKey, choice);
    }
  };

  return (
    <div className="w-full space-y-0 overflow-hidden px-0">
      <section className="overflow-hidden rounded-2xl bg-[#0B1F3A] text-white shadow-[0_12px_40px_rgba(11,31,58,0.25)]">
        <div className="border-b border-dashed border-white/20 px-4 py-4 sm:px-5">
          <div className="min-w-0 overflow-hidden">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#D9BB96]">
              Booking Summary
            </p>
            <p className="mt-1 font-display text-lg leading-tight text-white sm:text-xl">
              Elite Travel Experiences
            </p>
          </div>
          <div className="mt-3 flex w-full items-stretch gap-2">
            <div className="min-w-0 flex-1">
              <BookingRefBadge
                tempBookingRef={state.tempBookingRef}
                confirmedBookingRef={state.confirmedBookingRef}
                bookingStatus={state.bookingStatus}
              />
            </div>
            <NewBookingResetButton />
          </div>
        </div>

        <div className="grid gap-4 px-5 py-5 sm:grid-cols-3">
          <MetaBlock
            icon={<Users className="h-4 w-4 text-[#D9BB96]" />}
            label="Guests"
            value={`${state.adults} Adult${state.adults === 1 ? "" : "s"}, ${state.children} Child${state.children === 1 ? "" : "ren"}`}
          />
          <MetaBlock
            icon={<CalendarDays className="h-4 w-4 text-[#D9BB96]" />}
            label="Dates"
            value={dateSpan}
          />
          <MetaBlock
            icon={<Route className="h-4 w-4 text-[#D9BB96]" />}
            label="Route"
            value={
              routeParts.length
                ? routeParts.join(" ➔ ")
                : "Add cities in the builder"
            }
          />
        </div>

        {paceLabel || experienceLabel ? (
          <div className="flex flex-wrap gap-2 border-t border-dashed border-white/15 px-5 py-3">
            {paceLabel ? (
              <span className="rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-white/85">
                {paceLabel} pace
              </span>
            ) : null}
            {experienceLabel ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#B85304]/45 bg-[#B85304]/10 px-2.5 py-1 text-[11px] text-[#F3D9C4]">
                <Sparkles className="h-3 w-3" aria-hidden />
                {experienceLabel}
              </span>
            ) : null}
          </div>
        ) : null}
      </section>

      {(state.experienceService === "concierge" ||
        state.isEliteConcierge) && (
        <>
          <TimelineSpine />
          <TicketCard accent="gold">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#B85304]" />
              <div>
                <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[#0B1F3A]">
                  Elite Concierge
                </h2>
                <p className="mt-2 text-sm font-semibold text-accent-700">
                  €50 Design Deposit
                </p>
                <p className="mt-2 text-sm text-[#5C6570]">
                  Day-by-day itinerary design included — dining, access, and
                  private drivers coordinated by your specialist. 100% of the
                  €50 fee is credited toward your final trip balance when you
                  book.
                </p>
              </div>
            </div>
          </TicketCard>
        </>
      )}

      <TimelineSpine />

      <TicketCard accent="gold">
        <div className="flex items-center gap-2">
          <PlaneLanding className="h-4 w-4 text-[#B85304]" />
          <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[#0B1F3A]">
            Arrival
            <span className="mx-2 text-[#B85304]">·</span>
            <span className="tracking-normal text-[#5C6570]">
              {formatDisplayDate(state.arrivalDate)}
            </span>
          </h2>
        </div>
        <p className="mt-3 text-base font-semibold text-[#0B1F3A]">
          Landing at {arrivalHubLabel || "Arrival hub TBD"}
        </p>
        {firstCityLabel ? (
          <p className="mt-1 text-sm text-[#5C6570]">
            Transfer to First Destination:{" "}
            <span className="font-semibold text-[#0B1F3A]">
              {firstCityLabel}
            </span>
          </p>
        ) : null}

        {state.airportPickup ? (
          <button
            type="button"
            onClick={() =>
              firstLoc
                ? openLeg({
                    fromLabel: hubShort(arrivalHub) || arrivalHubLabel,
                    toLabel: firstCityLabel || "Hotel",
                    mode: "private",
                    storeKey: "__arrival__",
                    toCityId: firstLoc.cityId,
                    needsTicket: false,
                    ticketType: "none",
                    ticketPricePerPax: 0,
                  })
                : undefined
            }
            className="mt-3 w-full text-left"
          >
            <ServiceStrip>
              <Car className="mt-0.5 h-4 w-4 shrink-0 text-[#B85304]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#0B1F3A]">
                  VIP Airport Pickup
                  {firstCityLabel ? ` to ${firstCityLabel} Hotel` : ""}
                </p>
                {fleetLabel ? (
                  <p className="text-xs text-[#8A8278]">{fleetLabel}</p>
                ) : (
                  <p className="text-xs text-[#8A8278]">
                    Private chauffeur from terminal to hotel
                  </p>
                )}
              </div>
              <Pencil className="h-3.5 w-3.5 shrink-0 text-[#B85304]/70" />
            </ServiceStrip>
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              firstLoc
                ? openLeg({
                    fromLabel: hubShort(arrivalHub) || arrivalHubLabel,
                    toLabel: firstCityLabel || "Hotel",
                    mode: state.arrivalTransitType ?? "unset",
                    storeKey: "__arrival__",
                    toCityId: firstLoc.cityId,
                    needsTicket: state.arrivalNeedsTicket,
                    ticketType: state.arrivalTicketType,
                    ticketPricePerPax: state.arrivalTicketPricePerPax,
                  })
                : undefined
            }
            className="mt-3 w-full text-left"
          >
            <ServiceStrip>
              {(state.arrivalTransitType ?? "unset") === "private" ? (
                <Car className="mt-0.5 h-4 w-4 shrink-0 text-[#B85304]" />
              ) : (state.arrivalTransitType ?? "unset") === "public" ? (
                <TrainFront className="mt-0.5 h-4 w-4 shrink-0 text-[#B85304]" />
              ) : (
                <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#0B1F3A]">
                  {(state.arrivalTransitType ?? "unset") === "unset"
                    ? "⚠️ Transfer Not Configured — Tap to Set Up"
                    : (state.arrivalTransitType ?? "unset") === "self"
                      ? `Self-Arranged / On Your Own${firstCityLabel ? ` to ${firstCityLabel}` : ""}`
                      : (state.arrivalTransitType ?? "unset") === "private"
                        ? `Private Chauffeur${firstCityLabel ? ` to ${firstCityLabel} Hotel` : ""}`
                        : `Airport Express Rail${firstCityLabel ? ` to ${firstCityLabel}` : ""}`}
                </p>
                <p className="text-xs text-[#8A8278]">
                  {(state.arrivalTransitType ?? "unset") === "public" &&
                  state.arrivalNeedsTicket &&
                  (state.arrivalTicketPricePerPax ?? 0) > 0
                    ? `Tickets pre-booked · Est. €${Math.round(
                        (state.arrivalTicketPricePerPax ?? 0) * totalGuests
                      )}`
                    : (state.arrivalTransitType ?? "unset") === "public"
                      ? "Self-purchase tickets on site"
                      : (state.arrivalTransitType ?? "unset") === "self"
                        ? "€0 · arranged independently"
                        : (state.arrivalTransitType ?? "unset") === "unset"
                          ? "Choose Self-Arranged, Public Rail, or Private Chauffeur"
                          : fleetLabel || "Door-to-door transfer"}
                </p>
              </div>
              <Pencil className="h-3.5 w-3.5 shrink-0 text-[#B85304]/70" />
            </ServiceStrip>
          </button>
        )}
      </TicketCard>

      {/* City cards + inter-city connectors only (no airport↔city pills) */}
      {state.locations.length === 0 ? (
        <>
          <TimelineSpine />
          <TicketCard accent="muted">
            <p className="text-sm text-[#8A8278]">
              No cities on your route yet.{" "}
              <Link
                href="/builder"
                className="font-semibold text-[#0B1F3A] underline"
              >
                Add locations in the builder
              </Link>
              .
            </p>
          </TicketCard>
        </>
      ) : (
        state.locations.map((loc, i) => {
          const nextStay = state.locations
            .slice(i + 1)
            .find((l) => l.visitType === "stay" || !l.visitType);
          const isStay = loc.visitType === "stay" || !loc.visitType;
          return (
            <LocationSegment
              key={loc.key}
              loc={loc}
              index={i}
              next={isStay ? nextStay : undefined}
              cityLabel={cityName(loc.cityId)}
              nextCityLabel={nextStay ? cityName(nextStay.cityId) : ""}
              dateLabel={dateRanges[i]?.label ?? ""}
              config={config}
              state={state}
              onOpenTransit={(leg) => openLeg(leg)}
              totalGuests={totalGuests}
            />
          );
        })
      )}

      <TimelineSpine />

      <TicketCard accent="navy">
        <div className="flex items-center gap-2">
          <PlaneTakeoff className="h-4 w-4 text-[#0B1F3A]" />
          <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[#0B1F3A]">
            Departure
            <span className="mx-2 text-[#B85304]">·</span>
            <span className="tracking-normal text-[#5C6570]">
              {formatDisplayDate(departureIso)}
            </span>
          </h2>
        </div>
        <p className="mt-3 text-base font-semibold text-[#0B1F3A]">
          Departing from {departureHubLabel || "Departure hub TBD"}
        </p>
        {lastCityLabel ? (
          <p className="mt-1 text-sm text-[#5C6570]">
            Transfer from Last Destination:{" "}
            <span className="font-semibold text-[#0B1F3A]">
              {lastCityLabel}
            </span>
          </p>
        ) : null}

        {state.airportDropoff ? (
          <button
            type="button"
            onClick={() =>
              lastLoc
                ? openLeg({
                    fromLabel: lastCityLabel || "Hotel",
                    toLabel: departureHubLabel,
                    mode: "private",
                    storeKey: lastLoc.key,
                    fromCityId: lastLoc.cityId,
                    toIsHub: true,
                    needsTicket: false,
                    ticketType: "none",
                    ticketPricePerPax: 0,
                  })
                : undefined
            }
            className="mt-3 w-full text-left"
          >
            <ServiceStrip>
              <Car className="mt-0.5 h-4 w-4 shrink-0 text-[#B85304]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#0B1F3A]">
                  VIP Airport Drop-off
                  {lastCityLabel ? ` from ${lastCityLabel} Hotel` : ""}
                </p>
                {fleetLabel ? (
                  <p className="text-xs text-[#8A8278]">{fleetLabel}</p>
                ) : (
                  <p className="text-xs text-[#8A8278]">
                    Private chauffeur from hotel to terminal
                  </p>
                )}
              </div>
              <Pencil className="h-3.5 w-3.5 shrink-0 text-[#B85304]/70" />
            </ServiceStrip>
          </button>
        ) : lastLoc ? (
          <button
            type="button"
            onClick={() =>
              openLeg({
                fromLabel: lastCityLabel || "Hotel",
                toLabel: departureHubLabel,
                mode: lastLoc.transitType,
                storeKey: lastLoc.key,
                fromCityId: lastLoc.cityId,
                toIsHub: true,
                needsTicket: lastLoc.needsTicket,
                ticketType: lastLoc.ticketType,
                ticketPricePerPax: lastLoc.ticketPricePerPax,
              })
            }
            className="mt-3 w-full text-left"
          >
            <ServiceStrip>
              {lastLoc.transitType === "private" ? (
                <Car className="mt-0.5 h-4 w-4 shrink-0 text-[#B85304]" />
              ) : lastLoc.transitType === "public" ? (
                <TrainFront className="mt-0.5 h-4 w-4 shrink-0 text-[#B85304]" />
              ) : (
                <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#0B1F3A]">
                  {lastLoc.transitType === "unset"
                    ? "⚠️ Transfer Not Configured — Tap to Set Up"
                    : lastLoc.transitType === "self"
                      ? `Self-Arranged / On Your Own${lastCityLabel ? ` from ${lastCityLabel}` : ""}`
                      : lastLoc.transitType === "private"
                        ? `Private Chauffeur${lastCityLabel ? ` from ${lastCityLabel} Hotel` : ""}`
                        : `Airport Express Rail${lastCityLabel ? ` from ${lastCityLabel}` : ""}`}
                </p>
                <p className="text-xs text-[#8A8278]">
                  {lastLoc.transitType === "public" &&
                  lastLoc.needsTicket &&
                  (lastLoc.ticketPricePerPax ?? 0) > 0
                    ? `Tickets pre-booked · Est. €${Math.round(
                        (lastLoc.ticketPricePerPax ?? 0) * totalGuests
                      )}`
                    : lastLoc.transitType === "public"
                      ? "Self-purchase tickets on site"
                      : lastLoc.transitType === "self"
                        ? "€0 · arranged independently"
                        : lastLoc.transitType === "unset"
                          ? "Choose Self-Arranged, Public Rail, or Private Chauffeur"
                          : fleetLabel || "Door-to-door transfer"}
                </p>
              </div>
              <Pencil className="h-3.5 w-3.5 shrink-0 text-[#B85304]/70" />
            </ServiceStrip>
          </button>
        ) : null}
      </TicketCard>

      <InterCityTransitModal
        open={transitLeg != null}
        leg={transitLeg}
        config={config}
        totalGuests={totalGuests}
        onClose={() => setTransitLeg(null)}
        onSave={saveLeg}
      />
    </div>
  );
}

function LocationSegment({
  loc,
  index,
  next,
  cityLabel,
  nextCityLabel,
  dateLabel,
  config,
  state,
  onOpenTransit,
  totalGuests,
}: {
  loc: LocationStop;
  index: number;
  next?: LocationStop;
  cityLabel: string;
  nextCityLabel: string;
  dateLabel: string;
  config: BuilderConfig | null;
  state: BuilderState;
  onOpenTransit: (leg: InterCityTransitLeg) => void;
  totalGuests: number;
}) {
  const [open, setOpen] = useState(false);
  const isWaypoint =
    loc.visitType === "arrival" || loc.visitType === "departure";
  const hotelPref = state.cityHotels[loc.cityId];
  const wantsHotel = hotelPref
    ? Boolean(hotelPref.needsHotel)
    : Boolean(state.needHotels);
  const tours = sortSelectedToursChronologically(
    state.selectedTours[loc.cityId] ?? []
  );
  const chauffeurByDate = state.chauffeurSelections[loc.cityId] ?? {};

  const chauffeurLines = Object.entries(chauffeurByDate)
    .filter(([, sel]) => sel && sel.mode !== "none")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, sel]) => {
      const dayNum = tripDayIndex(state.arrivalDate, date);
      const modeLabel =
        sel.mode === "full_day"
          ? "Private Chauffeur"
          : sel.mode === "by_tour"
            ? "By Tour"
            : "—";
      return `Day ${dayNum} (${modeLabel})`;
    });

  const statusParts: string[] = [];
  if (tours.length > 0) {
    statusParts.push(
      `${tours.length} experience${tours.length === 1 ? "" : "s"}`
    );
  }
  if (chauffeurLines.length > 0) {
    statusParts.push(
      `${chauffeurLines.length} chauffeur day${
        chauffeurLines.length === 1 ? "" : "s"
      }`
    );
  }
  if (statusParts.length === 0) {
    statusParts.push("Self-Arranged");
  }
  const statusLabel = statusParts.join(" · ");

  return (
    <>
      <TimelineSpine />
      {isWaypoint ? (
        <TicketCard accent="muted" compact>
          <div className="flex items-center gap-2">
            <CircleDot className="h-3.5 w-3.5 text-[#8A8278]" />
            <div>
              <p className="text-sm font-semibold text-[#0B1F3A]">
                {cityLabel}
              </p>
              <p className="text-xs text-[#8A8278]">
                {loc.visitType === "arrival"
                  ? "Arrival waypoint · 0 nights"
                  : "Departure waypoint · 0 nights"}
                {dateLabel ? ` · ${dateLabel}` : ""}
              </p>
            </div>
          </div>
        </TicketCard>
      ) : (
        <TicketCard accent="plain">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex w-full items-start gap-2 text-left"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div className="flex min-w-0 items-start gap-2 overflow-hidden">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#B85304]" />
                <div className="flex min-w-0 flex-col gap-1 overflow-hidden">
                  <h2 className="break-words text-sm font-semibold leading-tight text-[#0B1F3A] sm:font-display sm:text-xl sm:font-normal">
                    {cityLabel}
                  </h2>
                  <p className="text-sm font-semibold leading-tight text-[#5C6570]">
                    {loc.nights} Night{loc.nights === 1 ? "" : "s"}
                    <span className="font-normal text-[#8A8278]">
                      {" "}
                      · {statusLabel}
                    </span>
                  </p>
                </div>
              </div>
              {dateLabel ? (
                <p className="text-xs leading-tight text-[#8A8278] sm:shrink-0 sm:text-right">
                  {dateLabel}
                </p>
              ) : null}
            </div>
            <ChevronDown
              className={`mt-0.5 h-4 w-4 shrink-0 text-[#B85304]/80 transition-transform duration-200 ${
                open ? "rotate-180" : ""
              }`}
              aria-hidden
            />
          </button>

          <div
            className={`grid transition-[grid-template-rows] duration-200 ease-out ${
              open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="overflow-hidden">
              {wantsHotel ? (
                <div className="mt-4 flex w-full items-start gap-2 overflow-hidden border-t border-dashed border-[#E8E2D9] pt-3">
                  <BedDouble className="mt-0.5 h-4 w-4 shrink-0 text-[#B85304]" />
                  <div className="flex min-w-0 flex-col gap-1 overflow-hidden">
                    <p className="break-words text-sm font-semibold leading-tight text-[#0B1F3A]">
                      {hotelPref
                        ? `${hotelPref.starRating}-Star Hotel Tier`
                        : `${state.hotelTier === "5-star" ? "5" : "4"}-Star Hotel Tier`}
                    </p>
                    <p className="break-words text-sm leading-tight text-[#5C6570]">
                      {hotelPref
                        ? (() => {
                            const n = normalizeCityHotelPref(
                              hotelPref,
                              loc.cityId,
                              state.roomCount
                            );
                            return (
                              formatHotelRoomsSummary(
                                n.rooms,
                                n.standardOccupancy
                              ) || `${state.roomCount}× Room`
                            );
                          })()
                        : `${state.roomCount}× ${state.roomType} Room`}
                      {hotelPref ? (
                        <span className="text-[#8A8278]">
                          {" "}
                          · {hotelPref.breakfast ? "Breakfast" : "No breakfast"}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex w-full items-center gap-2 overflow-hidden border-t border-dashed border-[#E8E2D9] pt-3 text-xs italic text-[#8A8278]">
                  <BedDouble className="h-4 w-4 shrink-0 text-[#D9D2C7]" />
                  <span>Accommodation Self-Arranged (No Hotel Required)</span>
                </div>
              )}

              {tours.length > 0 ? (
                <ul className="mt-3 space-y-2 border-t border-dashed border-[#E8E2D9] pt-3">
                  {tours.map((row) => {
                    const tour = config?.tours.find((t) => t.id === row.tourId);
                    const hours = tour?.duration_hours ?? row.duration_hours;
                    return (
                      <li
                        key={`${row.tourId}-${row.scheduledDate}`}
                        className="flex items-start gap-2 text-sm"
                      >
                        <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-[#B85304]" />
                        <span>
                          <span className="font-medium text-[#0B1F3A]">
                            {tour?.title ?? row.title ?? row.tourId}
                          </span>
                          {hours ? (
                            <span className="text-[#8A8278]">, {hours}h</span>
                          ) : null}
                          {row.selectedLanguage ? (
                            <span className="text-[#8A8278]">
                              {" "}
                              · {row.selectedLanguage}
                            </span>
                          ) : null}
                          {row.scheduledDate ? (
                            <span className="mt-0.5 block text-xs text-[#8A8278]">
                              {formatCityDateSingle(row.scheduledDate) ||
                                formatDisplayDate(row.scheduledDate)}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {chauffeurLines.length > 0 ? (
                <div className="mt-3 flex items-start gap-2 border-t border-dashed border-[#E8E2D9] pt-3">
                  <Car className="mt-0.5 h-4 w-4 shrink-0 text-[#B85304]" />
                  <p className="text-sm text-[#5C6570]">
                    <span className="font-semibold text-[#0B1F3A]">
                      Private Chauffeur:
                    </span>{" "}
                    {chauffeurLines.join(", ")}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <span className="sr-only">Stop {index + 1}</span>
        </TicketCard>
      )}

      {next ? (
        <TransitConnectorPill
          mode={loc.transitType}
          toLabel={nextCityLabel}
          fromLabel={cityLabel}
          needsTicket={loc.needsTicket}
          ticketPricePerPax={loc.ticketPricePerPax}
          ticketType={loc.ticketType}
          totalGuests={totalGuests}
          onClick={() =>
            onOpenTransit({
              fromLabel: cityLabel,
              toLabel: nextCityLabel,
              mode: loc.transitType,
              storeKey: loc.key,
              fromCityId: loc.cityId,
              toCityId: next.cityId,
              needsTicket: loc.needsTicket,
              ticketType: loc.ticketType,
              ticketPricePerPax: loc.ticketPricePerPax,
            })
          }
        />
      ) : null}
    </>
  );
}

function TransitConnectorPill({
  mode,
  toLabel,
  fromLabel,
  toIsHub,
  needsTicket,
  ticketPricePerPax,
  ticketType,
  totalGuests,
  onClick,
}: {
  mode: CityTransitType;
  toLabel: string;
  fromLabel: string;
  toIsHub?: boolean;
  needsTicket?: boolean;
  ticketPricePerPax?: number;
  ticketType?: string;
  totalGuests?: number;
  onClick: () => void;
}) {
  const privateLabel = toIsHub
    ? `Private Chauffeur from ${fromLabel} to ${toLabel}`
    : `Private Chauffeur to ${toLabel}`;
  const publicLabel = toIsHub
    ? `Express Rail from ${fromLabel} to ${toLabel}`
    : `Bullet Train (Shinkansen) to ${toLabel}`;
  const selfLabel = toIsHub
    ? `Self-Arranged / On Your Own to ${toLabel}`
    : `Self-Arranged / On Your Own to ${toLabel}`;

  const isUnset = mode === "unset";
  const isSelf = mode === "self";

  const ticketNote =
    mode === "public" && needsTicket && (ticketPricePerPax ?? 0) > 0
      ? `Tickets pre-booked · Est. €${Math.round(
          (ticketPricePerPax ?? 0) * Math.max(1, totalGuests ?? 1)
        )}`
      : mode === "public" && needsTicket === false
        ? "Self-purchase tickets"
        : isSelf
          ? "€0 · arranged independently"
          : null;

  return (
    <>
      <TimelineSpine />
      <div className="flex w-full justify-center overflow-hidden px-1 py-0.5">
        <button
          type="button"
          onClick={onClick}
          className={`group my-2 inline-flex max-w-full cursor-pointer flex-col items-center gap-1 rounded-full border px-3 py-2 text-xs font-semibold shadow-sm transition-all sm:px-4 ${
            isUnset
              ? "border-accent-500/40/70 bg-accent-50 text-accent-950 hover:border-accent-500 hover:shadow-md"
              : "border-zinc-200 bg-white text-zinc-800 hover:border-[#B85304] hover:shadow-md"
          }`}
          aria-label={
            isUnset
              ? `Configure transit from ${fromLabel} to ${toLabel}`
              : `Change transit from ${fromLabel} to ${toLabel}`
          }
        >
          <span className="inline-flex max-w-full items-center gap-2 break-words text-center leading-tight">
            {isUnset ? (
              <span aria-hidden>⚠️</span>
            ) : mode === "private" ? (
              <Car className="h-3.5 w-3.5 text-[#B85304]" />
            ) : mode === "public" ? (
              <TrainFront className="h-3.5 w-3.5 text-[#B85304]" />
            ) : (
              <CircleDot className="h-3.5 w-3.5 text-zinc-400" />
            )}
            {isUnset
              ? "Transfer Not Configured — Tap to Set Up"
              : isSelf
                ? selfLabel
                : mode === "private"
                  ? privateLabel
                  : publicLabel}
            <Pencil className="h-3 w-3 text-zinc-400 opacity-0 transition group-hover:opacity-100" />
          </span>
          {ticketNote ? (
            <span
              className={`text-[10px] font-medium ${
                isSelf ? "text-zinc-500" : "text-accent-700"
              }`}
            >
              {ticketNote}
              {mode === "public" && ticketType && ticketType !== "none"
                ? ticketType === "ic_card"
                  ? " · IC card"
                  : " · Shinkansen"
                : ""}
            </span>
          ) : null}
        </button>
      </div>
    </>
  );
}

function TicketCard({
  children,
  accent,
  compact,
}: {
  children: React.ReactNode;
  accent: "gold" | "navy" | "plain" | "muted";
  compact?: boolean;
}) {
  const border =
    accent === "gold"
      ? "border-l-[3px] border-l-[#B85304]"
      : accent === "navy"
        ? "border-l-[3px] border-l-[#0B1F3A]"
        : accent === "muted"
          ? "border-l-[3px] border-l-[#D9D2C7]"
          : "border-l-[3px] border-l-[#E8E2D9]";

  return (
    <section
      className={`w-full overflow-hidden rounded-2xl border border-[#E8E2D9] bg-white shadow-[0_2px_12px_rgba(11,31,58,0.04)] ${border} ${
        compact ? "px-4 py-3" : "px-4 py-4 sm:px-5"
      }`}
    >
      {children}
    </section>
  );
}

function ServiceStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex items-start gap-2.5 border-t border-dashed border-[#E8E2D9] pt-3">
      {children}
    </div>
  );
}

function MetaBlock({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        {icon}
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-[#D9BB96]">
          {label}
        </p>
      </div>
      <p className="text-sm leading-snug text-white/90">{value}</p>
    </div>
  );
}

function TimelineSpine() {
  return (
    <div className="flex justify-center py-1" aria-hidden>
      <div className="h-5 w-px border-l border-dashed border-[#0B1F3A]/30" />
    </div>
  );
}

function isHub(h: PbHub | PbTransfer): h is PbHub {
  return "name" in h && !("from_location" in h);
}

function hubFull(h: PbHub | PbTransfer | null): string {
  if (!h) return "";
  if (isHub(h)) return h.name;
  return transferLocation(h);
}

function hubShort(h: PbHub | PbTransfer | null): string {
  if (!h) return "";
  const full = hubFull(h);
  const code = full.match(/\(([A-Z]{3})\)/)?.[1];
  if (code) return code;
  const lower = full.toLowerCase();
  if (lower.includes("narita")) return "NRT";
  if (lower.includes("haneda")) return "HND";
  if (lower.includes("kansai") || lower.includes("osaka")) return "KIX";
  if (lower.includes("chubu") || lower.includes("nagoya")) return "NGO";
  return full.split(/[·(]/)[0]?.trim() || full;
}

function tripDayIndex(arrivalIso: string | null, date: string): number {
  if (!arrivalIso || !date) return 1;
  const [ay, am, ad] = arrivalIso.split("-").map(Number);
  const [by, bm, bd] = date.split("-").map(Number);
  if (!ay || !am || !ad || !by || !bm || !bd) return 1;
  const a = Date.UTC(ay, am - 1, ad);
  const b = Date.UTC(by, bm - 1, bd);
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

export function resolveHub(
  config: BuilderConfig | null,
  id: string | null | undefined
): PbHub | PbTransfer | null {
  if (!config || !id) return null;
  return (
    config.hubs.find((h) => h.id === id) ||
    config.transfers.find((t) => t.id === id) ||
    null
  );
}
