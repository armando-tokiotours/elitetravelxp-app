import { NextResponse } from "next/server";
import { generateGuideOnboardingLink } from "@/lib/guideOnboarding";

/**
 * POST /api/guides/generate-onboarding-link
 * { email, name?, staffId? } → { onboardingUrl, token, … }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      name?: string;
      staffId?: string;
    };
    const result = await generateGuideOnboardingLink({
      email: String(body.email || ""),
      name: body.name,
      staffId: body.staffId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate link" },
      { status: 400 }
    );
  }
}
