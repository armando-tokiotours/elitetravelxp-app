/**
 * Builder E sub-services — iOS squircle catalog.
 */

export type BuilderEServiceCategory = "DRIVER" | "EXPERIENCE" | "TRANSIT";

export type SubServiceItem = {
  id: string;
  category: BuilderEServiceCategory;
  title: string;
  icon: string;
  /** Photo/video hero for the media modal */
  heroMediaUrl: string;
  /** Extra gallery slides (optional) */
  galleryUrls?: string[];
  description: string;
  duration?: string;
  badgeTag?: string;
  included?: string[];
  routeHint?: string;
  requiresTicket?: boolean;
  /** PocketBase `tours.id` when sourced from catalog */
  tourId?: string;
  /**
   * Attached catalog-slot ID for this card's OWN picture:
   * `/uploads/catalog/{catalogId}_1.webp` (see lib/catalogMedia).
   * Static items with no PocketBase record use their stable static
   * `id` as the slot key — the slot then holds either their own
   * uploaded photo or the auto-placeholder stamped with that ID.
   * BuilderEServiceGrid may override this with a real
   * `transport_products` record ID when one matches (e.g. Suica).
   */
  catalogId?: string;
  access_type?: string;
};

export const SUB_SERVICES: SubServiceItem[] = [
  // CHAUFFEUR
  {
    id: "pickup",
    category: "DRIVER",
    title: "Airport Pickup",
    icon: "🛫",
    catalogId: "pickup",
    heroMediaUrl: "/uploads/catalog/pickup_1.webp",
    galleryUrls: ["/uploads/catalog/pickup_1.webp"],
    description:
      "Meet & greet at arrivals, luggage assistance & private hotel transfer.",
    badgeTag: "CHAUFFEUR",
    included: ["Meet & greet", "Luggage assist", "Private vehicle"],
    routeHint: "Narita / Haneda → Hotel",
  },
  {
    id: "dropoff",
    category: "DRIVER",
    title: "Airport Drop-off",
    icon: "🛬",
    catalogId: "dropoff",
    heroMediaUrl: "/uploads/catalog/dropoff_1.webp",
    galleryUrls: ["/uploads/catalog/dropoff_1.webp"],
    description:
      "Hotel pickup directly to Narita or Haneda departure terminal.",
    badgeTag: "CHAUFFEUR",
    included: ["Hotel pickup", "Flight-timed departure", "Private vehicle"],
    routeHint: "Hotel → Narita / Haneda",
  },
  {
    id: "intercity",
    category: "DRIVER",
    title: "Inter-City Transfer",
    icon: "🛣️",
    catalogId: "intercity",
    heroMediaUrl: "/uploads/catalog/intercity_1.webp",
    galleryUrls: ["/uploads/catalog/intercity_1.webp"],
    description:
      "Private highway chauffeur transfer between Tokyo, Fuji, Kyoto, or Osaka.",
    badgeTag: "INTER-CITY",
    duration: "2–6h",
    included: ["Highway tolls option", "Child seats on request", "HiAce / Alphard"],
    routeHint: "Tokyo ↔ Fuji / Kyoto / Osaka",
  },

  // EXPERIENCES
  {
    id: "bicycle",
    category: "EXPERIENCE",
    title: "Bicycle Tour",
    icon: "🚲",
    heroMediaUrl: "",
    galleryUrls: [
      "",
      "/brand/icons/bike.png",
      "/brand/trip-single-thumb.webp",
    ],
    description:
      "Backstreet exploration of Tokyo history & culinary stops.",
    duration: "6h",
    badgeTag: "MULTI-DISTRICT TOUR",
    included: ["Bike rental", "Guide", "Snack stop"],
    routeHint: "Multi-district Tokyo loop",
  },
  {
    id: "teamlab",
    category: "EXPERIENCE",
    title: "teamLab Planets",
    icon: "✨",
    heroMediaUrl: "",
    galleryUrls: [
      "",
      "",
    ],
    description:
      "Immersive digital art exhibition entry pass & reserved time slot.",
    badgeTag: "TICKET",
    duration: "2–3h",
    included: ["Timed entry", "Ticket issuance", "Passport name check"],
  },
  {
    id: "disney",
    category: "EXPERIENCE",
    title: "Tokyo Disney / Sea",
    icon: "🏰",
    heroMediaUrl: "/brand/trip-multi-thumb.webp",
    galleryUrls: [
      "/brand/trip-multi-thumb.webp",
      "",
    ],
    description:
      "1-Day passport tickets with direct transfer add-on options.",
    badgeTag: "THEME PARK",
    duration: "Full day",
    included: ["1-Day passport", "Optional hotel transfer"],
  },

  // TRANSIT
  {
    id: "suica",
    category: "TRANSIT",
    title: "Suica IC Card",
    icon: "💳",
    catalogId: "suica",
    heroMediaUrl: "/uploads/catalog/suica_1.webp",
    galleryUrls: ["/uploads/catalog/suica_1.webp"],
    description:
      "Pre-loaded contactless tap pass for Tokyo metro & convenience stores.",
    badgeTag: "IC CARD",
    included: ["Physical or digital help", "Hotel / airport delivery"],
  },
  {
    id: "bullet_train",
    category: "TRANSIT",
    title: "Bullet Train",
    icon: "🚅",
    catalogId: "bullet_train",
    heroMediaUrl: "/uploads/catalog/bullet_train_1.webp",
    galleryUrls: ["/uploads/catalog/bullet_train_1.webp"],
    description:
      "Reserved seat tickets for Tokaido Shinkansen (Tokyo → Kyoto/Osaka).",
    badgeTag: "SHINKANSEN",
    included: ["Reserved seats", "QR or paper ticket"],
    routeHint: "Tokyo → Kyoto / Osaka",
  },
  {
    id: "jr_pass",
    category: "TRANSIT",
    title: "JR Whole Japan Pass",
    icon: "🎫",
    catalogId: "jr_pass",
    heroMediaUrl: "/uploads/catalog/jr_pass_1.webp",
    galleryUrls: ["/uploads/catalog/jr_pass_1.webp"],
    description: "Unlimited rail travel pass across all JR network lines.",
    badgeTag: "JR PASS",
    included: ["Exchange / activation help", "Delivery options"],
  },
];

export function subServicesByCategory(category: BuilderEServiceCategory) {
  return SUB_SERVICES.filter((s) => s.category === category);
}
