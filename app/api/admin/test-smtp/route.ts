import { NextResponse } from "next/server";
import {
  EMAIL_CONFIG_DEFAULTS,
  mergeStoredEmailConfig,
} from "@/config/emailDefaults";
import {
  bluehostWebmailConfigured,
  sendViaBluehostWebmail,
} from "@/lib/bluehostWebmail";
import { getActiveEmailConfig } from "@/lib/emailConfigStore";
import {
  mailRelayConfigured,
  sendViaBluehostRelay,
} from "@/lib/mailRelay";
import { createSmtpTransport } from "@/lib/smtpTransport";

export const runtime = "nodejs";

/**
 * POST /api/admin/test-smtp
 * Optional body.sendTo → send a short diagnostic.
 * Prefers Bluehost Roundcube webmail (external delivery).
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
      preferRelay?: boolean;
      preferWebmail?: boolean;
    };

    const sendTo = String(body.sendTo || "")
      .trim()
      .toLowerCase();
    const preferWebmail = body.preferWebmail !== false;
    const preferRelay = body.preferRelay !== false;

    if (preferWebmail && bluehostWebmailConfigured() && sendTo) {
      const stamp = new Date().toISOString();
      await sendViaBluehostWebmail({
        to: sendTo,
        subject: `TOKIOTOURS webmail diagnostic ${stamp}`,
        text: [
          "Bluehost Roundcube diagnostic from tokiotours-app.com",
          `Time: ${stamp}`,
          "From: no_reply@tokiotours.com",
          "",
          "If you received this, external delivery via Bluehost webmail works.",
        ].join("\n"),
        from: "Tokiotours Concierge <no_reply@tokiotours.com>",
        replyTo: "armando@tokiotours.nl",
      });
      return NextResponse.json({
        ok: true,
        success: true,
        via: "bluehost-webmail",
        message: `Webmail sent diagnostic to ${sendTo}`,
      });
    }

    if (preferRelay && mailRelayConfigured() && sendTo) {
      const stamp = new Date().toISOString();
      const relay = await sendViaBluehostRelay({
        to: sendTo,
        subject: `TOKIOTOURS relay diagnostic ${stamp}`,
        text: [
          "Bluehost PHP mail-relay diagnostic from tokiotours-app.com",
          `Time: ${stamp}`,
          "",
          "If you received this, external delivery via Bluehost PHP works.",
        ].join("\n"),
        from: "Tokiotours Concierge <no_reply@tokiotours.com>",
        replyTo: "armando@tokiotours.nl",
      });
      return NextResponse.json({
        ok: true,
        success: true,
        via: relay.via,
        message: `Relay sent diagnostic to ${sendTo}`,
      });
    }

    const active = getActiveEmailConfig();
    const merged = body.smtp
      ? mergeStoredEmailConfig(EMAIL_CONFIG_DEFAULTS, { smtp: body.smtp }).smtp
      : active.smtp;

    if (!merged.host || !merged.user || !merged.pass) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "SMTP host, user, and password are required (or configure Bluehost webmail SMTP_*).",
        },
        { status: 400 }
      );
    }

    const transporter = createSmtpTransport(merged);
    await transporter.verify();

    if (!sendTo) {
      return NextResponse.json({
        ok: true,
        success: true,
        message: `SMTP connection OK — ${merged.host}:${merged.port} as ${merged.user}`,
        note: bluehostWebmailConfigured()
          ? "Bluehost webmail path is preferred for external Gmail delivery."
          : "Remote SMTP often fails to reach Gmail; configure webmail credentials.",
      });
    }

    const stamp = new Date().toISOString();
    const info = await transporter.sendMail({
      from: `"Tokiotours Concierge" <${merged.user}>`,
      to: sendTo,
      subject: `TOKIOTOURS SMTP diagnostic ${stamp}`,
      text: [
        "Bluehost cPanel SMTP diagnostic from tokiotours-app.com",
        `Time: ${stamp}`,
        `From: ${merged.user}`,
        `Host: ${merged.host}:${merged.port}`,
      ].join("\n"),
    });

    return NextResponse.json({
      ok: true,
      success: true,
      via: "smtp",
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
            : "Failed to verify mail connection",
      },
      { status: 502 }
    );
  }
}
