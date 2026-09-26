import type { Metadata } from "next";
import { AgentApp } from "@/components/staff/AgentApp";

export const metadata: Metadata = {
  title: "Concierge agent",
  description: "Assigned direct-guest requests for concierge agents.",
  robots: { index: false, follow: false },
};

export default function AgentPage() {
  return <AgentApp />;
}
