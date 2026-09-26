"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
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

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-2 text-sm transition ${
        active
          ? "bg-[#075473]/25 text-[#075473]"
          : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}

function linksForRole(role: StaffRole | null) {
  const links: Array<{ href: string; label: string }> = [];
  if (canAccessOpsBoard(role)) links.push({ href: "/ops", label: "Ops board" });
  if (canAccessOpsBoard(role))
    links.push({ href: "/ops/booking", label: "Booking master" });
  if (canAccessMoney(role)) links.push({ href: "/ops/money", label: "Money" });
  if (canAccessAgent(role)) links.push({ href: "/agent", label: "Concierge" });
  if (canAccessTicketer(role))
    links.push({ href: "/ticketer", label: "Tickets" });
  if (canAccessGuide(role)) links.push({ href: "/guide", label: "Guide" });
  if (canAccessDriver(role)) links.push({ href: "/driver", label: "Driver" });
  if (canAccessAgency(role)) links.push({ href: "/agency", label: "Agency" });
  if (role) links.push({ href: "/profile", label: "My profile" });
  if (canAccessAdmin(role)) links.push({ href: "/admin", label: "Admin leads" });
  if (canAccessTeamAccess(role))
    links.push({ href: "/team-access", label: "Team Access" });
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
}: {
  title: string;
  allow: (role: StaffRole | null) => boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const isAuthenticated = useTeamAuth((s) => s.isAuthenticated);
  const email = useTeamAuth((s) => s.email);
  const role = useTeamAuth((s) => s.role);
  const logout = useTeamAuth((s) => s.logout);
  const hydrateAuth = useTeamAuth((s) => s.hydrateAuth);
  const homePath = useTeamAuth((s) => s.homePath);

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
    if (!ready || !isAuthenticated) return;
    if (!allow(role)) {
      router.replace(homePath());
    }
  }, [ready, isAuthenticated, role, allow, router, homePath]);

  const links = linksForRole(role);

  return (
    <div className="min-h-screen bg-[#0B0F14] text-zinc-200">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-[#0B0F14]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-[#075473]">
              TOKIOTOURS · Staff
            </p>
            <h1 className="font-display text-xl text-white">{title}</h1>
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
          <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3 sm:px-6">
            {links.map((l) => (
              <NavLink
                key={l.href}
                href={l.href}
                label={l.label}
                active={
                  pathname === l.href ||
                  (l.href !== "/ops" && pathname.startsWith(l.href + "/")) ||
                  (l.href === "/ops" && pathname === "/ops")
                }
              />
            ))}
          </nav>
        ) : null}
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
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
