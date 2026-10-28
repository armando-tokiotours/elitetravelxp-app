import type { Metadata } from "next";
import { MasterDriverFleetDesk } from "@/components/ops/MasterDriverFleetDesk";

export const metadata: Metadata = {
  title: "Master Driver & Fleet",
  description:
    "Cross-hub chauffeur roster and transit legs for Ops Super Users.",
  robots: { index: false, follow: false },
};

export default function OpsDriversMasterPage() {
  return <MasterDriverFleetDesk />;
}
