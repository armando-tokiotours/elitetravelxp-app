"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bookmark,
  Compass,
  Home,
  LogOut,
  Settings,
  Ticket,
  User,
  Wallet,
} from "lucide-react";
import {
  brandingLogoUrl,
  DEFAULT_LOGO_IMAGE,
  fetchPublicBrandAssets,
  fetchSiteBranding,
} from "@/lib/pocketbase/client";
import { useTeamAuth } from "@/store/useTeamAuth";
import { ManageBookingModal } from "@/components/modals/ManageBookingModal";

export type AppNavId =
  | "builder"
  | "discover"
  | "budget"
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

/** Content offset for hover-rail sidebar — must equal collapsed rail width (`w-16`) so no gap shows. */
export const APP_SIDEBAR_RAIL_PAD = "md:pl-16";

/** @deprecated Prefer APP_SIDEBAR_RAIL_PAD — all desktop views use the hover rail. */
export const APP_SIDEBAR_FULL_PAD = "lg:pl-64";

/** Canonical app nav — labels can be overridden via `labelOverrides`. */
export const APP_NAV_ITEMS: AppNavItem[] = [
  { id: "builder", href: "/builder", label: "Home / Builder", icon: Home },
  {
    id: "discover",
    href: "/discover",
    label: "Discover Experiences",
    icon: Compass,
  },
  {
    id: "budget",
    href: "/budget-planner",
    label: "Budget Planner",
    icon: Wallet,
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
    href: "/team-access",
    label: "Team Access / Admin",
    icon: Settings,
  },
];

