/**
 * guides / drivers profile helpers.
 */

import type PocketBase from "pocketbase";

export type GuideProfile = {
  id: string;
  staff: string;
  full_name?: string;
  email?: string;
  phone_number?: string;
  city_of_operation?: string;
  availability_pattern?: string;
  availability_notes?: string;
  blackout_dates?: unknown;
  base_rate_6h_or_less?: number;
  base_rate_8h_or_less?: number;
  extra_head_percentage?: number;
  fee_min?: number;
  fee_max?: number;
  rate_currency?: string;
  main_tour_languages?: string[];
  japanese_jlpt_level?: string;
  [key: string]: unknown;
};

export type DriverProfile = {
  id: string;
  staff: string;
  driver_type?: string;
  company_fleet_name?: string;
  full_name?: string;
  phone_number?: string;
  operating_cities?: string[];
  operating_license_number?: string;
  blackout_dates?: unknown;
  [key: string]: unknown;
};

export async function getGuideByStaff(
  pb: PocketBase,
  staffId: string
): Promise<GuideProfile | null> {
  const id = String(staffId || "").trim();
  if (!id) return null;
  try {
    return await pb
      .collection("guides")
      .getFirstListItem<GuideProfile>(`staff="${id}"`, { requestKey: null });
  } catch {
    return null;
  }
}

export async function ensureGuideProfile(
  pb: PocketBase,
  staffId: string,
  seed?: { full_name?: string; email?: string }
): Promise<GuideProfile> {
  const existing = await getGuideByStaff(pb, staffId);
  if (existing) return existing;
  return (await pb.collection("guides").create(
    {
      staff: staffId,
      full_name: seed?.full_name || "Guide",
      email: seed?.email || "guide@example.com",
      comfort_couples: true,
      rate_currency: "JPY",
    },
    { requestKey: null }
  )) as GuideProfile;
}

export async function getDriverByStaff(
  pb: PocketBase,
  staffId: string
): Promise<DriverProfile | null> {
  const id = String(staffId || "").trim();
  if (!id) return null;
  try {
    return await pb
      .collection("drivers")
      .getFirstListItem<DriverProfile>(`staff="${id}"`, { requestKey: null });
  } catch {
    return null;
  }
}

export async function ensureDriverProfile(
  pb: PocketBase,
  staffId: string,
  seed?: { full_name?: string }
): Promise<DriverProfile> {
  const existing = await getDriverByStaff(pb, staffId);
  if (existing) return existing;
  return (await pb.collection("drivers").create(
    {
      staff: staffId,
      full_name: seed?.full_name || "Driver",
      driver_type: "independent",
    },
    { requestKey: null }
  )) as DriverProfile;
}

export async function updateGuideProfile(
  pb: PocketBase,
  guideId: string,
  patch: Record<string, unknown>
): Promise<GuideProfile> {
  return (await pb
    .collection("guides")
    .update(guideId, patch, { requestKey: null })) as GuideProfile;
}

export async function updateDriverProfile(
  pb: PocketBase,
  driverId: string,
  patch: Record<string, unknown>
): Promise<DriverProfile> {
  return (await pb
    .collection("drivers")
    .update(driverId, patch, { requestKey: null })) as DriverProfile;
}
