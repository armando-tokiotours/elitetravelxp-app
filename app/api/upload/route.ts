import { NextResponse } from "next/server";
import { verifyCredentialActor } from "@/lib/staffCredentialAuth";
import { canAccessOpsBoard, canAccessTeamAccess } from "@/lib/staffRoles";
import {
  isAllowedMediaFolder,
  writeVpsMediaFile,
} from "@/lib/vpsMediaStorage";

async function requireUploadActor(request: Request) {
  const actor = await verifyCredentialActor(request);
  if (!actor) return null;
  if (
    actor.isSuperuser ||
    canAccessOpsBoard(actor.role) ||
    canAccessTeamAccess(actor.role)
  ) {
    return actor;
  }
  return null;
}

/**
 * POST /api/upload
 * multipart: file, folder? (tickets|vouchers|comms|catalog|profiles|general|hero-panels),
 * stableKey? (e.g. "hero-panel-p1" — overwrite-in-place slot, URL never changes)
 * Returns { url: "/uploads/folder/..." } pointer for PocketBase text fields.
 */
export async function POST(request: Request) {
  try {
    const actor = await requireUploadActor(request);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get("file");
    const folderRaw = String(form.get("folder") || "general")
      .trim()
      .toLowerCase();
    const stableKey = String(form.get("stableKey") || "").trim() || undefined;

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    if (!isAllowedMediaFolder(folderRaw)) {
      return NextResponse.json(
        { error: `Invalid folder. Use: tickets, vouchers, comms, catalog, profiles, general, hero-panels` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const saved = await writeVpsMediaFile({
      folder: folderRaw,
      fileName: file.name || "upload.bin",
      buffer,
      stableKey,
    });

    return NextResponse.json({
      success: true,
      url: saved.url,
      fileName: saved.fileName,
      folder: saved.folder,
      size: saved.size,
      // Branding images also get a mobile proxy ({slot}--mobile.webp).
      mobileUrl: saved.mobileUrl || "",
      mobileSize: saved.mobileSize || 0,
      mimeType: file.type || "application/octet-stream",
    });
  } catch (err) {
    console.error("[upload]", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to write file",
      },
      { status: 500 }
    );
  }
}
