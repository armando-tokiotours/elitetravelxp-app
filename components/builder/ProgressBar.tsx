"use client";

import { useEffect, useState } from "react";
import { useBuilderStore } from "@/store/useBuilderStore";
import {
  canOpenBuilderStep,
  isBuilderStepComplete,
} from "@/lib/builderSteps";
import { useBuilderAccordionOptional } from "./BuilderAccordion";
import {
  useBuilderEditModalOptional,
  type BuilderEditModalId,
} from "./BuilderEditModalContext";
import { TimelineMascotRow } from "@/components/branding/TimelineMascotRow";
import { getSystemMessage } from "@/lib/systemMessages";
import { showSystemMessage } from "@/store/useSystemMessageStore";

const SECTIONS = [
  {
    id: "duration",
    label: "Duration",
    shortLabel: "Duration",
    number: 1,
    modal: "duration" as const,
  },
  {
    id: "arrival",
    label: "Arrival / Departure",
    shortLabel: "Arrival",
    number: 2,
    modal: "transit" as const,
  },
  {
    id: "locations",
    label: "Locations & Nights",
    shortLabel: "Places",
    number: 3,
    modal: "locations" as const,
  },
  {
    id: "hotels",
    label: "Hotels",
    shortLabel: "Hotels",
    number: 4,
    modal: "hotels_transport" as const,
  },
  {
    id: "tours",
    label: "Tours & Experiences",
    shortLabel: "Tours",
    number: 5,
    modal: "tours" as const,
  },
  {
    id: "drivers",
    label: "Drivers & Transport",
    shortLabel: "Drivers",
    number: 6,
    modal: "drivers" as const,
  },
] as const;

function activeModalToStep(id: BuilderEditModalId): number | null {
  if (!id) return null;
  const hit = SECTIONS.find((s) => s.modal === id);
  return hit?.number ?? null;
}

/** Sticky step tracker — pinned at top of the builder while scrolling. */
export function ProgressBar() {
  return <StickyProgressBar />;
}

