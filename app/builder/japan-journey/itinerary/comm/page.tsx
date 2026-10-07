"use client";

import { Suspense } from "react";
import { MobileTopChrome } from "@/components/navigation/MobileTopChrome";
import { GuestCommPage } from "@/components/dossier/GuestCommPage";

/** Canonical japan-journey URL — keeps bookmarks working; bubble uses modal instead. */
export default function JapanJourneyCommRoutePage() {
  return (
    <div className="min-h-screen bg-[#04080C] text-white">
      <MobileTopChrome
        brandTitle="Messages"
        ctaHref="/builder/japan-journey/itinerary"
        ctaLabel="Dossier"
      />
      <Suspense
        fallback={<p className="px-4 py-10 text-sm text-zinc-500">Loading…</p>}
      >
        <GuestCommPage backHref="/builder/japan-journey/itinerary" />
      </Suspense>
    </div>
  );
}
