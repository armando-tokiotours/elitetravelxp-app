"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { useBuilderStore } from "@/store/useBuilderStore";
import { useItineraryStore } from "@/store/useItineraryStore";
import { activeBookingRef } from "@/utils/pnr";
import { ResetBookingModal } from "@/components/builder/modals/ResetBookingModal";

/**
 * Header control: confirm, then wipe builder + itinerary state and mint a new TMP- ref.
 * Always returns to /builder Step 1.
 */
export function NewBookingResetButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const resetBuilder = useBuilderStore((s) => s.reset);
  const resetItinerary = useItineraryStore((s) => s.reset);
  const tempBookingRef = useBuilderStore((s) => s.tempBookingRef);
  const confirmedBookingRef = useBuilderStore((s) => s.confirmedBookingRef);
  const bookingStatus = useBuilderStore((s) => s.bookingStatus);

  const bookingRef = activeBookingRef({
    tempBookingRef,
    confirmedBookingRef,
    bookingStatus,
  });

  const handleConfirm = () => {
    resetItinerary();
    resetBuilder();
    setOpen(false);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    router.replace("/builder");
  };

  return (
    <>
      <button
        type="button"
        aria-label="Start New Booking (Reset)"
        title="Start New Booking (Reset)"
        onClick={() => setOpen(true)}
        className="flex shrink-0 cursor-pointer items-center justify-center self-stretch rounded-lg border border-zinc-800 bg-[#1C1C1E] p-2 text-zinc-400 transition-all hover:border-red-500/50 hover:bg-red-950/20 hover:text-red-400"
      >
        <RotateCcw className="h-4 w-4" aria-hidden />
      </button>
      <ResetBookingModal
        open={open}
        bookingRef={bookingRef}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
}
