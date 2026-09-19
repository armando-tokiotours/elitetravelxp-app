"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExperienceProfilerModal } from "@/components/quiz/ExperienceProfilerModal";

const TABS = [
  { href: "/builder", label: "Builder", icon: BuilderIcon, kind: "link" },
  { href: "/discover", label: "Discover", icon: DiscoverIcon, kind: "link" },
  {
    href: "/builder/itinerary",
    label: "Itinerary",
    icon: ItineraryIcon,
    kind: "link",
  },
  {
    href: "/builder/preview",
    label: "Preview",
    icon: PreviewIcon,
    kind: "link",
  },
  { href: "#quiz", label: "Match Quiz", icon: QuizIcon, kind: "quiz" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const [quizOpen, setQuizOpen] = useState(false);

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-black/95 backdrop-blur-md lg:hidden">
        <ul className="mx-auto flex max-w-lg items-stretch justify-around px-0.5 pb-[env(safe-area-inset-bottom)]">
          {TABS.map((tab) => {
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
              tab.href === "/builder"
                ? pathname === "/builder"
                : pathname.startsWith(tab.href);
            return (
              <li key={tab.href} className="flex-1">
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
        stroke={active ? "#B85304" : "#a1a1aa"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DiscoverIcon({ active }: { active: boolean }) {
  const stroke = active ? "#B85304" : "#a1a1aa";
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
        stroke={active ? "#B85304" : "#a1a1aa"}
        strokeWidth="1.8"
      />
      <path
        d="M8 8h8M8 12h8M8 16h5"
        stroke={active ? "#B85304" : "#a1a1aa"}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PreviewIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="12"
        r="3"
        stroke={active ? "#B85304" : "#a1a1aa"}
        strokeWidth="1.8"
      />
      <path
        d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"
        stroke={active ? "#B85304" : "#a1a1aa"}
        strokeWidth="1.8"
      />
    </svg>
  );
}

function QuizIcon({ active }: { active: boolean }) {
  const stroke = active ? "#B85304" : "#a1a1aa";
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
