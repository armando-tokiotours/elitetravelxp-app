/**
 * Guide password-setup / onboarding invite helpers.
 */

import { randomBytes } from "crypto";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import {
  ensureGuideProfile,
  getGuideByStaff,
  type GuideProfile,
} from "@/lib/roleProfiles";

const TOKEN_TTL_DAYS = 14;

export type GuideOnboardingRow = GuideProfile & {
  line_id?: string;
  onboarding_token?: string;
  onboarding_token_expires?: string;
  onboarding_complete?: boolean;
  emergency_contact?: string;
};

function siteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.PUBLIC_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function buildGuideOnboardingUrl(token: string): string {
  return `${siteOrigin()}/guide/setup-password?token=${encodeURIComponent(token)}`;
}

export function newOnboardingToken(): string {
  return randomBytes(24).toString("hex");
}

export function tokenExpiryIso(days = TOKEN_TTL_DAYS): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function findGuideByOnboardingToken(
  tokenRaw: string
): Promise<GuideOnboardingRow | null> {
  const token = String(tokenRaw || "").trim();
  if (!token || token.length < 16) return null;
  const pb = await getAdminPocketBase();
  try {
    return await pb
      .collection("guides")
      .getFirstListItem<GuideOnboardingRow>(
        `onboarding_token="${token.replace(/"/g, "")}"`,
        { requestKey: null }
      );
  } catch {
    return null;
  }
}

export function isTokenExpired(expires: string | null | undefined): boolean {
  const day = String(expires || "").slice(0, 10);
  if (!day) return true;
  const today = new Date().toISOString().slice(0, 10);
  return day < today;
}

/**
 * Ensure staff(guide) + guides profile exist, mint onboarding token, return URL.
 */
export async function generateGuideOnboardingLink(input: {
  email: string;
  name?: string;
  staffId?: string;
}): Promise<{
  onboardingUrl: string;
  token: string;
  staffId: string;
  guideId: string;
  email: string;
}> {
  const email = String(input.email || "")
    .trim()
    .toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("guide email required");
  }
  const pb = await getAdminPocketBase();
  const name =
    String(input.name || "").trim() ||
    email.split("@")[0] ||
    "Guide";

  let staffId = String(input.staffId || "").trim();
  if (!staffId) {
    try {
      const existing = await pb
        .collection("staff")
        .getFirstListItem<{ id: string; role?: string }>(`email="${email}"`, {
          requestKey: null,
        });
      staffId = existing.id;
      if (String(existing.role || "") !== "guide") {
        await pb.collection("staff").update(
          staffId,
          { role: "guide", account_type: "GUIDE", active: true, name },
          { requestKey: null }
        );
      }
    } catch {
      const tempPass = `Tmp-${randomBytes(9).toString("base64url")}!a1`;
      const created = await pb.collection("staff").create(
        {
          email,
          name,
          role: "guide",
          account_type: "GUIDE",
          active: true,
          password: tempPass,
          passwordConfirm: tempPass,
        },
        { requestKey: null }
      );
      staffId = created.id;
    }
  }

  const guide = (await ensureGuideProfile(pb, staffId, {
    full_name: name,
    email,
  })) as GuideOnboardingRow;

  const token = newOnboardingToken();
  const expires = tokenExpiryIso();
  await pb.collection("guides").update(
    guide.id,
    {
      onboarding_token: token,
      onboarding_token_expires: expires,
      onboarding_complete: false,
      email,
      full_name: name,
    },
    { requestKey: null }
  );

  return {
    onboardingUrl: buildGuideOnboardingUrl(token),
    token,
    staffId,
    guideId: guide.id,
    email,
  };
}

export async function completeGuideOnboarding(input: {
  token: string;
  password: string;
  phone: string;
  languages: string[];
  lineId: string;
  emergencyContact?: string;
}): Promise<{ staffId: string; email: string }> {
  const guide = await findGuideByOnboardingToken(input.token);
  if (!guide) throw new Error("Invalid or expired onboarding link");
  if (isTokenExpired(guide.onboarding_token_expires)) {
    throw new Error("This onboarding link has expired — ask Ops for a new one");
  }

  const password = String(input.password || "");
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
  const phone = String(input.phone || "").trim();
  const lineId = String(input.lineId || "").trim();
  if (!phone || !lineId) {
    throw new Error("Phone and LINE / WhatsApp are required");
  }

  const langs = (input.languages || [])
    .map((l) => String(l || "").trim())
    .filter(Boolean);
  if (langs.length === 0) {
    throw new Error("At least one language is required");
  }

  const pb = await getAdminPocketBase();
  const staffId = String(guide.staff || "").trim();
  if (!staffId) throw new Error("Guide staff link missing");

  await pb.collection("staff").update(
    staffId,
    {
      password,
      passwordConfirm: password,
      role: "guide",
      active: true,
    },
    { requestKey: null }
  );

  // Map free-text languages onto select values when possible
  const allowed = new Set([
    "English",
    "Spanish",
    "Dutch",
    "French",
    "German",
    "Italian",
  ]);
  const selectLangs = langs
    .map((l) => {
      const hit = [...allowed].find(
        (a) => a.toLowerCase() === l.toLowerCase()
      );
      return hit || null;
    })
    .filter(Boolean)
    .slice(0, 6) as string[];
  if (selectLangs.length === 0) selectLangs.push("English");

  await pb.collection("guides").update(
    guide.id,
    {
      phone_number: phone,
      line_id: lineId,
      emergency_contact: String(input.emergencyContact || "").trim() || "",
      main_tour_languages: selectLangs,
      onboarding_complete: true,
      onboarding_token: "",
      onboarding_token_expires: "",
    },
    { requestKey: null }
  );

  const staff = await pb.collection("staff").getOne<{ email?: string }>(staffId, {
    requestKey: null,
  });

  return {
    staffId,
    email: String(staff.email || guide.email || "").toLowerCase(),
  };
}

export async function guideProfileNeedsOnboarding(
  staffId: string
): Promise<boolean> {
  const pb = await getAdminPocketBase();
  const guide = await getGuideByStaff(pb, staffId);
  if (!guide) return true;
  const row = guide as GuideOnboardingRow;
  if (row.onboarding_complete === true) return false;
  const phone = String(row.phone_number || "").trim();
  const langs = row.main_tour_languages;
  const hasLangs = Array.isArray(langs) && langs.length > 0;
  return !(phone && hasLangs);
}
