import { NextResponse } from "next/server";
import {
  getTimelineMascotLayoutPath,
  loadPersistedTimelineMascotLayout,
  saveTimelineMascotLayout,
} from "@/lib/timelineMascotLayoutStore";

export const runtime = "nodejs";

/**
 * GET /api/admin/timeline-mascot-layout
 * POST — save layout from Team Access visual builder.
 */
export async function GET() {
  try {
    const layout = loadPersistedTimelineMascotLayout();
    return NextResponse.json({
      ok: true,
      path: getTimelineMascotLayoutPath(),
      layout,
    });
  } catch (err) {
    console.error("[timeline-mascot-layout] GET", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to load timeline mascot layout",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const layout = saveTimelineMascotLayout(body?.layout ?? body);
    return NextResponse.json({
      ok: true,
      success: true,
      path: getTimelineMascotLayoutPath(),
      layout,
    });
  } catch (err) {
    console.error("[timeline-mascot-layout] POST", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to save timeline mascot layout",
      },
      { status: 500 }
    );
  }
}
