import type { CSSProperties } from "react";
import Image from "next/image";
import { BRAND_LOGO_ICON } from "@/lib/brand";

/**
 * Tokiotours mark — always next/image at the audited display size (51×48).
 * Pass `priority` for above-the-fold / LCP instances.
 */
export function BrandLogoIcon({
  priority = false,
  className = "h-12 w-[51px] object-cover",
  alt = "TOKIOTOURS",
  style,
}: {
  priority?: boolean;
  className?: string;
  alt?: string;
  style?: CSSProperties;
}) {
  return (
    <Image
      src={BRAND_LOGO_ICON}
      alt={alt}
      width={51}
      height={48}
      priority={priority}
      sizes="51px"
      className={className}
      style={style}
    />
  );
}
