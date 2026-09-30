/**
 * Resolve concierge agent for a PNR from ops_hub (direct bookings).
 * Failures return null — guest UI must stay resilient.
 */

import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import { getPbBaseUrl } from "@/lib/pocketbase/client";

export type ConciergeAgentInfo = {
  id: string;
  name: string;
  email?: string;
  photoUrl?: string | null;
  source?: string;
};

export async function findConciergeAgentByPnr(
  pnr: string
): Promise<ConciergeAgentInfo | null> {
  const ref = String(pnr || "")
    .trim()
    .toUpperCase()
    .replace(/"/g, "");
  if (!ref) return null;

  try {
    const pb = await getAdminPocketBase();
    const hub = await pb.collection("ops_hub").getFirstListItem(`pnr="${ref}"`, {
      requestKey: null,
    });
    // Agency trips are coordinated by ops, not a personal concierge agent.
    if (String(hub.source || "") === "agency") return null;
    const name = String(hub.assigned_agent || "").trim();
    const id = String(hub.assigned_agent_id || "").trim();
    if (!name && !id) return null;

    let email = "";
    let photoUrl: string | null = null;
    let displayName = name || "Your concierge";

    if (id) {
      try {
        const staff = await pb.collection("staff").getOne(id, {
          requestKey: null,
        });
        email = String(staff.email || "").trim();
        if (staff.name) displayName = String(staff.name).trim() || displayName;
      } catch {
        /* ignore */
      }
      try {
        const profile = await pb
          .collection("staff_profiles")
          .getFirstListItem(`staff_id="${id}"`, { requestKey: null });
        if (profile.display_name) {
          displayName = String(profile.display_name).trim() || displayName;
        }
        if (profile.photo && profile.id) {
          photoUrl = `${getPbBaseUrl()}/api/files/staff_profiles/${profile.id}/${encodeURIComponent(String(profile.photo))}`;
        }
      } catch {
        /* ignore */
      }
    }

    return {
      id,
      name: displayName,
      email: email || undefined,
      photoUrl,
      source: String(hub.source || "") || undefined,
    };
  } catch {
    return null;
  }
}
