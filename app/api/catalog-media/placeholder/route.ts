import { NextResponse } from "next/server";
import { verifyCredentialActor } from "@/lib/staffCredentialAuth";
import { canAccessOpsBoard, canAccessTeamAccess } from "@/lib/staffRoles";
import { ensureVpsCatalogPlaceholder } from "@/lib/vpsCatalogPlaceholder";

/**
 * POST /api/catalog-media/placeholder  { recordId, title }
 * Creates the auto-placeholder `{recordId}_1.webp` (+ mobile pair) for a
 * newly created catalog record with no photo. Idempotent: an existing
 * slot file (real photo or earlier placeholder) is never overwritten.
 * No PocketBase write — the record ID alone names the image.
 */
export async function POST(request: Request) {
  try {
    const actor = await verifyCredentialActor(request);
    if (
      !actor ||
      !(actor.isSuperuser || canAccessOpsBoard(actor.role) || canAccessTeamAccess(actor.role))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json()) as { recordId?: string; title?: string };
    const recordId = String(body.recordId || "").trim();
    const title = String(body.title || "").trim();
    if (!recordId) {
      return NextResponse.json({ error: "recordId required" }, { status: 400 });
    }
    const result = await ensureVpsCatalogPlaceholder(recordId, title);
    if (!result.slot) {
      return NextResponse.json({ error: "Invalid recordId" }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      created: result.created,
      slot: result.slot,
      url: result.url || "",
      mobileUrl: result.mobileUrl || "",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create placeholder" },
      { status: 500 }
    );
  }
}
