"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ClipboardList,
  LayoutDashboard,
  Map,
  Settings2,
  Home,
} from "lucide-react";
import {
  AppSidebar,
  APP_SIDEBAR_RAIL_PAD,
  MobileAppNav,
} from "@/components/navigation/AppSidebar";
import { BookingsManagementTable } from "@/components/team/BookingsManagementTable";
import { AdminSummaryPanel } from "@/components/team/AdminSummaryPanel";
import { ShortcutTile } from "@/components/staff/ShortcutTile";
import { useTeamAuth } from "@/store/useTeamAuth";
import { StaffLoginCard } from "@/components/staff/StaffPortalShell";
import {
  ROLE_LABELS,
  canAccessAdmin,
  canAccessOpsBoard,
  canAccessTeamAccess,
  homePathForRole,
} from "@/lib/staffRoles";
import { useRouter } from "next/navigation";

type PrimaryTab = "bookings" | "summary";

function AdminDashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab =
    searchParams.get("tab") === "summary" ||
    searchParams.get("tab") === "email"
      ? "summary"
      : "bookings";

  const [ready, setReady] = useState(false);
  const [activeAdminTab, setActiveAdminTab] =
    useState<PrimaryTab>(initialTab);

  const isAuthenticated = useTeamAuth((s) => s.isAuthenticated);
  const email = useTeamAuth((s) => s.email);
  const role = useTeamAuth((s) => s.role);
  const logout = useTeamAuth((s) => s.logout);
  const hydrateAuth = useTeamAuth((s) => s.hydrateAuth);
  const getClient = useTeamAuth((s) => s.getClient);

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
    if (t === "summary" || t === "email") setActiveAdminTab("summary");
    else if (t === "bookings") setActiveAdminTab("bookings");
  }, [searchParams]);

  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    if (!canAccessAdmin(role) && role) {
      router.replace(homePathForRole(role));
    }
  }, [ready, isAuthenticated, role, router]);

  return (
    <>
      <AppSidebar
        brandEyebrow="TOKIOTOURS"
        brandTitle="Admin"
        expandOnHover
      />
      <div
        className={`${APP_SIDEBAR_RAIL_PAD} min-h-screen bg-[#121212] text-white`}
      >
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-[#2C2C2E] bg-[#121212]/95 px-4 py-3 backdrop-blur lg:hidden">
          <MobileAppNav brandEyebrow="TOKIOTOURS" brandTitle="Admin" />
          <div className="min-w-0">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.28em] text-[#075473]">
              TOKIOTOURS
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
            <StaffLoginCard
              title="Team login"
              subtitle="Owner / Ops manage bookings and admin summary. Other roles go to their portal after sign-in."
            />
          ) : !canAccessAdmin(role) ? (
            <p className="py-16 text-center text-sm text-zinc-400">
              Redirecting to your portal…
            </p>
          ) : (
            <>
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-zinc-800 pb-6">
                <div className="min-w-0 flex-1">
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-[#075473]">
                    PRIVATE MANAGEMENT PORTAL
                  </span>
                  <h1 className="mt-1 text-2xl font-black text-white">
                    Team Access & Admin
                  </h1>
                  <p className="mt-1 text-sm text-zinc-400">
                    Signed in as{" "}
                    <strong className="text-white">{email}</strong>
                    {role ? ` · ${ROLE_LABELS[role]}` : ""}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2.5">
                    {canAccessOpsBoard(role) ? (
                      <ShortcutTile
                        href="/ops"
                        label="Ops"
                        icon={
                          <ClipboardList className="h-5 w-5" strokeWidth={2} />
                        }
                      />
                    ) : null}
                    {canAccessTeamAccess(role) ? (
                      <ShortcutTile
                        href="/team-access"
                        label="Content"
                        icon={<Settings2 className="h-5 w-5" strokeWidth={2} />}
                      />
                    ) : null}
                    <ShortcutTile
                      href="/map"
                      label="Map"
                      icon={<Map className="h-5 w-5" strokeWidth={2} />}
                    />
                    <ShortcutTile
                      href="/builder"
                      label="Builder"
                      icon={<Home className="h-5 w-5" strokeWidth={2} />}
                    />
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
                      ? "border-[#075473] text-[#075473]"
                      : "border-transparent text-zinc-400 hover:text-white"
                  }`}
                >
                  <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                  <span>Bookings & Leads</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveAdminTab("summary")}
                  className={`flex items-center gap-2 border-b-2 px-2 pb-3 text-xs font-bold transition ${
                    activeAdminTab === "summary"
                      ? "border-[#075473] text-[#075473]"
                      : "border-transparent text-zinc-400 hover:text-white"
                  }`}
                >
                  <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
                  <span>Summary</span>
                </button>
              </div>

              {activeAdminTab === "bookings" ? (
                <BookingsManagementTable getClient={getClient} />
              ) : (
                <AdminSummaryPanel getClient={getClient} />
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
