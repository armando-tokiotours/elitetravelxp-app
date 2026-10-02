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
  Sparkles,
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
  if (canAccessOpsBoard(role))
    links.push({
      href: "/ops/settings/ai-rules",
      label: "AI knowledge",
      icon: <Sparkles className="h-5 w-5" strokeWidth={2} />,
    });

  return links;
}

export function StaffLoginCard({
  title = "Staff login",
  subtitle = "Core team: Google Workspace SSO. Guides & travel agents: email + password (use your onboarding link). Test agents: any email created in PocketBase.",
}: {
  title?: string;
  subtitle?: string;
}) {
  const login = useTeamAuth((s) => s.login);
  const loginWithGoogle = useTeamAuth((s) => s.loginWithGoogle);
  const homePath = useTeamAuth((s) => s.homePath);
  const router = useRouter();

  const [emailInput, setEmailInput] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const redirectAfterLogin = (role: StaffRole) => {
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
  };

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
      <h2 className="font-display text-2xl text-white">{title}</h2>
      <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
      <p className="mt-1 text-[11px] text-zinc-500">
        PocketBase: {getPbBaseUrl()}
      </p>

      <button
        type="button"
        disabled={googleLoading || authLoading}
        className="mt-6 flex w-full items-center justify-center gap-3 rounded-full border border-white/20 bg-[#075473] py-3 text-sm font-semibold text-white transition hover:bg-[#054F70] disabled:opacity-50"
        onClick={async () => {
          setGoogleLoading(true);
          setAuthError(null);
          try {
            const { role } = await loginWithGoogle();
            redirectAfterLogin(role);
          } catch (err) {
            setAuthError(
              err instanceof Error ? err.message : "Google sign-in failed"
            );
          } finally {
            setGoogleLoading(false);
          }
        }}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        {googleLoading
          ? "Authenticating…"
          : "Sign in with Google Workspace"}
      </button>

      <div className="my-5 flex items-center gap-3 text-[10px] tracking-wider text-zinc-500 uppercase">
        <span className="h-px flex-1 bg-zinc-800" />
        or email
        <span className="h-px flex-1 bg-zinc-800" />
      </div>

      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setAuthLoading(true);
          setAuthError(null);
          try {
            const { role } = await login(emailInput.trim(), password);
            redirectAfterLogin(role);
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
          disabled={authLoading || googleLoading}
          className="w-full rounded-full bg-accent-500 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {authLoading ? "Signing in…" : "Sign in with password"}
        </button>
      </form>
      <p className="mt-4 text-center text-[10px] text-zinc-500">
        Guides and external agents use email/password only (not Google SSO).
        Create any test staff in PocketBase → <code className="text-zinc-400">staff</code>{" "}
        with role <code className="text-zinc-400">agent</code> /{" "}
        <code className="text-zinc-400">guide</code> /{" "}
        <code className="text-zinc-400">agency</code>.
      </p>
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

  const isOpsRoute = pathname === "/ops" || pathname.startsWith("/ops/");

  return (
    <div
      className={`flex min-h-screen flex-col bg-[#0B0F14] text-zinc-200 ${
        isOpsRoute ? "ops-dashboard" : ""
      }`}
    >
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
