"use client";

import { BUILDER_S_HERO_CONFIG } from "@/config/teamConfig";
import { useBuilderAccordionOptional } from "@/components/builder/BuilderAccordion";
import { canOpenBuilderStep } from "@/lib/builderSteps";
import { TimelineProgressMascot } from "@/components/branding/TimelineProgressMascot";

const SECTIONS = BUILDER_S_HERO_CONFIG.steps;

/** 4-step sticky tracker for Builder S (Duration → City → Experiences → Transit). */
export function SingleDayProgressBar() {
  const accordion = useBuilderAccordionOptional();
  const open = accordion?.openSection ?? null;
  const highestUnlocked = accordion?.highestUnlockedStep ?? 1;

  const statuses = SECTIONS.map((sec) => {
    const locked = !canOpenBuilderStep(sec.number, highestUnlocked);
    let kind: "done" | "current" | "upcoming" | "locked";
    if (locked) kind = "locked";
    else if (open === sec.number) kind = "current";
    else if (sec.number < highestUnlocked) kind = "done";
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
      .map((s, i) =>
        s.kind === "done" || s.kind === "current" ? i : -1
      )
      .filter((i) => i >= 0),
    0
  );
  const progressPct =
    SECTIONS.length <= 1 ? 0 : (lastReached / (SECTIONS.length - 1)) * 100;

  return (
    <div className="sticky top-0 z-40 overflow-visible border-b border-[#2C2C2E] bg-[#000000] px-3 py-3.5 shadow-xl backdrop-blur-md sm:px-6">
      <div className="flex items-start gap-2 overflow-visible sm:gap-3">
        <nav aria-label="Single-day builder progress" className="min-w-0 flex-1">
          <ol className="relative flex items-start justify-between gap-1">
            <span
              aria-hidden
              className="absolute left-[10%] right-[10%] top-[14px] h-[2px] bg-[#2C2C2E]"
            />
            <span
              aria-hidden
              className="absolute left-[10%] top-[14px] h-[2px] bg-[#182536] transition-[width] duration-300"
              style={{ width: `${(progressPct / 100) * 80}%` }}
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
                      accordion?.showToast(
                        "Complete the previous steps before unlocking this section."
                      );
                      return;
                    }
                    const opened = accordion?.tryOpenSection(sec.number);
                    if (opened === false) return;
                    document
                      .getElementById(sec.sectionId)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={`flex w-full flex-col items-center gap-1 text-center ${
                    sec.locked
                      ? "pointer-events-none cursor-not-allowed opacity-40"
                      : ""
                  }`}
                >
                  <Node kind={sec.kind === "locked" ? "upcoming" : sec.kind} />
                  <span
                    className={`max-w-full pt-1 text-[10px] font-semibold leading-tight tracking-tight sm:text-[11px] ${
                      sec.kind === "current"
                        ? "text-[#075473]"
                        : sec.kind === "done"
                          ? "text-white"
                          : "text-zinc-400"
                    }`}
                  >
                    {sec.label}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <TimelineProgressMascot className="mt-3 -mb-5 sm:mt-4" />
      </div>
    </div>
  );
}

function Node({ kind }: { kind: "done" | "current" | "upcoming" }) {
  if (kind === "done") {
    return (
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full bg-[#273D59] text-white shadow-sm"
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
        className="flex h-7 w-7 items-center justify-center rounded-full bg-[#075473] text-[#000000] shadow-[0_0_10px_rgba(226,196,152,0.4)]"
        aria-label="Current step"
      >
        <span className="h-2 w-2 rounded-full bg-[#000000]" />
      </span>
    );
  }
  return (
    <span
      className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-800 bg-[#1C1C1E] text-zinc-500"
      aria-label="Upcoming step"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
    </span>
  );
}
