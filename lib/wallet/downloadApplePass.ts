import type { BookingPassProps } from "@/components/dossier/JapanBookingPass.types";

export type ApplePassPayload = Omit<
  BookingPassProps,
  "actions" | "onDownloadWalletPass" | "onRefreshPass" | "showSectionOutline"
>;

export const WALLET_PASS_STORAGE_KEY = "tokiotours-wallet-pass-payload";

export class WalletPassFallbackError extends Error {
  previewUrl: string;
  constructor(previewUrl: string) {
    super("Opening mobile pass preview…");
    this.name = "WalletPassFallbackError";
    this.previewUrl = previewUrl;
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

/** Client helper — downloads a signed .pkpass, or opens mobile pass preview. */
export async function downloadAppleWalletPass(
  payload: ApplePassPayload
): Promise<void> {
  const res = await fetch("/api/wallet/generate-pass", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const contentType = res.headers.get("content-type") || "";
  const previewUrl = `/pass-preview/${encodeURIComponent(payload.pnrCode)}`;

  if (!res.ok) {
    let message = "Could not generate Apple Wallet pass.";
    let setupRequired = false;
    if (contentType.includes("application/json")) {
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        setupRequired?: boolean;
        fallback?: boolean;
        previewUrl?: string;
      };
      if (data.error) message = data.error;
      setupRequired = Boolean(data.setupRequired || data.fallback);
      if (data.previewUrl) {
        stashPassPayload(payload);
        throw new WalletPassFallbackError(data.previewUrl);
      }
    }
    if (setupRequired || res.status === 503) {
      stashPassPayload(payload);
      throw new WalletPassFallbackError(previewUrl);
    }
    throw new Error(message);
  }

  if (!contentType.includes("application/vnd.apple.pkpass")) {
    stashPassPayload(payload);
    throw new WalletPassFallbackError(previewUrl);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `TOKIOTOURS-${payload.pnrCode}.pkpass`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
