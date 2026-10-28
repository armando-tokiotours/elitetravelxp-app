import { NextResponse } from "next/server";
import { verifyCredentialActor } from "@/lib/staffCredentialAuth";
import { canAccessOpsBoard } from "@/lib/staffRoles";
import {
  deleteVpsMediaFile,
  listVpsMediaFiles,
} from "@/lib/vpsMediaStorage";

async function requireMediaOpsActor(request: Request) {
  const actor = await verifyCredentialActor(request);
  if (!actor) return null;
  if (actor.isSuperuser || canAccessOpsBoard(actor.role)) return actor;
  return null;
}

/**
 * GET /api/media-manager — list files under public/uploads/*
 * Auth: ops / owner / superuser
 */
export async function GET(request: Request) {
  try {
    const actor = await requireMediaOpsActor(request);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const files = await listVpsMediaFiles();
    return NextResponse.json({ files });
  } catch (err) {
    console.error("[media-manager GET]", err);
    return NextResponse.json(
      { error: "Failed to scan media directory" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/media-manager
 * Body: { fileUrl: string } | { fileUrls: string[] }
 */
export async function DELETE(request: Request) {
  try {
    const actor = await requireMediaOpsActor(request);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      fileUrl?: string;
      fileUrls?: string[];
    };

    const urls = Array.isArray(body.fileUrls)
      ? body.fileUrls
      : body.fileUrl
        ? [body.fileUrl]
        : [];

    if (!urls.length) {
      return NextResponse.json({ error: "No fileUrl provided" }, { status: 400 });
    }

    const deleted: string[] = [];
    const errors: string[] = [];
    for (const url of urls) {
      try {
        deleted.push(await deleteVpsMediaFile(String(url)));
      } catch (e) {
        errors.push(
          `${url}: ${e instanceof Error ? e.message : "delete failed"}`
        );
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      deleted,
      errors,
    });
  } catch (err) {
    console.error("[media-manager DELETE]", err);
    return NextResponse.json(
      { error: "File deletion failed" },
      { status: 500 }
    );
  }
}
