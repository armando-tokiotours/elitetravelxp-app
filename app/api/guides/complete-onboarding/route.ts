import { NextResponse } from "next/server";
import {
  completeGuideOnboarding,
  findGuideByOnboardingToken,
  isTokenExpired,
} from "@/lib/guideOnboarding";

/** GET ?token= — preview invite (name/email) without revealing secrets */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = String(searchParams.get("token") || "").trim();
    if (!token) {
      return NextResponse.json({ error: "token required" }, { status: 400 });
    }
    const guide = await findGuideByOnboardingToken(token);
    if (!guide || isTokenExpired(guide.onboarding_token_expires)) {
      return NextResponse.json(
        { error: "Invalid or expired onboarding link" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      ok: true,
      fullName: guide.full_name || "Guide",
      email: guide.email || "",
      expires: guide.onboarding_token_expires || null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/guides/complete-onboarding
 * { token, password, phone, languages, lineId, emergencyContact? }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string;
      password?: string;
      phone?: string;
      languages?: string[] | string;
      lineId?: string;
      emergencyContact?: string;
    };
    const languages = Array.isArray(body.languages)
      ? body.languages
      : String(body.languages || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

    const result = await completeGuideOnboarding({
      token: String(body.token || ""),
      password: String(body.password || ""),
      phone: String(body.phone || ""),
      languages,
      lineId: String(body.lineId || ""),
      emergencyContact: body.emergencyContact,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Could not complete onboarding",
      },
      { status: 400 }
    );
  }
}
