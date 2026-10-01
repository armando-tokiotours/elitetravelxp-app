"use client";

import Link from "next/link";
import { MobileAppNav } from "@/components/navigation/AppSidebar";
import { useBuilderStore } from "@/store/useBuilderStore";
import { activeBookingRef } from "@/utils/pnr";

/**
 * Discover-style mobile top chrome: hamburger · TOKIOTOURS + title · PNR · pill CTA.
 * Fixed on scroll (sticky fails under overflow-x parents on itinerary/builder).
 */
export function MobileTopChrome({
  brandTitle,
  ctaHref,
  ctaLabel,
}: {
  brandTitle: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  const tempBookingRef = useBuilderStore((s) => s.tempBookingRef);
  const confirmedBookingRef = useBuilderStore((s) => s.confirmedBookingRef);
  const bookingStatus = useBuilderStore((s) => s.bookingStatus);
  const bookingRef = activeBookingRef({
    tempBookingRef,
    confirmedBookingRef,
    bookingStatus,
  }).trim();

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#0D1117]/90 text-white backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <MobileAppNav brandEyebrow="TOKIOTOURS" brandTitle={brandTitle} />
            <div className="min-w-0">
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.28em] text-[#075473]">
                TOKIOTOURS
              </p>
              <h1 className="font-display text-xl leading-tight">{brandTitle}</h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0">
            {bookingRef ? (
              <span
                className="mr-4 hidden font-mono text-xs tracking-wider text-zinc-500 sm:inline-block"
                title="Booking reference"
              >
                {bookingRef}
              </span>
            ) : null}
            <Link
              href={ctaHref}
              className="shrink-0 rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/90"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      </header>
      {/* Reserve space so content is not hidden under the fixed bar */}
      <div className="h-[3.75rem] shrink-0 lg:hidden" aria-hidden />
    </>
  );
}
