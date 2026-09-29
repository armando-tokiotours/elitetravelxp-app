"use client";

import {
  useEffect,
  useRef,
  useState,
  type VideoHTMLAttributes,
} from "react";

type Props = Omit<VideoHTMLAttributes<HTMLVideoElement>, "src" | "preload"> & {
  src: string;
  /** Poster shown until the first frame is ready (covers progressive paint) */
  poster?: string;
  /** Root margin for IntersectionObserver (default 200px) */
  rootMargin?: string;
};

/**
 * Defers assigning video `src` until near the viewport, then keeps a poster
 * overlay until `canplay` so the user never sees window-style progressive fill.
 * Small reels: metadata preload + play as soon as ready.
 */
export function LazyVideo({
  src,
  poster,
  rootMargin = "200px",
  className,
  muted = true,
  playsInline = true,
  autoPlay,
  ...rest
}: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [activeSrc, setActiveSrc] = useState<string | undefined>(undefined);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    setActiveSrc(undefined);
  }, [src]);

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

  useEffect(() => {
    const video = ref.current;
    if (!video || !activeSrc) return;

    const markReady = () => setReady(true);

    if (video.readyState >= 3) {
      markReady();
    } else {
      video.addEventListener("canplay", markReady);
      video.addEventListener("loadeddata", markReady);
    }

    if (autoPlay) {
      void video.play().catch(() => {
        /* autoplay may be blocked — poster stays until ready */
      });
    }

    return () => {
      video.removeEventListener("canplay", markReady);
      video.removeEventListener("loadeddata", markReady);
    };
  }, [activeSrc, autoPlay]);

  const showPosterCover = Boolean(poster) && !ready;
  const videoVisible = ready || !poster;

  return (
    <span className={`relative block overflow-hidden ${className ?? ""}`}>
      {showPosterCover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt=""
          className="absolute inset-0 z-10 h-full w-full object-cover"
          draggable={false}
          aria-hidden
        />
      ) : null}
      <video
        ref={ref}
        src={activeSrc}
        poster={poster}
        muted={muted}
        playsInline={playsInline}
        autoPlay={Boolean(autoPlay && activeSrc)}
        preload={activeSrc ? "metadata" : "none"}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
          videoVisible ? "opacity-100" : "opacity-0"
        }`}
        {...rest}
      />
    </span>
  );
}
