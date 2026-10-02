/**
 * Comm hub — PNR-keyed guest / agent messaging.
 * Dual-writes guest↔ops traffic into booking_messages for Ops Comms Hub.
 */

import { getAdminPocketBase } from "@/lib/pocketbase/admin";

export type CommMessage = {
  id: string;
  thread_id: string;
  pnr: string;
  author_role: "guest" | "agent" | "ops" | string;
  author_name?: string;
  body: string;
  created?: string;
  attachmentUrl?: string;
  senderRole?: string;
};

export type CommThread = {
  id: string;
  pnr: string;
  agent_id?: string;
  agent_name?: string;
  guest_email?: string;
  status?: string;
};

function safePnr(pnr: string): string {
  return String(pnr || "")
    .trim()
    .toUpperCase()
    .replace(/"/g, "");
}

async function mirrorToBookingMessages(opts: {
  pnr: string;
  authorRole: "guest" | "agent" | "ops";
  authorName?: string;
  authorId?: string | null;
  body: string;
  topic?: string | null;
  attachment?: File | Blob | null;
  attachmentName?: string;
}): Promise<{ id: string; attachmentUrl?: string } | null> {
  const pnr = safePnr(opts.pnr);
  const text = String(opts.body || "").trim().slice(0, 4000);
  const hasFile = Boolean(opts.attachment);
  if (!pnr || (!text && !hasFile)) return null;
  try {
    const pb = await getAdminPocketBase();
    let opsHubId = "";
    try {
      const hub = await pb
        .collection("ops_hub")
        .getFirstListItem<{ id: string }>(`pnr="${pnr}"`, {
          requestKey: null,
        });
      opsHubId = hub.id;
    } catch {
      /* optional */
    }
    const isGuest = opts.authorRole === "guest";
    const messageBody = text || (hasFile ? "(image attachment)" : "");
    const topic = String(opts.topic || "")
      .trim()
      .toUpperCase();

    const form = new FormData();
    form.append("pnr", pnr);
    form.append("ops_hub_id", opsHubId);
    form.append("channel", "CUSTOMER");
    form.append("sender_id", String(opts.authorId || "").trim() || "");
    form.append(
      "sender_name",
      String(opts.authorName || "").trim() ||
        (isGuest ? "Client" : "Concierge")
    );
    form.append("sender_role", isGuest ? "CUSTOMER" : "CONCIERGE");
    form.append("message", messageBody);
    form.append("is_read", isGuest ? "false" : "true");
    if (
      topic === "DRIVER" ||
      topic === "TOUR" ||
      topic === "TICKETS" ||
      topic === "PAYMENT" ||
      topic === "GENERAL"
    ) {
      form.append("topic", topic);
    }
    if (opts.attachment) {
      const name =
        opts.attachmentName ||
        (opts.attachment instanceof File
          ? opts.attachment.name
          : "attachment.jpg");
      form.append("attachment", opts.attachment, name);
    }

    try {
      const created = (await pb
        .collection("booking_messages")
        .create(form, { requestKey: null })) as {
        id: string;
        attachment?: string;
      };
      let attachmentUrl: string | undefined;
      const file = String(created.attachment || "").trim();
      if (file) {
        try {
          attachmentUrl = pb.files.getURL(created as never, file);
        } catch {
          attachmentUrl = undefined;
        }
      }
      return { id: created.id, attachmentUrl };
    } catch {
      // Schema may lag before attachment migration — JSON fallback
      const payload: Record<string, unknown> = {
        pnr,
        ops_hub_id: opsHubId,
        channel: "CUSTOMER",
        sender_id: String(opts.authorId || "").trim() || "",
        sender_name:
          String(opts.authorName || "").trim() ||
          (isGuest ? "Client" : "Concierge"),
        sender_role: isGuest ? "CUSTOMER" : "CONCIERGE",
        message: messageBody,
        is_read: !isGuest,
      };
      if (
        topic === "DRIVER" ||
        topic === "TOUR" ||
        topic === "TICKETS" ||
        topic === "PAYMENT" ||
        topic === "GENERAL"
      ) {
        payload.topic = topic;
      }
      try {
        const created = (await pb
          .collection("booking_messages")
          .create(payload, { requestKey: null })) as { id: string };
        return { id: created.id };
      } catch {
        delete payload.topic;
        const created = (await pb
          .collection("booking_messages")
          .create(payload, { requestKey: null })) as { id: string };
        return { id: created.id };
      }
    }
  } catch (err) {
    console.warn("[comm→booking_messages]", err);
    return null;
  }
}

export async function ensureCommThread(opts: {
  pnr: string;
  agentId?: string | null;
  agentName?: string | null;
  guestEmail?: string | null;
}): Promise<CommThread | null> {
  const pnr = safePnr(opts.pnr);
  if (!pnr || pnr.startsWith("TMP-")) return null;
  const pb = await getAdminPocketBase();
  try {
    const existing = await pb
      .collection("comm_threads")
      .getFirstListItem<CommThread>(`pnr="${pnr}"`, { requestKey: null });
    const patch: Record<string, unknown> = {};
    if (opts.agentId && opts.agentId !== existing.agent_id) {
      patch.agent_id = opts.agentId;
      patch.agent_name = opts.agentName || existing.agent_name || "";
    }
    if (opts.guestEmail && !existing.guest_email) {
      patch.guest_email = opts.guestEmail;
    }
    if (Object.keys(patch).length) {
      return (await pb
        .collection("comm_threads")
        .update(existing.id, patch, { requestKey: null })) as CommThread;
    }
    return existing;
  } catch {
    return (await pb.collection("comm_threads").create(
      {
        pnr,
        agent_id: opts.agentId || "",
        agent_name: opts.agentName || "",
        guest_email: opts.guestEmail || "",
        status: "open",
      },
      { requestKey: null }
    )) as CommThread;
  }
}

export async function listCommMessages(pnrRaw: string): Promise<CommMessage[]> {
  const pnr = safePnr(pnrRaw);
  if (!pnr) return [];
  const pb = await getAdminPocketBase();

  const classic: CommMessage[] = [];
  try {
    const rows = await pb.collection("comm_messages").getFullList<CommMessage>({
      filter: `pnr="${pnr}"`,
      sort: "created",
      requestKey: null,
    });
    classic.push(...rows);
  } catch {
    /* collection may be missing */
  }

  const fromBooking: CommMessage[] = [];
  try {
    const rows = await pb.collection("booking_messages").getFullList<{
      id: string;
      pnr: string;
      sender_role?: string;
      sender_name?: string;
      message?: string;
      attachment?: string;
      created?: string;
    }>({
      filter: `pnr="${pnr}" && channel="CUSTOMER"`,
      sort: "created",
      requestKey: null,
    });
    for (const r of rows) {
      const file = String(r.attachment || "").trim();
      let attachmentUrl: string | undefined;
      if (file) {
        try {
          attachmentUrl = pb.files.getURL(r as never, file);
        } catch {
          attachmentUrl = undefined;
        }
      }
      fromBooking.push({
        id: r.id,
        thread_id: "",
        pnr: r.pnr,
        author_role:
          String(r.sender_role || "").toUpperCase() === "CUSTOMER"
            ? "guest"
            : String(r.sender_role || "ops").toLowerCase(),
        author_name: r.sender_name || "",
        body: String(r.message || ""),
        created: r.created,
        attachmentUrl,
        senderRole: r.sender_role,
      });
    }
  } catch {
    /* ignore */
  }

  // Merge both sources (Ops may write booking_messages; guest classic thread too)
  const byId = new Map<string, CommMessage>();
  for (const m of [...classic, ...fromBooking]) {
    if (m?.id) byId.set(m.id, m);
  }
  const sorted = [...byId.values()].sort((a, b) => {
    const ta = new Date(a.created || 0).getTime();
    const tb = new Date(b.created || 0).getTime();
    return ta - tb;
  });

  // Drop near-duplicate dual-writes (same body + role within 12s).
  // Prefer the booking_messages copy when it has an attachment URL.
  const out: CommMessage[] = [];
  for (const m of sorted) {
    const body = String(m.body || "").trim();
    const role = String(m.author_role || "").toLowerCase();
    const t = new Date(m.created || 0).getTime();
    const dupIdx = out.findIndex((o) => {
      if (String(o.body || "").trim() !== body) return false;
      if (String(o.author_role || "").toLowerCase() !== role) return false;
      const ot = new Date(o.created || 0).getTime();
      return Math.abs(ot - t) < 12_000;
    });
    if (dupIdx < 0) {
      out.push(m);
      continue;
    }
    const existing = out[dupIdx];
    if (!existing.attachmentUrl && m.attachmentUrl) {
      out[dupIdx] = {
        ...existing,
        ...m,
        senderRole: m.senderRole || existing.senderRole,
      };
    } else if (m.senderRole && !existing.senderRole) {
      out[dupIdx] = { ...existing, senderRole: m.senderRole };
    }
  }
  return out;
}

export async function postCommMessage(opts: {
  pnr: string;
  authorRole: "guest" | "agent" | "ops";
  authorName?: string;
  authorId?: string | null;
  body: string;
  agentId?: string | null;
  agentName?: string | null;
  guestEmail?: string | null;
  topic?: string | null;
  attachment?: File | Blob | null;
  attachmentName?: string;
  /** Skip dual-write when caller already wrote booking_messages */
  skipBookingMirror?: boolean;
}): Promise<CommMessage | null> {
  const body = String(opts.body || "").trim();
  const hasFile = Boolean(opts.attachment);
  if (!body && !hasFile) return null;
  const messageBody = body || (hasFile ? "(image attachment)" : "");
  const thread = await ensureCommThread({
    pnr: opts.pnr,
    agentId: opts.agentId,
    agentName: opts.agentName,
    guestEmail: opts.guestEmail,
  });
  if (!thread) return null;
  const pb = await getAdminPocketBase();
  const created = (await pb.collection("comm_messages").create(
    {
      thread_id: thread.id,
      pnr: thread.pnr,
      author_role: opts.authorRole,
      author_name: opts.authorName || "",
      body: messageBody,
    },
    { requestKey: null }
  )) as CommMessage;

  let attachmentUrl: string | undefined;
  let bookingId: string | undefined;
  if (!opts.skipBookingMirror) {
    const mirrored = await mirrorToBookingMessages({
      pnr: thread.pnr,
      authorRole: opts.authorRole,
      authorName: opts.authorName,
      authorId: opts.authorId,
      body: messageBody,
      topic: opts.topic,
      attachment: opts.attachment,
      attachmentName: opts.attachmentName,
    });
    attachmentUrl = mirrored?.attachmentUrl;
    bookingId = mirrored?.id;
  }

  return {
    ...created,
    // Prefer booking_messages id when attachment lives there so guest feed
    // dedupes cleanly against realtime booking_messages creates.
    id: bookingId || created.id,
    body: messageBody,
    attachmentUrl,
    senderRole:
      opts.authorRole === "guest" ? "CUSTOMER" : "CONCIERGE",
  };
}

export async function listThreadsForAgent(
  agentId: string
): Promise<CommThread[]> {
  const id = String(agentId || "").trim();
  if (!id) return [];
  const pb = await getAdminPocketBase();
  return pb.collection("comm_threads").getFullList<CommThread>({
    filter: `agent_id="${id.replace(/"/g, "")}"`,
    sort: "-updated",
    requestKey: null,
  });
}
