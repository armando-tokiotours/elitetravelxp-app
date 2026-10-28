import { NextResponse } from "next/server";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import { verifyCredentialActor } from "@/lib/staffCredentialAuth";

export const runtime = "nodejs";

/**
 * POST /api/staff/change-password
 * Authenticated staff sets a new password and clears force_password_change.
 * Uses admin client so the clear flag always lands even if field rules vary.
 *
 * Body: { password, passwordConfirm }
 */
export async function POST(request: Request) {
  try {
    const actor = await verifyCredentialActor(request);
    if (!actor?.staffId) {
      return NextResponse.json(
        { error: "Sign in with a staff account to change password." },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      password?: string;
      passwordConfirm?: string;
    };
    const password = String(body.password || "");
    const passwordConfirm = String(body.passwordConfirm || "");
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

    const pb = await getAdminPocketBase();
    await pb.collection("staff").update(
      actor.staffId,
      {
        password,
        passwordConfirm,
        force_password_change: false,
      },
      { requestKey: null }
    );

    return NextResponse.json({ ok: true, forcePasswordChange: false });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Could not change password.",
      },
      { status: 500 }
    );
  }
}
