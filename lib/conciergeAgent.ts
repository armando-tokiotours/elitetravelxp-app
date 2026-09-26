/**
 * Resolve concierge agent for a PNR from ops_hub (direct bookings).
 * Failures return null — guest UI must stay resilient.
 */

import { getAdminPocketBase } from "@/lib/pocketbase/admin";

export type ConciergeAgentInfo = {
  id: string;
  name: string;
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
    return {
      id,
      name: name || "Your concierge",
      source: String(hub.source || "") || undefined,
    };
  } catch {
    return null;
  }
}
