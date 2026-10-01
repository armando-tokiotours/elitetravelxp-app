"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BookOpen,
  Briefcase,
  Building2,
  Car,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  CreditCard,
  Link2,
  Map,
  RefreshCw,
  Settings2,
  Ticket,
  UserCircle,
  Users,
  Wallet,
} from "lucide-react";
import { getPbBaseUrl } from "@/lib/pocketbase/client";
import {
  ROLE_LABELS,
  canAccessAdmin,
  canAccessAgency,
  canAccessAgent,
  canAccessDriver,
  canAccessGuide,
  canAccessMoney,
  canAccessOpsBoard,
  canAccessTeamAccess,
  canAccessTicketer,
  type StaffRole,
} from "@/lib/staffRoles";
import { useTeamAuth } from "@/store/useTeamAuth";
import { ShortcutTile } from "@/components/staff/ShortcutTile";

const STAFF_NAV_EXPANDED_KEY = "staff-nav-expanded";
export const STAFF_PORTAL_REFRESH_EVENT = "staff-portal-refresh";

type StaffNavLink = {
  href: string;
  label: string;
  icon: ReactNode;
};

function linksForRole(role: StaffRole | null): StaffNavLink[] {
  const links: StaffNavLink[] = [];

  if (canAccessOpsBoard(role))
    links.push({
      href: "/ops",
      label: "Ops",
      icon: <ClipboardList className="h-5 w-5" strokeWidth={2} />,
    });
  if (canAccessOpsBoard(role))
    links.push({
      href: "/ops/booking",
      label: "Booking",
      icon: <Briefcase className="h-5 w-5" strokeWidth={2} />,
    });
  if (canAccessMoney(role))
    links.push({
      href: "/ops/money",
      label: "Money",
      icon: <Wallet className="h-5 w-5" strokeWidth={2} />,
    });
  if (canAccessAgent(role))
    links.push({
      href: "/agent",
      label: "Concierge",
      icon: <Users className="h-5 w-5" strokeWidth={2} />,
    });
  if (canAccessAgent(role))
    links.push({
      href: "/agent/draft",
      label: "Draft link",
      icon: <Link2 className="h-5 w-5" strokeWidth={2} />,
    });
  if (canAccessTicketer(role))
    links.push({
      href: "/ticketer",
      label: "Tickets",
      icon: <Ticket className="h-5 w-5" strokeWidth={2} />,
    });
  if (canAccessGuide(role))
    links.push({
      href: "/guide",
      label: "Guide",
      icon: <UserCircle className="h-5 w-5" strokeWidth={2} />,
    });
  if (canAccessDriver(role))
    links.push({
      href: "/driver",
      label: "Driver Coordinator",
      icon: <Car className="h-5 w-5" strokeWidth={2} />,
    });
  if (canAccessAgency(role))
    links.push({
      href: "/agency",
      label: "Agency",
      icon: <Building2 className="h-5 w-5" strokeWidth={2} />,
    });

  // Map — available to any authenticated staff portal user
  if (role)
    links.push({
      href: "/map",
      label: "Map",
      icon: <Map className="h-5 w-5" strokeWidth={2} />,
    });

  if (role)
    links.push({
      href: "/profile",
      label: "Profile",
      icon: <CreditCard className="h-5 w-5" strokeWidth={2} />,
    });

  // Role-gated: Admin leads vs Content (Team Access)
  if (canAccessAdmin(role))
    links.push({
      href: "/admin",
      label: "Leads",
      icon: <ClipboardList className="h-5 w-5" strokeWidth={2} />,
    });
  if (canAccessTeamAccess(role))
    links.push({
      href: "/team-access",
      label: "Content",
      icon: <Settings2 className="h-5 w-5" strokeWidth={2} />,
    });
  if (canAccessTeamAccess(role))
    links.push({
      href: "/staff/logic-dictionary",
      label: "Logic dictionary",
      icon: <BookOpen className="h-5 w-5" strokeWidth={2} />,
    });

  return links;
}

export function StaffLoginCard({
  title = "Staff login",
  subtitle = "Sign in with your staff email and password. Google Workspace SSO coming next.",
}: {
  title?: string;
  subtitle?: string;
}) {
  const login = useTeamAuth((s) => s.login);
  const loginWithGoogleStub = useTeamAuth((s) => s.loginWithGoogleStub);
  const homePath = useTeamAuth((s) => s.homePath);
  const router = useRouter();

  const [emailInput, setEmailInput] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [googleMsg, setGoogleMsg] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
      <h2 className="font-display text-2xl text-white">{title}</h2>
      <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
      <p className="mt-1 text-[11px] text-zinc-500">
        PocketBase: {getPbBaseUrl()}
      </p>
      <form
        className="mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setAuthLoading(true);
          setAuthError(null);
          setGoogleMsg(null);
          try {
            const { role } = await login(emailInput.trim(), password);
            router.replace(
              homePath() ||
                (role === "agency"
                  ? "/agency"
                  : role === "guide"
                    ? "/guide"
                    : role === "driver"
                      ? "/driver"
                      : role === "ticketer"
                        ? "/ticketer"
                        : role === "agent"
                          ? "/agent"
                          : "/ops")
            );
          } catch (err) {
            setAuthError(
              err instanceof Error ? err.message : "Login failed"
            );
          } finally {
            setAuthLoading(false);
          }
        }}
      >
        <label className="block text-xs uppercase tracking-wider text-zinc-400">
          Email
          <input
            type="email"
            required
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-[#075473]"
          />
        </label>
        <label className="block text-xs uppercase tracking-wider text-zinc-400">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-[#075473]"
          />
        </label>
        {authError ? (
          <p className="text-sm text-red-400">{authError}</p>
        ) : null}
        <button
          type="submit"
          disabled={authLoading}
          className="w-full rounded-full bg-accent-500 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {authLoading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <button
        type="button"
        className="mt-3 w-full rounded-full border border-zinc-700 bg-zinc-950 py-3 text-sm font-semibold text-zinc-300 transition hover:border-[#075473] hover:text-white"
        onClick={() => {
          setGoogleMsg(null);
          try {
            loginWithGoogleStub();
          } catch (err) {
            setGoogleMsg(
              err instanceof Error ? err.message : "Google sign-in unavailable"
            );
          }
        }}
      >
        Continue with Google
      </button>
      {googleMsg ? (
        <p className="mt-2 text-xs text-amber-400/90">{googleMsg}</p>
      ) : null}
    </div>
  );
}

