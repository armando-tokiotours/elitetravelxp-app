import { NextResponse } from "next/server";
import { findConciergeAgentByPnr } from "@/lib/conciergeAgent";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import {
  guideContactsUnlocked,
  maskStaffContact,
} from "@/lib/guidePrivacy";
import { normalizeBookingPNR } from "@/utils/pnr";

/**
 * GET /api/bookings/concierge-agent?pnr=JPN-XXXXXX
 * Public-safe: first name + photo before final confirm+pay;
 * email / WhatsApp only when contacts unlocked.
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

    let contactsUnlocked = false;
    try {
      const pb = await getAdminPocketBase();
      const hub = await pb.collection("ops_hub").getFirstListItem(
        `pnr="${pnr.replace(/"/g, "")}"`,
        { requestKey: null }
      );
      contactsUnlocked = guideContactsUnlocked({
        status: String(hub.status || ""),
        payment_confirmed: Boolean(hub.payment_confirmed),
        tour_payment_status: String(hub.tour_payment_status || ""),
        total_paid_eur:
          hub.total_paid_eur != null ? Number(hub.total_paid_eur) : null,
        estimated_total_eur:
          hub.estimated_total_eur != null
            ? Number(hub.estimated_total_eur)
            : null,
        deposit_amount:
          hub.deposit_amount != null ? Number(hub.deposit_amount) : null,
        concierge_fee_amount:
          hub.concierge_fee_amount != null
            ? Number(hub.concierge_fee_amount)
            : null,
        concierge_fee_paid: Boolean(hub.concierge_fee_paid),
      });
    } catch {
      contactsUnlocked = false;
    }

    const masked = maskStaffContact({
      fullName: agent.name,
      firstName: agent.firstName,
      lastName: agent.lastName,
      photoUrl: agent.photoUrl,
      email: agent.email,
      phone: agent.whatsappDigits,
      contactsUnlocked,
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
