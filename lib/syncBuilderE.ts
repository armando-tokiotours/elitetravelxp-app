/**
 * Builder E → PocketBase `bookings` (EXPERIENCE_ONLY) + BAL + ops_hub demand.
 */

import {
  builderEDemandFromState,
  builderEGuestSummary,
  builderEPayloadSnapshot,
  builderEPrimaryCity,
  builderETourDate,
  type BuilderEState,
} from "@/store/useBuilderEStore";
import { buildBuilderEContactSnapshot } from "@/lib/builderEEstimate";

export async function syncBuilderELead(opts: {
  state: BuilderEState;
  status?: "draft" | "lead" | "in_progress";
}): Promise<{ ok: boolean; error?: string }> {
  const s = opts.state;
  const bookingRef = String(s.bookingRef || "").trim();
  const email = String(s.guestEmail || "")
    .trim()
    .toLowerCase();
  const fullName = String(s.guestName || "").trim();
  const whatsapp = String(s.guestWhatsapp || "").trim();
  if (!bookingRef || !email || !fullName || !whatsapp || !s.category) {
    return {
      ok: false,
      error: "PNR, name, email, WhatsApp, and category are required.",
    };
  }

  const demand = builderEDemandFromState(s);
  const tourDate = builderETourDate(s);
  const primaryCity = builderEPrimaryCity(s);
  const contactSnapshot = buildBuilderEContactSnapshot(s.cart);
  const snapshot = {
    ...builderEPayloadSnapshot(s),
    ...contactSnapshot,
  };
  const bookingsStatus =
    opts.status === "in_progress" ? "in_progress" : "draft";

  try {
    const res = await fetch("/api/bookings/experience-only", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingRef,
        email,
        fullName,
        whatsapp,
        status: bookingsStatus,
        category: s.category,
        primaryCity,
        tourDate,
        guests: {
          adults: contactSnapshot.paxCount,
          kids: 0,
        },
        payload: snapshot,
        demand,
        guestSummary: builderEGuestSummary(s),
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error || res.statusText };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}
