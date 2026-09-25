"use client";

import { useState, type ImgHTMLAttributes } from "react";

/**
 * Image with immediate fallback when PocketBase / remote URLs fail to load.
 * Used for Team Configuration media that may be missing on VPS.
 */
export function BrandMedia({
  src,
  fallback = "/brand/site-logo.png",
  alt = "",
  className,
  ...rest
}: ImgHTMLAttributes<HTMLImageElement> & {
  fallback?: string;
}) {
  const [failed, setFailed] = useState(false);
  const resolved = !src || failed ? fallback : src;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...rest}
      src={resolved}
      alt={alt}
      className={className}
      onError={() => {
        if (!failed) setFailed(true);
      }}
    />
  );
}
