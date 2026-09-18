import {
  pbFileUrl,
  tourMediaFile,
  tourMediaType,
  tourPhoto,
  type PbTour,
} from "@/lib/pocketbase/client";
import { resolveTourTags } from "@/types/experience";
import {
  isBestMatchTour,
  rankToursByProfile,
  type ExperienceProfile,
} from "@/lib/experienceProfiler";

export const MATCH_REEL_SLIDE_MS = 3500;

export interface MatchReelSlide {
  id: string;
  title: string;
  description: string;
  cityName: string;
  durationHours: number;
  videoUrl?: string;
  imageUrl: string;
  vibeTags: string[];
  paceTag: string;
  isNiche: boolean;
}

const VIBE_EMOJI: Record<string, string> = {
  culture: "🏯",
  foodie: "🍷",
  modern: "✨",
  nature: "🌿",
};

const PACE_EMOJI: Record<string, string> = {
  relaxed: "🌿",
  standard: "⏱",
  active: "⚡",
};

export function vibeBadgeLabel(vibe: string): string {
  const e = VIBE_EMOJI[vibe] ?? "⭐";
  return `${e} ${vibe.charAt(0).toUpperCase()}${vibe.slice(1)}`;
}

export function paceBadgeLabel(pace: string): string {
  const e = PACE_EMOJI[pace] ?? "⏱";
  const label =
    pace === "standard"
      ? "Balanced Pace"
      : `${pace.charAt(0).toUpperCase()}${pace.slice(1)} Pace`;
  return `${e} ${label}`;
}

function tourImageUrl(tour: PbTour): string {
  const thumb = tourPhoto(tour);
  if (thumb && tour.collectionId) {
    return pbFileUrl(tour.collectionId, tour.id, thumb, "800x1200");
  }
  const media = tourMediaFile(tour);
  if (media && tour.collectionId && tourMediaType(tour) !== "Video") {
    return pbFileUrl(tour.collectionId, tour.id, media, "800x1200");
  }
  return "/images/matcher-poster.webp";
}

function tourVideoUrl(tour: PbTour): string | undefined {
  if (tourMediaType(tour) !== "Video") return undefined;
  const media = tourMediaFile(tour);
  if (!media || !tour.collectionId) return undefined;
  return pbFileUrl(tour.collectionId, tour.id, media);
}

export function tourToMatchReelSlide(
  tour: PbTour,
  cityName: string
): MatchReelSlide {
  const tags = resolveTourTags(tour);
  return {
    id: tour.id,
    title: tour.title,
    description: (tour.description || "").trim(),
    cityName,
    durationHours: Number(tour.duration_hours) || 0,
    videoUrl: tourVideoUrl(tour),
    imageUrl: tourImageUrl(tour),
    vibeTags: tags.vibeTags,
    paceTag: tags.paceTag,
    isNiche: tags.isNiche,
  };
}

/**
 * Prefer booked/selected tours (live itinerary), then vibe matches, then city tours.
 * Keeps the reel accurate as guests add/remove activities.
 */
export function buildMatchReelSlides(opts: {
  cityTours: PbTour[];
  cityName: string;
  profile: ExperienceProfile | null | undefined;
  bookedTourIds?: string[];
  limit?: number;
}): MatchReelSlide[] {
  const limit = opts.limit ?? 8;
  const { cityTours, cityName, profile, bookedTourIds = [] } = opts;
  const active = cityTours.filter((t) => t.is_active !== false);
  const byId = new Map(active.map((t) => [t.id, t]));

  let pool: PbTour[] = [];

  if (bookedTourIds.length > 0) {
    pool = bookedTourIds
      .map((id) => byId.get(id))
      .filter((t): t is PbTour => Boolean(t));
  }

  if (pool.length === 0 && profile) {
    pool = active.filter((t) => isBestMatchTour(t, profile));
    if (pool.length === 0) {
      pool = rankToursByProfile(active, profile).slice(0, limit);
    }
  }

  if (pool.length === 0) {
    pool = active.slice(0, limit);
  }

  return pool.slice(0, limit).map((t) => tourToMatchReelSlide(t, cityName));
}

/** Multi-city reel from the full trip selection (+ matched fallback). */
export function buildTripMatchReelSlides(opts: {
  tours: PbTour[];
  cityNames: Record<string, string>;
  selectedTourIds: string[];
  profile: ExperienceProfile | null | undefined;
  stayCityIds?: string[];
  limit?: number;
}): MatchReelSlide[] {
  const limit = opts.limit ?? 10;
  const active = opts.tours.filter((t) => t.is_active !== false);
  const byId = new Map(active.map((t) => [t.id, t]));
  const nameOf = (cityId: string) => opts.cityNames[cityId] ?? "City";

  if (opts.selectedTourIds.length > 0) {
    return opts.selectedTourIds
      .map((id) => byId.get(id))
      .filter((t): t is PbTour => Boolean(t))
      .slice(0, limit)
      .map((t) => tourToMatchReelSlide(t, nameOf(t.city_id)));
  }

  const stay =
    opts.stayCityIds && opts.stayCityIds.length > 0
      ? new Set(opts.stayCityIds)
      : null;
  const scoped = stay
    ? active.filter((t) => stay.has(t.city_id))
    : active;

  if (opts.profile) {
    const matched = scoped.filter((t) => isBestMatchTour(t, opts.profile));
    const ranked =
      matched.length > 0
        ? matched
        : rankToursByProfile(scoped, opts.profile);
    return ranked
      .slice(0, limit)
      .map((t) => tourToMatchReelSlide(t, nameOf(t.city_id)));
  }

  return scoped
    .slice(0, limit)
    .map((t) => tourToMatchReelSlide(t, nameOf(t.city_id)));
}
