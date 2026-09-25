"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, CalendarDays, Compass } from "lucide-react";
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
  singleDayPaceLabel,
} from "@/lib/singleDayPricing";
import {
  formatSingleDayDisplayDate,
  useSingleDayBuilderStore,
} from "@/store/useSingleDayBuilderStore";
import { useBuilderStore } from "@/store/useBuilderStore";
import { BookingRefBadge } from "@/components/builder/BookingRefBadge";
import { NewBookingResetButton } from "@/components/builder/NewBookingResetButton";
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
  const travelPace = useSingleDayBuilderStore((s) => s.travelPace);
  const guidePreference = useSingleDayBuilderStore((s) => s.guidePreference);
  const selectedExperiences = useSingleDayBuilderStore(
    (s) => s.selectedExperiences
  );

  const tempBookingRef = useBuilderStore((s) => s.tempBookingRef);
  const confirmedBookingRef = useBuilderStore((s) => s.confirmedBookingRef);
  const bookingStatus = useBuilderStore((s) => s.bookingStatus);

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

  const paceLabel = singleDayPaceLabel(travelPace);
  const guideLabel = guidePreferenceLabel(guidePreference);
  const dateLabel = formatSingleDayDisplayDate(tourDate) || "Date TBD";
  const cityLabel = cityFocus.trim() || "City TBD";
  const hoursLabel = `${tourHours} Hour${tourHours === 1 ? "" : "s"}`;

  return (
    <div
      id="single-day-dossier-view"
      className="w-full space-y-6 overflow-hidden px-0 text-white"
    >
      <p className="px-0 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#F6A724]">
        Single-Day Tour Dossier
      </p>

      {/* Navy glass ticket — mirrors Multi-Day TravelDossierView summary */}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D1B2A] text-white shadow-[0_12px_40px_rgba(11,31,58,0.35)]">
        <div className="border-b border-white/10 px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/tokiotours-logo.png"
              alt="TOKIOTOURS"
              className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-white/15"
            />
            <div className="min-w-0">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-cyan-400/90">
                Booking Summary
              </p>
              <p className="mt-1 font-godiva text-lg uppercase leading-tight tracking-wider text-white sm:text-xl">
                TOKIOTOURS
              </p>
            </div>
          </div>

          <div className="mt-3 flex w-full items-stretch gap-2">
            <div className="min-w-0 flex-1">
              <BookingRefBadge
                tempBookingRef={tempBookingRef}
                confirmedBookingRef={confirmedBookingRef}
                bookingStatus={bookingStatus}
              />
            </div>
            <NewBookingResetButton />
          </div>
        </div>

        <div className="grid gap-4 border-t border-white/10 px-5 py-5 sm:grid-cols-3">
          <MetaBlock
            icon={<Users className="h-4 w-4 text-[#075473]" />}
            label="Guests"
            value={`${adults} Adult${adults === 1 ? "" : "s"}, ${children} Child${children === 1 ? "" : "ren"}`}
          />
          <MetaBlock
            icon={<CalendarDays className="h-4 w-4 text-[#075473]" />}
            label="Date & Duration"
            value={`${dateLabel} · ${hoursLabel}`}
          />
          <MetaBlock
            icon={<Compass className="h-4 w-4 text-[#075473]" />}
            label="City Hub"
            value={cityLabel}
          />
        </div>

        {paceLabel || guideLabel ? (
          <div className="flex flex-wrap gap-2 border-t border-white/10 px-5 py-3">
            {paceLabel ? (
              <span className="rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-white/85">
                {paceLabel}
              </span>
            ) : null}
            {guideLabel ? (
              <span className="rounded-full border border-[#075473]/45 bg-[#075473]/15 px-2.5 py-1 text-[11px] text-[#F3D9C4]">
                {guideLabel}
              </span>
            ) : null}
          </div>
        ) : null}
      </section>

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
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-[#F6A724]">
          {label}
        </p>
      </div>
      <p className="text-sm leading-snug text-white/90">{value}</p>
    </div>
  );
}
