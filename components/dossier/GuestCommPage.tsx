"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ImagePlus, X } from "lucide-react";
import { getPocketBase } from "@/lib/pocketbase/client";
import {
  CHAT_TOPICS,
  TOPIC_PRESETS,
  type ChatTopic,
} from "@/lib/chatTopics";
import { guestFacingStaffLabel } from "@/lib/specialistDirectChat";
import { ChatMessageItem } from "@/components/chat/ChatMessageItem";
import {
  assignedAgentGreeting,
  countStaffMessages,
  setCommSeenStaffCount,
} from "@/lib/guestTalkChat";

function formatGreetingTime(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Display-only initial greeting from the assigned concierge agent —
 * not a persisted comm message. Only rendered when an agent is assigned.
 */
function AssignedAgentGreeting({
  guestName,
  agentName,
  agentPhotoUrl,
}: {
  guestName?: string;
  agentName: string;
  agentPhotoUrl?: string | null;
}) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  // Captured once per chat mount so re-renders/reloads don't duplicate or drift.
  const [greetingAt] = useState(() => new Date().toISOString());
  const showPhoto = Boolean(agentPhotoUrl) && !avatarFailed;
  return (
    <div className="flex items-start gap-2">
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={agentPhotoUrl || undefined}
          alt=""
          className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/10"
          onError={() => setAvatarFailed(true)}
        />
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#075473]/40 text-xs font-bold text-cyan-200 ring-1 ring-white/10">
          {agentName.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="mr-6 max-w-[90%] rounded-xl bg-zinc-900 px-2.5 py-2 text-xs sm:text-sm">
        <p className="mb-0.5 flex flex-wrap items-center justify-between gap-2 text-[9px] tracking-wide text-zinc-400 uppercase sm:text-[10px]">
          <span>{agentName}</span>
          <span className="font-mono normal-case opacity-70">
            {formatGreetingTime(greetingAt)}
          </span>
        </p>
        <p className="whitespace-pre-wrap break-words text-zinc-100">
          {assignedAgentGreeting(guestName, agentName)}
        </p>
      </div>
    </div>
  );
}

/**
 * Circular agent avatar for the chat header (reference: top bar, photo on
 * the right beside "Chat with …" + booking ref). Letter fallback when there
 * is no photo / the image fails; "T" for TokioTours when unassigned.
 */
function HeaderAgentAvatar({
  agentName,
  agentPhotoUrl,
}: {
  agentName: string | null;
  agentPhotoUrl: string | null;
}) {
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);
  const showPhoto = Boolean(agentPhotoUrl) && failedPhotoUrl !== agentPhotoUrl;
  const label = agentName || "TokioTours Concierge";
  if (showPhoto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={agentPhotoUrl || undefined}
        alt={label}
        title={label}
        className="h-11 w-11 shrink-0 rounded-full border border-white/15 object-cover ring-1 ring-white/10"
        onError={() => setFailedPhotoUrl(agentPhotoUrl)}
      />
    );
  }
  return (
    <span
      aria-hidden
      title={label}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-[#075473]/40 text-sm font-bold text-cyan-200 ring-1 ring-white/10"
    >
      {(agentName?.charAt(0) || "T").toUpperCase()}
    </span>
  );
}

type Msg = {
  id: string;
  author_role?: string;
  author_name?: string;
  body: string;
  created?: string;
  attachmentUrl?: string;
  senderRole?: string;
};

function appendUnique(prev: Msg[], next: Msg): Msg[] {
  if (prev.some((m) => m.id === next.id)) return prev;
  const body = String(next.body || "").trim();
  const role = String(next.author_role || "").toLowerCase();
  const t = new Date(next.created || Date.now()).getTime();
  if (
    prev.some((m) => {
      if (String(m.body || "").trim() !== body) return false;
      if (String(m.author_role || "").toLowerCase() !== role) return false;
      const sameAttach =
        String(m.attachmentUrl || "") === String(next.attachmentUrl || "");
      if (!sameAttach && (m.attachmentUrl || next.attachmentUrl)) return false;
      return Math.abs(new Date(m.created || 0).getTime() - t) < 12_000;
    })
  ) {
    return prev;
  }
  return [...prev, next].sort(
    (a, b) =>
      new Date(a.created || 0).getTime() - new Date(b.created || 0).getTime()
  );
}

/**
 * Guest communications for a PNR — full page route or embedded modal overlay.
 * Topic pills prepend [TICKETS] / [TOUR] / … so Ops sees intent immediately.
 */
