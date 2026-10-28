import { NextResponse } from "next/server";
import PocketBase from "pocketbase";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import { fallbackGuideOfferToOpenBoard } from "@/lib/contractorOfferFallback";

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
    "http://127.0.0.1:8090"
  );
}

async function verifyStaffBearer(
  request: Request
): Promise<
  | { ok: true; email: string; name: string; id: string }
  | { ok: false }
> {
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
    if (!email || !id) return { ok: false };
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
 * POST /api/ops/contractor-fallback
 * Guide Portal decline → Open Board + Ops email (shared with expire cron).
 * Body: { jobId, reason?: "declined" }
 */
export async function POST(request: Request) {
  try {
    const staff = await verifyStaffBearer(request);
    if (!staff.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      jobId?: string;
      reason?: "declined" | "expired";
    };
    const jobId = String(body.jobId || "").trim();
    if (!jobId) {
      return NextResponse.json({ error: "jobId required" }, { status: 400 });
    }

    const reason = body.reason === "expired" ? "expired" : "declined";
    const pb = await getAdminPocketBase();
    const result = await fallbackGuideOfferToOpenBoard(pb, {
      jobId,
      reason,
      staffId: staff.id,
      staffName: staff.name,
    });

    if (!result.ok && !result.skipped) {
      return NextResponse.json(result, { status: 400 });
    }
    if (!result.ok && result.skipped) {
      return NextResponse.json(result, { status: 409 });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Contractor fallback failed",
      },
      { status: 500 }
    );
  }
}
