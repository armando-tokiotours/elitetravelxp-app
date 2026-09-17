"use client";

import {
  BUILDER_SECTION_IDS,
  builderStepIncompleteMessage,
  isBuilderStepComplete,
} from "@/lib/builderSteps";
import { useBuilderStore } from "@/store/useBuilderStore";
import { useBuilderAccordionOptional } from "./BuilderAccordion";

/** Advances accordion to the next section after validating the current step. */
export function SectionContinue({
  next,
  label = "Continue",
}: {
  next: number;
  label?: string;
}) {
  const accordion = useBuilderAccordionOptional();
  const unlockBuilderStep = useBuilderStore((s) => s.unlockBuilderStep);
  const arrivalDate = useBuilderStore((s) => s.arrivalDate);
  const durationDays = useBuilderStore((s) => s.durationDays);
  const adults = useBuilderStore((s) => s.adults);
  const children = useBuilderStore((s) => s.children);
  const arrivalTransferId = useBuilderStore((s) => s.arrivalTransferId);
  const departureTransferId = useBuilderStore((s) => s.departureTransferId);
  const locations = useBuilderStore((s) => s.locations);
  const cityHotels = useBuilderStore((s) => s.cityHotels);

  if (!accordion) return null;

  const currentStep = next - 1;

  const onContinue = () => {
    const snapshot = {
      arrivalDate,
      durationDays,
      adults,
      children,
      arrivalTransferId,
      departureTransferId,
      locations,
      cityHotels,
    };
    if (!isBuilderStepComplete(currentStep, snapshot)) {
      accordion.showToast(
        builderStepIncompleteMessage(currentStep, snapshot)
      );
      return;
    }
    unlockBuilderStep(next);
    accordion.openOnly(next);
    const id = BUILDER_SECTION_IDS[next];
    if (id) {
      requestAnimationFrame(() => {
        document
          .getElementById(id)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  return (
    <div className="mt-5 flex justify-end">
      <button
        type="button"
        onClick={onContinue}
        className="rounded-full bg-[#0B1F3A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#143052]"
      >
        {label} →
      </button>
    </div>
  );
}
