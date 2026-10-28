import type { Metadata } from "next";
import { GuideApp } from "@/components/staff/GuideDriverApps";

export const metadata: Metadata = {
  title: "Guide portal",
  description: "Contractor guide jobs — no Ops Super User navigation.",
  robots: { index: false, follow: false },
};

export default function GuidePortalPage() {
  return <GuideApp />;
}
