import { NextResponse } from "next/server";
import PocketBase from "pocketbase";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";

export const runtime = "nodejs";

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
    "http://pocketbase:8090"
  );
}

/**
 * GET /api/admin/bookings-and-leads
 * Server-side list via admin PocketBase (avoids browser sort=-created 400).
 * Requires Team Access Bearer token (superuser).
 */
export async function GET(request: Request) {
  try {
    const auth = request.headers.get("authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return NextResponse.json(
        { success: false, records: [], error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify caller is a valid superuser before returning leads.
    const verify = new PocketBase(internalPbUrl());
    verify.autoCancellation(false);
    verify.authStore.save(token, null);
    try {
      await verify.collection("_superusers").authRefresh();
    } catch {
      return NextResponse.json(
        { success: false, records: [], error: "Invalid or expired admin session." },
        { status: 401 }
      );
    }

    const pb = await getAdminPocketBase();
    let records;
    try {
      records = await pb.collection("bookings_and_leads").getFullList({
        sort: "-created",
        requestKey: null,
      });
    } catch {
      // Schema without autodate still lists fine without sort.
      records = await pb.collection("bookings_and_leads").getFullList({
        sort: "-id",
        requestKey: null,
      });
    }

    const sorted = [...records].sort((a, b) => {
      const ta = Date.parse(String((a as { created?: string }).created || "")) || 0;
      const tb = Date.parse(String((b as { created?: string }).created || "")) || 0;
      if (tb !== ta) return tb - ta;
      return String(b.id).localeCompare(String(a.id));
    });

    return NextResponse.json({
      success: true,
      records: sorted,
      isLocalCache: false,
    });
  } catch (err) {
    console.error("[admin/bookings-and-leads]", err);
    const message =
      err instanceof Error ? err.message : "Failed to load bookings from PocketBase";
    return NextResponse.json(
      { success: false, records: [], error: message, isLocalCache: false },
      { status: 500 }
    );
  }
}
