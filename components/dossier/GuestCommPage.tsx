"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type Msg = {
  id: string;
  author_role?: string;
  author_name?: string;
  body: string;
  created?: string;
};

/**
 * Guest communications page for a PNR (linked from Coordination Team widget).
 */
export function GuestCommPage({
  backHref = "/builder/itinerary",
}: {
  backHref?: string;
}) {
  const searchParams = useSearchParams();
  const pnr = String(searchParams.get("pnr") || "").trim();
  const guestEmail = String(searchParams.get("guestEmail") || "").trim();
  const guestName = String(searchParams.get("guestName") || "").trim();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!pnr || pnr.startsWith("TMP-")) return;
    try {
      const res = await fetch(`/api/comm?pnr=${encodeURIComponent(pnr)}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        messages?: Msg[];
        agent?: { name?: string } | null;
      };
      setMessages(data.messages || []);
      setAgentName(data.agent?.name || null);
      const staffMsgs = (data.messages || []).filter(
        (m) => m.author_role === "agent" || m.author_role === "ops"
      ).length;
      try {
        sessionStorage.setItem(`comm-seen-${pnr}`, String(staffMsgs));
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    }
  }, [pnr]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const title = useMemo(
    () => (agentName ? `Chat with ${agentName}` : "Communications"),
    [agentName]
  );

  const send = async () => {
    const text = draft.trim();
    if (!text || !agentName) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/comm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pnr,
          body: text,
          authorRole: "guest",
          authorName: guestName || "Guest",
          guestEmail,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "Could not send");
        return;
      }
      setDraft("");
      await reload();
    } catch {
      setError("Could not send");
    } finally {
      setBusy(false);
    }
  };

  if (!pnr) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-white">
        <p className="text-sm text-zinc-400">Missing booking reference.</p>
        <Link href={backHref} className="mt-4 inline-block text-[#075473]">
          ← Back to dossier
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col px-4 py-6 text-white">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href={backHref}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <p className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
            {pnr}
          </p>
          <h1 className="font-godiva text-lg tracking-wide uppercase">{title}</h1>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-[#0A1017]/90 p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-zinc-600">No messages yet.</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-xl px-3 py-2 text-sm ${
                m.author_role === "guest"
                  ? "ml-6 bg-[#075473]/30"
                  : "mr-6 bg-zinc-900"
              }`}
            >
              <p className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                {m.author_role}
                {m.author_name ? ` · ${m.author_name}` : ""}
              </p>
              <p className="mt-0.5 text-zinc-100">{m.body}</p>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!agentName || busy}
          placeholder={
            agentName
              ? "Write a message…"
              : "Waiting for agent assignment…"
          }
          className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-[#075473] disabled:opacity-50"
        />
        <button
          type="button"
          disabled={!agentName || busy || !draft.trim()}
          onClick={() => void send()}
          className="rounded-xl bg-[#075473] px-4 py-2 text-xs font-bold tracking-wider text-white uppercase disabled:opacity-40"
        >
          Send
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
