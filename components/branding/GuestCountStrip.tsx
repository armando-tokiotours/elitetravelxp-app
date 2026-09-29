"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  GUEST_PARTY_ADULTS,
  GUEST_PARTY_CHICK_SRC,
} from "@/lib/guestPartyLayout";

/** Guest-stepper strip only — does not change Pre-Elite party assets. */
const MAIN_ADULT_SRC = "/brand/mascot-point.webp";
const STRIP_DUCK_SRC = "/brand/guest-duck.webp";

/**
 * Inline guest characters beside Adults / Kids steppers.
 * Adults: 1 large pointing main + smaller party animals as count rises
 * (full-body duck here, not peek). Kids: chicks @ 1.8× prior size.
 */
export function GuestCountStrip({
  kind,
  count,
}: {
  kind: "adults" | "kids";
  count: number;
}) {
  if (kind === "kids") {
    const n = Math.max(0, Math.min(4, Math.round(count) || 0));
    if (n === 0) {
      return <div className="min-w-0 flex-1" aria-hidden />;
    }
    return (
      <div
        className="flex min-w-0 flex-1 items-end justify-start gap-0.5 overflow-visible px-1"
        aria-hidden
      >
        <AnimatePresence initial={false}>
          {Array.from({ length: n }, (_, i) => (
            <motion.img
              key={`chick-${i}`}
              src={GUEST_PARTY_CHICK_SRC}
              alt=""
              initial={{ opacity: 0, scale: 0.8, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.2 }}
              className="h-[3.15rem] w-auto shrink-0 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)]"
              draggable={false}
            />
          ))}
        </AnimatePresence>
      </div>
    );
  }

  const n = Math.max(1, Math.min(6, Math.round(count) || 1));
  const companions = GUEST_PARTY_ADULTS.filter((a) => n >= a.minAdults);

  return (
    <div
      className="flex min-w-0 flex-1 items-end justify-start gap-0.5 overflow-visible px-1"
      aria-hidden
    >
      <AnimatePresence initial={false}>
        <motion.img
          key="main-adult"
          src={MAIN_ADULT_SRC}
          alt=""
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="h-9 w-auto shrink-0 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)]"
          draggable={false}
        />
        {companions.map((a) => (
          <motion.img
            key={a.id}
            src={a.id === "duck" ? STRIP_DUCK_SRC : a.src}
            alt=""
            initial={{ opacity: 0, scale: 0.8, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.2 }}
            className="h-6 w-auto shrink-0 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)]"
            draggable={false}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
