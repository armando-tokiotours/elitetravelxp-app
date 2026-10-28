import type { Metadata } from "next";
import { OpsConciergeApp } from "@/components/staff/OpsConciergeApp";

export const metadata: Metadata = {
  title: "Concierge · Communications",
  description:
    "Global Communications Desk — pending reminders across all active PNRs.",
  robots: { index: false, follow: false },
};

export default function OpsConciergePage() {
  return <OpsConciergeApp />;
}
