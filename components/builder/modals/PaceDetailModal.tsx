"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { LazyVideo } from "@/components/ui/LazyVideo";
import { paceBrandingKey } from "@/lib/brandingUi";
import { type PaceId } from "@/lib/travelPace";
import type { TravelPace } from "@/store/useBuilderStore";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";

/**
 * Shared travel-pace reel / detail modal — used by Builder M and Builder S.
 * Media + copy come from central branding (`getTravelPaces` / branding_ui_items).
 */
export function PaceDetailModal({
  paceId,
  selected,
  onClose,
  onSelect,
}: {
  paceId: PaceId | null;
  selected: TravelPace;
  onClose: () => void;
  onSelect: (id: PaceId) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const brandingItems = useSiteBrandingStore((s) => s.itemsByKey);
  const getItem = useSiteBrandingStore((s) => s.getItem);
  const pace = paceId
    ? { id: paceId, ...getItem(paceBrandingKey(paceId)) }
    : null;
  void brandingItems;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!paceId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [paceId]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {pace ? (
        <motion.div
          key="pace-explainer"
          className="fixed inset-0 z-[120] flex items-stretch justify-center bg-[#05080C]/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={pace.title}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default"
            onClick={onClose}
          />
          <motion.div
            className="relative z-[1] flex h-[100dvh] max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl sm:rounded-2xl md:max-w-2xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950 px-4 pb-4 pt-5 sm:px-5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#075473]">
                  Travel pace
                </p>
                <h3 className="truncate font-display text-2xl text-white">
                  {pace.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              <article className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                <div className="relative aspect-[4/5] max-h-[42dvh] w-full bg-zinc-950 sm:max-h-[48dvh]">
                  {pace.isVideo && pace.mediaUrl ? (
                    <LazyVideo
                      src={pace.mediaUrl}
                      poster={pace.posterUrl || undefined}
                      muted
                      loop
                      playsInline
                      autoPlay
                      className="h-full w-full object-cover"
                    />
                  ) : pace.mediaUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pace.mediaUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="px-4 py-4 sm:px-5">
                  <p className="text-sm font-semibold text-white">
                    {pace.subtitle}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">
                    {pace.description}
                  </p>
                </div>
              </article>
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-zinc-800 bg-zinc-950 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row-reverse sm:px-5">
              <button
                type="button"
                onClick={() => onSelect(pace.id)}
                className="w-full rounded-xl bg-[#D9718C] py-3 text-sm font-bold text-white transition hover:bg-[#c45f79] sm:flex-1"
              >
                {selected === pace.id
                  ? "✓ Selected — keep this pace"
                  : "Confirm Selection"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl border border-zinc-700 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 sm:flex-1"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
