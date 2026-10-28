"use client";

import { canAccessOpsBoard } from "@/lib/staffRoles";
import { useTeamAuth } from "@/store/useTeamAuth";

/**
 * Guest/client inquiry builders hide ops-only Meeting Point search/map.
 * Ops / Concierge / Owner (staff session with ops-board access) see it.
 */
export function useIsBuilderGuestView(): boolean {
  const isAuthenticated = useTeamAuth((s) => s.isAuthenticated);
  const role = useTeamAuth((s) => s.role);
  return !(isAuthenticated && canAccessOpsBoard(role));
}
