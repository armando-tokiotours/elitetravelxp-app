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
 * Verifies Bluehost cPanel SMTP credentials.
 * Optional body.sendTo → actually send a short diagnostic email and return SMTP receipt.
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
      sendTo?: string;
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

    const sendTo = String(body.sendTo || "")
      .trim()
      .toLowerCase();
    if (!sendTo) {
      return NextResponse.json({
        ok: true,
        success: true,
        message: `SMTP connection OK — ${merged.host}:${merged.port} as ${merged.user}`,
      });
    }

    const stamp = new Date().toISOString();
    const info = await transporter.sendMail({
      from: `"TOKIOTOURS" <${merged.user}>`,
      to: sendTo,
      subject: `TOKIOTOURS SMTP diagnostic ${stamp}`,
      text: [
        "Bluehost cPanel SMTP diagnostic from tokiotours-app.com",
        `Time: ${stamp}`,
        `From: ${merged.user}`,
        `Host: ${merged.host}:${merged.port}`,
        "",
        "If you received this, outbound SMTP delivery works.",
      ].join("\n"),
    });

    console.info("[test-smtp] sent", {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
      to: sendTo,
    });

    return NextResponse.json({
      ok: true,
      success: true,
      message: `SMTP sent diagnostic to ${sendTo}`,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    });
  } catch (err) {
    console.error("[test-smtp]", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to verify Bluehost SMTP connection",
      },
      { status: 502 }
    );
  }
}
