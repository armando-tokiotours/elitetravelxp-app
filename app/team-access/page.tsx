import type { Metadata } from "next";
import { TeamAccessApp } from "@/components/team/TeamAccessApp";

export const metadata: Metadata = {
  title: "Team Access",
  description: "Admin dashboard for Source of Truth and Rules of Logic.",
};

export default function TeamAccessPage() {
  return <TeamAccessApp />;
}
