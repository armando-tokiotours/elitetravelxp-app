/**
 * Itinerary action gates — builder complete + payment configured.
 */

import {
  BUILDER_ALL_STEPS_COMPLETE,
  isBuilderStepComplete,
  type BuilderStepSnapshot,
} from "@/lib/builderSteps";
import {
  getSingleDayHighestUnlocked,
  type SingleDayStepSnapshot,
} from "@/lib/singleDaySteps";

export function isMultiDayBuilderComplete(
  highestUnlockedStep: number,
  snapshot: BuilderStepSnapshot
): boolean {
  if (highestUnlockedStep < BUILDER_ALL_STEPS_COMPLETE) return false;
  // Re-check core steps 1–4 still valid
  for (let s = 1; s <= 4; s++) {
    if (!isBuilderStepComplete(s, snapshot)) return false;
  }
  return true;
}

export function isSingleDayBuilderComplete(
  snapshot: SingleDayStepSnapshot
): boolean {
  return getSingleDayHighestUnlocked(snapshot) >= 4;
}

let paymentCache: { at: number; configured: boolean } | null = null;

/** Client-side: probe /api/revolut/status (cached ~60s). */
export async function fetchPaymentConfigured(): Promise<boolean> {
  const now = Date.now();
  if (paymentCache && now - paymentCache.at < 60_000) {
    return paymentCache.configured;
  }
  try {
    const res = await fetch("/api/revolut/status", { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as {
      configured?: boolean;
    };
    const configured = Boolean(data.configured);
    paymentCache = { at: now, configured };
    return configured;
  } catch {
    return false;
  }
}
