"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { MobileAppNav } from "@/components/navigation/AppSidebar";
import { useBuilderStore } from "@/store/useBuilderStore";
import { activeBookingRef } from "@/utils/pnr";

/**
 * Discover-style top chrome: hamburger · TOKIOTOURS + title · actions or pill CTA.
 * Fixed on scroll (sticky fails under overflow-x parents on itinerary/builder).
 * When `actions` is set (dossier Save/Print/Invoice), bar stays visible on desktop too.
 */
export function MobileTopChrome({
  brandTitle,
  ctaHref,
  ctaLabel,
  actions,
}: {
  brandTitle: string;
  ctaHref: string;
  ctaLabel: string;
  /** Optional dossier controls (Save / Print / Plan·Invoice) */
  actions?: ReactNode;
}) {
  const tempBookingRef = useBuilderStore((s) => s.tempBookingRef);
  const confirmedBookingRef = useBuilderStore((s) => s.confirmedBookingRef);
  const bookingStatus = useBuilderStore((s) => s.bookingStatus);
  const bookingRef = activeBookingRef({
    tempBookingRef,
    confirmedBookingRef,
    bookingStatus,
  }).trim();

  const alwaysVisible = Boolean(actions);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#0A1017]/90 text-white backdrop-blur-xl ${
          alwaysVisible ? "" : "lg:hidden"
        }`}
      >
        <nav
          className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3"
          aria-label="Builder"
        >
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <MobileAppNav brandEyebrow="TOKIOTOURS" brandTitle={brandTitle} />
            <div className="min-w-0">
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.28em] text-cyan-300">
                Tokiotours
              </p>
              <h1 className="truncate font-display text-sm leading-tight uppercase tracking-wider sm:text-xl">
                {brandTitle}
              </h1>
            </div>
          </div>
          <div className="flex min-w-0 shrink-0 items-center gap-2">
            {actions ? (
              actions
            ) : (
              <>
                {bookingRef ? (
                  <span
                    className="mr-2 hidden font-mono text-xs tracking-wider text-zinc-300 sm:inline-block"
                    title="Booking reference"
                  >
                    {bookingRef}
                  </span>
                ) : null}
                <Link
                  href={ctaHref}
                  className="shrink-0 rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  {ctaLabel}
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>
      {/* Reserve space so content is not hidden under the fixed bar */}
      <div
        className={`h-[3.75rem] shrink-0 ${alwaysVisible ? "" : "lg:hidden"}`}
        aria-hidden
      />
    </>
  );
}
