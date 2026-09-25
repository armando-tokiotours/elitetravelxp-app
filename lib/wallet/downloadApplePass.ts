import type { BookingPassProps } from "@/components/dossier/JapanBookingPass.types";

export type ApplePassPayload = Omit<
  BookingPassProps,
  "actions" | "onDownloadWalletPass" | "onRefreshPass" | "showSectionOutline"
>;

/** Client helper — downloads a signed .pkpass when the API can produce one. */
export async function downloadAppleWalletPass(
  payload: ApplePassPayload
): Promise<void> {
  const res = await fetch("/api/wallet/generate-pass", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    let message = "Could not generate Apple Wallet pass.";
    if (contentType.includes("application/json")) {
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (data.error) message = data.error;
    }
    throw new Error(message);
  }

  if (!contentType.includes("application/vnd.apple.pkpass")) {
    throw new Error(
      "Apple Wallet signing is not configured on this server yet. Use the QR code for concierge access."
    );
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
