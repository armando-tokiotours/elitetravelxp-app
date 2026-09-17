import { Resend } from "resend";
import nodemailer from "nodemailer";

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

/** Always notified on client quotation emails. */
export const TOKIO_TOURS_QUOTE_BCC = "armando@tokiotours.nl";

/** Strip accidental surrounding quotes from .env values. */
function envVal(key: string): string | undefined {
  const raw = process.env[key]?.trim();
  if (!raw) return undefined;
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1).trim() || undefined;
  }
  return raw;
}

function mailFrom(): string {
  return (
    envVal("MAIL_FROM") ||
    envVal("SMTP_FROM") ||
    "TokioTours <noreply@tokiotours.nl>"
  );
}

/**
 * BCC list: always include armando@tokiotours.nl, plus optional env /
 * per-call extras (BUSINESS_CONCIERGE_EMAIL or QUOTE_BCC_EMAIL).
 */
function resolveBcc(extra?: string | string[]): string[] {
  const set = new Set<string>();
  set.add(TOKIO_TOURS_QUOTE_BCC.toLowerCase());

  const fromEnv = envVal("QUOTE_BCC_EMAIL") || envVal("BUSINESS_CONCIERGE_EMAIL");
  if (fromEnv) set.add(fromEnv.toLowerCase());

  for (const addr of Array.isArray(extra) ? extra : extra ? [extra] : []) {
    const t = addr.trim().toLowerCase();
    if (t) set.add(t);
  }

  return Array.from(set);
}

function resolveBccForRecipients(
  to: string[],
  extra?: string | string[]
): string[] {
  const toLower = new Set(to.map((a) => a.trim().toLowerCase()).filter(Boolean));
  return resolveBcc(extra).filter((b) => !toLower.has(b));
}

/**
 * Prefer Resend SDK when RESEND_API_KEY is set; otherwise SMTP.
 * Client receives the PDF; TokioTours team gets an automatic BCC.
 */
export async function sendTransactionalMail(
  input: SendMailInput
): Promise<{ sent: boolean; reason?: string; id?: string; bcc?: string[] }> {
  const from = mailFrom();
  const to = Array.isArray(input.to) ? input.to : [input.to];
  const bcc = resolveBccForRecipients(to, input.bcc);
  const resendKey = envVal("RESEND_API_KEY");

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

  const smtpHost = envVal("SMTP_HOST");
  if (smtpHost) {
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE === "true" || port === 465;
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port,
      secure,
      auth:
        envVal("SMTP_USER") && envVal("SMTP_PASS")
          ? {
              user: envVal("SMTP_USER")!,
              pass: envVal("SMTP_PASS")!,
            }
          : undefined,
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
      "Mail not configured. Set RESEND_API_KEY (or SMTP_HOST + SMTP_USER/SMTP_PASS).",
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
