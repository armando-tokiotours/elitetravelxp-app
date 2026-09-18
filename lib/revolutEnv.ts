/** Revolut Merchant env helpers (sandbox vs live/prod). */

export type RevolutCheckoutMode = "sandbox" | "prod";

/** Strip accidental quotes from .env values (Docker/dotenv pitfall). */
function envVal(key: string): string | undefined {
  const raw = process.env[key]?.trim();
  if (!raw) return undefined;
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1).trim() || undefined;
  }
  return raw;
}

/**
 * Accepts REVOLUT_MERCHANT_SECRET_KEY (preferred) or legacy REVOLUT_SECRET_KEY.
 * No hardcoded fake key — a placeholder would still fail Revolut auth.
 */
export function getRevolutMerchantSecret(): string {
  return (
    envVal("REVOLUT_MERCHANT_SECRET_KEY") ||
    envVal("REVOLUT_SECRET_KEY") ||
    ""
  );
}

/**
 * NEXT_PUBLIC_REVOLUT_MODE: "sandbox" | "live" | "prod"
 * Revolut embed SDK uses "prod" for both live and prod aliases.
 */
export function getRevolutMode(): RevolutCheckoutMode {
  const raw = (envVal("NEXT_PUBLIC_REVOLUT_MODE") || "sandbox").toLowerCase();
  return raw === "live" || raw === "prod" ? "prod" : "sandbox";
}

export function getRevolutMerchantApiBase(mode = getRevolutMode()): string {
  return mode === "prod"
    ? "https://merchant.revolut.com"
    : "https://sandbox-merchant.revolut.com";
}
