"use client";

import { useEffect, useState } from "react";
import type { PbCity } from "@/lib/pocketbase/client";
import {
  CITY_PLACEHOLDER,
  cityImageCandidates,
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
}: {
  city?: PbCity | null;
  name?: string;
  alt?: string;
  thumb?: string;
  className?: string;
}) {
  const candidates = cityImageCandidates(city, {
    name: name || city?.name,
    thumb,
    variant: thumb.includes("120") || thumb.includes("100") ? "thumb" : "card",
  });
  const [index, setIndex] = useState(0);
  const src = candidates[Math.min(index, candidates.length - 1)] || CITY_PLACEHOLDER;

  useEffect(() => {
    setIndex(0);
  }, [city?.id, city?.cover_photo, city?.image, name, thumb]);

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
        setIndex((i) => (i + 1 < candidates.length ? i + 1 : i));
      }}
    />
  );
}
