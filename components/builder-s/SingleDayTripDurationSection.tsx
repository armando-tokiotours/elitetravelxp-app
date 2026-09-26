"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Pencil } from "lucide-react";
import type { PbSeasonTier } from "@/lib/pocketbase/client";
import { SectionBlock } from "@/components/builder/ui";
import { BoxGradingGlow } from "@/components/branding/BoxGradingGlow";
import { useLazyModalMount } from "@/components/builder/modals/useLazyModalMount";
import {
  formatSingleDayDisplayDate,
  useSingleDayBuilderStore,
} from "@/store/useSingleDayBuilderStore";
import { useBuilderAccordionOptional } from "@/components/builder/BuilderAccordion";
import {
  isSingleDayStep1Complete,
  singleDayStepIncompleteMessage,
} from "@/lib/singleDaySteps";

const SingleDayTripDetailModal = dynamic(
  () =>
    import("./SingleDayTripDetailModal").then((m) => ({
      default: m.SingleDayTripDetailModal,
    })),
  { ssr: false }
);

/**
 * Builder S §1 — Trip Duration (1 day locked).
 * Opens `SingleDayTripDetailModal`; never touches multi-day store fields.
 */
export function SingleDayTripDurationSection({
  seasonTiers = [],
}: {
  seasonTiers?: PbSeasonTier[];
}) {
  const [open, setOpen] = useState(false);
  const modalMounted = useLazyModalMount(open);
  const accordion = useBuilderAccordionOptional();

  const tourDate = useSingleDayBuilderStore((s) => s.tourDate);
  const adults = useSingleDayBuilderStore((s) => s.adults);
  const children = useSingleDayBuilderStore((s) => s.children);
  const tourHours = useSingleDayBuilderStore((s) => s.tourHours);
  const totalGuests = adults + children;

  const row1 = tourDate
    ? `${tourHours}h · ${formatSingleDayDisplayDate(tourDate)}`
    : `${tourHours}h · Set tour date`;
  const row2 = `${totalGuests} Guest${totalGuests === 1 ? "" : "s"}`;

  return (
    <SectionBlock
      number={1}
      title="Trip Duration"
      id="section-duration"
      icon="calendar"
      summary={`${tourHours}h · ${tourDate ? formatSingleDayDisplayDate(tourDate) : "Set date"} · ${totalGuests} guest${totalGuests === 1 ? "" : "s"}`}
      bypassLock
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative w-full cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]/70 p-5 text-left backdrop-blur-md transition-all hover:border-[#075473]/40 hover:bg-[#0D1117]/90"
      >
        {/* Box grading: navy left + amber right */}
        <BoxGradingGlow />
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Single-day overview
            </h3>
            <Pencil className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
          </div>
          <p className="mt-3 text-lg font-medium text-white">{row1}</p>
          <p className="mt-1 text-sm text-zinc-400">{row2}</p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-[#075473]/50 bg-[#05080C]/60 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition hover:border-[#075473] hover:bg-[#075473]/20"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden />
        Edit Tour Details
      </button>

      <button
        type="button"
        onClick={() => {
          const snap = useSingleDayBuilderStore.getState();
          if (
            !isSingleDayStep1Complete({
              tourDate: snap.tourDate,
              tourHours: snap.tourHours,
              adults: snap.adults,
              cityFocus: snap.cityFocus,
              selectedExperienceCount: snap.selectedExperiences.length,
              experiencesStepDone: snap.experiencesStepDone,
            })
          ) {
            accordion?.showToast(singleDayStepIncompleteMessage(1));
            return;
          }
          accordion?.advanceTo(2);
          requestAnimationFrame(() => {
            document
              .getElementById("section-city-focus")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        }}
        className="mt-3 flex w-full items-center justify-center rounded-full border border-[#075473]/50 bg-[#05080C]/60 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition hover:border-[#075473] hover:bg-[#075473]/20"
      >
        Save & Continue →
      </button>

      {modalMounted ? (
        <SingleDayTripDetailModal
          open={open}
          onClose={() => setOpen(false)}
          seasonTiers={seasonTiers}
        />
      ) : null}
    </SectionBlock>
  );
}
