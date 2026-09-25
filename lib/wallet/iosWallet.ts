/** iOS / browser helpers for Apple Wallet `.pkpass` handling. */

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Chrome (and Chromium browsers) on iOS — cannot open Wallet sheet for .pkpass. */
export function isIOSChrome(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return isIOS() && (/CriOS/i.test(ua) || /FxiOS/i.test(ua) || /EdgiOS/i.test(ua));
}

/** Safari on iOS (not Chrome/Firefox/Edge wrappers). */
export function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (!isIOS()) return false;
  if (isIOSChrome()) return false;
  return /Safari/i.test(ua);
}

export function walletPassPreviewUrl(pnrCode: string, opts?: { chromeHint?: boolean }): string {
  const base = `/pass-preview/${encodeURIComponent(pnrCode)}`;
  if (opts?.chromeHint) return `${base}?openInSafari=1`;
  return base;
}
