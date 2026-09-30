"use client";

import { useEffect, useState } from "react";

/** Client: load assigned guide/driver names for a PNR from ops_dispatch API. */
export function useOpsStaffNames(pnr: string | null | undefined): {
  guideName: string | null;
  driverName: string | null;
} {
  const [guideName, setGuideName] = useState<string | null>(null);
  const [driverName, setDriverName] = useState<string | null>(null);

  useEffect(() => {
    const ref = String(pnr || "").trim().toUpperCase();
    if (!ref || ref.startsWith("TMP-") || ref === "—") {
      setGuideName(null);
      setDriverName(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/bookings/ops-staff?pnr=${encodeURIComponent(ref)}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          guide?: string | null;
          driver?: string | null;
        };
        if (!cancelled) {
          setGuideName(String(data.guide || "").trim() || null);
          setDriverName(String(data.driver || "").trim() || null);
        }
      } catch {
        if (!cancelled) {
          setGuideName(null);
          setDriverName(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pnr]);

  return { guideName, driverName };
}
