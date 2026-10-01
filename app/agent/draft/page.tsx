import type { Metadata } from "next";
import { AgentDraftPage } from "@/components/staff/AgentDraftPage";

export const metadata: Metadata = {
  title: "Draft booking link",
  description: "Staff intake — generate draft PNR magic links for guests.",
  robots: { index: false, follow: false },
};

export default function AgentDraftRoutePage() {
  return <AgentDraftPage />;
}
