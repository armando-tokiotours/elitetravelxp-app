/**
 * PNR-bound multi-channel ops chat (booking_messages).
 */

import type PocketBase from "pocketbase";

export type BookingMessageChannel =
  | "CUSTOMER"
  | "GUIDE"
  | "DRIVER"
  | "TICKETS";

export type BookingMessageSenderRole =
  | "CONCIERGE"
  | "CUSTOMER"
  | "GUIDE"
  | "DRIVER"
  | "TICKETS";

export type BookingMessageRow = {
  id: string;
  pnr: string;
  ops_hub_id?: string;
  channel: BookingMessageChannel | string;
  sender_id?: string;
  sender_name?: string;
  sender_role: BookingMessageSenderRole | string;
  message: string;
  is_read?: boolean;
  created?: string;
  updated?: string;
};

export const COMM_CHANNELS: Array<{
  id: BookingMessageChannel;
  short: string;
  label: string;
}> = [
  { id: "CUSTOMER", short: "CUST", label: "Customer" },
  { id: "GUIDE", short: "GUID", label: "Guide" },
  { id: "DRIVER", short: "DRIV", label: "Chauffeur" },
  { id: "TICKETS", short: "TIX", label: "Tickets" },
];

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
    return await pb.collection("booking_messages").getFullList<BookingMessageRow>({
      filter: `pnr="${ref}"`,
      sort: "created",
      requestKey: null,
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
  }
): Promise<BookingMessageRow | null> {
  const pnr = safePnr(input.pnr);
  const text = String(input.message || "").trim().slice(0, 4000);
  if (!pnr || !text) return null;
  try {
    const created = await pb.collection("booking_messages").create(
      {
        pnr,
        ops_hub_id: String(input.opsHubId || "").trim() || "",
        channel: input.channel,
        sender_id: String(input.senderId || "").trim() || "",
        sender_name: String(input.senderName || "").trim() || "",
        sender_role: input.senderRole || "CONCIERGE",
        message: text,
        // Concierge outbound is already "seen" by ops
        is_read: (input.senderRole || "CONCIERGE") === "CONCIERGE",
      },
      { requestKey: null }
    );
    return created as unknown as BookingMessageRow;
  } catch (err) {
    console.warn("[booking_messages]", err);
    return null;
  }
}

/** Unread = inbound (non-concierge) messages not yet marked read. */
export function countUnreadBookingMessages(
  messages: BookingMessageRow[]
): number {
  return messages.filter(
    (m) =>
      !Boolean(m.is_read) &&
      String(m.sender_role || "").toUpperCase() !== "CONCIERGE"
  ).length;
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
        filter: `pnr="${ref}" && channel="${channel}" && is_read=false && sender_role!="CONCIERGE"`,
        requestKey: null,
      });
    await Promise.all(
      unread.map((m) =>
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
