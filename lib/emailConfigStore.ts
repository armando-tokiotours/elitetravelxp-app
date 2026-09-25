/**
 * Server-only email config JSON store.
 * Visual admin writes here; send-itinerary reads on each dispatch.
 */

import fs from "fs";
import path from "path";
import {
  EMAIL_CONFIG_DEFAULTS,
  applyEnvOverrides,
  buildProposalHtml,
  envVal,
  mergeStoredEmailConfig,
  resolveSubjectLine,
  type ProposalTemplateParams,
  type StoredEmailConfig,
} from "@/config/emailDefaults";

export type {
  EmailRoutingConfig,
  EmailSmtpConfig,
  EmailTemplateConfig,
  ProposalTemplateParams,
  StoredEmailConfig,
} from "@/config/emailDefaults";

export {
  EMAIL_CONFIG_DEFAULTS,
  buildProposalHtml,
  previewProposalHtml,
  resolveSubjectLine,
} from "@/config/emailDefaults";

export function getEmailConfigPath(): string {
  if (envVal("EMAIL_CONFIG_PATH")) return envVal("EMAIL_CONFIG_PATH")!;
  return path.join(process.cwd(), "config", "emailConfig.json");
}

/** Read persisted JSON (or defaults). Does not apply env overrides. */
export function loadPersistedEmailConfig(): StoredEmailConfig {
  try {
    const filePath = getEmailConfigPath();
    if (fs.existsSync(filePath)) {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
      return mergeStoredEmailConfig(EMAIL_CONFIG_DEFAULTS, raw);
    }
  } catch (err) {
    console.warn("[emailConfig] failed to read JSON store:", err);
  }
  return structuredClone(EMAIL_CONFIG_DEFAULTS);
}

/** Active config for mail dispatch: JSON store → defaults → env. */
export function getActiveEmailConfig(): StoredEmailConfig {
  return applyEnvOverrides(loadPersistedEmailConfig());
}

/** Persist settings written from the Team Config dashboard. */
export function saveEmailConfig(input: unknown): StoredEmailConfig {
  const next = mergeStoredEmailConfig(EMAIL_CONFIG_DEFAULTS, input);
  const filePath = getEmailConfigPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(next, null, 2) + "\n", "utf8");
  return next;
}

export function resolveTeamMailFrom(cfg?: StoredEmailConfig): string {
  const active = cfg || getActiveEmailConfig();
  const explicit =
    envVal("EMAIL_FROM") || envVal("MAIL_FROM") || envVal("SMTP_FROM");
  if (explicit) return explicit;

  const smtpReady = Boolean(
    (envVal("SMTP_PASS") || active.smtp.pass) &&
      (envVal("SMTP_USER") || active.smtp.user)
  );

  if (smtpReady) {
    const name =
      envVal("SMTP_FROM_NAME") ||
      envVal("MAIL_FROM_NAME") ||
      active.routing.fromName;
    const address =
      envVal("SMTP_FROM_EMAIL") ||
      envVal("MAIL_FROM_ADDRESS") ||
      active.routing.fromAddress;
    return `"${name}" <${address}>`;
  }

  return `"${active.routing.fromName}" <${active.routing.fromAddress}>`;
}

/** BCC list for guest proposal emails (excludes matching To addresses). */
export function resolveTeamBcc(
  to: string | string[],
  cfg?: StoredEmailConfig
): string[] {
  const active = cfg || getActiveEmailConfig();
  const toNorm = new Set(
    (Array.isArray(to) ? to : [to])
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean)
  );
  const set = new Set<string>();
  set.add(active.routing.bccRecipient.toLowerCase());
  const primaryEnv = envVal("BUSINESS_CONCIERGE_EMAIL");
  const extraEnv = envVal("QUOTE_BCC_EMAIL");
  if (primaryEnv) set.add(primaryEnv.toLowerCase());
  if (extraEnv) set.add(extraEnv.toLowerCase());
  return Array.from(set).filter((b) => !toNorm.has(b));
}

/**
 * Backward-compatible facade — always reads the latest JSON + env.
 */
export const TEAM_EMAIL_CONFIG = {
  get smtp() {
    return getActiveEmailConfig().smtp;
  },
  get routing() {
    return getActiveEmailConfig().routing;
  },
  get template() {
    return getActiveEmailConfig().template;
  },
  getProposalTemplate(params: ProposalTemplateParams): string {
    return buildProposalHtml(getActiveEmailConfig(), params);
  },
  resolveSubject(bookingRef: string, fullName?: string): string {
    return resolveSubjectLine(
      getActiveEmailConfig(),
      bookingRef,
      fullName || "Valued Guest"
    );
  },
};

// Re-export under the historical module path used by lib/email.ts
export { envVal };
