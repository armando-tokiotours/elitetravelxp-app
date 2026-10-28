import { NextResponse } from "next/server";
import {
  parseIngestionCSV,
  type IngestionRow,
} from "@/lib/csvIngestionParser";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import { auditImportedCSVAgainstRules } from "@/lib/ruleComplianceAuditor";
import { verifyCredentialActor } from "@/lib/staffCredentialAuth";
import { canAccessOpsBoard } from "@/lib/staffRoles";

async function requireOpsActor(request: Request) {
  const actor = await verifyCredentialActor(request);
  if (!actor) return null;
  if (actor.isSuperuser || canAccessOpsBoard(actor.role)) return actor;
  return null;
}

/**
 * POST /api/ops/audit-csv
 * Body: { rows } or { csvText } — returns rule compliance report (no write).
 */
export async function POST(request: Request) {
  try {
    const actor = await requireOpsActor(request);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      rows?: IngestionRow[];
      csvText?: string;
    };

    let rows: IngestionRow[] = Array.isArray(body.rows) ? body.rows : [];
    if ((!rows || rows.length === 0) && body.csvText) {
      rows = parseIngestionCSV(body.csvText);
    }
    if (!rows.length) {
      return NextResponse.json(
        { error: "No CSV rows found" },
        { status: 400 }
      );
    }

    const pb = await getAdminPocketBase();
    const audit = await auditImportedCSVAgainstRules(pb, rows);

    return NextResponse.json({ ok: true, audit });
  } catch (err) {
    console.error("[audit-csv]", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Audit failed",
      },
      { status: 500 }
    );
  }
}
