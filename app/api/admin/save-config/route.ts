import { NextResponse } from "next/server";
import {
  getActiveEmailConfig,
  getEmailConfigPath,
  loadPersistedEmailConfig,
  saveEmailConfig,
} from "@/lib/emailConfigStore";

export const runtime = "nodejs";

/**
 * GET /api/admin/save-config — current persisted team email settings.
 * POST — save SMTP / routing / template to config/emailConfig.json.
 */
export async function GET() {
  try {
    const persisted = loadPersistedEmailConfig();
    const active = getActiveEmailConfig();
    return NextResponse.json({
      ok: true,
      path: getEmailConfigPath(),
      config: persisted,
      active,
    });
  } catch (err) {
    console.error("[save-config] GET", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load config" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const config = saveEmailConfig(body?.config ?? body);
    return NextResponse.json({
      ok: true,
      success: true,
      message: "✓ Team email settings updated successfully!",
      path: getEmailConfigPath(),
      config,
    });
  } catch (err) {
    console.error("[save-config] POST", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to save team email settings",
      },
      { status: 500 }
    );
  }
}
