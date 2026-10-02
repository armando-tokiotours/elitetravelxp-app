"use client";

import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useModalDismiss } from "@/hooks/useModalDismiss";

export type BuilderEditMaxWidth =
  | "max-w-md"
  | "max-w-lg"
  | "max-w-xl"
  | "max-w-2xl"
  | "max-w-3xl";

/**
 * Web desktop safe-space frame for builder edit overlays.
 * Mobile: edge-to-edge. sm+: centered column with side gutters + vertical inset.
 */
export function BuilderDesktopEditFrame({
  children,
  zClass = "z-50",
  maxWidth = "max-w-lg",
  className = "",
  role,
  "aria-label": ariaLabel,
  "aria-modal": ariaModal,
}: {
  children: ReactNode;
  zClass?: string;
  maxWidth?: BuilderEditMaxWidth;
  className?: string;
  role?: string;
  "aria-label"?: string;
  "aria-modal"?: boolean | "true" | "false";
}) {
  return (
    <div
      className={`fixed inset-0 ${zClass} flex items-center justify-center bg-[#05080C]/85 p-0 backdrop-blur-md sm:p-4`}
      role={role}
      aria-modal={ariaModal}
      aria-label={ariaLabel}
    >
      <div
        className={`relative flex h-full w-full flex-col overflow-hidden bg-[#0A1017] shadow-2xl sm:h-[min(92vh,920px)] sm:rounded-3xl sm:border sm:border-white/10 ${maxWidth} ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Full-viewport (mobile) / safe-framed (desktop web) Builder S / M / E edit overlay.
 * Sticky ← + title at top; scrollable body underneath.
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
  maxWidth = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  mounted?: boolean;
  zClass?: string;
  maxWidth?: BuilderEditMaxWidth;
}) {
  useModalDismiss(open, onClose);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key={`builder-edit-${title}`}
          className={`fixed inset-0 ${zClass} flex items-center justify-center bg-[#05080C]/85 p-0 backdrop-blur-md sm:p-4`}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <motion.div
            className={`relative flex h-full w-full flex-col overflow-hidden bg-[#0A1017] shadow-2xl sm:h-[min(92vh,920px)] sm:rounded-3xl sm:border sm:border-white/10 ${maxWidth}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <header className="sticky top-0 z-20 flex w-full shrink-0 items-center gap-3 border-b border-white/10 bg-[#0A1017]/95 px-4 py-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] backdrop-blur-md sm:rounded-t-3xl">
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
              <div className="shrink-0 border-t border-white/10 bg-[#0A1017]/95 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-b-3xl">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
