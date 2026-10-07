"use client";

import { useConciergeAgent } from "@/lib/useConciergeAgent";

/** Client hook: resolve concierge agent display name for a PNR. */
export function useConciergeAgentName(
  pnr: string | null | undefined
): string | null {
  const agent = useConciergeAgent(pnr);
  return agent?.name || null;
}
