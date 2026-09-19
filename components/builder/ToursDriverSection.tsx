"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, type MouseEvent } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Compass,
  Sparkles,
} from "lucide-react";
import type { PbCity, PbTour } from "@/lib/pocketbase/client";
import type { SeasonalHighlight } from "@/lib/seasonalMatcher";
import {
  useBuilderStore,
  type ExperienceService,
} from "@/store/useBuilderStore";
import { SectionBlock } from "./ui";
import { ExplainerTriggerButton } from "./ExplainerTriggerButton";
import { useLazyModalMount } from "./modals/useLazyModalMount";
import { SectionContinue } from "./SectionContinue";
import { EliteDifferenceModal } from "./modals/EliteDifferenceModal";

const ConciergeEditorModal = dynamic(
  () =>
    import("./modals/ConciergeEditorModal").then((m) => ({
      default: m.ConciergeEditorModal,
    })),
  { ssr: false }
);

const TailoredExperiencesModal = dynamic(
  () =>
    import("./modals/TailoredExperiencesModal").then((m) => ({
      default: m.TailoredExperiencesModal,
    })),
  { ssr: false }
);

export function ToursDriverSection({
  tours,
  cities = [],
  cityNames,
  allowToursOnTravelDays = false,
  seasonalHighlights = [],
}: {
  tours: PbTour[];
  cities?: PbCity[];
  cityNames: Record<string, string>;
  allowToursOnTravelDays?: boolean;
  seasonalHighlights?: SeasonalHighlight[];
}) {
  const [activeModal, setActiveModal] = useState<
    "concierge" | "tailored" | null
  >(null);
  const [eliteDiffOpen, setEliteDiffOpen] = useState(false);
  const conciergeMounted = useLazyModalMount(activeModal === "concierge");
  const tailoredMounted = useLazyModalMount(activeModal === "tailored");

  const experienceService = useBuilderStore((s) => s.experienceService);
  const isEliteConcierge = useBuilderStore((s) => s.isEliteConcierge);
  const selectedTourIds = useBuilderStore((s) => s.selectedTourIds);
  const selectedToursMap = useBuilderStore((s) => s.selectedTours);
  const conciergeLocked = isEliteConcierge || experienceService === "concierge";

  const tourCount = selectedTourIds.length;

  const summary =
    experienceService === "concierge"
      ? "Elite Concierge package"
      : experienceService === "tailored"
        ? tourCount === 0
          ? "No tours selected"
          : `${tourCount} experience${tourCount === 1 ? "" : "s"}`
        : "Choose a pathway";

  const cityBreakdown = useMemo(() => {
    if (experienceService !== "tailored") return [];
    return Object.entries(selectedToursMap)
      .map(([cityId, rows]) => ({
        cityId,
        name: cityNames[cityId] ?? "City",
        count: rows.length,
      }))
      .filter((r) => r.count > 0);
  }, [cityNames, experienceService, selectedToursMap]);

  return (
    <SectionBlock
      number={5}
      title="Tours & Experiences"
      id="section-tours"
      icon="tour"
      summary={summary}
    >
      {conciergeLocked ? (
        <div className="mb-4 rounded-2xl border border-[#B85304]/40 bg-[#B85304]/15 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent-500">
            ✨ Elite Concierge Active
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-300">
            Individual tours and experiences are deactivated. Your specialist
            will curate day-by-day itinerary, tours, and logistics with a
            bespoke quotation before final booking.
          </p>
        </div>
      ) : null}

      <div
        className={`mb-4 grid grid-cols-2 gap-3 ${
          conciergeLocked ? "opacity-90" : ""
        }`}
      >
        <PathwayCard
          kind="concierge"
          selected={experienceService === "concierge"}
          title="Elite Concierge"
          description="Full day-by-day design by a luxury specialist — dining, access, and cultural translation included."
          onClick={() => setActiveModal("concierge")}
        />
        <PathwayCard
          kind="tailored"
          selected={experienceService === "tailored"}
          title="Tailored Experiences"
          description="Browse guided tours, workshops, and tickets city by city — drivers are configured in the next step."
          actionLabel="Configure Experiences →"
          onClick={() => {
            if (conciergeLocked) {
              setActiveModal("concierge");
              return;
            }
            setActiveModal("tailored");
          }}
          onLearnMore={(e) => {
            e.stopPropagation();
            setEliteDiffOpen(true);
          }}
          disabled={conciergeLocked}
        />
      </div>

      <div className="mb-6 flex flex-col gap-3">
        <ExplainerTriggerButton
          featureKey="guide_explainer"
          title="Watch: Why you need a private guide in Japan"
        />
      </div>

      <SelectionSummaryWidget
        experienceService={experienceService}
        tourCount={tourCount}
        cityBreakdown={cityBreakdown}
        onEdit={() =>
          setActiveModal(
            experienceService === "concierge" ? "concierge" : "tailored"
          )
        }
      />

      <SectionContinue next={6} />

      {conciergeMounted ? (
        <ConciergeEditorModal
          open={activeModal === "concierge"}
          onClose={() => setActiveModal(null)}
        />
      ) : null}

      {tailoredMounted && !conciergeLocked ? (
        <TailoredExperiencesModal
          open={activeModal === "tailored"}
          onClose={() => setActiveModal(null)}
          tours={tours}
          cities={cities}
          cityNames={cityNames}
          allowToursOnTravelDays={allowToursOnTravelDays}
          seasonalHighlights={seasonalHighlights}
          hideTransport
        />
      ) : null}

      <EliteDifferenceModal
        open={eliteDiffOpen}
        onClose={() => setEliteDiffOpen(false)}
        onConfirm={() => {
          if (!conciergeLocked) setActiveModal("tailored");
        }}
      />
    </SectionBlock>
  );
}

