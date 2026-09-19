"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { PbTour } from "@/lib/pocketbase/client";
import type { ChauffeurDayOption } from "@/lib/dateCascade";
import type { SelectedTour } from "@/lib/selectedTours";
import {
  getAvailableHours,
  TOUR_DAY_PACKED_MESSAGE,
  tourDurationHours,
} from "@/lib/tourValidator";

/**
 * Bottom sheet: pick which day to schedule a tour (9h/day capacity).
 * Shared by Experiences drawer and Discover feed.
 */
export function ScheduleTourDaySheet({
  open,
  tour,
  cityName,
  dayOptions,
  selectedTours,
  onClose,
  onSelectDay,
  onToast,
}: {
  open: boolean;
  tour: PbTour | null;
  cityName: string;
  dayOptions: ChauffeurDayOption[];
  selectedTours: SelectedTour[];
  onClose: () => void;
  onSelectDay: (date: string) => { ok: boolean; message?: string };
  onToast: (message: string) => void;
}) {
  return (
    <AnimatePresence>
      {open && tour ? (
        <motion.div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/45"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Cancel day selection"
            onClick={onClose}
          />
          <motion.div
            className="relative w-full max-w-lg rounded-t-3xl bg-white px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B85304]">
              Schedule experience
            </p>
            <h4 className="mt-1 font-display text-xl text-[#0B1F3A]">
              {tour.title}
            </h4>
            <p className="mt-1 text-sm text-[#8A8278]">
              Which day in {cityName} should this run?
            </p>
            <ul className="mt-4 max-h-[40dvh] space-y-2 overflow-y-auto">
              {dayOptions.map((day) => {
                const tourHours = tourDurationHours(tour);
                const available = getAvailableHours(
                  selectedTours,
                  day.date,
                  tour.id
                );
                const disabled = tourHours > available;
                return (
                  <li key={day.date}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        if (disabled) {
                          onToast(TOUR_DAY_PACKED_MESSAGE);
                          return;
                        }
                        const result = onSelectDay(day.date);
                        if (!result.ok && result.message) {
                          onToast(result.message);
                          return;
                        }
                        onClose();
                      }}
                      className={`flex w-full flex-col items-start gap-0.5 rounded-2xl border px-4 py-3 text-left transition sm:flex-row sm:items-center sm:justify-between ${
                        disabled
                          ? "cursor-not-allowed border-[#EEE8DF] bg-[#F5F2EC] opacity-70"
                          : "border-[#EEE8DF] bg-[#FBF8F2] hover:border-[#B85304]/70 hover:bg-white"
                      }`}
                    >
                      <span className="text-sm font-medium text-[#0B1F3A]">
                        {day.label}
                      </span>
                      {disabled ? (
                        <span className="text-xs text-[#8A8278]">
                          Only {available}h available — tour is {tourHours}h
                        </span>
                      ) : (
                        <span className="text-xs text-[#B85304]">
                          {available}h available · Select
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full rounded-full border border-[#D9D2C7] py-2.5 text-sm text-[#5C6570]"
            >
              Cancel
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
