"use client";

import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useModalDismiss } from "@/hooks/useModalDismiss";

/** Cream canvas — matches Builder S light surfaces. */
const SHELL_BG = "bg-[#faf9f4]";
const SHELL_BG_STICKY = "bg-[#faf9f4]/95";
const SHELL_BORDER = "border-black/10";
const CHROME_TITLE = "text-[#0A1017]";
const CHROME_EYEBROW = "text-[#054F70]";
const CHROME_BACK =
  "text-[#475569] transition hover:text-[#0A1017]";

export type BuilderEditMaxWidth =
  | "max-w-md"
  | "max-w-lg"
  | "max-w-xl"
  | "max-w-2xl"
  | "max-w-3xl";

export type BuilderEditVariant = "fullPage" | "dialog";

/**
 * Web desktop safe-space frame for builder edit overlays.
 * Mobile: edge-to-edge. sm+: centered column with side gutters + vertical inset.
 * Prefer `BuilderEditModalShell` with `variant="dialog"` for new call sites.
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
        className={`relative flex h-full w-full flex-col overflow-hidden ${SHELL_BG} shadow-2xl sm:h-[min(92vh,920px)] sm:rounded-3xl sm:border sm:border-black/10 ${maxWidth} ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Builder edit overlay.
 * - `fullPage` (Builder S sub-steps): opaque full-screen canvas — builder hidden,
 *   no bordered glass panel (same pattern as CityFocusModal).
 * - `dialog` (Builder M / centered): blurred backdrop + framed panel.
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
  variant = "dialog",
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
  variant?: BuilderEditVariant;
}) {
  useModalDismiss(open, onClose);

  if (!mounted || typeof document === "undefined") return null;

  const isFullPage = variant === "fullPage";

  return createPortal(
    <AnimatePresence>
      {open ? (
        isFullPage ? (
          <motion.div
            key={`builder-edit-full-${title}`}
            className={`fixed inset-0 box-border flex h-full w-full max-w-full flex-col overflow-x-hidden ${SHELL_BG} p-4 sm:p-6 ${zClass}`}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <header
              className={`relative flex w-full max-w-full shrink-0 items-center justify-between border-b ${SHELL_BORDER} pb-4 pt-[max(0.5rem,env(safe-area-inset-top))]`}
            >
              <button
                type="button"
                onClick={onClose}
                aria-label="Back"
                className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${CHROME_BACK}`}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                <span>Back</span>
              </button>
              <div className="pointer-events-none absolute inset-x-0 flex flex-col items-center px-16">
                {eyebrow ? (
                  <p
                    className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${CHROME_EYEBROW}`}
                  >
                    {eyebrow}
                  </p>
                ) : null}
                <h3
                  className={`truncate text-xs font-bold uppercase tracking-widest ${CHROME_TITLE}`}
                >
                  {title}
                </h3>
              </div>
              <div className="w-12 shrink-0" aria-hidden />
            </header>

            <div
              className={`mx-auto box-border min-h-0 w-full max-w-full flex-1 overflow-x-hidden overflow-y-auto pt-5 pb-6 ${maxWidth}`}
            >
              {children}
            </div>

            {footer ? (
              <div
                className={`mx-auto box-border w-full max-w-full shrink-0 pt-2 pb-[max(0.25rem,env(safe-area-inset-bottom))] ${maxWidth}`}
              >
                {footer}
              </div>
            ) : null}
          </motion.div>
        ) : (
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
              className={`relative flex h-full w-full flex-col overflow-hidden ${SHELL_BG} shadow-2xl sm:h-[min(92vh,920px)] sm:rounded-3xl sm:border sm:border-black/10 ${maxWidth}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <header
                className={`sticky top-0 z-20 flex w-full shrink-0 items-center gap-3 border-b ${SHELL_BORDER} ${SHELL_BG_STICKY} px-4 py-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] backdrop-blur-md sm:rounded-t-3xl`}
              >
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Back"
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${SHELL_BORDER} bg-black/[0.04] text-[#0A1017]`}
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0 flex-1">
                  {eyebrow ? (
                    <p
                      className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${CHROME_EYEBROW}`}
                    >
                      {eyebrow}
                    </p>
                  ) : null}
                  <h3
                    className={`truncate font-godiva text-base uppercase tracking-wider ${CHROME_TITLE}`}
                  >
                    {title}
                  </h3>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-24">
                {children}
              </div>

              {footer ? (
                <div
                  className={`shrink-0 border-t ${SHELL_BORDER} ${SHELL_BG_STICKY} px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-b-3xl`}
                >
                  {footer}
                </div>
              ) : null}
            </motion.div>
          </motion.div>
        )
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
