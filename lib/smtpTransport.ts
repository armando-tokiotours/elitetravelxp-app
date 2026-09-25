import nodemailer from "nodemailer";
import { envVal } from "@/config/emailDefaults";

export type SmtpAuthConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
};

/**
 * Hostinger / mail.tokiotours.com transporter (no_reply@tokiotours.com).
 * Port 465 = implicit SSL/TLS (secure: true).
 * Pooling + timeouts help VPS environments where outbound SMTP is flaky.
 */
export function createSmtpTransport(smtp: SmtpAuthConfig) {
  const port = Number(smtp.port) || 465;
  const secure =
    smtp.secure === true ||
    port === 465 ||
    envVal("SMTP_SECURE") === "true" ||
    envVal("SMTP_SECURE") === "1";

  return nodemailer.createTransport({
    host: smtp.host || "mail.tokiotours.com",
    port,
    secure,
    auth: {
      user: smtp.user || "no_reply@tokiotours.com",
      pass: smtp.pass,
    },
    tls: {
      // Custom Hostinger / domain certs can fail strict chain checks in some Node builds
      rejectUnauthorized: false,
      minVersion: "TLSv1.2",
    },
    requireTLS: !secure && port === 587,
    pool: true,
    maxConnections: 1,
    maxMessages: 20,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}
