import type { Metadata } from "next";
import { MasterGuideRosterDesk } from "@/components/ops/MasterGuideRosterDesk";

export const metadata: Metadata = {
  title: "Guide Dispatch & Workload",
  description:
    "Super User guide roster, dispatch jobs, and workload intelligence for Ops.",
  robots: { index: false, follow: false },
};

export default function OpsGuidesMasterPage() {
  return <MasterGuideRosterDesk />;
}
