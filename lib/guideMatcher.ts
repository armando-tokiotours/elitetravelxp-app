/**
 * Rule-based guide matching + quick payout estimate for Ops Guide Dispatch.
 */

export type GuideAvailabilityStatus = "AVAILABLE" | "ON_TOUR" | "OFF_DUTY";

/** Matcher-facing guide shape (staff id is the dispatch key). */
export type GuideMatchProfile = {
  id: string;
  /** PocketBase `guides` row id (for rate cards / payouts) */
  guideRecordId?: string;
  name: string;
  phone: string;
  email?: string;
  languages: string[]; // EN, NL, ES, JA…
  acceptsKids: boolean;
  acceptsCouples: boolean;
  maxGroupSize: number;
  hourlyRateJpy: number;
  baseRate6hJpy: number;
  baseRate8hJpy: number;
  avatarUrl?: string;
  status: GuideAvailabilityStatus;
  cityOfOperation?: string;
};

export type GuideMatchBooking = {
  language?: string | null;
  paxAdults?: number;
  paxChildren?: number;
  totalHours?: number;
  couplesOnly?: boolean;
};

export type GuideMatchResult = {
  guide: GuideMatchProfile;
  matchScore: number;
  isEligible: boolean;
  disqualifications: string[];
  matchTags: string[];
};

const LANG_ALIASES: Record<string, string> = {
  EN: "EN",
  ENG: "EN",
  ENGLISH: "EN",
  NL: "NL",
  DUTCH: "NL",
  NEDERLANDS: "NL",
  ES: "ES",
  SPANISH: "ES",
  ESPAÑOL: "ES",
  ESPANOL: "ES",
  FR: "FR",
  FRENCH: "FR",
  FRANÇAIS: "FR",
  FRANCAIS: "FR",
  DE: "DE",
  GERMAN: "DE",
  DEUTSCH: "DE",
  IT: "IT",
  ITALIAN: "IT",
  ITALIANO: "IT",
  JA: "JA",
  JP: "JA",
  JAPANESE: "JA",
  日本語: "JA",
  ZH: "ZH",
  CHINESE: "ZH",
  MANDARIN: "ZH",
  KO: "KO",
  KOREAN: "KO",
};

export function normalizeLangCode(raw?: string | null): string {
  const s = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-ZÀ-ÿ]/gi, "");
  if (!s || s === "—" || s === "-") return "EN";
  if (LANG_ALIASES[s]) return LANG_ALIASES[s];
  // "Dutch Speaking" / multi-word
  for (const [key, code] of Object.entries(LANG_ALIASES)) {
    if (s.includes(key)) return code;
  }
  return s.slice(0, 2);
}

export function normalizeGuideLanguages(
  langs?: string[] | string | null
): string[] {
  const list = Array.isArray(langs)
    ? langs
    : typeof langs === "string"
      ? langs.split(/[,/|]/)
      : [];
  const out = new Set<string>();
  for (const l of list) {
    const code = normalizeLangCode(l);
    if (code) out.add(code);
  }
  if (out.size === 0) out.add("EN");
  return [...out];
}

const JPY_PER_EUR = 160;
const DEFAULT_HOURLY_JPY = 3500;
const DEFAULT_MAX_GROUP = 10;

export function estimateGuidePayout(opts: {
  tourHours: number;
  hourlyRateJpy?: number;
  baseRate6hJpy?: number;
  baseRate8hJpy?: number;
}): { tourHours: number; hourlyRateJpy: number; totalPayoutJpy: number; totalPayoutEur: number } {
  const hours = Math.max(0, Number(opts.tourHours) || 0) || 6;
  const base6 = Math.max(0, Number(opts.baseRate6hJpy) || 0);
  const base8 = Math.max(0, Number(opts.baseRate8hJpy) || 0);
  let totalPayoutJpy = 0;
  if (base6 > 0 || base8 > 0) {
    totalPayoutJpy = hours <= 6 ? base6 || base8 : base8 || Math.round(base6 * (hours / 6));
  } else {
    const hourly =
      Math.max(0, Number(opts.hourlyRateJpy) || 0) || DEFAULT_HOURLY_JPY;
    totalPayoutJpy = Math.round(hours * hourly);
  }
  const hourlyRateJpy =
    Math.max(0, Number(opts.hourlyRateJpy) || 0) ||
    (totalPayoutJpy > 0 && hours > 0
      ? Math.round(totalPayoutJpy / hours)
      : DEFAULT_HOURLY_JPY);
  return {
    tourHours: hours,
    hourlyRateJpy,
    totalPayoutJpy,
    totalPayoutEur: Math.round(totalPayoutJpy / JPY_PER_EUR),
  };
}

export function parseTourHoursLabel(label?: string | null): number {
  const raw = String(label || "").trim();
  const m = raw.match(/(\d+(?:\.\d+)?)\s*h/i);
  if (m) return Math.max(1, Math.round(Number(m[1])));
  const days = raw.match(/(\d+)\s*day/i);
  if (days) return Math.max(1, Number(days[1]) * 8);
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0 && n <= 24) return Math.round(n);
  return 6;
}

