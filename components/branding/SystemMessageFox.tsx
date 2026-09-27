"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import {
  useSystemMessageStore,
  type SystemMessageTone,
} from "@/store/useSystemMessageStore";

/**
 * Fox-peek + Japanese-style speech bubble for system messages.
 * Anchored bottom-left (red zone) — stays above BottomNav, left strip only.
 */
export function SystemMessageFox() {
  const message = useSystemMessageStore((s) => s.message);
  const dismiss = useSystemMessageStore((s) => s.dismiss);

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => dismiss(), message.durationMs);
    return () => window.clearTimeout(t);
  }, [message, dismiss]);

  return (
    <div
      className="pointer-events-none fixed bottom-[5.75rem] left-0 z-[70] w-[min(46vw,13.5rem)] max-w-[13.5rem] sm:bottom-28 sm:w-[min(40vw,14rem)]"
      aria-live="polite"
    >
      <AnimatePresence mode="wait">
        {message ? (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="relative flex flex-col items-start"
          >
            {/* Bubble — Japanese comic style, zoom in */}
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.72, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: 6 }}
              transition={{
                type: "spring",
                stiffness: 420,
                damping: 22,
                delay: 0.06,
              }}
              onClick={dismiss}
              className={
                "pointer-events-auto relative z-10 ml-9 mb-0 max-h-[8.5rem] w-[calc(100%-2rem)] cursor-pointer overflow-y-auto rounded-[1.35rem] border-[3.5px] px-3.5 py-3 text-left shadow-[0_10px_28px_rgba(0,0,0,0.5)] " +
                bubbleTone(message.tone)
              }
            >
              <p className="text-[0.8rem] font-bold leading-snug tracking-wide text-[#1a1510]">
                {message.text}
              </p>
              {/* Comic tail toward fox (filled + outline) */}
              <span
                aria-hidden
                className={
                  "absolute -bottom-[9px] left-4 h-3.5 w-3.5 rotate-45 border-b-[3.5px] border-r-[3.5px] " +
                  tailTone(message.tone)
                }
              />
            </motion.button>

            {/* Fox peek from left */}
            <motion.img
              src="/brand/fox-peek.png"
              alt=""
              aria-hidden
              draggable={false}
              initial={{ x: -28, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.32, ease: "easeOut" }}
              className="pointer-events-none -ml-1 h-[7.25rem] w-auto select-none object-contain object-left-bottom drop-shadow-[0_10px_18px_rgba(0,0,0,0.5)] sm:h-[8rem]"
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function bubbleTone(tone: SystemMessageTone): string {
  if (tone === "error") {
    return "border-[#E60F43] bg-[#FFF5F7]";
  }
  if (tone === "tip") {
    return "border-[#F6A724] bg-[#FFFBF0]";
  }
  return "border-[#1a1510] bg-white";
}

function tailTone(tone: SystemMessageTone): string {
  if (tone === "error") return "border-[#E60F43] bg-[#FFF5F7]";
  if (tone === "tip") return "border-[#F6A724] bg-[#FFFBF0]";
  return "border-[#1a1510] bg-white";
}
