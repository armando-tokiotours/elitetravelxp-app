import { NextResponse } from "next/server";
import { ingestInquiryCsv } from "@/lib/csvIngestion";
import {
  parseIngestionCSV,
  type IngestionRow,
} from "@/lib/csvIngestionParser";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import { verifyCredentialActor } from "@/lib/staffCredentialAuth";
import { canAccessOpsBoard } from "@/lib/staffRoles";

async function requireOpsIngestActor(request: Request) {
  const actor = await verifyCredentialActor(request);
  if (!actor) return null;
  if (actor.isSuperuser || canAccessOpsBoard(actor.role)) return actor;
  return null;
}

/**
 * POST /api/ops/ingest-csv
 * Body: { rows: IngestionRow[] } OR { csvText: string }
 * Auth: staff Bearer (ops / agent / owner) or superuser.
 */
export async function POST(request: Request) {
  try {
    const actor = await requireOpsIngestActor(request);
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
    const result = await ingestInquiryCsv(pb, rows, {
      agentName: actor.email || "CSV Ingest",
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("[ingest-csv]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to process CSV file",
      },
      { status: 500 }
    );
  }
}
