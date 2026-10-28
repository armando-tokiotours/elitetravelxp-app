"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  CircleHelp,
  ClipboardList,
  Home,
  LogOut,
  Sparkles,
  Sun,
  Ticket,
  User,
} from "lucide-react";
import {
  brandingLogoUrl,
  DEFAULT_LOGO_IMAGE,
  fetchPublicBrandAssets,
  fetchSiteBranding,
} from "@/lib/pocketbase/client";
import { useTeamAuth } from "@/store/useTeamAuth";
import { useBuilderStore } from "@/store/useBuilderStore";
import { bookingBoundRef } from "@/lib/bookingKindGuard";
import {
  journeyBuilderHref,
  journeyItineraryHref,
} from "@/lib/builderRoutes";
import { ManageBookingModal } from "@/components/modals/ManageBookingModal";
import { NewBookingResetButton } from "@/components/builder/NewBookingResetButton";
import { FaqLinkSuspense } from "@/components/navigation/FaqLink";
import {
  OPEN_TRAVEL_BRIEF_EVENT,
  SCROLL_HOME_OPTIONS_EVENT,
} from "@/components/navigation/AppNavDock";

export type AppNavId =
  | "home"
  | "preElite"
  | "builder"
  | "builderE"
  | "discover"
  | "manage"
  | "itinerary"
  | "faq"
  | "policies";

export interface AppNavItem {
  id: AppNavId;
  href?: string;
  label: string;
  icon: typeof Home;
  /** Opens Manage Booking modal instead of navigating */
  action?: "manage";
}

/** Content offset for desktop hover-rail — matches collapsed `w-16` (extra at xl). */
export const APP_SIDEBAR_RAIL_PAD = "lg:pl-16 xl:pl-20";

/** @deprecated Prefer APP_SIDEBAR_RAIL_PAD — hover rail stays collapsed-width in flow. */
export const APP_SIDEBAR_FULL_PAD = "lg:pl-16";

/** Canonical app nav — labels can be overridden via `labelOverrides`. */
export const APP_NAV_ITEMS: AppNavItem[] = [
  { id: "home", href: "/#options", label: "Home", icon: Home },
  {
    id: "builderE",
    href: "/builder/vip-access",
    label: "VIP Tickets & Local Access",
    icon: Sparkles,
  },
  {
    id: "manage",
    label: "Manage Booking",
    icon: Ticket,
    action: "manage",
  },
  {
    id: "itinerary",
    href: "/builder/japan-journey/itinerary",
    label: "Itinerary",
    icon: Ticket,
  },
  {
    id: "faq",
    href: "/faq",
    label: "FAQ & Transport Guide",
    icon: CircleHelp,
  },
];

function isNavActive(pathname: string, item: AppNavItem): boolean {
  if (!item.href) return false;
  if (item.id === "home") return pathname === "/";
  if (item.id === "builder")
    return (
      pathname === "/builder" ||
      (pathname.startsWith("/builder/japan-journey") &&
        !pathname.includes("/itinerary")) ||
      (pathname.startsWith("/builder/day-pass") &&
        !pathname.includes("/itinerary")) ||
      (pathname.startsWith("/builder-single") &&
        !pathname.startsWith("/builder-single/itinerary"))
    );
  if (item.id === "builderE")
    return (
      pathname === "/builder/vip-access" ||
      pathname === "/builder-e" ||
      (pathname.startsWith("/builder/vip-access/") &&
        !pathname.startsWith("/builder/vip-access/dossier")) ||
      (pathname.startsWith("/builder-e/") &&
        !pathname.startsWith("/builder-e/dossier"))
    );
  if (item.id === "itinerary")
    return (
      pathname.includes("/itinerary") ||
      pathname.startsWith("/builder/vip-access/dossier") ||
      pathname.startsWith("/builder-e/dossier") ||
      pathname.startsWith("/dossier/")
    );
  if (item.id === "preElite")
    return pathname.startsWith("/pre-elite-builder");
  if (item.href === "/discover") return pathname.startsWith("/discover");
  return pathname.startsWith(item.href);
}

