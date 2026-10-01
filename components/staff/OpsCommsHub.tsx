"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import type PocketBase from "pocketbase";
import {
  COMM_CHANNELS,
  countUnreadBookingMessages,
  loadBookingMessagesForPnr,
  markChannelMessagesRead,
  sendBookingMessage,
  type BookingMessageChannel,
  type BookingMessageRow,
} from "@/lib/bookingMessages";
import { appendBookingLog } from "@/lib/bookingLogs";

function formatMsgTime(raw?: string): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function OpsCommsHub({
  pb,
  pnr,
  opsHubId,
  staffId,
  staffName,
}: {
  pb: PocketBase;
  pnr: string | null;
  opsHubId?: string | null;
  staffId?: string | null;
  staffName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<BookingMessageChannel>("CUSTOMER");
  const [messages, setMessages] = useState<BookingMessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const pnrKey = String(pnr || "")
    .trim()
    .toUpperCase();

  const reload = useCallback(async () => {
    if (!pnrKey) {
      setMessages([]);
      return;
    }
    setMessages(await loadBookingMessagesForPnr(pb, pnrKey));
  }, [pb, pnrKey]);

  // Rebind when PNR changes
  useEffect(() => {
    setDraft("");
    setChannel("CUSTOMER");
    void reload();
  }, [pnrKey, reload]);

  // Realtime inbox for this PNR (and badge while closed)
  useEffect(() => {
    if (!pnrKey) return;
    let unsub: (() => void) | undefined;
    void pb
      .collection("booking_messages")
      .subscribe("*", (e) => {
        const rec = e.record as unknown as BookingMessageRow;
        if (!rec?.id) return;
        if (String(rec.pnr || "").toUpperCase() !== pnrKey) return;
        setMessages((prev) => {
          if (e.action === "create") {
            if (prev.some((m) => m.id === rec.id)) return prev;
            return [...prev, rec];
          }
          if (e.action === "update") {
            return prev.map((m) => (m.id === rec.id ? { ...m, ...rec } : m));
          }
          if (e.action === "delete") {
            return prev.filter((m) => m.id !== rec.id);
          }
          return prev;
        });
      })
      .then((u) => {
        unsub = u;
      })
      .catch(() => {
        /* realtime optional */
      });
    return () => {
      try {
        unsub?.();
      } catch {
        /* ignore */
      }
      void pb.collection("booking_messages").unsubscribe("*").catch(() => {});
    };
  }, [pb, pnrKey]);

  // Mark active channel read when hub is open
  useEffect(() => {
    if (!open || !pnrKey) return;
    void markChannelMessagesRead(pb, pnrKey, channel).then(() => {
      setMessages((prev) =>
        prev.map((m) =>
          m.channel === channel &&
          String(m.sender_role || "").toUpperCase() !== "CONCIERGE"
            ? { ...m, is_read: true }
            : m
        )
      );
    });
  }, [open, channel, pnrKey, pb]);

  useEffect(() => {
    if (!open) return;
    const el = feedRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [open, channel, messages.length]);

  const unreadCount = useMemo(
    () => countUnreadBookingMessages(messages),
    [messages]
  );

  const channelUnread = useMemo(() => {
    const map: Record<string, number> = {};
    for (const ch of COMM_CHANNELS) {
      map[ch.id] = messages.filter(
        (m) =>
          m.channel === ch.id &&
          !Boolean(m.is_read) &&
          String(m.sender_role || "").toUpperCase() !== "CONCIERGE"
      ).length;
    }
    return map;
  }, [messages]);

  const visible = useMemo(
    () => messages.filter((m) => m.channel === channel),
    [messages, channel]
  );

  const onSend = async () => {
    const text = draft.trim();
    if (!text || !pnrKey || sending) return;
    setSending(true);
    const saved = await sendBookingMessage(pb, {
      pnr: pnrKey,
      opsHubId,
      channel,
      senderId: staffId,
      senderName: staffName || "Concierge",
      senderRole: "CONCIERGE",
      message: text,
    });

    // Mirror CUSTOMER-channel replies into guest used thread
    if (saved && channel === "CUSTOMER") {
      try {
        const { postCommMessage } = await import("@/lib/commHub");
        void postCommMessage({
          pnr: pnrKey,
          authorRole: "ops",
          authorName: staffName || "Concierge",
          authorId: staffId,
          body: text,
          agentId: staffId,
          agentName: staffName,
          skipBookingMirror: true,
        });
      } catch {
        /* non-blocking */
      }

      // Auto-claim unassigned inquiry on first staff reply
      if (opsHubId && staffId) {
        try {
          const hub = await pb.collection("ops_hub").getOne<{
            id: string;
            assigned_agent_id?: string;
            status?: string;
          }>(opsHubId, { requestKey: null });
          if (!String(hub.assigned_agent_id || "").trim()) {
            const patch: Record<string, unknown> = {
              assigned_agent_id: staffId,
              assigned_agent: staffName || "",
              last_action_by: staffId,
              last_action_date: new Date().toISOString().slice(0, 10),
            };
            if (
              !hub.status ||
              hub.status === "incoming" ||
              hub.status === "draft"
            ) {
              patch.status = "in_ops";
            }
            await pb
              .collection("ops_hub")
              .update(opsHubId, patch, { requestKey: null });
            void appendBookingLog(pb, {
              pnr: pnrKey,
              opsHubId,
              staffId,
              staffName,
              actionType: "claimed_via_chat",
              details: `${staffName || "Staff"} claimed ${pnrKey} via chat`,
            });
          }
        } catch {
          /* non-blocking */
        }
      }
    }

    setSending(false);
    if (saved) {
      setDraft("");
      setMessages((prev) =>
        prev.some((m) => m.id === saved.id) ? prev : [...prev, saved]
      );
    }
  };

  if (!pnrKey) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed right-6 bottom-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#075473] text-white shadow-2xl transition hover:bg-[#054F70] active:scale-95"
        aria-label={open ? "Close communication hub" : "Open communication hub"}
      >
        {open ? (
          <X className="h-6 w-6" aria-hidden />
        ) : (
          <MessageCircle className="h-6 w-6" aria-hidden />
        )}
        {!open && unreadCount > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#0A1017] bg-red-500 px-1.5 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed right-6 bottom-24 z-50 flex h-[min(32rem,70vh)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0A1017] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 bg-[#0D1117] px-3 py-2.5">
            <h4 className="text-xs font-bold tracking-wide text-[#F6A724]">
              Comms Hub · {pnrKey}
            </h4>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-zinc-400 hover:bg-white/5 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex border-b border-white/5 bg-black/20 text-[10px]">
            {COMM_CHANNELS.map((ch) => {
              const active = channel === ch.id;
              const n = channelUnread[ch.id] || 0;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setChannel(ch.id)}
                  className={`relative flex-1 py-2 text-center font-semibold tracking-wide transition ${
                    active
                      ? "border-b-2 border-[#F6A724] text-white"
                      : "text-zinc-500 hover:text-zinc-200"
                  }`}
                  title={ch.label}
                >
                  {ch.short}
                  {n > 0 ? (
                    <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-red-500" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div
            ref={feedRef}
            className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#05080C] p-3"
          >
            {visible.length === 0 ? (
              <p className="py-8 text-center text-[11px] text-zinc-600">
                No messages yet — say hello on{" "}
                {COMM_CHANNELS.find((c) => c.id === channel)?.label || channel}.
              </p>
            ) : (
              visible.map((msg) => {
                const mine =
                  String(msg.sender_role || "").toUpperCase() === "CONCIERGE";
                return (
                  <div
                    key={msg.id}
                    className={`max-w-[82%] rounded-xl px-2.5 py-2 text-xs ${
                      mine
                        ? "ml-auto rounded-br-sm bg-[#075473] text-white"
                        : "mr-auto rounded-bl-sm bg-white/10 text-zinc-200"
                    }`}
                  >
                    <p className="mb-0.5 flex items-center justify-between gap-2 text-[9px] tracking-wide text-zinc-400 uppercase">
                      <span>
                        {msg.sender_name || msg.sender_role || "—"}
                      </span>
                      <span className="font-mono normal-case opacity-70">
                        {formatMsgTime(msg.created)}
                      </span>
                    </p>
                    <p className="whitespace-pre-wrap break-words">
                      {msg.message}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex gap-2 border-t border-white/10 bg-[#0D1117] p-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void onSend();
                }
              }}
              placeholder={`Message ${COMM_CHANNELS.find((c) => c.id === channel)?.label || channel}…`}
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:border-[#075473] focus:outline-none"
            />
            <button
              type="button"
              disabled={sending || !draft.trim()}
              onClick={() => void onSend()}
              className="rounded-lg bg-[#075473] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#054F70] disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
