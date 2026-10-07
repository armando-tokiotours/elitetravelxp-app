"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchBuilderConfig,
  fetchExperiencesAndPlaces,
  mapEapToTour,
  pbFileUrl,
  tourMediaFile,
  tourPhoto,
  type PbTour,
} from "@/lib/pocketbase/client";
import { PB_THUMBS } from "@/lib/mediaStandards";
import {
  calculateDayEndTime,
  calculateTimeSlots,
} from "@/lib/singleDayTimeSlots";
import {
  guidePreferenceLabel,
} from "@/lib/singleDayPricing";
import {
  formatSingleDayDisplayDate,
  useSingleDayBuilderStore,
} from "@/store/useSingleDayBuilderStore";
import { useBuilderStore } from "@/store/useBuilderStore";
import { useItineraryStore } from "@/store/useItineraryStore";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";
import { JapanBookingPass } from "@/components/dossier/JapanBookingPass";
import { CoordinationTeamSection } from "@/components/dossier/CoordinationTeamSection";
import { DossierTermsFooterSection } from "@/components/dossier/DossierTermsFooterSection";
import {
  StaffIdentityCard,
  TicketStubCard,
  DayServiceIdleRow,
  DayServiceTicketRow,
  experienceNeedsEntryTicket,
} from "@/components/dossier/DayStaffCards";
import { useTicketVoucher } from "@/components/dossier/TicketVoucherDownloadBanner";
import { useOpsBookingSnapshot } from "@/lib/useOpsStaffNames";
import { useConciergeAgentName } from "@/lib/useConciergeAgentName";
import { useAgentServices } from "@/lib/useAgentServices";
import {
  dayServicesFromAgentCart,
  isTicketServiceReady,
} from "@/lib/agentServices";
import { normalizeTourDateIso } from "@/lib/guideJobs";
import {
  buildDossierQrUrl,
  buildSingleDayHighlights,
  experienceTierLabel,
  formatGuestCountText,
  mapBookingStatusToPass,
  resolvePnr,
} from "@/lib/dossier/bookingPassHelpers";
import {
  enrichTimelineStops,
  SingleDayTimelineInfographic,
} from "@/components/builder-single/SingleDayTimelineInfographic";

const TRANSIT_BUFFER_MIN = 15;

/**
 * Dedicated Single-Day Travel Dossier — hour-by-hour schedule, city hub,
 * pace & guide. Never renders multi-city airport routes or hotel nights.
 */
