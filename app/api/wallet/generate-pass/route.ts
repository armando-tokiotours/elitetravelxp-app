import { NextResponse } from "next/server";
import { buildTokiotoursPassJson } from "@/lib/wallet/buildPassJson";
import type { ApplePassPayload } from "@/lib/wallet/downloadApplePass";

export const runtime = "nodejs";

/**
 * POST /api/wallet/generate-pass
 *
 * Returns a signed `.pkpass` when Apple Pass signing is configured:
 * - APPLE_PASS_SIGNER_URL — external signer that accepts pass.json and returns .pkpass
 * - or local certs (future): APPLE_PASS_CERT / APPLE_PASS_KEY / APPLE_WWDR_CERT
 *
 * Without signing config, returns 503 + pass.json preview for debugging.
 */
export async function POST(req: Request) {
  let body: Partial<ApplePassPayload>;
  try {
    body = (await req.json()) as Partial<ApplePassPayload>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const pnrCode = String(body.pnrCode || "").trim().toUpperCase();
  if (!pnrCode) {
    return NextResponse.json(
      { error: "pnrCode is required to generate a Wallet pass." },
      { status: 400 }
    );
  }

  const payload: ApplePassPayload = {
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

  const passJson = buildTokiotoursPassJson(payload);
  const signerUrl = process.env.APPLE_PASS_SIGNER_URL?.trim();

  if (signerUrl) {
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
        body: JSON.stringify({ pass: passJson, pnrCode }),
      });
      if (!upstream.ok) {
        const errText = await upstream.text().catch(() => "");
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
          "Content-Disposition": `attachment; filename="TOKIOTOURS-${pnrCode}.pkpass"`,
          "Cache-Control": "no-store",
        },
      });
    } catch (err) {
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
        "Apple Wallet signing is not configured yet. Set APPLE_PASS_SIGNER_URL (or local pass certificates) to enable .pkpass downloads. QR concierge access still works.",
      setupRequired: true,
      passPreview: passJson,
    },
    { status: 503 }
  );
}