export function GuestCommPage({
  backHref = "/builder/itinerary",
  pnr: pnrProp,
  guestEmail: guestEmailProp,
  guestName: guestNameProp,
  onClose,
  embedded = false,
}: {
  backHref?: string;
  /** When set (modal), overrides URL search params. */
  pnr?: string;
  guestEmail?: string;
  guestName?: string;
  /** Modal close — shows ✕ instead of back link. */
  onClose?: () => void;
  embedded?: boolean;
}) {
  const searchParams = useSearchParams();
  const pnr = String(
    pnrProp ?? searchParams.get("pnr") ?? ""
  ).trim();
  const guestEmail = String(
    guestEmailProp ?? searchParams.get("guestEmail") ?? ""
  ).trim();
  const guestName = String(
    guestNameProp ?? searchParams.get("guestName") ?? ""
  ).trim();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [agentPhotoUrl, setAgentPhotoUrl] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<ChatTopic | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pnrKey = pnr.toUpperCase().replace(/"/g, "");

  const reload = useCallback(async () => {
    if (!pnr || pnr.startsWith("TMP-")) return;
    try {
      const res = await fetch(`/api/comm?pnr=${encodeURIComponent(pnr)}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        messages?: Msg[];
        agent?: { name?: string; photoUrl?: string | null } | null;
      };
      setMessages(data.messages || []);
      // /api/comm resolves the assigned concierge via findConciergeAgentByPnr
      // (photoUrl is already the /api/staff/avatar/… URL when present).
      setAgentName(data.agent?.name || null);
      setAgentPhotoUrl(data.agent?.photoUrl || null);
      // Embedded modal: GuestTalkBubble marks seen when FAB opens.
      // Standalone /comm route: navigating here is an explicit open.
      if (!embedded) {
        setCommSeenStaffCount(pnr, countStaffMessages(data.messages || []));
      }
    } catch {
      /* ignore */
    }
  }, [pnr, embedded]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!pnrKey || pnrKey.startsWith("TMP-")) return;
    const pb = getPocketBase();
    let cancelled = false;

    const onComm = (e: { action: string; record: Record<string, unknown> }) => {
      if (cancelled || e.action !== "create") return;
      const rec = e.record;
      if (String(rec.pnr || "").toUpperCase() !== pnrKey) return;
      const msg: Msg = {
        id: String(rec.id || ""),
        author_role: String(rec.author_role || ""),
        author_name: String(rec.author_name || ""),
        body: String(rec.body || ""),
        created: String(rec.created || ""),
      };
      if (!msg.id || (!msg.body && !msg.attachmentUrl)) return;
      setMessages((prev) => appendUnique(prev, msg));
    };

    const onBooking = (e: {
      action: string;
      record: Record<string, unknown>;
    }) => {
      if (cancelled || e.action !== "create") return;
      const rec = e.record;
      if (String(rec.pnr || "").toUpperCase() !== pnrKey) return;
      if (String(rec.channel || "").toUpperCase() !== "CUSTOMER") return;
      const senderRole = String(rec.sender_role || "");
      const role =
        senderRole.toUpperCase() === "CUSTOMER" ? "guest" : "ops";
      const file = String(rec.attachment || "").trim();
      let attachmentUrl: string | undefined;
      if (file) {
        try {
          attachmentUrl = pb.files.getURL(rec as never, file);
        } catch {
          attachmentUrl = undefined;
        }
      }
      const msg: Msg = {
        id: String(rec.id || ""),
        author_role: role,
        author_name: String(rec.sender_name || ""),
        body: String(rec.message || ""),
        created: String(rec.created || ""),
        attachmentUrl,
        senderRole,
      };
      if (!msg.id || (!msg.body && !msg.attachmentUrl)) return;
      setMessages((prev) => appendUnique(prev, msg));
    };

    void pb
      .collection("comm_messages")
      .subscribe("*", onComm as never)
      .catch(() => {
        /* rules / offline */
      });

    void pb
      .collection("booking_messages")
      .subscribe("*", onBooking as never)
      .catch(() => {
        /* rules / offline */
      });

    return () => {
      cancelled = true;
      void pb.collection("comm_messages").unsubscribe("*").catch(() => {});
      void pb.collection("booking_messages").unsubscribe("*").catch(() => {});
    };
  }, [pnrKey]);

  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const title = useMemo(
    () =>
      agentName
        ? `Chat with ${agentName}`
        : "Chat with TokioTours Concierge",
    [agentName]
  );

  const handleSelectTopic = (topic: ChatTopic) => {
    setSelectedTopic(topic);
    setDraft(TOPIC_PRESETS[topic].defaultText);
  };

  const send = async () => {
    const text = draft.trim();
    if ((!text && !pendingFile) || busy) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("pnr", pnr);
      form.append("body", text);
      form.append("authorRole", "guest");
      form.append("authorName", guestName || "Guest");
      if (guestEmail) form.append("guestEmail", guestEmail);
      if (selectedTopic) form.append("topic", selectedTopic);
      if (pendingFile) form.append("attachment", pendingFile, pendingFile.name);

      const res = await fetch("/api/comm", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "Could not send");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        message?: Msg;
      };
      if (data.message?.id) {
        setMessages((prev) => appendUnique(prev, data.message as Msg));
      }
      setDraft("");
      setPendingFile(null);
      setSelectedTopic(null);
      if (fileRef.current) fileRef.current.value = "";
      void reload();
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
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 inline-block text-[#075473]"
          >
            ← Close
          </button>
        ) : (
          <Link href={backHref} className="mt-4 inline-block text-[#075473]">
            ← Back to dossier
          </Link>
        )}
      </div>
    );
  }

  return (
    <div
      className={`mx-auto flex max-w-lg flex-col text-white ${
        embedded
          ? "h-full min-h-0 px-4 py-4"
          : "min-h-[70vh] px-4 py-6"
      }`}
    >
      <div className="mb-4 flex items-center gap-3">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900"
            aria-label="Close chat"
          >
            <X className="h-5 w-5" />
          </button>
        ) : (
          <Link
            href={backHref}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
            {pnr}
          </p>
          <h1 className="font-godiva truncate text-lg tracking-wide uppercase">
            {title}
          </h1>
        </div>
        <HeaderAgentAvatar agentName={agentName} agentPhotoUrl={agentPhotoUrl} />
      </div>

      <div
        ref={feedRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-[#0A1017]/90 p-4"
      >
        {!agentName ? (
          <p className="rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-xs text-zinc-400">
            Your message goes straight to our ops team. A concierge will pick it
            up and reply here.
          </p>
        ) : null}
        {messages.length === 0 ? (
          agentName ? (
            <AssignedAgentGreeting
              guestName={guestName}
              agentName={agentName}
              agentPhotoUrl={agentPhotoUrl}
            />
          ) : null
        ) : (
          messages.map((m) => {
            const isGuest =
              String(m.author_role || "").toLowerCase() === "guest";
            const roleHint =
              m.senderRole ||
              (isGuest
                ? "CUSTOMER"
                : String(m.author_role || "").toUpperCase() === "OPS" ||
                    String(m.author_role || "").toLowerCase() === "ops"
                  ? "CONCIERGE"
                  : String(m.author_role || "CONCIERGE").toUpperCase());
            return (
              <ChatMessageItem
                key={m.id}
                message={{
                  id: m.id,
                  body: m.body,
                  authorRole: isGuest ? "guest" : "ops",
                  authorName: isGuest
                    ? "You"
                    : guestFacingStaffLabel(
                        roleHint,
                        m.author_name || agentName
                      ),
                  senderRole: roleHint,
                  imageUrl: m.attachmentUrl,
                  created: m.created,
                }}
              />
            );
          })
        )}
      </div>

      <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
        <span className="block text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
          What is your topic today?
        </span>
        <div className="flex flex-wrap gap-2">
          {CHAT_TOPICS.map((topicKey) => {
            const { label, icon } = TOPIC_PRESETS[topicKey];
            const isActive = selectedTopic === topicKey;
            return (
              <button
                key={topicKey}
                type="button"
                onClick={() => handleSelectTopic(topicKey)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  isActive
                    ? "border-white/40 bg-[#075473] text-white shadow-md"
                    : "border-white/10 bg-[#0D1117] text-zinc-300 hover:border-white/30"
                }`}
              >
                <span aria-hidden>{icon}</span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {pendingFile ? (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-zinc-300">
          <span className="min-w-0 flex-1 truncate">{pendingFile.name}</span>
          <button
            type="button"
            onClick={() => {
              setPendingFile(null);
              if (fileRef.current) fileRef.current.value = "";
            }}
            className="rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
            aria-label="Remove attachment"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <div className="mt-2 flex gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            setPendingFile(file);
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-[#075473] hover:text-white disabled:opacity-50"
          aria-label="Attach image"
          title="Attach seating map / ticket image"
        >
          <ImagePlus className="h-4 w-4" />
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Write a message to TokioTours…"
          className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-[#075473] disabled:opacity-50"
        />
        <button
          type="button"
          disabled={busy || (!draft.trim() && !pendingFile)}
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
