"use client";

import { MediaStorageInspector } from "@/components/ops/MediaStorageInspector";
import { StaffPortalShell } from "@/components/staff/StaffPortalShell";
import { canAccessOpsBoard } from "@/lib/staffRoles";

export default function MediaInspectorPage() {
  return (
    <StaffPortalShell
      title="Media storage inspector"
      allow={canAccessOpsBoard}
      wide
    >
      <MediaStorageInspector />
    </StaffPortalShell>
  );
}
