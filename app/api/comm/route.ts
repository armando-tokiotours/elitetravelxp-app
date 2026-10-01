import { NextResponse } from "next/server";
import {
  listCommMessages,
  postCommMessage,
  ensureCommThread,
} from "@/lib/commHub";
import { findConciergeAgentByPnr } from "@/lib/conciergeAgent";

/** GET ?pnr= — list messages + agent for a booking. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pnr = String(searchParams.get("pnr") || "").trim();
    if (!pnr) {
      return NextResponse.json({ error: "pnr required" }, { status: 400 });
    }
    const agent = await findConciergeAgentByPnr(pnr);
    // Always ensure a thread exists so guests can message before assignment
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

/** POST — send a message { pnr, body, authorRole, authorName?, guestEmail? } */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pnr = String(body?.pnr || "").trim();
    const text = String(body?.body || "").trim();
    const authorRole = String(body?.authorRole || "guest") as
      | "guest"
      | "agent"
      | "ops";
    if (!pnr || !text) {
      return NextResponse.json(
        { error: "pnr and body required" },
        { status: 400 }
      );
    }
    // Guests may message before any concierge is assigned — lands in Ops pool
    const agent = await findConciergeAgentByPnr(pnr);
    const msg = await postCommMessage({
      pnr,
      authorRole,
      authorName: String(body?.authorName || "").trim() || undefined,
      authorId: String(body?.authorId || "").trim() || undefined,
      body: text,
      agentId: agent?.id,
      agentName: agent?.name,
      guestEmail: body?.guestEmail ? String(body.guestEmail) : undefined,
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
