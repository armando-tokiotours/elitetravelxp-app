"use client";

import { useEffect, useRef, useState, type VideoHTMLAttributes } from "react";

type Props = Omit<VideoHTMLAttributes<HTMLVideoElement>, "src" | "preload"> & {
  src: string;
  /** Poster shown before the video enters the viewport */
  poster?: string;
  /** Root margin for IntersectionObserver (default 200px) */
  rootMargin?: string;
};

/**
 * Defers assigning video `src` until the element is near the viewport.
 * Prevents multi‑MB .mp4/.m4v downloads on initial Discover paint.
 */
export function LazyVideo({
  src,
  poster,
  rootMargin = "200px",
  className,
  muted = true,
  playsInline = true,
  ...rest
}: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [activeSrc, setActiveSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (!el || !src) return;

    if (typeof IntersectionObserver === "undefined") {
      setActiveSrc(src);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSrc(src);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin, threshold: 0.01 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [src, rootMargin]);

  return (
    <video
      ref={ref}
      src={activeSrc}
      poster={poster}
      muted={muted}
      playsInline={playsInline}
      preload={activeSrc ? "metadata" : "none"}
      className={className}
      {...rest}
    />
  );
}
