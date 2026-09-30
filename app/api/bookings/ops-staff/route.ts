import { NextResponse } from "next/server";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";

/** GET ?pnr= — assigned guide/driver display names for dossier ID cards. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pnr = String(searchParams.get("pnr") || "")
      .trim()
      .toUpperCase()
      .replace(/"/g, "");
    if (!pnr) {
      return NextResponse.json({ error: "pnr required" }, { status: 400 });
    }
    const pb = await getAdminPocketBase();
    try {
      const row = await pb.collection("ops_dispatch").getFirstListItem(
        `pnr="${pnr}"`,
        { requestKey: null }
      );
      return NextResponse.json({
        guide: String(row.assigned_guide || "").trim() || null,
        driver: String(row.assigned_driver || "").trim() || null,
        guideNeeded: Boolean(row.guide_needed),
        driverNeeded: Boolean(row.driver_needed),
        ticketsNeeded: Boolean(row.tickets_needed),
      });
    } catch {
      return NextResponse.json({
        guide: null,
        driver: null,
        guideNeeded: false,
        driverNeeded: false,
        ticketsNeeded: false,
      });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
