/**
 * Brand character registry — Team Access Layout Builder catalog.
 * Paths under public/brand; optimal targets for live VPS speed.
 * Characters ship as WebP (upload API converts PNG → WebP).
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
  /** Path relative to public, e.g. /brand/mascot-note.webp */
  path: string;
  category: BrandCharacterCategory;
  /** Human-readable where this shows up */
  usedOn: string[];
  optimal: BrandCharacterOptimal;
};

/** Pre-Elite / builder mascots — large on screen but still &lt;512px is enough. */
const MASCOT_OPTIMAL: BrandCharacterOptimal = {
  maxEdgePx: 512,
  maxKb: 60,
  formatHint: "WebP · ≤512px · PNG uploads auto-convert",
};

/** Tiny timeline mascot — even lighter. */
const TIMELINE_OPTIMAL: BrandCharacterOptimal = {
  maxEdgePx: 256,
  maxKb: 30,
  formatHint: "WebP · ≤256px · PNG uploads auto-convert",
};

const GUEST_OPTIMAL: BrandCharacterOptimal = {
  maxEdgePx: 512,
  maxKb: 50,
  formatHint: "WebP · ≤512px · PNG uploads auto-convert",
};

const FOX_OPTIMAL: BrandCharacterOptimal = {
  maxEdgePx: 400,
  maxKb: 40,
  formatHint: "WebP · ≤400px · PNG uploads auto-convert",
};

