/**
 * Shared email config types, defaults, and HTML builders (client + server safe).
 * Persistence lives in lib/emailConfigStore.ts (Node / API only).
 */

export type EmailSmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
};

export type EmailRoutingConfig = {
  fromName: string;
  fromAddress: string;
  bccRecipient: string;
};

export type EmailTemplateConfig = {
  subjectLine: string;
  headerTitle: string;
  welcomeBody: string;
  ctaButtonText: string;
  ctaUrl: string;
};

export type StoredEmailConfig = {
  smtp: EmailSmtpConfig;
  routing: EmailRoutingConfig;
  template: EmailTemplateConfig;
};

export type ProposalTemplateParams = {
  fullName: string;
  bookingRef: string;
  itineraryData?: unknown;
};

/** Hardcoded Hostinger / team defaults when no JSON or env is set. */
export const EMAIL_CONFIG_DEFAULTS: StoredEmailConfig = {
  smtp: {
    host: "smtp.hostinger.com",
    port: 465,
    secure: true,
    user: "no.reply@travelexperiencesgroup.com",
    pass: "Cocacola2027-/",
  },
  routing: {
    fromName: "Elite Travel Japan",
    fromAddress: "no.reply@travelexperiencesgroup.com",
    bccRecipient: "armando@tokiotours.nl",
  },
  template: {
    subjectLine: "Your Japan Journey Proposal - {{bookingRef}}",
    headerTitle: "YOUR JAPAN JOURNEY PROPOSAL",
    welcomeBody:
      "Thank you for designing your bespoke itinerary. Our concierge team at Tokio Tours has received your trip selections and is preparing your confirmed 1-on-1 daily proposal.",
    ctaButtonText: "REVIEW MY ITINERARY →",
    ctaUrl: "https://travelexperiencesgroup.com/builder",
  },
};

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

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function mergeStoredEmailConfig(
  base: StoredEmailConfig,
  patch: unknown
): StoredEmailConfig {
  if (!isPlainObject(patch)) return structuredClone(base);
  const smtp = isPlainObject(patch.smtp) ? patch.smtp : {};
  const routing = isPlainObject(patch.routing) ? patch.routing : {};
  const template = isPlainObject(patch.template) ? patch.template : {};
  const port = Number(smtp.port ?? base.smtp.port);
  return {
    smtp: {
      host: String(smtp.host ?? base.smtp.host),
      port: Number.isFinite(port) ? port : base.smtp.port,
      secure:
        typeof smtp.secure === "boolean"
          ? smtp.secure
          : port === 465 || base.smtp.secure,
      user: String(smtp.user ?? base.smtp.user),
      pass: String(smtp.pass ?? base.smtp.pass),
    },
    routing: {
      fromName: String(routing.fromName ?? base.routing.fromName),
      fromAddress: String(routing.fromAddress ?? base.routing.fromAddress),
      bccRecipient: String(routing.bccRecipient ?? base.routing.bccRecipient),
    },
    template: {
      subjectLine: String(template.subjectLine ?? base.template.subjectLine),
      headerTitle: String(template.headerTitle ?? base.template.headerTitle),
      welcomeBody: String(template.welcomeBody ?? base.template.welcomeBody),
      ctaButtonText: String(
        template.ctaButtonText ?? base.template.ctaButtonText
      ),
      ctaUrl: String(template.ctaUrl ?? base.template.ctaUrl),
    },
  };
}

export function applyEnvOverrides(cfg: StoredEmailConfig): StoredEmailConfig {
  const port = Number(envVal("SMTP_PORT") || cfg.smtp.port);
  return {
    smtp: {
      host: envVal("SMTP_HOST") || cfg.smtp.host,
      port: Number.isFinite(port) ? port : cfg.smtp.port,
      secure:
        envVal("SMTP_SECURE") === "true" ||
        envVal("SMTP_SECURE") === "1" ||
        port === 465,
      user: envVal("SMTP_USER") || cfg.smtp.user,
      pass: envVal("SMTP_PASS") || cfg.smtp.pass,
    },
    routing: {
      fromName: cfg.routing.fromName,
      fromAddress:
        envVal("MAIL_FROM_ADDRESS") ||
        envVal("SMTP_USER") ||
        cfg.routing.fromAddress,
      bccRecipient:
        envVal("BUSINESS_CONCIERGE_EMAIL") ||
        envVal("QUOTE_BCC_EMAIL") ||
        cfg.routing.bccRecipient,
    },
    template: { ...cfg.template },
  };
}

