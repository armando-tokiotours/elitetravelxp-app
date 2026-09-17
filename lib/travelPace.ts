import type { TravelPace } from "@/store/useBuilderStore";

export type PaceId = Exclude<TravelPace, null>;

export const TRAVEL_PACES: {
  id: PaceId;
  label: string;
  tagline: string;
  description: string;
  detail: string;
  image: string;
}[] = [
  {
    id: "fast",
    label: "Fast",
    tagline: "See more, linger less",
    description:
      "Packed days with multiple highlights. Ideal if this is a first visit and you want maximum coverage.",
    detail:
      "Expect earlier starts, efficient transfers between cities, and fuller daily schedules. Best for energetic travelers who prefer momentum over downtime.",
    image: "/photo/pace-fast.jpg",
  },
  {
    id: "moderate",
    label: "Moderate",
    tagline: "Balanced discovery",
    description:
      "A classic rhythm — signature experiences with room to breathe between them.",
    detail:
      "One primary focus per day with optional add-ons. Comfortable pacing for couples and families who want culture and rest in equal measure.",
    image: "/photo/pace-moderate.jpg",
  },
  {
    id: "relaxed",
    label: "Relaxed",
    tagline: "Slow luxury",
    description:
      "Fewer moves, deeper stays. Space for spa mornings, long lunches, and unhurried evenings.",
    detail:
      "Longer city stays and lighter daily agendas. Perfect when the journey itself is the destination and recovery matters as much as sightseeing.",
    image: "/photo/pace-relaxed.jpg",
  },
];

export function travelPaceLabel(pace: TravelPace): string | null {
  if (!pace) return null;
  return TRAVEL_PACES.find((p) => p.id === pace)?.label ?? null;
}
