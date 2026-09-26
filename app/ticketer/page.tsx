import type { Metadata } from "next";
import { TicketerApp } from "@/components/staff/TicketerApp";

export const metadata: Metadata = {
  title: "Ticketer",
  description: "Third-party ticket desk by PNR.",
  robots: { index: false, follow: false },
};

export default function TicketerPage() {
  return <TicketerApp />;
}
