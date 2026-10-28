import type { Metadata } from "next";
import { OpsMoneyApp } from "@/components/staff/OpsMoneyApp";

export const metadata: Metadata = {
  title: "P&L Financial Ledger",
  description:
    "Executive P&L ledger — guest inflows, contractor outflows, and monthly payouts.",
  robots: { index: false, follow: false },
};

export default function OpsMoneyPage() {
  return <OpsMoneyApp />;
}
