"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/useIsMobile";
import { ExperienceTimingModal } from "./ExperienceTimingModal";
import { ToursAndExperiencesMobile } from "./ToursAndExperiencesMobile";
import { ToursAndExperiencesWeb } from "./ToursAndExperiencesWeb";
import {
  useToursAndExperiences,
  type ToursAndExperiencesProps,
} from "./useToursAndExperiences";

const ExperienceProfilerModal = dynamic(
  () =>
    import("@/components/quiz/ExperienceProfilerModal").then((m) => ({
      default: m.ExperienceProfilerModal,
    })),
  { ssr: false }
);

/**
 * Builder S — Tours & Experiences full-page modal.
 * Switches between dedicated Web and Mobile layouts by viewport.
 */
export function ExperiencesPlacesModal(props: ToursAndExperiencesProps) {
  const vm = useToursAndExperiences(props);
  const isMobile = useIsMobile();
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => setPortalReady(true), []);

  if (!portalReady || !vm.mounted) return null;

  return createPortal(
    <>
      <AnimatePresence
        onExitComplete={() => {
          document.body.style.overflow = "";
        }}
      >
        {props.open ? (
          isMobile ? (
            <ToursAndExperiencesMobile key="tours-exp-mobile" vm={vm} />
          ) : (
            <ToursAndExperiencesWeb key="tours-exp-web" vm={vm} />
          )
        ) : null}
      </AnimatePresence>
      <ExperienceTimingModal
        open={Boolean(vm.pendingTiming)}
        title={vm.pendingTiming?.item.title || "Experience"}
        tourDate={vm.tourDate}
        onConfirm={vm.confirmTiming}
        onCancel={vm.cancelTiming}
      />
      <ExperienceProfilerModal
        open={vm.quizOpen}
        onClose={() => vm.setQuizOpen(false)}
      />
    </>,
    document.body
  );
}

/** Alias for callers that prefer the Tours & Experiences naming. */
export { ExperiencesPlacesModal as ToursAndExperiencesModal };
export type { ToursAndExperiencesProps };
