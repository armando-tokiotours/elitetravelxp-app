"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { CalendarDays, Clock3, Pencil, Users } from "lucide-react";
import type { PbSeasonTier } from "@/lib/pocketbase/client";
import { resolveSeasonInsight } from "@/lib/seasonality";
import {
  formatDisplayDate,
  useBuilderStore,
} from "@/store/useBuilderStore";
import { travelPaceLabel } from "@/lib/travelPace";
import { BoxGradingGlow } from "@/components/branding/BoxGradingGlow";
import { SectionBlock } from "./ui";
import { SectionContinue } from "./SectionContinue";
import { useLazyModalMount } from "./modals/useLazyModalMount";

const DaysDateEditorModal = dynamic(
  () =>
    import("./modals/DaysDateEditorModal").then((m) => ({
      default: m.DaysDateEditorModal,
    })),
  { ssr: false }
);

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
  const [isDaysDateOpen, setIsDaysDateOpen] = useState(false);
  const [isPaceGuestsOpen, setIsPaceGuestsOpen] = useState(false);
  const daysDateMounted = useLazyModalMount(isDaysDateOpen);
  const paceGuestsMounted = useLazyModalMount(isPaceGuestsOpen);

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
  const nights = Math.max(0, durationDays - 1);

  const hasBasics = durationDays > 0 && Boolean(arrivalDate);
  const daysDateSummary = hasBasics
    ? `${durationDays} Days · Arriving ${formatDisplayDate(arrivalDate)}`
    : durationDays > 0
      ? `${durationDays} Days · Set arrival date`
      : "Set duration and date";

  const paceGuestsSummary = `${totalGuests} Guest${totalGuests === 1 ? "" : "s"}${
    paceLabel ? ` · ${paceLabel} Pace` : " · Choose pace"
  }`;

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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <button
          type="button"
          onClick={() => setIsDaysDateOpen(true)}
          className="group relative flex min-h-[118px] flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]/70 p-4 text-left backdrop-blur-md transition-all hover:border-[#075473]/40 hover:bg-[#0D1117]/90 sm:min-h-[130px] sm:p-5"
        >
          <BoxGradingGlow />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#075473]">
                Timing
              </p>
              <h3 className="mt-1 text-sm font-semibold text-white">
                Days &amp; Dates
              </h3>
            </div>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-zinc-900 text-[#075473]">
              <CalendarDays className="h-4 w-4" aria-hidden />
            </span>
          </div>
          <p className="relative z-10 mt-3 text-base font-medium text-white">
            {daysDateSummary}
          </p>
          <p className="relative z-10 mt-1 text-xs text-zinc-400">
            {hasBasics
              ? `${nights} night${nights === 1 ? "" : "s"} · Calendar + trip length`
              : "Calendar / clock widget"}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setIsPaceGuestsOpen(true)}
          className="group relative flex min-h-[118px] flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]/70 p-4 text-left backdrop-blur-md transition-all hover:border-[#075473]/40 hover:bg-[#0D1117]/90 sm:min-h-[130px] sm:p-5"
        >
          <BoxGradingGlow />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#075473]">
                Party
              </p>
              <h3 className="mt-1 text-sm font-semibold text-white">
                Pace &amp; Guests
              </h3>
            </div>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-zinc-900 text-[#F6A724]">
              <Users className="h-4 w-4" aria-hidden />
            </span>
          </div>
          <p className="relative z-10 mt-3 text-base font-medium text-white">
            {paceGuestsSummary}
          </p>
          <p className="relative z-10 mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
            <Clock3 className="h-3 w-3 shrink-0 text-zinc-500" aria-hidden />
            Configure trip details
          </p>
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setIsDaysDateOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-[#075473]/50 bg-[#05080C]/60 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition hover:border-[#075473] hover:bg-[#075473]/20"
        >
          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
          Edit Days &amp; Dates
        </button>
        <button
          type="button"
          onClick={() => setIsPaceGuestsOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-[#075473]/50 bg-[#05080C]/60 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition hover:border-[#075473] hover:bg-[#075473]/20"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          Edit Pace &amp; Guests
        </button>
      </div>

      <SectionContinue next={2} />

      {daysDateMounted ? (
        <DaysDateEditorModal
          open={isDaysDateOpen}
          onClose={() => setIsDaysDateOpen(false)}
          seasonTiers={seasonTiers}
        />
      ) : null}

      {paceGuestsMounted ? (
        <DurationEditorModal
          open={isPaceGuestsOpen}
          onClose={() => setIsPaceGuestsOpen(false)}
        />
      ) : null}
    </SectionBlock>
  );
}
