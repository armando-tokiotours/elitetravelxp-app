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
};

export const ADDITIONAL_VIP_SERVICES: SubServiceItem[] = [
  // 1. HARD-TO-GET TICKETS
  {
    id: "ghibli_vip",
    category: "EXPERIENCE",
    title: "Ghibli Museum Pass",
    icon: "🍃",
    heroMediaUrl: "/images/services/ghibli.jpg",
    description:
      "Hard-to-get official Ghibli Museum entry tickets with guaranteed date reservation.",
    requiresTicket: true,
  },
  {
    id: "sumo_box",
    category: "EXPERIENCE",
    title: "Sumo Grand Tournament Box",
    icon: "🥋",
    heroMediaUrl: "/images/services/sumo.jpg",
    description:
      "Front-row box seat reservations for official Grand Sumo Tournaments in Tokyo/Osaka.",
    requiresTicket: true,
  },
  {
    id: "usj_express",
    category: "EXPERIENCE",
    title: "USJ Express Pass",
    icon: "🎢",
    heroMediaUrl: "/images/services/usj.jpg",
    description:
      "Universal Studios Japan Express Pass timed entry for Super Nintendo World.",
    requiresTicket: true,
  },
  // 2. JAPANESE PHONE & LOCAL VERIFICATION SERVICES
  {
    id: "michelin_omakase",
    category: "EXPERIENCE",
    title: "Michelin / Exclusive Omakase",
    icon: "🍣",
    heroMediaUrl: "/images/services/sushi.jpg",
    description:
      "Local Japanese concierge booking for high-end sushi and Michelin dining strictly requiring local phone verification.",
    requiresTicket: false,
  },
  {
    id: "event_verification",
    category: "EXPERIENCE",
    title: "Concert & SMS Event Pass",
    icon: "🎟️",
    heroMediaUrl: "/images/services/concert.jpg",
    description:
      "Domestic SMS verification and local Japanese number reservation service for pop-culture events and concerts.",
    requiresTicket: false,
  },
  // 3. SPECIALIZED STANDALONE EXPERIENCES
  {
    id: "geisha_dinner",
    category: "EXPERIENCE",
    title: "Private Geisha Dinner",
    icon: "🍵",
    heroMediaUrl: "/images/services/geisha.jpg",
    description:
      "Exclusive private Kyoto Ozashiki dining experience with authentic Geisha performance.",
    requiresTicket: false,
  },
];

export const SUB_SERVICES: SubServiceItem[] = [
  // CHAUFFEUR
  {
    id: "pickup",
    category: "DRIVER",
    title: "Airport Pickup",
    icon: "🛫",
    heroMediaUrl: "/brand/widgets/transport-private.jpg",
    galleryUrls: [
      "/brand/widgets/transport-private.jpg",
      "/brand/hero-single-day.jpg",
      "/brand/widgets/hotel-tokiotours.jpg",
    ],
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
    heroMediaUrl: "/brand/widgets/hotel-tokiotours.jpg",
    galleryUrls: [
      "/brand/widgets/hotel-tokiotours.jpg",
      "/brand/widgets/transport-private.jpg",
    ],
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
    heroMediaUrl: "/brand/hero-japan-pagoda.jpg",
    galleryUrls: [
      "/brand/hero-japan-pagoda.jpg",
      "/brand/widgets/transport-private.jpg",
      "/brand/hero-background.jpg",
    ],
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
    heroMediaUrl: "/brand/hero-single-day.jpg",
    galleryUrls: [
      "/brand/hero-single-day.jpg",
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
    heroMediaUrl: "/brand/hero-background.jpg",
    galleryUrls: [
      "/brand/hero-background.jpg",
      "/brand/hero-japan-pagoda.jpg",
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
      "/brand/hero-single-day.jpg",
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
    heroMediaUrl: "/brand/widgets/transport-public.jpg",
    galleryUrls: ["/brand/widgets/transport-public.jpg"],
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
    heroMediaUrl: "/brand/widgets/transport-self.jpg",
    galleryUrls: [
      "/brand/widgets/transport-self.jpg",
      "/brand/hero-japan-pagoda.jpg",
    ],
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
    heroMediaUrl: "/brand/trip-multi-thumb.webp",
    galleryUrls: [
      "/brand/trip-multi-thumb.webp",
      "/brand/widgets/transport-public.jpg",
    ],
    description: "Unlimited rail travel pass across all JR network lines.",
    badgeTag: "JR PASS",
    included: ["Exchange / activation help", "Delivery options"],
  },
  ...ADDITIONAL_VIP_SERVICES,
];

export function subServicesByCategory(category: BuilderEServiceCategory) {
  return SUB_SERVICES.filter((s) => s.category === category);
}
