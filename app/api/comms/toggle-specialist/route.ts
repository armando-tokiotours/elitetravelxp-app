import { NextResponse } from "next/server";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import { sendBookingMessage } from "@/lib/bookingMessages";
import {
  specialistField,
  type SpecialistRole,
} from "@/lib/specialistDirectChat";

/**
 * POST { pnr, specialistRole: TICKETER|DRIVER, enabled: boolean, staffName? }
 * Toggles ops_hub direct chat flags and logs to OPS channel.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pnr = String(body?.pnr || "")
      .trim()
      .toUpperCase()
      .replace(/"/g, "");
    const specialistRole = String(body?.specialistRole || "")
      .trim()
      .toUpperCase() as SpecialistRole;
    const enabled = Boolean(body?.enabled);
    const staffName = String(body?.staffName || "Concierge").trim();

    if (!pnr) {
      return NextResponse.json({ error: "pnr required" }, { status: 400 });
    }
    if (specialistRole !== "TICKETER" && specialistRole !== "DRIVER") {
      return NextResponse.json(
        { error: "specialistRole must be TICKETER or DRIVER" },
        { status: 400 }
      );
    }

    const pb = await getAdminPocketBase();
    const hub = await pb
      .collection("ops_hub")
      .getFirstListItem<{
        id: string;
        ticketer_direct_chat_enabled?: boolean;
        driver_direct_chat_enabled?: boolean;
      }>(`pnr="${pnr}"`, { requestKey: null });

    const field = specialistField(specialistRole);
    await pb.collection("ops_hub").update(
      hub.id,
      { [field]: enabled },
      { requestKey: null }
    );

    await sendBookingMessage(pb, {
      pnr,
      opsHubId: hub.id,
      channel: "OPS",
      senderId: "",
      senderName: "SYSTEM",
      senderRole: "OPS_COORDINATOR",
      message: `⚙️ ${staffName} ${
        enabled ? "ENABLED" : "DISABLED"
      } direct customer chat access for ${specialistRole}.`,
    });

    return NextResponse.json({
      ok: true,
      pnr,
      specialistRole,
      enabled,
      ticketer_direct_chat_enabled:
        specialistRole === "TICKETER"
          ? enabled
          : Boolean(hub.ticketer_direct_chat_enabled),
      driver_direct_chat_enabled:
        specialistRole === "DRIVER"
          ? enabled
          : Boolean(hub.driver_direct_chat_enabled),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Toggle failed" },
      { status: 500 }
    );
  }
}
