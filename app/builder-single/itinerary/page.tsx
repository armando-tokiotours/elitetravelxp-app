import { Suspense } from "react";
import type { Metadata } from "next";
import SingleDayItineraryPageClient from "./SingleDayItineraryPageClient";

export const metadata: Metadata = {
  title: "Single-Day Tour Dossier",
};

export default function SingleDayItineraryPage() {
  return (
    <Suspense
      fallback={
        <p className="p-10 text-center text-sm text-[#8A8278]">
          Loading single-day itinerary…
        </p>
      }
    >
      <SingleDayItineraryPageClient />
    </Suspense>
  );
}
