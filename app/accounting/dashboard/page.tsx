import type { Metadata } from "next";
import { AccountantFinanceDesk } from "@/components/ops/AccountantFinanceDesk";

export const metadata: Metadata = {
  title: "Accountant · Financial Settlements",
  description:
    "Guide & driver monthly payouts, contractor receipt verification, and agency B2B invoicing.",
  robots: { index: false, follow: false },
};

export default function AccountingDashboardPage() {
  return <AccountantFinanceDesk />;
}
