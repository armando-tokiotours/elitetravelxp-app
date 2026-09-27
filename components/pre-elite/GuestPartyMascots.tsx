"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  GUEST_PARTY_ADULTS,
  GUEST_PARTY_CHICK_SRC,
  GUEST_PARTY_LAYOUT_DEFAULTS,
  GUEST_PARTY_LAYOUT_EVENT,
  GUEST_PARTY_LAYOUT_LOCAL_KEY,
  mergeGuestPartyLayout,
  readGuestPartyLayoutLocal,
  slotToStyle,
  writeGuestPartyLayoutLocal,
  type GuestPartyLayout,
} from "@/lib/guestPartyLayout";

/**
 * Guest-count characters behind the Pre-Elite hero mascot (Step 5).
 * Main kid/mascot is rendered separately — do not replace his animations.
 *
 * Adults (cap 6): Duck-peek → Shiba → Cat → Red Panda → Panda
 * Kids (cap 3 chicks, in front)
 *
 * Positions come from Team Access → Layout Builder (config/guestPartyLayout.json).
 */

export function GuestPartyMascots({
  adults,
  children,
  visible,
}: {
  adults: number;
  children: number;
  visible: boolean;
}) {
  const [layout, setLayout] = useState<GuestPartyLayout>(() => {
    const local = readGuestPartyLayoutLocal();
    return local ?? structuredClone(GUEST_PARTY_LAYOUT_DEFAULTS);
  });

  useEffect(() => {
    let cancelled = false;

    const apply = (raw: unknown, broadcast = false) => {
      const next = mergeGuestPartyLayout(raw);
      if (!cancelled) {
        setLayout(next);
        writeGuestPartyLayoutLocal(next, { broadcast });
      }
    };

    (async () => {
      try {
        const res = await fetch("/api/admin/guest-party-layout");
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
      if (e.key === GUEST_PARTY_LAYOUT_LOCAL_KEY && e.newValue) {
        try {
          apply(JSON.parse(e.newValue), false);
        } catch {
          /* ignore */
        }
      }
    };

    window.addEventListener(GUEST_PARTY_LAYOUT_EVENT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener(GUEST_PARTY_LAYOUT_EVENT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const adultCount = Math.max(1, Math.min(20, Math.round(adults) || 1));
  const kidCount = Math.max(0, Math.min(3, Math.round(children) || 0));

  const adultsShown = GUEST_PARTY_ADULTS.filter((a) => adultCount >= a.minAdults);
  const chicks = Array.from({ length: kidCount }, (_, i) => i);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-[78%] max-w-[24rem] select-none sm:w-[74%] sm:max-w-[28rem]"
      aria-hidden
    >
      <AnimatePresence initial={false}>
        {adultsShown.map((a) => {
          const slot = layout.adults[a.id];
          return (
            <motion.img
              key={a.id}
              src={a.src}
              alt=""
              initial={{ opacity: 0, x: 14, scale: 0.94 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.92 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="absolute object-contain object-bottom drop-shadow-[0_8px_16px_rgba(0,0,0,0.45)]"
              style={slotToStyle(slot)}
            />
          );
        })}
        {chicks.map((i) => {
          const slot = layout.chicks[i];
          return (
            <motion.img
              key={`chick-${i}`}
              src={GUEST_PARTY_CHICK_SRC}
              alt=""
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="absolute object-contain object-bottom drop-shadow-[0_6px_12px_rgba(0,0,0,0.4)]"
              style={slotToStyle(slot)}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}
