import type { Metadata } from "next";
import { PreEliteBuilderClient } from "./PreEliteBuilderClient";

export const metadata: Metadata = {
  title: "Pre-Elite Builder",
  description:
    "Share your travel style, interests, and timing. We qualify the trip before the Elite builder.",
};

export default function PreEliteBuilderPage() {
  return <PreEliteBuilderClient />;
}