const SEASON_OPTIMAL: BrandCharacterOptimal = {
  maxEdgePx: 512,
  maxKb: 50,
  formatHint: "WebP · ≤512px · PNG uploads auto-convert",
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
    path: "/brand/mascot-look.webp",
    category: "pre_elite",
    usedOn: ["Pre-Elite hero", "Builder timeline (active)"],
    optimal: MASCOT_OPTIMAL,
  },
  {
    id: "mascot-note",
    label: "Note (writing)",
    path: "/brand/mascot-note.webp",
    category: "pre_elite",
    usedOn: ["Pre-Elite Step 5 (typing)", "Builder timeline (idle loop)"],
    optimal: MASCOT_OPTIMAL,
  },
  {
    id: "mascot-time",
    label: "Time (idle)",
    path: "/brand/mascot-time.webp",
    category: "pre_elite",
    usedOn: ["Pre-Elite idle", "Builder timeline idle", "Itinerary idle"],
    optimal: MASCOT_OPTIMAL,
  },
  {
    id: "mascot-bow",
    label: "Bow",
    path: "/brand/mascot-bow.webp",
    category: "pre_elite",
    usedOn: ["Pre-Elite step transition"],
    optimal: MASCOT_OPTIMAL,
  },
  {
    id: "mascot-phone",
    label: "Phone",
    path: "/brand/mascot-phone.webp",
    category: "itinerary",
    usedOn: ["Itinerary hero (active)"],
    optimal: MASCOT_OPTIMAL,
  },
  {
    id: "mascot-multiday",
    label: "Multi-day pass",
    path: "/brand/mascot-multiday.webp",
    category: "pre_elite",
    usedOn: ["Pre-Elite Step 5 · Multi-Day selected"],
    optimal: MASCOT_OPTIMAL,
  },
  {
    id: "mascot-1day-pass",
    label: "Single-day pass",
    path: "/brand/mascot-1day-pass.webp",
    category: "pre_elite",
    usedOn: ["Pre-Elite Step 5 · Single-Day selected"],
    optimal: MASCOT_OPTIMAL,
  },
  {
    id: "mascot-right-hi",
    label: "Right hi",
    path: "/brand/mascot-right-hi.webp",
    category: "pre_elite",
    usedOn: ["Brand library (available)"],
    optimal: TIMELINE_OPTIMAL,
  },
  {
    id: "mascot-question",
    label: "Question (thinking)",
    path: "/brand/mascot-question.webp",
    category: "pre_elite",
    usedOn: ["Brand library (available)"],
    optimal: MASCOT_OPTIMAL,
  },
  {
    id: "mascot-point",
    label: "Point",
    path: "/brand/mascot-point.webp",
    category: "pre_elite",
    usedOn: ["Brand library (available)"],
    optimal: MASCOT_OPTIMAL,
  },
  {
    id: "fox-peek",
    label: "Fox (system messages)",
    path: "/brand/fox-peek.webp",
    category: "system",
    usedOn: ["Builder system messages (bottom-left)"],
    optimal: FOX_OPTIMAL,
  },
  {
    id: "fox1",
    label: "Fox (standing)",
    path: "/brand/fox1.webp",
    category: "system",
    usedOn: ["Brand library (available)"],
    optimal: FOX_OPTIMAL,
  },
  {
    id: "guest-duck-peek",
    label: "Guest · Duck peek",
    path: "/brand/guest-duck-peek.webp",
    category: "guest_party",
    usedOn: ["Pre-Elite Step 5 guest party"],
    optimal: GUEST_OPTIMAL,
  },
  {
    id: "guest-shiba",
    label: "Guest · Shiba",
    path: "/brand/guest-shiba.webp",
    category: "guest_party",
    usedOn: ["Pre-Elite Step 5 guest party"],
    optimal: GUEST_OPTIMAL,
  },
  {
    id: "guest-cat",
    label: "Guest · Cat",
    path: "/brand/guest-cat.webp",
    category: "guest_party",
    usedOn: ["Pre-Elite Step 5 guest party"],
    optimal: GUEST_OPTIMAL,
  },
  {
    id: "guest-red-panda",
    label: "Guest · Red panda",
    path: "/brand/guest-red-panda.webp",
    category: "guest_party",
    usedOn: ["Pre-Elite Step 5 guest party"],
    optimal: GUEST_OPTIMAL,
  },
  {
    id: "guest-panda",
    label: "Guest · Panda",
    path: "/brand/guest-panda.webp",
    category: "guest_party",
    usedOn: ["Pre-Elite Step 5 guest party"],
    optimal: GUEST_OPTIMAL,
  },
  {
    id: "guest-chick",
    label: "Guest · Chick",
    path: "/brand/guest-chick.webp",
    category: "guest_party",
    usedOn: ["Pre-Elite Step 5 guest party (kids)"],
    optimal: GUEST_OPTIMAL,
  },
  {
    id: "guest-duck",
    label: "Guest · Duck (full)",
    path: "/brand/guest-duck.webp",
    category: "guest_party",
    usedOn: ["Library (peek version is live)"],
    optimal: GUEST_OPTIMAL,
  },
  {
    id: "mascot-season-default",
    label: "Season · Default",
    path: "/brand/mascot-season-default.webp",
    category: "season",
    usedOn: ["Seasonality climate cards"],
    optimal: SEASON_OPTIMAL,
  },
  {
    id: "mascot-season-summer",
    label: "Season · Summer",
    path: "/brand/mascot-season-summer.webp",
    category: "season",
    usedOn: ["Seasonality climate cards"],
    optimal: SEASON_OPTIMAL,
  },
  {
    id: "mascot-season-winter",
    label: "Season · Winter",
    path: "/brand/mascot-season-winter.webp",
    category: "season",
    usedOn: ["Seasonality climate cards"],
    optimal: SEASON_OPTIMAL,
  },
  {
    id: "mascot-season-rain",
    label: "Season · Rain",
    path: "/brand/mascot-season-rain.webp",
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

/**
 * Lightweight WebP characters to warm-cache on app start (~0.7 MB total).
 * Skips heavy hero JPGs — those load with their builders.
 */
export const BRAND_CHARACTER_PRELOAD_PATHS: readonly string[] = [
  ...BRAND_CHARACTERS.filter((c) => c.category !== "hero").map((c) => c.path),
  "/brand/trip-multi-thumb.webp",
  "/brand/trip-single-thumb.webp",
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
