/**
 * Send mail via Bluehost Roundcube (webmail HTTP).
 *
 * Why: Remote SMTP from the VPS authenticates and returns 250 OK, but Bluehost
 * does not deliver those messages to external inboxes (Gmail / @tokiotours.nl).
 * Sending through Roundcube on mail.tokiotours.com DOES deliver, with From
 * no_reply@tokiotours.com.
 */

import { envVal } from "@/config/emailDefaults";

export type WebmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type WebmailMailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  from?: string;
  replyTo?: string;
  bcc?: string[];
  attachments?: WebmailAttachment[];
};

type CookieJar = Map<string, string>;

function cookieHeader(jar: CookieJar): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(jar: CookieJar, res: Response): void {
  const getter = (
    res.headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie;
  const lines: string[] =
    typeof getter === "function" ? getter.call(res.headers) : [];
  if (!lines.length) {
    const single = res.headers.get("set-cookie");
    if (single) lines.push(...single.split(/,(?=\s*[A-Za-z0-9_]+=)/));
  }
  for (const line of lines) {
    const m = line.match(/^([^=]+)=([^;]*)/);
    if (!m) continue;
    const name = m[1].trim();
    const val = m[2];
    if (/expired/i.test(val) || /expires=Thu, 01-Jan-1970/i.test(line)) {
      jar.delete(name);
    } else {
      jar.set(name, val);
    }
  }
}

async function webmailFetch(
  jar: CookieJar,
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const cookie = cookieHeader(jar);
  if (cookie) headers.set("Cookie", cookie);
  if (!headers.has("User-Agent")) {
    headers.set(
      "User-Agent",
      "TokioToursMailRelay/1.0 (+https://tokiotours-app.com)"
    );
  }
  const res = await fetch(url, { ...init, headers, redirect: "manual" });
  storeCookies(jar, res);
  return res;
}

async function followRedirects(
  jar: CookieJar,
  url: string,
  init: RequestInit = {},
  max = 8
): Promise<{ res: Response; url: string; body: string }> {
  let current = url;
  let res = await webmailFetch(jar, current, init);
  for (let i = 0; i < max && [301, 302, 303, 307, 308].includes(res.status); i++) {
    const loc = res.headers.get("location");
    if (!loc) break;
    current = new URL(loc, current).toString();
    res = await webmailFetch(jar, current, { method: "GET" });
  }
  const body = await res.text();
  return { res, url: current, body };
}

function firstMatch(text: string, patterns: RegExp[]): string {
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1];
  }
  return "";
}

const CONCIERGE_DISPLAY_NAME = "Tokiotours Concierge";
const CONCIERGE_EMAIL = "no_reply@tokiotours.com";

