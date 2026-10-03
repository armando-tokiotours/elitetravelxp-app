import {
  INTERESTS,
  MOTIVATIONS,
  PAIN_POINTS,
  TRAVEL_STYLES,
} from "@/lib/preEliteBuilder";
import { BRAND_LOGO_ICON } from "@/lib/brand";

export const STORY_SLIDE_MS = 4200;

export interface StorySlide {
  id: string;
  title: string;
  caption: string;
  /** Public path under `/brand`, `/images`, … — empty = plain grey card */
  imageUrl: string;
  videoUrl?: string;
}

export interface StoryExplanation {
  optionId: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  avatarUrl: string;
  slides: StorySlide[];
}

/** Small header chrome only — never used as slide fill. */
const LOGO = BRAND_LOGO_ICON;
/** Empty slide media → StoryExplanationModal paints a plain grey card. */
const EMPTY = "";

const STORIES: Record<string, StoryExplanation> = {
  classic_explorer: {
    optionId: "classic_explorer",
    title: "Classic Explorer",
    subtitle: "Classic Explorer · Guide & Local Transit",
    ctaLabel: "Select This Style →",
    avatarUrl: LOGO,
    slides: [
      {
        id: "ce-1",
        title: "Private guide, local rhythm",
        caption:
          "Walk Kyoto lanes and ride the same rail lines locals use — with a host who handles every transfer.",
        imageUrl: EMPTY,
      },
      {
        id: "ce-2",
        title: "Authentic immersion",
        caption:
          "Shrines, neighborhoods, and quiet side streets without a luxury car between you and the city.",
        imageUrl: EMPTY,
      },
      {
        id: "ce-3",
        title: "Best-value comfort",
        caption:
          "Private guiding and clear logistics — you keep the cultural depth without the chauffeur premium.",
        imageUrl: EMPTY,
      },
    ],
  },
  premium_comfort: {
    optionId: "premium_comfort",
    title: "Premium Comfort",
    subtitle: "Premium Comfort · Driver & Vehicle Preview",
    ctaLabel: "Select This Style →",
    avatarUrl: LOGO,
    slides: [
      {
        id: "pc-1",
        title: "Dedicated luxury vehicle",
        caption:
          "Your private guide arrives with a chauffeur-ready vehicle — door-to-door, no station transfers.",
        imageUrl: EMPTY,
      },
      {
        id: "pc-2",
        title: "Seamless day logistics",
        caption:
          "Hotel pickup, temple drop-offs, and flexible waits while you explore — the day stays effortless.",
        imageUrl: EMPTY,
      },
      {
        id: "pc-3",
        title: "Guide + driver as a unit",
        caption:
          "One private host, one dedicated car. The most popular balance of comfort and immersion.",
        imageUrl: EMPTY,
      },
    ],
  },
  vip_bespoke: {
    optionId: "vip_bespoke",
    title: "VIP Bespoke",
    subtitle: "VIP Bespoke · Exclusive Access Preview",
    ctaLabel: "Select This Style →",
    avatarUrl: LOGO,
    slides: [
      {
        id: "vip-1",
        title: "Complete VIP access",
        caption:
          "Luxury chauffeur, priority entry, and discreet hosting from the first arrival to the last dinner.",
        imageUrl: EMPTY,
      },
      {
        id: "vip-2",
        title: "Private dining & exclusives",
        caption:
          "High-end private dining rooms and hard-to-book experiences arranged around your preferences.",
        imageUrl: EMPTY,
      },
      {
        id: "vip-3",
        title: "Zero friction days",
        caption:
          "Every transfer, reservation, and entry is handled — you only decide how the evening should feel.",
        imageUrl: EMPTY,
      },
    ],
  },
  culture_heritage: {
    optionId: "culture_heritage",
    title: "Culture & Heritage",
    subtitle: "Culture & Heritage · What This Looks Like",
    ctaLabel: "Select This Interest →",
    avatarUrl: LOGO,
    slides: [
      {
        id: "ch-1",
        title: "Shrines & historic districts",
        caption:
          "Guided time in temples, tea rooms, and heritage streets — with context, not just photo stops.",
        imageUrl: EMPTY,
      },
      {
        id: "ch-2",
        title: "Living traditions",
        caption:
          "Tea ceremonies, sumo culture, and etiquette cues your host explains in the moment.",
        imageUrl: EMPTY,
      },
      {
        id: "ch-3",
        title: "Respectful pacing",
        caption:
          "Enough time at each site to feel the place — not a checklist dash.",
        imageUrl: EMPTY,
      },
    ],
  },
  food_culinary: {
    optionId: "food_culinary",
    title: "Food & Culinary",
    subtitle: "Food & Culinary · Dining Preview",
    ctaLabel: "Select This Interest →",
    avatarUrl: LOGO,
    slides: [
      {
        id: "fc-1",
        title: "Hidden izakayas",
        caption:
          "Neighborhood counters and off-menu tables most visitors never find without a local host.",
        imageUrl: EMPTY,
      },
      {
        id: "fc-2",
        title: "From street to Michelin",
        caption:
          "Street food walks, sake tasting, and reserved fine dining when you want the full spectrum.",
        imageUrl: EMPTY,
      },
      {
        id: "fc-3",
        title: "Host-led reservations",
        caption:
          "We handle the hard-to-book tables so you can focus on the meal.",
        imageUrl: EMPTY,
      },
    ],
  },
  modern_pop: {
    optionId: "modern_pop",
    title: "Modern & Pop Culture",
    subtitle: "Modern & Pop Culture · City Pulse Preview",
    ctaLabel: "Select This Interest →",
    avatarUrl: LOGO,
    slides: [
      {
        id: "mp-1",
        title: "Anime, tech & nightlife",
        caption:
          "Neon districts, flagship shopping, and late-evening energy with a host who knows the rhythm.",
        imageUrl: EMPTY,
      },
      {
        id: "mp-2",
        title: "Street photography moments",
        caption:
          "Vibrant corners timed for light and crowd flow — built for the shots you actually want.",
        imageUrl: EMPTY,
      },
      {
        id: "mp-3",
        title: "Night energy, day clarity",
        caption:
          "Daytime culture blocks paired with evenings that match your pace.",
        imageUrl: EMPTY,
      },
    ],
  },
  nature_day_trips: {
    optionId: "nature_day_trips",
    title: "Nature & Day Trips",
    subtitle: "Nature & Day Trips · Escape Preview",
    ctaLabel: "Select This Interest →",
    avatarUrl: LOGO,
    slides: [
      {
        id: "nd-1",
        title: "Mt. Fuji & Hakone",
        caption:
          "Iconic horizons, onsen towns, and coastal air — planned so the day never feels rushed.",
        imageUrl: EMPTY,
      },
      {
        id: "nd-2",
        title: "Kamakura & quiet coasts",
        caption:
          "Hidden villages and shoreline walks beyond the standard tourist loop.",
        imageUrl: EMPTY,
      },
      {
        id: "nd-3",
        title: "Return rested",
        caption:
          "Day trips timed so you are back for dinner without feeling drained.",
        imageUrl: EMPTY,
      },
    ],
  },
  family: {
    optionId: "family",
    title: "Family Vacation",
    subtitle: "Family Vacation · Shared Memories Preview",
    ctaLabel: "Select This Motivation →",
    avatarUrl: LOGO,
    slides: [
      {
        id: "fam-1",
        title: "Built for every age",
        caption:
          "Pacing, hotel logistics, and experiences that work for kids and adults on the same day.",
        imageUrl: EMPTY,
      },
      {
        id: "fam-2",
        title: "Memories without the stress",
        caption:
          "We handle transfers and queues so the family stays present for the moments that matter.",
        imageUrl: EMPTY,
      },
      {
        id: "fam-3",
        title: "One itinerary, many ages",
        caption:
          "Shared highlights with optional splits when energy levels diverge.",
        imageUrl: EMPTY,
      },
    ],
  },
  romantic: {
    optionId: "romantic",
    title: "Romantic Getaway / Honeymoon",
    subtitle: "Romantic Getaway · Intimate Preview",
    ctaLabel: "Select This Motivation →",
    avatarUrl: LOGO,
    slides: [
      {
        id: "rom-1",
        title: "Exclusive & intimate",
        caption:
          "Private dining, quiet viewpoints, and evenings designed for two — never crowded by default.",
        imageUrl: EMPTY,
      },
      {
        id: "rom-2",
        title: "Luxury that feels personal",
        caption:
          "Chauffeur timing, suite logistics, and experiences that stay soft and unhurried.",
        imageUrl: EMPTY,
      },
      {
        id: "rom-3",
        title: "Evenings designed for two",
        caption:
          "Sunset viewpoints and private tables without the group-tour feel.",
        imageUrl: EMPTY,
      },
    ],
  },
  solo: {
    optionId: "solo",
    title: "Solo Explorer",
    subtitle: "Solo Explorer · Authentic Depth Preview",
    ctaLabel: "Select This Motivation →",
    avatarUrl: LOGO,
    slides: [
      {
        id: "solo-1",
        title: "Deep local culture",
        caption:
          "One-to-one guiding that opens neighborhoods, rituals, and conversations most trips skip.",
        imageUrl: EMPTY,
      },
      {
        id: "solo-2",
        title: "Freedom with a safety net",
        caption:
          "You set the curiosity. We remove the language and logistics friction.",
        imageUrl: EMPTY,
      },
      {
        id: "solo-3",
        title: "Company when you want it",
        caption:
          "A private host who can fade back when you need quiet exploration.",
        imageUrl: EMPTY,
      },
    ],
  },
  first_time: {
    optionId: "first_time",
    title: "First-Time Japan Visitor",
    subtitle: "First-Time Visitor · Smooth Landing Preview",
    ctaLabel: "Select This Motivation →",
    avatarUrl: LOGO,
    slides: [
      {
        id: "ft-1",
        title: "Stress-free from day one",
        caption:
          "Airport pickup, clear pacing, and a host who translates more than language — etiquette included.",
        imageUrl: EMPTY,
      },
      {
        id: "ft-2",
        title: "The icons, done right",
        caption:
          "First-visit highlights without tourist-trap detours or exhausting schedules.",
        imageUrl: EMPTY,
      },
      {
        id: "ft-3",
        title: "Smooth from day one",
        caption:
          "Arrival logistics and first-day orientation so Japan never feels chaotic.",
        imageUrl: EMPTY,
      },
    ],
  },
  language_transit: {
    optionId: "language_transit",
    title: "Language & transit",
    subtitle: "Language & Transit · How We Remove Friction",
    ctaLabel: "Select This Concern →",
    avatarUrl: LOGO,
    slides: [
      {
        id: "lt-1",
        title: "You never navigate alone",
        caption:
          "Your host handles stations, tickets, and directions — no frantic app switching mid-transfer.",
        imageUrl: EMPTY,
      },
      {
        id: "lt-2",
        title: "Language barrier gone",
        caption:
          "Menus, etiquette, and local rules are translated in real time so nothing feels awkward.",
        imageUrl: EMPTY,
      },
      {
        id: "lt-3",
        title: "Clarity at every transfer",
        caption:
          "Tickets, platforms, and timing explained before you need them.",
        imageUrl: EMPTY,
      },
    ],
  },
  tourist_traps: {
    optionId: "tourist_traps",
    title: "Tourist traps",
    subtitle: "Tourist Traps · Quiet Alternatives Preview",
    ctaLabel: "Select This Concern →",
    avatarUrl: LOGO,
    slides: [
      {
        id: "tt-1",
        title: "Skip the over-hyped loops",
        caption:
          "We route around packed Instagram lines and into places with real atmosphere.",
        imageUrl: EMPTY,
      },
      {
        id: "tt-2",
        title: "Crowd-aware timing",
        caption:
          "Arrive when the light is good and the crowds are thinner — not when the tour buses do.",
        imageUrl: EMPTY,
      },
      {
        id: "tt-3",
        title: "Better alternatives nearby",
        caption:
          "Iconic views from quieter angles — same magic, fewer crowds.",
        imageUrl: EMPTY,
      },
    ],
  },
  authentic_dining: {
    optionId: "authentic_dining",
    title: "Authentic dining",
    subtitle: "Authentic Dining · Local Tables Preview",
    ctaLabel: "Select This Concern →",
    avatarUrl: LOGO,
    slides: [
      {
        id: "ad-1",
        title: "Beyond tourist menus",
        caption:
          "Neighborhood counters and reservation-only rooms your host books with local trust.",
        imageUrl: EMPTY,
      },
      {
        id: "ad-2",
        title: "What locals actually eat",
        caption:
          "Seasonal plates, sake pairing, and places that never needed a neon English sign.",
        imageUrl: EMPTY,
      },
      {
        id: "ad-3",
        title: "Neighborhood tables",
        caption:
          "Places locals actually book — with a host who can order with confidence.",
        imageUrl: EMPTY,
      },
    ],
  },
  packed_itinerary: {
    optionId: "packed_itinerary",
    title: "No time to breathe",
    subtitle: "Relaxed Pacing · Breathing Room Preview",
    ctaLabel: "Select This Concern →",
    avatarUrl: LOGO,
    slides: [
      {
        id: "pi-1",
        title: "Space to absorb Japan",
        caption:
          "We protect café pauses, hotel wind-downs, and unhurried walks — not just checklist sightseeing.",
        imageUrl: EMPTY,
      },
      {
        id: "pi-2",
        title: "Designed, not crammed",
        caption:
          "Fewer forced moves. More time where the day actually feels good.",
        imageUrl: EMPTY,
      },
      {
        id: "pi-3",
        title: "Breathing room built in",
        caption:
          "White space between highlights so the trip feels luxurious, not rushed.",
        imageUrl: EMPTY,
      },
    ],
  },
};

/** Unique stills used in story slides — warm these on home. */
export const STORY_WARM_IMAGE_PATHS: readonly string[] = Array.from(
  new Set(
    Object.values(STORIES).flatMap((story) => [
      story.avatarUrl,
      ...story.slides.map((s) => s.imageUrl).filter(Boolean),
    ]).filter(Boolean)
  )
);

export function getStoryExplanation(optionId: string): StoryExplanation | null {
  return STORIES[optionId] ?? null;
}

/** Options that support story previews (steps 1–4). */
export const STORY_OPTION_IDS = new Set([
  ...TRAVEL_STYLES.map((o) => o.id),
  ...INTERESTS.map((o) => o.id),
  ...MOTIVATIONS.map((o) => o.id),
  ...PAIN_POINTS.map((o) => o.id),
]);
