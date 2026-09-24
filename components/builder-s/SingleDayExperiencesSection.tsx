"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Pencil, Route } from "lucide-react";
import type { PbCity, PbTour } from "@/lib/pocketbase/client";
import { SectionBlock } from "@/components/builder/ui";
import { useLazyModalMount } from "@/components/builder/modals/useLazyModalMount";
import { useSingleDayBuilderStore } from "@/store/useSingleDayBuilderStore";
import { useBuilderAccordionOptional } from "@/components/builder/BuilderAccordion";
import { formatDurationBadge, selectedHoursTotal } from "@/lib/experiencesPlaces";
import { calculateTimeSlots } from "@/lib/singleDayTimeSlots";

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

/**
 * Builder S §3 — Experiences & Places.
 * Catalog configure + Edit Route (draggable timed schedule).
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
  const catalogMounted = useLazyModalMount(catalogOpen);
  const routeMounted = useLazyModalMount(routeOpen);
  const accordion = useBuilderAccordionOptional();

  const selectedRows = useSingleDayBuilderStore((s) => s.selectedExperiences);
  const tourHours = useSingleDayBuilderStore((s) => s.tourHours);
  const startTime = useSingleDayBuilderStore((s) => s.startTime);
  const used = selectedHoursTotal(selectedRows);

  const timed = useMemo(
    () => calculateTimeSlots(startTime || "09:00", selectedRows),
    [startTime, selectedRows]
  );

  const summary =
    selectedRows.length === 0
      ? "Pick experiences & places"
      : `${selectedRows.length} stop${selectedRows.length === 1 ? "" : "s"} · ${formatDurationBadge(used)} / ${formatDurationBadge(tourHours)}`;

  const preview =
    selectedRows.length === 0
      ? "Browse experiences and landmark places for your city — filter by vibe, track your time budget, and build your day."
      : timed
          .map(
            (r) =>
              `${r.timeSlot} · ${r.title} (${formatDurationBadge(r.duration_hours)})`
          )
          .join(" → ");

  const requireCity = () => {
    if (!selectedCity) {
      accordion?.showToast("Choose a city focus first.");
      return false;
    }
    return true;
  };

  return (
    <SectionBlock
      number={3}
      title="Experiences & Places"
      id="section-experiences"
      icon="tour"
      summary={summary}
    >
      <button
        type="button"
        onClick={() => {
          if (!requireCity()) return;
          setCatalogOpen(true);
        }}
        className="w-full cursor-pointer rounded-2xl border border-white/10 bg-[#0D1117]/70 p-5 text-left backdrop-blur-md transition-all hover:border-[#075473]/40 hover:bg-[#0D1117]/90"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Day catalog
          </h3>
          <Pencil className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
        </div>
        <p className="mt-3 text-sm leading-relaxed text-white/80">{preview}</p>
        <p className="mt-2 text-xs text-[#F6A724]">
          {formatDurationBadge(used)} selected of {formatDurationBadge(tourHours)}{" "}
          available · starts {startTime || "09:00"}
        </p>
      </button>

      <button
        type="button"
        onClick={() => {
          if (!requireCity()) return;
          setCatalogOpen(true);
        }}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-[#075473]/50 bg-[#05080C]/60 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition hover:border-[#075473] hover:bg-[#075473]/20"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden />
        Configure Experiences & Places
      </button>

      {selectedRows.length > 0 ? (
        <button
          type="button"
          onClick={() => {
            if (!requireCity()) return;
            setRouteOpen(true);
          }}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-[#1BA58A]/45 bg-[#1BA58A]/10 py-2.5 text-sm font-semibold text-[#1BA58A] backdrop-blur-md transition hover:border-[#1BA58A] hover:bg-[#1BA58A]/20"
        >
          <Route className="h-3.5 w-3.5" aria-hidden />
          Edit Route &amp; Schedule
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => {
          useSingleDayBuilderStore.getState().setExperiencesStepDone(true);
          accordion?.advanceTo(4);
          requestAnimationFrame(() => {
            document
              .getElementById("section-transit")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        }}
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
    </SectionBlock>
  );
}