/**
 * Staff portal chrome — no Silo 1 customer nav.
 * Hydrates auth; shows login or children based on role allow check.
 */
export function StaffPortalShell({
  title,
  allow,
  children,
  wide = false,
}: {
  title: string;
  allow: (role: StaffRole | null) => boolean;
  children: ReactNode;
  /** Wider content + header for email-style split layouts (e.g. /ops). */
  wide?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [isNavExpanded, setIsNavExpanded] = useState(false);
  const isAuthenticated = useTeamAuth((s) => s.isAuthenticated);
  const email = useTeamAuth((s) => s.email);
  const role = useTeamAuth((s) => s.role);
  const logout = useTeamAuth((s) => s.logout);
  const hydrateAuth = useTeamAuth((s) => s.hydrateAuth);
  const homePath = useTeamAuth((s) => s.homePath);
  const maxW = wide ? "max-w-[90rem]" : "max-w-6xl";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await useTeamAuth.persist.rehydrate();
      if (cancelled) return;
      await hydrateAuth();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrateAuth]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STAFF_NAV_EXPANDED_KEY);
      if (raw === "1" || raw === "true") setIsNavExpanded(true);
      else setIsNavExpanded(false);
    } catch {
      setIsNavExpanded(false);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STAFF_NAV_EXPANDED_KEY,
        isNavExpanded ? "1" : "0"
      );
    } catch {
      /* ignore */
    }
  }, [isNavExpanded]);

  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    if (!allow(role)) {
      router.replace(homePath());
    }
  }, [ready, isAuthenticated, role, allow, router, homePath]);

  const links = linksForRole(role);
  const ribbonSummary = useMemo(
    () => links.map((l) => l.label).join(" · ") || "Modules",
    [links]
  );

  const handleRefresh = () => {
    window.dispatchEvent(new CustomEvent(STAFF_PORTAL_REFRESH_EVENT));
    router.refresh();
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#0B0F14] text-zinc-200">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-[#0A1017]/95 backdrop-blur">
        <div
          className={`mx-auto flex ${maxW} flex-wrap items-center gap-2 px-4 py-2 sm:px-6`}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[0.6rem] font-semibold tracking-[0.3em] text-[#075473] uppercase">
              TOKIOTOURS · Staff
            </p>
            <h1 className="font-display text-lg leading-tight text-white sm:text-xl">
              {title}
            </h1>
          </div>
          {isAuthenticated && role ? (
            <p className="text-xs text-zinc-500">
              {email} · {ROLE_LABELS[role]}
            </p>
          ) : null}
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => {
                logout();
                router.replace("/team-access");
              }}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:text-white"
            >
              Sign out
            </button>
          ) : null}
        </div>

        {isAuthenticated && links.length > 0 ? (
          <div className="border-t border-white/10">
            <div
              className={`mx-auto flex ${maxW} items-center justify-between gap-3 px-4 py-1.5 sm:px-6`}
            >
              <button
                type="button"
                onClick={() => setIsNavExpanded((v) => !v)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs text-zinc-400 transition hover:text-white"
                aria-expanded={isNavExpanded}
              >
                <span className="shrink-0 font-bold tracking-wider text-[#F6A724] uppercase">
                  Navigation
                </span>
                {isNavExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                )}
                <span className="truncate text-zinc-500">
                  {isNavExpanded ? "Hide menu" : ribbonSummary}
                </span>
              </button>

              <button
                type="button"
                onClick={handleRefresh}
                className="ml-auto flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Refresh
              </button>
            </div>

            {isNavExpanded ? (
              <nav
                className={`mx-auto flex ${maxW} gap-2 overflow-x-auto border-t border-white/5 px-4 py-2.5 sm:px-6`}
              >
                {links.map((l) => {
                  const active =
                    pathname === l.href ||
                    (l.href !== "/ops" &&
                      pathname.startsWith(l.href + "/")) ||
                    (l.href === "/ops" && pathname === "/ops");
                  return (
                    <ShortcutTile
                      key={l.href}
                      href={l.href}
                      label={l.label}
                      icon={l.icon}
                      active={active}
                    />
                  );
                })}
              </nav>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className={`mx-auto w-full flex-1 ${maxW} px-4 py-2 sm:px-6`}>
        {!ready ? (
          <p className="py-16 text-center text-sm text-zinc-400">Loading…</p>
        ) : !isAuthenticated ? (
          <StaffLoginCard />
        ) : !allow(role) ? (
          <p className="py-16 text-center text-sm text-zinc-400">
            Redirecting…
          </p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
