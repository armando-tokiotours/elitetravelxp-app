/** Revolut Merchant env helpers (sandbox vs live/prod). */

export type RevolutCheckoutMode = "sandbox" | "prod";

/** Accepts REVOLUT_MERCHANT_SECRET_KEY (preferred) or legacy REVOLUT_SECRET_KEY. */
export function getRevolutMerchantSecret(): string {
  return (
    process.env.REVOLUT_MERCHANT_SECRET_KEY?.trim() ||
    process.env.REVOLUT_SECRET_KEY?.trim() ||
    ""
  );
}

/**
 * NEXT_PUBLIC_REVOLUT_MODE: "sandbox" | "live" | "prod"
 * Revolut embed SDK uses "prod" for both live and prod aliases.
 */
export function getRevolutMode(): RevolutCheckoutMode {
  const raw = (process.env.NEXT_PUBLIC_REVOLUT_MODE || "sandbox")
    .trim()
    .toLowerCase();
  return raw === "live" || raw === "prod" ? "prod" : "sandbox";
}

export function getRevolutMerchantApiBase(mode = getRevolutMode()): string {
  return mode === "prod"
    ? "https://merchant.revolut.com"
    : "https://sandbox-merchant.revolut.com";
}
