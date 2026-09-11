import type { Metadata } from "next";
import { PrintItineraryDocument } from "@/components/builder/PrintItineraryDocument";

export const metadata: Metadata = {
  title: "Print Itinerary",
};

/** Alias route requested for print/PDF export. */
export default function ItineraryDesignerPrintPage() {
  return <PrintItineraryDocument />;
}
