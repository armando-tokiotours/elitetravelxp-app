"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BedDouble,
  CalendarDays,
  Car,
  ChevronDown,
  CircleDot,
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
import { CityThumb } from "@/components/builder/CityThumb";
import { NewBookingResetButton } from "@/components/builder/NewBookingResetButton";
import { type TransitTicketType } from "@/lib/transitTickets";
import {
  InterCityTransitModal,
  type InterCityTransitLeg,
} from "@/components/builder/modals/InterCityTransitModal";
import { isTransitHubStop } from "@/lib/transitHubs";
import { travelStyleTierRules } from "@/lib/preEliteHydrate";

export function TravelDossierView({
  state,
  config,
  departureIso,
  dateRanges,
  fleetLabel: _fleetLabel,
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

  const stayLocations = state.locations.filter(
    (l) => !isTransitHubStop(l) && (l.visitType === "stay" || !l.visitType)
  );
  const firstLoc = stayLocations[0] ?? null;
  const lastLoc = stayLocations[stayLocations.length - 1] ?? null;
  const firstCityLabel = firstLoc ? cityName(firstLoc.cityId) : null;
  const lastCityLabel = lastLoc ? cityName(lastLoc.cityId) : null;
  const arrivalTransferLine = arrivalTransferSubtext(state, firstCityLabel);
  const departureTransferLine = departureTransferSubtext(
    state,
    lastCityLabel,
    hubShort(departureHub)
  );

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
    <div
      id="itinerary-dossier-view"
      className="w-full space-y-0 overflow-hidden px-0"
    >
      <section className="overflow-hidden rounded-2xl bg-[#0B1F3A] text-white shadow-[0_12px_40px_rgba(11,31,58,0.25)]">
        <div className="border-b border-dashed border-white/20 px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/tokiotours-logo.png"
              alt="TOKIOTOURS"
              className="h-11 w-11 shrink-0 rounded-full object-cover"
            />
            <div className="min-w-0">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#075473]">
                Booking Summary
              </p>
              <p className="mt-1 font-display text-lg leading-tight text-white sm:text-xl">
                TOKIOTOURS
              </p>
            </div>
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
            icon={<Users className="h-4 w-4 text-[#075473]" />}
            label="Guests"
            value={`${state.adults} Adult${state.adults === 1 ? "" : "s"}, ${state.children} Child${state.children === 1 ? "" : "ren"}`}
          />
          <MetaBlock
            icon={<CalendarDays className="h-4 w-4 text-[#075473]" />}
            label="Dates"
            value={dateSpan}
          />
          <MetaBlock
            icon={<Route className="h-4 w-4 text-[#075473]" />}
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
              <span className="inline-flex items-center gap-1 rounded-full border border-[#075473]/45 bg-[#075473]/10 px-2.5 py-1 text-[11px] text-[#F3D9C4]">
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
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#075473]" />
              <div>
                <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-white">
                  Elite Concierge
                </h2>
                <p className="mt-2 text-sm font-semibold text-[#F6A724]">
                  €50 Design Deposit
                </p>
                <p className="mt-2 text-sm text-white/60">
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
          <PlaneLanding className="h-4 w-4 text-[#075473]" />
          <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-white">
            Arrival
            <span className="mx-2 text-[#075473]">·</span>
            <span className="tracking-normal text-white/60">
              {formatDisplayDate(state.arrivalDate)}
            </span>
          </h2>
        </div>
        <p className="mt-3 text-base font-semibold text-white">
          Landing at {arrivalHubLabel || "Arrival hub TBD"}
        </p>
        <p className="mt-1 text-sm text-white/60">{arrivalTransferLine}</p>
      </TicketCard>

      {/* Stay stops only — arrival/departure waypoint cards are folded into the airport nodes */}
      {stayLocations.length === 0 ? (
        <>
          <TimelineSpine />
          <TicketCard accent="muted">
            <p className="text-sm text-white/45">
              No cities on your route yet.{" "}
              <Link
                href="/builder"
                className="font-semibold text-white underline"
              >
                Add locations in the builder
              </Link>
              .
            </p>
          </TicketCard>
        </>
      ) : (
        stayLocations.map((loc, stayIndex) => {
          const nextStay = stayLocations[stayIndex + 1] ?? undefined;
          const originalIndex = state.locations.indexOf(loc);
          return (
            <LocationSegment
              key={loc.key}
              loc={loc}
              index={stayIndex}
              next={nextStay}
              cityLabel={cityName(loc.cityId)}
              nextCityLabel={nextStay ? cityName(nextStay.cityId) : ""}
              dateLabel={dateRanges[originalIndex]?.label ?? ""}
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
          <PlaneTakeoff className="h-4 w-4 text-white" />
          <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-white">
            Departure
            <span className="mx-2 text-[#075473]">·</span>
            <span className="tracking-normal text-white/60">
              {formatDisplayDate(departureIso)}
            </span>
          </h2>
        </div>
        <p className="mt-3 text-base font-semibold text-white">
          Departure from {departureHubLabel || "Departure hub TBD"}
        </p>
        <p className="mt-1 text-sm text-white/60">{departureTransferLine}</p>
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
  const city = config?.cities.find((c) => c.id === loc.cityId);
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
  const nightsLabel = `${loc.nights} night${loc.nights === 1 ? "" : "s"}`;

  return (
    <>
      <TimelineSpine />
      <section className="w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]/90 text-white shadow-lg">
          <div className="relative h-36 w-full bg-[#0B1728]">
            <CityThumb
              city={city}
              name={cityLabel}
              alt={cityLabel}
              thumb="600x400"
              className="h-36 w-full object-cover"
            />
            <span className="absolute left-3 top-3 inline-flex rounded-full bg-[#075473] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-sm">
              Stop {index + 1}
            </span>
          </div>

          <div className="p-5">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="flex w-full items-start gap-2 text-left"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-hidden sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="flex min-w-0 flex-col gap-1 overflow-hidden">
                  <h2 className="break-words font-display text-2xl leading-tight text-white">
                    {cityLabel}
                  </h2>
                  <p className="text-sm font-semibold leading-tight text-white/70">
                    {nightsLabel}
                    <span className="font-normal text-white/45">
                      {" "}
                      · {statusLabel}
                    </span>
                  </p>
                </div>
                {dateLabel ? (
                  <p className="text-xs leading-tight text-[#F6A724] sm:shrink-0 sm:pt-1 sm:text-right">
                    {dateLabel}
                  </p>
                ) : null}
              </div>
              <ChevronDown
                className={`mt-1 h-4 w-4 shrink-0 text-[#F6A724] transition-transform duration-200 ${
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
                  <div className="mt-4 flex w-full items-start gap-2 overflow-hidden border-t border-dashed border-white/10 pt-3">
                    <BedDouble className="mt-0.5 h-4 w-4 shrink-0 text-[#075473]" />
                    <div className="flex min-w-0 flex-col gap-1 overflow-hidden">
                      <p className="break-words text-sm font-semibold leading-tight text-white">
                        {hotelPref
                          ? `${hotelPref.starRating}-Star Hotel Tier`
                          : `${state.hotelTier === "5-star" ? "5" : "4"}-Star Hotel Tier`}
                      </p>
                      <p className="break-words text-sm leading-tight text-white/60">
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
                          <span className="text-white/45">
                            {" "}
                            ·{" "}
                            {hotelPref.breakfast
                              ? "Breakfast"
                              : "No breakfast"}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex w-full items-center gap-2 overflow-hidden border-t border-dashed border-white/10 pt-3 text-xs italic text-white/45">
                    <BedDouble className="h-4 w-4 shrink-0 text-[#D9D2C7]" />
                    <span>
                      Accommodation Self-Arranged (No Hotel Required)
                    </span>
                  </div>
                )}

                {tours.length > 0 ? (
                  <ul className="mt-3 space-y-2 border-t border-dashed border-white/10 pt-3">
                    {tours.map((row) => {
                      const tour = config?.tours.find(
                        (t) => t.id === row.tourId
                      );
                      const hours =
                        tour?.duration_hours ?? row.duration_hours;
                      return (
                        <li
                          key={`${row.tourId}-${row.scheduledDate}`}
                          className="flex items-start gap-2 text-sm"
                        >
                          <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-[#075473]" />
                          <span>
                            <span className="font-medium text-white">
                              {tour?.title ?? row.title ?? row.tourId}
                            </span>
                            {hours ? (
                              <span className="text-white/45">
                                , {hours}h
                              </span>
                            ) : null}
                            {row.selectedLanguage ? (
                              <span className="text-white/45">
                                {" "}
                                · {row.selectedLanguage}
                              </span>
                            ) : null}
                            {row.scheduledDate ? (
                              <span className="mt-0.5 block text-xs text-white/45">
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
                  <div className="mt-3 flex items-start gap-2 border-t border-dashed border-white/10 pt-3">
                    <Car className="mt-0.5 h-4 w-4 shrink-0 text-[#075473]" />
                    <p className="text-sm text-white/60">
                      <span className="font-semibold text-white">
                        Private Chauffeur:
                      </span>{" "}
                      {chauffeurLines.join(", ")}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>


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
              ? "border-[#F6A724]/50 bg-[#F6A724]/15 text-[#F6A724] hover:border-[#F6A724] hover:shadow-md"
              : "border-white/20 bg-[#0D1117] text-white hover:border-[#075473] hover:shadow-md"
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
              <Car className="h-3.5 w-3.5 text-[#F6A724]" />
            ) : mode === "public" ? (
              <TrainFront className="h-3.5 w-3.5 text-[#F6A724]" />
            ) : (
              <CircleDot className="h-3.5 w-3.5 text-white/40" />
            )}
            {isUnset
              ? "Transfer Not Configured — Tap to Set Up"
              : isSelf
                ? selfLabel
                : mode === "private"
                  ? privateLabel
                  : publicLabel}
            <Pencil className="h-3 w-3 text-white/40 opacity-0 transition group-hover:opacity-100" />
          </span>
          {ticketNote ? (
            <span
              className={`text-[10px] font-medium ${
                isSelf ? "text-white/45" : "text-[#F6A724]"
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
      ? "border-l-[3px] border-l-[#F6A724]"
      : accent === "navy"
        ? "border-l-[3px] border-l-[#075473]"
        : accent === "muted"
          ? "border-l-[3px] border-l-white/20"
          : "border-l-[3px] border-l-white/15";

  return (
    <section
      className={`w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]/90 text-white shadow-[0_2px_12px_rgba(0,0,0,0.35)] ${border} ${
        compact ? "px-4 py-3" : "px-4 py-4 sm:px-5"
      }`}
    >
      {children}
    </section>
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
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-[#075473]">
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


function inferredAirportTransferMode(
  state: BuilderState,
  explicit: CityTransitType | undefined,
  isPrivateFlag: boolean
): CityTransitType {
  if (isPrivateFlag) return "private";
  const mode = explicit ?? "unset";
  if (mode !== "unset") return mode;
  const style = state.preEliteTravelStyle;
  if (style) {
    return travelStyleTierRules(style).preferPrivateTransit
      ? "private"
      : "public";
  }
  return "unset";
}

function arrivalTransferSubtext(
  state: BuilderState,
  cityLabel: string | null
): string {
  const city = cityLabel ?? "your destination";
  const mode = inferredAirportTransferMode(
    state,
    state.arrivalTransitType,
    state.airportPickup
  );
  switch (mode) {
    case "private":
      return `Private Chauffeur Transfer to ${city}`;
    case "public":
      return `Transfer to ${city} via Airport Express Rail`;
    case "self":
      return `Self-arranged transfer to ${city}`;
    default:
      return cityLabel
        ? `Transfer to First Destination: ${city}`
        : "Transfer details TBD";
  }
}

function departureTransferSubtext(
  state: BuilderState,
  cityLabel: string | null,
  hubCode: string
): string {
  const city = cityLabel ?? "your hotel";
  const lastStay = [...state.locations]
    .reverse()
    .find(
      (l) =>
        !isTransitHubStop(l) && (l.visitType === "stay" || !l.visitType)
    );
  const mode = inferredAirportTransferMode(
    state,
    lastStay?.transitType,
    state.airportDropoff
  );
  const dest = hubCode || "airport";
  switch (mode) {
    case "private":
      return `Private Chauffeur Transfer from ${city} to ${dest}`;
    case "public":
      return `Transfer from ${city} to ${dest} via Airport Express Rail`;
    case "self":
      return `Self-arranged transfer from ${city} to ${dest}`;
    default:
      return cityLabel
        ? `Transfer from Last Destination: ${city}`
        : "Transfer details TBD";
  }
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
