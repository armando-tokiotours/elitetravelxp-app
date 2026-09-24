import { NextResponse } from "next/server";
import { advanceBookingToInProgress } from "@/lib/bookingLifecycle";

/**
 * POST /api/bookings/advance
 * Guest-safe: draft → in_progress only (never confirmed).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const bookingRef = String(body?.bookingRef || body?.reference || "").trim();
    const result = await advanceBookingToInProgress(bookingRef);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Update failed." },
        { status: result.error?.includes("Missing") ? 400 : 404 }
      );
    }
    return NextResponse.json({
      ok: true,
      id: result.id,
      status: result.status,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not advance booking status.";
    console.error("[bookings/advance]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