function useBrandLogo() {
  const [logoSrc, setLogoSrc] = useState(DEFAULT_LOGO_IMAGE);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [branding, assets] = await Promise.all([
          fetchSiteBranding(),
          fetchPublicBrandAssets(),
        ]);
        if (cancelled) return;
        setLogoSrc(brandingLogoUrl(branding, assets));
      } catch {
        /* keep default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return logoSrc;
}

function NavLabel({
  children,
  rail,
  expanded = false,
}: {
  children: React.ReactNode;
  rail?: boolean;
  expanded?: boolean;
}) {
  if (!rail) return <span>{children}</span>;
  return (
    <span
      className={`overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out ${
        expanded
          ? "ml-0 w-auto opacity-100"
          : "pointer-events-none w-0 opacity-0"
      }`}
    >
      {children}
    </span>
  );
}

function NavLinkList({
  pathname,
  onNavigate,
  onManage,
  labelOverrides,
  variant = "sidebar",
  rail = false,
  expanded = false,
  hideManageBooking = false,
}: {
  pathname: string;
  onNavigate?: () => void;
  onManage: () => void;
  labelOverrides?: Partial<Record<AppNavId, string>>;
  variant?: "sidebar" | "drawer";
  rail?: boolean;
  expanded?: boolean;
  /** Guest builder hamburger: Manage Booking lives elsewhere (e.g. homepage MANAGE), so omit its row here. */
  hideManageBooking?: boolean;
}) {
  const tripMode = useBuilderStore((s) => s.tripMode);
  const confirmedBookingRef = useBuilderStore((s) => s.confirmedBookingRef);
  // Route wins while inside a builder (the page/guard owns the mode there);
  // elsewhere the active booking's tripMode picks the menu. Previously
  // `tripMode === "single_day" || <multi path>` could label the menu
  // 1-Day while the guest stood in Grand Japan Journey and vice versa.
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
  const isBuilderE =
    pathname.startsWith("/builder-e") ||
    pathname.startsWith("/builder/vip-access");
  // Confirmed PNR pins ?ref= on builder links (saved booking
  // reloads instead of a blank draft); fresh drafts get no ref.
  const singleDayBoundRef =
    isSingleDay && tripMode === "single_day"
      ? bookingBoundRef(confirmedBookingRef)
      : null;
  const multiDayBoundRef =
    !isSingleDay && !isBuilderE && tripMode === "multi_day"
      ? bookingBoundRef(confirmedBookingRef)
      : null;
  const isMultiDay =
    !isSingleDay &&
    !isBuilderE &&
    (onMultiBuilderPath ||
      tripMode === "multi_day" ||
      pathname.startsWith("/builder"));

  /** Context-isolated menu — never cross-link builders (matches AppNavDock). */
  const navItems: AppNavItem[] = APP_NAV_ITEMS.flatMap((item) => {
    if (hideManageBooking && item.id === "manage") return [];
    if (item.id !== "builderE") return [item];
    if (isSingleDay) {
      return [
        {
          id: "builder",
          href: "/builder/day-pass",
          label: "1-Day Express Pass",
          icon: Sun,
        },
      ];
    }
    if (isMultiDay) {
      return [
        {
          id: "builder",
          href: "/builder/japan-journey",
          label: labelOverrides?.builder ?? "Grand Japan Journey",
          icon: CalendarDays,
        },
      ];
    }
    if (isBuilderE) return [item];
    // Home / other: keep VIP as a product entry
    return [item];
  });

  return (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
      {navItems.map((item) => {
        const Icon = item.icon;
        // Itinerary is just "Itinerary" in every context (APP_NAV_ITEMS) —
        // never prefix it with the builder name ("1-Day Express Pass ·
        // Itinerary", "VIP Tickets · Dossier", …). Href/active unchanged.
        const label =
          item.id === "builder"
            ? isSingleDay
              ? "1-Day Express Pass"
              : (labelOverrides?.[item.id] ?? item.label)
            : (labelOverrides?.[item.id] ?? item.label);
        const href =
          item.id === "builder"
            ? isSingleDay
              ? singleDayBoundRef
                ? journeyBuilderHref(singleDayBoundRef, {
                    type: "single_day",
                  })
                : "/builder/day-pass"
              : multiDayBoundRef
                ? journeyBuilderHref(multiDayBoundRef, {
                    type: "multi_day",
                  })
                : "/builder/japan-journey"
            : item.id === "itinerary"
              ? isSingleDay
                ? singleDayBoundRef
                  ? journeyItineraryHref(singleDayBoundRef, {
                      type: "single_day",
                    })
                  : "/builder/day-pass/itinerary"
                : isBuilderE
                  ? "/builder/vip-access/dossier"
                  : multiDayBoundRef
                    ? journeyItineraryHref(multiDayBoundRef, {
                        type: "multi_day",
                      })
                    : "/builder/japan-journey/itinerary"
              : item.href!;
        const active = isNavActive(pathname, { ...item, href });

        const railItemClass = active
          ? "border-r-2 border-[#075473]/40 bg-[#075473]/15 text-[#075473]"
          : "border-r-2 border-transparent text-zinc-300 hover:bg-zinc-900 hover:text-white";

        const railLayout = rail
          ? expanded
            ? "justify-start px-3"
            : "justify-center px-2"
          : "px-3";

        if (item.action === "manage") {
          return (
            <button
              key={item.id}
              type="button"
              title={label}
              onClick={() => {
                onManage();
                onNavigate?.();
              }}
              className={`flex items-center gap-3 rounded-xl py-2.5 text-left text-sm transition-all duration-300 ${
                variant === "sidebar"
                  ? `${railItemClass} ${railLayout}`
                  : "px-4 py-3.5 text-white/85 hover:bg-white/8"
              }`}
            >
              <Icon
                className="h-5 w-5 shrink-0 text-[#075473]"
                aria-hidden
              />
              {variant === "drawer" ? (
                <span>{label}</span>
              ) : (
                <NavLabel rail={rail} expanded={expanded}>
                  <span>{label}</span>
                </NavLabel>
              )}
            </button>
          );
        }

        const linkClassName =
          variant === "sidebar"
            ? `flex items-center gap-3 rounded-xl py-2.5 text-sm transition-all duration-300 ${railItemClass} ${railLayout}`
            : `flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm tracking-wide transition ${
                active
                  ? "bg-[#075473]/20 text-[#075473]"
                  : "text-white/85 hover:bg-white/8"
              }`;
        const linkContent = (
          <>
            <Icon
              className={`h-5 w-5 shrink-0 ${
                active ? "text-[#075473]" : "text-zinc-500"
              }`}
              aria-hidden
            />
            {variant === "drawer" ? (
              <span className={active ? "font-semibold" : ""}>{label}</span>
            ) : (
              <NavLabel rail={rail} expanded={expanded}>
                <span className={active ? "font-semibold" : ""}>{label}</span>
              </NavLabel>
            )}
          </>
        );

        // FAQ carries the current path+query so its Back button can return here.
        if (item.id === "faq") {
          return (
            <FaqLinkSuspense
              key={item.id}
              title={label}
              onClick={onNavigate}
              className={linkClassName}
            >
              {linkContent}
            </FaqLinkSuspense>
          );
        }

        return (
          <Link
            key={item.id}
            href={href}
            title={label}
            onClick={(e) => {
              // Soft: already on `/` (or `/#options`) — still scroll to the
              // 3-card selector; Next.js Link may no-op same-route hashes.
              if (item.id === "home" && pathname === "/") {
                if (window.location.hash === "#options") {
                  e.preventDefault();
                  window.dispatchEvent(new Event(SCROLL_HOME_OPTIONS_EVENT));
                } else {
                  // Let the hash update; GridSequenceHero listens for hashchange.
                  window.setTimeout(() => {
                    if (window.location.hash !== "#options") {
                      window.location.hash = "options";
                    }
                  }, 0);
                }
              }
              onNavigate?.();
            }}
            className={linkClassName}
          >
            {linkContent}
          </Link>
        );
      })}
      {/* Questionnaire used to live on the magic dock (SINGLE/MULTIDAY);
          Discover owns that slot now — keep brief reachable from the menu. */}
      {!isBuilderE && (isSingleDay || isMultiDay) ? (
        <button
          type="button"
          title="Questionnaire"
          onClick={() => {
            window.dispatchEvent(new Event(OPEN_TRAVEL_BRIEF_EVENT));
            onNavigate?.();
          }}
          className={
            variant === "sidebar"
              ? `flex items-center gap-3 rounded-xl py-2.5 text-sm transition-all duration-300 border-r-2 border-transparent text-zinc-300 hover:bg-zinc-900 hover:text-white ${
                  expanded ? "justify-start px-3" : "justify-center px-2"
                }`
              : "flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm tracking-wide text-white/85 transition hover:bg-white/8"
          }
        >
          <ClipboardList
            className="h-5 w-5 shrink-0 text-[#075473]"
            aria-hidden
          />
          {variant === "drawer" ? (
            <span>Questionnaire</span>
          ) : (
            <NavLabel rail={rail} expanded={expanded}>
              <span>Questionnaire</span>
            </NavLabel>
          )}
        </button>
      ) : null}
    </nav>
  );
}

