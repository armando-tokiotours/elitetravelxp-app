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
  const isBuilderE = pathname.startsWith("/builder-e");
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

  const builderHref = isBuilderE
    ? "/builder-e"
    : isSingleDay
      ? "/builder-single"
      : "/builder";
  const builderLabel = isBuilderE
    ? "VIP Access"
    : isSingleDay
      ? "1-Day Pass"
      : "Journey";
  const itineraryHref = isBuilderE
    ? "/builder-e/dossier"
    : isSingleDay
      ? "/builder-single/itinerary"
      : "/builder/itinerary";

  type NavTab =
    | {
        href: string;
        label: string;
        icon: typeof BuilderIcon;
        kind: "link";
        match: "builderE" | "builder" | "explore" | "itinerary";
      }
    | {
        href: string;
        label: string;
        icon: typeof QuizIcon;
        kind: "quiz";
      };

  const allTabs: NavTab[] = [
    {
      href: "/builder-e",
      label: "VIP Access",
      icon: BuilderIcon,
      kind: "link",
      match: "builderE",
    },
    {
      href: builderHref,
      label: builderLabel,
      icon: BuilderIcon,
      kind: "link",
      match: "builder",
    },
    {
      href: "/discover",
      label: "Explore",
      icon: DiscoverIcon,
      kind: "link",
      match: "explore",
    },
    {
      href: itineraryHref,
      label: "Itinerary",
      icon: ItineraryIcon,
      kind: "link",
      match: "itinerary",
    },
    {
      href: "#quiz",
      label: "Match Quiz",
      icon: QuizIcon,
      kind: "quiz",
    },
  ];

  const tabs = allTabs.filter((tab) => {
    // On Builder E, avoid duplicate Builder E + Builder M tabs
    if (tab.kind === "link" && isBuilderE && tab.match === "builder") {
      return false;
    }
    return true;
  });

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
              tab.match === "builderE"
                ? pathname.startsWith("/builder-e") &&
                  !pathname.startsWith("/builder-e/dossier")
                : tab.match === "builder"
                  ? pathname === "/builder" ||
                    (pathname.startsWith("/builder-single") &&
                      !pathname.startsWith("/builder-single/itinerary"))
                  : tab.match === "itinerary"
                    ? pathname.startsWith("/builder-single/itinerary") ||
                      pathname.startsWith("/builder/itinerary") ||
                      pathname.startsWith("/builder-e/dossier")
                    : tab.match === "explore"
                      ? pathname.startsWith("/discover")
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
