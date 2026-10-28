/**
 * When guests add Experiences & Tickets (extras outside guide hours),
 * they choose when they want the activity. Ops/ticketer get an internal note.
 */

export type ExperienceTimingIntent =
  | "during_tour"
  | "after_tour"
  | "other_day";

export const EXPERIENCE_TIMING_OPTIONS: Array<{
  id: ExperienceTimingIntent;
  label: string;
  hint: string;
}> = [
  {
    id: "during_tour",
    label: "During the tour",
    hint: "Same day · slot after tickets are purchased",
  },
  {
    id: "after_tour",
    label: "After the tour",
    hint: "Same day · once the guided tour ends",
  },
  {
    id: "other_day",
    label: "Another day",
    hint: "Pick the date Ticketer should buy for",
  },
];

export function formatExperienceTimingLabel(
  intent: ExperienceTimingIntent | null | undefined
): string {
  switch (intent) {
    case "during_tour":
      return "During tour";
    case "after_tour":
      return "After tour";
    case "other_day":
      return "Other day";
    default:
      return "";
  }
}

/** Internal note for Ops / Ticketer desk. */
export function formatExperienceTimingOpsNote(opts: {
  title: string;
  timingIntent: ExperienceTimingIntent;
  ticketDate?: string | null;
  tourDate?: string | null;
}): string {
  const title = String(opts.title || "Experience").trim() || "Experience";
  const tourDay = opts.tourDate ? String(opts.tourDate).slice(0, 10) : null;
  const ticketDay = opts.ticketDate
    ? String(opts.ticketDate).slice(0, 10)
    : null;

  switch (opts.timingIntent) {
    case "during_tour":
      return `${title} · DURING TOUR${
        tourDay ? ` (${tourDay})` : ""
      } · time TBD after purchase`;
    case "after_tour":
      return `${title} · AFTER TOUR${
        tourDay ? ` (${tourDay})` : ""
      } · same day post-guide`;
    case "other_day":
      return `${title} · OTHER DAY · ticket date ${
        ticketDay || "TBD — guest must confirm"
      }`;
    default:
      return title;
  }
}

export function experienceTimingNeedsTicketDate(
  intent: ExperienceTimingIntent | null | undefined
): boolean {
  return intent === "other_day";
}
