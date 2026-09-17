"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import type { PbSeasonTier } from "@/lib/pocketbase/client";
import { resolveSeasonInsight } from "@/lib/seasonality";
import {
  formatDisplayDate,
  useBuilderStore,
} from "@/store/useBuilderStore";
import { travelPaceLabel } from "@/lib/travelPace";
import { SectionBlock } from "./ui";
import { SectionContinue } from "./SectionContinue";
import { useLazyModalMount } from "./modals/useLazyModalMount";

const DurationEditorModal = dynamic(
  () =>
    import("./modals/DurationEditorModal").then((m) => ({
      default: m.DurationEditorModal,
    })),
  { ssr: false }
);

export function TripDurationSection({
  seasonTiers = [],
}: {
  seasonTiers?: PbSeasonTier[];
}) {
  const [isDurationModalOpen, setIsDurationModalOpen] = useState(false);
  const modalMounted = useLazyModalMount(isDurationModalOpen);

  const durationDays = useBuilderStore((s) => s.durationDays);
  const arrivalDate = useBuilderStore((s) => s.arrivalDate);
  const adults = useBuilderStore((s) => s.adults);
  const children = useBuilderStore((s) => s.children);
  const travelPace = useBuilderStore((s) => s.travelPace);
  const setActiveSeason = useBuilderStore((s) => s.setActiveSeason);

  useEffect(() => {
    const insight = resolveSeasonInsight(seasonTiers, arrivalDate);
    if (!insight) {
      setActiveSeason(null, null);
      return;
    }
    setActiveSeason(insight.tier, {
      crowds: insight.crowd_level,
      note: insight.concierge_note,
    });
  }, [arrivalDate, seasonTiers, setActiveSeason]);

  const totalGuests = adults + children;
  const paceLabel = travelPaceLabel(travelPace);

  const hasBasics = durationDays > 0 && Boolean(arrivalDate);
  const row1 = hasBasics
    ? `${durationDays} Days · Arriving ${formatDisplayDate(arrivalDate)}`
    : "Set duration and date";
  const row2 = `${totalGuests} Guest${totalGuests === 1 ? "" : "s"}${
    paceLabel ? ` · ${paceLabel} Pace` : ""
  }`;

  const openEditor = () => setIsDurationModalOpen(true);

  return (
    <SectionBlock
      number={1}
      title="Trip Duration"
      id="section-duration"
      icon="calendar"
      summary={`${durationDays} day${durationDays === 1 ? "" : "s"}${
        arrivalDate ? ` · ${formatDisplayDate(arrivalDate)}` : ""
      } · ${totalGuests} guest${totalGuests === 1 ? "" : "s"}${
        paceLabel ? ` · ${paceLabel}` : ""
      }`}
    >
      <button
        type="button"
        onClick={openEditor}
        className="w-full cursor-pointer rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left transition-all hover:bg-zinc-800/80"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Trip Details
          </h3>
          <Pencil className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
        </div>
        <p className="mt-3 text-lg font-medium text-white">{row1}</p>
        <p className="mt-1 text-sm text-zinc-400">{row2}</p>
      </button>

      <button
        type="button"
        onClick={openEditor}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-[#C4A35A]/50 bg-zinc-950 py-2.5 text-sm font-semibold text-white transition hover:border-[#C4A35A] hover:bg-[#0B1F3A]"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden />
        Edit Trip Details
      </button>

      <SectionContinue next={2} label="Continue to Arrival" />

      {modalMounted ? (
        <DurationEditorModal
          open={isDurationModalOpen}
          onClose={() => setIsDurationModalOpen(false)}
          seasonTiers={seasonTiers}
        />
      ) : null}
    </SectionBlock>
  );
}
