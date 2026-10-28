import { NextResponse } from "next/server";
import PocketBase from "pocketbase";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import { runPaymentConfirmationDispatch } from "@/lib/paymentDispatchEngine";
import type { PaymentDispatchThreshold } from "@/lib/paymentDispatchTemplates";

export const runtime = "nodejs";

function envVal(key: string): string | undefined {
  const raw = process.env[key]?.trim();
  if (!raw) return undefined;
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1).trim() || undefined;
  }
  return raw;
}

function internalPbUrl(): string {
  return (
    envVal("POCKETBASE_INTERNAL_URL") ||
    envVal("POCKETBASE_URL") ||
    envVal("NEXT_PUBLIC_POCKETBASE_URL") ||
    "http://pocketbase:8090"
  );
}

async function verifyStaffBearer(
  request: Request
): Promise<{ ok: true; email: string; name: string; id: string } | { ok: false }> {
  const auth = request.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false };

  const verify = new PocketBase(internalPbUrl());
  verify.autoCancellation(false);
  verify.authStore.save(token, null);

  try {
    const authData = await verify.collection("staff").authRefresh();
    const email = String(authData.record?.email || "").trim();
    const name = String(authData.record?.name || "").trim() || email;
    const id = String(authData.record?.id || "").trim();
    if (!email) return { ok: false };
    return { ok: true, email, name, id };
  } catch {
    /* try superuser */
  }
  try {
    const authData = await verify.collection("_superusers").authRefresh();
    const email = String(authData.record?.email || "").trim();
    const name = String(authData.record?.name || "").trim() || email;
    const id = String(authData.record?.id || "").trim();
    if (!email) return { ok: false };
    return { ok: true, email, name, id };
  } catch {
    return { ok: false };
  }
}

/**
 * POST /api/ops/payment-dispatch
 * Staff-auth: Notify & Lock Dates (manual) or re-fire after payment.
 * { pnr, force?, threshold?: "deposit_30" | "full_100" | "auto", scope?: "primary" | "bulk" }
 */
export async function POST(request: Request) {
  try {
    const staff = await verifyStaffBearer(request);
    if (!staff.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      pnr?: string;
      force?: boolean;
      threshold?: PaymentDispatchThreshold | "auto";
      scope?: "primary" | "bulk";
    };

    const pnr = String(body.pnr || "")
      .trim()
      .toUpperCase()
      .replace(/"/g, "");
    if (!pnr) {
      return NextResponse.json({ error: "pnr required" }, { status: 400 });
    }

    const pb = await getAdminPocketBase();
    const result = await runPaymentConfirmationDispatch(pb, {
      pnr,
      source: "manual",
      force: Boolean(body.force),
      threshold: body.threshold || "auto",
      scope: body.scope === "bulk" ? "bulk" : "primary",
      staffName: staff.name,
      staffId: staff.id,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Payment dispatch failed",
      },
      { status: 500 }
    );
  }
}
