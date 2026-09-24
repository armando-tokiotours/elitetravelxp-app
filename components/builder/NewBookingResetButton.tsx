"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { useBuilderStore } from "@/store/useBuilderStore";
import { activeBookingRef } from "@/utils/pnr";
import { ResetBookingModal } from "@/components/builder/modals/ResetBookingModal";
import { performFullBookingReset } from "@/lib/useBookingSync";

/**
 * Header control: purge all booking state, mint a fresh JPN- PNR,
 * email Manage Booking access link (when email known), then return home.
 */
export function NewBookingResetButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const tempBookingRef = useBuilderStore((s) => s.tempBookingRef);
  const confirmedBookingRef = useBuilderStore((s) => s.confirmedBookingRef);
  const bookingStatus = useBuilderStore((s) => s.bookingStatus);

  const bookingRef = activeBookingRef({
    tempBookingRef,
    confirmedBookingRef,
    bookingStatus,
  });

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await performFullBookingReset();
      setOpen(false);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      router.replace("/");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="Start New Booking (Reset)"
        title="Start New Booking (Reset)"
        disabled={busy}
        onClick={() => setOpen(true)}
        className="flex shrink-0 cursor-pointer items-center justify-center self-stretch rounded-lg border border-zinc-800 bg-[#1C1C1E] p-2 text-zinc-400 transition-all hover:border-red-500/50 hover:bg-red-950/20 hover:text-red-400 disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <RotateCcw className="h-4 w-4" aria-hidden />
        )}
      </button>
      <ResetBookingModal
        open={open}
        bookingRef={bookingRef}
        busy={busy}
        onClose={() => (!busy ? setOpen(false) : undefined)}
        onConfirm={() => void handleConfirm()}
      />
    </>
  );
}
