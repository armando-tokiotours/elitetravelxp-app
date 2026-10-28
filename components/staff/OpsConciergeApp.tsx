"use client";

import { CommsAndRemindersConsole } from "@/components/ops/CommsAndRemindersConsole";
import { StaffPortalShell } from "@/components/staff/StaffPortalShell";
import { canAccessOpsBoard } from "@/lib/staffRoles";
import { useTeamAuth } from "@/store/useTeamAuth";

/**
 * Staff-gated Global Communications Desk at /ops/concierge.
 * All active PNRs — not the single-booking Tab 7 view.
 */
export function OpsConciergeApp() {
  return (
    <StaffPortalShell
      title="Concierge · Communications"
      allow={canAccessOpsBoard}
      wide
    >
      <ConciergeDeskInner />
    </StaffPortalShell>
  );
}

function ConciergeDeskInner() {
  const getClient = useTeamAuth((s) => s.getClient);
  const pb = getClient();

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Cross-PNR reminders queue for every active booking. Open a booking
        inspector Tab 7 for one PNR only.
      </p>
      <CommsAndRemindersConsole pb={pb} />
    </div>
  );
}
