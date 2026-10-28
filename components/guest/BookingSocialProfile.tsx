"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { CatalogSlotImg } from "@/components/catalog/CatalogSlotPhoto";
import { paymentBadgeForAmount } from "@/lib/balanceSettlement";
import type { PassHeroBookingType } from "@/components/guest/LiquidGlassHero";
import { MobileAppNav } from "@/components/navigation/AppSidebar";
import {
  catalogMediaWebUrl,
  ensureCatalogPlaceholder,
} from "@/lib/catalogMedia";
import { getPocketBase } from "@/lib/pocketbase/client";
import { normalizeDateIso } from "@/store/useBuilderStore";

const MASCOT_BY_TYPE: Record<PassHeroBookingType, string> = {
  SINGLE_DAY: "/brand/1-day-pass-ico.png",
  MULTI_DAY: "/brand/multy-day-icon.png",
  VIP_CONCIERGE: "/brand/1-day-pass-ico.png",
};

/** Two-line header product subtitle (not the city). */
const PRODUCT_SUBTITLE_BY_TYPE: Record<PassHeroBookingType, string> = {
  SINGLE_DAY: "1-Day Express Pass",
  MULTI_DAY: "Japan Journey",
  VIP_CONCIERGE: "VIP Access",
};

const MONTHS_UPPER = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

function formatSocialDay(iso: string): string | null {
  const ymd = normalizeDateIso(iso);
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return null;
  return `${MONTHS_UPPER[m - 1]} ${d}, ${y}`;
}

/**
 * Social-hero tour dates: `OCT 24, 2026` or `OCT 24 - OCT 28, 2026`.
 * Unset → `DATE TBD`.
 */
export function formatSocialTourDates(
  startIso?: string | null,
  endIso?: string | null
): string {
  const start = startIso ? formatSocialDay(startIso) : null;
  if (!start) return "DATE TBD";
  const end = endIso ? formatSocialDay(endIso) : null;
  if (!end || end === start) return start;
  // Same year: "OCT 24 - OCT 28, 2026"
  const startYmd = normalizeDateIso(startIso);
  const endYmd = normalizeDateIso(endIso);
  if (startYmd && endYmd && startYmd.slice(0, 4) === endYmd.slice(0, 4)) {
    const [y, m, d] = startYmd.split("-").map(Number);
    const startShort = `${MONTHS_UPPER[m - 1]} ${d}`;
    return `${startShort} - ${end}`;
  }
  return `${start} - ${end}`;
}

/**
 * Resolve cover URL for the selected city.
 * Explicit `coverPhoto` wins; otherwise `{cityId}_1` catalog slot —
 * never a borrowed Tokyo stock photo for another city.
 */
export function resolveBookingCoverPhoto(opts?: {
  coverPhoto?: string | null;
  cityId?: string | null;
}): string {
  if (opts?.coverPhoto?.trim()) return opts.coverPhoto.trim();
  const id = opts?.cityId?.trim();
  return id ? catalogMediaWebUrl(id, 1) : "";
}

/** Uppercase city label for cover overlay; empty → TOKYO. */
export function formatSocialCityLabel(cityName?: string | null): string {
  const raw = cityName?.trim();
  if (!raw) return "TOKYO";
  return raw.toUpperCase();
}

/**
 * Sticky/glossy top nav for the social booking hero.
 * Starts false on server + first paint; only updates after mount (hydration-safe).
 * Threshold 20px. Capture-phase scroll listens for itinerary pages that scroll
 * inside `.builder-theme` (overflow-x-hidden → overflow-y auto), not window.
 */
function useBookingProfileHeaderScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let rafId = 0;

    const readTop = () => {
      const docTop = document.scrollingElement?.scrollTop ?? 0;
      const theme = document.querySelector(".builder-theme");
      const themeTop =
        theme instanceof HTMLElement ? theme.scrollTop : 0;
      return Math.max(window.scrollY || 0, docTop, themeTop);
    };

    const compute = () => {
      rafId = 0;
      const top = readTop();
      setScrolled((prev) => {
        const next = top > 20;
        return prev === next ? prev : next;
      });
    };

    const schedule = () => {
      if (!rafId) rafId = window.requestAnimationFrame(compute);
    };

    compute();
    document.addEventListener("scroll", schedule, {
      capture: true,
      passive: true,
    });
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      document.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("scroll", schedule);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return scrolled;
}

