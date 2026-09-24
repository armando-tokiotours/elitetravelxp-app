"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ManageBookingModal } from "@/components/modals/ManageBookingModal";

/**
 * Deep-link entry for proposal emails:
 * /manage?pnr=JPN-XXXX&email=guest@example.com
 */
export default function ManageBookingPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPnr = useMemo(
    () => String(searchParams.get("pnr") || "").trim().toUpperCase(),
    [searchParams]
  );
  const initialEmail = useMemo(
    () => String(searchParams.get("email") || "").trim().toLowerCase(),
    [searchParams]
  );

  return (
    <div className="tokio-ambient-bg flex min-h-dvh flex-col items-center justify-center px-4 text-white">
      <p className="mb-2 font-godiva text-sm uppercase tracking-[0.3em] text-[#E60F43]">
        TOKIOTOURS
      </p>
      <h1 className="font-godiva text-2xl uppercase tracking-wider">
        Manage Booking
      </h1>
      <p className="mt-2 max-w-sm text-center text-sm text-white/55">
        Enter your booking reference and email to reopen your live itinerary.
      </p>
      <ManageBookingModal
        open
        initialPnr={initialPnr}
        initialEmail={initialEmail}
        onClose={() => router.push("/")}
      />
    </div>
  );
}
