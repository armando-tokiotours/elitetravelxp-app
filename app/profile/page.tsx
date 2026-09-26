import type { Metadata } from "next";
import { StaffProfileApp } from "@/components/staff/StaffProfileApp";

export const metadata: Metadata = {
  title: "My profile",
  description: "Staff profile — bio, languages, media, payout details.",
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return <StaffProfileApp />;
}
