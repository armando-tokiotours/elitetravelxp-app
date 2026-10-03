import type { Metadata } from "next";
import { Suspense } from "react";
import ItineraryPageClient from "@/app/builder/itinerary/ItineraryPageClient";

export const metadata: Metadata = {
  title: "Grand Japan Journey · Itinerary",
  description: "Your Grand Japan Journey itinerary and booking pass",
};

export default function JapanJourneyItineraryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-black text-sm text-zinc-400">
          Opening itinerary…
        </div>
      }
    >
      <ItineraryPageClient />
    </Suspense>
  );
}
