/**
 * Compact dial-code catalog for phone country picker.
 * Search matches name, ISO, or digits (e.g. "81", "japan", "jp").
 */

export type DialCode = {
  iso: string;
  name: string;
  dial: string;
  flag: string;
};

export const DIAL_CODES: DialCode[] = [
  { iso: "JP", name: "Japan", dial: "81", flag: "🇯🇵" },
  { iso: "US", name: "United States", dial: "1", flag: "🇺🇸" },
  { iso: "GB", name: "United Kingdom", dial: "44", flag: "🇬🇧" },
  { iso: "AU", name: "Australia", dial: "61", flag: "🇦🇺" },
  { iso: "SG", name: "Singapore", dial: "65", flag: "🇸🇬" },
  { iso: "KR", name: "South Korea", dial: "82", flag: "🇰🇷" },
  { iso: "TW", name: "Taiwan", dial: "886", flag: "🇹🇼" },
  { iso: "HK", name: "Hong Kong", dial: "852", flag: "🇭🇰" },
  { iso: "CN", name: "China", dial: "86", flag: "🇨🇳" },
  { iso: "TH", name: "Thailand", dial: "66", flag: "🇹🇭" },
  { iso: "VN", name: "Vietnam", dial: "84", flag: "🇻🇳" },
  { iso: "PH", name: "Philippines", dial: "63", flag: "🇵🇭" },
  { iso: "MY", name: "Malaysia", dial: "60", flag: "🇲🇾" },
  { iso: "ID", name: "Indonesia", dial: "62", flag: "🇮🇩" },
  { iso: "IN", name: "India", dial: "91", flag: "🇮🇳" },
  { iso: "AE", name: "United Arab Emirates", dial: "971", flag: "🇦🇪" },
  { iso: "SA", name: "Saudi Arabia", dial: "966", flag: "🇸🇦" },
  { iso: "QA", name: "Qatar", dial: "974", flag: "🇶🇦" },
  { iso: "FR", name: "France", dial: "33", flag: "🇫🇷" },
  { iso: "DE", name: "Germany", dial: "49", flag: "🇩🇪" },
  { iso: "IT", name: "Italy", dial: "39", flag: "🇮🇹" },
  { iso: "ES", name: "Spain", dial: "34", flag: "🇪🇸" },
  { iso: "PT", name: "Portugal", dial: "351", flag: "🇵🇹" },
  { iso: "NL", name: "Netherlands", dial: "31", flag: "🇳🇱" },
  { iso: "BE", name: "Belgium", dial: "32", flag: "🇧🇪" },
  { iso: "CH", name: "Switzerland", dial: "41", flag: "🇨🇭" },
  { iso: "AT", name: "Austria", dial: "43", flag: "🇦🇹" },
  { iso: "SE", name: "Sweden", dial: "46", flag: "🇸🇪" },
  { iso: "NO", name: "Norway", dial: "47", flag: "🇳🇴" },
  { iso: "DK", name: "Denmark", dial: "45", flag: "🇩🇰" },
  { iso: "FI", name: "Finland", dial: "358", flag: "🇫🇮" },
  { iso: "IE", name: "Ireland", dial: "353", flag: "🇮🇪" },
  { iso: "PL", name: "Poland", dial: "48", flag: "🇵🇱" },
  { iso: "CZ", name: "Czechia", dial: "420", flag: "🇨🇿" },
  { iso: "GR", name: "Greece", dial: "30", flag: "🇬🇷" },
  { iso: "TR", name: "Türkiye", dial: "90", flag: "🇹🇷" },
  { iso: "RU", name: "Russia", dial: "7", flag: "🇷🇺" },
  { iso: "UA", name: "Ukraine", dial: "380", flag: "🇺🇦" },
  { iso: "CA", name: "Canada", dial: "1", flag: "🇨🇦" },
  { iso: "MX", name: "Mexico", dial: "52", flag: "🇲🇽" },
  { iso: "BR", name: "Brazil", dial: "55", flag: "🇧🇷" },
  { iso: "AR", name: "Argentina", dial: "54", flag: "🇦🇷" },
  { iso: "CL", name: "Chile", dial: "56", flag: "🇨🇱" },
  { iso: "CO", name: "Colombia", dial: "57", flag: "🇨🇴" },
  { iso: "PE", name: "Peru", dial: "51", flag: "🇵🇪" },
  { iso: "NZ", name: "New Zealand", dial: "64", flag: "🇳🇿" },
  { iso: "ZA", name: "South Africa", dial: "27", flag: "🇿🇦" },
  { iso: "EG", name: "Egypt", dial: "20", flag: "🇪🇬" },
  { iso: "IL", name: "Israel", dial: "972", flag: "🇮🇱" },
  { iso: "PK", name: "Pakistan", dial: "92", flag: "🇵🇰" },
  { iso: "BD", name: "Bangladesh", dial: "880", flag: "🇧🇩" },
  { iso: "LK", name: "Sri Lanka", dial: "94", flag: "🇱🇰" },
  { iso: "NP", name: "Nepal", dial: "977", flag: "🇳🇵" },
  { iso: "KH", name: "Cambodia", dial: "855", flag: "🇰🇭" },
  { iso: "LA", name: "Laos", dial: "856", flag: "🇱🇦" },
  { iso: "MM", name: "Myanmar", dial: "95", flag: "🇲🇲" },
  { iso: "MO", name: "Macao", dial: "853", flag: "🇲🇴" },
];

/** Longest dial first so "+886" wins over "+81" / "+8". */
const BY_DIAL_LEN = [...DIAL_CODES].sort(
  (a, b) => b.dial.length - a.dial.length
);

export function findDialCode(isoOrDial: string): DialCode | undefined {
  const q = isoOrDial.trim().toUpperCase();
  return (
    DIAL_CODES.find((c) => c.iso === q) ||
    DIAL_CODES.find((c) => c.dial === isoOrDial.replace(/^\+/, "").trim())
  );
}

export function filterDialCodes(query: string): DialCode[] {
  const q = query.trim().toLowerCase().replace(/^\+/, "");
  if (!q) return DIAL_CODES;
  return DIAL_CODES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.iso.toLowerCase().includes(q) ||
      c.dial.includes(q)
  );
}

/** Split stored "+81 90…" into country + national digits. Default JP. */
export function parsePhoneValue(raw: string): {
  country: DialCode;
  national: string;
} {
  const cleaned = String(raw || "").trim();
  const digits = cleaned.replace(/[^\d+]/g, "");
  const withPlus = digits.startsWith("+") ? digits : digits ? `+${digits}` : "";

  if (withPlus) {
    for (const c of BY_DIAL_LEN) {
      const prefix = `+${c.dial}`;
      if (withPlus === prefix || withPlus.startsWith(prefix)) {
        const rest = withPlus.slice(prefix.length).replace(/\D/g, "");
        return { country: c, national: rest };
      }
    }
  }

  const nationalOnly = cleaned.replace(/\D/g, "");
  return {
    country: DIAL_CODES[0],
    national: nationalOnly,
  };
}

export function formatPhoneValue(country: DialCode, national: string): string {
  const n = national.replace(/\D/g, "").replace(/^0+/, "");
  if (!n) return `+${country.dial}`;
  return `+${country.dial} ${n}`;
}

export function isValidPhoneValue(raw: string): boolean {
  const { country, national } = parsePhoneValue(raw);
  // At least 6 national digits after stripping leading zeros
  const n = national.replace(/\D/g, "");
  return Boolean(country && n.length >= 6 && n.length <= 15);
}
