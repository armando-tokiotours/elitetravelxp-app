/**
 * Context-aware return handling for the public FAQ page (`/faq`).
 *
 * Entry points link to `/faq?from=<encoded current path+query>` (or the
 * legacy alias `returnUrl=`). The FAQ Back button only ever navigates to a
 * sanitised internal path — never to an external/open-redirect URL.
 */

const MAX_RETURN_URL_LENGTH = 2048;
/** Booking refs look like `JPN-XXXXXX` (prefix + dash + code). */
const PNR_PATTERN = /^[A-Z]{2,4}-[A-Z0-9][A-Z0-9-]{2,}$/;

/**
 * Safely decode + validate a candidate return URL.
 * Returns the internal path (with query/hash) or `null` when unsafe/empty.
 * Only paths starting with a single `/` are allowed (`//evil.com`,
 * `/\evil.com`, `https://…`, `javascript:…` etc. are rejected), as is
 * looping back to `/faq` itself.
 */
export function sanitizeInternalReturnUrl(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  let decoded = raw.trim();
  if (!decoded) return null;
  // Search params arrive already decoded once; decode once more so a
  // double-encoded `//` is revealed (and rejected below), but never throw.
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return null;
  }
  if (decoded.length === 0 || decoded.length > MAX_RETURN_URL_LENGTH) {
    return null;
  }
  // Control chars / whitespace anywhere, protocol URLs, and backslash tricks.
  if (/[\s\u0000-\u001f\u007f]/.test(decoded)) return null;
  if (decoded.includes("://")) return null;
  if (!decoded.startsWith("/")) return null;
  if (decoded.startsWith("//") || decoded.startsWith("/\\")) return null;
  if (decoded.includes("\\")) return null;
  // Never "return" to the FAQ page itself.
  const pathOnly = decoded.split(/[?#]/, 1)[0];
  if (pathOnly === "/faq" || pathOnly.startsWith("/faq/")) return null;
  return decoded;
}

/** Normalise a candidate booking ref, or return null when it isn't PNR-like. */
function normalizePnr(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  const value = candidate.trim().toUpperCase();
  if (!value || value.length > 32) return null;
  return PNR_PATTERN.test(value) ? value : null;
}

/**
 * Extract a booking PNR for the Back label: an explicit `ref`/`pnr` value
 * wins, otherwise look for `ref=`/`pnr=` inside the return URL's query.
 */
export function extractBookingRef(
  returnUrl: string | null,
  explicitRef?: string | null,
): string | null {
  const explicit = normalizePnr(explicitRef);
  if (explicit) return explicit;
  if (!returnUrl) return null;
  try {
    const url = new URL(returnUrl, "https://internal.local");
    return (
      normalizePnr(url.searchParams.get("ref")) ??
      normalizePnr(url.searchParams.get("pnr"))
    );
  } catch {
    return null;
  }
}

/**
 * Build the FAQ href for an entry point from the current path + query
 * (e.g. `/builder/japan-journey/itinerary?ref=JPN-123456`).
 * Falls back to plain `/faq` when there is nothing safe to return to.
 */
export function buildFaqHref(currentPathWithQuery: string | null | undefined): string {
  const safe = sanitizeInternalReturnUrl(currentPathWithQuery);
  if (!safe) return "/faq";
  return `/faq?from=${encodeURIComponent(safe)}`;
}
