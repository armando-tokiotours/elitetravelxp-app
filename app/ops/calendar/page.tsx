import type { Metadata } from "next";
import { OpsCalendarApp } from "@/components/ops/OpsCalendarApp";

export const metadata: Metadata = {
  title: "Operations Calendar",
  description:
    "Year / month / week / day ops calendar — tours & transfers by payment and dispatch status.",
  robots: { index: false, follow: false },
};

export default function OpsCalendarPage() {
  return <OpsCalendarApp />;
}
