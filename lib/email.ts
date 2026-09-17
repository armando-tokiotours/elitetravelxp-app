import { Resend } from "resend";

interface SendItineraryParams {
  to: string;
  bookingRef: string;
  pdfBuffer: Buffer;
  customerName?: string;
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
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const resend = new Resend(apiKey);
  const businessEmail =
    process.env.BUSINESS_CONCIERGE_EMAIL?.trim() || "armando@tokiotours.nl";

  const from =
    process.env.MAIL_FROM?.trim() ||
    "Japan Journey <onboarding@resend.dev>"; // Default testing address

  const toNorm = to.trim().toLowerCase();
  const bcc =
    businessEmail.toLowerCase() === toNorm ? undefined : [businessEmail];

  return await resend.emails.send({
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
}
