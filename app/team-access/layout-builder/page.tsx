"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AppSidebar,
  APP_SIDEBAR_RAIL_PAD,
  MobileAppNav,
} from "@/components/navigation/AppSidebar";
import { LayoutBuilderHub } from "@/components/team/LayoutBuilderHub";
import { StaffLoginCard } from "@/components/staff/StaffPortalShell";
import { canAccessTeamAccess, homePathForRole } from "@/lib/staffRoles";
import { useTeamAuth } from "@/store/useTeamAuth";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppSidebar
        brandEyebrow="TOKIOTOURS"
        brandTitle="Layout Builder"
        expandOnHover
      />
      <div
        className={`${APP_SIDEBAR_RAIL_PAD} min-h-screen bg-zinc-950 text-white`}
      >
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-3 lg:hidden">
          <MobileAppNav brandEyebrow="TOKIOTOURS" brandTitle="Layout Builder" />
          <div className="min-w-0">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.28em] text-[#075473]">
              TOKIOTOURS
            </p>
            <h1 className="font-display text-lg leading-tight text-white">
              Layout Builder
            </h1>
          </div>
        </header>
        {children}
      </div>
    </>
  );
}

function HubFromQuery() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const initial =
    tab === "guest_party" ||
    tab === "heroes" ||
    tab === "characters" ||
    tab === "clock_loader" ||
    tab === "fox_messages" ||
    tab === "hi_bubble" ||
    tab === "timeline_mascot"
      ? tab
      : "characters";
  return <LayoutBuilderHub initialTab={initial} />;
}

export default function LayoutBuilderPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const isAuthenticated = useTeamAuth((s) => s.isAuthenticated);
  const role = useTeamAuth((s) => s.role);
  const hydrateAuth = useTeamAuth((s) => s.hydrateAuth);

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
    if (!canAccessTeamAccess(role) && role) {
      router.replace(homePathForRole(role));
    }
  }, [ready, isAuthenticated, role, router]);

  if (!ready) {
    return (
      <Shell>
        <p className="p-8 text-center text-sm text-zinc-400">Loading…</p>
      </Shell>
    );
  }

  if (!isAuthenticated) {
    return (
      <Shell>
        <main className="mx-auto max-w-md px-4 py-10">
          <StaffLoginCard
            title="Team login"
            subtitle="Sign in to open the layout & characters builder."
          />
          <p className="mt-4 text-center text-xs text-zinc-500">
            <Link href="/team-access" className="text-[#075473] hover:underline">
              ← Team Access
            </Link>
          </p>
        </main>
      </Shell>
    );
  }

  if (!canAccessTeamAccess(role)) {
    return (
      <Shell>
        <p className="p-8 text-center text-sm text-zinc-400">
          Redirecting to your portal…
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <Suspense
        fallback={
          <p className="p-8 text-center text-sm text-zinc-400">Loading…</p>
        }
      >
        <HubFromQuery />
      </Suspense>
    </Shell>
  );
}
