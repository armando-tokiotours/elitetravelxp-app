import { NextResponse } from "next/server";
import { buildMasterKnowledgeSnapshot } from "@/lib/masterKnowledgeExport";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import { verifyCredentialActor } from "@/lib/staffCredentialAuth";
import { canAccessOpsBoard } from "@/lib/staffRoles";

async function requireOpsExportActor(request: Request) {
  const actor = await verifyCredentialActor(request);
  if (!actor) return null;
  if (actor.isSuperuser || canAccessOpsBoard(actor.role)) return actor;
  return null;
}

/**
 * GET /api/ops/export-master-knowledge
 * Full Catalog & Rules Manager dump → tokiotours_master_knowledge.json
 */
export async function GET(request: Request) {
  try {
    const actor = await requireOpsExportActor(request);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pb = await getAdminPocketBase();
    const snapshot = await buildMasterKnowledgeSnapshot(pb);
    const body = JSON.stringify(snapshot, null, 2);
    const stamp = new Date().toISOString().slice(0, 10);

    return new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="tokiotours_master_knowledge_${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[export-master-knowledge]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to export master knowledge",
      },
      { status: 500 }
    );
  }
}
