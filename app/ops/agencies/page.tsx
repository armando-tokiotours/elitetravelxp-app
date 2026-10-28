import type { Metadata } from "next";
import { AgencyIntelligenceDesk } from "@/components/ops/AgencyIntelligenceDesk";

export const metadata: Metadata = {
  title: "Agency Intelligence · Revenue",
  description:
    "Executive agency partner intelligence, B2B orders, and receivables for Ops Super Users.",
  robots: { index: false, follow: false },
};

export default function OpsAgenciesPage() {
  return <AgencyIntelligenceDesk />;
}
