import type { Metadata } from "next";
import { DriverApp } from "@/components/staff/GuideDriverApps";

export const metadata: Metadata = {
  title: "Driver portal",
  description: "Contractor driver jobs — no Ops Super User navigation.",
  robots: { index: false, follow: false },
};

export default function DriverPortalPage() {
  return <DriverApp />;
}