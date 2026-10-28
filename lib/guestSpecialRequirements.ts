/**
 * Guest dietary / mobility / notes — persisted as
 * `guest_special_requirements` on PocketBase `bookings` (+ BAL mirror).
 *
 * App shape: `{ hasDietary, hasMobility, mobilityTags, customNotes }`.
 * `hasDietary` / `hasMobility` are `boolean | null` — `null` = not chosen yet
 * (Party & Pace / Builder M must get an explicit Yes or No).
 * Writes also mirror `dietaryTags: hasDietary ? ["Yes"] : []` for legacy readers.
 * Reads tolerate legacy `{ dietaryTags, extrasTags, … }` payloads.
 */

export type GuestSpecialRequirements = {
  hasDietary: boolean | null;
  hasMobility: boolean | null;
  mobilityTags: string[];
  customNotes: string;
};

export const EMPTY_GUEST_SPECIAL_REQUIREMENTS: GuestSpecialRequirements = {
  hasDietary: null,
  hasMobility: null,
  mobilityTags: [],
  customNotes: "",
};

export const MOBILITY_OPTIONS = [
  "Wheelchair Accessible Required",
  "Limited Walking Pace",
  "Senior Friendly / Minimal Stairs",
  "Elevators Needed",
] as const;

function asStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => String(x || "").trim())
    .filter(Boolean);
}

function asBoolean(raw: unknown): boolean | null {
  if (raw === true || raw === false) return raw;
  if (typeof raw === "string") {
    const t = raw.trim().toLowerCase();
    if (t === "true" || t === "yes" || t === "1") return true;
    if (t === "false" || t === "no" || t === "0") return false;
  }
  return null;
}

/**
 * Read tri-state from camel/snake keys.
 * - `undefined` = key absent (legacy payload)
 * - `null` = explicit unset
 * - `boolean` = chosen
 */
function readTriState(
  o: Record<string, unknown>,
  camel: string,
  snake: string
): boolean | null | undefined {
  if (!(camel in o) && !(snake in o)) return undefined;
  const raw = o[camel] ?? o[snake];
  if (raw === null || raw === undefined || raw === "") return null;
  return asBoolean(raw);
}

/** True when both Dietary and Mobility have an explicit Yes or No. */
export function guestSpecialRequirementsChoicesComplete(
  reqs: GuestSpecialRequirements | null | undefined
): boolean {
  if (!reqs) return false;
  return (
    (reqs.hasDietary === true || reqs.hasDietary === false) &&
    (reqs.hasMobility === true || reqs.hasMobility === false)
  );
}

/** Tab / pill badge: Yes · No · ? (pending). */
export function guestSpecialRequirementsChoiceBadge(
  value: boolean | null | undefined
): "Yes" | "No" | "?" {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "?";
}

/**
 * Legacy default No/No with no tags/notes and never acked → treat as unset
 * so Party & Pace opens with Pending instead of pre-selected No.
 */
export function migrateUnsetGuestSpecialRequirements(
  reqs: GuestSpecialRequirements | null | undefined,
  acked: boolean
): GuestSpecialRequirements {
  const n = normalizeGuestSpecialRequirements(reqs);
  if (acked) return n;
  if (
    n.hasDietary === false &&
    n.hasMobility === false &&
    n.mobilityTags.length === 0 &&
    !n.customNotes.trim()
  ) {
    return { ...EMPTY_GUEST_SPECIAL_REQUIREMENTS };
  }
  return n;
}

/** True when dietary notes should be visible (Dietary=Yes only). */
export function guestSpecialRequirementsNotesVisible(
  reqs: GuestSpecialRequirements | null | undefined
): boolean {
  if (!reqs) return false;
  return reqs.hasDietary === true;
}

/** True when Dietary=Yes — notes are required to proceed. Mobility alone does not require notes. */
export function guestSpecialRequirementsNotesRequired(
  reqs: GuestSpecialRequirements | null | undefined
): boolean {
  if (!reqs) return false;
  return reqs.hasDietary === true;
}

/**
 * Notes must be non-empty only when Dietary=Yes.
 * Mobility=Yes with zero tags is allowed (tags optional after Yes).
 * Unselected dietary does not require notes.
 */
export function guestSpecialRequirementsNotesValid(
  reqs: GuestSpecialRequirements | null | undefined
): boolean {
  if (!guestSpecialRequirementsNotesRequired(reqs)) return true;
  return Boolean(reqs?.customNotes?.trim());
}

export function guestSpecialRequirementsValidationError(
  reqs: GuestSpecialRequirements | null | undefined
): string | null {
  if (guestSpecialRequirementsNotesValid(reqs)) return null;
  return "Describe dietary needs or allergies — required when Dietary is Yes.";
}

/** One-line UI status: `Dietary: Pending | Mobility: No` etc. */
export function formatGuestSpecialRequirementsStatusLine(
  reqs: GuestSpecialRequirements | null | undefined
): string {
  const n = normalizeGuestSpecialRequirements(reqs);
  const dietary =
    n.hasDietary === null ? "Pending" : n.hasDietary ? "Yes" : "No";
  let mobility: string;
  if (n.hasMobility === null) {
    mobility = "Pending";
  } else if (n.hasMobility || n.mobilityTags.length > 0) {
    mobility =
      n.mobilityTags.length > 0 ? n.mobilityTags.join(", ") : "Yes";
  } else {
    mobility = "No";
  }
  return `Dietary: ${dietary} | Mobility: ${mobility}`;
}

