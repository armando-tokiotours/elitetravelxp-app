"use client";

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
    id: "hotels",
    label: "Preferences",
    href: "#section-hotels",
    number: 3,
  },
  {
    id: "locations",
    label: "Locations & Nights",
    href: "#section-locations",
    number: 4,
  },
  {
    id: "tours",
    label: "Tours & Transfers",
    href: "#section-tours",
    number: 5,
  },
] as const;

export function ProgressBar() {
  const accordion = useBuilderAccordionOptional();
  const durationDays = useBuilderStore((s) => s.durationDays);
  const arrivalDate = useBuilderStore((s) => s.arrivalDate);
  const arrivalTransferId = useBuilderStore((s) => s.arrivalTransferId);
  const departureTransferId = useBuilderStore((s) => s.departureTransferId);
  const needHotels = useBuilderStore((s) => s.needHotels);
  const roomType = useBuilderStore((s) => s.roomType);
  const adults = useBuilderStore((s) => s.adults);
  const children = useBuilderStore((s) => s.children);
  const locations = useBuilderStore((s) => s.locations);
  const selectedTourIds = useBuilderStore((s) => s.selectedTourIds);
  const needDriver = useBuilderStore((s) => s.needDriver);

  const nights = locations.reduce((n, l) => n + l.nights, 0);
  const checks = [
    durationDays >= 1,
    !!arrivalTransferId && !!departureTransferId && !!arrivalDate,
    !needHotels || (!!roomType && adults + children > 0),
    locations.length > 0 && nights === durationDays,
    selectedTourIds.length > 0 || needDriver || locations.length > 0,
  ];

  const open = accordion?.openSection ?? null;

  const statuses = SECTIONS.map((sec, i) => {
    const done = checks[i];
    let kind: "done" | "current" | "upcoming";
    if (open === sec.number) kind = "current";
    else if (done) kind = "done";
    else kind = "upcoming";
    return { ...sec, kind };
  });

  return (
    <nav aria-label="Trip builder progress" className="mt-2 px-1">
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
  );
}

function Node({ kind }: { kind: "done" | "current" | "upcoming" }) {
  if (kind === "done") {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0B1F3A] text-[0.7rem] font-bold text-white shadow-sm">
        ✓
      </span>
    );
  }
  if (kind === "current") {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0B1F3A] shadow-sm">
        <span className="h-2 w-2 rounded-full bg-white" />
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#C4A35A] bg-[#FBF8F2]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#E8E2D9]" />
    </span>
  );
}
