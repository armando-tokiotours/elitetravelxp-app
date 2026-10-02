"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, MessageCircle, X } from "lucide-react";
import type PocketBase from "pocketbase";
import {
  COMM_CHANNELS,
  assignedAgentTabShort,
  commChannelAccess,
  countUnreadBookingMessages,
  loadBookingMessagesForPnr,
  markChannelMessagesRead,
  opsInternalSenderBadge,
  sendBookingMessage,
  senderRoleForStaff,
  type BookingMessageChannel,
  type BookingMessageRow,
} from "@/lib/bookingMessages";
import { parseGuestMessageTopic } from "@/lib/chatTopics";
import { appendBookingLog } from "@/lib/bookingLogs";
import {
  canToggleSpecialistDirect,
  guestFacingStaffLabel,
  specialistCanPostToCustomer,
  type DirectChatFlags,
} from "@/lib/specialistDirectChat";
import { ChatMessageItem } from "@/components/chat/ChatMessageItem";
import { GeminiAssistDrawer } from "@/components/staff/GeminiAssistDrawer";
import type { StaffRole } from "@/lib/staffRoles";
import { useTeamAuth } from "@/store/useTeamAuth";

function isMineBubble(
  staffId?: string | null,
  senderId?: string
): boolean {
  if (!staffId || !senderId) return false;
  return staffId === senderId;
}

function isCustomerSender(role: string): boolean {
  return String(role || "").toUpperCase() === "CUSTOMER";
}

const FORWARD_DEPTS: Array<{
  id: BookingMessageChannel;
  short: string;
}> = [
  { id: "TICKETS", short: "TIX" },
  { id: "GUIDE", short: "GUID" },
  { id: "DRIVER", short: "DRIV" },
];

type CommsWindowSize = "compact" | "half" | "full";

const COMMS_WINDOW_SIZE_CLASSES: Record<CommsWindowSize, string> = {
  compact:
    "bottom-24 right-6 h-[min(30rem,70vh)] w-[min(24rem,calc(100vw-2rem))]",
  half: "bottom-6 right-6 h-[80vh] w-[min(37.5rem,calc(100vw-2rem))]",
  full: "top-10 left-[2.5vw] h-[92vh] w-[95vw]",
};

