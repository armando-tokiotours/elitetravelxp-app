import type { Metadata } from "next";
import { OpsBoardApp } from "@/components/staff/OpsBoardApp";

export const metadata: Metadata = {
  title: "Ops board",
  description: "Assign guide, driver, and ticketer by PNR.",
  robots: { index: false, follow: false },
};

export default function OpsPage() {
  return <OpsBoardApp />;
}
