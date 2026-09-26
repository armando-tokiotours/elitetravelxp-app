import type {
  PbSeasonTier,
  PbSeasonalParticle,
  PbSeasonalCharacter,
  ClimateSeasonKey,
} from "@/lib/pocketbase/client";
import { pbFileUrl } from "@/lib/pocketbase/client";

export type SeasonTierName = "Low" | "Mid" | "High";

export type SeasonInsight = {
  tier: SeasonTierName;
  crowd_level: string;
  concierge_note: string;
};

/** Ambient particle season (Japan travel calendar). */
export type ParticleSeason = "sakura" | "snow" | "momiji" | null;

export type SeasonalParticleMeta = {
  season: Exclude<ParticleSeason, null>;
  badge: string;
  /** Optional custom glyph from Team Access */
  iconUrl?: string | null;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** In-memory cache set by fetchBuilderConfig / Team Access / host loader */
let particleRulesCache: PbSeasonalParticle[] = [];

export function setSeasonalParticleRules(rules: PbSeasonalParticle[]): void {
  particleRulesCache = Array.isArray(rules) ? rules : [];
}

export function getSeasonalParticleRules(): PbSeasonalParticle[] {
  return particleRulesCache;
}

export function parseArrivalParts(iso: string | null): {
  month: (typeof MONTHS)[number];
  day: number;
  monthIndex: number;
} | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { month: MONTHS[m - 1], day: d, monthIndex: m };
}

/** Resolve season rule for an arrival date from an in-memory list. */
export function resolveSeasonInsight(
  tiers: PbSeasonTier[],
  arrivalIso: string | null
): SeasonInsight | null {
  const parts = parseArrivalParts(arrivalIso);
  if (!parts) return null;

  const hit = tiers.find((row) => {
    if (row.is_active === false) return false;
    if (row.month !== parts.month) return false;
    const start = Number(row.start_day) || 1;
    const end = Number(row.end_day) || 31;
    return parts.day >= start && parts.day <= end;
  });

  if (!hit || !hit.tier) return null;

  return {
    tier: hit.tier,
    crowd_level: hit.crowd_level?.trim() || "",
    concierge_note: hit.concierge_note?.trim() || "",
  };
}

/** MM*100+DD key for range compares; supports year wrap (Dec→Feb). */
function monthDayKey(month: number, day: number): number {
  return month * 100 + day;
}

export function dateInParticleWindow(
  month: number,
  day: number,
  rule: Pick<
    PbSeasonalParticle,
    "start_month" | "start_day" | "end_month" | "end_day" | "is_active"
  >
): boolean {
  if (rule.is_active === false) return false;
  const t = monthDayKey(month, day);
  const start = monthDayKey(
    Number(rule.start_month) || 1,
    Number(rule.start_day) || 1
  );
  const end = monthDayKey(
    Number(rule.end_month) || 12,
    Number(rule.end_day) || 31
  );
  if (start <= end) return t >= start && t <= end;
  // Wraps year (e.g. Dec 1 → Feb 28)
  return t >= start || t <= end;
}

function iconUrlForRule(rule: PbSeasonalParticle): string | null {
  const file = rule.icon?.trim();
  if (!file) return null;
  return (
    pbFileUrl(
      rule.collectionId || "seasonal_particles",
      rule.id,
      file
    ) || null
  );
}

/** Resolve particle meta from Team Access rules; falls back to hardcoded months. */
export function resolveParticleMeta(
  monthIndex: number,
  day: number,
  rules: PbSeasonalParticle[] = particleRulesCache
): SeasonalParticleMeta | null {
  const active = rules.filter((r) => r.is_active !== false);
  if (active.length > 0) {
    const sorted = [...active].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
    const hit = sorted.find((r) =>
      dateInParticleWindow(monthIndex, day, r)
    );
    if (hit) {
      return {
        season: hit.season,
        badge: hit.label?.trim() || seasonalParticleMeta(hit.season)?.badge || hit.season,
        iconUrl: iconUrlForRule(hit),
      };
    }
    return null;
  }
  // Fallback when no DB rules loaded
  return seasonalParticleMeta(particleSeasonFromMonth(monthIndex));
}

