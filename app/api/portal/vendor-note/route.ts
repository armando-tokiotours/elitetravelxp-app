import { NextResponse } from "next/server";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import { appendBookingLog } from "@/lib/bookingLogs";

/** Vendor posts a note to Ops via dispatch token. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string; note?: string };
    const token = String(body.token || "").trim();
    const note = String(body.note || "").trim();
    if (!token || !note) {
      return NextResponse.json(
        { error: "token and note required" },
        { status: 400 }
      );
    }
    const pb = await getAdminPocketBase();
    let row: {
      pnr: string;
      ops_hub_id?: string;
      vendor_role?: string;
      revoked?: boolean;
    };
    try {
      row = await pb.collection("vendor_dispatch_tokens").getFirstListItem(
        `token="${token.replace(/"/g, "")}"`,
        { requestKey: null }
      );
    } catch {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }
    if (row.revoked) {
      return NextResponse.json({ error: "Link revoked" }, { status: 410 });
    }
    const role = String(row.vendor_role || "vendor");
    await appendBookingLog(pb, {
      pnr: row.pnr,
      opsHubId: row.ops_hub_id,
      staffName: `${role} portal`,
      actionType: "note_added",
      details: `[${role}] ${note}`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "note failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
