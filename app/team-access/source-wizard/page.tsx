"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SourceOfTruthWizard } from "@/components/team/SourceOfTruthWizard";
import { StaffLoginCard } from "@/components/staff/StaffPortalShell";
import { canAccessTeamAccess, homePathForRole } from "@/lib/staffRoles";
import { useTeamAuth } from "@/store/useTeamAuth";

export default function SourceWizardPage() {
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
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-4">
        <StaffLoginCard />
        <Link href="/team-access" className="text-xs text-[#075473]">
          Back to Team Access
        </Link>
      </div>
    );
  }

  if (!canAccessTeamAccess(role)) {
    return null;
  }

  return <SourceOfTruthWizard />;
}
