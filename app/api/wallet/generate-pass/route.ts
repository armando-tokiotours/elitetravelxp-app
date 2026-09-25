import { NextResponse } from "next/server";
import { buildTokiotoursPassJson } from "@/lib/wallet/buildPassJson";
import type { ApplePassPayload } from "@/lib/wallet/downloadApplePass";

export const runtime = "nodejs";

function allowFallback(): boolean {
  const v = process.env.ALLOW_PASS_FALLBACK?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v == null || v === "";
}

function parsePayload(body: Partial<ApplePassPayload>): ApplePassPayload | null {
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

/**
 * GET /api/wallet/generate-pass?pnr=JPN-XXXX
 * Email / deep-link entry → mobile pass preview (signing optional).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const pnr = String(url.searchParams.get("pnr") || "")
    .trim()
    .toUpperCase();
  if (!pnr) {
    return NextResponse.json({ error: "pnr is required." }, { status: 400 });
  }
  const origin = url.origin;
  return NextResponse.redirect(
    `${origin}/pass-preview/${encodeURIComponent(pnr)}`,
    302
  );
}

/**
 * POST /api/wallet/generate-pass
 *
 * Returns a signed `.pkpass` when Apple Pass signing is configured:
 * - APPLE_PASS_SIGNER_URL — external signer that accepts pass.json and returns .pkpass
 *
 * Without signing config, returns 503 + previewUrl for the mobile pass page.
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
  const signerUrl = process.env.APPLE_PASS_SIGNER_URL?.trim();
  const previewUrl = `/pass-preview/${encodeURIComponent(payload.pnrCode)}`;

  // Avoid recursive self-calls if SIGNER_URL points at this app's generate route
  const isSelfSigner = Boolean(
    signerUrl && /\/api\/wallet\/generate(-pass)?/i.test(signerUrl)
  );

  if (signerUrl && !isSelfSigner) {
    try {
      const upstream = await fetch(signerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.APPLE_PASS_SIGNER_TOKEN
            ? {
                Authorization: `Bearer ${process.env.APPLE_PASS_SIGNER_TOKEN}`,
              }
            : {}),
        },
        body: JSON.stringify({ pass: passJson, pnrCode: payload.pnrCode }),
      });
      if (!upstream.ok) {
        const errText = await upstream.text().catch(() => "");
        if (allowFallback()) {
          return NextResponse.json(
            {
              error: `Pass signer failed (${upstream.status}). Opening preview instead.`,
              setupRequired: true,
              fallback: true,
              previewUrl,
              passPreview: passJson,
            },
            { status: 503 }
          );
        }
        return NextResponse.json(
          {
            error: `Pass signer failed (${upstream.status}). ${errText.slice(0, 200)}`,
          },
          { status: 502 }
        );
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.pkpass",
          "Content-Disposition": `attachment; filename="TOKIOTOURS-${payload.pnrCode}.pkpass"`,
          "Cache-Control": "no-store",
        },
      });
    } catch (err) {
      if (allowFallback()) {
        return NextResponse.json(
          {
            error:
              err instanceof Error
                ? err.message
                : "Could not reach Apple Pass signer.",
            setupRequired: true,
            fallback: true,
            previewUrl,
            passPreview: passJson,
          },
          { status: 503 }
        );
      }
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Could not reach Apple Pass signer.",
        },
        { status: 502 }
      );
    }
  }

  return NextResponse.json(
    {
      error:
        "Apple Wallet signing certificates are not configured yet. Use the mobile pass preview — scan the QR or open on iPhone for Wallet access.",
      setupRequired: true,
      fallback: allowFallback(),
      previewUrl,
      passPreview: passJson,
    },
    { status: 503 }
  );
}
