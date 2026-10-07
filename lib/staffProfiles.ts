/**
 * staff_profiles — person profile (bio, languages, media, bank). Not booking data.
 *
 * Name fields (snake_case, matching PocketBase):
 * - first_name / last_name — source of truth for guest privacy (locked → first only)
 * - display_name — combined `${first} ${last}` kept in sync on save for older UIs
 *
 * languages: PocketBase **text** (comma-separated canonical names). See
 * lib/staffLanguages.ts — not a JSON field.
 *
 * Empty `video_url` / `payment_link` must be omitted (url fields reject "").
 * File `photo`/`video` must go as FormData, never JSON.
 *
 * Client JWT cannot update another person's `staff` auth row (`manageRule: null`).
 * Credential booklet writes go through /api/staff/credential + /api/staff/avatar
 * (admin client). This helper is for admin/server or self-edit when rules allow.
 */

import type PocketBase from "pocketbase";

export type StaffProfile = {
  id: string;
  staff_id: string;
  /** Combined display; synced from first_name + last_name on credential save. */
  display_name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  bio?: string;
  languages?: string;
  strength_cities?: string;
  photo?: string;
  updated?: string;
  video?: string;
  video_url?: string;
  bank_info?: string;
  payment_link?: string;
  payout_notes?: string;
};

/** Combine first + last into display_name (back-compat). */
export function combineStaffDisplayName(
  first?: string | null,
  last?: string | null
): string {
  return `${String(first || "").trim()} ${String(last || "").trim()}`.trim();
}

/**
 * Editor-only fallback when first_name/last_name are empty but display_name
 * (or staff.name) is present: first whitespace token → first, remainder → last.
 * Lets Ops fix multi-part surnames in the booklet. Do NOT use for guest privacy
 * masking — once first_name is set, guests must use that field.
 */
export function splitDisplayNameForEditor(displayName?: string | null): {
  first_name: string;
  last_name: string;
} {
  const raw = String(displayName || "").trim();
  if (!raw) return { first_name: "", last_name: "" };
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { first_name: parts[0], last_name: "" };
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  };
}

/**
 * Resolve name parts for the credential editor.
 * Prefers stored first_name/last_name; otherwise one-time display_name split.
 */
export function resolveStaffNamePartsForEditor(input: {
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  fallbackName?: string | null;
}): { first_name: string; last_name: string; display_name: string } {
  const first = String(input.first_name || "").trim();
  const last = String(input.last_name || "").trim();
  if (first || last) {
    return {
      first_name: first,
      last_name: last,
      display_name:
        combineStaffDisplayName(first, last) ||
        String(input.display_name || input.fallbackName || "").trim(),
    };
  }
  const split = splitDisplayNameForEditor(
    input.display_name || input.fallbackName
  );
  return {
    first_name: split.first_name,
    last_name: split.last_name,
    display_name:
      String(input.display_name || input.fallbackName || "").trim() ||
      combineStaffDisplayName(split.first_name, split.last_name),
  };
}

function pbStatus(err: unknown): number {
  return Number((err as { status?: number } | null)?.status || 0);
}

function isNotFound(err: unknown): boolean {
  return pbStatus(err) === 404;
}

export async function getStaffProfile(
  pb: PocketBase,
  staffId: string
): Promise<StaffProfile | null> {
  try {
    return await pb
      .collection("staff_profiles")
      .getFirstListItem<StaffProfile>(`staff_id="${staffId}"`, {
        requestKey: null,
      });
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
}

/**
 * Load profile; create only when missing (404). Never creates a login user.
 * On create race / unique conflict, re-fetches instead of failing hard.
 */
export async function ensureStaffProfile(
  pb: PocketBase,
  staffId: string,
  seed?: {
    display_name?: string;
    first_name?: string;
    last_name?: string;
  }
): Promise<StaffProfile> {
  const id = String(staffId || "").trim();
  if (!id) throw new Error("staff_id required");

  const existing = await getStaffProfile(pb, id);
  if (existing) return existing;

  const first = String(seed?.first_name || "").trim();
  const last = String(seed?.last_name || "").trim();
  const display =
    String(seed?.display_name || "").trim() ||
    combineStaffDisplayName(first, last);

  try {
    return (await pb.collection("staff_profiles").create(
      {
        staff_id: id,
        display_name: display,
        ...(first ? { first_name: first } : {}),
        ...(last ? { last_name: last } : {}),
      },
      { requestKey: null }
    )) as StaffProfile;
  } catch (createErr) {
    const raced = await getStaffProfile(pb, id);
    if (raced) return raced;
    throw createErr;
  }
}

export function staffPhotoFilename(photo: unknown): string {
  if (Array.isArray(photo)) return String(photo[0] || "").trim();
  return String(photo || "").trim();
}

export async function updateStaffProfile(
  pb: PocketBase,
  staffId: string,
  patch: Partial<Omit<StaffProfile, "id" | "staff_id">>,
  fileFields?: { photo?: File | null; video?: File | null }
): Promise<StaffProfile> {
  const row = await ensureStaffProfile(pb, staffId);
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (
      (k === "video_url" || k === "payment_link") &&
      (v === null || String(v).trim() === "")
    ) {
      continue;
    }
    clean[k] = v;
  }
  let next = row;
  if (Object.keys(clean).length > 0) {
    next = (await pb
      .collection("staff_profiles")
      .update(row.id, clean, { requestKey: null })) as StaffProfile;
  }
  if (fileFields?.photo || fileFields?.video) {
    const fd = new FormData();
    if (fileFields.photo) fd.append("photo", fileFields.photo);
    if (fileFields.video) fd.append("video", fileFields.video);
    next = (await pb
      .collection("staff_profiles")
      .update(row.id, fd, { requestKey: null })) as StaffProfile;
  }
  return next;
}
