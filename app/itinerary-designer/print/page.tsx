import type { Metadata } from "next";
import PrintPageClient from "./PrintPageClient";

export const metadata: Metadata = {
  title: "Print Itinerary",
};

/** Alias route — Print / Save PDF emails the itinerary via Resend. */
export default function ItineraryDesignerPrintPage() {
  return <PrintPageClient />;
}