export function SingleDayItineraryView({
  depositPaidEur = 0,
  hasPaidFull = false,
}: {
  depositPaidEur?: number;
  hasPaidFull?: boolean;
} = {}) {
  const tourDate = useSingleDayBuilderStore((s) => s.tourDate);
  const adults = useSingleDayBuilderStore((s) => s.adults);
  const children = useSingleDayBuilderStore((s) => s.children);
  const tourHours = useSingleDayBuilderStore((s) => s.tourHours);
  const startTime = useSingleDayBuilderStore((s) => s.startTime);
  const cityFocus = useSingleDayBuilderStore((s) => s.cityFocus);
  const guidePreference = useSingleDayBuilderStore((s) => s.guidePreference);
  const preferredMovement = useSingleDayBuilderStore((s) => s.preferredMovement);
  const meetingPoint = useSingleDayBuilderStore((s) => s.meetingPoint);
  const meetingPointName = useSingleDayBuilderStore((s) => s.meetingPointName);
  const selectedExperiences = useSingleDayBuilderStore(
    (s) => s.selectedExperiences
  );

  const tempBookingRef = useBuilderStore((s) => s.tempBookingRef);
  const confirmedBookingRef = useBuilderStore((s) => s.confirmedBookingRef);
  const bookingStatus = useBuilderStore((s) => s.bookingStatus);
  const experienceService = useBuilderStore((s) => s.experienceService);
  const isEliteConcierge = useBuilderStore((s) => s.isEliteConcierge);
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

  const [catalog, setCatalog] = useState<PbTour[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await fetchBuilderConfig();
        if (cancelled) return;
        const eap = await fetchExperiencesAndPlaces().catch(() => []);
        const extras = eap
          .filter((r) => r.is_active !== false)
          .map((r) => mapEapToTour(r, cfg.cities));
        const tours = cfg.tours ?? [];
        const ids = new Set(tours.map((t) => t.id));
        if (!cancelled) {
          setCatalog([...tours, ...extras.filter((p) => !ids.has(p.id))]);
        }
      } catch {
        if (!cancelled) setCatalog([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const catalogById = useMemo(() => {
    const map = new Map<string, PbTour>();
    for (const t of catalog) map.set(t.id, t);
    return map;
  }, [catalog]);

  const thumbFor = (tourId: string): string => {
    const item = catalogById.get(tourId);
    if (!item) return "";
    const file = tourMediaFile(item) || tourPhoto(item);
    if (!file || !item.collectionId) return file || "";
    return (
      pbFileUrl(item.collectionId, item.id, file, {
        thumb: PB_THUMBS.card,
        format: "webp",
      }) || file
    );
  };

  const timedStops = useMemo(
    () =>
      calculateTimeSlots(startTime || "09:00", selectedExperiences, {
        bufferMinutes: TRANSIT_BUFFER_MIN,
      }),
    [startTime, selectedExperiences]
  );

  const enrichedStops = useMemo(
    () => enrichTimelineStops(timedStops, catalogById, thumbFor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timedStops, catalogById]
  );

  const dropOffTime = useMemo(() => {
    if (timedStops.length > 0) {
      return calculateDayEndTime(startTime || "09:00", selectedExperiences, {
        bufferMinutes: TRANSIT_BUFFER_MIN,
      });
    }
    return calculateDayEndTime(startTime || "09:00", [
      { duration_hours: tourHours },
    ]);
  }, [timedStops.length, startTime, selectedExperiences, tourHours]);

  const guideLabel = guidePreferenceLabel(guidePreference);
  const dateLabel = formatSingleDayDisplayDate(tourDate) || "Date TBD";
  const cityLabel = cityFocus.trim() || "City TBD";
  const hoursLabel = `${tourHours} HOUR${tourHours === 1 ? "" : "S"}`;
  const pnrCode = resolvePnr({
    tempBookingRef,
    confirmedBookingRef,
    bookingStatus,
  });
  const conciergeAgentName = useConciergeAgentName(pnrCode);
  const ops = useOpsBookingSnapshot(pnrCode);
  const agentServices = useAgentServices(pnrCode);
  const dayCart = useMemo(
    () => dayServicesFromAgentCart(agentServices),
    [agentServices]
  );
  const ticketVoucher = useTicketVoucher(pnrCode);
  const tourDateIso = normalizeTourDateIso(tourDate);
  const dayGuide =
    ops.dayGuides.find(
      (g) => g.tourDate === tourDateIso && g.name
    ) || ops.dayGuides.find((g) => g.name);
  const guideName = dayGuide?.name || ops.guideName;
  const driverName = ops.driverName;
  const guideConfirmLabel = dayGuide?.name
    ? `Guide Confirmed: ${dayGuide.name}`
    : ops.guideLabel;
  const driverConfirmLabel = ops.driverLabel;
  const guidePhotoUrl = dayGuide?.photoUrl || ops.guidePhotoUrl;
  const guideEmail = dayGuide?.email || ops.guideEmail;
  const guidePhone = dayGuide?.phone || ops.guidePhone;
  const guideWhatsapp = dayGuide?.whatsappDigits || ops.guideWhatsapp;
  const guideUnlockMessage =
    dayGuide?.unlockMessage || ops.guideUnlockMessage;
  const driverPhotoUrl = ops.driverPhotoUrl;
  const driverEmail = ops.driverEmail;
  const driverPhone = ops.driverPhone;
  const driverUnlockMessage = ops.driverUnlockMessage;
  const ticketsPurchaseAllowed = ops.ticketsPurchaseAllowed;
  const ticketGuestLabel = ops.ticketGuestLabel;
  const agentDisplay =
    ops.assignedAgent || conciergeAgentName || null;
  const passStatus =
    ops.passStatus ||
    mapBookingStatusToPass(bookingStatus, {
      depositPaidEur,
      hasPaidFull,
    });
  const passDate = dateLabel === "Date TBD" ? "" : dateLabel.toUpperCase();
  const pickup = startTime || "09:00";
  const highlights = buildSingleDayHighlights({
    cityFocus: cityLabel,
    guidePreference,
  });

  const needsCar =
    preferredMovement === "private_driver" || Boolean(dayCart.transitTitle);
  const needsGuide =
    guidePreference === "private_guide" ||
    guidePreference === "local_host" ||
    selectedExperiences.length > 0 ||
    Boolean(dayCart.guideTitle);
  const ticketStops = useMemo(() => {
    const agentTitleKeys = new Set(
      dayCart.ticketItems.map((i) => String(i.title || "").trim().toLowerCase())
    );
    return timedStops
      .map((stop) => {
        const tour = catalogById.get(stop.tourId);
        const needs = experienceNeedsEntryTicket({
          title: stop.title || tour?.title,
          description: tour?.description,
          access_type: tour?.access_type,
          is_self_guided: tour?.is_self_guided,
          category: tour?.category,
        });
        if (!needs) return null;
        const title = tour?.title || stop.title;
        // Prefer agent_services row when Ops already added the same ticket
        if (agentTitleKeys.has(String(title || "").trim().toLowerCase())) {
          return null;
        }
        return {
          key: stop.tourId,
          title,
          timeLabel: stop.timeSlot || stop.startTime,
          accessType: String(tour?.access_type || "").trim() || undefined,
          thumbUrl: thumbFor(stop.tourId) || undefined,
          stopNumber: stop.stopNumber,
          durationHours: Number(stop.duration_hours) || 0,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [timedStops, catalogById, dayCart.ticketItems]);

  const hasTicketRows =
    dayCart.ticketItems.length > 0 || ticketStops.length > 0;

  return (
    <div
      id="single-day-dossier-view"
      className="w-full space-y-6 overflow-visible px-0 text-white print:bg-white print:text-black"
    >
      <p className="px-0 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#F6A724] print:text-gray-900">
        1-Day Express Pass · Itinerary
      </p>

      <JapanBookingPass
        pnrCode={pnrCode}
        guestName={passengerName || "GUEST"}
        guestEmail={passengerEmail || undefined}
        partyText={formatGuestCountText(adults, children)}
        travelStyle={guideLabel || "DAY TOUR"}
        tripType="single"
        experienceType={experienceTierLabel(
          experienceService,
          isEliteConcierge
        )}
        startTime={pickup}
        endTime={dropOffTime || "15:00"}
        singleDayHighlights={highlights}
        durationText={hoursLabel}
        startDateText={passDate}
        endDateText={passDate}
        status={passStatus}
        depositPaidEur={depositPaidEur}
        hasPaidFull={hasPaidFull}
        qrValue={buildDossierQrUrl(pnrCode, "/builder-single/itinerary")}
        conciergeAgentName={agentDisplay}
        editHref="/builder-single"
      />

      <CoordinationTeamSection
        pnr={pnrCode}
        agentName={agentDisplay}
        guestEmail={passengerEmail || undefined}
        guestName={passengerName || undefined}
        tripPath="/builder-single/itinerary"
      />

      <div className="rounded-2xl border border-white/10 bg-black/30 p-3 print:break-inside-avoid print:rounded-none print:border print:border-gray-300 print:bg-transparent">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[9px] font-semibold tracking-wider text-zinc-500 uppercase print:text-gray-600">
            Day services
          </p>
          <span className="font-mono text-[10px] font-bold tracking-wider text-zinc-500 uppercase print:text-gray-600">
            Day 1
          </span>
        </div>

        <div className="space-y-2.5">
          {/* Line 1 — Car / driver */}
          <div className="space-y-1.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/45 print:text-gray-600">
              Car
            </p>
            {needsCar ? (
              <StaffIdentityCard
                role="driver"
                name={driverName}
                photoUrl={driverPhotoUrl}
                email={driverEmail}
                phone={driverPhone}
                unlockMessage={driverUnlockMessage}
                emptyLabel={driverConfirmLabel}
                serviceTitle={dayCart.transitTitle}
                serviceHint="Vehicle secured · Pending assignment"
              />
            ) : (
              <DayServiceIdleRow
                label="Car"
                message="No private car for this day"
              />
            )}
          </div>

          {/* Line 2 — Guide */}
          <div className="space-y-1.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/45 print:text-gray-600">
              Guide
            </p>
            {needsGuide ? (
              <StaffIdentityCard
                role="guide"
                name={guideName}
                photoUrl={guidePhotoUrl}
                email={guideEmail}
                phone={guidePhone}
                whatsappDigits={guideWhatsapp}
                unlockMessage={guideUnlockMessage}
                emptyLabel={guideConfirmLabel}
                serviceTitle={dayCart.guideTitle}
                serviceHint="Pending assignment"
              />
            ) : (
              <DayServiceIdleRow
                label="Guide"
                message="No guide assigned yet"
              />
            )}
          </div>

          {/* Line 3 — Tickets (agent_services + itinerary entry stubs) */}
          <div className="space-y-1.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/45 print:text-gray-600">
              Tickets
            </p>
            {hasTicketRows ? (
              <div className="space-y-2">
                {dayCart.ticketItems.map((item) => {
                  const itemUrl = String(item.voucherUrl || "").trim();
                  const ready = isTicketServiceReady(item, {
                    opsTicketStatus: ops.ticketStatus,
                    hasVoucher: Boolean(itemUrl || ticketVoucher?.url),
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
                            ticketVoucher?.filename ||
                            null
                          : null
                      }
                      guestEmail={passengerEmail || undefined}
                    />
                  );
                })}
                {ticketStops.length > 0 ? (
                  !ticketsPurchaseAllowed && dayCart.ticketItems.length === 0 ? (
                    <DayServiceIdleRow
                      label="Tickets"
                      message={
                        ticketGuestLabel ||
                        "Waiting for payment confirmation"
                      }
                    />
                  ) : ticketsPurchaseAllowed ? (
                    ticketStops.map((t) => (
                      <TicketStubCard
                        key={t.key}
                        title={t.title}
                        subtitle={`Entry · ${t.timeLabel}`}
                        accessType={t.accessType}
                        thumbUrl={t.thumbUrl}
                        stopNumber={t.stopNumber}
                        durationHours={t.durationHours}
                      />
                    ))
                  ) : null
                ) : null}
              </div>
            ) : (
              <DayServiceIdleRow
                label="Tickets"
                message="No entry tickets needed for this day"
              />
            )}
          </div>
        </div>
      </div>

      <SingleDayTimelineInfographic
        stops={enrichedStops}
        startTime={startTime || "09:00"}
        endTime={dropOffTime}
        totalHours={tourHours}
        cityLabel={cityLabel}
        meetingPointName={meetingPointName || null}
        meetingPointAddress={meetingPoint || null}
        variant="screen"
        editHref="/builder-single"
      />

      <DossierTermsFooterSection />
    </div>
  );
}


