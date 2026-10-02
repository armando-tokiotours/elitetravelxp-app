"use client";

import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { useConciergeAgentName } from "@/lib/useConciergeAgentName";
import { showSystemMessage } from "@/store/useSystemMessageStore";
import { getSystemMessage } from "@/lib/systemMessages";

/**
 * Floating guest talk bubble (same look as Ops Comms Hub FAB).
 * Opens /comm only when a concierge agent is assigned; otherwise shows the fox tip.
 */
export function GuestTalkBubble({
  pnr,
  guestEmail,
  guestName,
  tripPath,
}: {
  pnr: string;
  guestEmail?: string;
  guestName?: string;
  /** Base itinerary path, e.g. /builder-single/itinerary */
  tripPath: string;
}) {
  const router = useRouter();
  const ref = String(pnr || "").trim();
  const agentName = useConciergeAgentName(ref);
  const assigned = Boolean(agentName && agentName.trim());

  if (!ref || ref === "—" || ref.includes("····")) return null;

  const handleClick = () => {
    if (!assigned) {
      showSystemMessage({
        text: getSystemMessage("guest_comm_needs_agent"),
        tone: "info",
      });
      return;
    }
    const base = tripPath.replace(/\/$/, "");
    const qs = new URLSearchParams({
      pnr: ref,
      guestEmail: guestEmail || "",
      guestName: guestName || "",
    });
    router.push(`${base}/comm?${qs.toString()}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="no-print fixed right-5 bottom-48 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#1CA67F] text-white shadow-2xl transition hover:bg-[#178f6c] active:scale-95 md:bottom-32 lg:right-8"
      aria-label={
        assigned
          ? `Chat with ${agentName}`
          : "Talk to your TokioTours agent"
      }
      title={
        assigned
          ? `Chat with ${agentName}`
          : "Agent required to open chat"
      }
    >
      <MessageCircle className="h-6 w-6" aria-hidden />
      {!assigned ? (
        <span
          className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0D1117] bg-amber-400"
          aria-hidden
        />
      ) : null}
    </button>
  );
}
