import { NextResponse } from "next/server";
import {
  EMAIL_CONFIG_DEFAULTS,
  mergeStoredEmailConfig,
} from "@/config/emailDefaults";
import { getActiveEmailConfig } from "@/lib/emailConfigStore";
import { createSmtpTransport } from "@/lib/smtpTransport";

export const runtime = "nodejs";

/**
 * POST /api/admin/test-smtp
 * Verifies Hostinger SMTP credentials (from body or active config).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      smtp?: {
        host?: string;
        port?: number;
        secure?: boolean;
        user?: string;
        pass?: string;
      };
    };

    const active = getActiveEmailConfig();
    const merged = body.smtp
      ? mergeStoredEmailConfig(EMAIL_CONFIG_DEFAULTS, { smtp: body.smtp }).smtp
      : active.smtp;

    if (!merged.host || !merged.user || !merged.pass) {
      return NextResponse.json(
        { ok: false, error: "SMTP host, user, and password are required." },
        { status: 400 }
      );
    }

    const transporter = createSmtpTransport(merged);
    await transporter.verify();

    return NextResponse.json({
      ok: true,
      success: true,
      message: `SMTP connection OK — ${merged.host}:${merged.port} as ${merged.user}`,
    });
  } catch (err) {
    console.error("[test-smtp]", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to verify Hostinger SMTP connection",
      },
      { status: 502 }
    );
  }
}