function PathwayCard({
  kind,
  selected,
  title,
  description,
  onClick,
  onLearnMore,
  actionLabel,
  disabled = false,
}: {
  kind: "concierge" | "tailored";
  selected: boolean;
  title: string;
  description: string;
  onClick: () => void;
  onLearnMore?: (e: MouseEvent) => void;
  actionLabel?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      disabled={disabled && kind === "tailored"}
      className={`group flex min-h-[9.5rem] flex-col rounded-[1.35rem] border p-4 text-left transition sm:min-h-[10.5rem] ${
        disabled && kind === "tailored"
          ? "cursor-not-allowed border-zinc-800 bg-zinc-950 opacity-45"
          : selected
            ? "border-[#B85304] bg-[#1C1C1E] ring-1 ring-[#B85304]/40"
            : "border-zinc-800 bg-[#1C1C1E] hover:border-[#B85304]/45 hover:bg-[#222226]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 md:text-xs">
          {kind === "concierge" ? "Premium" : "Self-guided"}
        </p>
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full sm:h-8 sm:w-8 ${
            kind === "concierge"
              ? "bg-[#B85304]/15 text-[#B85304]"
              : "bg-sky-500/15 text-sky-400"
          }`}
          aria-hidden
        >
          {kind === "concierge" ? (
            <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          ) : (
            <Compass className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          )}
        </span>
      </div>

      <p className="mt-2 text-base font-bold leading-snug text-white md:text-xl">
        {title}
      </p>
      <p className="mt-2 flex-1 text-xs leading-relaxed text-zinc-400 line-clamp-3 md:line-clamp-none">
        {description}
      </p>

      {onLearnMore ? (
        <span
          role="link"
          tabIndex={0}
          onClick={onLearnMore}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onLearnMore(e as unknown as MouseEvent);
            }
          }}
          className="mt-2 block cursor-pointer text-xs font-semibold text-[#B85304] underline transition hover:text-white"
        >
          Learn More
        </span>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-zinc-800/80 pt-3 sm:mt-4">
        <span
          className={`text-xs font-medium ${
            selected ? "text-[#B85304]" : "text-zinc-500"
          }`}
        >
          {selected
            ? "Selected"
            : actionLabel ?? "Open"}
        </span>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-zinc-600 transition group-hover:text-[#B85304]"
          aria-hidden
        />
      </div>
    </button>
  );
}

function SelectionSummaryWidget({
  experienceService,
  tourCount,
  cityBreakdown,
  onEdit,
}: {
  experienceService: ExperienceService;
  tourCount: number;
  cityBreakdown: { cityId: string; name: string; count: number }[];
  onEdit: () => void;
}) {
  const hasSelection = experienceService !== null;

  return (
    <button
      type="button"
      onClick={onEdit}
      disabled={!hasSelection}
      className="group w-full rounded-[1.35rem] border border-zinc-800 bg-zinc-900 p-4 text-left transition hover:border-[#B85304]/45 hover:bg-zinc-800/80 disabled:cursor-default disabled:opacity-70 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
            Your selection
          </p>
          <p className="mt-1 font-display text-xl text-white sm:text-2xl">
            {!hasSelection
              ? "No pathway chosen"
              : experienceService === "concierge"
                ? "Elite Concierge"
                : "Tailored Experiences"}
          </p>
        </div>
        {hasSelection ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
      </div>

      {!hasSelection ? (
        <p className="mt-3 text-sm text-zinc-500">
          Choose Elite Concierge or Tailored Experiences above to continue.
        </p>
      ) : experienceService === "concierge" ? (
        <p className="mt-3 text-sm text-zinc-400">
          €50 design deposit selected. 100% credited toward your final trip
          balance when you book. Your concierge will design the full day-by-day
          plan.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-zinc-400">
            {tourCount === 0
              ? "No experiences added yet"
              : `${tourCount} experience${tourCount === 1 ? "" : "s"}`}
          </p>
          {cityBreakdown.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {cityBreakdown.map((c) => (
                <li
                  key={c.cityId}
                  className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300"
                >
                  {c.name} · {c.count}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {hasSelection ? (
        <div className="mt-4 flex items-center justify-end border-t border-zinc-800/80 pt-3">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 transition group-hover:text-[#B85304]">
            Edit
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        </div>
      ) : null}
    </button>
  );
}
