import { NextResponse } from "next/server";
import PocketBase from "pocketbase";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import { sendTransactionalMail } from "@/lib/mail";
import { appendBookingLog } from "@/lib/bookingLogs";
import {
  REMINDER_IDS,
  computeReminders,
  mergeCommsSentFlag,
  reminderById,
  type ReminderId,
} from "@/lib/reminderRules";

export const runtime = "nodejs";

function envVal(key: string): string | undefined {
  const raw = process.env[key]?.trim();
  if (!raw) return undefined;
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1).trim() || undefined;
  }
  return raw;
}

function internalPbUrl(): string {
  return (
    envVal("POCKETBASE_INTERNAL_URL") ||
    envVal("POCKETBASE_URL") ||
    envVal("NEXT_PUBLIC_POCKETBASE_URL") ||
    "http://pocketbase:8090"
  );
}

async function verifyStaffBearer(
  request: Request
): Promise<{ ok: true; email: string; name: string } | { ok: false }> {
  const auth = request.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false };

  const verify = new PocketBase(internalPbUrl());
  verify.autoCancellation(false);
  verify.authStore.save(token, null);

  try {
    const authData = await verify.collection("staff").authRefresh();
    const email = String(authData.record?.email || "").trim();
    const name = String(authData.record?.name || "").trim() || email;
    if (!email) return { ok: false };
    return { ok: true, email, name };
  } catch {
    /* try superuser */
  }
  try {
    const authData = await verify.collection("_superusers").authRefresh();
    const email = String(authData.record?.email || "").trim();
    const name = String(authData.record?.name || "").trim() || email;
    if (!email) return { ok: false };
    return { ok: true, email, name };
  } catch {
    return { ok: false };
  }
}

/**
 * POST /api/comms/send
 * Staff-auth: Approve & Send a situational reminder email.
 * Marks ops_hub.extras.comms_sent[id] only after successful send.
 */
export async function POST(request: Request) {
  try {
    const staff = await verifyStaffBearer(request);
    if (!staff.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      pnr?: string;
      reminderId?: string;
      staffName?: string;
      staffId?: string;
    };

    const pnr = String(body.pnr || "")
      .trim()
      .toUpperCase()
      .replace(/"/g, "");
    const reminderId = String(body.reminderId || "").trim() as ReminderId;
    if (!pnr) {
      return NextResponse.json({ error: "pnr required" }, { status: 400 });
    }
    if (!(REMINDER_IDS as readonly string[]).includes(reminderId)) {
      return NextResponse.json(
        { error: "Invalid reminderId" },
        { status: 400 }
      );
    }

    const pb = await getAdminPocketBase();
    const hub = await pb.collection("ops_hub").getFirstListItem(`pnr="${pnr}"`, {
      requestKey: null,
    });

    let guestEmail = "";
    let guestName = "";
    try {
      const lead = await pb
        .collection("bookings_and_leads")
        .getFirstListItem(`booking_ref="${pnr}"`, { requestKey: null });
      guestEmail = String(lead.email || "")
        .trim()
        .toLowerCase();
      guestName = String(lead.full_name || lead.name || "").trim();
    } catch {
      /* may be agency */
    }

    if (!guestEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
      return NextResponse.json(
        { error: "Guest email not found on bookings_and_leads for this PNR." },
        { status: 400 }
      );
    }

    const reminders = computeReminders({
      tourDate: hub.tour_date,
      endDate: hub.end_date,
      status: hub.status,
      tour_payment_status: hub.tour_payment_status,
      payment_confirmed: hub.payment_confirmed,
      concierge_fee_paid: hub.concierge_fee_paid,
      deposit_amount: hub.deposit_amount,
      concierge_fee_amount: hub.concierge_fee_amount,
      total_paid_eur: hub.total_paid_eur,
      estimated_total_eur: hub.estimated_total_eur,
      guestName,
      guestEmail,
      pnr,
      extras: hub.extras,
    });
    const item = reminderById(reminders, reminderId);
    if (!item) {
      return NextResponse.json(
        { error: "Reminder not applicable for this booking." },
        { status: 400 }
      );
    }
    if (item.lane === "sent") {
      return NextResponse.json({
        ok: true,
        alreadySent: true,
        sentAt: item.sentAt,
        reminderId,
      });
    }

    const mail = await sendTransactionalMail({
      to: guestEmail,
      subject: item.subject,
      text: item.previewText,
      html: item.previewHtml,
    });

    if (!mail.sent) {
      // Do not mark sent — Ops can retry when mail is configured.
      return NextResponse.json(
        {
          error: mail.reason || "Email is not configured.",
          queued: false,
        },
        { status: 503 }
      );
    }

    const sentAt = new Date().toISOString();
    const nextExtras = mergeCommsSentFlag(hub.extras, reminderId, sentAt);
    await pb.collection("ops_hub").update(
      hub.id,
      { extras: nextExtras },
      { requestKey: null }
    );

    const staffName =
      String(body.staffName || "").trim() || staff.name || staff.email;
    await appendBookingLog(pb, {
      pnr,
      opsHubId: hub.id,
      staffId: String(body.staffId || "").trim() || null,
      staffName,
      actionType: "note_added",
      details: `COMMS sent: ${reminderId} → ${guestEmail}`,
    });

    return NextResponse.json({
      ok: true,
      reminderId,
      sentAt,
      mailId: mail.id || null,
      to: guestEmail,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed" },
      { status: 500 }
    );
  }
}
