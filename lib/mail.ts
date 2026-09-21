import { Resend } from "resend";
import nodemailer from "nodemailer";
import {
  getActiveEmailConfig,
  resolveTeamBcc,
  resolveTeamMailFrom,
} from "@/lib/emailConfigStore";
import { resolveResendApiKey } from "@/lib/email";

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
};

/** Always notified on client quotation emails (from active team config). */
export const TOKIO_TOURS_QUOTE_BCC = "armando@tokiotours.nl";

function resolveBccForRecipients(
  to: string[],
  extra?: string | string[]
): string[] {
  const cfg = getActiveEmailConfig();
  const base = resolveTeamBcc(to, cfg);
  const set = new Set(base);
  const toLower = new Set(to.map((a) => a.trim().toLowerCase()).filter(Boolean));
  for (const addr of Array.isArray(extra) ? extra : extra ? [extra] : []) {
    const t = addr.trim().toLowerCase();
    if (t && !toLower.has(t)) set.add(t);
  }
  return Array.from(set);
}

/**
 * Prefer Resend SDK when RESEND_API_KEY is set; otherwise SMTP from team config.
 * Client receives the PDF; TokioTours team gets an automatic BCC.
 */
export async function sendTransactionalMail(
  input: SendMailInput
): Promise<{ sent: boolean; reason?: string; id?: string; bcc?: string[] }> {
  const cfg = getActiveEmailConfig();
  const from = resolveTeamMailFrom(cfg);
  const to = Array.isArray(input.to) ? input.to : [input.to];
  const bcc = resolveBccForRecipients(to, input.bcc);
  const resendKey = resolveResendApiKey();

  if (resendKey) {
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

  const { host, port, user, pass, secure } = cfg.smtp;
  if (host && user && pass) {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to,
      ...(bcc.length ? { bcc } : {}),
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType || "application/pdf",
      })),
    });
    return { sent: true, bcc };
  }

  return {
    sent: false,
    reason:
      "Mail not configured. Check Team Email Settings / SMTP_* env or RESEND_API_KEY.",
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
