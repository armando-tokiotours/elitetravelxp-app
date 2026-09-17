"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { useBuilderStore } from "@/store/useBuilderStore";

export function ConciergeEditorModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const experienceService = useBuilderStore((s) => s.experienceService);
  const setExperienceService = useBuilderStore((s) => s.setExperienceService);
  const selected = experienceService === "concierge";

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
  }, [open]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence
      onExitComplete={() => {
        document.body.style.overflow = "";
      }}
    >
      {open ? (
        <motion.div
          key="concierge-editor"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Elite Concierge"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#0a0a0a] md:h-[85vh] md:max-w-2xl md:rounded-2xl md:border md:border-zinc-800"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="flex flex-shrink-0 items-center gap-4 border-b border-zinc-800 bg-[#0a0a0a] p-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-white transition hover:border-zinc-500"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C4A35A]">
                  Configure
                </p>
                <h3 className="truncate font-display text-2xl text-white">
                  Elite Concierge
                </h3>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4 pb-12">
              <div className="overflow-hidden rounded-2xl border border-[#C4A35A]/45 bg-gradient-to-br from-zinc-950 to-zinc-900">
                <div className="flex items-start gap-3 border-b border-zinc-800/80 px-4 py-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#C4A35A]/15 text-[#C4A35A]">
                    <Sparkles className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#C4A35A]">
                      Premium
                    </p>
                    <h4 className="mt-1 font-display text-xl text-white">
                      Day-by-Day Design
                    </h4>
                  </div>
                </div>
                <div className="space-y-3 px-4 py-4 text-sm leading-relaxed text-zinc-400">
                  <p>
                    Skip individual planning. A dedicated luxury concierge
                    curates your entire day-by-day itinerary — exclusive dining
                    reservations, hidden sights, and private drivers for the
                    full trip.
                  </p>
                  <ul className="space-y-2 text-zinc-300">
                    <li className="flex gap-2">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#C4A35A]"
                        aria-hidden
                      />
                      Full itinerary design by a Japan specialist
                    </li>
                    <li className="flex gap-2">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#C4A35A]"
                        aria-hidden
                      />
                      Hard-to-get reservations and private access
                    </li>
                    <li className="flex gap-2">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#C4A35A]"
                        aria-hidden
                      />
                      Private drivers coordinated across your route
                    </li>
                  </ul>
                  <p className="rounded-xl border border-amber-500/30 bg-amber-950/40 px-3 py-2.5 text-xs text-amber-200/90">
                    Selecting Elite Concierge replaces any individually chosen
                    city experiences with the package fee.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-shrink-0 flex-col gap-3 border-t border-zinc-800 bg-[#0a0a0a]/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md">
              <button
                type="button"
                onClick={() => {
                  setExperienceService("concierge");
                  onClose();
                }}
                className="w-full rounded-full bg-[#0B1F3A] py-3 text-sm font-semibold text-white transition hover:bg-[#143052]"
              >
                {selected
                  ? "✓ Elite Concierge Selected — Done"
                  : "Select Elite Concierge Package"}
              </button>
              {selected ? (
                <button
                  type="button"
                  onClick={() => {
                    setExperienceService(null);
                    onClose();
                  }}
                  className="w-full rounded-full border border-zinc-700 bg-transparent py-2.5 text-sm font-medium text-zinc-400 transition hover:border-zinc-500 hover:text-white"
                >
                  Remove package
                </button>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
