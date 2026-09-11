import type { Metadata } from "next";
import ItineraryDesignerPage from "./page-client";

export const metadata: Metadata = {
  title: "Itinerary Designer",
  description:
    "Design a bespoke Japan itinerary and receive a live luxury travel quotation.",
};

export default function Page() {
  return <ItineraryDesignerPage />;
}
