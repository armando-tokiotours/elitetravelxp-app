"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import {
  GUEST_PARTY_ADULTS,
  GUEST_PARTY_CHICK_SRC,
} from "@/lib/guestPartyLayout";

/** Guest-stepper strip only — does not change Pre-Elite party assets. */
const MAIN_ADULT_SRC = "/brand/mascot-point.webp";
const STRIP_DUCK_SRC = "/brand/guest-duck.webp";

const ADULT_ALT: Record<string, string> = {
  duck: "Tokiotours duck mascot",
  shiba: "Tokiotours Shiba mascot",
  cat: "Tokiotours cat mascot",
  red: "Tokiotours red panda mascot",
  panda: "Tokiotours panda mascot",
};

/**
 * Inline guest characters beside Adults / Kids steppers.
 */
export function GuestCountStrip({
  kind,
  count,
}: {
  kind: "adults" | "kids";
  count: number;
}) {
  if (kind === "kids") {
    const n = Math.max(0, Math.min(3, Math.round(count) || 0));
    if (n === 0) {
      return <div className="min-w-0 flex-1" aria-hidden />;
    }
    return (
      <div className="flex min-w-0 flex-1 items-end justify-start gap-0.5 overflow-visible px-1">
        <AnimatePresence initial={false}>
          {Array.from({ length: n }, (_, i) => (
            <motion.div
              key={`chick-${i}`}
              initial={{ opacity: 0, scale: 0.8, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.2 }}
              className="relative h-[3.15rem] w-10 shrink-0"
            >
              <Image
                src={GUEST_PARTY_CHICK_SRC}
                alt="Tokiotours chick mascot"
                width={80}
                height={80}
                sizes="50px"
                className="h-full w-auto object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)]"
                draggable={false}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  }

  const n = Math.max(1, Math.min(6, Math.round(count) || 1));
  const companions = GUEST_PARTY_ADULTS.filter((a) => n >= a.minAdults);

  return (
    <div className="flex min-w-0 flex-1 items-end justify-start gap-0.5 overflow-visible px-1">
      <AnimatePresence initial={false}>
        <motion.div
          key="main-adult"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="relative h-9 w-9 shrink-0"
        >
          <Image
            src={MAIN_ADULT_SRC}
            alt="Tokiotours guide mascot"
            width={72}
            height={72}
            priority
            sizes="36px"
            className="h-full w-auto object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)]"
            draggable={false}
          />
        </motion.div>
        {companions.map((a) => {
          const src = a.id === "duck" ? STRIP_DUCK_SRC : a.src;
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, scale: 0.8, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.2 }}
              className="relative h-6 w-6 shrink-0"
            >
              <Image
                src={src}
                alt={ADULT_ALT[a.id] || "Tokiotours guest mascot"}
                width={160}
                height={160}
                priority={a.id === "shiba"}
                sizes="24px"
                className="h-full w-auto object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)]"
                draggable={false}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
