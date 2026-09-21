/**
 * Prefer:
 * - `@/config/emailDefaults` for shared types / HTML preview (client-safe)
 * - `@/lib/emailConfigStore` for JSON persistence + active SMTP/BCC (server-only)
 */

export {
  EMAIL_CONFIG_DEFAULTS,
  applyEnvOverrides,
  buildProposalHtml,
  previewProposalHtml,
  resolveSubjectLine,
  type EmailRoutingConfig,
  type EmailSmtpConfig,
  type EmailTemplateConfig,
  type ProposalTemplateParams,
  type StoredEmailConfig,
} from "@/config/emailDefaults";
