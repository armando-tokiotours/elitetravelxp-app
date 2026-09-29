/**
 * Brand character registry — Team Access Layout Builder catalog.
 * Paths under public/brand; optimal targets for live VPS speed.
 */

export type BrandCharacterCategory =
  | "pre_elite"
  | "builder_timeline"
  | "itinerary"
  | "system"
  | "guest_party"
  | "season"
  | "hero";

export type BrandCharacterOptimal = {
  /** Max longer edge recommended for live delivery */
  maxEdgePx: number;
  /** Soft target file size in KB */
  maxKb: number;
  /** Ideal format note for uploaders */
  formatHint: string;
};

export type BrandCharacterDef = {
  id: string;
  label: string;
  /** Path relative to public, e.g. /brand/mascot-note.png */
  path: string;
  category: BrandCharacterCategory;
  /** Human-readable where this shows up */
  usedOn: string[];
  optimal: BrandCharacterOptimal;
};

/** Pre-Elite / builder mascots — large on screen but still &lt;512px is enough. */
const MASCOT_OPTIMAL: BrandCharacterOptimal = {
  maxEdgePx: 512,
  maxKb: 120,
  formatHint: "PNG or WebP · ≤512px tall",
};

/** Tiny timeline mascot — even lighter. */
const TIMELINE_OPTIMAL: BrandCharacterOptimal = {
  maxEdgePx: 256,
  maxKb: 60,
  formatHint: "PNG or WebP · ≤256px tall",
};

const GUEST_OPTIMAL: BrandCharacterOptimal = {
  maxEdgePx: 512,
  maxKb: 100,
  formatHint: "PNG or WebP · ≤512px tall",
};

const FOX_OPTIMAL: BrandCharacterOptimal = {
  maxEdgePx: 400,
  maxKb: 80,
  formatHint: "PNG or WebP · ≤400px tall",
};

const SEASON_OPTIMAL: BrandCharacterOptimal = {
  maxEdgePx: 512,
  maxKb: 120,
  formatHint: "PNG or WebP · ≤512px tall",
};

const HERO_OPTIMAL: BrandCharacterOptimal = {
  maxEdgePx: 1920,
  maxKb: 400,
  formatHint: "JPG or WebP · ≤1920×1080 · ~200–400 KB",
};

