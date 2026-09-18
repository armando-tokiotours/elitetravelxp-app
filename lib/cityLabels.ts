/**
 * Resolve PocketBase city record IDs to human-readable labels.
 * Includes a production fallback map so dossier/invoice never flash raw IDs
 * while builder config is still loading (or if the cities fetch fails).
 */

/** Production city ids → names (kept in sync with PocketBase `cities`). */
export const KNOWN_CITY_LABELS: Record<string, string> = {
  "8z0mms825khn3gh": "Tokyo",
  "8d2ksmk1s0830u5": "Kamakura",
  qfz5867oanih18i: "Nikko",
  "8ackk082b773xtr": "Hakone",
  flt6q7678iek7od: "Kawaguchiko (Mt. Fuji)",
  "5b7b33b74e54z00": "Kyoto",
  "6hb505bnde64fg4": "Osaka",
  "0u28djfyqu333ik": "Nara",
  so734m9no2vbri3: "Takayama",
  o69tc579d483x2b: "Kanazawa",
  "1oe7v7aa6j40vma": "Hiroshima",
  "7y5jna11db50531": "Miyajima",
  x63rr728b97382p: "Fukuoka",
  lxg76zl753q8c6g: "Nagasaki",
  h57pxn9p8204zo1: "Hakodate",
};

const PB_ID_RE = /^[a-z0-9]{15}$/i;

export function buildCityMap(
  cities?: Array<{ id: string; name?: string }> | null
): Record<string, string> {
  const map: Record<string, string> = { ...KNOWN_CITY_LABELS };
  for (const c of cities ?? []) {
    const name = (c.name || "").trim();
    if (c.id && name) map[c.id] = name;
  }
  return map;
}

/** Prefer live map, then known fallbacks; never render a raw PocketBase id. */
export function getCityName(
  idOrName: string | null | undefined,
  cityMap?: Record<string, string> | null
): string {
  const raw = (idOrName || "").trim();
  if (!raw) return "City";
  if (cityMap?.[raw]) return cityMap[raw];
  if (KNOWN_CITY_LABELS[raw]) return KNOWN_CITY_LABELS[raw];
  if (PB_ID_RE.test(raw)) return "City";
  return raw;
}
