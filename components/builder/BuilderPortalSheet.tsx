"use client";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/**
 * Bottom-sheet / modal portal mounted on document.body at z-[100]
 * so it stacks above sticky CTA (z-30) and BottomNav (z-40),
 * escaping SectionBlock overflow / Framer Motion stacking contexts.
 */
export function BuilderPortalSheet({
  open,
  onClose,
  title,
  children,
  maxWidthClass = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidthClass?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        className={`relative z-[1] max-h-[min(90vh,40rem)] w-full overflow-y-auto rounded-t-3xl bg-zinc-900 p-6 pb-32 shadow-xl sm:rounded-3xl sm:pb-8 ${maxWidthClass}`}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 className="font-display text-2xl text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full bg-[#0B1F3A] px-4 py-1.5 text-sm font-semibold text-white"
          >
            Done
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