function isNavActive(pathname: string, item: AppNavItem): boolean {
  if (!item.href) return false;
  if (item.href === "/builder") return pathname === "/builder";
  if (item.href === "/discover") return pathname.startsWith("/discover");
  if (item.href === "/budget-planner")
    return pathname.startsWith("/budget-planner");
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
  return (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
      {APP_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const label = labelOverrides?.[item.id] ?? item.label;
        const active = isNavActive(pathname, item);

        const railItemClass = active
          ? "border-r-2 border-amber-400 bg-amber-500/10 text-amber-400"
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
                className="h-5 w-5 shrink-0 text-[#C4A35A]"
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
            href={item.href!}
            title={label}
            onClick={onNavigate}
            className={
              variant === "sidebar"
                ? `flex items-center gap-3 rounded-xl py-2.5 text-sm transition-all duration-300 ${railItemClass} ${railLayout}`
                : `flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm tracking-wide transition ${
                    active
                      ? "bg-[#C4A35A]/20 text-[#C4A35A]"
                      : "text-white/85 hover:bg-white/8"
                  }`
            }
          >
            <Icon
              className={`h-5 w-5 shrink-0 ${
                active ? "text-amber-400" : "text-zinc-500"
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
        <div className="mt-auto shrink-0 border-t border-zinc-800/80 pt-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-8">
          <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
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
            <span className="font-semibold text-amber-400 hover:underline">
              Sign out
            </span>
          </button>
        </div>
      );
    }

    return (
      <div className="mt-auto shrink-0 border-t border-zinc-800/80 pt-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-8">
        <button
          type="button"
          onClick={onManage}
          className="flex w-full items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-left transition hover:border-zinc-700"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
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
          href="/team-access"
          className="mt-3 flex items-center justify-between px-1 py-2 text-xs text-zinc-400 transition hover:text-white"
        >
          <span>Team Access</span>
          <span className="font-semibold text-amber-400">Sign in</span>
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
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[#C4A35A]">
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
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[#C4A35A]">
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
        href="/team-access"
        title="Team sign-in"
        className={`mt-1 flex items-center gap-2 rounded-xl py-2 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-white ${railBtnLayout}`}
      >
        <Settings className="h-4 w-4 shrink-0" aria-hidden />
        <NavLabel rail={rail} expanded={expanded}>
          Team sign-in
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
      className="fixed inset-0 z-[80] flex h-[100dvh] min-h-screen w-screen flex-col bg-zinc-950 text-white opacity-100"
    >
      <div className="relative z-[81] flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
            aria-label="Return to page"
          >
            <span className="text-lg leading-none" aria-hidden>
              ←
            </span>
          </button>
          <div className="min-w-0">
            <p className="text-[0.55rem] font-semibold uppercase tracking-[0.28em] text-[#C4A35A]">
              {brandEyebrow}
            </p>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
              Menu
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-400 transition hover:text-white"
        >
          Close
        </button>
      </div>

      <div className="relative z-[81] mx-auto flex w-full max-w-lg flex-1 flex-col overflow-y-auto overscroll-contain bg-zinc-950 px-6 py-6 pb-32">
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
 * Fixed left desktop icon rail. Opens a full-screen solid menu overlay.
 */
export function AppSidebar({
  brandEyebrow = "Elite Travel",
  brandTitle = "Discover",
  labelOverrides,
  expandOnHover = true,
}: {
  brandEyebrow?: string;
  brandTitle?: string;
  labelOverrides?: Partial<Record<AppNavId, string>>;
  /** Kept for API compat — menu opens full-screen on click */
  expandOnHover?: boolean;
}) {
  void expandOnHover;
  const pathname = usePathname();
  const router = useRouter();
  const logoSrc = useBrandLogo();
  const [manageOpen, setManageOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const openManage = () => setManageOpen(true);

  return (
    <>
      <aside className="fixed bottom-0 left-0 top-0 z-[60] hidden w-16 flex-col border-r border-zinc-800 bg-zinc-950 opacity-100 md:flex">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex flex-col items-center gap-1 px-2 py-3"
          aria-label="Open menu"
          aria-expanded={menuOpen}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt="Elite Travel Experiences"
            className="h-9 w-9 object-contain"
          />
        </button>

        <nav className="flex flex-1 flex-col gap-1 p-2" aria-label="Quick">
          {APP_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item);
            const label = labelOverrides?.[item.id] ?? item.label;
            const cls = `flex items-center justify-center rounded-xl py-2.5 transition ${
              active
                ? "border-r-2 border-amber-400 bg-amber-500/10 text-amber-400"
                : "border-r-2 border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-white"
            }`;
            if (item.action === "manage") {
              return (
                <button
                  key={item.id}
                  type="button"
                  title={label}
                  onClick={() => setMenuOpen(true)}
                  className={cls}
                >
                  <Icon className="h-5 w-5 text-[#C4A35A]" aria-hidden />
                </button>
              );
            }
            return (
              <button
                key={item.id}
                type="button"
                title={label}
                onClick={() => setMenuOpen(true)}
                className={cls}
              >
                <Icon
                  className={`h-5 w-5 ${active ? "text-amber-400" : "text-zinc-500"}`}
                  aria-hidden
                />
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="hidden md:block">
        <FullScreenNavOverlay
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          brandEyebrow={brandEyebrow}
          brandTitle={brandTitle}
          logoSrc={logoSrc}
          pathname={pathname}
          labelOverrides={labelOverrides}
          onManage={openManage}
        />
      </div>

      <ManageBookingModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        onSuccess={(ref) => {
          setToast(`Itinerary ${ref} loaded successfully`);
          router.push("/builder");
        }}
      />
      {toast ? (
        <div
          role="status"
          className="fixed bottom-8 left-1/2 z-[110] hidden w-[min(92vw,28rem)] -translate-x-1/2 rounded-xl border border-[#C4A35A]/50 bg-[#1a1510] px-4 py-3 text-center text-sm text-[#E8D5A3] shadow-lg md:block"
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}

/**
 * Mobile hamburger → full-screen solid menu. Shown below `md`.
 */
export function MobileAppNav({
  brandEyebrow = "Elite Travel",
  brandTitle = "Discover",
  labelOverrides,
}: {
  brandEyebrow?: string;
  brandTitle?: string;
  labelOverrides?: Partial<Record<AppNavId, string>>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const logoSrc = useBrandLogo();
  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-white transition hover:border-[#C4A35A] md:hidden"
      >
        <HamburgerIcon />
      </button>

      <div className="md:hidden">
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
          router.push("/builder");
        }}
      />
      {toast ? (
        <div
          role="status"
          className="fixed bottom-[7.5rem] left-1/2 z-[110] w-[min(92vw,28rem)] -translate-x-1/2 rounded-xl border border-[#C4A35A]/50 bg-[#1a1510] px-4 py-3 text-center text-sm text-[#E8D5A3] shadow-lg md:hidden"
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
