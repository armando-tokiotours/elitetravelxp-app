import type { Metadata } from "next";
import { Suspense } from "react";
import SingleDayItineraryPageClient from "@/app/builder-single/itinerary/SingleDayItineraryPageClient";

export const metadata: Metadata = {
  title: "1-Day Express Pass · Itinerary",
  description: "Your 1-Day Express Pass itinerary and booking pass",
};

export default function DayPassItineraryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-black text-sm text-zinc-400">
          Opening itinerary…
        </div>
      }
    >
      <SingleDayItineraryPageClient />
    </Suspense>
  );
}
