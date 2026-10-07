"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  BedDouble,
  Car,
  CircleDot,
  ExternalLink,
  Pencil,
  Sparkles,
  TrainFront,
} from "lucide-react";
import {
  pbFileUrl,
  tourMediaFile,
  tourPhoto,
  transferLocation,
  type BuilderConfig,
  type PbHub,
  type PbTransfer,
} from "@/lib/pocketbase/client";
import { PB_THUMBS } from "@/lib/mediaThumbs";
import {
  ItineraryStopTicket,
  resolveItineraryStopKind,
} from "@/components/dossier/ItineraryStopTickets";
import { buildCityMap, getCityName } from "@/lib/cityLabels";
import {
  formatCityDateSingle,
  type CityDateRange,
} from "@/lib/dateCascade";
import {
  formatDisplayDate,
  normalizeCityHotelPref,
  sanitizeHotelUrl,
  useBuilderStore,
  type CityTransitType,
  type LocationStop,
  type BuilderState,
} from "@/store/useBuilderStore";
import {
  formatHotelRoomsSummary,
  totalHotelRooms,
} from "@/lib/hotelCalculator";
import { sortSelectedToursChronologically } from "@/lib/selectedTours";
import { type TransitTicketType } from "@/lib/transitTickets";
import {
  InterCityTransitModal,
  type InterCityTransitLeg,
} from "@/components/builder/modals/InterCityTransitModal";
import { isTransitHubStop } from "@/lib/transitHubs";
import { TRAVEL_STYLES, labelFor } from "@/lib/preEliteBuilder";
import { travelStyleTierRules } from "@/lib/preEliteHydrate";
import { DossierSectionOutline } from "@/components/builder/DossierSectionOutline";
import { BoardingPassCard } from "@/components/builder/BoardingPassCard";
import { JapanBookingPass } from "@/components/dossier/JapanBookingPass";
import { CoordinationTeamSection } from "@/components/dossier/CoordinationTeamSection";
import { DossierTermsFooterSection } from "@/components/dossier/DossierTermsFooterSection";
import {
  DayServiceTicketRow,
  StaffIdentityCard,
  SuicaPassCard,
  TicketStubCard,
} from "@/components/dossier/DayStaffCards";
import { useTicketVoucher } from "@/components/dossier/TicketVoucherDownloadBanner";
import { useConciergeAgentName } from "@/lib/useConciergeAgentName";
import { useOpsBookingSnapshot } from "@/lib/useOpsStaffNames";
import { useAgentServices } from "@/lib/useAgentServices";
import {
  dayServicesFromAgentCart,
  isTicketServiceReady,
  type ServiceLineItem,
} from "@/lib/agentServices";
import {
  normalizeTourDateIso,
  type DayGuideAssignment,
} from "@/lib/guideJobs";
import {
  partitionGuestTickets,
  stayDatesForRange,
} from "@/lib/guestItineraryDays";

function dayGuideForDate(
  dayGuides: DayGuideAssignment[],
  date: string
): DayGuideAssignment | undefined {
  if (!dayGuides.length) return undefined;
  if (date && date !== "undated") {
    const iso = normalizeTourDateIso(date);
    return dayGuides.find((g) => g.tourDate === iso && g.name);
  }
  return dayGuides.find((g) => g.name);
}
import {
  buildDossierQrUrl,
  buildRouteBreakdown,
  experienceTierLabel,
  formatGuestCountText,
  formatPassDateLine,
  mapBookingStatusToPass,
  resolvePnr,
} from "@/lib/dossier/bookingPassHelpers";
import { useItineraryStore } from "@/store/useItineraryStore";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";

