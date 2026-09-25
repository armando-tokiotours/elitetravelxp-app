/**
 * Shared email config types, defaults, and HTML builders (client + server safe).
 * Persistence lives in lib/emailConfigStore.ts (Node / API only).
 */

import {
  formatEmailDisplayDate,
  renderProposalEmailHtml,
} from "@/lib/emailTemplateHtml";

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
  tourType?: "single_day" | "multi_day" | null;
  tourDate?: string | null;
  adults?: number;
  children?: number;
  customerEmail?: string | null;
};

/** Hardcoded TOKIOTOURS mail defaults when no JSON or env is set. */
export const EMAIL_CONFIG_DEFAULTS: StoredEmailConfig = {
  smtp: {
    host: "mail.tokiotours.com",
    port: 465,
    secure: true,
    user: "no_reply@tokiotours.com",
    /** Prefer SMTP_PASS / emailConfig.json — do not rely on this default in production. */
    pass: "",
  },
  routing: {
    fromName: "TOKIOTOURS",
    fromAddress: "no_reply@tokiotours.com",
    bccRecipient: "armando@tokiotours.nl",
  },
  template: {
    subjectLine: "Your Japan Journey Proposal - {{bookingRef}}",
    headerTitle: "YOUR JAPAN JOURNEY PROPOSAL",
    welcomeBody:
      "Thank you for designing your bespoke itinerary. Our concierge team at TOKIOTOURS has received your trip selections and is preparing your confirmed 1-on-1 daily proposal.",
    ctaButtonText: "REVIEW YOUR BOOKING BRIEF →",
    ctaUrl: "https://tokiotours-app.com/manage?pnr={{bookingRef}}",
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

/** Parse `Name <addr@host>` or bare address into display + mailbox. */
export function parseMailFrom(
  raw: string | undefined
): { name: string; address: string } | null {
  const value = String(raw || "").trim();
  if (!value) return null;
  const angled = value.match(/^(?:"?([^"<]*)"?\s*)?<([^>]+)>$/);
  if (angled) {
    const address = angled[2].trim();
    const name = (angled[1] || "").trim() || "TOKIOTOURS";
    if (!address.includes("@")) return null;
    return { name, address };
  }
  if (value.includes("@") && !value.includes(" ")) {
    return { name: "TOKIOTOURS", address: value };
  }
  return null;
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
      subjectLine: String(
        template.subjectLine ??
          template.subject ??
          base.template.subjectLine
      ),
      headerTitle: String(template.headerTitle ?? base.template.headerTitle),
      welcomeBody: String(
        template.welcomeBody ??
          template.welcomeMessage ??
          base.template.welcomeBody
      ),
      ctaButtonText: String(
        template.ctaButtonText ??
          template.ctaText ??
          base.template.ctaButtonText
      ),
      ctaUrl: String(template.ctaUrl ?? base.template.ctaUrl),
    },
  };
}

export function applyEnvOverrides(cfg: StoredEmailConfig): StoredEmailConfig {
  const port = Number(envVal("SMTP_PORT") || cfg.smtp.port);
  const parsedFrom = parseMailFrom(
    envVal("EMAIL_FROM") || envVal("MAIL_FROM") || envVal("SMTP_FROM")
  );
  const fromName =
    envVal("SMTP_FROM_NAME") ||
    envVal("MAIL_FROM_NAME") ||
    parsedFrom?.name ||
    cfg.routing.fromName;
  const fromAddress =
    envVal("SMTP_FROM_EMAIL") ||
    envVal("MAIL_FROM_ADDRESS") ||
    parsedFrom?.address ||
    envVal("SMTP_USER") ||
    cfg.routing.fromAddress;

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
      fromName,
      fromAddress,
      bccRecipient:
        envVal("BUSINESS_CONCIERGE_EMAIL") ||
        envVal("QUOTE_BCC_EMAIL") ||
        cfg.routing.bccRecipient,
    },
    template: { ...cfg.template },
  };
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
  params: ProposalTemplateParams
): string {
  const fullName = params.fullName || "Valued Guest";
  const bookingRef = params.bookingRef || "TMP-BOOKING";
  const headerTitle = fillPlaceholders(cfg.template.headerTitle, {
    fullName,
    bookingRef,
  });
  const welcomeBody = fillPlaceholders(cfg.template.welcomeBody, {
    fullName,
    bookingRef,
  });

  return renderProposalEmailHtml({
    fullName,
    bookingRef,
    headerTitle,
    welcomeBody,
    ctaButtonText:
      cfg.template.ctaButtonText || "REVIEW YOUR BOOKING BRIEF →",
    ctaUrl: fillPlaceholders(cfg.template.ctaUrl || "", {
      fullName,
      bookingRef,
    }),
    siteOrigin: "https://tokiotours-app.com",
    tourType: params.tourType ?? "multi_day",
    tourDate: params.tourDate ?? null,
    adults: params.adults ?? 2,
    children: params.children ?? 0,
    customerEmail: params.customerEmail ?? null,
  });
}

export { formatEmailDisplayDate };

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
      tourType: "multi_day",
      tourDate: "2026-09-24",
      adults: 2,
      children: 1,
      customerEmail: "alex@example.com",
    }
  );
}
