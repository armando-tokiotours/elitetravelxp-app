import { NextResponse } from "next/server";
import { findConciergeAgentByPnr } from "@/lib/conciergeAgent";
import { maskStaffContact } from "@/lib/guidePrivacy";
import { normalizeBookingPNR } from "@/utils/pnr";

/**
 * GET /api/bookings/concierge-agent?pnr=JPN-XXXXXX
 * Concierge / assigned agent is exempt from the guide/driver contact lock:
 * full name, photo, email and WhatsApp are visible immediately, regardless
 * of payment status. Guide/driver masking (guidePrivacy) is untouched.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pnr = normalizeBookingPNR(String(searchParams.get("pnr") || ""));
    if (!pnr) {
      return NextResponse.json({ agent: null }, { status: 200 });
    }
    const agent = await findConciergeAgentByPnr(pnr);
    if (!agent) {
      return NextResponse.json({ agent: null }, { status: 200 });
    }

    // Agent/concierge only — always unlocked (see header). Guides/drivers
    // still go through guideContactsUnlocked in ops-staff / guide flows.
    const masked = maskStaffContact({
      fullName: agent.name,
      firstName: agent.firstName,
      lastName: agent.lastName,
      photoUrl: agent.photoUrl,
      email: agent.email,
      phone: agent.whatsappDigits,
      contactsUnlocked: true,
    });

    return NextResponse.json({
      agent: {
        name: masked.displayName,
        id: agent.id || undefined,
        email: masked.email || undefined,
        whatsappDigits: masked.whatsappDigits || undefined,
        photoUrl: masked.photoUrl || undefined,
        unlockMessage: masked.unlockMessage || undefined,
        contactsUnlocked: masked.contactsUnlocked,
      },
    });
  } catch (err) {
    console.warn("[concierge-agent]", err);
    return NextResponse.json({ agent: null }, { status: 200 });
  }
}
