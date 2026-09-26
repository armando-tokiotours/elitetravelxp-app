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
import { JapanBookingPass } from "@/components/dossier/JapanBookingPass";
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
  const selectedExperiences = useSingleDayBuilderStore(
    (s) => s.selectedExperiences
  );

  const tempBookingRef = useBuilderStore((s) => s.tempBookingRef);
  const confirmedBookingRef = useBuilderStore((s) => s.confirmedBookingRef);
  const bookingStatus = useBuilderStore((s) => s.bookingStatus);
  const experienceService = useBuilderStore((s) => s.experienceService);
  const isEliteConcierge = useBuilderStore((s) => s.isEliteConcierge);
  const passengerName = useItineraryStore((s) => s.clientName);

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
  const passDate = dateLabel === "Date TBD" ? "" : dateLabel.toUpperCase();
  const pickup = startTime || "09:00";
  const highlights = buildSingleDayHighlights({
    cityFocus: cityLabel,
    guidePreference,
  });

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
        status={mapBookingStatusToPass(bookingStatus)}
        qrValue={buildDossierQrUrl(pnrCode, "/builder-single/itinerary")}
        conciergeAgentName={conciergeAgentName}
      />

      <SingleDayTimelineInfographic
        stops={enrichedStops}
        startTime={startTime || "09:00"}
        endTime={dropOffTime}
        totalHours={tourHours}
        cityLabel={cityLabel}
        variant="screen"
      />
    </div>
  );
}


