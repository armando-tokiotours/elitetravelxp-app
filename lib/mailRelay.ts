/**
 * Outbound mail via Bluehost PHP relay (local host sendmail/php mail).
 * Remote SMTP from the VPS only delivers to local @tokiotours.com mailboxes.
 */

import { envVal } from "@/config/emailDefaults";

export type RelayAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type RelayMailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  from?: string;
  replyTo?: string;
  bcc?: string[];
  attachments?: RelayAttachment[];
};

export function resolveMailRelayUrl(): string | undefined {
  const url = envVal("MAIL_RELAY_URL");
  return url || undefined;
}

export function resolveMailRelaySecret(): string | undefined {
  return envVal("MAIL_RELAY_SECRET") || undefined;
}

export function mailRelayConfigured(): boolean {
  return Boolean(resolveMailRelayUrl() && resolveMailRelaySecret());
}

export async function sendViaBluehostRelay(
  input: RelayMailInput
): Promise<{ sent: true; id?: string; via: "bluehost-php-mail" }> {
  const url = resolveMailRelayUrl();
  const secret = resolveMailRelaySecret();
  if (!url || !secret) {
    throw new Error("MAIL_RELAY_URL / MAIL_RELAY_SECRET not configured.");
  }

  const toList = Array.isArray(input.to) ? input.to : [input.to];
  const primary = toList[0];
  if (!primary) {
    throw new Error("Relay mail requires a recipient.");
  }

  const extraBcc = [
    ...(input.bcc || []),
    ...toList.slice(1),
  ].filter(Boolean);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret,
      to: primary,
      subject: input.subject,
      text: input.text,
      html: input.html,
      from: input.from,
      replyTo: input.replyTo || "armando@tokiotours.nl",
      bcc: extraBcc,
      attachments: input.attachments?.map((a) => ({
        filename: a.filename,
        contentType: a.contentType || "application/octet-stream",
        contentBase64: a.content.toString("base64"),
      })),
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  };

  if (!res.ok || !body.ok) {
    throw new Error(
      body.error || `Bluehost mail relay failed (HTTP ${res.status})`
    );
  }

  console.info("[mail] Bluehost PHP relay OK", { to: primary, bcc: extraBcc });
  return { sent: true, via: "bluehost-php-mail" };
}
