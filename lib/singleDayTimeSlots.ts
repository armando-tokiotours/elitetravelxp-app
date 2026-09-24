/**
 * Builder S — auto-calculate stop time slots from day start + durations.
 */

export type TimedRouteItem<T> = T & {
  stopNumber: number;
  startTime: string;
  endTime: string;
  timeSlot: string;
};

function parseStart(startTimeStr: string): { hours: number; minutes: number } {
  const raw = String(startTimeStr || "09:00").trim();
  const [h, m] = raw.split(":").map((p) => Number(p));
  return {
    hours: Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 9,
    minutes: Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0,
  };
}

function formatHm(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Advance a clock by durationHours; returns end HH:mm and next clock. */
export function advanceClock(
  hours: number,
  minutes: number,
  durationHours: number
): { endHours: number; endMins: number; endFormatted: string } {
  const durationMinutes = Math.max(
    0,
    Math.round((Number(durationHours) || 0) * 60)
  );
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMins = totalMinutes % 60;
  return {
    endHours,
    endMins,
    endFormatted: formatHm(endHours, endMins),
  };
}

/**
 * Map ordered experiences to live time windows from the tour start time.
 * Example: 09:00 start + 2h → "09:00 – 11:00", next starts 11:00 (+ optional buffer).
 */
export function calculateTimeSlots<
  T extends { duration_hours?: number | null },
>(
  startTimeStr: string,
  items: T[],
  opts?: { bufferMinutes?: number }
): TimedRouteItem<T>[] {
  let { hours, minutes } = parseStart(startTimeStr);
  const buffer = Math.max(0, Math.round(opts?.bufferMinutes ?? 0));

  return items.map((item, index) => {
    const startFormatted = formatHm(hours, minutes);
    const { endHours, endMins, endFormatted } = advanceClock(
      hours,
      minutes,
      Number(item.duration_hours) || 0
    );

    hours = endHours;
    minutes = endMins;

    if (buffer > 0 && index < items.length - 1) {
      const advanced = advanceClock(hours, minutes, buffer / 60);
      hours = advanced.endHours;
      minutes = advanced.endMins;
    }

    return {
      ...item,
      stopNumber: index + 1,
      startTime: startFormatted,
      endTime: endFormatted,
      timeSlot: `${startFormatted} – ${endFormatted}`,
    };
  });
}

/** End-of-day clock after all stops (HH:mm). */
export function calculateDayEndTime(
  startTimeStr: string,
  items: Array<{ duration_hours?: number | null }>,
  opts?: { bufferMinutes?: number }
): string {
  const slots = calculateTimeSlots(startTimeStr, items, opts);
  if (slots.length === 0) {
    const s = parseStart(startTimeStr);
    return formatHm(s.hours, s.minutes);
  }
  return slots[slots.length - 1].endTime;
}

/** Format "09:00" → "09:00 AM", "13:30" → "01:30 PM". */
export function formatClock12h(hhmm: string): string {
  const { hours, minutes } = parseStart(hhmm);
  const period = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
}
