import { NextResponse } from "next/server";
import PocketBase from "pocketbase";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import { expireStaleContractorOffers } from "@/lib/contractorOfferFallback";

export const runtime = "nodejs";

/**
 * GET|POST /api/ops/expire-offers
 *
 * Idempotent poll: guide_jobs with status=OFFERED and offered_at
 * (fallback: updated) older than 48h → OPEN_BOARD, clear assignment,
 * booking log + Ops transactional email.
 *
 * Auth (same idea as /api/cron/cleanup-tickets):
 *   - Authorization: Bearer $CRON_SECRET  (or ?secret=)
 *   - Staff / superuser Bearer token
 *   - When CRON_SECRET unset: allowed if NODE_ENV !== "production" (local)
 *
 * Manual local:
 *   curl -fsS http://127.0.0.1:3000/api/ops/expire-offers
 *
 * VPS cron (hourly):
 *   20 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
 *     https://tokiotours-app.com/api/ops/expire-offers
 */

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

async function authorize(request: Request): Promise<boolean> {
  const secret = String(process.env.CRON_SECRET || "").trim();
  const auth = String(request.headers.get("authorization") || "");
  const url = new URL(request.url);

  if (secret) {
    if (auth === `Bearer ${secret}`) return true;
    if (url.searchParams.get("secret") === secret) return true;
  } else if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token || (secret && token === secret)) return Boolean(secret && auth === `Bearer ${secret}`);

  const verify = new PocketBase(internalPbUrl());
  verify.autoCancellation(false);
  verify.authStore.save(token, null);
  try {
    await verify.collection("staff").authRefresh();
    return true;
  } catch {
    /* try superuser */
  }
  try {
    await verify.collection("_superusers").authRefresh();
    return true;
  } catch {
    return false;
  }
}

async function run(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pb = await getAdminPocketBase();
    const result = await expireStaleContractorOffers(pb);
    return NextResponse.json({
      ...result,
      hint: "Offers older than 48h returned to OPEN_BOARD; Ops emailed when any expired.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Expire offers failed",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
