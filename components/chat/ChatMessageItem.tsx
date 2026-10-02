"use client";

import { parseGuestMessageTopic } from "@/lib/chatTopics";
import { opsDirectBadge, guestFacingStaffLabel } from "@/lib/specialistDirectChat";

export type ChatBubbleMessage = {
  id: string;
  body: string;
  authorRole?: string;
  authorName?: string;
  senderRole?: string;
  imageUrl?: string | null;
  isDirectSpecialist?: boolean;
  created?: string;
  topic?: string | null;
};

function formatMsgTime(raw?: string): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Shared chat bubble — Ops sees colored specialist badges; guests see brand titles.
 */
export function ChatMessageItem({
  message,
  isOpsView = false,
  isMine = false,
  opsBadgeOverride,
}: {
  message: ChatBubbleMessage;
  isOpsView?: boolean;
  isMine?: boolean;
  opsBadgeOverride?: string | null;
}) {
  const role = String(
    message.senderRole || message.authorRole || ""
  ).toUpperCase();
  const isGuest =
    role === "CUSTOMER" ||
    String(message.authorRole || "").toLowerCase() === "guest";

  const parsed = parseGuestMessageTopic(message.body);
  const topic =
    String(message.topic || "").trim().toUpperCase() || parsed.topic || null;
  const text = parsed.body || message.body;

  const specialistDirect =
    Boolean(message.isDirectSpecialist) &&
    (role === "TICKETS" || role === "DRIVER");

  const badge = !isGuest && isOpsView
    ? specialistDirect
      ? opsDirectBadge(role, true)
      : role === "TICKETS"
        ? {
            label: "TICKETER",
            className:
              "border-purple-500/30 bg-purple-500/10 text-purple-300/80",
            bubbleClass: "bg-white/10 text-zinc-200",
          }
        : role === "DRIVER"
          ? {
              label: "DRIVER",
              className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300/80",
              bubbleClass: "bg-white/10 text-zinc-200",
            }
          : opsDirectBadge(role, false) ||
            (opsBadgeOverride
              ? {
                  label: opsBadgeOverride,
                  className: "border-white/20 bg-white/10 text-zinc-300",
                  bubbleClass: isMine
                    ? "bg-[#075473] text-white"
                    : "bg-white/10 text-zinc-200",
                }
              : {
                  label: "CONCIERGE",
                  className:
                    "border-[#075473] bg-[#075473]/30 text-cyan-200",
                  bubbleClass: "bg-[#075473] text-white",
                })
    : null;

  const guestLabel = isGuest
    ? "You"
    : guestFacingStaffLabel(role, message.authorName);

  let bubbleCls: string;
  if (!isOpsView) {
    bubbleCls = isGuest ? "ml-6 bg-[#075473]/30" : "mr-6 bg-zinc-900";
  } else if (isGuest) {
    bubbleCls = "mr-auto rounded-bl-sm bg-white/10 text-zinc-200";
  } else if (specialistDirect && badge?.bubbleClass) {
    bubbleCls = `ml-auto rounded-br-sm ${badge.bubbleClass}`;
  } else if (isMine) {
    bubbleCls = "ml-auto rounded-br-sm bg-[#075473] text-white";
  } else {
    bubbleCls = "mr-auto rounded-bl-sm bg-white/10 text-zinc-200";
  }

  return (
    <div className={`max-w-[90%] rounded-xl px-2.5 py-2 text-xs sm:text-sm ${bubbleCls}`}>
      <p className="mb-0.5 flex flex-wrap items-center justify-between gap-2 text-[9px] tracking-wide text-zinc-400 uppercase sm:text-[10px]">
        <span className="inline-flex flex-wrap items-center gap-1">
          {isOpsView && badge ? (
            <span
              className={`rounded border px-1.5 py-0.5 font-bold tracking-wider ${badge.className}`}
            >
              [{badge.label}]
            </span>
          ) : null}
          <span>
            {isOpsView
              ? specialistDirect
                ? message.authorName || guestLabel
                : message.authorName || guestLabel
              : guestLabel}
          </span>
          {topic ? (
            <span className="rounded-full bg-[#F6A724]/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-[#F6A724]">
              {topic}
            </span>
          ) : null}
        </span>
        <span className="font-mono normal-case opacity-70">
          {formatMsgTime(message.created)}
        </span>
      </p>
      {text && text !== "(image attachment)" ? (
        <p className="whitespace-pre-wrap break-words text-zinc-100">{text}</p>
      ) : null}
      {message.imageUrl ? (
        <a
          href={message.imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 block max-w-xs overflow-hidden rounded-xl border border-white/15"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={message.imageUrl}
            alt="Chat attachment"
            className="h-auto w-full object-cover transition hover:scale-[1.02]"
          />
        </a>
      ) : null}
    </div>
  );
}
