import type { Metadata } from "next";
import { OpsBoardApp } from "@/components/staff/OpsBoardApp";

export const metadata: Metadata = {
  title: "Ops inquiries",
  description:
    "Email-style ops inbox: assign guide, payout, tickets, and status by PNR.",
  robots: { index: false, follow: false },
};

export default function OpsPage() {
  return <OpsBoardApp />;
}
