import type { Metadata } from "next";
import { AdminDashboard } from "@/components/team/AdminDashboard";

export const metadata: Metadata = {
  title: "Team Access & Admin",
  description: "Private management portal for bookings and email settings.",
};

export default function AdminPage() {
  return <AdminDashboard />;
}
