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
 * Hostinger / mail.tokiotours.com transporter.
 * Port 465 uses TLS (secure: true); rejectUnauthorized relaxed for custom-domain certs.
 */
export function createSmtpTransport(smtp: SmtpAuthConfig) {
  const port = Number(smtp.port) || 465;
  const secure =
    smtp.secure ||
    port === 465 ||
    envVal("SMTP_SECURE") === "true" ||
    envVal("SMTP_SECURE") === "1";

  return nodemailer.createTransport({
    host: smtp.host || "mail.tokiotours.com",
    port,
    secure,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
    tls: {
      // Custom Hostinger / domain certs can fail strict chain checks in some Node builds
      rejectUnauthorized: false,
    },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
  });
}
