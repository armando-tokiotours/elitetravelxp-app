"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Generic character + sticker tip (panda / pass-cat pattern).
 * Intro: appear 1s after mount → hide after 1s.
 * Replay: hover (desktop) or tap/click (mobile).
 */
export function StickerMascot({
  characterSrc,
  stickerSrc,
  ariaLabel,
  className = "",
  size = "md",
}: {
  characterSrc: string;
  stickerSrc: string;
  ariaLabel: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const [showSticker, setShowSticker] = useState(false);
  const hideTimer = useRef<number | null>(null);

  const clearHideTimer = () => {
    if (hideTimer.current != null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const revealBriefly = (holdMs = 1800) => {
    clearHideTimer();
    setShowSticker(true);
    hideTimer.current = window.setTimeout(() => {
      setShowSticker(false);
      hideTimer.current = null;
    }, holdMs);
  };

  useEffect(() => {
    setShowSticker(false);
    clearHideTimer();
    const showT = window.setTimeout(() => {
      setShowSticker(true);
      hideTimer.current = window.setTimeout(() => {
        setShowSticker(false);
        hideTimer.current = null;
      }, 1000);
    }, 1000);
    return () => {
      window.clearTimeout(showT);
      clearHideTimer();
    };
  }, []);

  const charH = size === "sm" ? "h-16 sm:h-20" : "h-24 sm:h-28";
  const stickerH = size === "sm" ? "h-10 sm:h-12" : "h-12 sm:h-14";
  const minH =
    size === "sm"
      ? "min-h-[4.5rem] sm:min-h-[5.5rem]"
      : "min-h-[6.5rem] sm:min-h-[7.5rem]";

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => revealBriefly(1800)}
      onMouseEnter={() => {
        clearHideTimer();
        setShowSticker(true);
      }}
      onMouseLeave={() => {
        clearHideTimer();
        setShowSticker(false);
      }}
      className={`relative mx-auto flex w-full max-w-[17rem] cursor-pointer items-end justify-center rounded-2xl border border-transparent transition hover:border-white/10 ${minH} ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={characterSrc}
        alt=""
        aria-hidden
        draggable={false}
        className={`relative z-10 w-auto select-none object-contain drop-shadow-lg ${charH}`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={stickerSrc}
        alt=""
        aria-hidden
        draggable={false}
        className={`pointer-events-none absolute -right-1 top-0 z-20 w-auto origin-bottom-left select-none object-contain drop-shadow-md transition-all duration-500 sm:-right-2 ${stickerH} ${
          showSticker
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-2 scale-75 opacity-0"
        }`}
      />
    </button>
  );
}

export function PandaFlexibleMascot({
  className = "",
  size = "md",
  characterSrc = "/brand/panda-flex.png",
}: {
  className?: string;
  size?: "sm" | "md";
  /** Override character art (e.g. balance-beam panda on Settle Tour Balance). */
  characterSrc?: string;
}) {
  return (
    <StickerMascot
      characterSrc={characterSrc}
      stickerSrc="/brand/im-flexible.png"
      ariaLabel="I'm Flexible — change dates, routes, or stops anytime"
      className={className}
      size={size}
    />
  );
}

/** Payment-success: pass-cat + ありがとう / THANK YOU sticker. */
export function ThankYouPassMascot({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <StickerMascot
      characterSrc="/brand/pass-cat.png"
      stickerSrc="/brand/thank-you.png"
      ariaLabel="Thank you — payment received"
      className={className}
      size={size}
    />
  );
}
