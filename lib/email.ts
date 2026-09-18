import { Resend } from "resend";

interface SendItineraryParams {
  to: string;
  bookingRef: string;
  pdfBuffer: Buffer;
  customerName?: string;
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

/** Require RESEND_API_KEY in the server environment (never hardcode keys). */
export function resolveResendApiKey(): string | undefined {
  return envVal("RESEND_API_KEY");
}

export class MailDispatchError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "MailDispatchError";
    this.status = status;
  }
}

/**
 * Transactional itinerary PDF via Resend.
 * Always BCC BUSINESS_CONCIERGE_EMAIL (default armando@tokiotours.nl).
 */
export async function sendItineraryEmail({
  to,
  bookingRef,
  pdfBuffer,
  customerName = "Valued Guest",
}: SendItineraryParams) {
  const apiKey = resolveResendApiKey();
  if (!process.env.RESEND_API_KEY?.trim() && !apiKey) {
    throw new MailDispatchError(
      "Resend API Key missing on server environment.",
      401
    );
  }
  if (!apiKey) {
    throw new MailDispatchError(
      "Resend API Key missing on server environment.",
      401
    );
  }
  if (!apiKey.startsWith("re_")) {
    throw new MailDispatchError(
      "RESEND_API_KEY looks invalid (expected to start with re_). Check VPS .env quoting.",
      401
    );
  }

  const resend = new Resend(apiKey);
  const businessEmail =
    envVal("BUSINESS_CONCIERGE_EMAIL") || "armando@tokiotours.nl";

  const from =
    envVal("MAIL_FROM") ||
    envVal("SMTP_FROM") ||
    "Japan Journey <onboarding@resend.dev>";

  const toNorm = to.trim().toLowerCase();
  const bcc =
    businessEmail.toLowerCase() === toNorm ? undefined : [businessEmail];

  const result = await resend.emails.send({
    from,
    to: [to],
    ...(bcc ? { bcc } : {}),
    subject: `Your Japan Journey Quotation & Dossier [${bookingRef}]`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 32px; color: #0f172a; background-color: #fdfbf7; max-width: 600px; margin: 0 auto; border-radius: 12px; border: 1px solid #e2e8f0;">
        <h1 style="color: #0f172a; margin-bottom: 8px;">Japan Journey Design</h1>
        <p style="color: #64748b; font-size: 14px;">Booking Reference: <strong style="color: #0f172a;">${bookingRef}</strong></p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p>Dear ${customerName},</p>
        <p>Thank you for designing your travel itinerary with us. Attached is your official PDF dossier and itemized quotation.</p>
        <p>You can review or modify your itinerary at any time on our website using your email address and booking reference (<strong>${bookingRef}</strong>).</p>
        <br/>
        <p style="font-size: 12px; color: #94a3b8;">TokioTours · Elite Travel Experiences</p>
      </div>
    `,
    attachments: [
      {
        filename: `Japan-Itinerary-${bookingRef}.pdf`,
        content: pdfBuffer,
      },
    ],
  });

  if (result.error) {
    const msg = result.error.message || "Resend email failed.";
    if (/auth|api key|unauthorized|forbidden/i.test(msg)) {
      throw new MailDispatchError(
        `Resend authentication failed: ${msg}. Verify RESEND_API_KEY on the VPS.`,
        401
      );
    }
    throw new MailDispatchError(msg, 500);
  }

  return { id: result.data?.id as string | undefined };
}
