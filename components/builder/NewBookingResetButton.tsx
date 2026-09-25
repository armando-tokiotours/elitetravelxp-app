"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { useBuilderStore } from "@/store/useBuilderStore";
import { activeBookingRef } from "@/utils/pnr";
import { ResetBookingModal } from "@/components/builder/modals/ResetBookingModal";
import { performFullBookingReset } from "@/lib/useBookingSync";

type NewBookingResetVariant = "icon" | "nav";

/**
 * Restart control: purge booking state, mint a fresh JPN- PNR,
 * email Manage Booking access link (when email known), then return home.
 *
 * - `icon` — compact square (builder headers)
 * - `nav` — Section 1 hero action bar (“New Booking”)
 */
export function NewBookingResetButton({
  variant = "icon",
}: {
  variant?: NewBookingResetVariant;
}) {
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

  const iconBtn =
    "flex shrink-0 cursor-pointer items-center justify-center self-stretch rounded-lg border border-zinc-800 bg-[#1C1C1E] p-2 text-zinc-400 transition-all hover:border-red-500/50 hover:bg-red-950/20 hover:text-red-400 disabled:opacity-50";

  const navBtn =
    "ml-auto flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/20 px-3 py-2 text-[11px] font-bold tracking-wider text-amber-300 uppercase transition-all hover:bg-amber-500/30 active:scale-95 disabled:opacity-50";

  return (
    <>
      <button
        type="button"
        aria-label="Restart / Start New Booking"
        title="Restart / Start New Booking"
        disabled={busy}
        onClick={() => setOpen(true)}
        className={variant === "nav" ? navBtn : iconBtn}
      >
        {busy ? (
          <Loader2
            className={`shrink-0 animate-spin ${variant === "nav" ? "h-3.5 w-3.5 text-amber-400" : "h-4 w-4"}`}
            aria-hidden
          />
        ) : (
          <RotateCcw
            className={`shrink-0 ${variant === "nav" ? "h-3.5 w-3.5 text-amber-400" : "h-4 w-4"}`}
            aria-hidden
          />
        )}
        {variant === "nav" ? (
          <span className="hidden sm:inline">New Booking</span>
        ) : null}
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
