"use client";

import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";

/**
 * Fox confirmation card: fox LEFT + message RIGHT (flex row), then actions.
 * Used for Discover city gates and similar fox confirm windows.
 */
export function FoxConfirmModal({
  open,
  title,
  body,
  primaryLabel,
  secondaryLabel,
  cancelLabel = "Cancel",
  onPrimary,
  onSecondary,
  onCancel,
  ariaLabel,
}: {
  open: boolean;
  title: string;
  body: string;
  primaryLabel: string;
  secondaryLabel?: string;
  cancelLabel?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
  onCancel: () => void;
  ariaLabel?: string;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="fox-confirm"
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 px-4 pb-8 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel || title}
        >
          <motion.div
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-[#0D1117] p-5 shadow-2xl"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
          >
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/fox-peek.webp"
                alt=""
                className="h-28 w-auto shrink-0 object-contain object-left"
                draggable={false}
              />
              <div className="min-w-0 flex-1 text-left">
                <p className="font-godiva text-lg uppercase leading-snug tracking-wide text-white">
                  {title}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  {body}
                </p>
              </div>
            </div>

            <div
              className={`mt-5 grid gap-2 ${
                secondaryLabel ? "grid-cols-2" : "grid-cols-1"
              }`}
            >
              <button
                type="button"
                className="rounded-xl bg-[#075473] px-3 py-3 text-xs font-bold uppercase tracking-wider text-white"
                onClick={onPrimary}
              >
                {primaryLabel}
              </button>
              {secondaryLabel && onSecondary ? (
                <button
                  type="button"
                  className="rounded-xl border border-white/20 bg-black/40 px-3 py-3 text-xs font-bold uppercase tracking-wider text-white"
                  onClick={onSecondary}
                >
                  {secondaryLabel}
                </button>
              ) : null}
            </div>
            <button
              type="button"
              className="mt-3 w-full text-center text-[11px] text-zinc-500 underline"
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
