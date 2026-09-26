/**
 * staff_profiles — person profile (bio, languages, media, bank). Not booking data.
 */

import type PocketBase from "pocketbase";

export type StaffProfile = {
  id: string;
  staff_id: string;
  display_name?: string;
  phone?: string;
  bio?: string;
  languages?: string;
  strength_cities?: string;
  photo?: string;
  video?: string;
  video_url?: string;
  bank_info?: string;
  payment_link?: string;
  payout_notes?: string;
};

export async function ensureStaffProfile(
  pb: PocketBase,
  staffId: string,
  seed?: { display_name?: string }
): Promise<StaffProfile> {
  const id = String(staffId || "").trim();
  if (!id) throw new Error("staff_id required");
  try {
    return await pb
      .collection("staff_profiles")
      .getFirstListItem<StaffProfile>(`staff_id="${id}"`, {
        requestKey: null,
      });
  } catch {
    return (await pb.collection("staff_profiles").create(
      {
        staff_id: id,
        display_name: seed?.display_name || "",
      },
      { requestKey: null }
    )) as StaffProfile;
  }
}

export async function updateStaffProfile(
  pb: PocketBase,
  staffId: string,
  patch: Partial<Omit<StaffProfile, "id" | "staff_id">>,
  fileFields?: { photo?: File | null; video?: File | null }
): Promise<StaffProfile> {
  const row = await ensureStaffProfile(pb, staffId);
  if (fileFields?.photo || fileFields?.video) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined && v !== null) fd.append(k, String(v));
    }
    if (fileFields.photo) fd.append("photo", fileFields.photo);
    if (fileFields.video) fd.append("video", fileFields.video);
    return (await pb
      .collection("staff_profiles")
      .update(row.id, fd, { requestKey: null })) as StaffProfile;
  }
  return (await pb
    .collection("staff_profiles")
    .update(row.id, patch, { requestKey: null })) as StaffProfile;
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
  } catch {
    return null;
  }
}
