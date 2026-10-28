/**
 * Display FX for guest UI. Amounts in the app are stored/calculated in EUR.
 * Rates are approximate constants for instant client-side conversion — not live FX.
 */
export type DisplayCurrency = "EUR" | "USD" | "CAD" | "AUD";

/** Approximate EUR → display currency multipliers (display only). */
export const APPROX_RATES: Record<DisplayCurrency, number> = {
  EUR: 1,
  USD: 1.08,
  CAD: 1.46,
  AUD: 1.65,
};

export const DISPLAY_CURRENCIES: readonly DisplayCurrency[] = [
  "EUR",
  "USD",
  "CAD",
  "AUD",
] as const;

export const CURRENCY_STORAGE_KEY = "tokiotours_display_currency";

const LOCALE_BY_CURRENCY: Record<DisplayCurrency, string> = {
  EUR: "en-EU",
  USD: "en-US",
  CAD: "en-CA",
  AUD: "en-AU",
};

export function isDisplayCurrency(value: unknown): value is DisplayCurrency {
  return (
    typeof value === "string" &&
    (DISPLAY_CURRENCIES as readonly string[]).includes(value)
  );
}

/** Convert an EUR amount using approximate display rates. */
export function convertFromEur(
  amountInEur: number,
  currency: DisplayCurrency
): number {
  const n = Number(amountInEur);
  if (!Number.isFinite(n)) return 0;
  return n * APPROX_RATES[currency];
}

/** Format an EUR-denominated amount in the selected display currency. */
export function formatPriceInCurrency(
  amountInEur: number,
  currency: DisplayCurrency
): string {
  const converted = convertFromEur(amountInEur, currency);
  return new Intl.NumberFormat(LOCALE_BY_CURRENCY[currency], {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Math.round(converted));
}
