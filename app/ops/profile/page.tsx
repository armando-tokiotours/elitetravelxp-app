import type { Metadata } from "next";
import { StaffProfileApp } from "@/components/staff/StaffProfileApp";

export const metadata: Metadata = {
  title: "Ops profile",
  description:
    "Super User admin profile — name, photo, languages (existing staff profile editor).",
  robots: { index: false, follow: false },
};

/** Alias of /profile — same StaffProfileApp, no secret/API key editors. */
export default function OpsProfilePage() {
  return <StaffProfileApp />;
}
