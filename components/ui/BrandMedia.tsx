"use client";

import { useState, type ImgHTMLAttributes } from "react";
import Image from "next/image";

/**
 * Image with immediate fallback when PocketBase / remote URLs fail to load.
 * Empty src + empty fallback → plain grey plane (never logo filler).
 * Uses next/image for local public/ assets; remote/PB URLs stay on <img>
 * (PB thumb optimizer can 400 on some hosts — see CityThumb).
 */
export function BrandMedia({
  src,
  fallback = "",
  alt = "",
  className,
  width,
  height,
  ...rest
}: ImgHTMLAttributes<HTMLImageElement> & {
  fallback?: string;
}) {
  const [failed, setFailed] = useState(false);
  const raw = !src || failed ? fallback : src;
  const resolved = typeof raw === "string" ? raw : "";

  if (!resolved) {
    return (
      <div
        aria-hidden
        className={className}
        style={{ backgroundColor: "#2C2C2E" }}
      />
    );
  }

  const isLocal = resolved.startsWith("/") && !resolved.startsWith("//");
  const w = typeof width === "number" ? width : 600;
  const h = typeof height === "number" ? height : 400;

  if (isLocal) {
    return (
      <Image
        src={resolved}
        alt={alt || ""}
        width={w}
        height={h}
        className={className}
        loading="lazy"
        onError={() => {
          if (!failed) setFailed(true);
        }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...rest}
      src={resolved}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (!failed) setFailed(true);
      }}
    />
  );
}
