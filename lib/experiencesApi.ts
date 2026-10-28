/**
 * Builder E attractions catalog — ticketed / VIP / time-sensitive only.
 * Multi-Day guided city tours stay out of this storefront.
 */

import type { SubServiceItem } from "@/components/builder-e/subServices";
import {
  accessTypeGuestBadge,
  accessTypeNeedsTicketer,
  experienceNeedsEntryTicket,
} from "@/lib/accessType";
import {
  fetchExperiencesAndPlaces,
  getPocketBase,
  mapEapToTour,
  pbFileUrl,
  tourPhoto,
  type PbCity,
  type PbTour,
} from "@/lib/pocketbase/client";

/** PocketBase filter matching ticket / VIP / timed access types. */
export const BUILDER_E_ATTRACTIONS_PB_FILTER =
  "(access_type = 'direct_ticket' || access_type = 'admission' || access_type = 'vip_event' || access_type = 'time_sensitive') && is_active != false";

const CITY_TOUR_TITLE =
  /\bcity\s*tour\b|\bprivate\s+city\b|\b\d+\s*h\s*(guided\s+)?tour\b/i;

export function isGenericCityTour(tour: Pick<PbTour, "title" | "access_type" | "category">): boolean {
  const access = String(tour.access_type || "").toLowerCase();
  if (access === "guided_route") return true;
  const cat = String(tour.category || "").toLowerCase();
  if (cat === "tour" && !accessTypeNeedsTicketer(tour.access_type)) return true;
  return CITY_TOUR_TITLE.test(tour.title || "");
}

export function isBuilderETicketedAttraction(
  tour: Pick<
    PbTour,
    | "title"
    | "description"
    | "access_type"
    | "is_self_guided"
    | "category"
    | "entry_type"
  >
): boolean {
  if (isGenericCityTour(tour)) return false;
  // Landmark-only places without ticket signals stay in Multi-Day / Builder S
  const entry = String(tour.entry_type || "").toLowerCase();
  if (entry === "place" && !experienceNeedsEntryTicket(tour)) return false;
  return experienceNeedsEntryTicket(tour);
}

export function tourRequiresTicketBadge(tour: Pick<PbTour, "access_type" | "title" | "description" | "is_self_guided">): boolean {
  return (
    accessTypeNeedsTicketer(tour.access_type) ||
    experienceNeedsEntryTicket(tour)
  );
}

/**
 * Ticketed / VIP / time-sensitive experiences for Builder E.
 * Excludes guided city tours and non-ticketed places.
 */
export async function getBuilderEAttractions(
  cities: PbCity[] = []
): Promise<PbTour[]> {
  const pb = getPocketBase();

  const [ticketedTours, eap] = await Promise.all([
    pb
      .collection("tours")
      .getFullList<PbTour>({
        filter: BUILDER_E_ATTRACTIONS_PB_FILTER,
        sort: "title",
        expand: "city_id",
      })
      .catch(async () => {
        // Fallback when access_type filter unavailable — fetch active and filter client-side
        const all = await pb
          .collection("tours")
          .getFullList<PbTour>({
            filter: "is_active != false",
            sort: "title",
            expand: "city_id",
          })
          .catch(() => [] as PbTour[]);
        return all.filter(isBuilderETicketedAttraction);
      }),
    fetchExperiencesAndPlaces(),
  ]);

  const fromEap = eap
    .map((r) => mapEapToTour(r, cities))
    .filter(isBuilderETicketedAttraction);

  const seen = new Set(ticketedTours.map((t) => t.id));
  const merged = [
    ...ticketedTours.filter((t) => !isGenericCityTour(t)),
    ...fromEap.filter((r) => !seen.has(r.id)),
  ];

  return merged.filter((t) => t.is_active !== false);
}

function attractionThumbUrl(tour: PbTour): string {
  const raw = tourPhoto(tour);
  if (!raw) return "";
  if (raw.startsWith("http") || raw.startsWith("/")) return raw;
  return (
    pbFileUrl(tour.collectionId || "tours", tour.id, raw, {
      thumb: "400x300",
      format: "webp",
    }) || raw
  );
}

/** Map a PocketBase ticketed tour into Builder E VIP Concierge card shape. */
export function mapTourToVipSubService(tour: PbTour): SubServiceItem {
  const city = (tour.expand?.city_id?.name || "").trim();
  const duration = tour.duration_hours ? `${tour.duration_hours}h` : undefined;
  const requiresTicket = tourRequiresTicketBadge(tour);
  const accessBadge = accessTypeGuestBadge(tour.access_type);
  return {
    id: tour.id,
    category: "EXPERIENCE",
    title: tour.title,
    icon: "🎟️",
    heroMediaUrl: attractionThumbUrl(tour),
    description: (tour.description || "").trim() || city || "VIP experience",
    duration,
    badgeTag: requiresTicket ? accessBadge || "Ticketed" : "Concierge",
    requiresTicket,
    tourId: tour.id,
    access_type: tour.access_type || "",
  };
}
