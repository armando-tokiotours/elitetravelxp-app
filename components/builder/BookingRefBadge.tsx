"use client";

import { useEffect, useState } from "react";
import {
  activeBookingRef,
  bookingRefBadgeLabel,
  bookingRefFieldLabel,
  normalizeBookingStatus,
  type BookingStatus,
} from "@/utils/pnr";

/**
 * Booking reference + status — 2/3 ref box, 1/3 status badge (card),
 * or compact stacked layout (inline / print).
 *
 * Pre-contact drafts show "Draft Booking Ref" + DRAFT-XXXXXX.
 * After guest contact / confirm, label becomes "Booking Ref" + JPN-XXXXXX.
 */
export function BookingRefBadge({
  tempBookingRef,
  confirmedBookingRef,
  bookingStatus,
  hasGuestContact,
  variant = "card",
  paymentLabel,
}: {
  tempBookingRef: string;
  confirmedBookingRef: string | null;
  bookingStatus: BookingStatus;
  /** True once guest email (and optionally name) is known. */
  hasGuestContact?: boolean;
  /** card = 2/3+1/3 split; inline = compact stacked for light/print */
  variant?: "card" | "inline";
  /**
   * Saved payment milestone (e.g. "Fee credit applied (€60)").
   * When set it replaces the lifecycle badge — a fee/30%/fully-paid
   * booking must never read "Draft (Not Confirmed)".
   */
  paymentLabel?: string | null;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);

  const status = normalizeBookingStatus(bookingStatus);
  const code = ready
    ? activeBookingRef({
        tempBookingRef,
        confirmedBookingRef,
        bookingStatus: status,
      })
    : "";

  const fieldLabel = bookingRefFieldLabel({
    tempBookingRef,
    confirmedBookingRef,
    bookingStatus: status,
    hasGuestContact,
  });

  const badgeTone = paymentLabel
    ? "border-emerald-500/60 bg-emerald-950/40 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
    : status === "confirmed"
      ? "border-emerald-500/60 bg-emerald-950/40 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
      : status === "in_progress"
        ? "border-[#075473]/50 bg-[#075473]/15 text-[#075473]"
        : "border-[#075473]/50 bg-[#075473]/20 text-[#075473]";

  const label = paymentLabel ? (
    paymentLabel
  ) : status === "draft" ? (
    <>
      Draft
      <br />
      (Not Confirmed)
    </>
  ) : status === "confirmed" ? (
    "✓ Confirmed"
  ) : (
    "In Progress"
  );

  if (variant === "inline") {
    return (
      <div className="grid w-full grid-cols-3 items-stretch gap-2">
        <div className="col-span-2 flex flex-col justify-center rounded-xl border border-white/10 bg-[#0D1117]/80 p-2.5 shadow-sm print:border-[#E8E2D9] print:bg-white">
          <span className="block text-[9px] font-bold uppercase tracking-wider text-white/50 print:text-[#8A8278]">
            {fieldLabel}
          </span>
          <span
            className="truncate font-mono text-[0.825rem] font-extrabold tracking-widest text-[#F6A724] sm:text-[0.96rem] print:text-[#0B1F3A]"
            suppressHydrationWarning
          >
            {code || "······"}
          </span>
        </div>
        <div
          className={`col-span-1 flex items-center justify-center rounded-xl border p-1.5 text-center transition-all duration-300 ${badgeTone}`}
        >
          <span className="text-[9px] font-bold uppercase leading-tight tracking-wider sm:text-[10px]">
            {paymentLabel ? (
              paymentLabel
            ) : status === "draft" ? (
              <>
                Draft
                <br />
                (Not Confirmed)
              </>
            ) : (
              bookingRefBadgeLabel(status)
            )}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="my-0 grid w-full grid-cols-3 items-stretch gap-2">
      <div className="col-span-2 flex flex-col justify-center rounded-xl border border-zinc-800 bg-[#23262c] p-2.5 shadow-md">
        <span className="block text-[9px] font-bold uppercase tracking-wider text-zinc-400">
          {fieldLabel}
        </span>
        <span
          className="truncate font-mono text-xs font-extrabold tracking-widest text-[#F6A724] sm:text-sm"
          suppressHydrationWarning
        >
          {code || "······"}
        </span>
      </div>
      <div
        className={`col-span-1 flex items-center justify-center rounded-xl border p-1.5 text-center transition-all duration-300 ${badgeTone}`}
      >
        <span className="text-[9px] font-bold uppercase leading-tight tracking-wider sm:text-[10px]">
          {label}
        </span>
      </div>
    </div>
  );
}
