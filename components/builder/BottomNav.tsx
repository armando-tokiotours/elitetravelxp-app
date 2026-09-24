"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExperienceProfilerModal } from "@/components/quiz/ExperienceProfilerModal";
import { useBuilderStore } from "@/store/useBuilderStore";
import { useItineraryStore } from "@/store/useItineraryStore";
import { useQuizStore } from "@/store/useQuizStore";

export function BottomNav() {
  const pathname = usePathname();
  const [quizOpen, setQuizOpen] = useState(false);
  const tripMode = useBuilderStore((s) => s.tripMode);
  const experienceProfile = useBuilderStore((s) => s.experienceProfile);
  const setExperienceProfile = useBuilderStore((s) => s.setExperienceProfile);
  const isQuizCompleted = useQuizStore((s) => s.isQuizCompleted);
  const clearUserProfile = useItineraryStore((s) => s.clearUserProfile);
  const isSingleDay =
    tripMode === "single_day" || pathname.startsWith("/builder-single");

  // Scrub stale Match Quiz profiles left by Pre-Elite hydrate / old sessions
  useEffect(() => {
    void useQuizStore.persist.rehydrate();
    const unsub = useQuizStore.persist.onFinishHydration(() => {
      if (!useQuizStore.getState().isQuizCompleted) {
        if (useBuilderStore.getState().experienceProfile) {
          useBuilderStore.setState({ experienceProfile: null });
        }
        useItineraryStore.getState().clearUserProfile();
      }
    });
    if (useQuizStore.persist.hasHydrated() && !isQuizCompleted) {
      if (experienceProfile) setExperienceProfile(null);
      clearUserProfile();
    }
    return unsub;
  }, [isQuizCompleted, experienceProfile, setExperienceProfile, clearUserProfile]);

  const builderHref = isSingleDay ? "/builder-single" : "/builder";
  const builderLabel = isSingleDay ? "Builder S" : "Builder M";
  const itineraryHref = isSingleDay
    ? "/builder-single/itinerary"
    : "/builder/itinerary";

  const tabs = [
    {
      href: "/pre-elite-builder",
      label: "Pre-Build",
      icon: PreBuildIcon,
      kind: "link" as const,
    },
    {
      href: builderHref,
      label: builderLabel,
      icon: BuilderIcon,
      kind: "link" as const,
      match: "builder" as const,
    },
    {
      href: "/discover",
      label: "Discover",
      icon: DiscoverIcon,
      kind: "link" as const,
    },
    {
      href: itineraryHref,
      label: "Itinerary",
      icon: ItineraryIcon,
      kind: "link" as const,
      match: "itinerary" as const,
    },
    {
      href: "#quiz",
      label: "Match Quiz",
      icon: QuizIcon,
      kind: "quiz" as const,
    },
  ];

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0D1117]/85 backdrop-blur-md lg:hidden">
        <ul className="mx-auto flex max-w-lg items-stretch justify-around px-0.5 pb-[env(safe-area-inset-bottom)]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            if (tab.kind === "quiz") {
              return (
                <li key="quiz" className="flex-1">
                  <button
                    type="button"
                    onClick={() => setQuizOpen(true)}
                    className={`flex w-full flex-col items-center gap-0.5 px-0.5 py-2.5 text-[0.6rem] ${
                      quizOpen ? "text-white" : "text-zinc-400"
                    }`}
                    aria-pressed={quizOpen}
                  >
                    <Icon active={quizOpen} />
                    <span className={quizOpen ? "font-semibold" : ""}>
                      {tab.label}
                    </span>
                  </button>
                </li>
              );
            }
            const active =
              tab.match === "builder"
                ? pathname === "/builder" ||
                  (pathname.startsWith("/builder-single") &&
                    !pathname.startsWith("/builder-single/itinerary"))
                : tab.match === "itinerary"
                  ? pathname.startsWith("/builder-single/itinerary") ||
                    pathname.startsWith("/builder/itinerary")
                  : tab.href === "/builder"
                    ? pathname === "/builder"
                    : pathname.startsWith(tab.href);
            return (
              <li key={`${tab.href}-${tab.label}`} className="flex-1">
                <Link
                  href={tab.href}
                  className={`flex flex-col items-center gap-0.5 px-0.5 py-2.5 text-[0.6rem] ${
                    active ? "text-white" : "text-zinc-400"
                  }`}
                >
                  <Icon active={active} />
                  <span className={active ? "font-semibold" : ""}>
                    {tab.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <ExperienceProfilerModal
        open={quizOpen}
        onClose={() => setQuizOpen(false)}
      />
    </>
  );
}

function BuilderIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7h16M4 12h10M4 17h14"
        stroke={active ? "#075473" : "#a1a1aa"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DiscoverIcon({ active }: { active: boolean }) {
  const stroke = active ? "#075473" : "#a1a1aa";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={stroke} strokeWidth="1.8" />
      <path
        d="M14.5 9.5l-1.2 4.3-4.3 1.2 1.2-4.3 4.3-1.2z"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ItineraryIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect
        x="5"
        y="3.5"
        width="14"
        height="17"
        rx="2"
        stroke={active ? "#075473" : "#a1a1aa"}
        strokeWidth="1.8"
      />
      <path
        d="M8 8h8M8 12h8M8 16h5"
        stroke={active ? "#075473" : "#a1a1aa"}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Qualification brief / Pre-Elite Builder */
function PreBuildIcon({ active }: { active: boolean }) {
  const stroke = active ? "#075473" : "#a1a1aa";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M8 4.5h7.5L18.5 7v12.5a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 19.5v-13A2 2 0 0 1 8 4.5z"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M15 4.5V7h2.5"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 11h5M9.5 14.5h5M9.5 18h3.5"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12 2.5l.55 1.2 1.3.2-.95.95.25 1.3L12 5.5l-1.15.65.25-1.3-.95-.95 1.3-.2L12 2.5z"
        fill={stroke}
        stroke="none"
      />
    </svg>
  );
}

function QuizIcon({ active }: { active: boolean }) {
  const stroke = active ? "#075473" : "#a1a1aa";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3l1.8 4.8L19 9.5l-4 3.2 1.2 5.3L12 15.8 7.8 18l1.2-5.3-4-3.2 5.2-1.7L12 3z"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
