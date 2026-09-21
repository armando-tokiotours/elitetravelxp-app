"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AppSidebar,
  APP_SIDEBAR_RAIL_PAD,
  MobileAppNav,
} from "@/components/navigation/AppSidebar";
import { BookingsManagementTable } from "@/components/team/BookingsManagementTable";
import { TeamConfigDashboard } from "@/components/team/TeamConfigDashboard";
import { useTeamAuth } from "@/store/useTeamAuth";

type PrimaryTab = "bookings" | "email";

function AdminDashboardInner() {
  const searchParams = useSearchParams();
  const initialTab =
    searchParams.get("tab") === "email" ? "email" : "bookings";

  const [ready, setReady] = useState(false);
  const [activeAdminTab, setActiveAdminTab] =
    useState<PrimaryTab>(initialTab);

  const isAuthenticated = useTeamAuth((s) => s.isAuthenticated);
  const email = useTeamAuth((s) => s.email);
  const login = useTeamAuth((s) => s.login);
  const logout = useTeamAuth((s) => s.logout);
  const hydrateAuth = useTeamAuth((s) => s.hydrateAuth);
  const getClient = useTeamAuth((s) => s.getClient);

  const [emailInput, setEmailInput] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

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
    const t = searchParams.get("tab");
    if (t === "email" || t === "bookings") setActiveAdminTab(t);
  }, [searchParams]);

  return (
    <>
      <AppSidebar
        brandEyebrow="Elite Travel"
        brandTitle="Admin"
        expandOnHover
      />
      <div
        className={`${APP_SIDEBAR_RAIL_PAD} min-h-screen bg-[#121212] text-white`}
      >
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-[#2C2C2E] bg-[#121212]/95 px-4 py-3 backdrop-blur lg:hidden">
          <MobileAppNav brandEyebrow="Elite Travel" brandTitle="Admin" />
          <div className="min-w-0">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.28em] text-[#B85304]">
              Elite Travel
            </p>
            <h1 className="font-display text-lg leading-tight text-white">
              Team Access & Admin
            </h1>
          </div>
        </header>

        <div className="mx-auto max-w-6xl p-4 sm:p-6">
          {!ready ? (
            <p className="py-16 text-center text-sm text-zinc-400">Loading…</p>
          ) : !isAuthenticated ? (
            <div className="mx-auto max-w-md rounded-2xl border border-[#2C2C2E] bg-[#1C1C1E] p-6">
              <h2 className="font-display text-2xl text-white">Team login</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Sign in with PocketBase admin credentials to manage bookings and
                email/SMTP settings.
              </p>
              <form
                className="mt-5 space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setAuthLoading(true);
                  setAuthError(null);
                  try {
                    await login(emailInput.trim(), password);
                  } catch (err) {
                    setAuthError(
                      err instanceof Error ? err.message : "Login failed"
                    );
                  } finally {
                    setAuthLoading(false);
                  }
                }}
              >
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="Admin email"
                  className="w-full rounded-xl border border-[#2C2C2E] bg-[#121212] px-3 py-2.5 text-sm text-white outline-none focus:border-[#B85304]"
                />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full rounded-xl border border-[#2C2C2E] bg-[#121212] px-3 py-2.5 text-sm text-white outline-none focus:border-[#B85304]"
                />
                {authError ? (
                  <p className="text-xs text-amber-300">{authError}</p>
                ) : null}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full rounded-full bg-[#B85304] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {authLoading ? "Signing in…" : "Sign in"}
                </button>
              </form>
            </div>
          ) : (
            <>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-6">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-[#B85304]">
                    PRIVATE MANAGEMENT PORTAL
                  </span>
                  <h1 className="mt-1 text-2xl font-black text-white">
                    Team Access & Admin
                  </h1>
                  <p className="mt-1 text-sm text-zinc-400">
                    Signed in as{" "}
                    <strong className="text-white">{email}</strong>
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link
                      href="/team-access"
                      className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-[#1C1C1E] px-3.5 py-1.5 text-xs font-bold text-zinc-300 transition hover:border-[#B85304] hover:text-white"
                    >
                      <span aria-hidden>←</span>
                      <span>Content Admin</span>
                    </Link>
                    <Link
                      href="/builder"
                      className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-[#1C1C1E] px-3.5 py-1.5 text-xs font-bold text-zinc-400 transition hover:border-[#B85304] hover:text-white"
                    >
                      <span aria-hidden>🏠</span>
                      <span>Exit to Trip Builder</span>
                    </Link>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-xl border border-zinc-800 bg-[#1C1C1E] px-3 py-1.5 text-xs font-bold text-zinc-300 transition hover:text-red-400"
                >
                  Sign out
                </button>
              </div>

              <div className="mb-8 flex flex-wrap gap-4 border-b border-zinc-800">
                <button
                  type="button"
                  onClick={() => setActiveAdminTab("bookings")}
                  className={`flex items-center gap-2 border-b-2 px-2 pb-3 text-xs font-bold transition ${
                    activeAdminTab === "bookings"
                      ? "border-[#B85304] text-[#D9BB96]"
                      : "border-transparent text-zinc-400 hover:text-white"
                  }`}
                >
                  <span aria-hidden>📋</span>
                  <span>Bookings & Leads</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveAdminTab("email")}
                  className={`flex items-center gap-2 border-b-2 px-2 pb-3 text-xs font-bold transition ${
                    activeAdminTab === "email"
                      ? "border-[#B85304] text-[#D9BB96]"
                      : "border-transparent text-zinc-400 hover:text-white"
                  }`}
                >
                  <span aria-hidden>✉️</span>
                  <span>Email & SMTP Settings</span>
                </button>
              </div>

              {activeAdminTab === "bookings" ? (
                <BookingsManagementTable getClient={getClient} />
              ) : (
                <TeamConfigDashboard />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

export function AdminDashboard() {
  return (
    <Suspense
      fallback={
        <p className="bg-[#121212] p-8 text-center text-sm text-zinc-400">
          Loading admin…
        </p>
      }
    >
      <AdminDashboardInner />
    </Suspense>
  );
}