/** Normalize any partial / PB / legacy payload into the app shape. */
export function normalizeGuestSpecialRequirements(
  raw: unknown
): GuestSpecialRequirements {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return { ...EMPTY_GUEST_SPECIAL_REQUIREMENTS };
    try {
      return normalizeGuestSpecialRequirements(JSON.parse(trimmed));
    } catch {
      return {
        ...EMPTY_GUEST_SPECIAL_REQUIREMENTS,
        customNotes: trimmed,
      };
    }
  }
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_GUEST_SPECIAL_REQUIREMENTS };
  }
  const o = raw as Record<string, unknown>;
  const mobilityTags = asStringArray(o.mobilityTags ?? o.mobility_tags);
  const legacyDietary = asStringArray(o.dietaryTags ?? o.dietary_tags);
  // Ignore legacy extrasTags entirely.
  const dietaryRaw = readTriState(o, "hasDietary", "has_dietary");
  const mobilityRaw = readTriState(o, "hasMobility", "has_mobility");

  let hasDietary: boolean | null;
  if (dietaryRaw === undefined) {
    hasDietary = legacyDietary.length > 0 ? true : false;
  } else {
    hasDietary = dietaryRaw === true ? true : dietaryRaw === false ? false : null;
    if (hasDietary === null && legacyDietary.length > 0) hasDietary = true;
  }

  let hasMobility: boolean | null;
  if (mobilityRaw === undefined) {
    hasMobility = mobilityTags.length > 0 ? true : false;
  } else if (mobilityRaw === null) {
    hasMobility = null;
  } else {
    hasMobility = mobilityRaw || mobilityTags.length > 0;
  }

  // Unselected mobility cannot keep tags.
  const tags = hasMobility === true ? mobilityTags : [];

  return {
    hasDietary,
    hasMobility,
    mobilityTags: tags,
    customNotes: String(o.customNotes ?? o.custom_notes ?? "").trim(),
  };
}

/**
 * Persist shape for PB / selections JSON.
 * Coerces unset (null) → false for storage. Mirrors dietaryTags for older readers.
 */
export function serializeGuestSpecialRequirements(
  raw: unknown
): GuestSpecialRequirements & { dietaryTags: string[] } {
  const n = normalizeGuestSpecialRequirements(raw);
  const hasDietary = n.hasDietary === true;
  const hasMobility = n.hasMobility === true || n.mobilityTags.length > 0;
  return {
    hasDietary,
    hasMobility,
    mobilityTags: hasMobility ? n.mobilityTags : [],
    customNotes: n.customNotes,
    dietaryTags: hasDietary ? ["Yes"] : [],
  };
}

export function hasGuestSpecialRequirements(
  reqs: GuestSpecialRequirements | null | undefined
): boolean {
  if (!reqs) return false;
  const n = normalizeGuestSpecialRequirements(reqs);
  return (
    n.hasDietary === true ||
    n.hasMobility === true ||
    n.mobilityTags.length > 0 ||
    Boolean(n.customNotes.trim())
  );
}

/** Legacy Builder specialNeeds ids → structured mobility tags. */
export function guestReqsFromLegacySpecialNeeds(
  specialNeeds?: string[] | null
): GuestSpecialRequirements {
  const ids = Array.isArray(specialNeeds) ? specialNeeds : [];
  if (ids.length === 0) {
    return { ...EMPTY_GUEST_SPECIAL_REQUIREMENTS };
  }
  if (ids.includes("none")) {
    // Explicit “none” → answered No / No (not pending).
    return {
      hasDietary: false,
      hasMobility: false,
      mobilityTags: [],
      customNotes: "",
    };
  }
  const mobilityTags: string[] = [];
  if (ids.includes("reduced_mobility")) {
    mobilityTags.push("Wheelchair Accessible Required");
  }
  if (ids.includes("senior")) {
    mobilityTags.push("Senior Friendly / Minimal Stairs");
  }
  // baby_car_seat and other extras are retired — ignore.
  return {
    hasDietary: false,
    hasMobility: mobilityTags.length > 0,
    mobilityTags,
    customNotes: "",
  };
}

/**
 * Keep chauffeur / mobility heuristics working via legacy specialNeeds[].
 */
export function legacySpecialNeedsFromGuestReqs(
  reqs: GuestSpecialRequirements
): Array<"reduced_mobility" | "baby_car_seat" | "senior" | "none"> {
  const n = normalizeGuestSpecialRequirements(reqs);
  if (!hasGuestSpecialRequirements(n)) return ["none"];
  const out: Array<"reduced_mobility" | "senior"> = [];
  const mob = n.mobilityTags.join(" ").toLowerCase();
  if (/wheelchair|limited walking|elevator|stairs|mobility/.test(mob)) {
    out.push("reduced_mobility");
  }
  if (/senior/.test(mob)) {
    out.push("senior");
  }
  return out.length > 0 ? out : ["none"];
}

/** Flat staff-facing summary (guide/driver mobilityNotes). */
export function formatGuestSpecialRequirementsSummary(
  reqs: GuestSpecialRequirements | null | undefined
): string {
  const n = normalizeGuestSpecialRequirements(reqs);
  if (!hasGuestSpecialRequirements(n)) {
    return "No special requirements specified by client";
  }
  const parts: string[] = [];
  if (n.hasDietary === true) parts.push("Dietary needs: Yes");
  parts.push(...n.mobilityTags);
  const notes = n.customNotes.trim();
  if (notes) parts.push(notes);
  return parts.join(" · ");
}

export function formatGuestSpecialRequirementsMobility(
  reqs: GuestSpecialRequirements | null | undefined
): string {
  const n = normalizeGuestSpecialRequirements(reqs);
  if (n.mobilityTags.length === 0) {
    return hasGuestSpecialRequirements(n)
      ? "—"
      : "No special requirements specified by client";
  }
  return n.mobilityTags.join(", ");
}
