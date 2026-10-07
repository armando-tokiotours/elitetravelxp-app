"use client";

import { useEffect, useState } from "react";

export type ConciergeAgentClient = {
  name: string;
};

/** Client hook: resolve assigned concierge name for a PNR (in-app messaging gate). */
export function useConciergeAgent(
  pnr: string | null | undefined
): ConciergeAgentClient | null {
  const [agent, setAgent] = useState<ConciergeAgentClient | null>(null);

  useEffect(() => {
    const ref = String(pnr || "").trim();
    if (!ref || ref === "—") {
      setAgent(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/bookings/concierge-agent?pnr=${encodeURIComponent(ref)}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          agent?: {
            name?: string;
          } | null;
        };
        if (cancelled) return;
        const name = String(data.agent?.name || "").trim();
        if (!name) {
          setAgent(null);
          return;
        }
        setAgent({ name });
      } catch {
        if (!cancelled) setAgent(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pnr]);

  return agent;
}
