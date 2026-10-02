/**
 * PNR-bound multi-channel ops chat (booking_messages).
 * Channels: CUSTOMER · OPS · GUIDE · DRIVER · TICKETS
 */

import type PocketBase from "pocketbase";
import type { StaffRole } from "@/lib/staffRoles";

export type BookingMessageChannel =
  | "CUSTOMER"
  | "OPS"
  | "GUIDE"
  | "DRIVER"
  | "TICKETS";

export type BookingMessageSenderRole =
  | "CONCIERGE"
  | "CUSTOMER"
  | "GUIDE"
  | "DRIVER"
  | "TICKETS"
  | "OPS"
  | "SUPER_USER"
  | "OPS_COORDINATOR";

export type BookingMessageRow = {
  id: string;
  pnr: string;
  ops_hub_id?: string;
  channel: BookingMessageChannel | string;
  sender_id?: string;
  sender_name?: string;
  sender_role: BookingMessageSenderRole | string;
  /** Assigned concierge for OPS-channel coordination threads */
  target_agent_id?: string;
  target_agent_email?: string;
  /** Guest intent topic (DRIVER / TOUR / TICKETS / PAYMENT) */
  topic?: string;
  message: string;
  /** PB file name for seating map / ticket image */
  attachment?: string;
  /** Resolved absolute URL (client/API convenience) */
  attachmentUrl?: string | null;
  /** Specialist post while direct chat was ON */
  is_direct_specialist?: boolean;
  is_read?: boolean;
  created?: string;
  updated?: string;
};

/** OPS tab pill: assigned agent first name (e.g. YENCY) or OPS when unassigned. */
export function assignedAgentTabShort(
  name?: string | null,
  email?: string | null
): string {
  const fromName = String(name || "")
    .trim()
    .split(/\s+/)[0];
  if (fromName) return fromName.toUpperCase().slice(0, 10);
  const fromEmail = String(email || "")
    .trim()
    .split("@")[0];
  if (fromEmail) return fromEmail.toUpperCase().slice(0, 10);
  return "OPS";
}

/** Message header badge for the OPS / agent internal thread. */
export function opsInternalSenderBadge(
  msg: Pick<BookingMessageRow, "sender_role" | "sender_name">,
  assignedAgentShort = "AGENT"
): string {
  const role = String(msg.sender_role || "")
    .trim()
    .toUpperCase();
  if (role === "SUPER_USER") return "SUPER-USER";
  if (role === "OPS_COORDINATOR" || role === "OPS") return "OPS COORDINATOR";
  const first = String(msg.sender_name || "")
    .trim()
    .split(/\s+/)[0];
  if (first) return first.toUpperCase().slice(0, 12);
  if (role === "CONCIERGE") return assignedAgentShort || "AGENT";
  return role || "—";
}

export type CommChannelAccess = "full" | "view" | "none";

export const COMM_CHANNELS: Array<{
  id: BookingMessageChannel;
  short: string;
  label: string;
}> = [
  { id: "CUSTOMER", short: "CUST", label: "Customer" },
  { id: "OPS", short: "OPS", label: "Ops internal" },
  { id: "GUIDE", short: "GUID", label: "Guide" },
  { id: "DRIVER", short: "DRIV", label: "Chauffeur" },
  { id: "TICKETS", short: "TIX", label: "Tickets" },
];

/**
 * RBAC matrix for Comms Hub tabs.
 * owner/ops = Super-User / Ops Manager · agent = Concierge ·
 * guide = Guide coord · driver = Driver coord · ticketer = Ticket Master
 *
 * When specialist direct flags are on, ticketer/driver gain CUST write.
 */
export function commChannelAccess(
  role: StaffRole | null | undefined,
  channel: BookingMessageChannel,
  opts?: {
    ticketerDirect?: boolean;
    driverDirect?: boolean;
  }
): CommChannelAccess {
  if (role === "owner" || role === "ops" || role === "agent") {
    return "full";
  }

  // Internal ops chat — all staff
  if (channel === "OPS") return "full";

  // Guest thread — concierge/ops, or specialist while direct is enabled
  if (channel === "CUSTOMER") {
    if (role === "ticketer" && opts?.ticketerDirect) return "full";
    if (role === "driver" && opts?.driverDirect) return "full";
    return "none";
  }

  if (channel === "TICKETS") {
    return role === "ticketer" ? "full" : "none";
  }

  if (channel === "GUIDE") {
    if (role === "guide") return "full";
    if (role === "driver") return "view";
    return "none";
  }

  if (channel === "DRIVER") {
    if (role === "driver") return "full";
    if (role === "guide") return "view";
    return "none";
  }

  return "none";
}

export function senderRoleForStaff(
  role: StaffRole | null | undefined
): BookingMessageSenderRole {
  if (role === "guide") return "GUIDE";
  if (role === "driver") return "DRIVER";
  if (role === "ticketer") return "TICKETS";
  if (role === "owner") return "SUPER_USER";
  if (role === "ops") return "OPS_COORDINATOR";
  return "CONCIERGE";
}

