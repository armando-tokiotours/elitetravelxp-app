import { NextResponse } from "next/server";
import sharp from "sharp";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import {
  canEditStaffCredential,
  verifyCredentialActor,
} from "@/lib/staffCredentialAuth";
import {
  ensureStaffProfile,
  getStaffProfile,
  staffPhotoFilename,
} from "@/lib/staffProfiles";

export const runtime = "nodejs";

function photoName(profile: { photo?: unknown } | null): string {
  return staffPhotoFilename(profile?.photo);
}

/**
 * GET — stream credential JPEG (admin fetch, so <img> works).
 * POST — save/replace photo for this staffId (admin write).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ staffId: string }> }
) {
  try {
    const raw = context.params as
      | { staffId: string }
      | Promise<{ staffId: string }>;
    const { staffId } = await Promise.resolve(raw);
    const id = String(staffId || "")
      .trim()
      .replace(/"/g, "");
    if (!id) {
      return NextResponse.json({ error: "staffId required" }, { status: 400 });
    }
    const pb = await getAdminPocketBase();
    const profile = await getStaffProfile(pb, id);
    const file = photoName(profile);
    if (!profile?.id || !file) {
      return new NextResponse(null, { status: 404 });
    }
    const fileUrl = pb.files.getURL(profile, file);
    const token = pb.authStore.token;
    let upstream = await fetch(fileUrl, {
      headers: token ? { Authorization: token } : undefined,
      cache: "no-store",
    });
    if (!upstream.ok && token) {
      upstream = await fetch(fileUrl, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
    }
    if (!upstream.ok) {
      return new NextResponse(null, { status: 404 });
    }
    const buf = await upstream.arrayBuffer();
    const ctype = upstream.headers.get("content-type") || "image/jpeg";
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": ctype,
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ staffId: string }> }
) {
  try {
    const raw = context.params as
      | { staffId: string }
      | Promise<{ staffId: string }>;
    const { staffId } = await Promise.resolve(raw);
    const id = String(staffId || "")
      .trim()
      .replace(/"/g, "");
    if (!id) {
      return NextResponse.json({ error: "staffId required" }, { status: 400 });
    }
    const actor = await verifyCredentialActor(request);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canEditStaffCredential(actor, id)) {
      return NextResponse.json(
        { error: "You cannot change this credential photo." },
        { status: 403 }
      );
    }
    const form = await request.formData();
    const incoming = form.get("file") || form.get("photo");
    if (!(incoming instanceof File) || incoming.size === 0) {
      return NextResponse.json({ error: "Missing photo file" }, { status: 400 });
    }
    const src = Buffer.from(await incoming.arrayBuffer());
    const jpeg = await sharp(src)
      .rotate()
      .resize(360, 480, { fit: "cover" })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    const photo = new File([jpeg], `credential-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    const pb = await getAdminPocketBase();
    const row = await ensureStaffProfile(pb, id);
    const fd = new FormData();
    fd.append("photo", photo);
    const updated = await pb.collection("staff_profiles").update(row.id, fd, {
      requestKey: null,
    });
    return NextResponse.json({
      ok: true,
      staffId: id,
      photo: staffPhotoFilename(
        (updated as { photo?: unknown }).photo
      ),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Could not save credential photo.",
      },
      { status: 500 }
    );
  }
}
