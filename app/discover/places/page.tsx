"use client";

import Link from "next/link";
import { ArrowLeft, MapPinned } from "lucide-react";

/**
 * Minimal Areas / places personalization shell.
 * Reachable from Discover Reels → Areas → "Yes, personalize".
 * Full place-picker UX lands here later; for now guests can return
 * to pre-made Tours & Experiences reels.
 */
export default function DiscoverPlacesPage() {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#05080C] text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(7,84,115,0.35),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(246,167,36,0.12),_transparent_45%)]"
        aria-hidden
      />
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-28 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <Link
          href="/discover"
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md transition active:scale-95"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-[#F6A724]" aria-hidden />
          Back to Tours &amp; Experiences
        </Link>

        <div className="mt-16 flex flex-1 flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <MapPinned className="h-7 w-7 text-[#F6A724]" aria-hidden />
          </div>
          <h1 className="mt-6 font-godiva text-2xl font-black uppercase tracking-wide">
            Personalize places
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/65">
            Build a custom area route from places you care about. This shell is
            ready — place search and route assembly come next.
          </p>
          <Link
            href="/discover"
            className="mt-8 w-full max-w-xs rounded-2xl bg-[#075473] py-3.5 text-sm font-bold text-white transition hover:bg-[#0A6C93] active:scale-[0.99]"
          >
            Back to Tours &amp; Experiences
          </Link>
        </div>
      </div>
    </div>
  );
}
