import { Resend } from "resend";
import nodemailer from "nodemailer";
import {
  TEAM_EMAIL_CONFIG,
  buildProposalHtml,
  getActiveEmailConfig,
  resolveSubjectLine,
  resolveTeamBcc,
  resolveTeamMailFrom,
} from "@/lib/emailConfigStore";

interface SendItineraryParams {
  to: string;
  bookingRef: string;
  pdfBuffer: Buffer;
  customerName?: string;
  tourType?: "single_day" | "multi_day" | null;
  tourDate?: string | null;
  adults?: number;
  children?: number;
}

/** Strip accidental quotes from .env values (common Docker/dotenv pitfall). */
export function envVal(key: string): string | undefined {
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

/**
 * Resolve RESEND_API_KEY from the server environment (quote-stripped).
 * Never hardcode secrets in source — set RESEND_API_KEY on the VPS .env.
 */
export function resolveResendApiKey(): string | undefined {
  return envVal("RESEND_API_KEY");
}

/** True when Hostinger SMTP is available (JSON store / defaults). */
export function resolveSmtpConfigured(): boolean {
  const { host, user, pass } = getActiveEmailConfig().smtp;
  return Boolean(host && user && pass);
}

/** Mail is ready if SMTP or Resend is configured. */
export function resolveMailConfigured(): boolean {
  return resolveSmtpConfigured() || Boolean(resolveResendApiKey());
}

export class MailDispatchError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "MailDispatchError";
    this.status = status;
  }
}

async function sendViaSmtp({
  to,
  bookingRef,
  pdfBuffer,
  customerName,
  tourType,
  tourDate,
  adults,
  children,
}: SendItineraryParams): Promise<{ id?: string }> {
  const cfg = getActiveEmailConfig();
  const { host, port, user, pass, secure } = cfg.smtp;
  if (!host || !user || !pass) {
    throw new MailDispatchError(
      "SMTP is not configured (need SMTP host, user, pass).",
      401
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  const bcc = resolveTeamBcc(to, cfg);
  const info = await transporter.sendMail({
    from: resolveTeamMailFrom(cfg),
    to: [to],
    ...(bcc.length ? { bcc } : {}),
    subject: resolveSubjectLine(
      cfg,
      bookingRef,
      customerName || "Valued Guest"
    ),
    html: buildProposalHtml(cfg, {
      fullName: customerName || "Valued Guest",
      bookingRef,
      customerEmail: to,
      tourType: tourType ?? "multi_day",
      tourDate: tourDate ?? null,
      adults: adults ?? 2,
      children: children ?? 0,
    }),
    attachments:
      pdfBuffer && pdfBuffer.length > 0
        ? [
            {
              filename: `Japan-Itinerary-${bookingRef || "draft"}.pdf`,
              content: pdfBuffer,
              contentType: "application/pdf",
            },
          ]
        : undefined,
  });

  return { id: typeof info.messageId === "string" ? info.messageId : undefined };
}

async function sendViaResend({
  to,
  bookingRef,
  pdfBuffer,
  customerName,
  tourType,
  tourDate,
  adults,
  children,
}: SendItineraryParams): Promise<{ id?: string }> {
  const RESEND_KEY = resolveResendApiKey();
  if (!RESEND_KEY) {
    throw new MailDispatchError(
      "Resend API Key missing on server environment.",
      401
    );
  }
  if (!RESEND_KEY.startsWith("re_")) {
    throw new MailDispatchError(
      "RESEND_API_KEY looks invalid (expected to start with re_).",
      401
    );
  }

  const cfg = getActiveEmailConfig();
  const resend = new Resend(RESEND_KEY);
  const bcc = resolveTeamBcc(to, cfg);
  const result = await resend.emails.send({
    from: resolveTeamMailFrom(cfg),
    to: [to],
    ...(bcc.length ? { bcc } : {}),
    subject: resolveSubjectLine(
      cfg,
      bookingRef,
      customerName || "Valued Guest"
    ),
    html: buildProposalHtml(cfg, {
      fullName: customerName || "Valued Guest",
      bookingRef,
      customerEmail: to,
      tourType: tourType ?? "multi_day",
      tourDate: tourDate ?? null,
      adults: adults ?? 2,
      children: children ?? 0,
    }),
    attachments:
      pdfBuffer && pdfBuffer.length > 0
        ? [
            {
              filename: `Japan-Itinerary-${bookingRef || "draft"}.pdf`,
              content: pdfBuffer,
            },
          ]
        : undefined,
  });

  if (result.error) {
    const msg = result.error.message || "Resend email failed.";
    if (/auth|api key|unauthorized|forbidden/i.test(msg)) {
      throw new MailDispatchError(
        `Resend authentication failed: ${msg}.`,
        401
      );
    }
    throw new MailDispatchError(msg, 500);
  }

  return { id: result.data?.id as string | undefined };
}

/**
 * Transactional itinerary email — prefers Hostinger SMTP from the
 * JSON/team config store, otherwise Resend. Always BCC team alert.
 */
export async function sendItineraryEmail(
  params: SendItineraryParams
): Promise<{ id?: string }> {
  // Touch facade so hot-reloaded JSON is always current
  void TEAM_EMAIL_CONFIG.smtp;

  if (resolveSmtpConfigured()) {
    try {
      return await sendViaSmtp(params);
    } catch (smtpErr) {
      console.error("[email] Hostinger SMTP failed, trying Resend…", smtpErr);
      if (resolveResendApiKey()) {
        return await sendViaResend(params);
      }
      throw smtpErr instanceof MailDispatchError
        ? smtpErr
        : new MailDispatchError(
            smtpErr instanceof Error
              ? smtpErr.message
              : "Failed to dispatch email via Hostinger SMTP",
            500
          );
    }
  }

  return sendViaResend(params);
}
