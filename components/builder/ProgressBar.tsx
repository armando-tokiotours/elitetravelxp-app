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
    label: "Hotels & Guests",
    href: "#section-hotels",
    number: 4,
  },
  {
    id: "tours",
    label: "Tours & Transfers",
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
    durationDays > 0,
    !!arrivalTransferId && !!departureTransferId,
    locations.length >= 1 && nights === durationDays,
    adults + children > 0,
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
    <div className="sticky top-0 z-40 -mx-4 border-b border-gray-200/50 bg-[#FDFBF7] px-4 py-4 shadow-sm sm:-mx-6 sm:px-6">
      <nav aria-label="Trip builder progress">
        <ol className="relative flex items-start justify-between gap-1">
          <span
            aria-hidden
            className="absolute left-[10%] right-[10%] top-[14px] h-[2px] bg-[#E5DCCF]"
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
                      ? "text-[#B8B0A4]"
                      : "font-medium text-[#0B1F3A]"
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
        className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0B1F3A] shadow-sm"
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
        className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0B1F3A] shadow-sm"
        aria-label="Current step"
      >
        <span className="h-2 w-2 rounded-full bg-white" />
      </span>
    );
  }
  return (
    <span
      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#C4A35A] bg-[#FBF8F2]"
      aria-label="Upcoming step"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#E8E2D9]" />
    </span>
  );
}
