import type { Metadata } from "next";
import { DriverApp } from "@/components/staff/GuideDriverApps";

export const metadata: Metadata = {
  title: "Driver login",
  description: "Contractor driver login — assigned pickups only.",
  robots: { index: false, follow: false },
};

/** Contractor entry — same DriverApp / ContractorPortalShell (no Super User nav). */
export default function DriverLoginPage() {
  return <DriverApp />;
}
