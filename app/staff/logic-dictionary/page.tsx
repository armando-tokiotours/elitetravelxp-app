import type { Metadata } from "next";
import { SystemLogicDictionaryApp } from "@/components/staff/SystemLogicDictionaryApp";

export const metadata: Metadata = {
  title: "System Logic Dictionary",
  description:
    "Read-only reference of hardcoded TokioTours builder rules (routing, transport, tours).",
  robots: { index: false, follow: false },
};

export default function SystemLogicDictionaryPage() {
  return <SystemLogicDictionaryApp />;
}
