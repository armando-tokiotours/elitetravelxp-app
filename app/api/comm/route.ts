import { NextResponse } from "next/server";
import {
  listCommMessages,
  postCommMessage,
  ensureCommThread,
} from "@/lib/commHub";
import { findConciergeAgentByPnr } from "@/lib/conciergeAgent";
import {
  formatGuestMessageWithTopic,
  normalizeChatTopic,
} from "@/lib/chatTopics";

/** GET ?pnr= — list messages + agent for a booking. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pnr = String(searchParams.get("pnr") || "").trim();
    if (!pnr) {
      return NextResponse.json({ error: "pnr required" }, { status: 400 });
    }
    const agent = await findConciergeAgentByPnr(pnr);
    await ensureCommThread({
      pnr,
      agentId: agent?.id,
      agentName: agent?.name,
    });
    const messages = await listCommMessages(pnr);
    return NextResponse.json({
      agent: agent
        ? {
            id: agent.id,
            name: agent.name,
            email: agent.email,
            photoUrl: agent.photoUrl,
          }
        : null,
      messages,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

async function parseCommPost(request: Request): Promise<{
  pnr: string;
  body: string;
  topic: string | null;
  authorRole: "guest" | "agent" | "ops";
  authorName: string;
  authorId: string;
  guestEmail: string;
  attachment: File | null;
  attachmentName?: string;
}> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("attachment");
    const attachment =
      file instanceof File && file.size > 0 ? file : null;
    return {
      pnr: String(form.get("pnr") || "").trim(),
      body: String(form.get("body") || "").trim(),
      topic: normalizeChatTopic(form.get("topic")),
      authorRole: String(form.get("authorRole") || "guest") as
        | "guest"
        | "agent"
        | "ops",
      authorName: String(form.get("authorName") || "").trim(),
      authorId: String(form.get("authorId") || "").trim(),
      guestEmail: String(form.get("guestEmail") || "").trim(),
      attachment,
      attachmentName: attachment?.name,
    };
  }

  const json = (await request.json()) as Record<string, unknown>;
  return {
    pnr: String(json?.pnr || "").trim(),
    body: String(json?.body || "").trim(),
    topic: normalizeChatTopic(json?.topic),
    authorRole: String(json?.authorRole || "guest") as
      | "guest"
      | "agent"
      | "ops",
    authorName: String(json?.authorName || "").trim(),
    authorId: String(json?.authorId || "").trim(),
    guestEmail: String(json?.guestEmail || "").trim(),
    attachment: null,
  };
}

/** POST — JSON or multipart (pnr, body, topic?, attachment?) */
export async function POST(request: Request) {
  try {
    const parsed = await parseCommPost(request);
    const text = formatGuestMessageWithTopic(parsed.topic, parsed.body);
    const hasFile = Boolean(parsed.attachment);
    if (!parsed.pnr || (!text && !hasFile)) {
      return NextResponse.json(
        { error: "pnr and body (or attachment) required" },
        { status: 400 }
      );
    }
    const agent = await findConciergeAgentByPnr(parsed.pnr);
    const msg = await postCommMessage({
      pnr: parsed.pnr,
      authorRole: parsed.authorRole,
      authorName: parsed.authorName || undefined,
      authorId: parsed.authorId || undefined,
      body: text || (hasFile ? "(image attachment)" : ""),
      agentId: agent?.id,
      agentName: agent?.name,
      guestEmail: parsed.guestEmail || undefined,
      topic: parsed.topic || undefined,
      attachment: parsed.attachment,
      attachmentName: parsed.attachmentName,
    });
    if (!msg) {
      return NextResponse.json(
        { error: "Could not post message" },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, message: msg });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
