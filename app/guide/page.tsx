import type { Metadata } from "next";
import { GuideApp } from "@/components/staff/GuideDriverApps";

export const metadata: Metadata = {
  title: "Guide portal",
  description: "Assigned tours for guides.",
  robots: { index: false, follow: false },
};

export default function GuidePage() {
  return <GuideApp />;
}
