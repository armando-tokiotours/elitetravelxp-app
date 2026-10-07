/**
 * Resolve concierge agent for a PNR from ops_hub (direct bookings).
 * Failures return null — guest UI must stay resilient.
 */

import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import { combineStaffDisplayName } from "@/lib/staffProfiles";

export type ConciergeAgentInfo = {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  /** Digits-only WhatsApp / phone from staff_profiles (for wa.me). */
  whatsappDigits?: string;
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
    let firstName = "";
    let lastName = "";
    let whatsappDigits = "";

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
        const fn = String(profile.first_name || "").trim();
        const ln = String(profile.last_name || "").trim();
        if (fn || ln) {
          firstName = fn;
          lastName = ln;
          displayName =
            combineStaffDisplayName(fn, ln) || displayName;
        } else if (profile.display_name) {
          displayName = String(profile.display_name).trim() || displayName;
        }
        whatsappDigits = String(profile.phone || "").replace(/\D/g, "");
        if (profile.photo) {
          photoUrl = `/api/staff/avatar/${encodeURIComponent(id)}?v=${encodeURIComponent(String(profile.photo))}`;
        }
      } catch {
        /* ignore */
      }
    }

    return {
      id,
      name: displayName,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      email: email || undefined,
      whatsappDigits: whatsappDigits.length >= 8 ? whatsappDigits : undefined,
      photoUrl,
      source: String(hub.source || "") || undefined,
    };
  } catch {
    return null;
  }
}
