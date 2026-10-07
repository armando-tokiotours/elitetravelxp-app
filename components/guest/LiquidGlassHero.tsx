"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { NewBookingResetButton } from "@/components/builder/NewBookingResetButton";
import { ActionPillButton } from "@/components/ui/ActionPillButton";
import { paymentBadgeForAmount } from "@/lib/balanceSettlement";

export type PassHeroBookingType = "SINGLE_DAY" | "MULTI_DAY" | "VIP_CONCIERGE";

const MASCOT_BY_TYPE: Record<PassHeroBookingType, string> = {
  SINGLE_DAY: "/brand/1-day-pass-ico.png",
  MULTI_DAY: "/brand/multy-day-icon.png",
  VIP_CONCIERGE: "/brand/1-day-pass-ico.png",
};

/** Short product tag under the guest name (not the hero headline). */
const PRODUCT_TAG_BY_TYPE: Record<PassHeroBookingType, string> = {
  SINGLE_DAY: "(1-DAY EXPRESS)",
  MULTI_DAY: "(JAPAN JOURNEY)",
  VIP_CONCIERGE: "(VIP ACCESS)",
};

/**
 * Liquid-glass dossier / pass hero.
 * Save · Send · Print live in top chrome; this surface owns pay + ⋮ menu.
 * Badge + CTA derive from PocketBase `amountPaid` (via depositAmount) + package total.
 */
export function LiquidGlassHero({
  pnr,
  guestName,
  bookingType = "SINGLE_DAY",
  depositAmount = 0,
  packageTotalEur = 0,
  payLabel,
  payPulse = false,
  continueHref = "/builder/day-pass",
  locked = false,
  onPlanInvoice,
  onPayContinue,
}: {
  pnr: string;
  /** @deprecated Prefer bookingType-derived title; kept for call-site compat */
  title?: string;
  guestName?: string;
  bookingType?: PassHeroBookingType;
  /** Single source of truth: total paid toward tour (ops_hub.total_paid_eur). */
  depositAmount?: number;
  /** Package estimate — drives 30% / fully-paid badge thresholds. */
  packageTotalEur?: number;
  payLabel?: string;
  payPulse?: boolean;
  continueHref?: string;
  locked?: boolean;
  onSave?: () => void;
  onSend?: () => void;
  onPrint?: () => void;
  /** Opens Plan ↔ Invoice switch from the ⋮ menu */
  onPlanInvoice?: () => void;
  onPayContinue: () => void;
}) {
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const amountPaid = Math.max(0, Math.round(Number(depositAmount) || 0));
  const badge = paymentBadgeForAmount(amountPaid, packageTotalEur);
  const mascotSrc = MASCOT_BY_TYPE[bookingType];
  const productTag = PRODUCT_TAG_BY_TYPE[bookingType];
  const guestHeadline = guestName?.trim() || "Guest";
  const pillLabel = payLabel?.replace(/\s*▶\s*$/u, "").trim() || undefined;
  const showPayCta = !badge.fullyPaid && Boolean(pillLabel);

  useEffect(() => {
    if (!isMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setIsMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [isMenuOpen]);

  return (
    <div className="relative z-40 mx-auto my-4 w-full max-w-5xl print:hidden">
      <div className="glass-panel relative space-y-5 overflow-hidden rounded-3xl border border-white/15 bg-[#0A1017]/80 p-5 text-white shadow-2xl backdrop-blur-2xl sm:p-6">
        <div className="flex flex-col gap-3 overflow-visible border-b border-white/10 pb-4">
          <div className="flex w-full shrink-0 items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3 overflow-visible">
              <div className="relative h-12 w-12 shrink-0 sm:h-14 sm:w-14">
                <Image
                  src={mascotSrc}
                  alt=""
                  width={56}
                  height={56}
                  priority
                  className="absolute inset-0 h-full w-full origin-center scale-[1.44] object-contain drop-shadow-lg"
                />
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] font-black uppercase tracking-widest text-[#F6A724]">
                  {pnr ? `PASS · ${pnr}` : "PASS"}
                </span>
                <h1 className="truncate text-[15px] font-black uppercase leading-tight tracking-wider text-white sm:text-[18px]">
                  {guestHeadline}
                </h1>
                <p className="truncate text-[0.6rem] leading-tight tracking-wide text-white/55">
                  {productTag}
                </p>
              </div>
            </div>

            <div className="relative shrink-0" ref={menuRef}>
              <button
                type="button"
                onClick={() => setIsMenuOpen((v) => !v)}
                className="inline-flex h-[33.5px] w-[33.5px] items-center justify-center rounded-xl border border-white/15 bg-white/5 text-[15px] font-bold text-white transition hover:bg-white/15"
                title="More"
                aria-label="More booking actions"
                aria-expanded={isMenuOpen}
                aria-haspopup="menu"
              >
                ⋮
              </button>

              {isMenuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 z-50 mt-2 w-56 space-y-1 rounded-2xl border border-white/20 bg-[#0D141F]/95 p-2 text-xs shadow-2xl backdrop-blur-2xl"
                >
                  {onPlanInvoice ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onPlanInvoice();
                      }}
                      className="flex w-full items-center rounded-xl px-3 py-2.5 text-left font-semibold text-white/90 transition hover:bg-white/10"
                    >
                      Plan / Invoice
                    </button>
                  ) : null}
                  <Link
                    href={continueHref}
                    role="menuitem"
                    className="flex w-full items-center rounded-xl px-3 py-2.5 font-semibold text-white/90 transition hover:bg-white/10"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Continue editing
                  </Link>
                  <div
                    role="none"
                    className="border-t border-white/10 pt-1"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <NewBookingResetButton scope="full" variant="nav" />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {badge.kind !== "none" ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsAccordionOpen((v) => !v)}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-3.5 py-2 text-xs font-bold uppercase text-emerald-300 transition-all hover:bg-emerald-500/30"
                  aria-expanded={isAccordionOpen}
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-extrabold text-black">
                    ✓
                  </span>
                  <span>{badge.label}</span>
                  <span className="ml-1 text-[10px] text-emerald-400">
                    {isAccordionOpen ? "◀" : "▸"}
                  </span>
                </button>
                {isAccordionOpen ? (
                  <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-gray-300">
                    {badge.fullyPaid
                      ? "Your trip is 100% fully paid. No further action required."
                      : badge.milestone30Met
                        ? "30% progress secured — pay the remaining balance when ready."
                        : "100% credited toward tour balance."}
                  </span>
                ) : null}
              </>
            ) : (
              <button
                type="button"
                onClick={onPayContinue}
                className="text-left text-[11px] font-bold uppercase tracking-wide text-cyan-400 transition hover:text-cyan-300"
              >
                View Pricing Details ▸
              </button>
            )}
          </div>

          {showPayCta ? (
            <div className="shrink-0">
              <ActionPillButton
                conciergeFeePaid={amountPaid > 0}
                onClick={onPayContinue}
                pulse={payPulse}
                label={pillLabel}
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* Invisible when menu closed — keeps NewBooking modal host stable if needed */}
      {locked ? null : null}
    </div>
  );
}

/** Alias matching the PassHeroHeader naming in the design brief. */
export { LiquidGlassHero as PassHeroHeader };
