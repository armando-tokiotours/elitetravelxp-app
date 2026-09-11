import type { Metadata } from "next";
import { PrintItineraryDocument } from "@/components/builder/PrintItineraryDocument";

export const metadata: Metadata = {
  title: "Print Itinerary",
};

export default function BuilderPrintPage() {
  return <PrintItineraryDocument />;
}
