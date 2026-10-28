"use client";

import { RolePreviewSandbox } from "@/components/ops/RolePreviewSandbox";
import { StaffPortalShell } from "@/components/staff/StaffPortalShell";
import { canAccessOpsBoard } from "@/lib/staffRoles";

export default function RolePreviewsPage() {
  return (
    <StaffPortalShell title="Role previews" allow={canAccessOpsBoard} wide>
      <RolePreviewSandbox />
    </StaffPortalShell>
  );
}