/** Map a PocketBase `guides` row (+ optional staff overlay) into matcher profile. */
export function guideRecordToMatchProfile(
  row: Record<string, unknown>,
  staffFallback?: { id: string; name?: string; email?: string }
): GuideMatchProfile | null {
  const staffId = String(row.staff || staffFallback?.id || "").trim();
  if (!staffId) return null;
  const name =
    String(row.full_name || staffFallback?.name || "").trim() ||
    String(row.email || staffFallback?.email || "Guide").trim();
  const base6 = Math.max(0, Number(row.base_rate_6h_or_less) || 0);
  const base8 = Math.max(0, Number(row.base_rate_8h_or_less) || 0);
  const hourlyFromBase =
    base6 > 0 ? Math.round(base6 / 6) : base8 > 0 ? Math.round(base8 / 8) : 0;
  const acceptsKids =
    row.comfort_family_under_12 === true ||
    row.comfort_family_12_30 === true ||
    row.acceptsKids === true;
  const acceptsCouples =
    row.comfort_couples === true ||
    row.comfort_family_adults_only === true ||
    row.acceptsCouples === true;
  const pattern = String(row.availability_pattern || "").toLowerCase();
  let status: GuideAvailabilityStatus = "AVAILABLE";
  if (pattern.includes("off") || row.status === "OFF_DUTY") status = "OFF_DUTY";
  if (row.status === "ON_TOUR") status = "ON_TOUR";

  return {
    id: staffId,
    guideRecordId: String(row.id || "").trim() || undefined,
    name,
    phone: String(row.phone_number || row.phone || "").trim() || "—",
    email: String(row.email || staffFallback?.email || "").trim() || undefined,
    languages: normalizeGuideLanguages(
      (row.main_tour_languages as string[] | undefined) ||
        (row.languages as string[] | undefined)
    ),
    acceptsKids,
    acceptsCouples,
    maxGroupSize: Math.max(
      1,
      Number(row.max_group_size) || Number(row.maxGroupSize) || DEFAULT_MAX_GROUP
    ),
    hourlyRateJpy: hourlyFromBase || DEFAULT_HOURLY_JPY,
    baseRate6hJpy: base6,
    baseRate8hJpy: base8,
    avatarUrl: String(row.avatar_url || row.avatarUrl || "").trim() || undefined,
    status,
    cityOfOperation: String(row.city_of_operation || "").trim() || undefined,
  };
}

/**
 * Score guides against booking language / kids / capacity rules.
 * Soft penalty for language miss; hard DQ for kids or capacity.
 */
export function filterAndScoreGuides(
  booking: GuideMatchBooking,
  allGuides: GuideMatchProfile[]
): GuideMatchResult[] {
  const tourLanguage = normalizeLangCode(booking.language || "EN");
  const partyKids = Math.max(0, Number(booking.paxChildren) || 0);
  const totalPax =
    Math.max(0, Number(booking.paxAdults) || 0) + partyKids || 1;
  const couplesOnly = Boolean(booking.couplesOnly) && partyKids === 0;

  return allGuides
    .map((guide) => {
      let matchScore = 100;
      const disqualifications: string[] = [];
      const matchTags: string[] = [];

      if (guide.status === "OFF_DUTY") {
        matchScore = 0;
        disqualifications.push("Currently off duty");
      }

      const speaks = guide.languages.includes(tourLanguage);
      if (!speaks) {
        matchScore -= 50;
        disqualifications.push(`Does not speak ${tourLanguage}`);
      } else {
        matchTags.push(`${tourLanguage} speaking ✓`);
      }

      if (partyKids > 0) {
        if (!guide.acceptsKids) {
          matchScore = 0;
          disqualifications.push("Does not take tours with children");
        } else {
          matchTags.push("Family friendly ✓");
        }
      }

      if (couplesOnly && guide.acceptsCouples) {
        matchTags.push("Couples OK ✓");
      }

      if (totalPax > guide.maxGroupSize) {
        matchScore = 0;
        disqualifications.push(
          `Group size (${totalPax}) exceeds guide limit (${guide.maxGroupSize})`
        );
      } else if (totalPax > 0) {
        matchTags.push(`Capacity ${totalPax}/${guide.maxGroupSize} ✓`);
      }

      if (guide.status === "ON_TOUR" && matchScore > 0) {
        matchScore = Math.max(10, matchScore - 20);
        matchTags.push("On tour — check availability");
      }

      return {
        guide,
        matchScore: Math.max(0, matchScore),
        isEligible: matchScore > 0,
        disqualifications,
        matchTags,
      };
    })
    .sort((a, b) => {
      if (a.isEligible !== b.isEligible) return a.isEligible ? -1 : 1;
      return b.matchScore - a.matchScore;
    });
}
