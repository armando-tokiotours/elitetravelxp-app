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
 * Builder S — Tours & Experiences mobile full-page view.
 * Single column, larger touch targets, stacked cards.
 */
export function ToursAndExperiencesMobile({
  vm,
}: {
  vm: ToursAndExperiencesViewModel;
}) {
  const { onClose, handleDone, toast } = vm;

  return (
    <motion.div
      key="tours-experiences-mobile"
      className="fixed inset-0 z-[110] flex h-full w-full flex-col bg-[#0A1017] px-4 py-5"
      role="dialog"
      aria-modal="true"
      aria-label="Tours and Experiences"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <ToursExperiencesHeader onClose={onClose} />

      <div className="relative mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col overflow-hidden">
        <ToursExperiencesBudget vm={vm} />
        <ToursExperiencesTimeline vm={vm} />
        <ToursExperiencesSegments vm={vm} />
        <ToursExperiencesVibeFilters vm={vm} />
        <ToursExperiencesFeed vm={vm} />
        <ToursExperiencesDone onDone={handleDone} />
        <ToursExperiencesToast toast={toast} />
      </div>
    </motion.div>
  );
}
