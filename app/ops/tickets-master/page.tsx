import type { Metadata } from "next";
import { TicketsMasterDesk } from "@/components/ops/TicketsMasterDesk";

export const metadata: Metadata = {
  title: "Tickets Master · Procurement",
  description:
    "Executive ticket procurement command center — payment locks, buy queue, and voucher PDFs.",
  robots: { index: false, follow: false },
};

export default function OpsTicketsMasterPage() {
  return <TicketsMasterDesk />;
}
