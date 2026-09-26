import { Resend } from "resend";
import {
  getActiveEmailConfig,
  resolveTeamBcc,
  resolveTeamMailFrom,
} from "@/lib/emailConfigStore";
import {
  bluehostWebmailConfigured,
  sendViaBluehostWebmail,
} from "@/lib/bluehostWebmail";
import { resolveResendApiKey } from "@/lib/email";
import {
  mailRelayConfigured,
  sendViaBluehostRelay,
} from "@/lib/mailRelay";
import { createSmtpTransport } from "@/lib/smtpTransport";

export type SendMailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type SendMailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: SendMailAttachment[];
  /** Extra BCC recipients (merged with TokioTours team notify). */
  bcc?: string | string[];
  /** When true, do not auto-BCC the concierge team (caller handles team notify). */
  skipTeamBcc?: boolean;
};

/** Always notified on client quotation emails (from active team config). */
export const TOKIO_TOURS_QUOTE_BCC = "armando@tokiotours.nl";

function resolveBccForRecipients(
  to: string[],
  extra?: string | string[],
  skipTeamBcc?: boolean
): string[] {
  const toLower = new Set(to.map((a) => a.trim().toLowerCase()).filter(Boolean));
  const set = new Set<string>();
  if (!skipTeamBcc) {
    const cfg = getActiveEmailConfig();
    for (const b of resolveTeamBcc(to, cfg)) set.add(b);
  }
  for (const addr of Array.isArray(extra) ? extra : extra ? [extra] : []) {
    const t = addr.trim().toLowerCase();
    if (t && !toLower.has(t)) set.add(t);
  }
  return Array.from(set);
}

function smtpReady(): boolean {
  const { host, user, pass } = getActiveEmailConfig().smtp;
  return Boolean(host && user && pass);
}

async function sendViaSmtp(
  input: SendMailInput,
  from: string,
  to: string[],
  bcc: string[]
): Promise<{ sent: true; id?: string; bcc: string[] }> {
  const cfg = getActiveEmailConfig();
  const { host, port, user, pass, secure } = cfg.smtp;
  const transporter = createSmtpTransport({
    host,
    port,
    secure,
    user,
    pass,
  });

  const brandFrom = "Tokiotours Concierge <no_reply@tokiotours.com>";

  const info = await transporter.sendMail({
    from: brandFrom,
    to,
    ...(bcc.length ? { bcc } : {}),
    replyTo: "armando@tokiotours.nl",
    subject: input.subject,
    text: input.text,
    html: input.html,
    envelope: {
      from: "no_reply@tokiotours.com",
      to: [...to, ...bcc],
    },
    attachments: input.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType || "application/pdf",
    })),
  });

  console.info("[mail] SMTP accepted", {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
    envelope: info.envelope,
    to,
    from: brandFrom,
  });

  if (Array.isArray(info.rejected) && info.rejected.length > 0) {
    throw new Error(
      `SMTP rejected recipient(s): ${info.rejected.join(", ")} (${info.response || "no response"})`
    );
  }

  return {
    sent: true,
    id: typeof info.messageId === "string" ? info.messageId : undefined,
    bcc,
  };
}

async function sendViaResend(
  input: SendMailInput,
  from: string,
  to: string[],
  bcc: string[],
  resendKey: string
): Promise<{ sent: true; id?: string; bcc: string[] }> {
  const resend = new Resend(resendKey);
  const { data, error } = await resend.emails.send({
    from,
    to,
    ...(bcc.length ? { bcc } : {}),
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments: input.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content.toString("base64"),
    })),
  });

  if (error) {
    throw new Error(error.message || "Resend email failed.");
  }
  return { sent: true, id: data?.id, bcc };
}

/**
 * Outbound order:
 * 1) Bluehost Roundcube webmail — delivers to Gmail as no_reply@tokiotours.com
 * 2) Bluehost PHP relay (MAIL_RELAY_*) if uploaded to public_html
 * 3) Resend — when API key + verified domain
 * 4) Bluehost SMTP last — 250 OK but often never reaches external inboxes
 */
