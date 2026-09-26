import { NextResponse } from "next/server";
import { findConciergeAgentByPnr } from "@/lib/conciergeAgent";
import { normalizeBookingPNR } from "@/utils/pnr";

/**
 * GET /api/bookings/concierge-agent?pnr=JPN-XXXXXX
 * Public-safe: returns only the assigned concierge display name for direct bookings.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pnr = normalizeBookingPNR(String(searchParams.get("pnr") || ""));
    if (!pnr) {
      return NextResponse.json({ agent: null }, { status: 200 });
    }
    const agent = await findConciergeAgentByPnr(pnr);
    return NextResponse.json({
      agent: agent
        ? { name: agent.name, id: agent.id || undefined }
        : null,
    });
  } catch (err) {
    console.warn("[concierge-agent]", err);
    return NextResponse.json({ agent: null }, { status: 200 });
  }
}