export function OpsCommsHub({
  pb,
  pnr,
  opsHubId,
  staffId,
  staffName,
  assignedAgentName,
  assignedAgentId,
  assignedAgentEmail,
  staffRole: staffRoleProp,
  ticketerDirectChatEnabled = false,
  driverDirectChatEnabled = false,
  onDirectFlagsChange,
}: {
  pb: PocketBase;
  pnr: string | null;
  opsHubId?: string | null;
  staffId?: string | null;
  staffName?: string | null;
  assignedAgentName?: string | null;
  assignedAgentId?: string | null;
  assignedAgentEmail?: string | null;
  staffRole?: StaffRole | null;
  ticketerDirectChatEnabled?: boolean;
  driverDirectChatEnabled?: boolean;
  onDirectFlagsChange?: (flags: DirectChatFlags) => void;
}) {
  const authRole = useTeamAuth((s) => s.role);
  const role = (staffRoleProp ?? authRole) as StaffRole | null;

  const [open, setOpen] = useState(false);
  const [windowSize, setWindowSize] = useState<CommsWindowSize>("compact");
  const [channel, setChannel] = useState<BookingMessageChannel>("CUSTOMER");
  const [messages, setMessages] = useState<BookingMessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [ticketerDirect, setTicketerDirect] = useState(
    ticketerDirectChatEnabled
  );
  const [driverDirect, setDriverDirect] = useState(driverDirectChatEnabled);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pnrKey = String(pnr || "")
    .trim()
    .toUpperCase();

  useEffect(() => {
    setTicketerDirect(ticketerDirectChatEnabled);
    setDriverDirect(driverDirectChatEnabled);
  }, [ticketerDirectChatEnabled, driverDirectChatEnabled, pnrKey]);

  // Hydrate flags from hub when opened
  useEffect(() => {
    if (!opsHubId || !pnrKey) return;
    let cancelled = false;
    void (async () => {
      try {
        const hub = await pb.collection("ops_hub").getOne<{
          ticketer_direct_chat_enabled?: boolean;
          driver_direct_chat_enabled?: boolean;
        }>(opsHubId, { requestKey: null });
        if (cancelled) return;
        const next = {
          ticketerDirect: Boolean(hub.ticketer_direct_chat_enabled),
          driverDirect: Boolean(hub.driver_direct_chat_enabled),
        };
        setTicketerDirect(next.ticketerDirect);
        setDriverDirect(next.driverDirect);
        onDirectFlagsChange?.(next);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pb, opsHubId, pnrKey, onDirectFlagsChange]);

  const opsTabShort = useMemo(
    () => assignedAgentTabShort(assignedAgentName, assignedAgentEmail),
    [assignedAgentName, assignedAgentEmail]
  );

  const directFlags: DirectChatFlags = useMemo(
    () => ({ ticketerDirect, driverDirect }),
    [ticketerDirect, driverDirect]
  );

  const channelMeta = useMemo(
    () =>
      COMM_CHANNELS.map((ch) =>
        ch.id === "OPS"
          ? {
              ...ch,
              short: opsTabShort,
              label:
                opsTabShort === "OPS"
                  ? "Ops internal"
                  : `${opsTabShort} · Ops internal`,
            }
          : ch
      ),
    [opsTabShort]
  );

  const channelAccess = useMemo(() => {
    const map = {} as Record<
      BookingMessageChannel,
      ReturnType<typeof commChannelAccess>
    >;
    for (const ch of COMM_CHANNELS) {
      map[ch.id] = commChannelAccess(role, ch.id, {
        ticketerDirect,
        driverDirect,
      });
    }
    return map;
  }, [role, ticketerDirect, driverDirect]);

  useEffect(() => {
    if (channelAccess[channel] !== "none") return;
    const first = COMM_CHANNELS.find((c) => channelAccess[c.id] !== "none");
    if (first) setChannel(first.id);
  }, [channel, channelAccess]);

  const reload = useCallback(async () => {
    if (!pnrKey) {
      setMessages([]);
      return;
    }
    setMessages(await loadBookingMessagesForPnr(pb, pnrKey));
  }, [pb, pnrKey]);

  useEffect(() => {
    setDraft("");
    setPendingFile(null);
    const preferred =
      COMM_CHANNELS.find((c) => channelAccess[c.id] === "full")?.id ||
      COMM_CHANNELS.find((c) => channelAccess[c.id] !== "none")?.id ||
      "CUSTOMER";
    setChannel(preferred);
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pnrKey, reload]);

  useEffect(() => {
    if (!pnrKey) return;
    let unsub: (() => void) | undefined;
    void pb
      .collection("booking_messages")
      .subscribe("*", (e) => {
        const rec = e.record as unknown as BookingMessageRow;
        if (!rec?.id) return;
        if (String(rec.pnr || "").toUpperCase() !== pnrKey) return;
        const file = String(rec.attachment || "").trim();
        let attachmentUrl: string | null = null;
        if (file) {
          try {
            attachmentUrl = pb.files.getURL(rec as never, file);
          } catch {
            attachmentUrl = null;
          }
        }
        const withUrl = { ...rec, attachmentUrl };
        setMessages((prev) => {
          if (e.action === "create") {
            if (prev.some((m) => m.id === withUrl.id)) return prev;
            return [...prev, withUrl];
          }
          if (e.action === "update") {
            return prev.map((m) =>
              m.id === withUrl.id ? { ...m, ...withUrl } : m
            );
          }
          if (e.action === "delete") {
            return prev.filter((m) => m.id !== withUrl.id);
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

  useEffect(() => {
    if (!open || !pnrKey) return;
    if (channelAccess[channel] === "none") return;
    void markChannelMessagesRead(pb, pnrKey, channel).then(() => {
      setMessages((prev) =>
        prev.map((m) =>
          m.channel === channel ? { ...m, is_read: true } : m
        )
      );
    });
  }, [open, channel, pnrKey, pb, channelAccess]);

  useEffect(() => {
    if (!open) return;
    const el = feedRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [open, channel, messages.length]);

  const unreadCount = useMemo(
    () => countUnreadBookingMessages(messages, role),
    [messages, role]
  );

  const channelUnread = useMemo(() => {
    const map: Record<string, number> = {};
    for (const ch of COMM_CHANNELS) {
      if (channelAccess[ch.id] === "none") {
        map[ch.id] = 0;
        continue;
      }
      map[ch.id] = messages.filter(
        (m) =>
          m.channel === ch.id &&
          !Boolean(m.is_read) &&
          !isMineBubble(staffId, m.sender_id)
      ).length;
    }
    return map;
  }, [messages, channelAccess, staffId]);

  // CUST tab shows guest + specialist direct posts; TIX/DRIV show internal + mirrors
  const visible = useMemo(() => {
    if (channel === "CUSTOMER") {
      return messages.filter((m) => m.channel === "CUSTOMER");
    }
    return messages.filter((m) => m.channel === channel);
  }, [messages, channel]);

  const canSend = channelAccess[channel] === "full";
  const canView = channelAccess[channel] !== "none";
  const canForwardDepts =
    role === "owner" || role === "ops" || role === "agent";
  const canForwardToGuest =
    canForwardDepts && channelAccess.CUSTOMER === "full";
  const canToggleDirect = canToggleSpecialistDirect(role);
  const specialistDirectActive =
    (channel === "TICKETS" && ticketerDirect) ||
    (channel === "DRIVER" && driverDirect);
  const specialistPostingDirect =
    specialistCanPostToCustomer(role, directFlags) &&
    ((role === "ticketer" &&
      (channel === "TICKETS" || channel === "CUSTOMER")) ||
      (role === "driver" &&
        (channel === "DRIVER" || channel === "CUSTOMER")));

  const activeChannelLabel =
    channelMeta.find((c) => c.id === channel)?.label || channel;

  const forwardToChannel = (
    messageText: string,
    target: BookingMessageChannel,
    opts?: { fromGuest?: boolean; topic?: string | null }
  ) => {
    if (channelAccess[target] === "none") return;
    setOpen(true);
    setChannel(target);
    const cleaned = String(messageText || "").trim();
    const prefix =
      target === "CUSTOMER"
        ? "[Forwarded from staff — edit before send]\n"
        : opts?.fromGuest
          ? `[FORWARDED FROM GUEST${opts.topic ? ` · ${opts.topic}` : ""}]\n`
          : "[Forwarded note]\n";
    setDraft(`${prefix}${cleaned}`);
  };

  const handleToggleDirect = async () => {
    if (!canToggleDirect || !pnrKey || toggling) return;
    if (channel !== "TICKETS" && channel !== "DRIVER") return;
    const specialistRole = channel === "TICKETS" ? "TICKETER" : "DRIVER";
    const enabled = !(channel === "TICKETS" ? ticketerDirect : driverDirect);
    setToggling(true);
    try {
      const res = await fetch("/api/comms/toggle-specialist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pnr: pnrKey,
          specialistRole,
          enabled,
          staffName: staffName || "Concierge",
        }),
      });
      if (!res.ok) return;
      if (channel === "TICKETS") setTicketerDirect(enabled);
      else setDriverDirect(enabled);
      onDirectFlagsChange?.({
        ticketerDirect: channel === "TICKETS" ? enabled : ticketerDirect,
        driverDirect: channel === "DRIVER" ? enabled : driverDirect,
      });
      void reload();
    } finally {
      setToggling(false);
    }
  };

  const onSend = async () => {
    const text = draft.trim();
    if ((!text && !pendingFile) || !pnrKey || sending || !canSend) return;
    setSending(true);

    const senderRole = senderRoleForStaff(role);
    const postingDirect =
      specialistPostingDirect &&
      (senderRole === "TICKETS" || senderRole === "DRIVER");

    // Specialist with direct ON → post to CUSTOMER (guest + agent see it)
    // Also mirror to specialist channel so their tab keeps history
    const primaryChannel: BookingMessageChannel = postingDirect
      ? "CUSTOMER"
      : channel;

    const displayName = postingDirect
      ? guestFacingStaffLabel(senderRole, staffName)
      : primaryChannel === "CUSTOMER"
        ? String(assignedAgentName || "").trim() || "TokioTours Concierge"
        : String(staffName || "").trim() || "TokioTours Staff";

    const saved = await sendBookingMessage(pb, {
      pnr: pnrKey,
      opsHubId,
      channel: primaryChannel,
      senderId: staffId,
      senderName: displayName,
      senderRole,
      message: text,
      attachment: pendingFile,
      attachmentName: pendingFile?.name,
      isDirectSpecialist: postingDirect,
      ...(primaryChannel === "OPS"
        ? {
            targetAgentId: assignedAgentId,
            targetAgentEmail: assignedAgentEmail,
          }
        : {}),
    });

    if (saved && postingDirect && channel !== "CUSTOMER") {
      // Mirror into specialist internal channel for their own tab
      void sendBookingMessage(pb, {
        pnr: pnrKey,
        opsHubId,
        channel: channel === "TICKETS" ? "TICKETS" : "DRIVER",
        senderId: staffId,
        senderName: displayName,
        senderRole,
        message: text || "(image sent to guest)",
        attachment: pendingFile,
        attachmentName: pendingFile?.name,
        isDirectSpecialist: true,
      });
    }

    if (saved && primaryChannel === "CUSTOMER" && !postingDirect) {
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
              assigned_agent: staffName || displayName || "",
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
      setPendingFile(null);
      setMessages((prev) =>
        prev.some((m) => m.id === saved.id) ? prev : [...prev, saved]
      );
    }
  };

  if (!pnrKey) return null;

  const isDirectEnabled =
    channel === "TICKETS" ? ticketerDirect : driverDirect;

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
        <div
          className={`fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0A1017] shadow-2xl transition-all duration-200 ${COMMS_WINDOW_SIZE_CLASSES[windowSize]}`}
        >
          <div className="space-y-2 border-b border-white/10 bg-[#0D1117] px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="min-w-0 truncate text-[11px] font-bold tracking-wider text-[#F6A724] uppercase">
                Comms Hub · {pnrKey}
              </h4>
              <div className="flex shrink-0 items-center gap-1">
                {(
                  [
                    { id: "compact", label: "Small", title: "Compact view" },
                    { id: "half", label: "Half", title: "Half screen" },
                    { id: "full", label: "Full", title: "Full screen" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    title={opt.title}
                    onClick={() => setWindowSize(opt.id)}
                    className={`rounded px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase transition ${
                      windowSize === opt.id
                        ? "bg-[#075473] text-white"
                        : "bg-white/5 text-gray-400 hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="ml-1 rounded-md p-1 text-zinc-400 hover:bg-white/5 hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-1 rounded-xl border border-white/5 bg-black/40 p-1 text-[10px] font-bold">
              {channelMeta.map((ch) => {
                const access = channelAccess[ch.id];
                const allowed = access !== "none";
                const active = channel === ch.id;
                const n = channelUnread[ch.id] || 0;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    disabled={!allowed}
                    onClick={() => allowed && setChannel(ch.id)}
                    title={
                      allowed
                        ? `${ch.label}${access === "view" ? " (view only)" : ""}`
                        : `Restricted — ${ch.label}`
                    }
                    className={`relative truncate rounded-lg px-0.5 py-1.5 text-center uppercase transition-all ${
                      active
                        ? "bg-[#075473] text-white shadow"
                        : allowed
                          ? "text-gray-400 hover:text-white"
                          : "cursor-not-allowed text-gray-700 opacity-40"
                    }`}
                  >
                    {ch.short}
                    {n > 0 && allowed ? (
                      <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-red-500" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {(channel === "TICKETS" || channel === "DRIVER") &&
          canToggleDirect ? (
            <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-[#0D1117] px-3 py-2.5">
              <div className="min-w-0 space-y-0.5">
                <div className="text-[10px] font-bold tracking-wider text-[#F6A724] uppercase">
                  {channel === "TICKETS"
                    ? "Ticketer Direct Chat"
                    : "Driver Direct Chat"}
                </div>
                <p className="text-[9px] text-zinc-400">
                  {isDirectEnabled
                    ? "Specialist can reply directly to the guest."
                    : "Messages are internal-only. Toggle ON to allow guest direct chat."}
                </p>
              </div>
              <button
                type="button"
                disabled={toggling}
                onClick={() => void handleToggleDirect()}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase transition ${
                  isDirectEnabled
                    ? channel === "TICKETS"
                      ? "bg-purple-600 text-white shadow-[0_0_12px_rgba(139,92,246,0.5)]"
                      : "bg-cyan-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.5)]"
                    : "border border-white/10 bg-zinc-800 text-zinc-400"
                }`}
              >
                {isDirectEnabled ? "Direct chat ON ✓" : "Direct chat OFF"}
              </button>
            </div>
          ) : null}

          {specialistDirectActive &&
          (role === "ticketer" || role === "driver") ? (
            <p className="border-b border-white/5 bg-purple-950/30 px-3 py-1.5 text-[9px] text-purple-200">
              Direct chat is ON — your replies go to the guest (and stay visible
              to Concierge on CUST).
            </p>
          ) : null}

          <div
            ref={feedRef}
            className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#05080C] p-3"
          >
            {!canView ? (
              <div className="flex h-full items-center justify-center p-4 text-center text-[11px] text-gray-500">
                Restricted channel. Your role cannot access {activeChannelLabel}.
              </div>
            ) : visible.length === 0 ? (
              <p className="py-8 text-center text-[11px] text-zinc-600">
                No messages yet — say hello on {activeChannelLabel}.
              </p>
            ) : (
              visible.map((msg) => {
                const mine = isMineBubble(staffId, msg.sender_id);
                const parsed = parseGuestMessageTopic(msg.message);
                const topic =
                  String(msg.topic || "").trim().toUpperCase() ||
                  parsed.topic ||
                  null;
                const showForwardFromGuest =
                  canForwardDepts &&
                  channel === "CUSTOMER" &&
                  isCustomerSender(String(msg.sender_role || ""));
                const showForwardToGuest =
                  canForwardToGuest &&
                  channel !== "CUSTOMER" &&
                  !isCustomerSender(String(msg.sender_role || ""));
                return (
                  <div key={msg.id} className="space-y-1">
                    <ChatMessageItem
                      isOpsView
                      isMine={mine}
                      opsBadgeOverride={
                        channel === "OPS"
                          ? opsInternalSenderBadge(msg, opsTabShort)
                          : null
                      }
                      message={{
                        id: msg.id,
                        body: msg.message,
                        authorName: msg.sender_name,
                        senderRole: String(msg.sender_role || ""),
                        imageUrl: msg.attachmentUrl,
                        isDirectSpecialist: Boolean(msg.is_direct_specialist),
                        created: msg.created,
                        topic,
                      }}
                    />
                    {showForwardFromGuest || showForwardToGuest ? (
                      <div className="flex flex-wrap gap-1 px-1">
                        {showForwardFromGuest
                          ? FORWARD_DEPTS.filter(
                              (d) => channelAccess[d.id] === "full"
                            ).map((d) => (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() =>
                                  forwardToChannel(msg.message, d.id, {
                                    fromGuest: true,
                                    topic,
                                  })
                                }
                                className="rounded-md border border-white/15 bg-black/30 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-zinc-200 uppercase hover:border-[#F6A724]/50 hover:text-[#F6A724]"
                              >
                                → {d.short}
                              </button>
                            ))
                          : null}
                        {showForwardToGuest ? (
                          <button
                            type="button"
                            onClick={() =>
                              forwardToChannel(
                                parsed.body || msg.message,
                                "CUSTOMER"
                              )
                            }
                            className="rounded-md border border-[#F6A724]/40 bg-[#F6A724]/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-[#F6A724] uppercase hover:bg-[#F6A724]/20"
                          >
                            ↪ Forward to Guest
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          {canView ? (
            <div className="space-y-1.5 border-t border-white/10 bg-[#0D1117] p-2">
              {pendingFile ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-zinc-300">
                  <span className="truncate">📎 {pendingFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setPendingFile(null)}
                    className="text-zinc-500 hover:text-white"
                  >
                    Remove
                  </button>
                </div>
              ) : null}
              {canSend ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <GeminiAssistDrawer
                      pnr={pnrKey}
                      guestMessage={
                        channel === "CUSTOMER"
                          ? draft ||
                            [...visible]
                              .reverse()
                              .find((m) =>
                                isCustomerSender(String(m.sender_role || ""))
                              )?.message ||
                            ""
                          : draft
                      }
                      canApplyToComposer={channel === "CUSTOMER"}
                      onApplyReply={(text) => setDraft(text)}
                    />
                    {channel === "CUSTOMER" ? (
                      <span className="text-[9px] text-zinc-500">
                        AI drafts apply to CUST composer
                      </span>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setPendingFile(f);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="rounded-lg border border-white/10 bg-black/40 p-1.5 text-zinc-400 hover:text-white"
                    aria-label="Attach image"
                    title="Attach seating map / ticket image"
                  >
                    <ImagePlus className="h-4 w-4" />
                  </button>
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
                    placeholder={
                      draft.startsWith("[Forwarded") ||
                      draft.startsWith("[FORWARDED")
                        ? "Edit forwarded note, then Send…"
                        : postingHint(
                            channel,
                            opsTabShort,
                            channelMeta,
                            specialistPostingDirect
                          )
                    }
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:border-[#075473] focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={sending || (!draft.trim() && !pendingFile)}
                    onClick={() => void onSend()}
                    className="rounded-lg bg-[#075473] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#054F70] disabled:opacity-40"
                  >
                    Send
                  </button>
                  </div>
                </div>
              ) : (
                <p className="w-full py-1.5 text-center text-[10px] text-zinc-500">
                  View only — you cannot post on this channel.
                </p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function postingHint(
  channel: BookingMessageChannel,
  opsTabShort: string,
  channelMeta: Array<{ id: string; short: string }>,
  specialistDirect: boolean
): string {
  if (specialistDirect) return "Message guest (direct)…";
  if (channel === "OPS") return `Message ${opsTabShort}…`;
  return `Message ${
    channelMeta.find((c) => c.id === channel)?.short || channel
  }…`;
}
