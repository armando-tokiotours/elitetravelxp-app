/**
 * Canonical Apple Wallet path used by the booking pass + email CTAs.
 * Delegates to generate-pass (signed .pkpass or pass-preview redirect).
 */
export { GET, POST } from "@/app/api/wallet/generate-pass/route";
export const runtime = "nodejs";
