"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/builder", label: "Builder", icon: BuilderIcon },
  { href: "/builder/itinerary", label: "My Itinerary", icon: ItineraryIcon },
  { href: "/builder/preview", label: "Preview Trip", icon: PreviewIcon },
  { href: "/builder/export", label: "Save / Export", icon: ExportIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E8E2D9] bg-[#FBF8F2]/95 backdrop-blur-md md:hidden">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((tab) => {
          const active =
            tab.href === "/builder"
              ? pathname === "/builder"
              : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 px-1 py-2.5 text-[0.65rem] ${
                  active ? "text-[#0B1F3A]" : "text-[#9A9288]"
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
  );
}

function BuilderIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7h16M4 12h10M4 17h14"
        stroke={active ? "#C4A35A" : "#9A9288"}
        strokeWidth="1.8"
        strokeLinecap="round"
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
        stroke={active ? "#C4A35A" : "#9A9288"}
        strokeWidth="1.8"
      />
      <path
        d="M8 8h8M8 12h8M8 16h5"
        stroke={active ? "#C4A35A" : "#9A9288"}
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
        stroke={active ? "#C4A35A" : "#9A9288"}
        strokeWidth="1.8"
      />
      <path
        d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"
        stroke={active ? "#C4A35A" : "#9A9288"}
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ExportIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 4v10M8 8l4-4 4 4"
        stroke={active ? "#C4A35A" : "#9A9288"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 16v3a1 1 0 001 1h12a1 1 0 001-1v-3"
        stroke={active ? "#C4A35A" : "#9A9288"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
