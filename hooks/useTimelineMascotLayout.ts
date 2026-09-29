"use client";

import { useEffect, useState } from "react";
import {
  TIMELINE_MASCOT_LAYOUT_DEFAULTS,
  TIMELINE_MASCOT_LAYOUT_EVENT,
  TIMELINE_MASCOT_LAYOUT_LOCAL_KEY,
  mergeTimelineMascotLayout,
  readTimelineMascotLayoutLocal,
  writeTimelineMascotLayoutLocal,
  type TimelineMascotLayout,
  type TimelineMascotRowLayout,
} from "@/lib/timelineMascotLayout";

/**
 * Live timeline mascot layout for Builder M / S progress bars.
 * Loads from API + localStorage; listens for Team Access saves.
 */
export function useTimelineMascotLayout(
  variant: "multi" | "single"
): TimelineMascotRowLayout {
  const [layout, setLayout] = useState<TimelineMascotLayout>(() => {
    const local = readTimelineMascotLayoutLocal();
    return local ?? structuredClone(TIMELINE_MASCOT_LAYOUT_DEFAULTS);
  });

  useEffect(() => {
    let cancelled = false;

    const apply = (raw: unknown, broadcast = false) => {
      const next = mergeTimelineMascotLayout(raw);
      if (!cancelled) {
        setLayout(next);
        writeTimelineMascotLayoutLocal(next, { broadcast });
      }
    };

    void (async () => {
      try {
        const res = await fetch("/api/admin/timeline-mascot-layout", {
          cache: "no-store",
        });
        const data = await res.json();
        if (data?.layout) apply(data.layout, false);
      } catch {
        /* keep local / defaults */
      }
    })();

    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) apply(detail, false);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === TIMELINE_MASCOT_LAYOUT_LOCAL_KEY && e.newValue) {
        try {
          apply(JSON.parse(e.newValue), false);
        } catch {
          /* ignore */
        }
      }
    };

    window.addEventListener(TIMELINE_MASCOT_LAYOUT_EVENT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener(TIMELINE_MASCOT_LAYOUT_EVENT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return layout[variant];
}
