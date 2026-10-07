import { NextResponse } from "next/server";
import { clearExpiredTicketVouchers } from "@/lib/ticketVouchers";

/**
 * GET|POST /api/cron/cleanup-tickets
 *
 * Unlinks local ticket PDFs under public/uploads/tickets and clears
 * voucherUrl / voucherFilename / voucherBlobPathname on
 * ops_hub.extras.agent_services when tour_date/end_date is older than today−2 days.
 *
 * Protect with Authorization: Bearer $CRON_SECRET (or ?secret=) when CRON_SECRET is set.
 *
 * Env (document only — never commit values):
 *   CRON_SECRET — shared secret for cron callers
 *
 * VPS cron example (daily, no secrets in the repo):
 *   15 3 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
 *     https://tokiotours-app.com/api/cron/cleanup-tickets
 */

function authorizeCron(request: Request): boolean {
  const secret = String(process.env.CRON_SECRET || "").trim();
  if (!secret) {
    // Allow in local/dev when secret unset; production should set CRON_SECRET
    return process.env.NODE_ENV !== "production";
  }
  const auth = String(request.headers.get("authorization") || "");
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  if (url.searchParams.get("secret") === secret) return true;
  return false;
}

async function runCleanup(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await clearExpiredTicketVouchers();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cleanup failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return runCleanup(request);
}

export async function POST(request: Request) {
  return runCleanup(request);
}
