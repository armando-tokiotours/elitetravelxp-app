import type { Metadata } from "next";
import { OpsMoneyApp } from "@/components/staff/OpsMoneyApp";

export const metadata: Metadata = {
  title: "Money & pay",
  description: "Owner-only guide/driver pay and ticket costs.",
  robots: { index: false, follow: false },
};

export default function OpsMoneyPage() {
  return <OpsMoneyApp />;
}
