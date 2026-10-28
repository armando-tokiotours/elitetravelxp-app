import type { Metadata } from "next";
import { CeoDashboardApp } from "@/components/ops/CeoDashboardApp";

export const metadata: Metadata = {
  title: "Executive Command Dashboard",
  description:
    "CEO Super User command center — financials, FX, dispatch alerts, and incoming trips.",
  robots: { index: false, follow: false },
};

export default function OpsDashboardPage() {
  return <CeoDashboardApp />;
}
