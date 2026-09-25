"use client";

import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { BrandMedia } from "@/components/ui/BrandMedia";
import { LazyVideo } from "@/components/ui/LazyVideo";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";
import type { IntraCityTransport } from "@/store/useSingleDayBuilderStore";

const KEY_BY_ID: Record<IntraCityTransport, string> = {
  walk: "transit_walk",
  subway: "transit_subway",
  private_driver: "transit_private_driver",
};

/**
 * Explains Walking / Subway / Private Driver — copy + media from Team Branding.
 */
export function MovementDetailModal({
  movementId,
  selected,
  onClose,
  onSelect,
}: {
  movementId: IntraCityTransport | null;
  selected: IntraCityTransport | null;
  onClose: () => void;
  onSelect: (id: IntraCityTransport) => void;
}) {
  const open = Boolean(movementId);
  useModalDismiss(open, onClose);

  const getItem = useSiteBrandingStore((s) => s.getItem);
  const item = movementId ? getItem(KEY_BY_ID[movementId]) : null;

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && movementId && item ? (
        <motion.div
          key="movement-detail"
          className="fixed inset-0 z-[130] flex items-end justify-center bg-[#05080C]/70 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={item.title}
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
            className="relative z-[1] flex max-h-[min(90dvh,36rem)] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0D1117]/95 shadow-2xl backdrop-blur-xl sm:rounded-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white"
            >
              <X className="h-5 w-5" strokeWidth={2.5} />
            </button>

            <div className="relative aspect-[16/10] w-full bg-zinc-900">
              {item.isVideo && item.mediaUrl ? (
                <LazyVideo
                  src={item.mediaUrl}
                  poster={item.posterUrl || undefined}
                  muted
                  loop
                  playsInline
                  autoPlay
                  className="h-full w-full object-cover"
                />
              ) : (
                <BrandMedia
                  src={item.mediaUrl || item.posterUrl}
                  fallback="/brand/hero-single-day.jpg"
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0D1117] via-transparent to-transparent" />
            </div>

            <div className="space-y-3 overflow-y-auto px-5 py-4 pb-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1BA58A]">
                Preferred movement
              </p>
              <h3 className="font-godiva text-2xl uppercase tracking-wider text-white">
                {item.title}
              </h3>
              <p className="text-sm text-white/55">{item.subtitle}</p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-white/75">
                {item.description}
              </p>
              <button
                type="button"
                onClick={() => onSelect(movementId)}
                className="mt-2 w-full rounded-full bg-[#075473] py-3 text-sm font-semibold text-white"
              >
                {selected === movementId ? "Keep this option" : "Select this option"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
