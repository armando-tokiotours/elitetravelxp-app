/** Common dial codes for contact / WhatsApp picker (searchable). */

export type CountryDial = {
  iso: string;
  name: string;
  dial: string;
  flag: string;
};

export const COUNTRY_DIAL_CODES: CountryDial[] = [
  { iso: "JP", name: "Japan", dial: "+81", flag: "🇯🇵" },
  { iso: "US", name: "United States", dial: "+1", flag: "🇺🇸" },
  { iso: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { iso: "AU", name: "Australia", dial: "+61", flag: "🇦🇺" },
  { iso: "CA", name: "Canada", dial: "+1", flag: "🇨🇦" },
  { iso: "SG", name: "Singapore", dial: "+65", flag: "🇸🇬" },
  { iso: "HK", name: "Hong Kong", dial: "+852", flag: "🇭🇰" },
  { iso: "TW", name: "Taiwan", dial: "+886", flag: "🇹🇼" },
  { iso: "KR", name: "South Korea", dial: "+82", flag: "🇰🇷" },
  { iso: "CN", name: "China", dial: "+86", flag: "🇨🇳" },
  { iso: "TH", name: "Thailand", dial: "+66", flag: "🇹🇭" },
  { iso: "VN", name: "Vietnam", dial: "+84", flag: "🇻🇳" },
  { iso: "PH", name: "Philippines", dial: "+63", flag: "🇵🇭" },
  { iso: "MY", name: "Malaysia", dial: "+60", flag: "🇲🇾" },
  { iso: "ID", name: "Indonesia", dial: "+62", flag: "🇮🇩" },
  { iso: "IN", name: "India", dial: "+91", flag: "🇮🇳" },
  { iso: "DE", name: "Germany", dial: "+49", flag: "🇩🇪" },
  { iso: "FR", name: "France", dial: "+33", flag: "🇫🇷" },
  { iso: "IT", name: "Italy", dial: "+39", flag: "🇮🇹" },
  { iso: "ES", name: "Spain", dial: "+34", flag: "🇪🇸" },
  { iso: "NL", name: "Netherlands", dial: "+31", flag: "🇳🇱" },
  { iso: "CH", name: "Switzerland", dial: "+41", flag: "🇨🇭" },
  { iso: "AE", name: "United Arab Emirates", dial: "+971", flag: "🇦🇪" },
  { iso: "SA", name: "Saudi Arabia", dial: "+966", flag: "🇸🇦" },
  { iso: "BR", name: "Brazil", dial: "+55", flag: "🇧🇷" },
  { iso: "MX", name: "Mexico", dial: "+52", flag: "🇲🇽" },
  { iso: "NZ", name: "New Zealand", dial: "+64", flag: "🇳🇿" },
];

export const DEFAULT_COUNTRY_DIAL = COUNTRY_DIAL_CODES[0];

export function filterCountryDials(query: string): CountryDial[] {
  const q = query.trim().toLowerCase().replace(/^\+/, "");
  if (!q) return COUNTRY_DIAL_CODES;
  return COUNTRY_DIAL_CODES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.iso.toLowerCase().includes(q) ||
      c.dial.replace("+", "").includes(q) ||
      c.dial.includes(q)
  );
}

/** Split stored WhatsApp into dial + national when possible. */
export function parseWhatsappParts(raw: string): {
  country: CountryDial;
  national: string;
} {
  const cleaned = String(raw || "").trim();
  if (!cleaned) {
    return { country: DEFAULT_COUNTRY_DIAL, national: "" };
  }
  const sorted = [...COUNTRY_DIAL_CODES].sort(
    (a, b) => b.dial.length - a.dial.length
  );
  for (const c of sorted) {
    if (cleaned.startsWith(c.dial)) {
      return {
        country: c,
        national: cleaned.slice(c.dial.length).trim().replace(/^[\s\-]+/, ""),
      };
    }
  }
  if (cleaned.startsWith("+")) {
    return { country: DEFAULT_COUNTRY_DIAL, national: cleaned.replace(/^\+\d{1,4}\s*/, "") };
  }
  return { country: DEFAULT_COUNTRY_DIAL, national: cleaned };
}

export function composeWhatsapp(dial: string, national: string): string {
  const n = national.replace(/[^\d\s\-]/g, "").trim();
  if (!n) return dial;
  return `${dial} ${n}`.trim();
}
