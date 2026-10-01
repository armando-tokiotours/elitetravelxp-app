import { NextResponse } from "next/server";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import { appendBookingLog } from "@/lib/bookingLogs";

/**
 * Vendor confirms assignment via dispatch token (no staff login).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string; status?: string };
    const token = String(body.token || "").trim();
    if (!token) {
      return NextResponse.json({ error: "token required" }, { status: 400 });
    }
    const pb = await getAdminPocketBase();
    let row: {
      id: string;
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

    const pnr = String(row.pnr || "")
      .trim()
      .toUpperCase();
    const role = String(row.vendor_role || "").toLowerCase();

    if (role === "guide") {
      try {
        const d = await pb
          .collection("ops_dispatch")
          .getFirstListItem(`pnr="${pnr}"`, { requestKey: null });
        await pb.collection("ops_dispatch").update(
          d.id,
          { guide_response: "accepted", guide_mode: "claimed" },
          { requestKey: null }
        );
      } catch {
        /* optional */
      }
    } else if (role === "ticketer") {
      try {
        const t = await pb
          .collection("ops_tickets")
          .getFirstListItem(`pnr="${pnr}"`, { requestKey: null });
        await pb.collection("ops_tickets").update(
          t.id,
          { ticket_status: "ordered" },
          { requestKey: null }
        );
      } catch {
        /* optional */
      }
    }

    await appendBookingLog(pb, {
      pnr,
      opsHubId: row.ops_hub_id,
      staffName: `${role} portal`,
      actionType: "status_changed",
      details: `${role} confirmed assignment (${body.status || "CONFIRMED"}) via dispatch link`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "confirm failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
