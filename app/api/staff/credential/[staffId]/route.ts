import { NextResponse } from "next/server";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import {
  canEditStaffCredential,
  verifyCredentialActor,
} from "@/lib/staffCredentialAuth";
import {
  parseStaffLanguages,
  serializeStaffLanguages,
} from "@/lib/staffLanguages";
import {
  combineStaffDisplayName,
  getStaffProfile,
  updateStaffProfile,
  type StaffProfile,
} from "@/lib/staffProfiles";

export const runtime = "nodejs";

/**
 * PATCH staff_profiles (+ staff display name) via admin client.
 * Avoids staff-auth manageRule: null blocking owner/ops editing others.
 *
 * Name: send first_name / last_name; display_name + staff.name are derived
 * as trim(`${first} ${last}`) for backwards compatibility.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ staffId: string }> }
) {
  try {
    const actor = await verifyCredentialActor(request);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const raw = context.params as
      | { staffId: string }
      | Promise<{ staffId: string }>;
    const { staffId } = await Promise.resolve(raw);
    const id = String(staffId || "")
      .trim()
      .replace(/"/g, "");
    if (!id) {
      return NextResponse.json({ error: "staffId required" }, { status: 400 });
    }
    if (!canEditStaffCredential(actor, id)) {
      return NextResponse.json(
        { error: "You cannot edit this credential." },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const profilePatch: Partial<Omit<StaffProfile, "id" | "staff_id">> = {};
    const pb = await getAdminPocketBase();

    const hasFirst = "first_name" in body;
    const hasLast = "last_name" in body;
    if (hasFirst || hasLast) {
      const existing = await getStaffProfile(pb, id);
      const first = hasFirst
        ? String(body.first_name || "").trim()
        : String(existing?.first_name || "").trim();
      const last = hasLast
        ? String(body.last_name || "").trim()
        : String(existing?.last_name || "").trim();
      if (hasFirst) profilePatch.first_name = first;
      if (hasLast) profilePatch.last_name = last;
      profilePatch.display_name = combineStaffDisplayName(first, last);
    } else if ("display_name" in body) {
      profilePatch.display_name = String(body.display_name || "").trim();
    }

    if ("phone" in body) profilePatch.phone = String(body.phone || "").trim();
    if ("bio" in body) profilePatch.bio = String(body.bio || "").trim();
    if ("languages" in body) {
      profilePatch.languages = serializeStaffLanguages(
        parseStaffLanguages(body.languages)
      );
    }
    if ("strength_cities" in body) {
      profilePatch.strength_cities = String(body.strength_cities || "").trim();
    }
    if ("video_url" in body) {
      profilePatch.video_url = String(body.video_url || "").trim();
    }
    if ("bank_info" in body) {
      profilePatch.bank_info = String(body.bank_info || "").trim();
    }
    if ("payment_link" in body) {
      profilePatch.payment_link = String(body.payment_link || "").trim();
    }
    if ("payout_notes" in body) {
      profilePatch.payout_notes = String(body.payout_notes || "").trim();
    }

    const profile = await updateStaffProfile(pb, id, profilePatch);

    const staffPatch: Record<string, unknown> = {};
    if (hasFirst || hasLast || "display_name" in body || "staff_name" in body) {
      const name = String(
        body.staff_name ??
          profilePatch.display_name ??
          body.display_name ??
          ""
      ).trim();
      if (name) staffPatch.name = name;
    }
    if ("agency_id" in body) {
      staffPatch.agency_id = String(body.agency_id || "").trim();
    }
    let staffLoginWarning: string | undefined;
    if (Object.keys(staffPatch).length > 0) {
      try {
        await pb.collection("staff").update(id, staffPatch, {
          requestKey: null,
        });
      } catch (staffErr) {
        // staff_profiles is the booklet source of truth. Auth-collection
        // update can 400 (role select values, manageRule) even as admin.
        staffLoginWarning =
          staffErr instanceof Error
            ? staffErr.message
            : "Staff login name was not updated.";
      }
    }

    return NextResponse.json({
      ok: true,
      profile,
      ...(staffLoginWarning ? { staffLoginWarning } : {}),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Could not save credential.",
      },
      { status: 500 }
    );
  }
}
