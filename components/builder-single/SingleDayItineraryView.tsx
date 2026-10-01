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
import {
  StaffIdentityCard,
  TicketStubCard,
  DayServiceIdleRow,
  experienceNeedsEntryTicket,
} from "@/components/dossier/DayStaffCards";
import { useOpsBookingSnapshot } from "@/lib/useOpsStaffNames";
import { useConciergeAgentName } from "@/lib/useConciergeAgentName";
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
export function SingleDayItineraryView() {
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
  const guideName = ops.guideName;
  const driverName = ops.driverName;
  const guideConfirmLabel = ops.guideLabel;
  const driverConfirmLabel = ops.driverLabel;
  const ticketsPurchaseAllowed = ops.ticketsPurchaseAllowed;
  const ticketGuestLabel = ops.ticketGuestLabel;
  const agentDisplay =
    ops.assignedAgent || conciergeAgentName || null;
  const passStatus =
    ops.passStatus || mapBookingStatusToPass(bookingStatus);
  const passDate = dateLabel === "Date TBD" ? "" : dateLabel.toUpperCase();
  const pickup = startTime || "09:00";
  const highlights = buildSingleDayHighlights({
    cityFocus: cityLabel,
    guidePreference,
  });

  const needsCar = preferredMovement === "private_driver";
  const needsGuide =
    guidePreference === "private_guide" ||
    guidePreference === "local_host" ||
    selectedExperiences.length > 0;
  const ticketStops = useMemo(() => {
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
        return {
          key: stop.tourId,
          title: tour?.title || stop.title,
          timeLabel: stop.timeSlot || stop.startTime,
          accessType: String(tour?.access_type || "").trim() || undefined,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [timedStops, catalogById]);

  return (
    <div
      id="single-day-dossier-view"
      className="w-full space-y-6 overflow-hidden px-0 text-white"
    >
      <p className="px-0 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#F6A724]">
        Single-Day Tour Dossier
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
        qrValue={buildDossierQrUrl(pnrCode, "/builder-single/itinerary")}
        conciergeAgentName={agentDisplay}
      />

      <CoordinationTeamSection
        pnr={pnrCode}
        agentName={agentDisplay}
        guestEmail={passengerEmail || undefined}
        guestName={passengerName || undefined}
        tripPath="/builder-single/itinerary"
      />

      <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[9px] font-semibold tracking-wider text-zinc-500 uppercase">
            Day services
          </p>
          <span className="font-mono text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
            Day 1
          </span>
        </div>

        <div className="space-y-2.5">
          {/* Line 1 — Car / driver */}
          <div className="space-y-1.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/45">
              Car
            </p>
            {needsCar ? (
              <StaffIdentityCard
                role="driver"
                name={driverName}
                emptyLabel={driverConfirmLabel}
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
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/45">
              Guide
            </p>
            {needsGuide ? (
              <StaffIdentityCard
                role="guide"
                name={guideName}
                emptyLabel={guideConfirmLabel}
              />
            ) : (
              <DayServiceIdleRow
                label="Guide"
                message="No guide assigned yet"
              />
            )}
          </div>

          {/* Line 3 — Tickets (gated by payment for purchase confirmation) */}
          <div className="space-y-1.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/45">
              Tickets
            </p>
            {ticketStops.length > 0 ? (
              !ticketsPurchaseAllowed ? (
                <DayServiceIdleRow
                  label="Tickets"
                  message={
                    ticketGuestLabel ||
                    "Waiting for payment confirmation"
                  }
                />
              ) : (
                <div className="space-y-2">
                  {ticketStops.map((t) => (
                    <TicketStubCard
                      key={t.key}
                      title={t.title}
                      subtitle={`Entry · ${t.timeLabel}`}
                      accessType={t.accessType}
                    />
                  ))}
                </div>
              )
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
      />
    </div>
  );
}


