"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Compass, Route, Sparkles } from "lucide-react";
import type { PbCity, PbTour } from "@/lib/pocketbase/client";
import { SectionBlock } from "@/components/builder/ui";
import { useLazyModalMount } from "@/components/builder/modals/useLazyModalMount";
import { useSingleDayBuilderStore } from "@/store/useSingleDayBuilderStore";
import { useBuilderAccordionOptional } from "@/components/builder/BuilderAccordion";
import { formatDurationBadge, selectedHoursTotal } from "@/lib/experiencesPlaces";
import { QUIZ_VIBE } from "@/lib/experienceProfiler";
import { useQuizStore } from "@/store/useQuizStore";

const ExperiencesPlacesModal = dynamic(
  () =>
    import("./ExperiencesPlacesModal").then((m) => ({
      default: m.ExperiencesPlacesModal,
    })),
  { ssr: false }
);

const SingleDayRouteModal = dynamic(
  () =>
    import("./SingleDayRouteModal").then((m) => ({
      default: m.SingleDayRouteModal,
    })),
  { ssr: false }
);

const ExperienceProfilerModal = dynamic(
  () =>
    import("@/components/quiz/ExperienceProfilerModal").then((m) => ({
      default: m.ExperienceProfilerModal,
    })),
  { ssr: false }
);

/**
 * Builder S §3 — Experiences & Places.
 * Three equal cards: Day Catalog · Route & Timeline · Match Suggestions.
 */
