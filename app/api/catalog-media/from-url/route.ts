import { NextResponse } from "next/server";
import { verifyCredentialActor } from "@/lib/staffCredentialAuth";
import { canAccessOpsBoard, canAccessTeamAccess } from "@/lib/staffRoles";
import { writeVpsMediaFile } from "@/lib/vpsMediaStorage";
import { catalogMediaSlot } from "@/lib/catalogMedia";

/**
 * POST /api/catalog-media/from-url  { recordId, imageUrl }
 * CSV pass-through: fetch an image URL carried by a CSV row and store it as
 * that record's `{recordId}_1` catalog slot (web + mobile WebP, in place).
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
    const body = (await request.json()) as { recordId?: string; imageUrl?: string };
    const recordId = String(body.recordId || "").trim();
    const imageUrl = String(body.imageUrl || "").trim();
    if (!recordId || !/^https?:\/\//i.test(imageUrl)) {
      return NextResponse.json({ error: "recordId and http(s) imageUrl required" }, { status: 400 });
    }
    const url = new URL(imageUrl);
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) {
      return NextResponse.json({ error: `Image fetch failed (${res.status})` }, { status: 502 });
    }
    const extByType: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/avif": ".avif",
    };
    const ext =
      extByType[(res.headers.get("content-type") || "").split(";")[0].trim()] ||
      (/\.(jpe?g|png|webp|avif)(\?|$)/i.test(url.pathname)
        ? `.${url.pathname.split(".").pop()?.toLowerCase()}`
        : ".jpg");
    const buffer = Buffer.from(await res.arrayBuffer());
    const saved = await writeVpsMediaFile({
      folder: "catalog",
      fileName: `csv-image${ext}`,
      buffer,
      stableKey: catalogMediaSlot(recordId, 1),
    });
    return NextResponse.json({ success: true, url: saved.url, mobileUrl: saved.mobileUrl || "" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to store catalog image" },
      { status: 500 }
    );
  }
}
