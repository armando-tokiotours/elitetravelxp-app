"use client";

import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useModalDismiss } from "@/hooks/useModalDismiss";

/**
 * Full-viewport, top-pinned Builder S / M edit overlay.
 * Sticky ← + title at top-0; scrollable body underneath.
 */
export function BuilderEditModalShell({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  mounted = true,
  zClass = "z-50",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  mounted?: boolean;
  zClass?: string;
}) {
  useModalDismiss(open, onClose);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key={`builder-edit-${title}`}
          className={`fixed inset-0 ${zClass} flex flex-col bg-[#0A1017]`}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <header className="sticky top-0 z-20 flex w-full shrink-0 items-center gap-3 border-b border-white/10 bg-[#0A1017]/95 px-4 py-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] backdrop-blur-md">
            <button
              type="button"
              onClick={onClose}
              aria-label="Back"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              {eyebrow ? (
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#075473]">
                  {eyebrow}
                </p>
              ) : null}
              <h3 className="truncate font-godiva text-base uppercase tracking-wider text-white">
                {title}
              </h3>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-24">
            {children}
          </div>

          {footer ? (
            <div className="shrink-0 border-t border-white/10 bg-[#0A1017]/95 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
