import type { StaffProfile } from "@/lib/staffProfiles";

function authHeader(token: string | null | undefined): HeadersInit {
  const t = String(token || "").trim();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function readError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error || fallback;
}

/**
 * PATCH staff_profiles via /api/staff/credential/[staffId].
 * Name fields: first_name, last_name (preferred); display_name / staff_name
 * are derived server-side when first/last are sent.
 */
export async function saveStaffCredentialViaApi(
  token: string | null | undefined,
  staffId: string,
  patch: Record<string, unknown>
): Promise<StaffProfile> {
  const res = await fetch(
    `/api/staff/credential/${encodeURIComponent(staffId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeader(token),
      },
      body: JSON.stringify(patch),
    }
  );
  if (!res.ok) {
    throw new Error(await readError(res, "Could not save credential."));
  }
  const data = (await res.json()) as { profile?: StaffProfile };
  if (!data.profile) throw new Error("Credential save returned no profile.");
  return data.profile;
}

export async function uploadStaffAvatarViaApi(
  token: string | null | undefined,
  staffId: string,
  file: File
): Promise<{ photo: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(
    `/api/staff/avatar/${encodeURIComponent(staffId)}`,
    {
      method: "POST",
      headers: authHeader(token),
      body: fd,
    }
  );
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    photo?: string;
    ok?: boolean;
  };
  if (!res.ok || data.error) {
    throw new Error(data.error || "Photo did not save.");
  }
  return { photo: String(data.photo || "") };
}