export async function sendTransactionalMail(
  input: SendMailInput
): Promise<{ sent: boolean; reason?: string; id?: string; bcc?: string[] }> {
  const cfg = getActiveEmailConfig();
  const from =
    resolveTeamMailFrom(cfg).includes("@tokiotours.com")
      ? resolveTeamMailFrom(cfg)
      : "Tokiotours Concierge <no_reply@tokiotours.com>";
  const to = Array.isArray(input.to) ? input.to : [input.to];
  const bcc = resolveBccForRecipients(to, input.bcc, input.skipTeamBcc);
  const resendKey = resolveResendApiKey();
  const errors: string[] = [];

  if (bluehostWebmailConfigured()) {
    try {
      await sendViaBluehostWebmail({
        to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        from,
        replyTo: "armando@tokiotours.nl",
        bcc,
        attachments: input.attachments,
      });
      return { sent: true, bcc };
    } catch (webmailErr) {
      const msg =
        webmailErr instanceof Error ? webmailErr.message : String(webmailErr);
      errors.push(`webmail: ${msg}`);
      console.error("[mail] Bluehost webmail failed, trying next…", msg);
    }
  }

  if (mailRelayConfigured()) {
    try {
      const relay = await sendViaBluehostRelay({
        to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        from,
        replyTo: "armando@tokiotours.nl",
        bcc,
        attachments: input.attachments,
      });
      return { sent: true, id: relay.id, bcc };
    } catch (relayErr) {
      const msg =
        relayErr instanceof Error ? relayErr.message : String(relayErr);
      errors.push(`relay: ${msg}`);
      console.error("[mail] Bluehost PHP relay failed, trying next…", msg);
    }
  }

  if (resendKey) {
    try {
      return await sendViaResend(input, from, to, bcc, resendKey);
    } catch (resendErr) {
      const msg =
        resendErr instanceof Error ? resendErr.message : String(resendErr);
      errors.push(`resend: ${msg}`);
      console.error("[mail] Resend failed, trying SMTP…", msg);
    }
  }

  if (smtpReady()) {
    try {
      return await sendViaSmtp(input, from, to, bcc);
    } catch (smtpErr) {
      const msg =
        smtpErr instanceof Error ? smtpErr.message : String(smtpErr);
      errors.push(`smtp: ${msg}`);
      throw new Error(`All mail paths failed (${errors.join("; ")})`);
    }
  }

  if (errors.length) {
    throw new Error(`All mail paths failed (${errors.join("; ")})`);
  }

  return {
    sent: false,
    reason:
      "Mail not configured. Set MAIL_RELAY_URL + MAIL_RELAY_SECRET (preferred), RESEND_API_KEY, or SMTP_*.",
  };
}

/** Quotation confirmation HTML matching the Japan Journey brand mail. */
export function itineraryQuotationEmailHtml(opts: {
  email: string;
  bookingRef: string;
}): string {
  const { email, bookingRef } = opts;
  return `
    <div style="font-family: sans-serif; background-color: #fdfbf7; padding: 30px; color: #111;">
      <h1 style="color: #0f172a;">Japan Journey Quotation</h1>
      <p>Thank you for designing your trip. Your unique booking reference is: <strong>${bookingRef}</strong></p>
      <p>You can use this reference along with your email address (${email}) to review or modify your trip anytime on our website.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p>Attached is the full PDF copy of your private dossier and quotation.</p>
      <p style="margin-top: 24px; font-size: 12px; color: #64748b;">— TokioTours</p>
    </div>
  `;
}

export function itineraryQuotationEmailText(opts: {
  email: string;
  bookingRef: string;
}): string {
  const { email, bookingRef } = opts;
  return [
    "Japan Journey Quotation",
    "",
    `Thank you for designing your trip. Your unique booking reference is: ${bookingRef}`,
    "",
    `You can use this reference along with your email address (${email}) to review or modify your trip anytime on our website.`,
    "",
    "Attached is the full PDF copy of your private dossier and quotation.",
    "",
    "— TokioTours",
  ].join("\n");
}
