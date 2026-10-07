"use client";

import { useEffect, useState } from "react";
import type { ServiceLineItem } from "@/lib/agentServices";

/**
 * Hydrate ops_hub.extras.agent_services for a PNR (guest dossier Day Services).
 * Polls lightly so Ops cart edits appear without a full reload.
 */
export function useAgentServices(
  pnr: string | null | undefined
): ServiceLineItem[] {
  const [services, setServices] = useState<ServiceLineItem[]>([]);

  useEffect(() => {
    const ref = String(pnr || "").trim();
    if (!ref || ref.startsWith("TMP-") || ref.includes("····")) {
      setServices([]);
      return;
    }
    let cancelled = false;
    const load = () => {
      void fetch(`/api/bookings/agent-services?pnr=${encodeURIComponent(ref)}`, {
        cache: "no-store",
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { services?: ServiceLineItem[] } | null) => {
          if (cancelled || !data) return;
          setServices(Array.isArray(data.services) ? data.services : []);
        })
        .catch(() => {
          /* ignore — Day Services falls back to builder flags */
        });
    };
    load();
    const t = window.setInterval(load, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [pnr]);

  return services;
}
