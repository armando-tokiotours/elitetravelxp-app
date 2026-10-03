import { NextResponse } from "next/server";
import { fetchBuilderConfigServer } from "@/lib/catalog/fetchBuilderConfigServer";

/**
 * Cached builder catalog (cities, tours, rates, seasons…).
 * Revalidates every hour so PocketBase is not hit on every guest open.
 * Guest dossiers / live pricing must NOT use this route — use no-store paths.
 */
export const revalidate = 3600;

export async function GET() {
  try {
    const config = await fetchBuilderConfigServer();
    return NextResponse.json(config, {
      headers: {
        "Cache-Control":
          "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load builder catalog";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
