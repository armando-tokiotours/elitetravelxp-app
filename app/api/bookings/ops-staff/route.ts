import { NextResponse } from "next/server";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import {
  guideGuestDisplay,
  guideConfirmClientLabel,
  driverGuestDisplay,
  normalizeGuideConfirmStatus,
} from "@/lib/guideConfirmStatus";
import { toCanonicalStatus, toPassStatusLabel } from "@/lib/bookingStatus";
import { coerceStatusWithPayment } from "@/lib/paymentGate";
import {
  firstNameOnly,
  GUIDE_CONTACT_UNLOCK_MSG,
  guideContactsUnlocked,
  maskStaffContact,
} from "@/lib/guidePrivacy";
import {
  acceptedGuideJobs,
  listGuideJobsForPnr,
  normalizeGuideJobStatus,
  normalizeTourDateIso,
  type DayGuideAssignment,
} from "@/lib/guideJobs";
import { combineStaffDisplayName } from "@/lib/staffProfiles";

async function loadStaffPublicProfile(
  pb: Awaited<ReturnType<typeof getAdminPocketBase>>,
  staffId: string | null,
  fallbackName: string | null
): Promise<{
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
}> {
  const id = String(staffId || "").trim();
  let name = String(fallbackName || "").trim() || null;
  let firstName: string | null = null;
  let lastName: string | null = null;
  let email: string | null = null;
  let phone: string | null = null;
  let photoUrl: string | null = null;
  if (!id) return { name, firstName, lastName, email, phone, photoUrl };

  try {
    const staff = await pb.collection("staff").getOne(id, { requestKey: null });
    if (staff.name) name = String(staff.name).trim() || name;
    email = String(staff.email || "").trim() || null;
  } catch {
    /* ignore */
  }
  try {
    const profile = await pb
      .collection("staff_profiles")
      .getFirstListItem(`staff_id="${id}"`, { requestKey: null });
    const fn = String(profile.first_name || "").trim();
    const ln = String(profile.last_name || "").trim();
    if (fn || ln) {
      firstName = fn || null;
      lastName = ln || null;
      name = combineStaffDisplayName(fn, ln) || name;
    } else if (profile.display_name) {
      name = String(profile.display_name).trim() || name;
    }
    phone = String(profile.phone || "").trim() || null;
    if (profile.photo && profile.id) {
      photoUrl = `/api/staff/avatar/${encodeURIComponent(id)}?v=${encodeURIComponent(String(profile.photo))}`;
    }
  } catch {
    /* ignore */
  }
  return { name, firstName, lastName, email, phone, photoUrl };
}

