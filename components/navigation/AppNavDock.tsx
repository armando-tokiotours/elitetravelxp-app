"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import {
  Bookmark,
  CalendarDays,
  CircleHelp,
  Compass,
  FileText,
  Home,
  Sparkles,
  Star,
  Sun,
  Ticket,
} from "lucide-react";
import { ManageBookingModal } from "@/components/modals/ManageBookingModal";
import { ExperienceProfilerModal } from "@/components/quiz/ExperienceProfilerModal";
import {
  brandingLogoUrl,
  DEFAULT_LOGO_IMAGE,
  fetchPublicBrandAssets,
  fetchSiteBranding,
} from "@/lib/pocketbase/client";

export type BuilderContextType = "MULTIDAY" | "SINGLE" | "BUILDER_E";

type LucideIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path?: string;
  action?: "manage" | "quiz";
}

/** Context-isolated navigation — never share tabs across builders. */
export const NAV_CONFIGS: Record<BuilderContextType, NavItem[]> = {
  MULTIDAY: [
    { id: "home", label: "Home", icon: Home, path: "/" },
    { id: "builder", label: "Multi-Day", icon: CalendarDays, path: "/builder" },
    {
      id: "itinerary",
      label: "Itinerary",
      icon: FileText,
      path: "/builder/itinerary",
    },
    { id: "manage", label: "Manage Booking", icon: Ticket, action: "manage" },
    { id: "faq", label: "FAQ", icon: CircleHelp, path: "/faq" },
  ],
  SINGLE: [
    { id: "home", label: "Home", icon: Home, path: "/" },
    {
      id: "builder_single",
      label: "Single Day",
      icon: Sun,
      path: "/builder-single",
    },
    {
      id: "dossier",
      label: "Dossier",
      icon: Bookmark,
      path: "/builder-single/itinerary",
    },
    { id: "manage", label: "Manage Booking", icon: Ticket, action: "manage" },
    { id: "faq", label: "FAQ", icon: CircleHelp, path: "/faq" },
  ],
  BUILDER_E: [
    { id: "home", label: "Home", icon: Home, path: "/" },
    {
      id: "builder_e",
      label: "Builder E",
      icon: Sparkles,
      path: "/builder-e",
    },
    { id: "explore", label: "Explore", icon: Compass, path: "/discover" },
    {
      id: "itinerary",
      label: "Itinerary",
      icon: FileText,
      path: "/builder-e/dossier",
    },
    { id: "quiz", label: "Match Quiz", icon: Star, action: "quiz" },
  ],
};

function isNavActive(pathname: string, item: NavItem): boolean {
  if (!item.path) return false;
  if (item.path === "/") return pathname === "/";
  if (item.path === "/builder") {
    return (
      pathname === "/builder" ||
      (pathname.startsWith("/builder/") &&
        !pathname.startsWith("/builder/itinerary") &&
        !pathname.startsWith("/builder-single") &&
        !pathname.startsWith("/builder-e"))
    );
  }
  if (item.path === "/builder-e") {
    return (
      pathname === "/builder-e" ||
      (pathname.startsWith("/builder-e/") &&
        !pathname.startsWith("/builder-e/dossier"))
    );
  }
  if (item.path === "/builder-single") {
    return (
      pathname === "/builder-single" ||
      (pathname.startsWith("/builder-single/") &&
        !pathname.startsWith("/builder-single/itinerary"))
    );
  }
  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}

export function AppNavDock({ context }: { context: BuilderContextType }) {
  const router = useRouter();
  const pathname = usePathname();
  const items = NAV_CONFIGS[context];
  const [logoSrc, setLogoSrc] = useState(DEFAULT_LOGO_IMAGE);
  const [manageOpen, setManageOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [branding, assets] = await Promise.all([
          fetchSiteBranding(),
          fetchPublicBrandAssets(),
        ]);
        if (!cancelled) setLogoSrc(brandingLogoUrl(branding, assets));
      } catch {
        /* keep default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const activate = (item: NavItem) => {
    if (item.action === "manage") {
      setManageOpen(true);
      return;
    }
    if (item.action === "quiz") {
      setQuizOpen(true);
      return;
    }
    if (item.path) router.push(item.path);
  };

  return (
    <>
      <aside className="no-print fixed top-0 bottom-0 left-0 z-40 hidden w-16 flex-col items-center border-r border-white/10 bg-[#0A1017] py-6 sm:flex">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex h-10 w-10 items-center justify-center overflow-hidden"
          aria-label="Home"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt="TOKIOTOURS"
            className="h-10 w-10 object-contain"
          />
        </button>

        <div className="mt-8 flex flex-col gap-5">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => activate(item)}
                title={item.label}
                className={`group relative rounded-xl p-2.5 transition-all ${
                  active
                    ? "border border-cyan-400/50 bg-[#075473] text-white shadow-[0_0_12px_rgba(7,84,115,0.8)]"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${active ? "text-white" : "text-current"}`}
                  aria-hidden
                />
                <span className="pointer-events-none absolute left-14 rounded border border-white/10 bg-black/90 px-2 py-1 text-[10px] font-bold whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <nav className="no-print fixed inset-x-0 bottom-0 z-50 flex h-16 items-center justify-around border-t border-white/10 bg-[#0A1017]/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(pathname, item);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => activate(item)}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 transition-colors ${
                active
                  ? "font-bold text-[#F6A724]"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Icon
                className={`h-5 w-5 ${active ? "text-[#F6A724]" : "text-current"}`}
                aria-hidden
              />
              <span className="max-w-[4.5rem] truncate text-[9px] tracking-tight">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      <ManageBookingModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        onSuccess={(ref) => {
          setToast(`Itinerary ${ref} loaded successfully`);
        }}
      />
      <ExperienceProfilerModal
        open={quizOpen}
        onClose={() => setQuizOpen(false)}
      />
      {toast ? (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 z-[110] w-[min(92vw,28rem)] -translate-x-1/2 rounded-xl border border-[#075473]/50 bg-[#1a1510] px-4 py-3 text-center text-sm text-[#F3D9C4] shadow-lg sm:bottom-8"
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}
