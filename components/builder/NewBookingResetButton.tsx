"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { useBuilderStore } from "@/store/useBuilderStore";
import { useBuilderEStore } from "@/store/useBuilderEStore";
import { useItineraryStore } from "@/store/useItineraryStore";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";
import { activeBookingRef } from "@/utils/pnr";
import { ResetBookingModal } from "@/components/builder/modals/ResetBookingModal";
import { performFullBookingReset } from "@/lib/useBookingSync";
import { showSystemMessage } from "@/store/useSystemMessageStore";

type NewBookingResetVariant = "icon" | "nav";
type NewBookingResetScope = "full" | "builder-e";

/**
 * Restart control: purge booking state, mint a fresh JPN- PNR.
 *
 * - `full` — Multiday / Single-Day wipe + return home
 * - `builder-e` — clear Builder E cart/draft; optionally keep guest
 */
export function NewBookingResetButton({
  variant = "icon",
  scope = "full",
}: {
  variant?: NewBookingResetVariant;
  scope?: NewBookingResetScope;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const tempBookingRef = useBuilderStore((s) => s.tempBookingRef);
  const confirmedBookingRef = useBuilderStore((s) => s.confirmedBookingRef);
  const bookingStatus = useBuilderStore((s) => s.bookingStatus);

  const builderERef = useBuilderEStore((s) => s.bookingRef);
  const builderEName = useBuilderEStore((s) => s.guestName);
  const builderEEmail = useBuilderEStore((s) => s.guestEmail);
  const resetBuilderE = useBuilderEStore((s) => s.reset);

  const itName = useItineraryStore((s) => s.clientName);
  const itEmail = useItineraryStore((s) => s.clientEmail);
  const preName = usePreBuilderStore((s) => s.fullName);
  const preEmail = usePreBuilderStore((s) => s.email);

  const bookingRef =
    scope === "builder-e"
      ? builderERef
      : activeBookingRef({
          tempBookingRef,
          confirmedBookingRef,
          bookingStatus,
        });

  const guestName =
    scope === "builder-e"
      ? builderEName || itName || preName || ""
      : itName || preName || "";
  const guestEmail =
    scope === "builder-e"
      ? builderEEmail || itEmail || preEmail || ""
      : itEmail || preEmail || "";

  const handleConfirm = async (keepSameGuest: boolean) => {
    setBusy(true);
    try {
      if (scope === "builder-e") {
        const prev = builderERef || "draft";
        resetBuilderE({ keepGuest: keepSameGuest });
        setOpen(false);
        showSystemMessage({
          text: keepSameGuest
            ? `New request started · previous draft ${prev} deleted (not saved). Same guest kept.`
            : `New request started · previous draft ${prev} deleted (not saved).`,
          tone: "info",
        });
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        return;
      }

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
    "flex w-full items-center justify-center gap-1 rounded-xl border border-[#D91147]/55 bg-[#D91147]/20 px-2 py-2 text-[10px] font-bold tracking-wider text-[#D91147] uppercase transition-all hover:bg-[#D91147]/30 active:scale-95 disabled:opacity-50 sm:text-[11px]";

  return (
    <>
      <button
        type="button"
        aria-label="New request"
        title="New request"
        disabled={busy}
        onClick={() => setOpen(true)}
        className={variant === "nav" ? navBtn : iconBtn}
      >
        {busy ? (
          <Loader2
            className={`shrink-0 animate-spin ${variant === "nav" ? "h-3.5 w-3.5 text-[#D91147]" : "h-4 w-4"}`}
            aria-hidden
          />
        ) : (
          <RotateCcw
            className={`shrink-0 ${variant === "nav" ? "h-3.5 w-3.5 text-[#D91147]" : "h-4 w-4"}`}
            aria-hidden
          />
        )}
        {variant === "nav" ? <span aria-hidden>+</span> : null}
      </button>
      <ResetBookingModal
        open={open}
        bookingRef={bookingRef}
        busy={busy}
        guestName={guestName}
        guestEmail={guestEmail}
        onClose={() => (!busy ? setOpen(false) : undefined)}
        onConfirm={(keepSameGuest) => void handleConfirm(keepSameGuest)}
      />
    </>
  );
}