function safePnr(pnr: string): string {
  return String(pnr || "")
    .trim()
    .toUpperCase()
    .replace(/"/g, "");
}

export async function loadBookingMessagesForPnr(
  pb: PocketBase,
  pnr: string
): Promise<BookingMessageRow[]> {
  const ref = safePnr(pnr);
  if (!ref) return [];
  try {
    const rows = await pb
      .collection("booking_messages")
      .getFullList<BookingMessageRow>({
        filter: `pnr="${ref}"`,
        sort: "created",
        requestKey: null,
      });
    return rows.map((m) => {
      const file = String(m.attachment || "").trim();
      let attachmentUrl: string | null = null;
      if (file && m.id) {
        try {
          attachmentUrl = pb.files.getURL(m as never, file);
        } catch {
          attachmentUrl = null;
        }
      }
      return { ...m, attachmentUrl };
    });
  } catch {
    return [];
  }
}

export async function sendBookingMessage(
  pb: PocketBase,
  input: {
    pnr: string;
    opsHubId?: string | null;
    channel: BookingMessageChannel;
    senderId?: string | null;
    senderName?: string | null;
    senderRole?: BookingMessageSenderRole;
    message: string;
    targetAgentId?: string | null;
    targetAgentEmail?: string | null;
    topic?: string | null;
    attachment?: File | Blob | null;
    attachmentName?: string;
    isDirectSpecialist?: boolean;
  }
): Promise<BookingMessageRow | null> {
  const pnr = safePnr(input.pnr);
  const text = String(input.message || "").trim().slice(0, 4000);
  const hasFile = Boolean(input.attachment);
  if (!pnr || (!text && !hasFile)) return null;
  const senderRole = input.senderRole || "CONCIERGE";
  const staffOutbound =
    senderRole === "CONCIERGE" ||
    senderRole === "OPS" ||
    senderRole === "SUPER_USER" ||
    senderRole === "OPS_COORDINATOR" ||
    senderRole === "GUIDE" ||
    senderRole === "DRIVER" ||
    senderRole === "TICKETS";

  const messageBody = text || (hasFile ? "(image attachment)" : "");

  try {
    const form = new FormData();
    form.append("pnr", pnr);
    form.append("ops_hub_id", String(input.opsHubId || "").trim() || "");
    form.append("channel", input.channel);
    form.append("sender_id", String(input.senderId || "").trim() || "");
    form.append("sender_name", String(input.senderName || "").trim() || "");
    form.append("sender_role", senderRole);
    form.append("message", messageBody);
    form.append("is_read", staffOutbound ? "true" : "false");
    if (input.isDirectSpecialist) {
      form.append("is_direct_specialist", "true");
    }
    const topic = String(input.topic || "")
      .trim()
      .toUpperCase();
    if (
      topic === "DRIVER" ||
      topic === "TOUR" ||
      topic === "TICKETS" ||
      topic === "PAYMENT" ||
      topic === "GENERAL"
    ) {
      form.append("topic", topic);
    }
    const targetId = String(input.targetAgentId || "").trim();
    const targetEmail = String(input.targetAgentEmail || "").trim();
    if (targetId) form.append("target_agent_id", targetId);
    if (targetEmail) form.append("target_agent_email", targetEmail);
    if (input.attachment) {
      const name =
        input.attachmentName ||
        (input.attachment instanceof File
          ? input.attachment.name
          : "attachment.jpg");
      form.append("attachment", input.attachment, name);
    }

    try {
      const created = (await pb
        .collection("booking_messages")
        .create(form, { requestKey: null })) as unknown as BookingMessageRow;
      const file = String(created.attachment || "").trim();
      if (file && created.id) {
        try {
          created.attachmentUrl = pb.files.getURL(created as never, file);
        } catch {
          created.attachmentUrl = null;
        }
      }
      return created;
    } catch (primaryErr) {
      // Fallback JSON without file / new fields
      const legacyRole =
        senderRole === "SUPER_USER" || senderRole === "OPS_COORDINATOR"
          ? "OPS"
          : senderRole;
      try {
        return (await pb.collection("booking_messages").create(
          {
            pnr,
            ops_hub_id: String(input.opsHubId || "").trim() || "",
            channel: input.channel,
            sender_id: String(input.senderId || "").trim() || "",
            sender_name: String(input.senderName || "").trim() || "",
            sender_role: legacyRole,
            message: messageBody,
            is_read: staffOutbound,
          },
          { requestKey: null }
        )) as unknown as BookingMessageRow;
      } catch {
        throw primaryErr;
      }
    }
  } catch (err) {
    console.warn("[booking_messages]", err);
    return null;
  }
}

function isStaffSenderRole(role: string): boolean {
  const r = String(role || "").toUpperCase();
  return (
    r === "CONCIERGE" ||
    r === "OPS" ||
    r === "SUPER_USER" ||
    r === "OPS_COORDINATOR" ||
    r === "GUIDE" ||
    r === "DRIVER" ||
    r === "TICKETS"
  );
}

/** Unread = inbound (non-staff) messages not yet marked read, on allowed channels. */
export function countUnreadBookingMessages(
  messages: BookingMessageRow[],
  role?: StaffRole | null
): number {
  return messages.filter((m) => {
    if (Boolean(m.is_read)) return false;
    if (isStaffSenderRole(String(m.sender_role || ""))) return false;
    const ch = String(m.channel || "") as BookingMessageChannel;
    if (
      role &&
      !COMM_CHANNELS.some((c) => c.id === ch)
    ) {
      return false;
    }
    if (role) {
      const access = commChannelAccess(role, ch);
      if (access === "none") return false;
    }
    return true;
  }).length;
}

export async function markChannelMessagesRead(
  pb: PocketBase,
  pnr: string,
  channel: BookingMessageChannel
): Promise<void> {
  const ref = safePnr(pnr);
  if (!ref) return;
  try {
    const unread = await pb
      .collection("booking_messages")
      .getFullList<BookingMessageRow>({
        filter: `pnr="${ref}" && channel="${channel}" && is_read=false`,
        requestKey: null,
      });
    await Promise.all(
      unread
        .filter((m) => !isStaffSenderRole(String(m.sender_role || "")))
        .map((m) =>
          pb
            .collection("booking_messages")
            .update(m.id, { is_read: true }, { requestKey: null })
            .catch(() => null)
        )
    );
  } catch {
    /* non-blocking */
  }
}
