/**
 * Canonical public site origin for redirects (Wallet, email links, QR).
 * Never trust req.url.origin behind Docker — it can be https://0.0.0.0:3000.
 */
export function publicSiteOrigin(req?: Request): string {
  const fromEnv = (
    process.env.PUBLIC_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.SITE_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
  if (fromEnv && !isInternalOrigin(fromEnv)) return fromEnv;

  if (req) {
    const hostRaw =
      req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const host = hostRaw.split(",")[0]?.trim() || "";
    const protoRaw =
      req.headers.get("x-forwarded-proto") ||
      (host.includes("localhost") ? "http" : "https");
    const proto = protoRaw.split(",")[0]?.trim() || "https";
    if (host && !isInternalHost(host)) {
      return `${proto}://${host}`;
    }
  }

  return "https://tokiotours-app.com";
}

function isInternalHost(host: string): boolean {
  const h = host.toLowerCase().split(":")[0] || "";
  return (
    h === "0.0.0.0" ||
    h === "127.0.0.1" ||
    h === "localhost" ||
    h === "::1" ||
    h === "elite-web" ||
    h.endsWith(".internal")
  );
}

function isInternalOrigin(origin: string): boolean {
  try {
    return isInternalHost(new URL(origin).host);
  } catch {
    return true;
  }
}

export function publicAbsoluteUrl(path: string, req?: Request): string {
  const origin = publicSiteOrigin(req);
  if (/^https?:\/\//i.test(path)) return path;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}
