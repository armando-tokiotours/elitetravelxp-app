"use client";

import { useEffect, useState } from "react";
import {
  activeBookingRef,
  type BookingStatus,
} from "@/utils/pnr";

/**
 * Booking reference + status — 2/3 ref box, 1/3 status badge (card),
 * or compact stacked layout (inline / print).
 */
export function BookingRefBadge({
  tempBookingRef,
  confirmedBookingRef,
  bookingStatus,
  variant = "card",
}: {
  tempBookingRef: string;
  confirmedBookingRef: string | null;
  bookingStatus: BookingStatus;
  /** card = 2/3+1/3 split; inline = compact stacked for light/print */
  variant?: "card" | "inline";
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);

  const isConfirmed = bookingStatus !== "draft";
  const code = ready
    ? activeBookingRef({
        tempBookingRef,
        confirmedBookingRef,
        bookingStatus,
      })
    : "";

  if (variant === "inline") {
    return (
      <div className="grid w-full grid-cols-3 items-stretch gap-2">
        <div className="col-span-2 flex flex-col justify-center rounded-xl border border-[#E8E2D9] bg-white p-2.5 shadow-sm">
          <span className="block text-[9px] font-bold uppercase tracking-wider text-[#8A8278]">
            Booking Ref
          </span>
          <span
            className="truncate font-mono text-[0.825rem] font-extrabold tracking-widest text-[#0B1F3A] sm:text-[0.96rem]"
            suppressHydrationWarning
          >
            {code || "······"}
          </span>
        </div>
        <div
          className={`col-span-1 flex items-center justify-center rounded-xl border p-1.5 text-center transition-all duration-300 ${
            isConfirmed
              ? "border-emerald-500/60 bg-emerald-950/40 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
              : "border-[#B85304]/50 bg-[#B85304]/20 text-[#D9BB96]"
          }`}
        >
          <span className="text-[9px] font-bold uppercase leading-tight tracking-wider sm:text-[10px]">
            {isConfirmed ? (
              "✓ Confirmed"
            ) : (
              <>
                Draft
                <br />
                (Not Confirmed)
              </>
            )}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="my-0 grid w-full grid-cols-3 items-stretch gap-2">
      <div className="col-span-2 flex flex-col justify-center rounded-xl border border-zinc-800 bg-[#121212] p-2.5 shadow-md">
        <span className="block text-[9px] font-bold uppercase tracking-wider text-zinc-400">
          Booking Ref
        </span>
        <span
          className="truncate text-xs font-extrabold tracking-widest text-white sm:text-sm"
          suppressHydrationWarning
        >
          {code || "······"}
        </span>
      </div>
      <div
        className={`col-span-1 flex items-center justify-center rounded-xl border p-1.5 text-center transition-all duration-300 ${
          isConfirmed
            ? "border-emerald-500/60 bg-emerald-950/40 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
            : "border-[#B85304]/50 bg-[#B85304]/20 text-[#D9BB96]"
        }`}
      >
        <span className="text-[9px] font-bold uppercase leading-tight tracking-wider sm:text-[10px]">
          {isConfirmed ? (
            "✓ Confirmed"
          ) : (
            <>
              Draft
              <br />
              (Not Confirmed)
            </>
          )}
        </span>
      </div>
    </div>
  );
}
