import { Resend } from "resend";
import {
  TEAM_EMAIL_CONFIG,
  buildProposalHtml,
  getActiveEmailConfig,
  resolveSubjectLine,
  resolveTeamBcc,
  resolveTeamMailFrom,
} from "@/lib/emailConfigStore";
import {
  mailRelayConfigured,
  sendViaBluehostRelay,
} from "@/lib/mailRelay";
import {
  bluehostWebmailConfigured,
  sendViaBluehostWebmail,
} from "@/lib/bluehostWebmail";
import { createSmtpTransport } from "@/lib/smtpTransport";

interface SendItineraryParams {
  to: string;
  bookingRef: string;
  /** Primary PDF (legacy single attachment). */
  pdfBuffer?: Buffer;
  /** Optional named PDFs (dossier / invoice). When set, preferred over pdfBuffer. */
  pdfAttachments?: Array<{ filename: string; content: Buffer }>;
  customerName?: string;
  tourType?: "single_day" | "multi_day" | null;
  tourDate?: string | null;
  adults?: number;
  children?: number;
}

function resolvePdfAttachments(
  params: SendItineraryParams
): Array<{ filename: string; content: Buffer; contentType: string }> {
  if (params.pdfAttachments?.length) {
    return params.pdfAttachments
      .filter((a) => a.content && a.content.length > 0)
      .map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: "application/pdf",
      }));
  }
  if (params.pdfBuffer && params.pdfBuffer.length > 0) {
    return [
      {
        filename: `Japan-Itinerary-${params.bookingRef || "draft"}.pdf`,
        content: params.pdfBuffer,
        contentType: "application/pdf",
      },
    ];
  }
  return [];
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

/** True when Bluehost cPanel SMTP is available (JSON store / defaults). */
export function resolveSmtpConfigured(): boolean {
  const { host, user, pass } = getActiveEmailConfig().smtp;
  return Boolean(host && user && pass);
}

/** Mail is ready if Bluehost webmail, PHP relay, SMTP, or Resend is configured. */
export function resolveMailConfigured(): boolean {
  return (
    bluehostWebmailConfigured() ||
    mailRelayConfigured() ||
    resolveSmtpConfigured() ||
    Boolean(resolveResendApiKey())
  );
}

export class MailDispatchError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "MailDispatchError";
    this.status = status;
  }
}

async function sendViaSmtp(params: SendItineraryParams): Promise<{ id?: string }> {
  const {
    to,
    bookingRef,
    customerName,
    tourType,
    tourDate,
    adults,
    children,
  } = params;
  const cfg = getActiveEmailConfig();
  const { host, port, user, pass, secure } = cfg.smtp;
  if (!host || !user || !pass) {
    throw new MailDispatchError(
      "SMTP is not configured (need SMTP host, user, pass).",
      401
    );
  }

  const transporter = createSmtpTransport({
    host,
    port,
    secure,
    user,
    pass,
  });

  const bcc = resolveTeamBcc(to, cfg);
  const brandFrom = "Tokiotours Concierge <no_reply@tokiotours.com>";
  const attachments = resolvePdfAttachments(params);
  const info = await transporter.sendMail({
    from: brandFrom,
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
    envelope: {
      from: "no_reply@tokiotours.com",
      to: [to, ...bcc],
    },
    attachments: attachments.length ? attachments : undefined,
  });

  return { id: typeof info.messageId === "string" ? info.messageId : undefined };
}

async function sendViaResend(params: SendItineraryParams): Promise<{ id?: string }> {
  const {
    to,
    bookingRef,
    customerName,
    tourType,
    tourDate,
    adults,
    children,
  } = params;
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
  const attachments = resolvePdfAttachments(params);
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
    attachments: attachments.length
      ? attachments.map((a) => ({
          filename: a.filename,
          content: a.content,
        }))
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
 * Transactional itinerary email.
 * Prefer Bluehost Roundcube webmail (external delivery as no_reply@tokiotours.com),
 * then PHP relay / Resend / SMTP.
 */
export async function sendItineraryEmail(
  params: SendItineraryParams
): Promise<{ id?: string }> {
  // Touch facade so hot-reloaded JSON is always current
  void TEAM_EMAIL_CONFIG.smtp;

  const cfg = getActiveEmailConfig();
  const from = "Tokiotours Concierge <no_reply@tokiotours.com>";
  const bcc = resolveTeamBcc(params.to, cfg);
  const subject = resolveSubjectLine(
    cfg,
    params.bookingRef,
    params.customerName || "Valued Guest"
  );
  const html = buildProposalHtml(cfg, {
    fullName: params.customerName || "Valued Guest",
    bookingRef: params.bookingRef,
    customerEmail: params.to,
    tourType: params.tourType ?? "multi_day",
    tourDate: params.tourDate ?? null,
    adults: params.adults ?? 2,
    children: params.children ?? 0,
  });
  const attachments = resolvePdfAttachments(params);

  if (bluehostWebmailConfigured()) {
    try {
      await sendViaBluehostWebmail({
        to: params.to,
        subject,
        text: `Your Japan itinerary ${params.bookingRef}`,
        html,
        from,
        bcc,
        attachments,
      });
      return {};
    } catch (webmailErr) {
      console.error(
        "[email] Bluehost webmail failed, trying next…",
        webmailErr
      );
    }
  }

  if (mailRelayConfigured()) {
    try {
      const relay = await sendViaBluehostRelay({
        to: params.to,
        subject,
        text: `Your Japan itinerary ${params.bookingRef}`,
        html,
        from,
        bcc,
        attachments,
      });
      return { id: relay.id };
    } catch (relayErr) {
      console.error(
        "[email] Bluehost PHP relay failed, trying next…",
        relayErr
      );
    }
  }

  if (resolveResendApiKey()) {
    try {
      return await sendViaResend(params);
    } catch (resendErr) {
      console.error("[email] Resend failed, trying SMTP…", resendErr);
      if (!resolveSmtpConfigured()) {
        throw resendErr instanceof MailDispatchError
          ? resendErr
          : new MailDispatchError(
              resendErr instanceof Error
                ? resendErr.message
                : "Failed to dispatch email via Resend",
              500
            );
      }
    }
  }

  if (resolveSmtpConfigured()) {
    return await sendViaSmtp(params);
  }

  throw new MailDispatchError(
    "Mail not configured. Set MAIL_RELAY_URL + MAIL_RELAY_SECRET, RESEND_API_KEY, or SMTP_*.",
    401
  );
}
