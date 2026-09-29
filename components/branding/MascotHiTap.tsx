"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { HI_BUBBLE_PATH } from "@/lib/brandCharacters";

const HI_BUBBLE = HI_BUBBLE_PATH;
const BUBBLE_MS = 2500;

export function useMascotHiTap() {
  const [showHi, setShowHi] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const triggerHi = useCallback(
    (e?: MouseEvent | KeyboardEvent) => {
      e?.stopPropagation();
      e?.preventDefault();
      setShowHi(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setShowHi(false), BUBBLE_MS);
    },
    []
  );

  return { showHi, triggerHi };
}

export function HiBubble({
  show,
  className = "",
  srcOverride,
}: {
  show: boolean;
  className?: string;
  /** Cache-busted preview URL in Team Access. */
  srcOverride?: string;
}) {
  return (
    <AnimatePresence>
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <motion.img
          key="hi-bubble"
          src={srcOverride || HI_BUBBLE}
          alt=""
          aria-hidden
          initial={{ opacity: 0, scale: 0.72, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.88, y: 4 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={`pointer-events-none absolute z-30 w-[5.5rem] origin-bottom-right select-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)] sm:w-[6.5rem] ${className}`}
          draggable={false}
        />
      ) : null}
    </AnimatePresence>
  );
}

/** Zoom pulse while the HI bubble is visible. */
export function MascotHiZoom({
  showHi,
  children,
  className = "",
}: {
  showHi: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.span
      className={`relative inline-block h-full ${className}`}
      animate={showHi ? { scale: [1, 1.14, 1] } : { scale: 1 }}
      transition={{ duration: 0.45, times: [0, 0.4, 1], ease: "easeInOut" }}
      style={{ transformOrigin: "bottom center" }}
    >
      {children}
    </motion.span>
  );
}
