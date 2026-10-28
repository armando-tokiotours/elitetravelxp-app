"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ticket } from "lucide-react";
import { ExperienceProfilerModal } from "@/components/quiz/ExperienceProfilerModal";
import { useBuilderStore } from "@/store/useBuilderStore";
import { useItineraryStore } from "@/store/useItineraryStore";
import { useQuizStore } from "@/store/useQuizStore";
import {
  BUILDER_ROUTES,
  journeyBuilderHref,
  journeyItineraryHref,
} from "@/lib/builderRoutes";
import { bookingBoundRef } from "@/lib/bookingKindGuard";

export function BottomNav() {
  const pathname = usePathname();
  const [quizOpen, setQuizOpen] = useState(false);
  const tripMode = useBuilderStore((s) => s.tripMode);
  const confirmedBookingRef = useBuilderStore((s) => s.confirmedBookingRef);
  const experienceProfile = useBuilderStore((s) => s.experienceProfile);
  const setExperienceProfile = useBuilderStore((s) => s.setExperienceProfile);
  const isQuizCompleted = useQuizStore((s) => s.isQuizCompleted);
  const clearUserProfile = useItineraryStore((s) => s.clearUserProfile);
  const isBuilderE =
    pathname.startsWith("/builder-e") ||
    pathname.startsWith("/builder/vip-access");
  // Route wins inside a builder; elsewhere the active booking's tripMode.
  const onSingleBuilderPath =
    pathname.startsWith("/builder-single") ||
    pathname.startsWith("/builder/day-pass");
  const onMultiBuilderPath =
    pathname.startsWith("/builder/japan-journey") ||
    pathname === "/builder" ||
    pathname.startsWith("/builder/itinerary");
  const isSingleDay = onSingleBuilderPath
    ? true
    : onMultiBuilderPath
      ? false
      : tripMode === "single_day";

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

  // Confirmed PNR pins ?ref= (saved booking, not blank draft).
  const singleDayBoundRef =
    isSingleDay && tripMode === "single_day"
      ? bookingBoundRef(confirmedBookingRef)
      : null;
  const multiDayBoundRef =
    !isSingleDay && !isBuilderE && tripMode === "multi_day"
      ? bookingBoundRef(confirmedBookingRef)
      : null;
  const builderHref = isBuilderE
    ? BUILDER_ROUTES.vipAccess
    : isSingleDay
      ? singleDayBoundRef
        ? journeyBuilderHref(singleDayBoundRef, { type: "single_day" })
        : BUILDER_ROUTES.dayPass
      : multiDayBoundRef
        ? journeyBuilderHref(multiDayBoundRef, { type: "multi_day" })
        : BUILDER_ROUTES.japanJourney;
  const builderLabel = isBuilderE
    ? "VIP Access"
    : isSingleDay
      ? "1-Day Pass"
      : "Journey";
  const itineraryHref = isBuilderE
    ? BUILDER_ROUTES.vipAccessDossier
    : isSingleDay
      ? singleDayBoundRef
        ? journeyItineraryHref(singleDayBoundRef, { type: "single_day" })
        : BUILDER_ROUTES.dayPassItinerary
      : multiDayBoundRef
        ? journeyItineraryHref(multiDayBoundRef, { type: "multi_day" })
        : BUILDER_ROUTES.japanJourneyItinerary;

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
      href: BUILDER_ROUTES.vipAccess,
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
      <nav className="magic-nav magic-nav--dock fixed inset-x-0 bottom-0 z-40 border-t lg:hidden">
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
                      quizOpen ? "text-white" : "text-white/80"
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
                ? (pathname.startsWith("/builder-e") ||
                    pathname.startsWith("/builder/vip-access")) &&
                  !pathname.startsWith("/builder-e/dossier") &&
                  !pathname.startsWith("/builder/vip-access/dossier")
                : tab.match === "builder"
                  ? pathname === "/builder" ||
                    ((pathname.startsWith("/builder-single") ||
                      pathname.startsWith("/builder/day-pass") ||
                      pathname.startsWith("/builder/japan-journey")) &&
                      !pathname.includes("/itinerary"))
                  : tab.match === "itinerary"
                    ? pathname.startsWith("/builder-single/itinerary") ||
                      pathname.startsWith("/builder/day-pass/itinerary") ||
                      pathname.startsWith("/builder/japan-journey/itinerary") ||
                      pathname.startsWith("/builder/itinerary") ||
                      pathname.startsWith("/builder-e/dossier") ||
                      pathname.startsWith("/builder/vip-access/dossier")
                    : tab.match === "explore"
                      ? pathname.startsWith("/discover")
                      : pathname.startsWith(tab.href);
            return (
              <li key={`${tab.href}-${tab.label}`} className="flex-1">
                <Link
                  href={tab.href}
                  className={`flex flex-col items-center gap-0.5 px-0.5 py-2.5 text-[0.6rem] ${
                    active ? "text-white" : "text-white/80"
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
        stroke={active ? "#D91147" : "rgba(255,255,255,0.8)"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DiscoverIcon({ active }: { active: boolean }) {
  const stroke = active ? "#D91147" : "rgba(255,255,255,0.8)";
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
    <Ticket
      size={22}
      color={active ? "#D91147" : "rgba(255,255,255,0.8)"}
      strokeWidth={1.8}
      aria-hidden
    />
  );
}

function QuizIcon({ active }: { active: boolean }) {
  const stroke = active ? "#D91147" : "rgba(255,255,255,0.8)";
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
