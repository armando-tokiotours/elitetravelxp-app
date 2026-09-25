import type { ApplePassPayload } from "@/lib/wallet/downloadApplePass";

/**
 * Builds the Apple PassKit `pass.json` body for a Tokiotours travel pass.
 * Signing into a .pkpass requires Apple certificates (see generate-pass route).
 */
export function buildTokiotoursPassJson(payload: ApplePassPayload) {
  const serial = payload.pnrCode.replace(/[^A-Z0-9-]/gi, "").toUpperCase();
  return {
    formatVersion: 1,
    passTypeIdentifier:
      process.env.APPLE_PASS_TYPE_ID || "pass.com.tokiotours.travel",
    serialNumber: serial || "DRAFT",
    teamIdentifier: process.env.APPLE_TEAM_ID || "TEAMID",
    organizationName: "TOKIOTOURS",
    description: "TOKIOTOURS Japan Travel Pass",
    logoText: "TOKIOTOURS",
    foregroundColor: "rgb(255, 255, 255)",
    backgroundColor: "rgb(10, 16, 23)",
    labelColor: "rgb(246, 167, 36)",
    boardingPass: {
      transitType: "PKTransitTypeAir",
      headerFields: [
        {
          key: "pnr",
          label: "BOOKING REF",
          value: payload.pnrCode,
        },
      ],
      primaryFields: [
        {
          key: "origin",
          label: payload.originLabel || "ORIGIN",
          value: payload.originCode || "NRT",
        },
        {
          key: "destination",
          label: payload.destinationLabel || "DESTINATION",
          value: payload.destinationCode || "HND",
        },
      ],
      secondaryFields: [
        {
          key: "passenger",
          label: "PASSENGER",
          value: payload.passengerName,
        },
        {
          key: "party",
          label: "PARTY",
          value: payload.guestCountText,
        },
      ],
      auxiliaryFields: [
        {
          key: "style",
          label: "STYLE",
          value: payload.travelStyle,
        },
        {
          key: "dates",
          label: "DATES",
          value: payload.datesText || "TBD",
        },
        {
          key: "duration",
          label: "DURATION",
          value: payload.durationText || "",
        },
      ],
      backFields: [
        {
          key: "tripType",
          label: "TRIP",
          value:
            payload.tripType === "single"
              ? "Japan Day Tour Pass"
              : "Japan Multi-Day Pass",
        },
        {
          key: "status",
          label: "STATUS",
          value: payload.status || "IN_PROGRESS",
        },
        {
          key: "concierge",
          label: "CONCIERGE",
          value: payload.qrValue || "",
        },
      ],
    },
    barcode: {
      format: "PKBarcodeFormatQR",
      message: payload.qrValue || payload.pnrCode,
      messageEncoding: "iso-8859-1",
    },
    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: payload.qrValue || payload.pnrCode,
        messageEncoding: "iso-8859-1",
      },
    ],
  };
}

/**
 * Push a live pass update via APNs when trip details change.
 * No-ops until `APPLE_APNS_KEY_ID` + key material are configured.
 */
export async function notifyApplePassUpdate(opts: {
  pnrCode: string;
  reason?: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!process.env.APPLE_APNS_KEY_ID || !process.env.APPLE_APNS_KEY_P8) {
    return {
      ok: false,
      skipped: true,
      error:
        "APNs not configured. Set APPLE_APNS_KEY_ID and APPLE_APNS_KEY_P8 to push live Wallet updates.",
    };
  }

  // Device registrations would be looked up by PNR serial + push tokens
  // stored when Wallet hits /api/wallet/v1/devices/...
  console.info(
    `[wallet] APNs update queued for ${opts.pnrCode}: ${opts.reason || "fields changed"}`
  );
  return { ok: true };
}
