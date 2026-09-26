import type { Metadata } from "next";
import { DriverApp } from "@/components/staff/GuideDriverApps";

export const metadata: Metadata = {
  title: "Driver portal",
  description: "Assigned pickups for drivers.",
  robots: { index: false, follow: false },
};

export default function DriverPage() {
  return <DriverApp />;
}
