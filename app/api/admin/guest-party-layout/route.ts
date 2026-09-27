import { NextResponse } from "next/server";
import {
  getGuestPartyLayoutPath,
  loadPersistedGuestPartyLayout,
  saveGuestPartyLayout,
} from "@/lib/guestPartyLayoutStore";

export const runtime = "nodejs";

/**
 * GET /api/admin/guest-party-layout — current guest party positions.
 * POST — save layout from Team Access visual builder.
 */
export async function GET() {
  try {
    const layout = loadPersistedGuestPartyLayout();
    return NextResponse.json({
      ok: true,
      path: getGuestPartyLayoutPath(),
      layout,
    });
  } catch (err) {
    console.error("[guest-party-layout] GET", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to load guest party layout",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const layout = saveGuestPartyLayout(body?.layout ?? body);
    return NextResponse.json({
      ok: true,
      success: true,
      path: getGuestPartyLayoutPath(),
      layout,
    });
  } catch (err) {
    console.error("[guest-party-layout] POST", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to save guest party layout",
      },
      { status: 500 }
    );
  }
}
