/**
 * Application SMTP transporter for TOKIOTOURS transactional mail.
 * Authenticated SSL/TLS to mail.tokiotours.com:465 as no_reply@tokiotours.com.
 *
 * Prefer env:
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, EMAIL_FROM
 */
export {
  createSmtpTransport,
  type SmtpAuthConfig,
} from "@/lib/smtpTransport";

import { getActiveEmailConfig } from "@/lib/emailConfigStore";
import { createSmtpTransport } from "@/lib/smtpTransport";

/** Build a transporter from active JSON + SMTP_* / EMAIL_FROM env. */
export function getEmailTransporter() {
  const { smtp } = getActiveEmailConfig();
  if (!smtp.host || !smtp.user || !smtp.pass) {
    return null;
  }
  return createSmtpTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    user: smtp.user,
    pass: smtp.pass,
  });
}
