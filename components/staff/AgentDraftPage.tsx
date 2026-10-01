"use client";

import { canAccessAgent } from "@/lib/staffRoles";
import { StaffPortalShell } from "@/components/staff/StaffPortalShell";
import { DraftBookingIntake } from "@/components/staff/DraftBookingIntake";

export function AgentDraftPage() {
  return (
    <StaffPortalShell title="Draft booking link" allow={canAccessAgent}>
      <DraftBookingIntake />
    </StaffPortalShell>
  );
}
