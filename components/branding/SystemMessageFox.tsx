"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  useSystemMessageStore,
  type SystemMessageTone,
} from "@/store/useSystemMessageStore";

const CHAR_SPLIT = 48;

/**
 * Fox-peek + stroked speech text (no comic bubble).
 * Long copy splits into two pops; duration stays readable.
 * Portaled to body so desktop AppNavDock (z-40) cannot cover it.
 */
const FOX_SRC_LEFT = "/brand/fox-peek.webp";
const FOX_SRC_RIGHT = "/brand/fox-peek-right.png";

export function SystemMessageFox() {
  const message = useSystemMessageStore((s) => s.message);
  const dismiss = useSystemMessageStore((s) => s.dismiss);
  const [mounted, setMounted] = useState(false);

  const parts = useMemo(
    () => (message ? splitSpeech(message.text) : []),
    [message]
  );

  const [partIndex, setPartIndex] = useState(0);
  const foxSrc =
    message?.foxSrc ||
    (message?.side === "right" ? FOX_SRC_RIGHT : FOX_SRC_LEFT);
  const side = message?.side ?? "left";

  useEffect(() => {
    setMounted(true);
  }, []);

  // Warm fox images as soon as the shell mounts (don't wait for first tip)
  useEffect(() => {
    const left = new window.Image();
    left.src = FOX_SRC_LEFT;
    const right = new window.Image();
    right.src = FOX_SRC_RIGHT;
  }, []);

  useEffect(() => {
    setPartIndex(0);
  }, [message?.id]);

  useEffect(() => {
    if (!message || parts.length === 0) return;
    // Second bubble pops in quickly; last bubble still holds long enough to read
    const betweenBubblesMs = 500;
    const holdLastMs = Math.max(
      3000,
      Math.floor(message.durationMs / parts.length)
    );
    if (partIndex < parts.length - 1) {
      const t = window.setTimeout(
        () => setPartIndex((i) => i + 1),
        betweenBubblesMs
      );
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => dismiss(), holdLastMs);
    return () => window.clearTimeout(t);
  }, [message, parts.length, partIndex, dismiss]);

  const visibleParts = parts.slice(0, partIndex + 1);
  const tone = message?.tone ?? "info";
  // Clear AppNavDock w-16 on sm+ (left); keep flush on mobile
  const shellClass =
    side === "right"
      ? "pointer-events-none fixed bottom-[5.75rem] right-0 z-[95] w-[min(62vw,18.85rem)] max-w-[18.85rem] sm:bottom-28 sm:w-[min(55vw,19.5rem)]"
      : "pointer-events-none fixed bottom-[5.75rem] left-0 z-[95] w-[min(62vw,18.85rem)] max-w-[18.85rem] sm:bottom-28 sm:left-16 sm:w-[min(55vw,19.5rem)]";

  const node = (
    <div className={shellClass} aria-live="polite">
      <AnimatePresence mode="wait">
        {message ? (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, x: side === "right" ? 18 : -18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: side === "right" ? 12 : -12 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className={`relative flex flex-col ${
              side === "right" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`relative z-10 -mb-3 flex w-[calc(100%-2.25rem)] flex-col gap-2 ${
                side === "right"
                  ? "mr-10 items-end"
                  : "ml-10 items-start"
              }`}
            >
              <AnimatePresence initial={false}>
                {visibleParts.map((text, i) => {
                  return (
                    <motion.button
                      key={`${message.id}-p${i}`}
                      type="button"
                      initial={{ opacity: 0, scale: 0.72, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.88, y: 6 }}
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 22,
                        delay: 0.04,
                      }}
                      onClick={dismiss}
                      className="pointer-events-auto relative max-w-full cursor-pointer text-left"
                      aria-label={text}
                    >
                      <FoxStrokeSpeech tone={tone}>{text}</FoxStrokeSpeech>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>

            <motion.img
              src={foxSrc}
              alt=""
              aria-hidden
              draggable={false}
              initial={{ x: side === "right" ? 28 : -28, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: side === "right" ? 20 : -20, opacity: 0 }}
              transition={{ duration: 0.32, ease: "easeOut" }}
              className={`pointer-events-none h-[9.425rem] w-auto select-none object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.5)] sm:h-[10.4rem] ${
                side === "right"
                  ? "-mr-1 object-right-bottom"
                  : "-ml-1 object-left-bottom"
              }`}
            />
          </motion.div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- keep fox decoded off-screen for first tip
          <img
            src={FOX_SRC_LEFT}
            alt=""
            aria-hidden
            className="pointer-events-none absolute h-0 w-0 opacity-0"
          />
        )}
      </AnimatePresence>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(node, document.body);
}

function FoxStrokeSpeech({
  children,
  tone,
}: {
  children: string;
  tone: SystemMessageTone;
}) {
  const fill = toneFill(tone);
  const lines = wrapWordsPerLine(children, 4);

  return (
    <p
      className="relative max-w-full whitespace-pre-line text-left text-[1.05rem] font-black leading-snug tracking-wide"
      style={{
        fontFamily: 'Verdana, Geneva, sans-serif',
        color: fill,
        WebkitTextStroke: "8px #ffffff",
        paintOrder: "stroke fill",
        textShadow:
          "0 2px 0 rgba(255,255,255,0.95), 0 4px 12px rgba(0,0,0,0.45)",
      }}
    >
      {lines.join("\n")}
    </p>
  );
}

function toneFill(tone: SystemMessageTone): string {
  if (tone === "error") return "#E60F43";
  if (tone === "tip") return "#075473";
  return "#1a1510";
}

/** Max 3–4 words per visual line inside a bubble. */
export function wrapWordsPerLine(text: string, maxWords = 4): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    lines.push(words.slice(i, i + maxWords).join(" "));
  }
  return lines;
}

/** Split long speech into ≤2 readable chunks at word boundaries. */
export function splitSpeech(text: string): string[] {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= CHAR_SPLIT) return [t];

  const soft = Math.min(CHAR_SPLIT + 12, t.length);
  let cut = -1;
  for (
    let i = Math.min(soft, t.length - 1);
    i >= Math.floor(CHAR_SPLIT * 0.55);
    i--
  ) {
    if (t[i] === " " || t[i] === "." || t[i] === "," || t[i] === "!") {
      cut = t[i] === " " ? i : i + 1;
      break;
    }
  }
  if (cut <= 0) cut = CHAR_SPLIT;
  const a = t.slice(0, cut).trim();
  const b = t.slice(cut).trim();
  if (!b) return [a];
  return [a, b];
}
