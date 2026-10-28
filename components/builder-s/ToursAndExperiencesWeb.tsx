"use client";

import { motion } from "framer-motion";
import type { ToursAndExperiencesViewModel } from "./useToursAndExperiences";
import {
  ToursExperiencesBudget,
  ToursExperiencesDone,
  ToursExperiencesFeed,
  ToursExperiencesHeader,
  ToursExperiencesSegments,
  ToursExperiencesTimeline,
  ToursExperiencesToast,
  ToursExperiencesVibeFilters,
} from "./ToursAndExperiencesSharedUI";

/**
 * Builder S — Tours & Experiences desktop full-page view.
 * Wider canvas with side-by-side catalog + day panel.
 */
export function ToursAndExperiencesWeb({
  vm,
}: {
  vm: ToursAndExperiencesViewModel;
}) {
  const { onClose, handleDone, toast, selectedRows } = vm;

  return (
    <motion.div
      key="tours-experiences-web"
      className="fixed inset-0 z-[110] flex h-full w-full flex-col bg-[#0A1017] p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Tours and Experiences"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <ToursExperiencesHeader onClose={onClose} dense />

      <div className="relative mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-hidden pt-2">
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Catalog column */}
          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
            <ToursExperiencesSegments vm={vm} dense />
            <ToursExperiencesVibeFilters vm={vm} dense />
            <ToursExperiencesFeed
              vm={vm}
              dense
              className="min-h-0 flex-1 space-y-4 overflow-y-auto py-3 pb-4"
            />
          </div>

          {/* Day panel — budget + timeline */}
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]/60 lg:max-h-full">
            <div className="min-h-0 flex-1 overflow-y-auto px-3">
              <ToursExperiencesBudget vm={vm} dense />
              {selectedRows.length > 0 ? (
                <ToursExperiencesTimeline vm={vm} dense />
              ) : (
                <p className="py-4 text-[11px] text-white/40">
                  Select tours and experiences from the catalog. Your day
                  timeline appears here.
                </p>
              )}
            </div>
          </aside>
        </div>

        <ToursExperiencesDone onDone={handleDone} dense />
        <ToursExperiencesToast toast={toast} dense />
      </div>
    </motion.div>
  );
}
