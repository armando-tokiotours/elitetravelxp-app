"use client";

import {
  activeBookingRef,
  bookingRefBadgeLabel,
  type BookingStatus,
} from "@/utils/pnr";

/**
 * Booking reference chip — draft TMP (amber) vs official JPN (emerald).
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
  /** card = dossier navy header; inline = light backgrounds */
  variant?: "card" | "inline";
}) {
  const isDraft = bookingStatus === "draft";
  const code = activeBookingRef({
    tempBookingRef,
    confirmedBookingRef,
    bookingStatus,
  });
  const badgeLabel = bookingRefBadgeLabel(bookingStatus);

  const badgeClass = isDraft
    ? "bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 text-xs rounded uppercase font-semibold"
    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-xs rounded uppercase font-semibold";

  const shell =
    variant === "inline"
      ? "text-left"
      : "rounded-lg border border-dashed border-white/20 px-3 py-1.5 text-right";

  return (
    <div className={shell}>
      <p
        className={`text-[0.55rem] uppercase tracking-[0.2em] ${
          variant === "inline" ? "text-[#8A8278]" : "text-[#C4A35A]/80"
        }`}
      >
        Booking Ref
      </p>
      <p
        className={`font-mono text-sm font-semibold tracking-wide ${
          variant === "inline" ? "text-[#0B1F3A]" : "text-[#C4A35A]"
        }`}
      >
        {code}
      </p>
      <p className="mt-1">
        <span className={badgeClass}>{badgeLabel}</span>
      </p>
    </div>
  );
}
