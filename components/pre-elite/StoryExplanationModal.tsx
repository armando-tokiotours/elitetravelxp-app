"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import {
  STORY_SLIDE_MS,
  type StoryExplanation,
} from "@/lib/preEliteStories";

/**
 * Instagram Stories–style vertical explanation overlay for Pre-Elite options.
 */
export function StoryExplanationModal({
  open,
  story,
  onClose,
  onSelect,
}: {
  open: boolean;
  story: StoryExplanation | null;
  onClose: () => void;
  onSelect: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(0);
  const [imageTick, setImageTick] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setIndex(0);
    setImageTick(0);
    setVideoProgress(0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, story?.optionId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const slides = story?.slides ?? [];
  const slide = slides[index];
  const isVideo = Boolean(slide?.videoUrl);

  useEffect(() => {
    if (!open || !story || slides.length === 0) return;
    if (isVideo) return;

    setVideoProgress(0);
    const timer = window.setTimeout(() => {
      setIndex((prev) => (prev + 1) % slides.length);
      setImageTick((t) => t + 1);
    }, STORY_SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [open, story, slides.length, index, isVideo, imageTick]);

  useEffect(() => {
    if (!open || !isVideo) {
      setVideoProgress(0);
      return;
    }
    const el = videoRef.current;
    if (!el) return;

    const onTime = () => {
      const duration = el.duration || 0;
      if (duration > 0) {
        setVideoProgress(Math.min(1, el.currentTime / duration));
      }
    };
    const onEnded = () => {
      setVideoProgress(1);
      setIndex((prev) => (prev + 1) % slides.length);
    };

    el.currentTime = 0;
    setVideoProgress(0);
    void el.play().catch(() => {
      /* autoplay may be blocked; progress still advances via timer fallback */
    });

    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnded);

    const fallback = window.setTimeout(() => {
      if (!el.paused && el.duration && Number.isFinite(el.duration)) return;
      setIndex((prev) => (prev + 1) % slides.length);
    }, STORY_SLIDE_MS * 2);

    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnded);
      window.clearTimeout(fallback);
    };
  }, [open, isVideo, index, slides.length, slide?.id]);

  if (!mounted) return null;

  const go = (next: number) => {
    if (slides.length === 0) return;
    setIndex((next + slides.length) % slides.length);
    setImageTick((t) => t + 1);
    setVideoProgress(0);
  };

  return createPortal(
    <AnimatePresence>
      {open && story ? (
        <motion.div
          key={`story-${story.optionId}`}
          className="tokio-modal-opaque fixed inset-0 z-[140] flex items-center justify-center bg-black/90 p-3 backdrop-blur-md sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={story.subtitle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <style>{`
            @keyframes pre-elite-story-fill {
              from { width: 0%; }
              to { width: 100%; }
            }
          `}</style>

          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close story"
            onClick={onClose}
          />

          <motion.div
            className="relative z-[1] flex h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl bg-black shadow-2xl"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {/* Progress bars */}
            <div className="absolute left-3 right-3 top-3 z-30 flex gap-1">
              {slides.map((s, i) => (
                <div
                  key={s.id}
                  className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/25"
                >
                  <div
                    key={
                      i === index
                        ? `active-${index}-${s.id}-${imageTick}`
                        : `seg-${i}`
                    }
                    className="h-full rounded-full bg-[#075473]"
                    style={
                      i < index
                        ? { width: "100%" }
                        : i > index
                          ? { width: "0%" }
                          : isVideo
                            ? { width: `${videoProgress * 100}%` }
                            : {
                                width: "0%",
                                animation: `pre-elite-story-fill ${STORY_SLIDE_MS}ms linear forwards`,
                              }
                    }
                  />
                </div>
              ))}
            </div>

            {/* Header */}
            <div className="absolute left-3 right-3 top-6 z-30 flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={story.avatarUrl}
                alt=""
                className="h-8 w-8 rounded-full border border-[#075473]/50 bg-[#1C1C1E] object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-white">
                  {story.title}
                </p>
                <p className="truncate text-[10px] text-white/65">
                  {story.subtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-black/45 p-2 text-white backdrop-blur-sm"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tap zones — leave room for header controls and sticky CTA */}
            <button
              type="button"
              className="absolute bottom-28 left-0 top-16 z-20 w-1/3"
              aria-label="Previous slide"
              onClick={() => go(index - 1)}
            />
            <button
              type="button"
              className="absolute bottom-28 right-0 top-16 z-20 w-1/3"
              aria-label="Next slide"
              onClick={() => go(index + 1)}
            />

            {/* Media */}
            {slide ? (
              <div className="absolute inset-0 z-0">
                {slide.videoUrl ? (
                  <video
                    ref={videoRef}
                    key={slide.id}
                    src={slide.videoUrl}
                    poster={slide.imageUrl}
                    autoPlay
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={slide.id}
                    src={slide.imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/50" />
              </div>
            ) : null}

            {/* Caption + CTA */}
            <div className="relative z-30 mt-auto flex flex-col gap-4 p-5 pb-6 pt-24">
              {slide ? (
                <div className="pointer-events-none space-y-2">
                  <h3 className="font-display text-2xl leading-tight text-white">
                    {slide.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-white/75">
                    {slide.caption}
                  </p>
                  <p className="text-[11px] text-white/40">
                    {index + 1} / {slides.length} · tap sides to skip
                  </p>
                </div>
              ) : null}

              <button
                type="button"
                onClick={onSelect}
                className="w-full rounded-full bg-[#075473] px-5 py-3.5 text-sm font-semibold text-white shadow-lg"
              >
                {story.ctaLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
