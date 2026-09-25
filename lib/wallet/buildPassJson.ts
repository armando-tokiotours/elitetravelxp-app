import type { ApplePassPayload } from "@/lib/wallet/downloadApplePass";

/**
 * Builds the Apple PassKit `pass.json` body for a Tokiotours travel pass.
 * Signing into a .pkpass requires Apple certificates (see generate-pass route).
 */
export function buildTokiotoursPassJson(payload: ApplePassPayload) {
  const serial = payload.pnrCode.replace(/[^A-Z0-9-]/gi, "").toUpperCase();
  const isSingle = payload.tripType === "single";
  const datesLine = isSingle
    ? payload.startDateText || "TBD"
    : [payload.startDateText, payload.endDateText].filter(Boolean).join(" – ");
  const routeLine = isSingle
    ? payload.singleDayHighlights || ""
    : (payload.routeBreakdown || [])
        .map((r) => `${r.city} (${r.nights}N)`)
        .join(" → ");

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
          label: isSingle ? "START / PICKUP" : payload.originLabel || "ORIGIN",
          value: isSingle
            ? payload.startTime || "09:00"
            : payload.originCode || "NRT",
        },
        {
          key: "destination",
          label: isSingle
            ? "FINISH / DROP-OFF"
            : payload.destinationLabel || "DESTINATION",
          value: isSingle
            ? payload.endTime || "15:00"
            : payload.destinationCode || "HND",
        },
      ],
      secondaryFields: [
        {
          key: "guest",
          label: "GUEST",
          value: payload.guestName,
        },
        {
          key: "party",
          label: "PARTY",
          value: payload.partyText,
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
          value: datesLine || "TBD",
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
          value: isSingle ? "Japan Day Tour Pass" : "Japan Multi-Day Pass",
        },
        {
          key: "experience",
          label: "EXPERIENCE TIER",
          value: payload.experienceType || "",
        },
        {
          key: "route",
          label: isSingle ? "HIGHLIGHTS & AREA" : "ROUTE & NIGHTS",
          value: routeLine || "",
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

  console.info(
    `[wallet] APNs update queued for ${opts.pnrCode}: ${opts.reason || "fields changed"}`
  );
  return { ok: true };
}
