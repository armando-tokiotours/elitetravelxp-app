import type { BookingPassProps } from "@/components/dossier/JapanBookingPass.types";
import {
  isIOSChrome,
  walletPassPreviewUrl,
} from "@/lib/wallet/iosWallet";

export type ApplePassPayload = Omit<
  BookingPassProps,
  "actions" | "onDownloadWalletPass" | "onRefreshPass" | "showSectionOutline"
>;

export const WALLET_PASS_STORAGE_KEY = "tokiotours-wallet-pass-payload";

export class WalletPassFallbackError extends Error {
  previewUrl: string;
  reason: "chrome_ios" | "unsigned" | "error";
  constructor(
    previewUrl: string,
    reason: "chrome_ios" | "unsigned" | "error" = "unsigned"
  ) {
    super(
      reason === "chrome_ios"
        ? "Open this pass in Safari to add it to Apple Wallet."
        : "Opening mobile pass preview…"
    );
    this.name = "WalletPassFallbackError";
    this.previewUrl = previewUrl;
    this.reason = reason;
  }
}

function stashPassPayload(payload: ApplePassPayload): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      `${WALLET_PASS_STORAGE_KEY}:${payload.pnrCode}`,
      JSON.stringify(payload)
    );
  } catch {
    /* ignore quota */
  }
}

/** Absolute download URL for the manual pass file (PDF, or .pkpass when signed). */
export function walletPassFileUrl(pnrCode: string): string {
  return `/api/wallet/pass-file?pnr=${encodeURIComponent(pnrCode)}&download=1`;
}

/**
 * Download a pass file the guest can save manually.
 * Prefer this over Safari Wallet sheet until Apple signing certs are live —
 * always triggers a file download (PDF today; .pkpass when configured).
 */
export function downloadAppleWalletPass(payload: ApplePassPayload): void {
  stashPassPayload(payload);

  // Always download a file (PDF or signed .pkpass). Wallet sheet is unreliable
  // without certs / on Chrome iOS; manual file is the reliable path.
  window.location.href = walletPassFileUrl(payload.pnrCode);
}

/** @deprecated Prefer downloadAppleWalletPass — kept for Chrome Safari-hint callers. */
export function openAppleWalletOrPreview(payload: ApplePassPayload): void {
  stashPassPayload(payload);
  if (isIOSChrome()) {
    throw new WalletPassFallbackError(
      walletPassPreviewUrl(payload.pnrCode, { chromeHint: true }),
      "chrome_ios"
    );
  }
  window.location.href = walletPassFileUrl(payload.pnrCode);
}

export function readStashedPassPayload(
  pnrCode: string
): ApplePassPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(
      `${WALLET_PASS_STORAGE_KEY}:${pnrCode}`
    );
    if (!raw) return null;
    return JSON.parse(raw) as ApplePassPayload;
  } catch {
    return null;
  }
}
