/**
 * staff_profiles.languages is a **text** field (max 500), not a JSON array
 * (see backend/pb_migrations/1790370000_staff_profiles.js). Persist as a
 * comma-separated list of canonical names.
 */

export const STAFF_CREDENTIAL_LANGUAGES = [
  "English",
  "Japanese",
  "Spanish",
  "Dutch",
  "French",
  "German",
  "Mandarin",
  "Korean",
] as const;

export type StaffCredentialLanguage =
  (typeof STAFF_CREDENTIAL_LANGUAGES)[number];

const CANON = new Set<string>(STAFF_CREDENTIAL_LANGUAGES);

const ALIAS: Record<string, StaffCredentialLanguage> = {
  en: "English",
  eng: "English",
  english: "English",
  ja: "Japanese",
  jp: "Japanese",
  japanese: "Japanese",
  es: "Spanish",
  spa: "Spanish",
  spanish: "Spanish",
  nl: "Dutch",
  dutch: "Dutch",
  fr: "French",
  french: "French",
  de: "German",
  german: "German",
  zh: "Mandarin",
  cn: "Mandarin",
  mandarin: "Mandarin",
  chinese: "Mandarin",
  ko: "Korean",
  kr: "Korean",
  korean: "Korean",
};

function canonOne(raw: string): StaffCredentialLanguage | null {
  const t = raw.trim();
  if (!t) return null;
  if (CANON.has(t)) return t as StaffCredentialLanguage;
  const hit = ALIAS[t.toLowerCase()];
  return hit || null;
}

/** Parse stored text, JSON array, or CSV into canonical pill values. */
export function parseStaffLanguages(raw: unknown): StaffCredentialLanguage[] {
  const tokens: string[] = [];
  if (Array.isArray(raw)) {
    for (const x of raw) tokens.push(String(x || ""));
  } else {
    const s = String(raw || "").trim();
    if (!s) return [];
    if (s.startsWith("[")) {
      try {
        const parsed = JSON.parse(s) as unknown;
        if (Array.isArray(parsed)) {
          for (const x of parsed) tokens.push(String(x || ""));
        } else {
          tokens.push(s);
        }
      } catch {
        tokens.push(...s.split(/[,;/|]+/));
      }
    } else {
      tokens.push(...s.split(/[,;/|]+/));
    }
  }
  const out: StaffCredentialLanguage[] = [];
  for (const t of tokens) {
    const c = canonOne(t);
    if (c && !out.includes(c)) out.push(c);
  }
  return STAFF_CREDENTIAL_LANGUAGES.filter((l) => out.includes(l));
}

export function serializeStaffLanguages(
  langs: readonly string[] | null | undefined
): string {
  const set = new Set(langs || []);
  return STAFF_CREDENTIAL_LANGUAGES.filter((l) => set.has(l)).join(", ");
}
