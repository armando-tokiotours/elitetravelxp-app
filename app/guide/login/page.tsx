import type { Metadata } from "next";
import { GuideApp } from "@/components/staff/GuideDriverApps";

export const metadata: Metadata = {
  title: "Guide login",
  description: "Contractor guide login — individual jobs only.",
  robots: { index: false, follow: false },
};

/** Contractor entry — same GuideApp / ContractorPortalShell (no Super User nav). */
export default function GuideLoginPage() {
  return <GuideApp />;
}
