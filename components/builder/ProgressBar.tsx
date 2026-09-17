"use client";

import { useEffect, useState } from "react";
import { useBuilderStore } from "@/store/useBuilderStore";
import { useBuilderAccordionOptional } from "./BuilderAccordion";

const SECTIONS = [
  {
    id: "duration",
    label: "Duration",
    href: "#section-duration",
    number: 1,
  },
  {
    id: "arrival",
    label: "Arrival / Departure",
    href: "#section-arrival",
    number: 2,
  },
  {
    id: "locations",
    label: "Locations & Nights",
    href: "#section-locations",
    number: 3,
  },
  {
    id: "hotels",
    label: "Hotels",
    href: "#section-hotels",
    number: 4,
  },
  {
    id: "tours",
    label: "Tours & Experiences",
    href: "#section-tours",
    number: 5,
  },
] as const;

/** Sticky step tracker — pins below the hero while scrolling the builder. */
export function ProgressBar() {
  return <StickyProgressBar />;
}

export function StickyProgressBar() {
  const accordion = useBuilderAccordionOptional();
  const durationDays = useBuilderStore((s) => s.durationDays);
  const arrivalTransferId = useBuilderStore((s) => s.arrivalTransferId);
  const departureTransferId = useBuilderStore((s) => s.departureTransferId);
  const adults = useBuilderStore((s) => s.adults);
  const children = useBuilderStore((s) => s.children);
  const locations = useBuilderStore((s) => s.locations);

  const [visitedTours, setVisitedTours] = useState(false);
  const open = accordion?.openSection ?? null;

  useEffect(() => {
    if (open === 5) setVisitedTours(true);
  }, [open]);

  const nights = locations.reduce((n, l) => n + l.nights, 0);

  const checks = [
    durationDays > 0 && adults + children > 0,
    !!arrivalTransferId && !!departureTransferId,
    locations.length >= 1 && nights === durationDays,
    locations.some((l) => l.nights > 0 && (!l.visitType || l.visitType === "stay")),
    visitedTours,
  ];

  const statuses = SECTIONS.map((sec, i) => {
    const done = checks[i];
    let kind: "done" | "current" | "upcoming";
    if (open === sec.number) kind = "current";
    else if (done) kind = "done";
    else kind = "upcoming";
    return { ...sec, kind };
  });

  return (
    <div className="sticky top-0 z-40 -mx-4 border-b border-zinc-800 bg-[#111111]/95 px-4 py-4 backdrop-blur-md sm:-mx-6 sm:px-6">
      <nav aria-label="Trip builder progress">
        <ol className="relative flex items-start justify-between gap-1">
          <span
            aria-hidden
            className="absolute left-[10%] right-[10%] top-[14px] h-[2px] bg-zinc-800"
          />
          {statuses.map((sec) => (
            <li
              key={sec.id}
              className="relative z-[1] flex flex-1 flex-col items-center"
            >
              <button
                type="button"
                onClick={() => {
                  accordion?.openOnly(sec.number);
                  document
                    .getElementById(sec.href.slice(1))
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="flex flex-col items-center gap-1.5 text-center"
              >
                <Node kind={sec.kind} />
                <span
                  className={`max-w-[4.8rem] text-[0.58rem] leading-tight sm:max-w-none sm:text-[0.68rem] ${
                    sec.kind === "upcoming"
                      ? "text-zinc-500"
                      : "font-medium text-white"
                  }`}
                >
                  {sec.label}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}

function Node({ kind }: { kind: "done" | "current" | "upcoming" }) {
  if (kind === "done") {
    return (
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0B1F3A] shadow-sm ring-1 ring-[#C4A35A]/40"
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
            stroke="white"
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
        className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0B1F3A] shadow-sm ring-1 ring-[#C4A35A]/50"
        aria-label="Current step"
      >
        <span className="h-2 w-2 rounded-full bg-white" />
      </span>
    );
  }
  return (
    <span
      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-zinc-700 bg-zinc-900"
      aria-label="Upcoming step"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
    </span>
  );
}