export const BRAND_CHARACTERS: BrandCharacterDef[] = [
  {
    id: "mascot-look",
    label: "Look (default)",
    path: "/brand/mascot-look.png",
    category: "pre_elite",
    usedOn: ["Pre-Elite hero", "Builder timeline (active)"],
    optimal: MASCOT_OPTIMAL,
  },
  {
    id: "mascot-note",
    label: "Note (writing)",
    path: "/brand/mascot-note.png",
    category: "pre_elite",
    usedOn: ["Pre-Elite Step 5 (typing)", "Builder timeline (idle loop)"],
    optimal: MASCOT_OPTIMAL,
  },
  {
    id: "mascot-time",
    label: "Time (idle)",
    path: "/brand/mascot-time.png",
    category: "pre_elite",
    usedOn: ["Pre-Elite idle", "Builder timeline idle", "Itinerary idle"],
    optimal: MASCOT_OPTIMAL,
  },
  {
    id: "mascot-bow",
    label: "Bow",
    path: "/brand/mascot-bow.png",
    category: "pre_elite",
    usedOn: ["Pre-Elite step transition"],
    optimal: MASCOT_OPTIMAL,
  },
  {
    id: "mascot-phone",
    label: "Phone",
    path: "/brand/mascot-phone.png",
    category: "itinerary",
    usedOn: ["Itinerary hero (active)"],
    optimal: MASCOT_OPTIMAL,
  },
  {
    id: "mascot-multiday",
    label: "Multi-day pass",
    path: "/brand/mascot-multiday.png",
    category: "pre_elite",
    usedOn: ["Pre-Elite Step 5 · Multi-Day selected"],
    optimal: MASCOT_OPTIMAL,
  },
  {
    id: "mascot-1day-pass",
    label: "Single-day pass",
    path: "/brand/mascot-1day-pass.png",
    category: "pre_elite",
    usedOn: ["Pre-Elite Step 5 · Single-Day selected"],
    optimal: MASCOT_OPTIMAL,
  },
  {
    id: "mascot-right-hi",
    label: "Right hi",
    path: "/brand/mascot-right-hi.png",
    category: "pre_elite",
    usedOn: ["Brand library (available)"],
    optimal: TIMELINE_OPTIMAL,
  },
  {
    id: "fox-peek",
    label: "Fox (system messages)",
    path: "/brand/fox-peek.png",
    category: "system",
    usedOn: ["Builder system messages (bottom-left)"],
    optimal: FOX_OPTIMAL,
  },
  {
    id: "guest-duck-peek",
    label: "Guest · Duck peek",
    path: "/brand/guest-duck-peek.png",
    category: "guest_party",
    usedOn: ["Pre-Elite Step 5 guest party"],
    optimal: GUEST_OPTIMAL,
  },
  {
    id: "guest-shiba",
    label: "Guest · Shiba",
    path: "/brand/guest-shiba.png",
    category: "guest_party",
    usedOn: ["Pre-Elite Step 5 guest party"],
    optimal: GUEST_OPTIMAL,
  },
  {
    id: "guest-cat",
    label: "Guest · Cat",
    path: "/brand/guest-cat.png",
    category: "guest_party",
    usedOn: ["Pre-Elite Step 5 guest party"],
    optimal: GUEST_OPTIMAL,
  },
  {
    id: "guest-red-panda",
    label: "Guest · Red panda",
    path: "/brand/guest-red-panda.png",
    category: "guest_party",
    usedOn: ["Pre-Elite Step 5 guest party"],
    optimal: GUEST_OPTIMAL,
  },
  {
    id: "guest-panda",
    label: "Guest · Panda",
    path: "/brand/guest-panda.png",
    category: "guest_party",
    usedOn: ["Pre-Elite Step 5 guest party"],
    optimal: GUEST_OPTIMAL,
  },
  {
    id: "guest-chick",
    label: "Guest · Chick",
    path: "/brand/guest-chick.png",
    category: "guest_party",
    usedOn: ["Pre-Elite Step 5 guest party (kids)"],
    optimal: GUEST_OPTIMAL,
  },
  {
    id: "guest-duck",
    label: "Guest · Duck (full)",
    path: "/brand/guest-duck.png",
    category: "guest_party",
    usedOn: ["Library (peek version is live)"],
    optimal: GUEST_OPTIMAL,
  },
  {
    id: "mascot-season-default",
    label: "Season · Default",
    path: "/brand/mascot-season-default.png",
    category: "season",
    usedOn: ["Seasonality climate cards"],
    optimal: SEASON_OPTIMAL,
  },
  {
    id: "mascot-season-summer",
    label: "Season · Summer",
    path: "/brand/mascot-season-summer.png",
    category: "season",
    usedOn: ["Seasonality climate cards"],
    optimal: SEASON_OPTIMAL,
  },
  {
    id: "mascot-season-winter",
    label: "Season · Winter",
    path: "/brand/mascot-season-winter.png",
    category: "season",
    usedOn: ["Seasonality climate cards"],
    optimal: SEASON_OPTIMAL,
  },
  {
    id: "mascot-season-rain",
    label: "Season · Rain",
    path: "/brand/mascot-season-rain.png",
    category: "season",
    usedOn: ["Seasonality climate cards"],
    optimal: SEASON_OPTIMAL,
  },
  {
    id: "hero-background",
    label: "Hero · Multi-Day",
    path: "/brand/hero-background.jpg",
    category: "hero",
    usedOn: ["Builder M hero background"],
    optimal: HERO_OPTIMAL,
  },
  {
    id: "hero-single-day",
    label: "Hero · Single-Day",
    path: "/brand/hero-single-day.jpg",
    category: "hero",
    usedOn: ["Builder S hero background"],
    optimal: HERO_OPTIMAL,
  },
  {
    id: "hero-japan-pagoda",
    label: "Hero · Japan pagoda",
    path: "/brand/hero-japan-pagoda.jpg",
    category: "hero",
    usedOn: ["Pre-Elite story fallbacks"],
    optimal: HERO_OPTIMAL,
  },
];

export function getBrandCharacter(id: string): BrandCharacterDef | undefined {
  return BRAND_CHARACTERS.find((c) => c.id === id);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type WeightStatus = "ok" | "heavy" | "missing";

export function weightStatus(
  bytes: number | null,
  width: number | null,
  height: number | null,
  optimal: BrandCharacterOptimal
): WeightStatus {
  if (bytes == null) return "missing";
  const kb = bytes / 1024;
  const edge = Math.max(width || 0, height || 0);
  if (kb > optimal.maxKb * 1.25 || (edge > 0 && edge > optimal.maxEdgePx * 1.15)) {
    return "heavy";
  }
  return "ok";
}
