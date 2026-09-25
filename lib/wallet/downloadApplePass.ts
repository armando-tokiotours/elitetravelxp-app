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

/**
 * Trigger native iOS Wallet sheet via direct navigation to the .pkpass URL.
 * Do NOT fetch()+blob() — Safari will not hand blob: URLs to Apple Wallet.
 */
export function downloadAppleWalletPass(payload: ApplePassPayload): void {
  stashPassPayload(payload);

  // Chrome / Firefox / Edge on iOS cannot register .pkpass into Wallet
  if (isIOSChrome()) {
    throw new WalletPassFallbackError(
      walletPassPreviewUrl(payload.pnrCode, { chromeHint: true }),
      "chrome_ios"
    );
  }

  // Direct location change — Safari intercepts application/vnd.apple.pkpass
  window.location.href = `/api/wallet/apple/generate?pnr=${encodeURIComponent(payload.pnrCode)}`;
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
