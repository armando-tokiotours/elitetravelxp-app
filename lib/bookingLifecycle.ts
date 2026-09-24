import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import {
  normalizeBookingStatus,
  type BookingStatus,
} from "@/utils/pnr";

export type LeadBookingStatus = Extract<
  BookingStatus,
  "draft" | "in_progress" | "confirmed"
>;

/**
 * Advance a `bookings` lead to `in_progress` by booking_ref.
 * Never promotes to `confirmed` (admin-only).
 * No-ops if the lead is already confirmed or missing.
 */
export async function advanceBookingToInProgress(
  bookingRef: string
): Promise<{ ok: boolean; id?: string; status?: LeadBookingStatus; error?: string }> {
  const ref = String(bookingRef || "")
    .trim()
    .toUpperCase();
  if (!ref) {
    return { ok: false, error: "Missing booking reference." };
  }

  try {
    const pb = await getAdminPocketBase();
    const record = await pb
      .collection("bookings")
      .getFirstListItem(`booking_ref="${ref.replace(/"/g, "")}"`);

    const current = normalizeBookingStatus(record.status);
    if (current === "confirmed") {
      return { ok: true, id: record.id, status: "confirmed" };
    }
    if (current === "in_progress") {
      return { ok: true, id: record.id, status: "in_progress" };
    }

    const updated = await pb.collection("bookings").update(record.id, {
      status: "in_progress",
    });
    return {
      ok: true,
      id: updated.id,
      status: "in_progress",
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not update booking status.";
    return { ok: false, error: message };
  }
}

/** Client helper — fire-and-forget advance when guest continues editing. */
export async function requestAdvanceBookingInProgress(
  bookingRef: string
): Promise<void> {
  const ref = String(bookingRef || "").trim();
  if (!ref) return;
  try {
    await fetch("/api/bookings/advance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingRef: ref }),
    });
  } catch {
    /* non-blocking */
  }
}
