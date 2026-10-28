"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { MobileAppNav } from "@/components/navigation/AppSidebar";
import { useBuilderStore } from "@/store/useBuilderStore";
import { activeBookingRef } from "@/utils/pnr";

/**
 * Shared mobile glossy-blue-on-scroll state (< lg headers).
 * Mobile-only glossy blue on scroll. Desktop stays transparent.
 * Initial value reads the current scroll position so a mid-scroll
 * restore/hydration never flashes the transparent state.
 * Used by MobileTopChrome and Discover's own mobile header so both
 * surfaces share one scroll behaviour instead of duplicating logic.
 */
export function useMobileHeaderScrolled(): boolean {
  const [scrolled, setScrolled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const docTop =
      typeof document !== "undefined"
        ? (document.scrollingElement?.scrollTop ?? 0)
        : 0;
    return Math.max(window.scrollY || 0, docTop) > 8;
  });

  useEffect(() => {
    let rafId = 0;
    let pendingTargetTop: number | null = null;

    const compute = () => {
      rafId = 0;
      const targetTop = pendingTargetTop;
      pendingTargetTop = null;
      const docTop = document.scrollingElement?.scrollTop ?? 0;
      // Whichever scroller (window or an inner overflow container) is
      // furthest past the threshold drives the glossy state.
      const top = Math.max(window.scrollY || 0, docTop, targetTop ?? 0);
      setScrolled((prev) => {
        const next = top > 8;
        return prev === next ? prev : next;
      });
    };

    const schedule = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        pendingTargetTop = target.scrollTop;
      } else if (target === document) {
        pendingTargetTop =
          document.scrollingElement?.scrollTop ?? window.scrollY ?? 0;
      }
      if (!rafId) rafId = window.requestAnimationFrame(compute);
    };

    // Reflect the position on mount (pages restored mid-scroll).
    compute();
    // Capture phase: scroll events from inner overflow containers do not
    // bubble, but they do pass through document in the capture phase.
    document.addEventListener("scroll", schedule, {
      capture: true,
      passive: true,
    });
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      document.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("scroll", schedule);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return scrolled;
}

/** Glossy blue glass applied to mobile headers once scrolled (no `max-lg:` prefix — callers are already mobile-only). */
export const MOBILE_HEADER_SCROLLED_GLOSS =
  "bg-[#054F70]/75 bg-gradient-to-r from-[#054F70]/85 via-[#075473]/70 to-[#0D1117]/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(255,255,255,0.14),0_12px_32px_-16px_rgba(5,79,112,0.7)] backdrop-blur-xl backdrop-saturate-150";

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
  tone = "dark",
}: {
  brandTitle: string;
  ctaHref: string;
  ctaLabel: string;
  /** Optional dossier controls (Save / Print / Plan·Invoice) */
  actions?: ReactNode;
  /**
   * `light` = white text/icons (crimson brand) on charcoal glass chrome
   *   (`#0A1017/70` + blur, rest + scrolled) — used by started 1-Day builder.
   * `dark` = white text; scrolled applies glossy blue glass.
   */
  tone?: "dark" | "light";
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
  const scrolled = useMobileHeaderScrolled();
  const onCharcoal = tone === "light";
  // Light-tone fill — matches itinerary / mobile dock charcoal glass.
  // Text/icons are white on that glass; brand wordmark stays crimson.
  const lightToneChromeGlass =
    "max-lg:bg-[#0A1017]/70 max-lg:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(255,255,255,0.14),0_12px_32px_-16px_rgba(0,0,0,0.55)] max-lg:backdrop-blur-xl max-lg:backdrop-saturate-150";

  return (
    <>
      <header
        data-scrolled={scrolled ? "true" : "false"}
        className={`fixed inset-x-0 top-0 z-50 bg-transparent text-white transition-[background-color,box-shadow,backdrop-filter,color] duration-300 ease-out print:hidden ${
          onCharcoal
            ? lightToneChromeGlass
            : scrolled
              ? "max-lg:bg-[#054F70]/75 max-lg:bg-gradient-to-r max-lg:from-[#054F70]/85 max-lg:via-[#075473]/70 max-lg:to-[#0D1117]/60 max-lg:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(255,255,255,0.14),0_12px_32px_-16px_rgba(5,79,112,0.7)] max-lg:backdrop-blur-xl max-lg:backdrop-saturate-150"
              : "max-lg:bg-transparent"
        } ${alwaysVisible ? "" : "lg:hidden"}`}
      >
        <nav
          className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3"
          aria-label="Builder"
        >
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <MobileAppNav
              brandEyebrow="TOKIOTOURS"
              brandTitle={brandTitle}
              hideManageBooking
              buttonTone="dark"
            />
            <div className="min-w-0">
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.28em] text-[#D91147]">
                Tokiotours
              </p>
              <h1 className="truncate font-display text-sm leading-tight uppercase tracking-wider text-white/70 sm:text-xl">
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