async function ensureConciergeIdentity(
  jar: CookieJar,
  base: string,
  tokenIn: string
): Promise<void> {
  try {
    const edit = await followRedirects(
      jar,
      `${base}/?_task=settings&_action=edit-identity&_iid=1`
    );
    const currentName = firstMatch(edit.body, [
      /name="_name"[^>]*value="([^"]*)"/,
    ]);
    if (currentName === CONCIERGE_DISPLAY_NAME) return;

    const token =
      firstMatch(edit.body, [
        /name="_token"\s+value="([^"]+)"/,
        /"request_token":"([^"]+)"/,
      ]) || tokenIn;
    if (!token) return;

    const data = new URLSearchParams({
      _token: token,
      _task: "settings",
      _action: "save-identity",
      _iid: "1",
      _name: CONCIERGE_DISPLAY_NAME,
      _email: CONCIERGE_EMAIL,
      _organization: "TOKIOTOURS",
      "_reply-to": "",
      _bcc: "",
      _signature: "",
      _html_signature: "0",
      _standard: "1",
    });

    await webmailFetch(jar, `${base}/?_task=settings&_action=save-identity`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Roundcube-Request": token,
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json, text/javascript, */*; q=0.01",
      },
      body: data.toString(),
    });
  } catch (err) {
    console.warn(
      "[mail] Could not update Roundcube identity display name",
      err instanceof Error ? err.message : err
    );
  }
}

function resolveWebmailCreds(): { user: string; pass: string } | null {
  // Lazy import-free: env first (Docker), then active JSON/env merge via process.env only.
  const user =
    envVal("BLUEHOST_WEBMAIL_USER") ||
    envVal("SMTP_USER") ||
    "no_reply@tokiotours.com";
  const pass = envVal("BLUEHOST_WEBMAIL_PASS") || envVal("SMTP_PASS");
  if (!user || !pass) return null;
  if (!/@tokiotours\.com$/i.test(user)) return null;
  return { user, pass };
}

export function bluehostWebmailConfigured(): boolean {
  return Boolean(resolveWebmailCreds());
}

/**
 * Deliver one message through Bluehost Roundcube as no_reply@tokiotours.com.
 */
export async function sendViaBluehostWebmail(
  input: WebmailMailInput
): Promise<{ sent: true; via: "bluehost-webmail" }> {
  const creds = resolveWebmailCreds();
  if (!creds) {
    throw new Error("Bluehost webmail credentials not configured (SMTP_USER/PASS).");
  }

  const toList = (Array.isArray(input.to) ? input.to : [input.to])
    .map((a) => a.trim())
    .filter(Boolean);
  if (!toList.length) throw new Error("Webmail send requires a recipient.");

  const jar: CookieJar = new Map();
  const login = await followRedirects(
    jar,
    "https://mail.tokiotours.com:2096/login/",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        user: creds.user,
        pass: creds.pass,
      }).toString(),
    }
  );

  const cpsess =
    firstMatch(login.url, [/(cpsess\d+)/]) ||
    firstMatch(login.body, [/(cpsess\d+)/]);
  if (!cpsess) {
    throw new Error("Bluehost webmail login failed (no cpsess).");
  }

  const base = `https://mail.tokiotours.com:2096/${cpsess}/3rdparty/roundcube`;
  const home = await followRedirects(jar, `${base}/`);
  let token = firstMatch(home.body, [/"request_token":"([^"]+)"/]);

  // Ensure Roundcube identity display name is "Tokiotours Concierge"
  // (otherwise Gmail shows "no_reply").
  await ensureConciergeIdentity(jar, base, token);

  const compose = await followRedirects(
    jar,
    `${base}/?_task=mail&_action=compose`
  );
  const composeId =
    firstMatch(compose.body, [
      /name="_id"\s+value="([^"]*)"/,
      /"compose_id":"([^"]+)"/,
    ]) || firstMatch(compose.url, [/_id=([^&]+)/]);
  token =
    firstMatch(compose.body, [
      /name="_token"\s+value="([^"]+)"/,
      /"request_token":"([^"]+)"/,
    ]) || token;

  if (!composeId || !token) {
    throw new Error("Bluehost Roundcube compose session incomplete.");
  }

  // Attachments via Roundcube upload — must succeed when PDFs are required
  const wanted = input.attachments || [];
  const uploadedIds: string[] = [];
  for (const att of wanted) {
    const form = new FormData();
    form.set("_token", token);
    form.set("_id", composeId);
    form.set("_uploadid", `upload${Date.now()}`);
    form.set(
      "_attachments[]",
      new Blob([new Uint8Array(att.content)], {
        type: att.contentType || "application/pdf",
      }),
      att.filename
    );
    const up = await webmailFetch(
      jar,
      `${base}/?_task=mail&_action=upload`,
      {
        method: "POST",
        headers: {
          "X-Roundcube-Request": token,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: form,
      }
    );
    const upText = await up.text();
    const id =
      firstMatch(upText, [
        /"id":"([^"]+)"/,
        /"attachment":\{[^}]*"id":"([^"]+)"/,
        /add2attachment\(['"]([^'"]+)/,
        /_attachments":\s*\{[^}]*"([^"]+)":\{/,
      ]) || "";
    if (id) uploadedIds.push(id);
    else {
      console.warn(
        "[mail] Roundcube attachment upload failed",
        att.filename,
        up.status,
        upText.slice(0, 280)
      );
    }
  }

  if (wanted.length > 0 && uploadedIds.length < wanted.length) {
    throw new Error(
      `Bluehost Roundcube attached ${uploadedIds.length}/${wanted.length} PDF(s); falling back to relay/SMTP.`
    );
  }

  const isHtml = Boolean(input.html && input.html.trim());
  const bcc = (input.bcc || []).filter(Boolean);
  const data = new URLSearchParams({
    _token: token,
    _task: "mail",
    _action: "send",
    _id: composeId,
    _from: "1", // Roundcube identity id for no_reply@tokiotours.com
    _to: toList.join(", "),
    _cc: "",
    _bcc: bcc.join(", "),
    _replyto: input.replyTo || "",
    _subject: input.subject,
    _message: isHtml ? input.html! : input.text,
    _is_html: isHtml ? "1" : "0",
    _attachments: uploadedIds.join(","),
  });

  const sendRes = await webmailFetch(
    jar,
    `${base}/?_task=mail&_action=send`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Roundcube-Request": token,
        Accept: "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: data.toString(),
    }
  );
  const sendBody = await sendRes.text();
  const ok =
    /sent_successfully/i.test(sendBody) ||
    /message sent successfully/i.test(sendBody);

  if (!ok) {
    throw new Error(
      `Bluehost Roundcube send failed (HTTP ${sendRes.status}): ${sendBody.slice(0, 240)}`
    );
  }

  console.info("[mail] Bluehost Roundcube OK", {
    to: toList,
    bcc,
    subject: input.subject,
    attachments: uploadedIds.length,
  });
  return { sent: true, via: "bluehost-webmail" };
}
