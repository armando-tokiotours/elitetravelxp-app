import type { Metadata } from "next";
import { AgencyApp } from "@/components/staff/AgencyApp";

export const metadata: Metadata = {
  title: "Agency portal",
  description: "Travel agency inquire and orders.",
  robots: { index: false, follow: false },
};

export default function AgencyPage() {
  return <AgencyApp />;
}
