"use client";

import Image, { type ImageProps } from "next/image";
import { MEDIA_STANDARDS } from "@/lib/mediaStandards";

type Props = Omit<ImageProps, "loading"> & {
  /** Above-the-fold: skip lazy load. Default lazy for below-fold. */
  priority?: boolean;
};

/**
 * Next.js Image with WebP/AVIF (via next.config) and mobile-aware sizes.
 * Use for remote PocketBase files and local `/public` assets.
 */
export function MediaImage({
  sizes = MEDIA_STANDARDS.imageSizesDefault,
  priority = false,
  alt,
  ...rest
}: Props) {
  return (
    <Image
      alt={alt}
      sizes={sizes}
      priority={priority}
      loading={priority ? undefined : "lazy"}
      {...rest}
    />
  );
}
