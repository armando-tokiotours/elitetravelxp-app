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
import { ChevronDown, ChevronUp, X } from "lucide-react";
import type { PbTour } from "@/lib/pocketbase/client";
import { TourDetailPanel } from "./TourDetailPanel";

const HIDE_SCROLLBAR =
  "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Vertical Reels-style tour detail carousel (Discover grid). */
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
}) {
  const [mounted, setMounted] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const startIndex = Math.max(
    0,
    Math.min(initialSlide, Math.max(0, tours.length - 1))
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(pointer: coarse)");
    const sync = () => setIsCoarsePointer(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Jump to the clicked thumbnail when the modal opens
  useLayoutEffect(() => {
    if (!open || !trackRef.current || tours.length === 0) return;
    const el = trackRef.current;
    const height = el.clientHeight || window.innerHeight;
    el.scrollTop = height * startIndex;
    setActiveSlide(startIndex);
  }, [open, startIndex, tours.length]);

  const updateActiveFromScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const height = el.clientHeight || window.innerHeight;
    if (height <= 0) return;
    const idx = Math.round(el.scrollTop / height);
    setActiveSlide(Math.max(0, Math.min(idx, tours.length - 1)));
  }, [tours.length]);

  useEffect(() => {
    const el = trackRef.current;
    if (!open || !el) return;
    el.addEventListener("scroll", updateActiveFromScroll, { passive: true });
    return () => el.removeEventListener("scroll", updateActiveFromScroll);
  }, [open, updateActiveFromScroll]);

  const scrollBySlide = (delta: number) => {
    const el = trackRef.current;
    if (!el) return;
    const height = el.clientHeight || window.innerHeight;
    const next = Math.max(
      0,
      Math.min(activeSlide + delta, tours.length - 1)
    );
    el.scrollTo({ top: height * next, behavior: "smooth" });
    setActiveSlide(next);
  };

  if (!mounted || !open || tours.length === 0) return null;

  const activeTour = tours[activeSlide] ?? tours[0];
  const hint = isCoarsePointer ? "swipe for more" : "scroll for more";

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div
          className="fixed inset-0 z-[110]"
          role="dialog"
          aria-modal="true"
          aria-label={activeTour?.title ?? "Tour details"}
        >
          <motion.button
            type="button"
            aria-label="Close backdrop"
            className="absolute inset-0 cursor-default bg-black/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Fixed chrome */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm sm:right-5 sm:top-5"
          >
            <X className="h-5 w-5" />
          </button>

          {tours.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous tour"
                disabled={activeSlide <= 0}
                onClick={() => scrollBySlide(-1)}
                className="absolute left-1/2 top-[max(3.5rem,calc(env(safe-area-inset-top)+2.5rem))] z-20 hidden h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm disabled:opacity-30 md:flex"
              >
                <ChevronUp className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Next tour"
                disabled={activeSlide >= tours.length - 1}
                onClick={() => scrollBySlide(1)}
                className="absolute bottom-16 left-1/2 z-20 hidden h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm disabled:opacity-30 md:flex"
              >
                <ChevronDown className="h-5 w-5" />
              </button>
            </>
          ) : null}

          <motion.div
            className="relative z-[1] mx-auto h-full w-full max-w-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              ref={trackRef}
              className={`flex h-full w-full flex-col snap-y snap-mandatory overflow-x-hidden overflow-y-auto ${HIDE_SCROLLBAR}`}
            >
              {tours.map((tour, index) => (
                <div
                  key={tour.id}
                  className="flex h-[100dvh] min-h-[100dvh] w-full shrink-0 snap-center flex-col justify-center px-4 py-6 pt-14 pb-16"
                >
                  <TourDetailPanel
                    tour={tour}
                    guests={guests}
                    mediaActive={index === activeSlide}
                    selected={isTourSelected?.(tour.id) ?? false}
                    scheduledLabel={scheduledLabelFor?.(tour.id) ?? null}
                    bookedLanguage={bookedLanguageFor?.(tour.id) ?? null}
                    onAdd={(lang) => {
                      if (isTourSelected?.(tour.id)) {
                        onAdd(tour, "");
                        return;
                      }
                      if (lang) onAdd(tour, lang);
                    }}
                  />
                </div>
              ))}
            </div>
          </motion.div>

          {tours.length > 1 ? (
            <p className="pointer-events-none fixed bottom-6 left-0 right-0 z-50 text-center text-xs tracking-widest text-zinc-500">
              {activeSlide + 1} / {tours.length} · {hint}
            </p>
          ) : null}
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
