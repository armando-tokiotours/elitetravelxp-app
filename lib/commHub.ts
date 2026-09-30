/**
 * Comm hub — PNR-keyed guest / agent messaging.
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
  return pb.collection("comm_messages").getFullList<CommMessage>({
    filter: `pnr="${pnr}"`,
    sort: "created",
    requestKey: null,
  });
}

export async function postCommMessage(opts: {
  pnr: string;
  authorRole: "guest" | "agent" | "ops";
  authorName?: string;
  body: string;
  agentId?: string | null;
  agentName?: string | null;
  guestEmail?: string | null;
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
  return (await pb.collection("comm_messages").create(
    {
      thread_id: thread.id,
      pnr: thread.pnr,
      author_role: opts.authorRole,
      author_name: opts.authorName || "",
      body,
    },
    { requestKey: null }
  )) as CommMessage;
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
