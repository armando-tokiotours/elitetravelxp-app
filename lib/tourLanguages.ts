/** Tour language labels + compact abbreviations for cards. */

export const TOUR_LANGUAGE_OPTIONS = [
  "English",
  "Dutch",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Japanese",
  "Portuguese",
  "Chinese",
  "Korean",
] as const;

export type TourLanguage = (typeof TOUR_LANGUAGE_OPTIONS)[number];

const ABBREV: Record<string, string> = {
  English: "EN",
  Dutch: "NL",
  Spanish: "ES",
  French: "FR",
  German: "DE",
  Italian: "IT",
  Japanese: "JA",
  Portuguese: "PT",
  Chinese: "ZH",
  Korean: "KO",
};

const FLAGS: Record<string, string> = {
  English: "🇬🇧",
  Dutch: "🇳🇱",
  Spanish: "🇪🇸",
  French: "🇫🇷",
  German: "🇩🇪",
  Italian: "🇮🇹",
  Japanese: "🇯🇵",
  Portuguese: "🇵🇹",
  Chinese: "🇨🇳",
  Korean: "🇰🇷",
};

const DEFAULT_CITY_LANGUAGES = [
  "English",
  "Japanese",
  "French",
  "German",
  "Spanish",
  "Italian",
] as const;

export function normalizeTourLanguages(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v).trim()).filter(Boolean);
      }
    } catch {
      /* comma-separated fallback */
    }
    return trimmed
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

/** Compact list for cards: "EN, NL" */
export function formatTourLanguageAbbrev(raw: unknown): string {
  const langs = normalizeTourLanguages(raw);
  if (!langs.length) return "";
  return langs.map((l) => languageToCode(l)).join(", ");
}

/** Full names: "English, Dutch" */
export function formatTourLanguageNames(raw: unknown): string {
  return normalizeTourLanguages(raw).join(", ");
}

/** Map a language name or code to a 2-letter booking code (EN, NL, …). */
export function languageToCode(raw: string): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  if (ABBREV[trimmed]) return ABBREV[trimmed];
  const byCode = Object.entries(ABBREV).find(
    ([, code]) => code.toLowerCase() === trimmed.toLowerCase()
  );
  if (byCode) return byCode[1];
  return trimmed.slice(0, 2).toUpperCase();
}

export function languageFlag(raw: string): string {
  const trimmed = String(raw || "").trim();
  if (FLAGS[trimmed]) return FLAGS[trimmed];
  const byCode = Object.entries(ABBREV).find(
    ([, code]) => code.toLowerCase() === trimmed.toLowerCase()
  );
  if (byCode) return FLAGS[byCode[0]] || "🌐";
  return "🌐";
}

export function languageDisplayLabel(name: string): string {
  const flag = languageFlag(name);
  if (name === "Japanese") return `${flag} 日本語 (Japanese)`;
  if (name === "French") return `${flag} Français (French)`;
  if (name === "German") return `${flag} Deutsch (German)`;
  if (name === "Spanish") return `${flag} Español (Spanish)`;
  if (name === "Italian") return `${flag} Italiano (Italian)`;
  if (name === "English") return `${flag} English (Standard)`;
  return `${flag} ${name}`;
}

/** Codes available for a tour (catalog languages, else English). */
export function tourLanguageChoices(
  raw: unknown
): { name: string; code: string }[] {
  const names = normalizeTourLanguages(raw);
  const source = names.length ? names : ["English"];
  const seen = new Set<string>();
  const out: { name: string; code: string }[] = [];
  for (const name of source) {
    const code = languageToCode(name);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push({ name, code });
  }
  return out;
}

/**
 * City-level languages from PocketBase `cities.available_languages`,
 * falling back to the standard guided set.
 */
export function cityLanguageChoices(
  raw: unknown
): { name: string; code: string; flag: string; label: string }[] {
  const names = normalizeTourLanguages(raw);
  const source = names.length ? names : [...DEFAULT_CITY_LANGUAGES];
  return tourLanguageChoices(source).map(({ name, code }) => ({
    name,
    code,
    flag: languageFlag(name),
    label: languageDisplayLabel(name),
  }));
}
