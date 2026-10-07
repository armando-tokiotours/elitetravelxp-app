"use client";

import { Suspense } from "react";
import { MobileTopChrome } from "@/components/navigation/MobileTopChrome";
import { GuestCommPage } from "@/components/dossier/GuestCommPage";

/** Canonical day-pass URL — keeps bookmarks working; bubble uses modal instead. */
export default function DayPassCommRoutePage() {
  return (
    <div className="min-h-screen bg-[#04080C] text-white">
      <MobileTopChrome
        brandTitle="Messages"
        ctaHref="/builder/day-pass/itinerary"
        ctaLabel="Dossier"
      />
      <Suspense
        fallback={<p className="px-4 py-10 text-sm text-zinc-500">Loading…</p>}
      >
        <GuestCommPage backHref="/builder/day-pass/itinerary" />
      </Suspense>
    </div>
  );
}
