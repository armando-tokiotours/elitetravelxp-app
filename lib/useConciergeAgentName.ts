"use client";

import { useEffect, useState } from "react";

/** Client hook: resolve concierge agent display name for a PNR. */
export function useConciergeAgentName(pnr: string | null | undefined): string | null {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const ref = String(pnr || "").trim();
    if (!ref || ref === "—" || ref.toUpperCase().startsWith("TMP-")) {
      setName(null);
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
        const data = (await res.json()) as { agent?: { name?: string } | null };
        if (!cancelled) {
          setName(String(data.agent?.name || "").trim() || null);
        }
      } catch {
        if (!cancelled) setName(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pnr]);

  return name;
}
