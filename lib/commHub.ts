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
}): Promise<void> {
  const pnr = safePnr(opts.pnr);
  const text = String(opts.body || "").trim().slice(0, 4000);
  if (!pnr || !text) return;
  const isGuest = opts.authorRole === "guest";
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
    await pb.collection("booking_messages").create(
      {
        pnr,
        ops_hub_id: opsHubId,
        channel: "CUSTOMER",
        sender_id: String(opts.authorId || "").trim() || "",
        sender_name:
          String(opts.authorName || "").trim() ||
          (isGuest ? "Client" : "Concierge"),
        sender_role: isGuest ? "CUSTOMER" : "CONCIERGE",
        message: text,
        is_read: !isGuest,
      },
      { requestKey: null }
    );
  } catch (err) {
    console.warn("[comm→booking_messages]", err);
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
  // Prefer classic guest thread; fall back to Ops booking_messages CUSTOMER channel
  try {
    const classic = await pb.collection("comm_messages").getFullList<CommMessage>({
      filter: `pnr="${pnr}"`,
      sort: "created",
      requestKey: null,
    });
    if (classic.length > 0) return classic;
  } catch {
    /* collection may be missing */
  }
  try {
    const rows = await pb.collection("booking_messages").getFullList<{
      id: string;
      pnr: string;
      sender_role?: string;
      sender_name?: string;
      message?: string;
      created?: string;
    }>({
      filter: `pnr="${pnr}" && channel="CUSTOMER"`,
      sort: "created",
      requestKey: null,
    });
    return rows.map((r) => ({
      id: r.id,
      thread_id: "",
      pnr: r.pnr,
      author_role:
        String(r.sender_role || "").toUpperCase() === "CUSTOMER"
          ? "guest"
          : "ops",
      author_name: r.sender_name || "",
      body: String(r.message || ""),
      created: r.created,
    }));
  } catch {
    return [];
  }
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
  /** Skip dual-write when caller already wrote booking_messages */
  skipBookingMirror?: boolean;
}): Promise<CommMessage | null> {
  const body = String(opts.body || "").trim();
  if (!body) return null;
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
      body,
    },
    { requestKey: null }
  )) as CommMessage;

  if (!opts.skipBookingMirror) {
    void mirrorToBookingMessages({
      pnr: thread.pnr,
      authorRole: opts.authorRole,
      authorName: opts.authorName,
      authorId: opts.authorId,
      body,
    });
  }

  return created;
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