/** Map calendar month (1–12) → ambient particle season (hardcoded fallback). */
export function particleSeasonFromMonth(monthIndex: number): ParticleSeason {
  if (monthIndex >= 3 && monthIndex <= 5) return "sakura";
  if (monthIndex === 12 || monthIndex <= 2) return "snow";
  if (monthIndex >= 9 && monthIndex <= 11) return "momiji";
  return null;
}

/** ISO date (YYYY-MM-DD) or Date → particle season. */
export function particleSeasonFromDate(
  input: string | Date | null | undefined
): ParticleSeason {
  return resolveParticleMetaFromInput(input)?.season ?? null;
}

export function resolveParticleMetaFromInput(
  input: string | Date | null | undefined,
  rules: PbSeasonalParticle[] = particleRulesCache
): SeasonalParticleMeta | null {
  if (!input) return null;
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null;
    return resolveParticleMeta(
      input.getMonth() + 1,
      input.getDate(),
      rules
    );
  }
  const parts = parseArrivalParts(input);
  if (!parts) return null;
  return resolveParticleMeta(parts.monthIndex, parts.day, rules);
}

/** "April 2026" / "April" style month labels from TimingSelector. */
export function particleSeasonFromMonthLabel(
  label: string | null | undefined
): ParticleSeason {
  if (!label) return null;
  const lower = label.trim().toLowerCase();
  const idx = MONTHS.findIndex((m) => lower.startsWith(m.toLowerCase()));
  if (idx < 0) return null;
  // Mid-month proxy when only a month label is known
  return resolveParticleMeta(idx + 1, 15)?.season ?? null;
}

export function seasonalParticleMeta(
  season: ParticleSeason
): SeasonalParticleMeta | null {
  if (season === "sakura") {
    return {
      season,
      badge: "Sakura Peak Season Detected",
    };
  }
  if (season === "snow") {
    return {
      season,
      badge: "Hokkaido Powder Snow",
    };
  }
  if (season === "momiji") {
    return {
      season,
      badge: "Momiji Foliage Season",
    };
  }
  return null;
}

export const PARTICLE_SEASON_OPTIONS = [
  { id: "sakura" as const, label: "Sakura (cherry blossom)" },
  { id: "snow" as const, label: "Snow" },
  { id: "momiji" as const, label: "Momiji (autumn foliage)" },
];

export const PARTICLE_ICON_SPECS = {
  preferred: "SVG preferred (or PNG)",
  canvas: "24×24 px viewBox / canvas",
  safe: "Art fills ~18–22 px, centered, transparent background",
  maxSvg: "SVG under 50 KB",
  maxPng: "PNG under 80 KB (48×48 OK for retina)",
} as const;

/** Climate mascot keys for Seasonality card (Team Access → Characters). */
export type { ClimateSeasonKey };

export const CLIMATE_SEASON_OPTIONS: {
  id: ClimateSeasonKey;
  label: string;
}[] = [
  { id: "default", label: "Default (no date / off-season)" },
  { id: "winter", label: "Winter" },
  { id: "summer", label: "Summer" },
  { id: "rain", label: "Rainy season" },
];

/** Bundled fallbacks when Team Access has no upload. */
export const DEFAULT_CLIMATE_MASCOTS: Record<ClimateSeasonKey, string> = {
  default: "/brand/mascot-season-default.png",
  winter: "/brand/mascot-season-winter.png",
  summer: "/brand/mascot-season-summer.png",
  rain: "/brand/mascot-season-rain.png",
};

/** Hardcoded Japan climate windows when DB rows lack dates. */
const FALLBACK_CLIMATE_WINDOWS: {
  key: Exclude<ClimateSeasonKey, "default">;
  start_month: number;
  start_day: number;
  end_month: number;
  end_day: number;
  sort_order: number;
}[] = [
  {
    key: "winter",
    start_month: 12,
    start_day: 1,
    end_month: 2,
    end_day: 28,
    sort_order: 10,
  },
  {
    key: "rain",
    start_month: 6,
    start_day: 1,
    end_month: 7,
    end_day: 20,
    sort_order: 20,
  },
  {
    key: "summer",
    start_month: 7,
    start_day: 21,
    end_month: 8,
    end_day: 31,
    sort_order: 30,
  },
];

