import { NextResponse } from "next/server";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import {
  canEditStaffCredential,
  verifyCredentialActor,
} from "@/lib/staffCredentialAuth";
import { canAccessTeamAccess } from "@/lib/staffRoles";
import { generateTempPassword } from "@/lib/contractorProvisioning";

export const runtime = "nodejs";

/**
 * POST /api/staff/admin-reset-password
 * Owner/ops set another staff member's password via admin client
 * (staff.manageRule is null — browser JWT cannot update others' passwords).
 *
 * Body: { staffId, password?, passwordConfirm?, forcePasswordChange?, generateTemp? }
 */
export async function POST(request: Request) {
  try {
    const actor = await verifyCredentialActor(request);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!actor.isSuperuser && !canAccessTeamAccess(actor.role)) {
      return NextResponse.json(
        { error: "Only Owner / Ops can reset another user's password." },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      staffId?: string;
      password?: string;
      passwordConfirm?: string;
      forcePasswordChange?: boolean;
      generateTemp?: boolean;
    };

    const staffId = String(body.staffId || "")
      .trim()
      .replace(/"/g, "");
    if (!staffId) {
      return NextResponse.json({ error: "staffId required" }, { status: 400 });
    }
    if (!canEditStaffCredential(actor, staffId)) {
      return NextResponse.json(
        { error: "You cannot reset this password." },
        { status: 403 }
      );
    }

    let password = String(body.password || "");
    let passwordConfirm = String(body.passwordConfirm || password);
    if (body.generateTemp) {
      password = generateTempPassword();
      passwordConfirm = password;
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }
    if (password !== passwordConfirm) {
      return NextResponse.json(
        { error: "Password confirmation does not match." },
        { status: 400 }
      );
    }

    const force =
      body.forcePasswordChange === true || body.generateTemp === true;

    const pb = await getAdminPocketBase();
    await pb.collection("staff").update(
      staffId,
      {
        password,
        passwordConfirm,
        force_password_change: force,
      },
      { requestKey: null }
    );

    return NextResponse.json({
      ok: true,
      staffId,
      forcePasswordChange: force,
      ...(body.generateTemp ? { tempPassword: password } : {}),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Could not reset password.",
      },
      { status: 500 }
    );
  }
}
