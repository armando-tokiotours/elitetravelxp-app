"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export type TransitPassAnswers = {
  guestHasJRPass: boolean;
  guestHasICCard: boolean;
  guestNeedsTransitHelp: boolean;
};

/**
 * Shared JR / Suica / help questionnaire — Multi Public Transport + Single Subway.
 */
export function TransitPassQuestionnaire({
  open,
  onClose,
  onSave,
  initial,
  confirmLabel = "Continue with Public Transport",
}: {
  open: boolean;
  onClose: () => void;
  onSave: (answers: TransitPassAnswers) => void;
  initial: {
    guestHasJRPass: boolean | null;
    guestHasICCard: boolean | null;
    guestNeedsTransitHelp: boolean | null;
  };
  confirmLabel?: string;
}) {
  const [jr, setJr] = useState<boolean | null>(initial.guestHasJRPass);
  const [ic, setIc] = useState<boolean | null>(initial.guestHasICCard);
  const [help, setHelp] = useState<boolean | null>(
    initial.guestNeedsTransitHelp
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setJr(initial.guestHasJRPass);
    setIc(initial.guestHasICCard);
    setHelp(initial.guestNeedsTransitHelp);
  }, [
    open,
    initial.guestHasJRPass,
    initial.guestHasICCard,
    initial.guestNeedsTransitHelp,
  ]);

  if (!mounted || typeof document === "undefined") return null;

  const canSave = jr != null && ic != null && help != null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="transit-pass-q"
          className="fixed inset-0 z-[140] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Transit pass questionnaire"
        >
          <button
            type="button"
            aria-label="Close backdrop"
            className="absolute inset-0 cursor-default"
            onClick={onClose}
          />
          <motion.div
            className="relative z-[1] w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]/95 shadow-2xl"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            <div className="flex items-start justify-between border-b border-white/10 px-4 py-3.5">
              <div>
                <p className="font-godiva text-sm uppercase tracking-wider text-white">
                  Public transport passes
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Helps Tours &amp; Experiences recommend the right tickets
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-4 px-4 py-4">
              <YesNoQuestion
                label="Do you already hold a valid JR Pass for this trip?"
                value={jr}
                onChange={setJr}
              />
              <YesNoQuestion
                label="Do you already have a local IC Card (Suica / Pasmo)?"
                value={ic}
                onChange={setIc}
              />
              <YesNoQuestion
                label="Would you like our team to help arrange these passes for you?"
                value={help}
                onChange={setHelp}
              />
            </div>

            <div className="border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                disabled={!canSave}
                onClick={() => {
                  if (!canSave) return;
                  onSave({
                    guestHasJRPass: jr!,
                    guestHasICCard: ic!,
                    guestNeedsTransitHelp: help!,
                  });
                }}
                className="w-full rounded-full bg-[#054F70] py-3 text-sm font-semibold text-white transition hover:bg-[#043d57] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

function YesNoQuestion({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <p className="text-sm text-zinc-200">{label}</p>
      <div className="mt-2 flex gap-2">
        {([true, false] as const).map((v) => {
          const active = value === v;
          return (
            <button
              key={String(v)}
              type="button"
              onClick={() => onChange(v)}
              className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition ${
                active
                  ? "border-[#075473] bg-[#075473] text-white"
                  : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-white"
              }`}
            >
              {v ? "Yes" : "No"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