let climateCharacterCache: PbSeasonalCharacter[] = [];

export function setSeasonalCharacterRules(
  rows: PbSeasonalCharacter[]
): void {
  climateCharacterCache = Array.isArray(rows) ? rows : [];
}

export function getSeasonalCharacterRules(): PbSeasonalCharacter[] {
  return climateCharacterCache;
}

function mascotUrlForCharacter(row: PbSeasonalCharacter): string {
  const file = row.mascot?.trim();
  if (file) {
    const url = pbFileUrl(
      row.collectionId || "seasonal_characters",
      row.id,
      file
    );
    if (url) return url;
  }
  return DEFAULT_CLIMATE_MASCOTS[row.key] || DEFAULT_CLIMATE_MASCOTS.default;
}

export type ClimateMascotMeta = {
  key: ClimateSeasonKey;
  label: string;
  mascotUrl: string;
};

function resolveClimateFromRules(
  month: number,
  day: number,
  rules: PbSeasonalCharacter[]
): ClimateMascotMeta {
  const active = rules.filter((r) => r.is_active !== false);
  const dated = active
    .filter((r) => r.key !== "default" && r.start_month && r.end_month)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const hit = dated.find((r) =>
    dateInParticleWindow(month, day, {
      start_month: Number(r.start_month),
      start_day: Number(r.start_day) || 1,
      end_month: Number(r.end_month),
      end_day: Number(r.end_day) || 31,
      is_active: r.is_active,
    })
  );

  if (hit) {
    return {
      key: hit.key,
      label: hit.label?.trim() || hit.key,
      mascotUrl: mascotUrlForCharacter(hit),
    };
  }

  const def = active.find((r) => r.key === "default");
  if (def) {
    return {
      key: "default",
      label: def.label?.trim() || "Default",
      mascotUrl: mascotUrlForCharacter(def),
    };
  }

  return {
    key: "default",
    label: "Default",
    mascotUrl: DEFAULT_CLIMATE_MASCOTS.default,
  };
}

function resolveClimateFallback(month: number, day: number): ClimateMascotMeta {
  const sorted = [...FALLBACK_CLIMATE_WINDOWS].sort(
    (a, b) => a.sort_order - b.sort_order
  );
  const hit = sorted.find((w) =>
    dateInParticleWindow(month, day, {
      ...w,
      is_active: true,
    })
  );
  if (hit) {
    return {
      key: hit.key,
      label: hit.key,
      mascotUrl: DEFAULT_CLIMATE_MASCOTS[hit.key],
    };
  }
  return {
    key: "default",
    label: "Default",
    mascotUrl: DEFAULT_CLIMATE_MASCOTS.default,
  };
}

/**
 * Resolve Seasonality-card mascot from tour/arrival date.
 * No date → default character (season.png).
 */
export function resolveClimateMascot(
  input: string | Date | null | undefined,
  rules: PbSeasonalCharacter[] = climateCharacterCache
): ClimateMascotMeta {
  if (!input) {
    const def = rules.find(
      (r) => r.key === "default" && r.is_active !== false
    );
    return {
      key: "default",
      label: def?.label?.trim() || "Default",
      mascotUrl: def
        ? mascotUrlForCharacter(def)
        : DEFAULT_CLIMATE_MASCOTS.default,
    };
  }

  let month: number;
  let day: number;
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) {
      return resolveClimateMascot(null, rules);
    }
    month = input.getMonth() + 1;
    day = input.getDate();
  } else {
    const parts = parseArrivalParts(input);
    if (!parts) return resolveClimateMascot(null, rules);
    month = parts.monthIndex;
    day = parts.day;
  }

  const active = rules.filter((r) => r.is_active !== false);
  if (active.length > 0) {
    return resolveClimateFromRules(month, day, active);
  }
  return resolveClimateFallback(month, day);
}

export const CLIMATE_MASCOT_SPECS = {
  preferred: "PNG with transparent background",
  canvas: "Full-body mascot, roughly square crop",
  size: "Display ~88–112 px tall; upload up to ~1024 px",
  maxFile: "Under 1.2 MB",
} as const;
