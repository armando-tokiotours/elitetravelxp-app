"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, Reorder, motion } from "framer-motion";
import { GripVertical, X } from "lucide-react";
import {
  pbFileUrl,
  tourMediaFile,
  tourPhoto,
  type PbTour,
} from "@/lib/pocketbase/client";
import { PB_THUMBS } from "@/lib/mediaStandards";
import {
  formatDurationBadge,
  selectedHoursTotal,
} from "@/lib/experiencesPlaces";
import { calculateTimeSlots } from "@/lib/singleDayTimeSlots";
import { resolveSingleDayReelPoster } from "@/config/mediaConfig";
import {
  useSingleDayBuilderStore,
  type SingleDaySelectedExperience,
} from "@/store/useSingleDayBuilderStore";

/**
 * Builder S — Locations & Nights–style modal to drag-reorder day stops
 * with auto-calculated time slots from tour start time.
 */
export function SingleDayRouteModal({
  open,
  onClose,
  catalog,
}: {
  open: boolean;
  onClose: () => void;
  catalog: PbTour[];
}) {
  const startTime = useSingleDayBuilderStore((s) => s.startTime);
  const tourHours = useSingleDayBuilderStore((s) => s.tourHours);
  const selectedRows = useSingleDayBuilderStore((s) => s.selectedExperiences);
  const removeExperience = useSingleDayBuilderStore((s) => s.removeExperience);
  const setSelected = useSingleDayBuilderStore.setState;

  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const catalogById = useMemo(() => {
    const map = new Map<string, PbTour>();
    for (const t of catalog) map.set(t.id, t);
    return map;
  }, [catalog]);

  const timedStops = useMemo(
    () => calculateTimeSlots(startTime || "09:00", selectedRows),
    [startTime, selectedRows]
  );

  const usedHours = selectedHoursTotal(selectedRows);
  const overBudget = usedHours > tourHours + 0.01;
  const budgetPct = Math.min(
    100,
    tourHours > 0 ? (usedHours / tourHours) * 100 : 0
  );

  const onReorder = (next: SingleDaySelectedExperience[]) => {
    setSelected({ selectedExperiences: next });
  };

  const thumbFor = (tourId: string): string => {
    const item = catalogById.get(tourId);
    if (!item) return "";
    const file = tourMediaFile(item) || tourPhoto(item);
    if (!file || !item.collectionId) return "";
    return (
      pbFileUrl(item.collectionId, item.id, file, {
        thumb: PB_THUMBS.card,
        format: "webp",
      }) || ""
    );
  };

  if (!open || !mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="single-day-route"
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="presentation"
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="single-day-route-title"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 28, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="relative z-[1] flex h-[min(92dvh,840px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0A0E14] shadow-2xl sm:rounded-3xl"
          >
            <header className="shrink-0 border-b border-white/10 px-5 pb-4 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#075473]">
                    Builder S · Step 3
                  </p>
                  <h2
                    id="single-day-route-title"
                    className="mt-1 font-godiva text-xl uppercase tracking-wider text-white sm:text-2xl"
                  >
                    Configure Day Route &amp; Schedule
                  </h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                    Drag to reorder stops. Timings calculate automatically based
                    on duration · starts {startTime || "09:00"}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full border border-white/15 p-2 text-zinc-400 transition hover:border-white/30 hover:text-white"
                  aria-label="Close route modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              {selectedRows.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-10 text-center text-sm text-zinc-400">
                  No stops yet. Add experiences &amp; places from the catalog,
                  then return here to reorder your day.
                </p>
              ) : (
                <Reorder.Group
                  axis="y"
                  values={selectedRows}
                  onReorder={onReorder}
                  className="flex flex-col gap-3"
                >
                  {selectedRows.map((row, index) => {
                    const stop = timedStops[index];
                    const thumb =
                      thumbFor(row.tourId) || resolveSingleDayReelPoster("");
                    return (
                      <Reorder.Item
                        key={row.tourId}
                        value={row}
                        className="list-none"
                      >
                        <div className="flex cursor-grab items-stretch gap-3 rounded-2xl border border-white/10 bg-[#0D1117]/90 p-3 active:cursor-grabbing">
                          <div className="flex flex-col items-center justify-center gap-1 text-zinc-500">
                            <GripVertical className="h-5 w-5" aria-hidden />
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#075473] text-[10px] font-bold text-white">
                              {stop?.stopNumber ?? index + 1}
                            </span>
                          </div>

                          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-900">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={thumb}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-white">
                              {row.title}
                            </p>
                            <p className="mt-0.5 font-geosans text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1BA58A]">
                              {stop?.timeSlot ?? "—"}
                            </p>
                            <span className="mt-1 inline-flex rounded-full border border-[#F6A724]/35 bg-[#F6A724]/10 px-2 py-0.5 text-[10px] font-bold text-[#F6A724]">
                              {formatDurationBadge(row.duration_hours)}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeExperience(row.tourId)}
                            className="self-start rounded-full border border-white/10 p-1.5 text-zinc-500 transition hover:border-[#E60F43]/50 hover:text-[#E60F43]"
                            aria-label={`Remove ${row.title}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </Reorder.Item>
                    );
                  })}
                </Reorder.Group>
              )}
            </div>

            <footer className="shrink-0 border-t border-white/10 bg-[#05080C]/95 px-5 py-4">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span
                  className={
                    overBudget
                      ? "font-semibold text-[#E60F43]"
                      : "text-zinc-400"
                  }
                >
                  Total Scheduled: {usedHours.toFixed(1)}h / {tourHours}h
                  available
                </span>
                <span className="text-zinc-500">
                  Ends{" "}
                  {timedStops.length
                    ? timedStops[timedStops.length - 1].endTime
                    : startTime || "09:00"}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all ${
                    overBudget ? "bg-[#E60F43]" : "bg-[#1BA58A]"
                  }`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 w-full rounded-full bg-[#075473] py-3 text-sm font-semibold text-white transition hover:bg-[#0a5f84]"
              >
                Done
              </button>
            </footer>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
