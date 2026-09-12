import { Suspense } from "react";
import type { Metadata } from "next";
import ItineraryPageClient from "./ItineraryPageClient";

export const metadata: Metadata = {
  title: "My Itinerary",
};

export default function ItineraryPage() {
  return (
    <Suspense
      fallback={
        <p className="p-10 text-center text-sm text-[#8A8278]">
          Loading itinerary…
        </p>
      }
    >
      <ItineraryPageClient />
    </Suspense>
  );
}
