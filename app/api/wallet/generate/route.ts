/**
 * Alias for email / deep links that use `/api/wallet/generate`.
 * Delegates to generate-pass (signed .pkpass or pass-preview redirect).
 */
export { GET, POST } from "@/app/api/wallet/generate-pass/route";
export const runtime = "nodejs";