export function StickyProgressBar() {
  const accordion = useBuilderAccordionOptional();
  const editModal = useBuilderEditModalOptional();
  const highestUnlockedStep = useBuilderStore((s) => s.highestUnlockedStep);
  const durationDays = useBuilderStore((s) => s.durationDays);
  const arrivalDate = useBuilderStore((s) => s.arrivalDate);
  const arrivalTransferId = useBuilderStore((s) => s.arrivalTransferId);
  const departureTransferId = useBuilderStore((s) => s.departureTransferId);
  const adults = useBuilderStore((s) => s.adults);
  const children = useBuilderStore((s) => s.children);
  const locations = useBuilderStore((s) => s.locations);
  const cityHotels = useBuilderStore((s) => s.cityHotels);

  const [visitedTours, setVisitedTours] = useState(false);
  const [visitedDrivers, setVisitedDrivers] = useState(false);

  const openFromAccordion = accordion?.openSection ?? null;
  const openFromModal = activeModalToStep(editModal?.activeEditModal ?? null);
  const open = openFromModal ?? openFromAccordion;

  useEffect(() => {
    if (open === 5) setVisitedTours(true);
    if (open === 6) setVisitedDrivers(true);
  }, [open]);

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

  const statuses = SECTIONS.map((sec) => {
    const locked = !canOpenBuilderStep(sec.number, highestUnlockedStep);
    const done =
      sec.number < (open ?? 1)
        ? isBuilderStepComplete(sec.number, snapshot)
        : sec.number === 5
          ? visitedTours && !locked
          : sec.number === 6
            ? visitedDrivers && !locked
            : isBuilderStepComplete(sec.number, snapshot) &&
              sec.number < highestUnlockedStep;

    let kind: "done" | "current" | "upcoming" | "locked";
    if (locked) kind = "locked";
    else if (open === sec.number) kind = "current";
    else if (done || sec.number < highestUnlockedStep) kind = "done";
    else kind = "upcoming";

    return { ...sec, kind, locked };
  });

  const activeIndex = Math.max(
    0,
    statuses.findIndex((s) => s.kind === "current")
  );
  const lastReached = Math.max(
    activeIndex,
    ...statuses
      .map((s, i) => (s.kind === "done" || s.kind === "current" ? i : -1))
      .filter((i) => i >= 0),
    0
  );
  const progressPct =
    SECTIONS.length <= 1 ? 0 : (lastReached / (SECTIONS.length - 1)) * 100;

  return (
    <div className="sticky top-[3.75rem] z-40 overflow-visible border-b border-[#2C2C2E] bg-[#000000] px-2 py-2.5 shadow-xl backdrop-blur-md lg:top-0 sm:px-4 sm:py-3">
      <TimelineMascotRow variant="multi">
        <ol className="relative flex items-start justify-between gap-0.5">
          <span
            aria-hidden
            className="absolute left-[8%] right-[8%] top-[12px] h-[2px] bg-[#2C2C2E]"
          />
          <span
            aria-hidden
            className="absolute left-[8%] top-[12px] h-[2px] bg-[#182536] transition-[width] duration-300"
            style={{ width: `${(progressPct / 100) * 84}%` }}
          />
          {statuses.map((sec) => (
            <li
              key={sec.id}
              className="relative z-[1] flex min-w-0 flex-1 flex-col items-center"
            >
              <button
                type="button"
                disabled={sec.locked}
                onClick={() => {
                  if (sec.locked) {
                    const msg = getSystemMessage("builder_lock");
                    if (accordion) accordion.showToast(msg);
                    else
                      showSystemMessage({ text: msg, tone: "error" });
                    return;
                  }
                  if (editModal) {
                    editModal.openEditModal(sec.modal);
                    return;
                  }
                  const opened = accordion?.tryOpenSection(sec.number);
                  if (opened === false) return;
                }}
                className={`flex w-full flex-col items-center gap-0.5 text-center ${
                  sec.locked
                    ? "pointer-events-none cursor-not-allowed opacity-40"
                    : ""
                }`}
              >
                <Node kind={sec.kind === "locked" ? "upcoming" : sec.kind} />
                <span
                  className={`max-w-full pt-0.5 text-[9px] font-semibold leading-tight tracking-tight sm:text-[10px] ${
                    sec.kind === "current"
                      ? "text-[#075473]"
                      : sec.kind === "done"
                        ? "text-white"
                        : "text-zinc-400"
                  }`}
                >
                  <span className="sm:hidden">{sec.shortLabel}</span>
                  <span className="hidden sm:inline">{sec.label}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </TimelineMascotRow>
    </div>
  );
}

function Node({ kind }: { kind: "done" | "current" | "upcoming" }) {
  if (kind === "done") {
    return (
      <span
        className="flex h-6 w-6 items-center justify-center rounded-full bg-[#273D59] text-white shadow-sm sm:h-7 sm:w-7"
        aria-label="Completed"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden
        >
          <path
            d="M2.25 6.25L4.75 8.75L9.75 3.25"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  if (kind === "current") {
    return (
      <span
        className="flex h-6 w-6 items-center justify-center rounded-full bg-[#075473] text-[#000000] shadow-[0_0_10px_rgba(226,196,152,0.4)] sm:h-7 sm:w-7"
        aria-label="Current step"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[#000000] sm:h-2 sm:w-2" />
      </span>
    );
  }
  return (
    <span
      className="flex h-6 w-6 items-center justify-center rounded-full border border-zinc-800 bg-[#1C1C1E] text-zinc-500 sm:h-7 sm:w-7"
      aria-label="Upcoming step"
    >
      <span className="h-1 w-1 rounded-full bg-zinc-500 sm:h-1.5 sm:w-1.5" />
    </span>
  );
}