function escapeHtml(s: string): string {
  return String(s || "").replace(/[<>&]/g, "");
}

function fillPlaceholders(
  text: string,
  vars: { fullName: string; bookingRef: string }
): string {
  return text
    .replace(/\{\{\s*bookingRef\s*\}\}/gi, vars.bookingRef)
    .replace(/\{\{\s*fullName\s*\}\}/gi, vars.fullName);
}

/** Build proposal HTML from editable template fields. */
export function buildProposalHtml(
  cfg: StoredEmailConfig,
  { fullName, bookingRef }: ProposalTemplateParams
): string {
  const safeName = escapeHtml(fullName) || "Valued Guest";
  const safeRef = escapeHtml(bookingRef) || "TMP-BOOKING";
  const headerTitle = escapeHtml(
    fillPlaceholders(cfg.template.headerTitle, {
      fullName: safeName,
      bookingRef: safeRef,
    })
  );
  const welcomeBody = escapeHtml(
    fillPlaceholders(cfg.template.welcomeBody, {
      fullName: safeName,
      bookingRef: safeRef,
    })
  ).replace(/\n/g, "<br/>");
  const ctaText = escapeHtml(
    cfg.template.ctaButtonText || "REVIEW MY ITINERARY →"
  );
  const ctaUrl = escapeHtml(
    cfg.template.ctaUrl || "https://travelexperiencesgroup.com/builder"
  );

  return `
      <!DOCTYPE html>
      <html>
        <body style="margin: 0; padding: 0; background-color: #121212; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #ffffff;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #121212; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #1C1C1E; border: 1px solid #2C2C2E; border-radius: 16px; padding: 32px; text-align: left;">
                  <tr>
                    <td style="padding-bottom: 20px; border-bottom: 1px solid #2C2C2E;">
                      <span style="font-size: 10px; font-weight: bold; color: #B85304; letter-spacing: 2px; text-transform: uppercase;">ELITE TRAVEL EXPERIENCES</span>
                      <h1 style="font-size: 22px; font-weight: 800; color: #ffffff; margin: 4px 0 0 0;">${headerTitle}</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 24px 0 12px 0;">
                      <div style="background-color: #121212; border: 1px solid #B85304; border-radius: 12px; padding: 14px 20px;">
                        <span style="font-size: 9px; font-weight: bold; color: #A1A1AA; text-transform: uppercase; letter-spacing: 1.5px; display: block;">BOOKING REFERENCE</span>
                        <span style="font-size: 20px; font-weight: 900; color: #D9BB96; letter-spacing: 2px;">${safeRef}</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; color: #E4E4E7; font-size: 14px; line-height: 1.6;">
                      <p style="margin: 0 0 12px 0;">Dear <strong>${safeName}</strong>,</p>
                      <p style="margin: 0 0 16px 0;">${welcomeBody}</p>
                      <p style="margin: 0; color: #A1A1AA; font-size: 13px;">Your saved PDF dossier is attached or ready for download. We will review your selected hotels, private transit, and custom experiences, and follow up shortly with your finalized itinerary quotation.</p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding: 28px 0 16px 0;">
                      <a href="${ctaUrl}" style="background-color: #B85304; color: #ffffff; text-decoration: none; font-size: 12px; font-weight: bold; padding: 12px 28px; border-radius: 10px; display: inline-block; letter-spacing: 1px;">${ctaText}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="border-top: 1px solid #2C2C2E; padding-top: 20px; text-align: center; color: #71717A; font-size: 11px;">
                      © Elite Travel Experiences Group · Tokio Tours · Confidential Proposal
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
}

export function resolveSubjectLine(
  cfg: StoredEmailConfig,
  bookingRef: string,
  fullName = "Valued Guest"
): string {
  return fillPlaceholders(cfg.template.subjectLine, {
    bookingRef: bookingRef || "TMP-BOOKING",
    fullName,
  });
}

/** Live-preview HTML for the admin designer. */
export function previewProposalHtml(
  template: EmailTemplateConfig,
  sample?: { fullName?: string; bookingRef?: string }
): string {
  return buildProposalHtml(
    {
      ...EMAIL_CONFIG_DEFAULTS,
      template: { ...EMAIL_CONFIG_DEFAULTS.template, ...template },
    },
    {
      fullName: sample?.fullName || "Alex Traveler",
      bookingRef: sample?.bookingRef || "JPN-DEMO01",
    }
  );
}
