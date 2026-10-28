import type { Metadata } from "next";
import { AgentIngestionDesk } from "@/components/ops/AgentIngestionDesk";

export const metadata: Metadata = {
  title: "Agent Ingestion Console",
  description: "Standalone AI CSV ingestion desk for Ops Super Users.",
  robots: { index: false, follow: false },
};

export default function OpsIngestionPage() {
  return <AgentIngestionDesk />;
}