export function SingleDayExperiencesSection({
  catalog,
  selectedCity,
}: {
  catalog: PbTour[];
  selectedCity: PbCity | null;
}) {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const catalogMounted = useLazyModalMount(catalogOpen);
  const routeMounted = useLazyModalMount(routeOpen);
  const quizMounted = useLazyModalMount(quizOpen);
  const accordion = useBuilderAccordionOptional();

  const selectedRows = useSingleDayBuilderStore((s) => s.selectedExperiences);
  const tourHours = useSingleDayBuilderStore((s) => s.tourHours);
  const used = selectedHoursTotal(selectedRows);

  const isQuizCompleted = useQuizStore((s) => s.isQuizCompleted);
  const travelProfile = useQuizStore((s) => s.travelProfile);

  const catalogHeadline = useMemo(() => {
    if (selectedRows.length === 0) {
      return "Select experiences for your day";
    }
    if (selectedRows.length === 1) {
      return selectedRows[0].title;
    }
    return `${selectedRows[0].title} +${selectedRows.length - 1}`;
  }, [selectedRows]);

  const catalogSub = `${formatDurationBadge(used)} selected of ${formatDurationBadge(tourHours)}`;

  const stopCount = selectedRows.length;
  const routeSub =
    stopCount === 0
      ? "Drag & auto-time slots"
      : `${stopCount} Stop${stopCount === 1 ? "" : "s"} Configured · Drag & auto-time`;

  const matchLabel = useMemo(() => {
    if (!isQuizCompleted || !travelProfile) return null;
    const vibe =
      QUIZ_VIBE.find((o) => o.id === travelProfile.vibe)?.label ??
      travelProfile.vibe;
    return vibe;
  }, [isQuizCompleted, travelProfile]);

  const summary =
    selectedRows.length === 0
      ? "Pick experiences & places"
      : `${selectedRows.length} stop${selectedRows.length === 1 ? "" : "s"} · ${formatDurationBadge(used)} / ${formatDurationBadge(tourHours)}`;

  const requireCity = () => {
    if (!selectedCity) {
      accordion?.showToast("Choose a city focus first.");
      return false;
    }
    return true;
  };

  const saveAndContinue = () => {
    useSingleDayBuilderStore.getState().setExperiencesStepDone(true);
    accordion?.advanceTo(4);
    requestAnimationFrame(() => {
      document
        .getElementById("section-transit")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <SectionBlock
      number={3}
      title="Experiences & Places"
      id="section-experiences"
      icon="tour"
      summary={summary}
    >
      {/* 3 equal horizontal cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
        {/* Card 1 — Day Catalog */}
        <button
          type="button"
          onClick={() => {
            if (!requireCity()) return;
            setCatalogOpen(true);
          }}
          className="flex min-h-[7.5rem] flex-col rounded-2xl border border-white/10 bg-[#0D1117]/75 p-2.5 text-left backdrop-blur-md transition hover:border-[#075473]/50 hover:bg-[#0D1117]/95 sm:min-h-[8.5rem] sm:p-3.5"
        >
          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#1BA58A] sm:text-[10px]">
            <Compass className="h-3 w-3 shrink-0" aria-hidden />
            Day Catalog
          </span>
          <span className="mt-2 line-clamp-3 text-[11px] font-semibold leading-snug text-white sm:text-xs">
            {catalogHeadline}
          </span>
          <span className="mt-auto pt-2 text-[10px] font-medium leading-snug text-[#F6A724] sm:text-[11px]">
            {catalogSub}
          </span>
        </button>

        {/* Card 2 — Route & Timeline */}
        <button
          type="button"
          onClick={() => {
            if (!requireCity()) return;
            setRouteOpen(true);
          }}
          className="flex min-h-[7.5rem] flex-col rounded-2xl border border-white/10 bg-[#0D1117]/75 p-2.5 text-left backdrop-blur-md transition hover:border-[#075473]/50 hover:bg-[#0D1117]/95 sm:min-h-[8.5rem] sm:p-3.5"
        >
          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#1BA58A] sm:text-[10px]">
            <Route className="h-3 w-3 shrink-0" aria-hidden />
            Route &amp; Timeline
          </span>
          <span className="mt-2 line-clamp-2 text-[11px] font-semibold leading-snug text-white sm:text-xs">
            {stopCount === 0
              ? "Build your day order"
              : `${stopCount} Stop${stopCount === 1 ? "" : "s"} Configured`}
          </span>
          <span className="mt-auto pt-2 text-[10px] font-medium leading-snug text-white/50 sm:text-[11px]">
            {routeSub}
          </span>
        </button>

        {/* Card 3 — Match Suggestions */}
        <button
          type="button"
          onClick={() => setQuizOpen(true)}
          className={`flex min-h-[7.5rem] flex-col rounded-2xl p-2.5 text-left backdrop-blur-md transition sm:min-h-[8.5rem] sm:p-3.5 ${
            isQuizCompleted && travelProfile
              ? "border border-white/10 bg-[#0D1117]/75 hover:border-[#075473]/50 hover:bg-[#0D1117]/95"
              : "border border-[#E60F43]/40 bg-[#E60F43]/10 hover:border-[#E60F43]/60 hover:bg-[#E60F43]/15"
          }`}
        >
          <span
            className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em] sm:text-[10px] ${
              isQuizCompleted && travelProfile
                ? "text-[#1BA58A]"
                : "text-[#E60F43]"
            }`}
          >
            <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
            Match
          </span>
          {isQuizCompleted && travelProfile && matchLabel ? (
            <>
              <span className="mt-2 line-clamp-2 text-[11px] font-semibold leading-snug text-white sm:text-xs">
                Matches: {matchLabel}
              </span>
              <span className="mt-auto pt-2 text-[10px] font-medium text-white/50 sm:text-[11px]">
                Retake quiz anytime
              </span>
            </>
          ) : (
            <>
              <span className="mt-2 line-clamp-3 text-[11px] font-semibold leading-snug text-[#FFB7C5] sm:text-xs">
                Take 30-Sec Quiz → See tailored ideas
              </span>
              <span className="mt-auto pt-2 text-[10px] font-medium text-[#E60F43]/80 sm:text-[11px]">
                Zero-state · Match Quiz
              </span>
            </>
          )}
        </button>
      </div>

      <button
        type="button"
        onClick={saveAndContinue}
        className="mt-3 flex w-full items-center justify-center rounded-full border border-[#075473]/50 bg-[#05080C]/60 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition hover:border-[#075473] hover:bg-[#075473]/20"
      >
        Save & Continue →
      </button>

      {catalogMounted ? (
        <ExperiencesPlacesModal
          open={catalogOpen}
          onClose={() => setCatalogOpen(false)}
          catalog={catalog}
          selectedCity={selectedCity}
          onEditRoute={() => {
            setCatalogOpen(false);
            setRouteOpen(true);
          }}
        />
      ) : null}

      {routeMounted ? (
        <SingleDayRouteModal
          open={routeOpen}
          onClose={() => setRouteOpen(false)}
          catalog={catalog}
        />
      ) : null}

      {quizMounted ? (
        <ExperienceProfilerModal
          open={quizOpen}
          onClose={() => setQuizOpen(false)}
        />
      ) : null}
    </SectionBlock>
  );
}
