import { NextResponse } from "next/server";
import PocketBase from "pocketbase";

export const runtime = "nodejs";

function publicPbUrl(): string {
  return (
    process.env.NEXT_PUBLIC_POCKETBASE_URL ||
    process.env.POCKETBASE_URL ||
    "http://127.0.0.1:8090"
  ).replace(/\/$/, "");
}

/**
 * POST /api/staff/request-password-reset
 * Triggers PocketBase staff.requestPasswordReset(email) on the real auth
 * collection (`staff`, not `users`). Always returns ok to avoid email enumeration.
 *
 * Body: { email }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
    };
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email is required." },
        { status: 400 }
      );
    }

    const pb = new PocketBase(publicPbUrl());
    pb.autoCancellation(false);
    try {
      await pb.collection("staff").requestPasswordReset(email);
    } catch (err) {
      // Do not leak whether the email exists; log for ops.
      console.warn(
        "[request-password-reset]",
        email,
        err instanceof Error ? err.message : err
      );
    }

    return NextResponse.json({
      ok: true,
      message:
        "If that email has a staff login, PocketBase will send a reset link.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Could not request password reset.",
      },
      { status: 500 }
    );
  }
}
