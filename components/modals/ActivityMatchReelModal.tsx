"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import {
  MATCH_REEL_SLIDE_MS,
  paceBadgeLabel,
  vibeBadgeLabel,
  type MatchReelSlide,
} from "@/lib/matchReel";
import {
  PACE_SUMMARY_LABEL,
  QUIZ_VIBE,
  type ExperienceProfile,
  type ProfilerPace,
} from "@/lib/experienceProfiler";
import type { UserTravelProfile } from "@/store/useItineraryStore";

/**
 * Instagram-style Match Reel — client-side slideshow of matched / selected experiences.
 */
export function ActivityMatchReelModal({
  open,
  onClose,
  slides,
  experienceProfile,
  userProfile,
}: {
  open: boolean;
  onClose: () => void;
  slides: MatchReelSlide[];
  experienceProfile?: ExperienceProfile | null;
  userProfile?: UserTravelProfile | null;
}) {
  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setIndex(0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || slides.length === 0) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, MATCH_REEL_SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [open, slides.length, index]);

  if (!mounted) return null;

  const go = (next: number) => {
    if (slides.length === 0) return;
    setIndex((next + slides.length) % slides.length);
  };

  const slide = slides[index];
  const vibe =
    experienceProfile?.vibe ?? userProfile?.vibe ?? slide?.vibeTags[0];
  const pace: ProfilerPace | undefined =
    experienceProfile?.pace ??
    userProfile?.pace ??
    (slide?.paceTag as ProfilerPace | undefined);

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="match-reel"
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/90 p-3 backdrop-blur-md sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Match Reel"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <style>{`
            @keyframes match-reel-fill {
              from { width: 0%; }
              to { width: 100%; }
            }
          `}</style>
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close reel"
            onClick={onClose}
          />

          <motion.div
            className="relative z-[1] flex aspect-[9/16] w-full max-w-sm flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <div className="absolute left-3 right-3 top-3 z-20 flex gap-1">
              {slides.map((s, i) => (
                <div
                  key={s.id || `slide-progress-${i}`}
                  className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/25"
                >
                  <div
                    key={i === index ? `active-${index}-${s.id}` : `done-${i}`}
                    className="h-full rounded-full bg-accent-500"
                    style={
                      i < index
                        ? { width: "100%" }
                        : i > index
                          ? { width: "0%" }
                          : {
                              width: "0%",
                              animation: `match-reel-fill ${MATCH_REEL_SLIDE_MS}ms linear forwards`,
                            }
                    }
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-6 z-20 rounded-full bg-black/45 p-2 text-white backdrop-blur-sm"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <button
              type="button"
              className="absolute inset-y-0 left-0 z-10 w-1/3"
              aria-label="Previous"
              onClick={() => go(index - 1)}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 z-10 w-1/3"
              aria-label="Next"
              onClick={() => go(index + 1)}
            />

            {slide ? (
              <>
                <div className="absolute inset-0 z-0">
                  {slide.videoUrl ? (
                    <video
                      key={slide.id}
                      src={slide.videoUrl}
                      autoPlay
                      muted
                      loop
                      playsInline
                      poster={slide.imageUrl}
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
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/25 to-black/45" />
                </div>

                <div className="relative z-[5] flex h-full flex-col justify-between p-5 pt-10">
                  <div className="space-y-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-accent-500/40 bg-[#B85304]/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-500">
                      <Sparkles className="h-3 w-3" aria-hidden />
                      Matched for Your Vibe
                    </span>
                    <p className="text-xs font-semibold text-white/90">
                      {slide.cityName}
                    </p>
                  </div>

                  <div className="space-y-2.5 pb-2">
                    <h3 className="font-display text-2xl leading-tight text-white">
                      {slide.title}
                    </h3>
                    {slide.description ? (
                      <p className="line-clamp-2 text-xs text-zinc-300">
                        {slide.description}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(slide.vibeTags.length
                        ? slide.vibeTags
                        : vibe
                          ? [vibe]
                          : []
                      )
                        .map((v) => String(v).trim())
                        .filter(Boolean)
                        .map((v, i) => (
                        <span
                          key={`${slide.id}-vibe-${v}-${i}`}
                          className="rounded-md border border-[#B85304]/40 bg-zinc-800/80 px-2 py-0.5 text-[10px] text-accent-500"
                        >
                          {vibeBadgeLabel(v)}
                        </span>
                      ))}
                      {slide.paceTag || pace ? (
                        <span className="rounded-md border border-zinc-700 bg-zinc-800/80 px-2 py-0.5 text-[10px] text-zinc-200">
                          {paceBadgeLabel(slide.paceTag || pace || "standard")}
                        </span>
                      ) : null}
                      {slide.isNiche ? (
                        <span className="rounded-md border border-purple-500/30 bg-purple-500/15 px-2 py-0.5 text-[10px] text-purple-200">
                          🔒 Hidden Gem
                        </span>
                      ) : null}
                      {slide.durationHours > 0 ? (
                        <span className="rounded-md border border-zinc-700 bg-zinc-800/80 px-2 py-0.5 text-[10px] text-zinc-300">
                          {slide.durationHours} Hours
                        </span>
                      ) : null}
                      {vibe ? (
                        <span className="rounded-md border border-[#B85304]/30 bg-[#B85304]/10 px-2 py-0.5 text-[10px] text-[#F3D9C4]">
                          {(
                            QUIZ_VIBE.find((o) => o.id === vibe)?.label ??
                            String(vibe)
                          ).split(" ")[0]}{" "}
                          Matched
                          {pace === "relaxed" ||
                          pace === "standard" ||
                          pace === "active"
                            ? ` · ${PACE_SUMMARY_LABEL[pace]}`
                            : ""}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between pt-2 text-[11px] text-zinc-500">
                      <span className="inline-flex items-center gap-1">
                        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                        Tap sides
                      </span>
                      <span>
                        {index + 1} / {slides.length}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        Next
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="relative z-[5] flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-sm text-zinc-300">
                  No matched experiences yet.
                </p>
                <p className="text-xs text-zinc-500">
                  Take the Style Quiz or add city tours to build your Match
                  Reel.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-2 rounded-full bg-accent-500 px-4 py-2 text-xs font-bold text-zinc-950"
                >
                  Close
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
