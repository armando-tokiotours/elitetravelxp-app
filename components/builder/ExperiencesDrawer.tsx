"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { PbTour } from "@/lib/pocketbase/client";
import {
  pbFileUrl,
  tourMediaFile,
  tourMediaType,
  tourPrice,
} from "@/lib/pocketbase/client";
import { formatUsd } from "@/lib/builder-pricing";
import type { ChauffeurDayOption } from "@/lib/dateCascade";
import type { SelectedTour } from "@/lib/selectedTours";
import {
  getAvailableHours,
  MAX_TOUR_HOURS_PER_DAY,
  TOUR_DAY_PACKED_MESSAGE,
  tourDurationHours,
} from "@/lib/tourValidator";
import { ScheduleTourDaySheet } from "./ScheduleTourDaySheet";

export function ExperiencesDrawer({
  open,
  onClose,
  cityName,
  nights,
  tours,
  selectedTours,
  dayOptions,
  onAddTour,
  onRemoveTour,
}: {
  open: boolean;
  onClose: () => void;
  cityName: string;
  nights: number;
  tours: PbTour[];
  selectedTours: SelectedTour[];
  dayOptions: ChauffeurDayOption[];
  onAddTour: (
    tour: PbTour,
    scheduledDate: string
  ) => { ok: boolean; message?: string };
  onRemoveTour: (tourId: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pickingTourId, setPickingTourId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setPickingTourId(null);
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const selectedById = useMemo(
    () => Object.fromEntries(selectedTours.map((t) => [t.tourId, t])),
    [selectedTours]
  );
  const pickingTour = pickingTourId
    ? tours.find((t) => t.id === pickingTourId) ?? null
    : null;

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${cityName} experiences`}
        >
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="relative z-[1] flex h-[90dvh] max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-[#FBF8F2] shadow-2xl sm:h-[min(90dvh,52rem)] sm:max-h-[min(90dvh,52rem)] sm:rounded-3xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className="sticky top-0 z-20 flex shrink-0 items-start justify-between gap-3 border-b border-[#EEE8DF] bg-white px-4 pb-4 pt-6 sm:px-5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#C4A35A]">
                  Experiences
                </p>
                <h3 className="font-display text-2xl text-[#0B1F3A]">
                  {cityName}
                </h3>
                <p className="mt-1 text-xs text-[#8A8278]">
                  {nights} night{nights === 1 ? "" : "s"} · Max{" "}
                  {MAX_TOUR_HOURS_PER_DAY}h of activities per day
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-full bg-[#0B1F3A] px-4 py-1.5 text-sm text-white"
              >
                Done
              </button>
            </div>

            {toast ? (
              <div
                role="status"
                className="mx-4 mt-3 rounded-xl border border-[#C4A35A]/50 bg-[#F7EFD9] px-3.5 py-2.5 text-sm text-[#6B5420]"
              >
                ⚠️ {toast}
              </div>
            ) : null}

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 pb-[max(7rem,env(safe-area-inset-bottom))]">
              {tours.length === 0 ? (
                <p className="py-12 text-center text-sm text-[#8A8278]">
                  No experiences listed for {cityName} yet. Add tours in Team
                  Access.
                </p>
              ) : (
                tours.map((tour) => {
                  const booked = selectedById[tour.id];
                  return (
                    <TourMediaCard
                      key={tour.id}
                      tour={tour}
                      scheduledLabel={
                        booked?.scheduledDate
                          ? dayOptions.find(
                              (d) => d.date === booked.scheduledDate
                            )?.label ?? booked.scheduledDate
                          : null
                      }
                      selected={Boolean(booked)}
                      onAdd={() => {
                        if (booked) {
                          onRemoveTour(tour.id);
                          return;
                        }
                        if (dayOptions.length === 0) {
                          setToast(
                            "Set your arrival date and city nights in Steps 1–3 before scheduling experiences."
                          );
                          return;
                        }
                        if (dayOptions.length === 1) {
                          const day = dayOptions[0];
                          const hours = tourDurationHours(tour);
                          const available = getAvailableHours(
                            selectedTours,
                            day.date
                          );
                          if (hours > available) {
                            setToast(TOUR_DAY_PACKED_MESSAGE);
                            return;
                          }
                          const result = onAddTour(tour, day.date);
                          if (!result.ok && result.message) {
                            setToast(result.message);
                          }
                          return;
                        }
                        setPickingTourId(tour.id);
                      }}
                    />
                  );
                })
              )}
            </div>

            <ScheduleTourDaySheet
              open={!!pickingTour}
              tour={pickingTour}
              cityName={cityName}
              dayOptions={dayOptions}
              selectedTours={selectedTours}
              onClose={() => setPickingTourId(null)}
              onSelectDay={(date) => onAddTour(pickingTour!, date)}
              onToast={setToast}
            />
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

function TourMediaCard({
  tour,
  selected,
  scheduledLabel,
  onAdd,
}: {
  tour: PbTour;
  selected: boolean;
  scheduledLabel: string | null;
  onAdd: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const mediaType = tourMediaType(tour);
  const filename = tourMediaFile(tour);
  const mediaUrl =
    filename && tour.collectionId
      ? pbFileUrl(tour.collectionId, tour.id, filename)
      : "";
  const hours = Number(tour.duration_hours) || 0;
  const priceMin = tourPrice(tour);
  const priceMax = priceMin > 0 ? Math.round(priceMin * 1.15) : 0;
  const priceLabel =
    priceMin > 0
      ? priceMax > priceMin
        ? `From ${formatUsd(priceMin)} – ${formatUsd(priceMax)}`
        : `From ${formatUsd(priceMin)}`
      : null;
  const description = (tour.description ?? "").trim();
  const showMoreToggle = description.length > 120;

  return (
    <article className="overflow-hidden rounded-2xl border border-[#EEE8DF] bg-white shadow-[0_4px_20px_rgba(11,31,58,0.06)]">
      <div className="relative aspect-[4/5] max-h-[50dvh] w-full bg-[#0B1F3A]">
        {mediaUrl && mediaType === "Video" ? (
          <video
            key={mediaUrl}
            src={mediaUrl}
            autoPlay
            muted
            loop
            playsInline
            disablePictureInPicture
            preload="auto"
            className="h-full w-full object-cover"
          />
        ) : mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-end bg-gradient-to-br from-[#1a3355] to-[#0B1F3A] p-5">
            <span className="font-display text-2xl text-white/90">
              {tour.title}
            </span>
          </div>
        )}
        {hours > 0 ? (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
            <ClockIcon />
            {hours}h
          </span>
        ) : null}
      </div>

      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <h4 className="font-display text-xl leading-snug text-[#0B1F3A]">
            {tour.title}
          </h4>
          {priceLabel ? (
            <span className="shrink-0 text-sm font-semibold text-[#0B1F3A]">
              {priceLabel}
            </span>
          ) : null}
        </div>
        {description ? (
          <div className="mt-2">
            <p
              className={`text-sm leading-relaxed text-[#5C6570] ${
                isExpanded ? "" : "line-clamp-3"
              }`}
            >
              {description}
            </p>
            {showMoreToggle ? (
              <button
                type="button"
                onClick={() => setIsExpanded((v) => !v)}
                className="mt-1 text-sm font-semibold text-[#0B1F3A] hover:text-[#C4A35A]"
              >
                {isExpanded ? "Less." : "More."}
              </button>
            ) : null}
          </div>
        ) : null}
        {selected && scheduledLabel ? (
          <p className="mt-2 text-xs font-medium text-[#C4A35A]">
            Scheduled · {scheduledLabel}
          </p>
        ) : null}
        <button
          type="button"
          onClick={onAdd}
          className={`mt-4 w-full rounded-full py-3 text-sm font-semibold transition ${
            selected
              ? "border border-[#C4A35A] bg-[#FBF6EA] text-[#0B1F3A]"
              : "bg-[#0B1F3A] text-white hover:bg-[#143052]"
          }`}
        >
          {selected ? "✓ Remove from itinerary" : "+ Add to Itinerary"}
        </button>
      </div>
    </article>
  );
}

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M6 3.2V6l1.8 1.2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