/**
 * GET ?pnr= — live Ops snapshot from collections (no client guessing).
 * Guest Day Services: first name + photo before final confirm+pay;
 * full contact only when guideContactsUnlocked.
 */
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

    let hubStatus: string | null = null;
    let paymentConfirmed = false;
    let assignedAgent: string | null = null;
    let assignedAgentId: string | null = null;
    let hubTicketsNeeded = false;
    let hubDriverNeeded = false;
    let hubGuideNeeded = true;
    let tourPaymentStatus: string | null = null;
    let totalPaidEur: number | null = null;
    let estimatedTotalEur: number | null = null;
    let conciergeFeePaid = false;
    let conciergeFeeAmount: number | null = null;
    let depositAmount: number | null = null;

    try {
      const hub = await pb.collection("ops_hub").getFirstListItem(
        `pnr="${pnr}"`,
        { requestKey: null }
      );
      hubStatus = String(hub.status || "").trim() || null;
      paymentConfirmed = Boolean(hub.payment_confirmed);
      assignedAgent = String(hub.assigned_agent || "").trim() || null;
      assignedAgentId = String(hub.assigned_agent_id || "").trim() || null;
      hubTicketsNeeded = Boolean(hub.tickets_needed);
      hubDriverNeeded = Boolean(hub.driver_needed);
      hubGuideNeeded = hub.guide_needed !== false;
      tourPaymentStatus = String(hub.tour_payment_status || "").trim() || null;
      totalPaidEur =
        hub.total_paid_eur != null ? Number(hub.total_paid_eur) : null;
      estimatedTotalEur =
        hub.estimated_total_eur != null
          ? Number(hub.estimated_total_eur)
          : null;
      conciergeFeePaid = Boolean(hub.concierge_fee_paid);
      conciergeFeeAmount =
        hub.concierge_fee_amount != null
          ? Number(hub.concierge_fee_amount)
          : null;
      depositAmount =
        hub.deposit_amount != null ? Number(hub.deposit_amount) : null;
    } catch {
      /* hub missing */
    }

    if (!hubStatus) {
      try {
        const bal = await pb
          .collection("bookings_and_leads")
          .getFirstListItem(`booking_ref="${pnr}"`, { requestKey: null });
        hubStatus = String(bal.status || "").trim() || null;
      } catch {
        /* ignore */
      }
    }

    const contactsUnlocked = guideContactsUnlocked({
      status: hubStatus,
      payment_confirmed: paymentConfirmed,
      tour_payment_status: tourPaymentStatus,
      total_paid_eur: totalPaidEur,
      estimated_total_eur: estimatedTotalEur,
      deposit_amount: depositAmount,
      concierge_fee_amount: conciergeFeeAmount,
      concierge_fee_paid: conciergeFeePaid,
    });

    const canonicalRaw = hubStatus ? toCanonicalStatus(hubStatus) : null;
    const canonical = canonicalRaw
      ? coerceStatusWithPayment(canonicalRaw, paymentConfirmed)
      : null;
    const passStatus = canonical ? toPassStatusLabel(canonical) : null;

    let guideNameRaw: string | null = null;
    let guideStaffId: string | null = null;
    let guideStatus = normalizeGuideConfirmStatus("unassigned");
    let driverNameRaw: string | null = null;
    let driverStaffId: string | null = null;
    let driverMode = "unassigned";
    let guideNeeded = hubGuideNeeded;
    let driverNeeded = hubDriverNeeded;
    let ticketsNeeded = hubTicketsNeeded;

    try {
      const row = await pb.collection("ops_dispatch").getFirstListItem(
        `pnr="${pnr}"`,
        { requestKey: null }
      );
      guideNameRaw = String(row.assigned_guide || "").trim() || null;
      guideStaffId = String(row.assigned_guide_id || "").trim() || null;
      guideStatus = normalizeGuideConfirmStatus(String(row.guide_mode || ""), {
        boardVisible: Boolean(row.guide_board_visible),
        assignedGuideId: String(row.assigned_guide_id || ""),
        guideResponse: String(row.guide_response || ""),
      });
      driverNameRaw = String(row.assigned_driver || "").trim() || null;
      driverStaffId = String(row.assigned_driver_id || "").trim() || null;
      driverMode = String(row.driver_mode || "unassigned").trim() || "unassigned";
      if (row.guide_needed != null) guideNeeded = Boolean(row.guide_needed);
      if (row.driver_needed != null) driverNeeded = Boolean(row.driver_needed);
      if (row.tickets_needed != null) ticketsNeeded = Boolean(row.tickets_needed);
    } catch {
      /* dispatch missing */
    }

    let ticketStatus = "none";
    try {
      const tix = await pb.collection("ops_tickets").getFirstListItem(
        `pnr="${pnr}"`,
        { requestKey: null }
      );
      ticketStatus = String(tix.ticket_status || "none").trim() || "none";
      if (ticketStatus !== "none") ticketsNeeded = true;
    } catch {
      /* tickets missing */
    }

    // Per-day accepted jobs (preferred over single ops_dispatch master guide)
    let dayGuides: DayGuideAssignment[] = [];
    try {
      const jobs = acceptedGuideJobs(await listGuideJobsForPnr(pb, pnr));
      const profileCache = new Map<
        string,
        Awaited<ReturnType<typeof loadStaffPublicProfile>>
      >();
      for (const job of jobs) {
        const staffId =
          String(job.assigned_guide_staff_id || "").trim() || null;
        const fallback =
          String(job.assigned_guide_name || "").trim() || null;
        if (!staffId && !fallback) continue;
        let profile = staffId ? profileCache.get(staffId) : undefined;
        if (!profile) {
          profile = await loadStaffPublicProfile(pb, staffId, fallback);
          if (staffId) profileCache.set(staffId, profile);
        }
        const masked = maskStaffContact({
          fullName: profile.name || fallback,
          firstName: profile.firstName,
          lastName: profile.lastName,
          photoUrl: profile.photoUrl,
          email: profile.email,
          phone: profile.phone,
          contactsUnlocked,
        });
        const display =
          masked.displayName || firstNameOnly(fallback) || null;
        if (!display && !masked.photoUrl) continue;
        dayGuides.push({
          jobId: job.id,
          tourDate: normalizeTourDateIso(job.tour_date),
          dayIndex: Math.max(0, Number(job.day_index) || 0),
          tourName: String(job.tour_name || "Tour day").trim(),
          city: String(job.city || "").trim(),
          status: normalizeGuideJobStatus(job.status),
          name: display,
          photoUrl: masked.photoUrl,
          email: masked.email,
          phone: masked.phone,
          whatsappDigits: masked.whatsappDigits,
          unlockMessage: masked.unlockMessage || GUIDE_CONTACT_UNLOCK_MSG,
          staffId,
        });
      }
      // Prefer first accepted day as trip rollup when dispatch master is empty
      if (dayGuides.length > 0 && !guideStaffId) {
        guideStaffId = dayGuides[0].staffId;
        guideNameRaw = dayGuides[0].name;
        guideStatus = normalizeGuideConfirmStatus("claimed", {
          boardVisible: false,
          assignedGuideId: guideStaffId || "",
          guideResponse: "accepted",
        });
      } else if (dayGuides.length > 0) {
        // At least one day accepted → guest sees confirmed guide on rollup
        guideStatus = normalizeGuideConfirmStatus("claimed", {
          boardVisible: false,
          assignedGuideId: guideStaffId || dayGuides[0].staffId || "",
          guideResponse: "accepted",
        });
      }
    } catch {
      dayGuides = [];
    }

    const guideProfile = await loadStaffPublicProfile(
      pb,
      guideStaffId,
      guideNameRaw
    );
    const driverProfile = await loadStaffPublicProfile(
      pb,
      driverStaffId,
      driverNameRaw
    );
    const agentProfile = await loadStaffPublicProfile(
      pb,
      assignedAgentId,
      assignedAgent
    );

    const guestGuide = guideGuestDisplay({
      status: guideStatus,
      guideName: guideProfile.name || guideNameRaw || dayGuides[0]?.name,
      firstName: guideProfile.firstName,
      contactsUnlocked,
      paymentConfirmed,
    });
    const guestDriver = driverGuestDisplay({
      driverName: driverProfile.name || driverNameRaw,
      firstName: driverProfile.firstName,
      driverNeeded,
      contactsUnlocked,
      paymentConfirmed,
    });

    const guideMasked = maskStaffContact({
      fullName: guideProfile.name || guideNameRaw || dayGuides[0]?.name,
      firstName: guideProfile.firstName,
      lastName: guideProfile.lastName,
      photoUrl: guideProfile.photoUrl || dayGuides[0]?.photoUrl,
      email: guideProfile.email,
      phone: guideProfile.phone,
      contactsUnlocked,
    });
    const driverMasked = maskStaffContact({
      fullName: driverProfile.name || driverNameRaw,
      firstName: driverProfile.firstName,
      lastName: driverProfile.lastName,
      photoUrl: driverProfile.photoUrl,
      email: driverProfile.email,
      phone: driverProfile.phone,
      contactsUnlocked,
    });
    const agentMasked = maskStaffContact({
      fullName: agentProfile.name || assignedAgent,
      firstName: agentProfile.firstName,
      lastName: agentProfile.lastName,
      photoUrl: agentProfile.photoUrl,
      email: agentProfile.email,
      phone: agentProfile.phone,
      contactsUnlocked,
    });

    // Tickets: purchase / confirmed stub only after payment
    const ticketsPurchaseAllowed = paymentConfirmed && ticketsNeeded;
    const ticketGuestLabel =
      !ticketsNeeded || ticketStatus === "none"
        ? null
        : !paymentConfirmed
          ? "Waiting for payment confirmation"
          : ticketStatus === "done"
            ? "Tickets purchased"
            : "Tickets pending purchase";

    return NextResponse.json({
      pnr,
      status: canonical,
      passStatus,
      paymentConfirmed,
      contactsUnlocked,
      assignedAgent: agentMasked.displayName,
      assignedAgentContact: {
        name: agentMasked.displayName,
        photoUrl: agentMasked.photoUrl,
        email: agentMasked.email,
        phone: agentMasked.phone,
        whatsappDigits: agentMasked.whatsappDigits,
        unlockMessage: agentMasked.unlockMessage,
        contactsUnlocked: agentMasked.contactsUnlocked,
      },
      /** Guest Day Services — first name + photo after guide accepts; contact gated by mask */
      guide: guestGuide.name || dayGuides[0]?.name || null,
      guideName: guideNameRaw || dayGuides[0]?.name || null,
      guideStatus,
      guideLabel: guestGuide.label,
      guideConfirmed: guestGuide.showConfirmed || dayGuides.length > 0,
      guideUnlockMessage:
        guestGuide.unlockMessage || dayGuides[0]?.unlockMessage || null,
      // Photo always allowed when guide is guest-visible (maskStaffContact keeps it when locked)
      guidePhotoUrl: guestGuide.name
        ? guideMasked.photoUrl
        : dayGuides[0]?.photoUrl || null,
      guideEmail: guestGuide.name ? guideMasked.email : null,
      guidePhone: guestGuide.name ? guideMasked.phone : null,
      guideWhatsapp: guestGuide.name ? guideMasked.whatsappDigits : null,
      /** Per-day accepted guides (privacy-masked) for itinerary Day Services */
      dayGuides,
      driver: guestDriver.name,
      driverName: driverNameRaw,
      driverLabel: guestDriver.label,
      driverUnlockMessage: guestDriver.unlockMessage,
      driverPhotoUrl: guestDriver.name ? driverMasked.photoUrl : null,
      driverEmail: guestDriver.name ? driverMasked.email : null,
      driverPhone: guestDriver.name ? driverMasked.phone : null,
      driverMode,
      guideNeeded,
      driverNeeded,
      ticketsNeeded,
      ticketStatus,
      ticketsPurchaseAllowed,
      ticketGuestLabel,
      guideLabelStaff: guideConfirmClientLabel(
        guideStatus,
        guideProfile.name || guideNameRaw
      ),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
