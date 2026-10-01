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
  isSingleDayStep1Complete,
  isSingleDayStep2Complete,
  type SingleDayStepSnapshot,
} from "@/lib/singleDaySteps";
import { getSystemMessage } from "@/lib/systemMessages";

const MULTI_DAY_SECTION_NAMES = [
  "",
  "Days & Dates",
  "Arrival & Departure",
  "Locations & Nights",
  "Hotels",
  "Tours & Experiences",
  "Transport",
] as const;

/** Sections still blocking itinerary send / invoice. */
export function incompleteMultiDaySectionLabels(
  highestUnlockedStep: number,
  snapshot: BuilderStepSnapshot
): string[] {
  const left: string[] = [];
  const push = (name: string) => {
    if (!left.includes(name)) left.push(name);
  };

  for (let s = 1; s <= 4; s++) {
    if (!isBuilderStepComplete(s, snapshot)) {
      push(MULTI_DAY_SECTION_NAMES[s]);
    }
  }

  // Unlock gate: guest must Continue through remaining widgets
  if (highestUnlockedStep < 5) {
    push("Hotels");
  }
  if (highestUnlockedStep < 6) {
    push("Tours & Experiences");
    push("Transport");
  }
  // Complete = unlocked to 7 after Transport Done (all legs self/public/private)
  if (highestUnlockedStep < BUILDER_ALL_STEPS_COMPLETE) {
    push("Transport");
  }

  return left;
}

export function multiDayIncompleteFoxMessage(
  highestUnlockedStep: number,
  snapshot: BuilderStepSnapshot
): string {
  const left = incompleteMultiDaySectionLabels(
    highestUnlockedStep,
    snapshot
  );
  if (left.length === 0) {
    return getSystemMessage("builder_incomplete");
  }
  if (left.length === 1) return `Still need: ${left[0]}.`;
  if (left.length === 2) {
    return `Still need: ${left[0]} and ${left[1]}.`;
  }
  const last = left[left.length - 1];
  return `Still need: ${left.slice(0, -1).join(", ")}, and ${last}.`;
}

export function incompleteSingleDaySectionLabels(
  snapshot: SingleDayStepSnapshot
): string[] {
  const left: string[] = [];
  if (!isSingleDayStep1Complete(snapshot)) left.push("Hours & Date");
  if (!isSingleDayStep2Complete(snapshot)) left.push("City Focus");
  if (
    !snapshot.experiencesStepDone &&
    snapshot.selectedExperienceCount <= 0
  ) {
    left.push("Tours & Experiences");
  }
  if (getSingleDayHighestUnlocked(snapshot) < 4) {
    if (!left.includes("Tours & Experiences")) left.push("Tours & Experiences");
    left.push("Transport");
  }
  return left;
}

export function singleDayIncompleteFoxMessage(
  snapshot: SingleDayStepSnapshot
): string {
  const left = incompleteSingleDaySectionLabels(snapshot);
  if (left.length === 0) {
    return getSystemMessage("builder_incomplete");
  }
  if (left.length === 1) return `Still need: ${left[0]}.`;
  if (left.length === 2) {
    return `Still need: ${left[0]} and ${left[1]}.`;
  }
  const last = left[left.length - 1];
  return `Still need: ${left.slice(0, -1).join(", ")}, and ${last}.`;
}

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
