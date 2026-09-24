"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bookmark,
  ClipboardList,
  Compass,
  Home,
  LogOut,
  Settings,
  Ticket,
  User,
  Wrench,
} from "lucide-react";
import {
  brandingLogoUrl,
  DEFAULT_LOGO_IMAGE,
  fetchPublicBrandAssets,
  fetchSiteBranding,
} from "@/lib/pocketbase/client";
import { useTeamAuth } from "@/store/useTeamAuth";
import { useBuilderStore } from "@/store/useBuilderStore";
import { ManageBookingModal } from "@/components/modals/ManageBookingModal";

export type AppNavId =
  | "home"
  | "preElite"
  | "builder"
  | "discover"
  | "manage"
  | "itinerary"
  | "admin";

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
  { id: "home", href: "/", label: "Home", icon: Home },
  {
    id: "preElite",
    href: "/pre-elite-builder",
    label: "Pre-Elite Qualification",
    icon: ClipboardList,
  },
  {
    id: "builder",
    href: "/builder",
    label: "Trip Builder",
    icon: Wrench,
  },
  {
    id: "discover",
    href: "/discover",
    label: "Discover Experiences",
    icon: Compass,
  },
  {
    id: "manage",
    label: "Manage Booking",
    icon: Ticket,
    action: "manage",
  },
  {
    id: "itinerary",
    href: "/builder/itinerary",
    label: "My Saved Itineraries",
    icon: Bookmark,
  },
  {
    id: "admin",
    href: "/admin",
    label: "Team Access / Admin",
    icon: Settings,
  },
];

function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isNavActive(pathname: string, item: AppNavItem): boolean {
  if (!item.href) return false;
  if (item.id === "home") return pathname === "/";
  if (item.id === "admin")
    return isAdminPath(pathname) || pathname.startsWith("/team-access");
  if (item.id === "builder")
    return (
      pathname === "/builder" ||
      (pathname.startsWith("/builder-single") &&
        !pathname.startsWith("/builder-single/itinerary"))
    );
  if (item.id === "itinerary")
    return (
      pathname.startsWith("/builder/itinerary") ||
      pathname.startsWith("/builder-single/itinerary")
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
}: {
  pathname: string;
  onNavigate?: () => void;
  onManage: () => void;
  labelOverrides?: Partial<Record<AppNavId, string>>;
  variant?: "sidebar" | "drawer";
  rail?: boolean;
  expanded?: boolean;
}) {
  const tripMode = useBuilderStore((s) => s.tripMode);

  return (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
      {APP_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const label =
          item.id === "builder"
            ? tripMode === "single_day" ||
              pathname.startsWith("/builder-single")
              ? "Single-Day Builder"
              : (labelOverrides?.[item.id] ?? item.label)
            : item.id === "itinerary" &&
                (tripMode === "single_day" ||
                  pathname.startsWith("/builder-single"))
              ? "Single-Day Itinerary"
              : (labelOverrides?.[item.id] ?? item.label);
        const href =
          item.id === "builder"
            ? tripMode === "single_day" ||
              pathname.startsWith("/builder-single")
              ? "/builder-single"
              : "/builder"
            : item.id === "itinerary"
              ? tripMode === "single_day" ||
                pathname.startsWith("/builder-single")
                ? "/builder-single/itinerary"
                : "/builder/itinerary"
              : item.href!;
        const active = isNavActive(pathname, item);

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

        return (
          <Link
            key={item.id}
            href={href}
            title={label}
            onClick={onNavigate}
            className={
              variant === "sidebar"
                ? `flex items-center gap-3 rounded-xl py-2.5 text-sm transition-all duration-300 ${railItemClass} ${railLayout}`
                : `flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm tracking-wide transition ${
                    active
                      ? "bg-[#075473]/20 text-[#075473]"
                      : "text-white/85 hover:bg-white/8"
                  }`
            }
          >
            {item.id === "admin" ? (
              <span className="text-base leading-none" aria-hidden>
                ⚙️
              </span>
            ) : (
              <Icon
                className={`h-5 w-5 shrink-0 ${
                  active ? "text-[#075473]" : "text-zinc-500"
                }`}
                aria-hidden
              />
            )}
            {variant === "drawer" ? (
              <span className={active ? "font-semibold" : ""}>{label}</span>
            ) : (
              <NavLabel rail={rail} expanded={expanded}>
                <span className={active ? "font-semibold" : ""}>{label}</span>
              </NavLabel>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function AccountFooter({
  onManage,
  compact = false,
  rail = false,
  expanded = false,
  overlay = false,
}: {
  onManage: () => void;
  compact?: boolean;
  rail?: boolean;
  expanded?: boolean;
  /** Full-screen menu footer — lifted above mobile bottom nav */
  overlay?: boolean;
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
        <Link
          href="/admin"
          className="mt-3 flex items-center justify-between px-1 py-2 text-xs text-zinc-400 transition hover:text-white"
        >
          <span>Team Access</span>
          <span className="font-semibold text-accent-500">Sign in</span>
        </Link>
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
      <Link
        href="/admin"
        title="Team Access / Admin"
        className={`mt-1 flex items-center gap-2 rounded-xl py-2 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-white ${railBtnLayout}`}
      >
        <Settings className="h-4 w-4 shrink-0" aria-hidden />
        <NavLabel rail={rail} expanded={expanded}>
          Team Access / Admin
        </NavLabel>
      </Link>
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
}: {
  open: boolean;
  onClose: () => void;
  brandEyebrow: string;
  brandTitle: string;
  logoSrc: string;
  pathname: string;
  labelOverrides?: Partial<Record<AppNavId, string>>;
  onManage: () => void;
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
      className="tokio-nav-drawer fixed inset-0 z-[80] flex h-[100dvh] min-h-screen w-screen flex-col border-r border-white/10 text-white opacity-100 lg:hidden"
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
            <p className="text-[0.55rem] font-semibold uppercase tracking-[0.28em] text-white">
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
          />

          <AccountFooter
            overlay
            onManage={() => {
              onClose();
              onManage();
            }}
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
              <p className="text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-[#075473]">
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
}: {
  brandEyebrow?: string;
  brandTitle?: string;
  labelOverrides?: Partial<Record<AppNavId, string>>;
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
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-white transition hover:border-[#075473] lg:hidden"
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
