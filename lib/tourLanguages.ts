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

export function normalizeTourLanguages(
  raw: unknown
): string[] {
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

/** Codes available for a tour (catalog languages, else English). */
export function tourLanguageChoices(raw: unknown): { name: string; code: string }[] {
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