/**
 * Social-media-format booking hero for itinerary pages.
 * Classic header parallax: sticky cover (fixed height), dark overlay slides over.
 */
export function BookingSocialProfile({
  pnr,
  guestName,
  guestEmail,
  bookingType = "SINGLE_DAY",
  depositAmount = 0,
  packageTotalEur = 0,
  payLabel,
  onPayContinue,
  onSave,
  coverPhoto,
  cityId,
  cityName,
  tourDate,
  invoiceActive = false,
  locked = false,
  onPlan,
  onInvoice,
  brandTitle = "Itinerary",
}: {
  pnr: string;
  guestName?: string;
  guestEmail?: string;
  bookingType?: PassHeroBookingType;
  /** Total paid toward tour (ops_hub.total_paid_eur). */
  depositAmount?: number;
  packageTotalEur?: number;
  /** Existing CTA copy (Secure Dates / Pay Balance / …). */
  payLabel?: string;
  onPayContinue: () => void;
  onSave?: () => void;
  /** Explicit cover URL override (rare); otherwise catalog `{cityId}_1`. */
  coverPhoto?: string;
  /** PocketBase cities record id — cover is `/uploads/catalog/{cityId}_1.webp`. */
  cityId?: string;
  /** Tour city — shown uppercase as large bottom-left cover overlay. */
  cityName?: string;
  /** Pre-formatted tour dates (`OCT 24 - OCT 28, 2026`); unset → DATE TBD. */
  tourDate?: string;
  /** Plan/Invoice toggle state (mirrors page chrome). */
  invoiceActive?: boolean;
  locked?: boolean;
  onPlan?: () => void;
  onInvoice?: () => void;
  /** Brand title for the full-screen mobile menu overlay. */
  brandTitle?: string;
}) {
  const isScrolled = useBookingProfileHeaderScrolled();
  const amountPaid = Math.max(0, Math.round(Number(depositAmount) || 0));
  const badge = paymentBadgeForAmount(amountPaid, packageTotalEur);
  const mascotSrc = MASCOT_BY_TYPE[bookingType];
  const productSubtitle = PRODUCT_SUBTITLE_BY_TYPE[bookingType];
  const clientName = guestName?.trim() || "GUEST";
  const clientEmail = guestEmail?.trim() || "";
  const bookingRef = pnr?.trim() || "—";
  const pillLabel =
    payLabel?.replace(/\s*▶\s*$/u, "").trim() || "Pay Now";
  const showPayCta = !badge.fullyPaid;
  const coverCityId = cityId?.trim() || "";
  const coverOverride = coverPhoto?.trim() || "";
  const locationTitle = formatSocialCityLabel(cityName);
  const coverAlt = cityName?.trim()
    ? `${cityName.trim()} city cover`
    : "Destination cover";
  const tourDatesLabel = tourDate?.trim() || "DATE TBD";
  const showCoverChrome = Boolean(onPlan || onInvoice);
  const menuBrandTitle =
    brandTitle && brandTitle !== "Itinerary" ? brandTitle : productSubtitle;

  // Self-heal: stamp this city's own `{cityId}_1` placeholder if missing
  // (staff-authed server-side; silent no-op for guests / existing photos).
  useEffect(() => {
    if (!coverCityId) return;
    const token = getPocketBase().authStore.token || "";
    void ensureCatalogPlaceholder(
      coverCityId,
      cityName?.trim() || coverCityId,
      token
    ).catch(() => false);
  }, [coverCityId, cityName]);

  return (
    <div className="relative w-full bg-[#060A0F] font-sans print:hidden">
      {/* Fixed top nav — transparent over cover, glossy on scroll */}
      <header
        data-scrolled={isScrolled ? "true" : "false"}
        className={`fixed top-0 right-0 left-0 z-[100] transition-[background-color,backdrop-filter,border-color] duration-300 ease-out lg:left-16 ${
          isScrolled
            ? "border-b border-white/10 bg-[#060A0F]/85 backdrop-blur-md"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <nav
          className="flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-6"
          aria-label="Booking"
        >
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <MobileAppNav
              brandEyebrow="TOKIOTOURS"
              brandTitle={menuBrandTitle}
              hideManageBooking
            />
            <div className="min-w-0">
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.28em] text-cyan-300">
                TokioTours
              </p>
              <h1 className="truncate font-display text-sm leading-tight text-white sm:text-base">
                {productSubtitle}
              </h1>
            </div>
          </div>

          {showCoverChrome ? (
            <div className="flex shrink-0 items-center gap-2">
              <div
                className={`flex rounded-full border p-1 backdrop-blur-md transition-colors ${
                  isScrolled
                    ? "border-white/15 bg-white/5"
                    : "border-white/20 bg-black/40"
                }`}
              >
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => onPlan?.()}
                  className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors sm:px-4 ${
                    !invoiceActive
                      ? "bg-gray-500/30 text-white"
                      : "text-gray-300 hover:text-white"
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  Plan
                </button>
                <button
                  type="button"
                  disabled={locked || !onInvoice}
                  onClick={() => onInvoice?.()}
                  className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors sm:px-4 ${
                    invoiceActive
                      ? "bg-gray-500/30 text-white"
                      : "text-gray-300 hover:text-white"
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  Invoice
                </button>
              </div>
            </div>
          ) : null}
        </nav>
      </header>

      {/* Sticky cover — locks at top for its height while content scrolls over */}
      <div className="sticky top-0 w-full h-[280px] md:h-[320px] z-0 overflow-hidden">
        {coverCityId ? (
          <CatalogSlotImg
            recordId={coverCityId}
            fallbackSrc={coverOverride}
            alt={coverAlt}
            className="absolute inset-0 h-full w-full object-cover"
            emptyClassName="absolute inset-0 h-full w-full bg-gradient-to-br from-[#1a3355] to-[#0B1F3A]"
          />
        ) : coverOverride ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverOverride}
            alt={coverAlt}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-br from-[#1a3355] to-[#0B1F3A]"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/40" />
        <div className="absolute bottom-12 right-6 z-10">
          <h2 className="font-display text-4xl font-black uppercase tracking-wide text-white drop-shadow-lg sm:text-5xl md:text-6xl">
            {locationTitle}
          </h2>
        </div>
      </div>

      {/* Solid teal overlay — slides over sticky cover; white profile card nested inside */}
      <div className="relative z-10 bg-[#075473] rounded-t-[32px] -mt-10 w-full pb-10">
        <div className="mb-4 rounded-t-[32px] bg-white px-6 pb-6 shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">
          {/* Avatar alone on the cover seam — no action buttons here */}
          <div className="mb-2 flex items-end justify-between">
            <div className="relative z-20 -mt-14">
              <div className="relative flex h-24 w-24 items-end justify-center overflow-visible rounded-full border-[5px] border-white bg-gradient-to-b from-[#00E5FF] to-[#008080] shadow-xl md:h-28 md:w-28">
                <div className="pointer-events-none absolute bottom-0 z-20 h-[130%] w-[110%]">
                  <Image
                    src={mascotSrc}
                    alt="Mascot Avatar"
                    fill
                    className="object-contain object-bottom drop-shadow-xl"
                    sizes="112px"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            {/* Guest text left + Secure Dates / bookmark right */}
            <div className="mt-2 mb-6 flex w-full items-center justify-between">
              <div>
                <h1 className="text-2xl font-black uppercase tracking-wide text-[#060A0F] md:text-3xl">
                  {clientName}
                </h1>
                {clientEmail ? (
                  <p className="text-sm text-gray-500">{clientEmail}</p>
                ) : (
                  <p className="text-sm text-gray-500">Add contact to save</p>
                )}
              </div>

              {showPayCta || onSave ? (
                <div className="flex items-center gap-3">
                  {showPayCta ? (
                    <button
                      type="button"
                      onClick={onPayContinue}
                      className="rounded-full bg-[#060A0F] px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-70"
                    >
                      {pillLabel}
                    </button>
                  ) : null}
                  {onSave ? (
                    <button
                      type="button"
                      onClick={onSave}
                      aria-label="Save booking"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-[#060A0F] transition-colors hover:bg-gray-50"
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
                        />
                      </svg>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-zinc-200 pt-6">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-lg font-bold tracking-wider text-[#060A0F] md:text-xl">
                  {bookingRef}
                </span>
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                  Booking Number
                </span>
              </div>

              <div className="flex min-w-0 flex-col">
                <span className="truncate text-lg font-bold tracking-wider text-[#060A0F] md:text-xl">
                  {tourDatesLabel}
                </span>
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                  Tour Dates
                </span>
              </div>
            </div>

            {badge.kind !== "none" ? (
              <div className="mt-4">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-3.5 py-2 text-xs font-bold uppercase text-emerald-300">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-extrabold text-black">
                    ✓
                  </span>
                  {badge.label}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