export function TravelDossierView({
  state,
  config,
  departureIso,
  dateRanges,
  fleetLabel: _fleetLabel,
  arrivalHub,
  departureHub,
  afterSummary,
  depositPaidEur = 0,
  hasPaidFull = false,
}: {
  state: BuilderState;
  config: BuilderConfig | null;
  departureIso: string | null;
  dateRanges: CityDateRange[];
  fleetLabel: string | null;
  arrivalHub: PbHub | PbTransfer | null;
  departureHub: PbHub | PbTransfer | null;
  /** Concierge video + budget cards — rendered after the ticket pass */
  afterSummary?: ReactNode;
  depositPaidEur?: number;
  hasPaidFull?: boolean;
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
  const clientName = useItineraryStore((s) => s.clientName);
  const clientEmail = useItineraryStore((s) => s.clientEmail);
  const preName = usePreBuilderStore(
    (s) => s.fullName || s.lastPayload?.fullName || ""
  );
  const preEmail = usePreBuilderStore(
    (s) => s.email || s.lastPayload?.email || ""
  );
  const passengerName = (clientName || preName || "").trim();
  const passengerEmail = (clientEmail || preEmail || "").trim().toLowerCase();

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

  const days = state.durationDays;
  const startDateText = formatPassDateLine(state.arrivalDate);
  const endDateText = formatPassDateLine(departureIso);
  const dateSpan = !state.arrivalDate
    ? "Dates TBD"
    : `${formatDisplayDate(state.arrivalDate)} – ${formatDisplayDate(departureIso)} (${days} Day${days === 1 ? "" : "s"})`;

  const arrivalHubLabel = hubFull(arrivalHub) || "Arrival hub";
  const departureHubLabel = hubFull(departureHub) || "Departure hub";
  const totalGuests = Math.max(1, state.adults + state.children);

  const openLeg = (leg: InterCityTransitLeg) => setTransitLeg(leg);

  const styleLabel = state.preEliteTravelStyle
    ? labelFor(TRAVEL_STYLES, state.preEliteTravelStyle)
    : "";
  const originCode = hubShort(arrivalHub) || "NRT";
  const destinationCode = hubShort(departureHub) || "HND";
  const pnrCode = resolvePnr({
    tempBookingRef: state.tempBookingRef,
    confirmedBookingRef: state.confirmedBookingRef,
    bookingStatus: state.bookingStatus,
  });
  const conciergeAgentName = useConciergeAgentName(pnrCode);
  const ops = useOpsBookingSnapshot(pnrCode);
  const agentServices = useAgentServices(pnrCode);
  const dayCart = useMemo(
    () => dayServicesFromAgentCart(agentServices),
    [agentServices]
  );
  const dayTourBuckets = useMemo(() => {
    const buckets: { date: string; tours: ReturnType<typeof sortSelectedToursChronologically> }[] =
      [];
    for (const loc of stayLocations) {
      const originalIndex = state.locations.indexOf(loc);
      const range = dateRanges[originalIndex];
      const dates = stayDatesForRange({
        startDate: range?.startDate,
        endDate: range?.endDate,
        nights: loc.nights,
      });
      const cityTours = sortSelectedToursChronologically(
        state.selectedTours[loc.cityId] ?? []
      );
      const extra = cityTours
        .map((t) => t.scheduledDate)
        .filter((d) => d && !dates.includes(d));
      const allDates = [...dates];
      for (const d of extra) {
        if (!allDates.includes(d)) allDates.push(d);
      }
      if (allDates.length === 0) allDates.push("");
      for (const date of allDates) {
        const isFirst = date === allDates[0];
        buckets.push({
          date,
          tours: cityTours.filter((t) =>
            t.scheduledDate
              ? t.scheduledDate === date
              : Boolean(isFirst)
          ),
        });
      }
    }
    return buckets;
  }, [stayLocations, state.locations, state.selectedTours, dateRanges]);
  const guestTickets = useMemo(
    () =>
      partitionGuestTickets({
        ticketItems: dayCart.ticketItems,
        dayTours: dayTourBuckets,
      }),
    [dayCart.ticketItems, dayTourBuckets]
  );
  const ticketVoucher = useTicketVoucher(pnrCode);
  const guideName = ops.guideName;
  const driverName = ops.driverName;
  const guideLabel = ops.guideLabel;
  const driverLabel = ops.driverLabel;
  const guidePhotoUrl = ops.guidePhotoUrl;
  const guideEmail = ops.guideEmail;
  const guidePhone = ops.guidePhone;
  const guideWhatsapp = ops.guideWhatsapp;
  const guideUnlockMessage = ops.guideUnlockMessage;
  const dayGuides = ops.dayGuides;
  const driverPhotoUrl = ops.driverPhotoUrl;
  const driverEmail = ops.driverEmail;
  const driverPhone = ops.driverPhone;
  const driverUnlockMessage = ops.driverUnlockMessage;
  const agentDisplay = ops.assignedAgent || conciergeAgentName || null;
  const passStatus =
    ops.passStatus ||
    mapBookingStatusToPass(state.bookingStatus, {
      depositPaidEur,
      hasPaidFull,
    });
  const routeBreakdown = buildRouteBreakdown(state.locations, cityName);
  const hasSuica =
    (state.locations || []).some((l) => {
      const t = String(l.ticketType || "").toLowerCase();
      return t.includes("suica") || t.includes("pasmo") || t === "ic_card";
    }) || guestTickets.tripWide.length > 0;
  const hasPrivateDriver =
    Object.values(state.chauffeurSelections || {}).some((byDate) =>
      Object.values(byDate || {}).some((sel) => sel && sel.mode !== "none")
    ) ||
    (state.locations || []).some((l) => l.transitType === "private") ||
    Boolean(dayCart.transitTitle);
  const hasGuidedTours =
    Object.values(state.selectedTours || {}).some(
      (rows) => (rows || []).length > 0
    ) || Boolean(dayCart.guideTitle);
  const experienceType = experienceTierLabel(
    state.experienceService,
    state.isEliteConcierge
  );

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
      className="w-full space-y-4 overflow-visible px-0 print:bg-white print:text-black"
    >
      {/* Section 2 — reusable Japan Booking Pass */}
      <JapanBookingPass
        pnrCode={pnrCode}
        guestName={passengerName || "GUEST"}
        guestEmail={passengerEmail || undefined}
        partyText={formatGuestCountText(state.adults, state.children)}
        travelStyle={styleLabel || "—"}
        tripType={state.tripMode === "single_day" ? "single" : "multi"}
        experienceType={experienceType}
        originCode={originCode}
        originLabel="TOKYO ENTRY"
        destinationCode={destinationCode}
        destinationLabel="DEPARTURE"
        durationText={`${days} DAY${days === 1 ? "" : "S"}`}
        startDateText={startDateText}
        endDateText={endDateText}
        routeBreakdown={routeBreakdown}
        status={passStatus}
        depositPaidEur={depositPaidEur}
        hasPaidFull={hasPaidFull}
        qrValue={buildDossierQrUrl(pnrCode, "/builder/itinerary")}
        conciergeAgentName={agentDisplay}
        editHref="/builder"
      />

      <CoordinationTeamSection
        pnr={pnrCode}
        agentName={agentDisplay}
        guestEmail={passengerEmail || undefined}
        guestName={passengerName || undefined}
        tripPath="/builder/itinerary"
      />

      {afterSummary}

      {/* Section 5 — Continuous day-by-day itinerary */}
      <DossierSectionOutline label="Section 5: Day Timeline">
        <div className="space-y-4 print:break-inside-avoid">
          {(state.experienceService === "concierge" ||
            state.isEliteConcierge) && (
            <TicketCard accent="gold">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 shrink-0 text-[#F6A724]" />
                <h2 className="text-[0.75rem] font-semibold uppercase tracking-[0.28em] text-[#F6A724]">
                  Elite Concierge
                </h2>
              </div>
            </TicketCard>
          )}

          <BoardingPassCard
            kind="arrival"
            compact
            title={`${
              state.arrivalMode === "cruise" ? "Arriving at" : "Landing at"
            } ${arrivalHubLabel || "Arrival hub TBD"}`}
            subtitle={arrivalTransferLine}
            dateLabel={formatDisplayDate(state.arrivalDate) || "Date TBD"}
            hubCode={hubShort(arrivalHub) || "—"}
            hubMode={state.arrivalMode === "cruise" ? "cruise" : "airport"}
            className="mb-2"
          />

          {stayLocations.length === 0 ? (
            <TicketCard accent="muted">
              <p className="text-sm text-white/45">
                No cities on your route yet.{" "}
                <Link
                  href="/builder"
                  className="font-semibold text-[#075473] underline"
                >
                  Add locations in the builder
                </Link>
                .
              </p>
            </TicketCard>
          ) : (
            stayLocations.map((loc, stayIndex) => {
              const nextStay = stayLocations[stayIndex + 1] ?? undefined;
              const originalIndex = state.locations.indexOf(loc);
              const stayRange = dateRanges[originalIndex];
              return (
                <LocationSegment
                  key={loc.key?.trim() || `stay-${loc.cityId || "city"}-${stayIndex}`}
                  loc={loc}
                  index={stayIndex}
                  next={nextStay}
                  cityLabel={cityName(loc.cityId)}
                  nextCityLabel={nextStay ? cityName(nextStay.cityId) : ""}
                  dateLabel={stayRange?.label ?? ""}
                  stayStartDate={stayRange?.startDate}
                  stayEndDate={stayRange?.endDate}
                  config={config}
                  state={state}
                  onOpenTransit={(leg) => openLeg(leg)}
                  totalGuests={totalGuests}
                  guideLabel={hasGuidedTours ? guideLabel : undefined}
                  guideUnlockMessage={
                    hasGuidedTours ? guideUnlockMessage : null
                  }
                  dayGuides={hasGuidedTours ? dayGuides : []}
                  driverName={hasPrivateDriver ? driverName : null}
                  driverLabel={hasPrivateDriver ? driverLabel : undefined}
                  driverPhotoUrl={hasPrivateDriver ? driverPhotoUrl : null}
                  driverEmail={hasPrivateDriver ? driverEmail : null}
                  driverPhone={hasPrivateDriver ? driverPhone : null}
                  driverUnlockMessage={
                    hasPrivateDriver ? driverUnlockMessage : null
                  }
                  carServiceTitle={dayCart.transitTitle}
                  guideServiceTitle={dayCart.guideTitle}
                  ticketStatus={ops.ticketStatus}
                  ticketVoucherUrl={ticketVoucher?.url}
                  ticketVoucherFilename={ticketVoucher?.filename}
                  guestEmail={passengerEmail || undefined}
                  tripWideTickets={guestTickets.tripWide}
                  ticketsByDate={guestTickets.byDate}
                  showTripWidePasses={stayIndex === 0}
                  hasSuica={hasSuica}
                />
              );
            })
          )}

          <BoardingPassCard
            kind="departure"
            compact
            title={`Departure from ${departureHubLabel || "Departure hub TBD"}`}
            subtitle={departureTransferLine}
            dateLabel={formatDisplayDate(departureIso) || "Date TBD"}
            hubCode={hubShort(departureHub) || "—"}
            hubMode={state.departureMode === "cruise" ? "cruise" : "airport"}
            className="mt-2"
          />
        </div>
      </DossierSectionOutline>

      <DossierTermsFooterSection />

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
  stayStartDate,
  stayEndDate,
  config,
  state,
  onOpenTransit,
  totalGuests,
  guideLabel,
  guideUnlockMessage,
  dayGuides = [],
  driverName,
  driverLabel,
  driverPhotoUrl,
  driverEmail,
  driverPhone,
  driverUnlockMessage,
  carServiceTitle,
  guideServiceTitle,
  ticketStatus,
  ticketVoucherUrl,
  ticketVoucherFilename,
  guestEmail,
  tripWideTickets = [],
  ticketsByDate = {},
  showTripWidePasses = false,
  hasSuica = false,
}: {
  loc: LocationStop;
  index: number;
  next?: LocationStop;
  cityLabel: string;
  nextCityLabel: string;
  dateLabel: string;
  stayStartDate?: string;
  stayEndDate?: string;
  config: BuilderConfig | null;
  state: BuilderState;
  onOpenTransit: (leg: InterCityTransitLeg) => void;
  totalGuests: number;
  guideLabel?: string;
  guideUnlockMessage?: string | null;
  dayGuides?: DayGuideAssignment[];
  driverName?: string | null;
  driverLabel?: string;
  driverPhotoUrl?: string | null;
  driverEmail?: string | null;
  driverPhone?: string | null;
  driverUnlockMessage?: string | null;
  carServiceTitle?: string | null;
  guideServiceTitle?: string | null;
  ticketStatus?: string | null;
  ticketVoucherUrl?: string | null;
  ticketVoucherFilename?: string | null;
  guestEmail?: string | null;
  tripWideTickets?: ServiceLineItem[];
  ticketsByDate?: Record<string, ServiceLineItem[]>;
  showTripWidePasses?: boolean;
  hasSuica?: boolean;
}) {
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
      <section className="mb-4 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0A1017]/80 p-0 text-white shadow-2xl backdrop-blur-md print:break-inside-avoid print:rounded-none print:border print:border-gray-300 print:bg-transparent print:text-gray-900 print:shadow-none">
        {/* Empty grey until a city cover is intentionally re-enabled via branding */}
        <div
          className="relative h-36 w-full bg-[#2C2C2E] print:hidden"
          aria-hidden
        />

        <div className="p-5">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#F6A724] print:text-gray-900">
              Stay
              {dateLabel ? ` · ${dateLabel}` : ""}
              {cityLabel ? ` · ${cityLabel}` : ""}
            </p>
            <h2 className="break-words font-godiva text-2xl leading-tight tracking-wide text-white uppercase print:text-gray-900">
              {cityLabel}
              {nightsLabel ? ` · ${nightsLabel}` : ""}
            </h2>
            <p className="text-sm font-semibold leading-tight text-white/70 print:text-gray-700">
              {statusLabel}
            </p>
          </div>

          {/* Always-visible day details — no accordion */}
          {wantsHotel ? (
            <div className="mt-4 flex w-full items-start gap-2 overflow-hidden border-t border-dashed border-white/10 pt-3">
              <BedDouble className="mt-0.5 h-4 w-4 shrink-0 text-[#075473]" />
              <div className="flex min-w-0 flex-col gap-1 overflow-hidden">
                {(() => {
                  const n = hotelPref
                    ? normalizeCityHotelPref(
                        hotelPref,
                        loc.cityId,
                        state.roomCount
                      )
                    : null;
                  const tierLabel = n
                    ? `${n.starRating}-Star Hotel Tier`
                    : `${state.hotelTier === "5-star" ? "5" : "4"}-Star Hotel Tier`;
                  const hotelName = (n?.hotelName || "").trim();
                  const hotelUrl = sanitizeHotelUrl(n?.hotelUrl);
                  const reserved =
                    n && totalHotelRooms(n.rooms) > 0
                      ? totalHotelRooms(n.rooms)
                      : Math.max(1, Number(state.roomCount) || 1);
                  const mix =
                    n &&
                    (formatHotelRoomsSummary(n.rooms, n.standardOccupancy) ||
                      `${state.roomCount}× Room`);
                  return (
                    <>
                      <p className="break-words text-sm font-semibold leading-tight text-white">
                        {hotelName || tierLabel}
                      </p>
                      {hotelName ? (
                        <p className="break-words text-[11px] font-semibold uppercase tracking-wider text-white/45">
                          {tierLabel}
                        </p>
                      ) : (
                        <p className="break-words text-sm leading-tight text-white/50">
                          Hotel to be confirmed
                        </p>
                      )}
                      <p className="break-words text-sm leading-tight text-white/70">
                        {reserved}{" "}
                        {reserved === 1
                          ? "room reserved"
                          : "rooms reserved"}
                      </p>
                      <p className="break-words text-sm leading-tight text-white/60">
                        {mix || `${state.roomCount}× ${state.roomType} Room`}
                        {n ? (
                          <span className="text-white/45">
                            {" "}
                            · {n.breakfast ? "Breakfast" : "No breakfast"}
                          </span>
                        ) : null}
                      </p>
                      {hotelUrl ? (
                        <a
                          href={hotelUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-1 break-all text-sm font-semibold leading-tight text-[#F6A724] underline decoration-[#F6A724]/40 underline-offset-2 hover:text-[#F6A724] print:text-gray-900"
                        >
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0 truncate">{hotelUrl}</span>
                        </a>
                      ) : (
                        <p className="text-sm leading-tight text-white/40">
                          Hotel link pending
                        </p>
                      )}
                    </>
                  );
                })()}
                {next ? (
                  <p
                    className={`text-[11px] font-semibold uppercase tracking-wider ${
                      loc.transitType === "unset"
                        ? "text-[#E60F43]"
                        : loc.transitType === "self"
                          ? "text-white/45"
                          : "text-[#F6A724]"
                    }`}
                  >
                    {loc.transitType === "unset"
                      ? "! Transport · action required"
                      : loc.transitType === "self"
                        ? "Transport · self-arranged"
                        : loc.transitType === "public"
                          ? "Transport · public / rail"
                          : "Transport · private"}
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-4 flex w-full flex-col gap-1 overflow-hidden border-t border-dashed border-white/10 pt-3 text-xs italic text-white/45">
              <div className="flex items-center gap-2">
                <BedDouble className="h-4 w-4 shrink-0 text-white/30" />
                <span>Accommodation Self-Arranged (No Hotel Required)</span>
              </div>
              {next ? (
                <p
                  className={`pl-6 text-[11px] font-semibold not-italic uppercase tracking-wider ${
                    loc.transitType === "unset"
                      ? "text-[#E60F43]"
                      : loc.transitType === "self"
                        ? "text-white/45"
                        : "text-[#F6A724]"
                  }`}
                >
                  {loc.transitType === "unset"
                    ? "! Transport · action required"
                    : loc.transitType === "self"
                      ? "Transport · self-arranged"
                      : loc.transitType === "public"
                        ? "Transport · public / rail"
                        : "Transport · private"}
                </p>
              ) : null}
            </div>
          )}

          {showTripWidePasses ? (
            <div className="mt-3 space-y-2 border-t border-dashed border-white/10 pt-3">
              {(hasSuica || tripWideTickets.length > 0) && (
                <>
                  <p className="text-[9px] font-semibold tracking-wider text-zinc-500 uppercase print:text-gray-600">
                    Trip-wide passes
                  </p>
                  <SuicaPassCard active={hasSuica} />
                  {tripWideTickets.map((item) => {
                    const itemUrl = String(item.voucherUrl || "").trim();
                    const ready = isTicketServiceReady(item, {
                      opsTicketStatus: ticketStatus,
                      hasVoucher: Boolean(itemUrl || ticketVoucherUrl),
                    });
                    return (
                      <DayServiceTicketRow
                        key={item.id}
                        title={item.title}
                        ready={ready}
                        downloadUrl={ready && itemUrl ? itemUrl : null}
                        downloadFilename={
                          ready && itemUrl
                            ? item.voucherFilename ||
                              ticketVoucherFilename ||
                              null
                            : null
                        }
                        guestEmail={guestEmail}
                      />
                    );
                  })}
                </>
              )}
            </div>
          ) : null}

          {(() => {
            const stayDates = stayDatesForRange({
              startDate: stayStartDate,
              endDate: stayEndDate,
              nights: loc.nights,
            });
            const extraDates = tours
              .map((t) => t.scheduledDate)
              .filter((d) => d && !stayDates.includes(d));
            const dates = [...stayDates];
            for (const d of extraDates) {
              if (!dates.includes(d)) dates.push(d);
            }
            if (dates.length === 0 && tours.length > 0) {
              dates.push(tours[0]?.scheduledDate || state.arrivalDate || "");
            }
            const uniqueDates = dates.filter(Boolean);
            if (uniqueDates.length === 0) return null;

            const ticketType = String(loc.ticketType || "").toLowerCase();
            const isIcPass =
              ticketType.includes("suica") ||
              ticketType.includes("pasmo") ||
              ticketType === "ic_card";
            const showRailOnLastDay =
              loc.transitType === "public" &&
              loc.needsTicket &&
              !isIcPass;

            return (
              <div className="mt-3 space-y-8 border-t border-dashed border-white/10 pt-4">
                {uniqueDates.map((date, dayIdx) => {
                  const dayTours = tours.filter((t) =>
                    t.scheduledDate
                      ? t.scheduledDate === date
                      : dayIdx === 0
                  );
                  const chauffeur = chauffeurByDate[date];
                  const hasCar = Boolean(
                    chauffeur && chauffeur.mode !== "none"
                  );
                  const dayGuide = dayGuideForDate(dayGuides, date);
                  const needsGuide = dayTours.some((row) => {
                    const tour = config?.tours.find((t) => t.id === row.tourId);
                    return tour?.is_self_guided !== true;
                  });
                  const showGuide = Boolean(dayGuide?.name) || needsGuide;
                  const dayTickets = ticketsByDate[date] || [];
                  const dayNum = tripDayIndex(state.arrivalDate, date);
                  const isLastStayDay = dayIdx === uniqueDates.length - 1;
                  const showRailStub = showRailOnLastDay && isLastStayDay;

                  return (
                    <div key={date} className="space-y-3">
                      <h3 className="text-white font-semibold tracking-wide">
                        Day {dayNum}
                        <span className="ml-2 text-sm font-normal text-white/45">
                          {formatCityDateSingle(date) ||
                            formatDisplayDate(date)}
                        </span>
                      </h3>

                      {hasCar ? (
                        <StaffIdentityCard
                          role="driver"
                          name={driverName}
                          photoUrl={driverPhotoUrl}
                          email={driverEmail}
                          phone={driverPhone}
                          unlockMessage={driverUnlockMessage}
                          emptyLabel={driverLabel}
                          serviceTitle={carServiceTitle}
                          serviceHint="Vehicle secured · Pending assignment"
                        />
                      ) : null}

                      {showGuide ? (
                        <StaffIdentityCard
                          role="guide"
                          name={dayGuide?.name || null}
                          photoUrl={dayGuide?.photoUrl || null}
                          email={dayGuide?.email || null}
                          phone={dayGuide?.phone || null}
                          whatsappDigits={dayGuide?.whatsappDigits || null}
                          unlockMessage={
                            dayGuide?.unlockMessage ||
                            (!dayGuide?.name ? null : guideUnlockMessage)
                          }
                          emptyLabel={
                            dayGuide
                              ? undefined
                              : guideLabel || "Pending assignment"
                          }
                          serviceTitle={
                            dayGuide?.name
                              ? dayGuide.tourName
                              : guideServiceTitle
                          }
                          serviceHint={
                            dayGuide?.name
                              ? "Confirmed for this day"
                              : "Pending assignment"
                          }
                        />
                      ) : null}

                      {dayTickets.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-white/45">
                            Today&apos;s tickets
                          </p>
                          {dayTickets.map((item) => {
                            const itemUrl = String(
                              item.voucherUrl || ""
                            ).trim();
                            const ready = isTicketServiceReady(item, {
                              opsTicketStatus: ticketStatus,
                              hasVoucher: Boolean(
                                itemUrl || ticketVoucherUrl
                              ),
                            });
                            return (
                              <DayServiceTicketRow
                                key={item.id}
                                title={item.title}
                                ready={ready}
                                downloadUrl={
                                  ready && itemUrl ? itemUrl : null
                                }
                                downloadFilename={
                                  ready && itemUrl
                                    ? item.voucherFilename ||
                                      ticketVoucherFilename ||
                                      null
                                    : null
                                }
                                guestEmail={guestEmail}
                              />
                            );
                          })}
                        </div>
                      ) : null}

                      {showRailStub ? (
                        <TicketStubCard
                          title={`${cityLabel} rail / transit`}
                          subtitle={
                            loc.ticketType
                              ? String(loc.ticketType)
                              : "Public transport ticket"
                          }
                        />
                      ) : null}

                      {dayTours.length > 0 ? (
                        <ul className="relative space-y-3">
                          {dayTours.map((row, tourIndex) => {
                            const tour = config?.tours.find(
                              (t) => t.id === row.tourId
                            );
                            const hours =
                              tour?.duration_hours ?? row.duration_hours;
                            const file = tour
                              ? tourMediaFile(tour) || tourPhoto(tour)
                              : "";
                            const thumbUrl =
                              tour && file && tour.collectionId
                                ? pbFileUrl(
                                    tour.collectionId,
                                    tour.id,
                                    file,
                                    {
                                      thumb: PB_THUMBS.card,
                                      format: "webp",
                                    }
                                  ) || file
                                : file || undefined;
                            const kind = resolveItineraryStopKind({
                              category: tour?.category,
                              access_type: tour?.access_type,
                              is_self_guided: tour?.is_self_guided,
                              title: tour?.title ?? row.title,
                              description: tour?.description,
                            });
                            return (
                              <li
                                key={`${row.tourId || "tour"}-${date}-${tourIndex}`}
                                className="relative"
                              >
                                <ItineraryStopTicket
                                  kind={kind}
                                  title={
                                    tour?.title ?? row.title ?? row.tourId
                                  }
                                  stopNumber={tourIndex + 1}
                                  durationHours={Number(hours) || 0}
                                  vibeLabel={
                                    row.selectedLanguage
                                      ? String(row.selectedLanguage)
                                      : undefined
                                  }
                                  thumbUrl={thumbUrl}
                                />
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })()}
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
    <div className="flex w-full justify-center overflow-hidden px-1 py-0.5">
        <button
          type="button"
          onClick={onClick}
          className={`group my-1 inline-flex max-w-full cursor-pointer flex-col items-center gap-1 rounded-full border px-3 py-2 text-xs font-semibold shadow-sm transition-all sm:px-4 ${
            isUnset
              ? "border-[#F6A724]/50 bg-[#F6A724]/15 text-[#F6A724] hover:border-[#F6A724] hover:shadow-md"
              : "border-white/20 bg-[#0A1017]/80 backdrop-blur-md text-white hover:border-[#075473] hover:shadow-md"
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
      className={`w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0A1017]/80 text-white shadow-2xl backdrop-blur-md print:break-inside-avoid print:rounded-none print:border print:border-gray-300 print:bg-transparent print:text-gray-900 print:shadow-none ${border} ${
        compact ? "px-4 py-3" : "px-4 py-4 sm:px-5"
      }`}
    >
      {children}
    </section>
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
