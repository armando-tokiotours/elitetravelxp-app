"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StaffLoginCard } from "@/components/staff/StaffPortalShell";
import { useTeamAuth } from "@/store/useTeamAuth";

/**
 * Dedicated staff Workspace SSO entry — /login
 * Also available via any StaffPortalShell route when logged out.
 */
export default function StaffLoginPage() {
  const router = useRouter();
  const isAuthenticated = useTeamAuth((s) => s.isAuthenticated);
  const homePath = useTeamAuth((s) => s.homePath);
  const hydrateAuth = useTeamAuth((s) => s.hydrateAuth);
  const [ready, setReady] = useState(false);

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
    router.replace(homePath() || "/ops");
  }, [ready, isAuthenticated, homePath, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05080C] text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05080C] p-4">
      <StaffLoginCard
        title="TokioTours Staff Access"
        subtitle="Internal Operations Portal — Google Workspace SSO for @tokiotours.nl / @travelexperiencesgroup.com."
      />
    </div>
  );
}