function AccountFooter({
  onManage,
  compact = false,
  rail = false,
  expanded = false,
  overlay = false,
  onNewBookingAfterConfirm,
}: {
  onManage: () => void;
  compact?: boolean;
  rail?: boolean;
  expanded?: boolean;
  /** Full-screen menu footer — lifted above mobile bottom nav */
  overlay?: boolean;
  /** Closes the menu drawer after a confirmed New Booking reset (modal is portalled above the drawer, so the drawer stays open until then). */
  onNewBookingAfterConfirm?: () => void;
}) {
  const email = useTeamAuth((s) => s.email);
  const isAuthenticated = useTeamAuth((s) => s.isAuthenticated);
  const logout = useTeamAuth((s) => s.logout);
  const ensureAuth = useTeamAuth((s) => s.ensureAuth);

  useEffect(() => {
    ensureAuth();
  }, [ensureAuth]);

  if (overlay) {
    if (isAuthenticated && email) {
      return (
        <div className="mt-auto shrink-0 border-t border-zinc-800/80 pb-32 pt-6">
          <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#075473]/15 text-accent-500">
              <User className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{email}</p>
              <p className="text-xs text-zinc-400">Team account</p>
            </div>
          </div>
          <div className="mt-3">
            <NewBookingResetButton
              variant="menu"
              onAfterConfirm={onNewBookingAfterConfirm}
            />
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="mt-3 flex w-full items-center justify-between rounded-xl px-1 py-2 text-xs text-zinc-400 transition hover:text-white"
          >
            <span>Signed in</span>
            <span className="font-semibold text-accent-500 hover:underline">
              Sign out
            </span>
          </button>
        </div>
      );
    }

    return (
      <div className="mt-auto shrink-0 border-t border-zinc-800/80 pb-32 pt-6">
        <button
          type="button"
          onClick={onManage}
          className="flex w-full items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-left transition hover:border-zinc-700"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#075473]/15 text-accent-500">
            <Ticket className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-white">Your booking</h4>
            <p className="text-xs text-zinc-400">
              Retrieve itinerary with email + PNR
            </p>
          </div>
        </button>
        <div className="mt-3">
          <NewBookingResetButton
            variant="menu"
            onAfterConfirm={onNewBookingAfterConfirm}
          />
        </div>
      </div>
    );
  }

  const railLayout = rail
    ? expanded
      ? "justify-start px-2"
      : "justify-center px-1"
    : "px-2";

  const railBtnLayout = rail
    ? expanded
      ? "justify-start px-3"
      : "justify-center px-2"
    : "px-3";

  if (isAuthenticated && email) {
    return (
      <div
        className={`border-t border-zinc-800 ${compact ? "px-4 py-3" : "pt-4"}`}
      >
        <div className={`flex items-center gap-3 rounded-xl py-2 ${railLayout}`}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[#075473]">
            <User className="h-4 w-4" aria-hidden />
          </span>
          <NavLabel rail={rail} expanded={expanded}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">
                {email}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Team account
              </p>
            </div>
          </NavLabel>
        </div>
        <button
          type="button"
          title="Sign out"
          onClick={() => logout()}
          className={`mt-1 flex w-full items-center gap-2 rounded-xl py-2 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-white ${railBtnLayout}`}
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden />
          <NavLabel rail={rail} expanded={expanded}>
            Sign out
          </NavLabel>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`border-t border-zinc-800 ${compact ? "px-4 py-3" : "pt-4"}`}
    >
      <button
        type="button"
        title="Your booking"
        onClick={onManage}
        className={`flex w-full items-center gap-3 rounded-xl py-2 text-left transition hover:bg-zinc-900 ${railLayout}`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[#075473]">
          <Ticket className="h-4 w-4" aria-hidden />
        </span>
        <NavLabel rail={rail} expanded={expanded}>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Your booking</p>
            <p className="text-[11px] text-zinc-500">
              Retrieve itinerary with email + PNR
            </p>
          </div>
        </NavLabel>
      </button>
    </div>
  );
}

function FullScreenNavOverlay({
  open,
  onClose,
  brandEyebrow,
  brandTitle,
  logoSrc,
  pathname,
  labelOverrides,
  onManage,
  hideManageBooking = false,
}: {
  open: boolean;
  onClose: () => void;
  brandEyebrow: string;
  brandTitle: string;
  logoSrc: string;
  pathname: string;
  labelOverrides?: Partial<Record<AppNavId, string>>;
  onManage: () => void;
  hideManageBooking?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Main menu"
      className="tokio-nav-drawer fixed inset-0 z-[999] flex h-[100dvh] min-h-screen w-screen flex-col border-r border-white/10 text-white opacity-100 lg:hidden"
    >
      {/* Solid tint scrim — kills text bleed from the builder behind */}
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-[#05080C]/85"
        aria-hidden
      />

      <div className="tokio-modal-chrome relative z-[81] flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#2C2C2E] bg-[#1C1C1E] text-zinc-300 transition hover:bg-[#2C2C2E] hover:text-white"
            aria-label="Return to page"
          >
            <span className="text-lg leading-none" aria-hidden>
              ←
            </span>
          </button>
          <div className="min-w-0">
            <p className="text-[0.55rem] font-semibold uppercase tracking-[0.28em] text-[#D91147]">
              {brandEyebrow}
            </p>
            <p className="text-xs font-bold uppercase tracking-widest text-[#075473]">
              Menu
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-[#2C2C2E] bg-[#1C1C1E] px-3 py-1.5 text-xs font-semibold text-zinc-400 transition hover:text-white"
        >
          Close
        </button>
      </div>

      <div className="relative z-[81] mx-auto flex w-full max-w-lg flex-1 flex-col overflow-y-auto overscroll-contain bg-transparent px-6 py-6 pb-32">
        <div className="mb-6 flex shrink-0 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt=""
            className="h-10 w-auto max-w-[8rem] object-contain"
          />
          <p className="font-display text-xl text-white">{brandTitle}</p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <NavLinkList
            pathname={pathname}
            onNavigate={onClose}
            onManage={() => {
              onClose();
              onManage();
            }}
            labelOverrides={labelOverrides}
            variant="drawer"
            hideManageBooking={hideManageBooking}
          />

          <AccountFooter
            overlay
            onManage={() => {
              onClose();
              onManage();
            }}
            onNewBookingAfterConfirm={onClose}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Desktop-only left accordion rail (`lg+`). Collapsed `w-16` icon bar;
 * expands to `w-64` on hover to reveal labels. Never opens a full-screen overlay.
 */
export function AppSidebar({
  brandEyebrow = "TOKIOTOURS",
  brandTitle = "Discover",
  labelOverrides,
  expandOnHover = true,
}: {
  brandEyebrow?: string;
  brandTitle?: string;
  labelOverrides?: Partial<Record<AppNavId, string>>;
  /** When true (default), expand rail width on hover to show labels */
  expandOnHover?: boolean;
}) {
  void brandEyebrow;
  void brandTitle;
  const pathname = usePathname();
  const logoSrc = useBrandLogo();
  const [manageOpen, setManageOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const openManage = () => setManageOpen(true);
  const showLabels = expandOnHover ? expanded : true;

  return (
    <>
      <aside
        className={`tokio-glass-sheet fixed bottom-0 left-0 top-0 z-50 hidden flex-col border-r border-white/10 transition-[width] duration-200 ease-in-out lg:flex ${
          showLabels ? "w-64" : "w-16"
        }`}
        onMouseEnter={() => {
          if (expandOnHover) setExpanded(true);
        }}
        onMouseLeave={() => {
          if (expandOnHover) setExpanded(false);
        }}
        aria-label="Main navigation"
      >
        <div
          className={`flex shrink-0 items-center gap-3 border-b border-[#2C2C2E] py-3 ${
            showLabels ? "justify-start px-3" : "justify-center px-2"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt="TOKIOTOURS"
            className="h-9 w-9 shrink-0 object-contain"
          />
          <NavLabel rail expanded={showLabels}>
            <div className="min-w-0">
              <p className="text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-[#D91147]">
                TOKIOTOURS
              </p>
              <p className="truncate text-xs font-bold text-[#F5EFE6]">Menu</p>
            </div>
          </NavLabel>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2">
          <NavLinkList
            pathname={pathname}
            onManage={openManage}
            labelOverrides={labelOverrides}
            variant="sidebar"
            rail
            expanded={showLabels}
          />
          <AccountFooter
            onManage={openManage}
            rail
            expanded={showLabels}
          />
        </div>
      </aside>

      <ManageBookingModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        onSuccess={(ref) => {
          setToast(`Itinerary ${ref} loaded successfully`);
        }}
      />
      {toast ? (
        <div
          role="status"
          className="fixed bottom-8 left-1/2 z-[110] hidden w-[min(92vw,28rem)] -translate-x-1/2 rounded-xl border border-[#075473]/50 bg-[#1a1510] px-4 py-3 text-center text-sm text-[#F3D9C4] shadow-lg lg:block"
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}

/**
 * Mobile/tablet hamburger → full-screen solid menu. Strictly `< lg` only.
 */
export function MobileAppNav({
  brandEyebrow = "TOKIOTOURS",
  brandTitle = "Discover",
  labelOverrides,
  hideManageBooking = false,
  buttonTone = "dark",
}: {
  brandEyebrow?: string;
  brandTitle?: string;
  labelOverrides?: Partial<Record<AppNavId, string>>;
  /** Guest builder menus omit the Manage Booking row (it exists elsewhere). Team/staff menus leave this off. */
  hideManageBooking?: boolean;
  /** `light` = dark hamburger (legacy cream chrome). `dark` = white hamburger. */
  buttonTone?: "dark" | "light";
}) {
  const pathname = usePathname();
  const logoSrc = useBrandLogo();
  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const closeIfDesktop = () => {
      if (window.innerWidth >= 1024) setOpen(false);
    };
    closeIfDesktop();
    window.addEventListener("resize", closeIfDesktop);
    return () => window.removeEventListener("resize", closeIfDesktop);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(t);
  }, [toast]);

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={`flex h-10 w-10 items-center justify-center border-0 bg-transparent shadow-none transition hover:bg-transparent focus-visible:bg-transparent focus-visible:outline-none focus-visible:ring-2 lg:hidden ${
          buttonTone === "light"
            ? "text-slate-900 focus-visible:ring-slate-400/60"
            : "text-white focus-visible:ring-white/60"
        }`}
      >
        <HamburgerIcon />
      </button>

      <div className="lg:hidden">
        <FullScreenNavOverlay
          open={open}
          onClose={() => setOpen(false)}
          brandEyebrow={brandEyebrow}
          brandTitle={brandTitle}
          logoSrc={logoSrc}
          pathname={pathname}
          labelOverrides={labelOverrides}
          onManage={() => setManageOpen(true)}
          hideManageBooking={hideManageBooking}
        />
      </div>

      <ManageBookingModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        onSuccess={(ref) => {
          setToast(`Itinerary ${ref} loaded successfully`);
        }}
      />
      {toast ? (
        <div
          role="status"
          className="fixed bottom-[7.5rem] left-1/2 z-[110] w-[min(92vw,28rem)] -translate-x-1/2 rounded-xl border border-[#075473]/50 bg-[#1a1510] px-4 py-3 text-center text-sm text-[#F3D9C4] shadow-lg lg:hidden"
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}

function HamburgerIcon() {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" fill="none" aria-hidden>
      <path
        d="M1 1h18M1 7h18M1 13h18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
