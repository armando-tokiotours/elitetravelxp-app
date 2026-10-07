"use client";

import { useEffect, useState } from "react";
import type { PbCity } from "@/lib/pocketbase/client";
import {
  cityImageCandidates,
  cityPbImageUrl,
} from "@/lib/cityMedia";

/**
 * City thumbnail with PocketBase → static webp → placeholder fallback.
 * Uses native <img> (Next/Image optimizer returns 400 for some PB thumbs).
 */
export function CityThumb({
  city,
  name,
  alt = "",
  thumb = "120x120",
  className = "h-full w-full object-cover",
  /** When false, only PocketBase cover — empty = plain grey (no static/placeholder art). */
  allowFallback = true,
}: {
  city?: PbCity | null;
  name?: string;
  alt?: string;
  thumb?: string;
  className?: string;
  allowFallback?: boolean;
}) {
  const candidates = allowFallback
    ? cityImageCandidates(city, {
        name: name || city?.name,
        thumb,
        variant:
          thumb.includes("120") || thumb.includes("100") ? "thumb" : "card",
      })
    : (() => {
        const pb = cityPbImageUrl(city, thumb);
        return pb ? [pb] : [];
      })();
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const src =
    !failed && candidates.length > 0
      ? candidates[Math.min(index, candidates.length - 1)]
      : "";

  useEffect(() => {
    setIndex(0);
    setFailed(false);
  }, [city?.id, city?.cover_photo, city?.image, name, thumb, allowFallback]);

  if (!src) {
    return (
      <div
        aria-hidden
        className={`bg-[#2C2C2E] ${className}`}
        title={alt || undefined}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={120}
      height={120}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => {
        if (!allowFallback) {
          setFailed(true);
          return;
        }
        setIndex((i) => {
          if (i + 1 < candidates.length) return i + 1;
          setFailed(true);
          return i;
        });
      }}
    />
  );
}
