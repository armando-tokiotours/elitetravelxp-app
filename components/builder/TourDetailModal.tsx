"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, X } from "lucide-react";
import type { PbTour } from "@/lib/pocketbase/client";
import { TourDetailPanel } from "./TourDetailPanel";

/**
 * Discover experience feed — full-viewport vertical scroll (Reels-style).
 * One scroll layer only (no nested lock). Soft snap between cards.
 */
export function TourDetailModal({
  open,
  tours,
  initialSlide = 0,
  guests,
  onClose,
  onAdd,
  isTourSelected,
  scheduledLabelFor,
  bookedLanguageFor,
  backLabel = "Back to Discover",
  hidePrice = false,
}: {
  open: boolean;
  tours: PbTour[];
  initialSlide?: number;
  guests: { adults: number; children: number };
  onClose: () => void;
  onAdd: (tour: PbTour, selectedLanguage: string) => void;
  isTourSelected?: (tourId: string) => boolean;
  scheduledLabelFor?: (tourId: string) => string | null;
  bookedLanguageFor?: (tourId: string) => string | null;
  backLabel?: string;
  hidePrice?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const startIndex = Math.max(
    0,
    Math.min(initialSlide, Math.max(0, tours.length - 1))
  );

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

  useLayoutEffect(() => {
    if (!open || tours.length === 0) return;
    setActiveSlide(startIndex);
    const node = slideRefs.current[startIndex];
    if (node) {
      node.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior });
    }
  }, [open, startIndex, tours.length]);

  const updateActiveFromScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const mid = el.scrollTop + el.clientHeight * 0.35;
    let best = 0;
    let bestDist = Infinity;
    slideRefs.current.forEach((node, i) => {
      if (!node) return;
      const top = node.offsetTop;
      const dist = Math.abs(top - mid + el.clientHeight * 0.15);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setActiveSlide(best);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!open || !el) return;
    el.addEventListener("scroll", updateActiveFromScroll, { passive: true });
    return () => el.removeEventListener("scroll", updateActiveFromScroll);
  }, [open, updateActiveFromScroll]);

  const scrollToSlide = useCallback((index: number) => {
    const next = Math.max(0, Math.min(index, tours.length - 1));
    const node = slideRefs.current[next];
    if (!node) return;
    node.scrollIntoView({ block: "start", behavior: "smooth" });
    setActiveSlide(next);
  }, [tours.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        scrollToSlide(activeSlide + 1);
      }
      if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        scrollToSlide(activeSlide - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, activeSlide, scrollToSlide]);

  if (!mounted || !open || tours.length === 0) return null;

  const activeTour = tours[activeSlide] ?? tours[0];

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[110] flex h-[100dvh] min-h-[100dvh] w-full flex-col bg-[#05080C]"
          role="dialog"
          aria-modal="true"
          aria-label={activeTour?.title ?? "Tour details"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="pointer-events-none absolute left-3 right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-30 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-md transition active:scale-95"
            >
              <ArrowLeft className="h-4 w-4 text-[#F6A724]" aria-hidden />
              <span>{backLabel}</span>
            </button>
            {tours.length > 1 ? (
              <span className="pointer-events-none rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-semibold text-white/80 backdrop-blur-md">
                {activeSlide + 1} / {tours.length}
              </span>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="pointer-events-auto rounded-full border border-white/20 bg-black/60 p-2 text-white shadow-lg backdrop-blur-md transition active:scale-95"
            >
              <X className="h-4 w-4 text-zinc-300" aria-hidden />
            </button>
          </div>

          {/* Vertical feed: one full-viewport slide per experience */}
          <div
            ref={trackRef}
            className="h-[100dvh] min-h-[100dvh] w-full touch-pan-y snap-y snap-mandatory overflow-x-hidden overflow-y-auto overscroll-y-contain"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {tours.map((tour, index) => (
              <section
                key={tour.id}
                ref={(node) => {
                  slideRefs.current[index] = node;
                }}
                aria-label={tour.title}
                className="box-border h-[100dvh] min-h-[100dvh] w-full snap-start snap-always overflow-hidden"
              >
                <TourDetailPanel
                  tour={tour}
                  guests={guests}
                  mediaActive={index === activeSlide}
                  selected={isTourSelected?.(tour.id) ?? false}
                  scheduledLabel={scheduledLabelFor?.(tour.id) ?? null}
                  bookedLanguage={bookedLanguageFor?.(tour.id) ?? null}
                  hidePrice={hidePrice}
                  expandDescription
                  fullscreen
                  onAdd={(lang) => {
                    if (isTourSelected?.(tour.id)) {
                      onAdd(tour, "");
                      return;
                    }
                    if (lang) onAdd(tour, lang);
                  }}
                />
              </section>
            ))}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
