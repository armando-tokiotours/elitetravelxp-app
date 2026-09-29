"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  useSystemMessageStore,
  type SystemMessageTone,
} from "@/store/useSystemMessageStore";

const CHAR_SPLIT = 48;

/**
 * Fox-peek + comic speech bubble(s) — sharp pointy tail toward the fox.
 * Long copy splits into two bubbles; duration stays readable.
 */
const FOX_SRC = "/brand/fox-peek.webp";

export function SystemMessageFox() {
  const message = useSystemMessageStore((s) => s.message);
  const dismiss = useSystemMessageStore((s) => s.dismiss);

  const parts = useMemo(
    () => (message ? splitSpeech(message.text) : []),
    [message]
  );

  const [partIndex, setPartIndex] = useState(0);

  // Warm fox image as soon as the shell mounts (don't wait for first tip)
  useEffect(() => {
    const img = new window.Image();
    img.src = FOX_SRC;
  }, []);

  useEffect(() => {
    setPartIndex(0);
  }, [message?.id]);

  useEffect(() => {
    if (!message || parts.length === 0) return;
    const sliceMs = Math.max(
      3000,
      Math.floor(message.durationMs / parts.length)
    );
    if (partIndex < parts.length - 1) {
      const t = window.setTimeout(() => setPartIndex((i) => i + 1), sliceMs);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => dismiss(), sliceMs);
    return () => window.clearTimeout(t);
  }, [message, parts.length, partIndex, dismiss]);

  const visibleParts = parts.slice(0, partIndex + 1);
  const tone = message?.tone ?? "info";

  return (
    <div
      className="pointer-events-none fixed bottom-[5.75rem] left-0 z-[70] w-[min(62vw,18.85rem)] max-w-[18.85rem] sm:bottom-28 sm:w-[min(55vw,19.5rem)]"
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
            <div className="relative z-10 -mb-3 ml-10 flex w-[calc(100%-2.25rem)] flex-col items-start gap-2">
              <AnimatePresence initial={false}>
                {visibleParts.map((text, i) => {
                  const isLast = i === visibleParts.length - 1;
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
                      <ComicBubble tone={tone} showTail={isLast}>
                        {text}
                      </ComicBubble>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>

            <motion.img
              src={FOX_SRC}
              alt=""
              aria-hidden
              draggable={false}
              initial={{ x: -28, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.32, ease: "easeOut" }}
              className="pointer-events-none -ml-1 h-[9.425rem] w-auto select-none object-contain object-left-bottom drop-shadow-[0_10px_18px_rgba(0,0,0,0.5)] sm:h-[10.4rem]"
            />
          </motion.div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- keep fox decoded off-screen for first tip
          <img
            src={FOX_SRC}
            alt=""
            aria-hidden
            className="pointer-events-none absolute h-0 w-0 opacity-0"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ComicBubble({
  children,
  tone,
  showTail,
}: {
  children: string;
  tone: SystemMessageTone;
  showTail: boolean;
}) {
  const { fill, stroke, ring } = toneColors(tone);
  const lines = wrapWordsPerLine(children, 4);

  return (
    <div className="relative inline-block max-w-full drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)]">
      {/* Angular comic body — tight padding, hugs text */}
      <div
        className="relative px-3.5 py-2"
        style={{
          backgroundColor: fill,
          border: `2px solid ${stroke}`,
          borderRadius: "2px",
          boxShadow: `inset 0 0 0 0.75px ${ring}`,
        }}
      >
        <p className="whitespace-pre-line text-[1rem] font-bold leading-snug tracking-wide text-[#1a1510]">
          {lines.join("\n")}
        </p>
      </div>

      {/* Separate pointy tip — gap below the box, not attached to the border */}
      {showTail ? (
        <div className="mt-2 flex justify-start pl-5" aria-hidden>
          <svg className="h-[14px] w-[21px]" viewBox="0 0 22 16">
            <path
              d="M3 0 L1 15 L18 2.5 Z"
              fill={fill}
              stroke={stroke}
              strokeWidth="1.6"
              strokeLinejoin="miter"
              strokeMiterlimit={8}
            />
          </svg>
        </div>
      ) : null}
    </div>
  );
}

function toneColors(tone: SystemMessageTone): {
  fill: string;
  stroke: string;
  ring: string;
} {
  if (tone === "error") {
    return { fill: "#FFF5F7", stroke: "#E60F43", ring: "rgba(230,15,67,0.35)" };
  }
  if (tone === "tip") {
    return { fill: "#FFFBF0", stroke: "#F6A724", ring: "rgba(246,167,36,0.4)" };
  }
  return { fill: "#FFFFFF", stroke: "#1a1510", ring: "rgba(26,21,16,0.28)" };
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
