import type { Metadata } from "next";
import { BookingMasterApp } from "@/components/staff/BookingMasterApp";

export const metadata: Metadata = {
  title: "Booking master",
  description: "Assemble ops pockets by PNR.",
  robots: { index: false, follow: false },
};

export default function BookingMasterPage() {
  return <BookingMasterApp />;
}
