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

type NewBookingResetVariant = "icon" | "nav" | "strip" | "menu";
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
  tone = "dark",
  onAfterConfirm,
}: {
  variant?: NewBookingResetVariant;
  scope?: NewBookingResetScope;
  /** `light` = dark icon/border for cream page chrome (strip only). */
  tone?: "dark" | "light";
  /** Called after a confirmed reset completes (e.g. to close a menu drawer the button lives in). Not called on cancel. */
  onAfterConfirm?: () => void;
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
        onAfterConfirm?.();
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
      onAfterConfirm?.();
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

  /** Slim strip variant: icon-only, transparent, thin border — no bulky box. */
  const stripBtn =
    tone === "light"
      ? "flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-transparent p-1.5 text-slate-600 transition-all hover:border-slate-500 hover:text-slate-900 disabled:opacity-50"
      : "flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-transparent p-1.5 text-zinc-400 transition-all hover:border-white/25 hover:text-white disabled:opacity-50";

  /** Full-width card row for the mobile menu drawer — matches the "Your booking" card directly above it. */
  const menuBtn =
    "flex w-full cursor-pointer items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-left transition hover:border-zinc-700 disabled:opacity-50";

  return (
    <>
      <button
        type="button"
        aria-label={variant === "menu" ? "New Booking" : "New request"}
        title={variant === "menu" ? "New Booking" : "New request"}
        disabled={busy}
        onClick={() => setOpen(true)}
        className={
          variant === "nav"
            ? navBtn
            : variant === "strip"
              ? stripBtn
              : variant === "menu"
                ? menuBtn
                : iconBtn
        }
      >
        {variant === "menu" ? (
          <>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#075473]/15 text-accent-500">
              {busy ? (
                <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
              ) : (
                <RotateCcw className="h-5 w-5 shrink-0" aria-hidden />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-white">
                New Booking
              </span>
              <span className="block text-xs text-zinc-400">
                Start a fresh booking from scratch
              </span>
            </span>
          </>
        ) : (
          <>
            {busy ? (
              <Loader2
                className={`shrink-0 animate-spin ${variant === "nav" || variant === "strip" ? "h-3.5 w-3.5" : "h-4 w-4"} ${variant === "nav" ? "text-[#D91147]" : ""}`}
                aria-hidden
              />
            ) : (
              <RotateCcw
                className={`shrink-0 ${variant === "nav" || variant === "strip" ? "h-3.5 w-3.5" : "h-4 w-4"} ${variant === "nav" ? "text-[#D91147]" : ""}`}
                aria-hidden
              />
            )}
            {variant === "nav" ? <span aria-hidden>+</span> : null}
          </>
        )}
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
