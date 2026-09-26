import { NextResponse } from "next/server";
import { buildTokiotoursPassJson } from "@/lib/wallet/buildPassJson";
import type { ApplePassPayload } from "@/lib/wallet/downloadApplePass";
import {
  generatePkpassBuffer,
  hasLocalApplePassCerts,
} from "@/lib/wallet/generatePkpass";
import { publicAbsoluteUrl, publicSiteOrigin } from "@/lib/publicSiteOrigin";

export const runtime = "nodejs";

function allowFallback(): boolean {
  const v = process.env.ALLOW_PASS_FALLBACK?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v == null || v === "";
}

function pkpassHeaders(pnrCode: string): HeadersInit {
  return {
    "Content-Type": "application/vnd.apple.pkpass",
    "Content-Disposition": `inline; filename="Tokiotours-${pnrCode}.pkpass"`,
    "Cache-Control": "no-cache, no-store, must-revalidate",
  };
}

export function parsePayload(
  body: Partial<ApplePassPayload>
): ApplePassPayload | null {
  const pnrCode = String(body.pnrCode || "").trim().toUpperCase();
  if (!pnrCode) return null;
  return {
    pnrCode,
    guestName: String(body.guestName || "GUEST"),
    partyText: String(body.partyText || "—"),
    travelStyle: String(body.travelStyle || "—"),
    tripType: body.tripType === "single" ? "single" : "multi",
    experienceType: body.experienceType,
    originCode: body.originCode || "NRT",
    originLabel: body.originLabel || "TOKYO ENTRY",
    destinationCode: body.destinationCode || "HND",
    destinationLabel: body.destinationLabel || "DEPARTURE",
    startTime: body.startTime,
    endTime: body.endTime,
    singleDayHighlights: body.singleDayHighlights,
    durationText: body.durationText || "",
    startDateText: String(body.startDateText || ""),
    endDateText: String(body.endDateText || ""),
    routeBreakdown: Array.isArray(body.routeBreakdown)
      ? body.routeBreakdown
      : [],
    status: body.status || "IN_PROGRESS",
    qrValue: body.qrValue,
  };
}

function minimalPayloadFromPnr(pnr: string, req?: Request): ApplePassPayload {
  const origin = publicSiteOrigin(req);
  return {
    pnrCode: pnr,
    guestName: "GUEST",
    partyText: "—",
    travelStyle: "—",
    tripType: "multi",
    experienceType: "PREMIUM CONCIERGE",
    originCode: "NRT",
    originLabel: "TOKYO ENTRY",
    destinationCode: "HND",
    destinationLabel: "DEPARTURE",
    durationText: "",
    startDateText: "",
    endDateText: "",
    routeBreakdown: [],
    status: "IN_PROGRESS",
    qrValue: `${origin}/builder/itinerary?ref=${encodeURIComponent(pnr)}&view=dossier`,
  };
}

/**
 * GET /api/wallet/generate-pass?pnr=JPN-XXXX
 * Direct Safari navigation — returns signed .pkpass, else pass-preview redirect.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const pnr = String(url.searchParams.get("pnr") || "")
    .trim()
    .toUpperCase();
  if (!pnr) {
    return NextResponse.json({ error: "pnr is required." }, { status: 400 });
  }

  const payload = minimalPayloadFromPnr(pnr, req);
  const previewUrl = publicAbsoluteUrl(
    `/api/wallet/pass-file?pnr=${encodeURIComponent(pnr)}`,
    req
  );

  try {
    const buf = await generatePkpassBuffer(payload);
    if (buf) {
      return new NextResponse(buf as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.pkpass",
          "Content-Disposition": `attachment; filename="Tokiotours-${pnr}.pkpass"`,
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }
  } catch (err) {
    console.error("[wallet] GET generate failed:", err);
  }

  // No signed .pkpass → downloadable PDF for manual keep
  return NextResponse.redirect(previewUrl, 302);
}

/**
 * POST /api/wallet/generate-pass
 * Signed .pkpass when local Apple certs or APPLE_PASS_SIGNER_URL are configured.
 */
export async function POST(req: Request) {
  let body: Partial<ApplePassPayload>;
  try {
    body = (await req.json()) as Partial<ApplePassPayload>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = parsePayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: "pnrCode is required to generate a Wallet pass." },
      { status: 400 }
    );
  }

  const passJson = buildTokiotoursPassJson(payload);
  const previewUrl = `/pass-preview/${encodeURIComponent(payload.pnrCode)}`;

  try {
    const buf = await generatePkpassBuffer(payload);
    if (buf) {
      return new NextResponse(buf as unknown as BodyInit, {
        status: 200,
        headers: pkpassHeaders(payload.pnrCode),
      });
    }
  } catch (err) {
    console.error("[wallet] POST generate failed:", err);
    if (!allowFallback()) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Could not generate Apple Wallet pass.",
        },
        { status: 502 }
      );
    }
  }

  const setupHint = hasLocalApplePassCerts()
    ? "Pass signing failed — check certificate PEM contents and APPLE_PASS_TYPE_ID / APPLE_TEAM_ID."
    : "Apple Wallet signing certificates are not configured yet. Set APPLE_WWDR_CERT, APPLE_PASS_CERT, APPLE_PASS_KEY (and APPLE_PASS_PASSPHRASE if needed), plus APPLE_PASS_TYPE_ID and APPLE_TEAM_ID.";

  return NextResponse.json(
    {
      error: setupHint,
      setupRequired: true,
      fallback: allowFallback(),
      previewUrl,
      passPreview: passJson,
    },
    { status: 503 }
  );
}
