/**
 * Ops CRM activity log helpers (booking_logs + ops_hub last-action fields).
 */

import type PocketBase from "pocketbase";

export type BookingLogAction =
  | "opened"
  | "guide_assigned"
  | "payment_sent"
  | "tickets_booked"
  | "note_added"
  | "status_changed"
  | "guest_update"
  | "claimed_via_chat";

export type BookingLogRow = {
  id: string;
  pnr: string;
  ops_hub_id?: string;
  staff_id?: string;
  staff_name?: string;
  action_type: BookingLogAction | string;
  details?: string;
  created?: string;
  updated?: string;
};

export async function appendBookingLog(
  pb: PocketBase,
  input: {
    pnr: string;
    opsHubId?: string | null;
    staffId?: string | null;
    staffName?: string | null;
    actionType: BookingLogAction;
    details?: string | null;
  }
): Promise<BookingLogRow | null> {
  const pnr = String(input.pnr || "")
    .trim()
    .toUpperCase()
    .replace(/"/g, "");
  if (!pnr) return null;
  try {
    const created = await pb.collection("booking_logs").create(
      {
        pnr,
        ops_hub_id: String(input.opsHubId || "").trim() || "",
        staff_id: String(input.staffId || "").trim() || "",
        staff_name: String(input.staffName || "").trim() || "",
        action_type: input.actionType,
        details: String(input.details || "").trim().slice(0, 2000),
      },
      { requestKey: null }
    );
    return created as unknown as BookingLogRow;
  } catch (err) {
    console.warn("[booking_logs]", err);
    return null;
  }
}

export async function loadBookingLogsForPnr(
  pb: PocketBase,
  pnr: string
): Promise<BookingLogRow[]> {
  const ref = String(pnr || "")
    .trim()
    .toUpperCase()
    .replace(/"/g, "");
  if (!ref) return [];
  try {
    return await pb.collection("booking_logs").getFullList<BookingLogRow>({
      filter: `pnr="${ref}"`,
      sort: "-created",
      requestKey: null,
    });
  } catch {
    return [];
  }
}

/** Relative time for rapid scanning ("2 hours ago", "Yesterday at 14:00"). */
export function formatRelativeLogTime(iso?: string | null): string {
  const raw = String(iso || "").trim();
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;

  const now = new Date();
  const abs = Math.abs(now.getTime() - d.getTime());
  const mins = Math.round(abs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startThat = new Date(d);
  startThat.setHours(0, 0, 0, 0);
  const dayDiff = Math.round(
    (startToday.getTime() - startThat.getTime()) / 86400000
  );
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (dayDiff === 1) return `Yesterday at ${hh}:${mm}`;
  if (dayDiff < 7) return `${dayDiff} days ago · ${hh}:${mm}`;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${hh}:${mm}`;
}

export function bookingLogActionLabel(action: string): string {
  return String(action || "note")
    .replace(/_/g, " ")
    .toUpperCase();
}

export function bookingLogActionStyle(action: string): string {
  switch (String(action || "").toLowerCase()) {
    case "opened":
      return "border-sky-500/30 bg-sky-500/15 text-sky-300";
    case "guide_assigned":
      return "border-violet-500/30 bg-violet-500/15 text-violet-300";
    case "payment_sent":
      return "border-emerald-500/30 bg-emerald-500/15 text-emerald-300";
    case "tickets_booked":
      return "border-amber-500/30 bg-amber-500/15 text-amber-300";
    case "note_added":
      return "border-[#F6A724]/30 bg-[#F6A724]/10 text-[#F6A724]";
    case "status_changed":
      return "border-cyan-500/30 bg-cyan-500/15 text-cyan-300";
    case "guest_update":
      return "border-rose-500/30 bg-rose-500/15 text-rose-300";
    default:
      return "border-zinc-600 bg-zinc-800 text-zinc-300";
  }
}

/** YYYY-MM-DD for PocketBase date fields. */
export function isoDateOnly(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Trip is post-tour when end_date (or tour_date fallback) is before today.
 */
export function isPostTourBooking(row: {
  end_date?: string | null;
  tour_date?: string | null;
  status?: string | null;
}): boolean {
  const status = String(row.status || "")
    .trim()
    .toLowerCase();
  if (status === "cancelled") return false;
  const raw = String(row.end_date || row.tour_date || "")
    .trim()
    .slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const end = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(end.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  return endDay.getTime() < today.getTime();
}

export function addDaysIso(iso: string, days: number): string {
  const base = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) return "";
  const d = new Date(`${base}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + Math.max(0, Math.round(days) || 0));
  return isoDateOnly(d);
}
