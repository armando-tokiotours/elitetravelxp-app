/**
 * Sequential Single-Day Builder (Builder S) step validation + unlock helpers.
 * Steps: 1 Trip Duration → 2 City Focus → 3 Experiences → 4 Transit
 */

export const SINGLE_DAY_STEP_COUNT = 4;

export const SINGLE_DAY_SECTION_IDS = [
  "",
  "section-duration",
  "section-city-focus",
  "section-experiences",
  "section-transit",
] as const;

export type SingleDayStepSnapshot = {
  tourDate: string | null;
  tourHours: number;
  adults: number;
  cityFocus: string;
  selectedExperienceCount: number;
  experiencesStepDone: boolean;
};

/** Step 1: date + hours + at least one adult. */
export function isSingleDayStep1Complete(s: SingleDayStepSnapshot): boolean {
  return Boolean(s.tourDate && s.tourHours > 0 && s.adults >= 1);
}

/** Step 2: a city focus is set (Tokyo is the default seed). */
export function isSingleDayStep2Complete(s: SingleDayStepSnapshot): boolean {
  return Boolean(s.cityFocus?.trim());
}

/**
 * Highest step the guest may open.
 * 1 always; 2 after trip details; 3 after city; 4 after experiences picked or skipped.
 */
export function getSingleDayHighestUnlocked(s: SingleDayStepSnapshot): number {
  if (!isSingleDayStep1Complete(s)) return 1;
  if (!isSingleDayStep2Complete(s)) return 2;
  if (s.selectedExperienceCount > 0 || s.experiencesStepDone) return 4;
  return 3;
}

export function singleDayStepIncompleteMessage(step: number): string {
  switch (step) {
    case 1:
      return "Set tour date, hours, and guests before continuing.";
    case 2:
      return "Choose a city focus before continuing.";
    case 3:
      return "Pick experiences or tap Continue to skip.";
    default:
      return "Complete the previous steps before unlocking this section.";
  }
}
