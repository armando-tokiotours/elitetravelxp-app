/**
 * Guest chat topic quick-pills (DRIVER / TOUR / TICKETS / PAYMENT).
 */

export type ChatTopic = "DRIVER" | "TOUR" | "TICKETS" | "PAYMENT";

export const TOPIC_PRESETS: Record<
  ChatTopic,
  { label: string; icon: string; defaultText: string }
> = {
  DRIVER: {
    label: "Driver / Chauffeur",
    icon: "🚗",
    defaultText:
      "I have a question regarding my pickup / private driver…",
  },
  TOUR: {
    label: "Tour Itinerary",
    icon: "⛩️",
    defaultText: "I would like to adjust our day plan / stops…",
  },
  TICKETS: {
    label: "Tickets & Passes",
    icon: "🎟️",
    defaultText:
      "I want to add additional tickets (e.g. Sumo, teamLab, Ghibli)…",
  },
  PAYMENT: {
    label: "Payment / Invoice",
    icon: "💳",
    defaultText:
      "I have a question about my invoice balance or deposit…",
  },
};

export const CHAT_TOPICS = Object.keys(TOPIC_PRESETS) as ChatTopic[];

const TOPIC_RE = /^\[(DRIVER|TOUR|TICKETS|PAYMENT)\]\s*/i;

export function normalizeChatTopic(raw: unknown): ChatTopic | null {
  const v = String(raw || "")
    .trim()
    .toUpperCase();
  if (v === "DRIVER" || v === "TOUR" || v === "TICKETS" || v === "PAYMENT") {
    return v;
  }
  return null;
}

/** Prefix guest body so Ops sees intent immediately. */
export function formatGuestMessageWithTopic(
  topic: ChatTopic | null | undefined,
  body: string
): string {
  const text = String(body || "").trim();
  if (!text) return "";
  const t = normalizeChatTopic(topic);
  if (!t) return text;
  if (TOPIC_RE.test(text)) return text;
  return `[${t}] ${text}`;
}

export function parseGuestMessageTopic(message: string): {
  topic: ChatTopic | null;
  body: string;
} {
  const raw = String(message || "");
  const m = raw.match(TOPIC_RE);
  if (!m) return { topic: null, body: raw };
  return {
    topic: normalizeChatTopic(m[1]),
    body: raw.slice(m[0].length).trimStart(),
  };
}
