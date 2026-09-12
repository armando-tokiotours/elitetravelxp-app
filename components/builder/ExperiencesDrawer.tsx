"use client";

import { useEffect, useState } from "react";
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
import {
  cityTourCapacityHours,
  selectedTourHours,
} from "@/lib/tourValidator";

export function ExperiencesDrawer({
  open,
  onClose,
  cityName,
  nights,
  tours,
  selectedTourIds,
  onToggleTour,
}: {
  open: boolean;
  onClose: () => void;
  cityName: string;
  nights: number;
  tours: PbTour[];
  selectedTourIds: string[];
  onToggleTour: (tourId: string) => { ok: boolean; message?: string };
}) {
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
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

  const capacity = cityTourCapacityHours(nights);
  const used = selectedTourHours(selectedTourIds, tours);

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
            className="relative z-[1] flex h-[95vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-[#FBF8F2] shadow-2xl sm:h-[min(92vh,52rem)] sm:rounded-3xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#EEE8DF] bg-white px-5 pb-4 pt-5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#C4A35A]">
                  Experiences
                </p>
                <h3 className="font-display text-2xl text-[#0B1F3A]">
                  {cityName}
                </h3>
                <p className="mt-1 text-xs text-[#8A8278]">
                  {nights} night{nights === 1 ? "" : "s"} · {used}h / {capacity}
                  h recommended
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

            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 pb-28">
              {tours.length === 0 ? (
                <p className="py-12 text-center text-sm text-[#8A8278]">
                  No experiences listed for {cityName} yet. Add tours in Team
                  Access.
                </p>
              ) : (
                tours.map((tour) => (
                  <TourMediaCard
                    key={tour.id}
                    tour={tour}
                    selected={selectedTourIds.includes(tour.id)}
                    onAdd={() => {
                      const result = onToggleTour(tour.id);
                      if (!result.ok && result.message) {
                        setToast(result.message);
                      }
                    }}
                  />
                ))
              )}
            </div>
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
  onAdd,
}: {
  tour: PbTour;
  selected: boolean;
  onAdd: () => void;
}) {
  const mediaType = tourMediaType(tour);
  const filename = tourMediaFile(tour);
  const mediaUrl =
    filename && tour.collectionId
      ? pbFileUrl(tour.collectionId, tour.id, filename)
      : "";
  const hours = Number(tour.duration_hours) || 0;

  return (
    <article className="overflow-hidden rounded-2xl border border-[#EEE8DF] bg-white shadow-[0_4px_20px_rgba(11,31,58,0.06)]">
      <div className="relative aspect-[4/5] max-h-[60vh] w-full bg-[#0B1F3A]">
        {mediaUrl && mediaType === "Video" ? (
          <video
            className="h-full w-full object-cover"
            src={mediaUrl}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
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
          <span className="shrink-0 text-sm font-semibold text-[#0B1F3A]">
            {formatUsd(tourPrice(tour))}
          </span>
        </div>
        {tour.description ? (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[#5C6570]">
            {tour.description}
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
          {selected ? "✓ Added to itinerary" : "+ Add to Itinerary"}
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
