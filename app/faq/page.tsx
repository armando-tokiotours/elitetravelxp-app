import type { Metadata } from "next";
import { FAQPageClient } from "./FAQPageClient";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about JR Pass, luggage, Suica, and TokioTours travel.",
};

export default function FAQPage() {
  return <FAQPageClient />;
}
