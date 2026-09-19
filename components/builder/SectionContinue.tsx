"use client";

import { useRouter } from "next/navigation";
import {
  BUILDER_SECTION_IDS,
  BUILDER_STEP_COUNT,
  builderStepIncompleteMessage,
  isBuilderStepComplete,
} from "@/lib/builderSteps";
import { useBuilderStore } from "@/store/useBuilderStore";
import { useBuilderAccordionOptional } from "./BuilderAccordion";

/** Advances accordion to the next section after validating the current step. */
export function SectionContinue({
  next,
  label = "Save & Continue",
  savedLabel,
  href,
}: {
  next: number;
  label?: string;
  /** When set, shown instead of `label →` after this step is saved. */
  savedLabel?: string;
  /** When set, navigate here after unlock instead of opening the next accordion. */
  href?: string;
}) {
  const router = useRouter();
  const accordion = useBuilderAccordionOptional();
  const unlockBuilderStep = useBuilderStore((s) => s.unlockBuilderStep);
  const highestUnlockedStep = useBuilderStore((s) => s.highestUnlockedStep);
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
  /** Step was already saved / unlocked past — confirmed navy/emerald state */
  const isSaved = highestUnlockedStep >= next;
  const isFinalCta = Boolean(href);

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
    if (href) {
      router.push(href);
      return;
    }
    if (next > BUILDER_STEP_COUNT) return;
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

  const displayLabel = isSaved && savedLabel ? savedLabel : `${label} →`;

  return (
    <div className={isFinalCta ? "mt-5 w-full" : "mt-5 flex justify-end"}>
      <button
        type="button"
        onClick={onContinue}
        className={
          isFinalCta
            ? isSaved
              ? "w-full rounded-xl border border-emerald-500/40 bg-emerald-800 py-3 px-6 text-xs font-bold text-white shadow-lg transition hover:bg-emerald-700 sm:text-sm"
              : "w-full rounded-xl border border-cyan-500/40 bg-[#1E2D4A] py-3 px-6 text-xs font-bold text-white shadow-lg transition hover:bg-[#0A4074] sm:text-sm"
            : isSaved
              ? "rounded-full border border-blue-400/40 bg-[#1E2D4A] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#243656]"
              : "rounded-full border border-zinc-700 bg-[#1C1C1E] px-5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-[#B85304]"
        }
      >
        {displayLabel}
      </button>
    </div>
  );
}
