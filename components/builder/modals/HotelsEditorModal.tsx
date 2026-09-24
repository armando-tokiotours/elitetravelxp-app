"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Lock } from "lucide-react";
import type { PbAccommodation, PbCity } from "@/lib/pocketbase/client";
import {
  normalizeCityHotelPref,
  useBuilderStore,
  type CityHotelPref,
  type HotelRoomType,
  type HotelStarRating,
} from "@/store/useBuilderStore";
import { travelStyleTierRules } from "@/lib/preEliteHydrate";
import {
  adjustHotelRoomCount,
  calculateRoomRequirements,
  formatHotelRoomsSummary,
  getHotelAllocationStatus,
  type HotelRoomCounts,
  type StandardOccupancy,
} from "@/lib/hotelCalculator";
import { FieldLabel } from "../ui";
import { ExplainerTriggerButton } from "../ExplainerTriggerButton";
import { CityThumb } from "../CityThumb";
import { CITY_PLACEHOLDER, cityPbImageUrl } from "@/lib/cityMedia";

const ROOM_KEYS: {
  key: keyof HotelRoomCounts;
  label: HotelRoomType;
  capacityLabel: string;
}[] = [
  { key: "standard", label: "Standard", capacityLabel: "1–2 guests" },
  { key: "twin", label: "Twin", capacityLabel: "2 guests" },
  { key: "superior", label: "Superior", capacityLabel: "2 guests" },
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function monthNameFromIso(iso: string | null): string | null {
  if (!iso) return null;
  const parts = iso.split("-").map(Number);
  const month = parts[1];
  if (!month || month < 1 || month > 12) return null;
  return MONTHS[month - 1];
}

function normalizeStar(raw: unknown): string {
  const s = String(raw || "").toLowerCase();
  if (s.includes("3")) return "3-star";
  if (s.includes("4")) return "4-star";
  if (s.includes("5")) return "5-star";
  return "";
}

function normalizeRoom(raw: unknown): string {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "twin") return "Twin";
  if (s === "superior") return "Superior";
  if (s === "standard") return "Standard";
  return String(raw || "").trim();
}

function normalizeBreakfast(raw: unknown): "Included" | "Not Included" | "" {
  const s = String(raw || "").toLowerCase();
  if (!s) return "";
  if (s.includes("not") || s === "false" || s === "0") return "Not Included";
  if (s.includes("include") || s === "true" || s === "1" || s === "yes")
    return "Included";
  return "";
}

function pricePair(a: PbAccommodation): { min: number; max: number } | null {
  const min = Number(a.price_min ?? a.min_price_per_night ?? a.min_price);
  const max = Number(a.price_max ?? a.max_price_per_night ?? a.max_price);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) {
    return null;
  }
  return { min, max };
}

/** Score accommodations so UI prefs map 1:1 to the Excel/PB matrix rows. */
function findMatrixRate(
  rows: PbAccommodation[],
  opts: {
    cityId: string;
    starRating: HotelStarRating;
    roomType: HotelRoomType;
    breakfast: boolean;
    monthName: string | null;
    seasonTier: "Low" | "Mid" | "High" | null;
  }
): { min: number; max: number; monthMatched: boolean; tierMatched: boolean } | null {
  const starStr = `${opts.starRating}-star`;
  const breakfastStr = opts.breakfast ? "Included" : "Not Included";
  const roomStr = opts.roomType;

  let best: {
    score: number;
    prices: { min: number; max: number };
    monthMatched: boolean;
    tierMatched: boolean;
  } | null = null;

  for (const a of rows) {
    if (!a.city_id || a.city_id !== opts.cityId) continue;

    const aStar = normalizeStar(a.star_rating || a.tier);
    if (aStar !== starStr) continue;

    const aRoom = normalizeRoom(a.room_type);
    if (aRoom !== roomStr) continue;

    const aBf = normalizeBreakfast(a.breakfast);
    if (aBf && aBf !== breakfastStr) continue;

    const aSeason = String(a.season_tier || "").trim();
    if (opts.seasonTier && aSeason && aSeason !== opts.seasonTier) continue;

    const prices = pricePair(a);
    if (!prices) continue;

    let score = 10;
    const monthMatched = !!(opts.monthName && a.month === opts.monthName);
    const tierMatched = !!(opts.seasonTier && aSeason === opts.seasonTier);

    if (opts.monthName && a.month) {
      if (a.month !== opts.monthName) continue;
      score += 5;
    }
    if (tierMatched) score += 4;
    if (aBf === breakfastStr) score += 2;

    if (!best || score > best.score) {
      best = { score, prices, monthMatched, tierMatched };
    }
  }

  if (!best && opts.seasonTier) {
    return findMatrixRate(rows, { ...opts, seasonTier: null });
  }
  if (!best && opts.monthName) {
    return findMatrixRate(rows, { ...opts, monthName: null });
  }

  if (!best) return null;
  return {
    min: best.prices.min,
    max: best.prices.max,
    monthMatched: best.monthMatched,
    tierMatched: best.tierMatched,
  };
}

export function cityPreviewUrl(city: PbCity | undefined): string {
  return cityPbImageUrl(city, "200x200") || CITY_PLACEHOLDER;
}

function coerceStarRating(raw: unknown): HotelStarRating {
  const n = Number(raw);
  if (n === 3 || n === 4 || n === 5) return n as HotelStarRating;
  const fromStr = normalizeStar(raw);
  if (fromStr === "5-star") return 5;
  if (fromStr === "3-star") return 3;
  return 4;
}

function coerceStandardOccupancy(raw: unknown): StandardOccupancy {
  return Number(raw) === 1 ? 1 : 2;
}

export function HotelsEditorModal({
  open,
  onClose,
  orderedCityIds,
  cityById,
  cityName,
  cityHotels,
  accommodations,
  monthName,
  seasonTier,
  totalGuests,
  adults,
  children,
  roomReq,
  hotelsComplete,
  overallAllocation,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  orderedCityIds: string[];
  cityById: (id: string) => PbCity | undefined;
  cityName: (id: string) => string;
  cityHotels: Record<string, CityHotelPref>;
  accommodations: PbAccommodation[];
  monthName: string | null;
  seasonTier: "Low" | "Mid" | "High" | null;
  totalGuests: number;
  adults: number;
  children: number;
  roomReq: ReturnType<typeof calculateRoomRequirements>;
  hotelsComplete: boolean;
  overallAllocation: {
    remaining: number;
    covered: boolean;
    label: string;
  };
  onChange: (cityId: string, patch: Partial<CityHotelPref>) => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
  }, [open]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence
      onExitComplete={() => {
        document.body.style.overflow = "";
      }}
    >
      {open ? (
        <motion.div
          key="hotels-editor"
          className="fixed inset-0 z-50 flex items-center justify-center tokio-modal-backdrop bg-[#05080C]/55 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Edit hotels"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="tokio-modal-content relative flex h-[100dvh] w-full flex-col overflow-hidden border border-white/10 md:h-[85vh] md:max-w-2xl md:rounded-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="tokio-modal-chrome flex flex-shrink-0 items-center gap-4 border-b p-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-white transition hover:border-zinc-500"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#075473]">
                  Configure
                </p>
                <h3 className="truncate font-display text-2xl text-white">
                  Hotels
                </h3>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 pb-12">
              <ExplainerTriggerButton
                featureKey="hotel_rooms"
                title="Japanese Hotel Rooms Explained"
              />

              <p className="text-xs text-zinc-500">
                Party size from Step 1:{" "}
                <span className="font-medium text-white">
                  {totalGuests} guest{totalGuests === 1 ? "" : "s"}
                </span>{" "}
                ({adults} adults, {children} children).
                {roomReq ? (
                  <>
                    {" "}
                    Suggested:{" "}
                    <span className="font-medium text-[#075473]">
                      {roomReq.breakdownText}
                    </span>
                  </>
                ) : null}
                {monthName ? (
                  <>
                    {" "}
                    · Rates use{" "}
                    <span className="font-medium text-white">{monthName}</span>
                    {seasonTier ? (
                      <>
                        {" "}
                        ·{" "}
                        <span className="font-medium text-white">
                          {seasonTier} season
                        </span>
                      </>
                    ) : null}
                  </>
                ) : null}
              </p>

              {orderedCityIds.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950 p-4 text-sm text-zinc-400">
                  Choose cities in Step 3 to configure hotels per stop.
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  {orderedCityIds.map((cityId) => (
                    <CityHotelCard
                      key={cityId}
                      cityId={cityId}
                      city={cityById(cityId)}
                      cityName={cityName(cityId)}
                      pref={cityHotels[cityId]}
                      monthName={monthName}
                      seasonTier={seasonTier}
                      totalGuests={totalGuests}
                      accommodations={accommodations.filter(
                        (a) => a.city_id === cityId
                      )}
                      onChange={(patch) => onChange(cityId, patch)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="tokio-modal-chrome flex flex-shrink-0 flex-col gap-3 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div
                className={`rounded-xl px-4 py-3 text-sm font-medium ${
                  overallAllocation.covered
                    ? "bg-emerald-950/90 text-emerald-400"
                    : "bg-accent-950/90 text-accent-500"
                }`}
              >
                {overallAllocation.covered ? (
                  <>✓ {overallAllocation.label}</>
                ) : (
                  <>⚠️ {overallAllocation.label}</>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={!hotelsComplete && orderedCityIds.length > 0}
                className="w-full rounded-full bg-[#0B1F3A] py-3 text-sm font-semibold text-white transition hover:bg-[#143052] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

function CityHotelCard({
  cityId,
  city,
  cityName,
  pref,
  monthName,
  seasonTier,
  totalGuests,
  accommodations,
  onChange,
}: {
  cityId: string;
  city?: PbCity;
  cityName: string;
  pref?: CityHotelPref;
  monthName: string | null;
  seasonTier: "Low" | "Mid" | "High" | null;
  totalGuests: number;
  accommodations: PbAccommodation[];
  onChange: (patch: Partial<CityHotelPref>) => void;
}) {
  const needsHotel = pref?.needsHotel ?? false;
  const preEliteTravelStyle = useBuilderStore((s) => s.preEliteTravelStyle);
  const tierRules = travelStyleTierRules(preEliteTravelStyle);
  const starRating = (() => {
    const coerced = coerceStarRating(pref?.starRating);
    return tierRules.allowedHotelStars.includes(coerced)
      ? coerced
      : tierRules.defaultHotelStar;
  })();
  const rooms: HotelRoomCounts = pref?.rooms ?? {
    standard: 0,
    twin: 0,
    superior: 0,
  };
  const standardOccupancy = coerceStandardOccupancy(pref?.standardOccupancy);
  const breakfast = pref?.breakfast ?? true;
  const allocation = getHotelAllocationStatus(
    rooms,
    totalGuests,
    standardOccupancy
  );
  const mixLabel = formatHotelRoomsSummary(rooms, standardOccupancy);

  const [matrixRate, setMatrixRate] = useState<{
    min: number;
    max: number;
    monthMatched: boolean;
    tierMatched: boolean;
  } | null>(null);

  useEffect(() => {
    if (!needsHotel) {
      setMatrixRate(null);
      return;
    }
    let min = 0;
    let max = 0;
    let monthMatched = false;
    let tierMatched = false;
    let any = false;
    for (const { key, label } of ROOM_KEYS) {
      const qty = rooms[key];
      if (qty <= 0) continue;
      const hit = findMatrixRate(accommodations, {
        cityId,
        starRating,
        roomType: label,
        breakfast,
        monthName,
        seasonTier,
      });
      if (!hit) continue;
      any = true;
      min += hit.min * qty;
      max += hit.max * qty;
      monthMatched = monthMatched || hit.monthMatched;
      tierMatched = tierMatched || hit.tierMatched;
    }
    setMatrixRate(any ? { min, max, monthMatched, tierMatched } : null);
  }, [
    accommodations,
    breakfast,
    cityId,
    monthName,
    needsHotel,
    rooms.standard,
    rooms.twin,
    rooms.superior,
    seasonTier,
    starRating,
  ]);

  const rateHint = matrixRate
    ? `€${matrixRate.min}–€${matrixRate.max}/night`
    : null;

  const bump = (key: keyof HotelRoomCounts, delta: number) => {
    const next = adjustHotelRoomCount(
      rooms,
      key,
      delta,
      totalGuests,
      standardOccupancy
    );
    if (!next) return;
    onChange({ rooms: next });
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900">
      <div className="flex w-full flex-col gap-3 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 w-full items-center gap-3 overflow-hidden">
          <span className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-zinc-700">
            <CityThumb
              city={city}
              name={cityName}
              alt=""
              thumb="200x200"
              className="h-full w-full object-cover"
            />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden">
            <h3 className="break-words text-sm font-semibold leading-tight tracking-wide text-white sm:text-xl sm:font-bold">
              {cityName}
            </h3>
            <p className="break-words text-xs leading-tight text-zinc-400">
              {needsHotel
                ? `Luxury Accommodations · ${starRating}-Star Tier`
                : "No hotel needed · Self-arranged (€0)"}
            </p>
          </div>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center justify-between gap-2.5 text-xs text-zinc-400 sm:justify-end">
          <span className="min-w-0 break-words leading-tight sm:hidden">
            Need a hotel in {cityName}?
          </span>
          <span className="hidden sm:inline">Need a hotel in {cityName}?</span>
          <button
            type="button"
            role="switch"
            aria-checked={needsHotel}
            onClick={() => onChange({ needsHotel: !needsHotel })}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${
              needsHotel ? "bg-[#075473]" : "bg-zinc-700"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-zinc-900 shadow transition ${
                needsHotel ? "left-[1.35rem]" : "left-0.5"
              }`}
            />
          </button>
        </label>
      </div>

      {needsHotel ? (
        <div className="space-y-5 border-t border-zinc-800 px-4 py-4">
          <div>
            <FieldLabel>Star rating</FieldLabel>
            {tierRules.vipHighlight ? (
              <p className="mt-1 text-xs text-[#075473]">
                VIP Bespoke · exclusive 5-star luxury ryokans & hotels
              </p>
            ) : preEliteTravelStyle === "classic_explorer" ? (
              <p className="mt-1 text-xs text-zinc-400">
                Classic Explorer · 3–4★ boutique stays and authentic ryokans
              </p>
            ) : null}
            <div className="mt-1 flex items-center gap-1.5">
              {([1, 2, 3, 4, 5] as const).map((n) => {
                const allowed = tierRules.allowedHotelStars.includes(
                  n as HotelStarRating
                );
                const selected =
                  allowed && starRating >= n && n >= Math.min(...tierRules.allowedHotelStars);
                if (!allowed) {
                  return (
                    <span
                      key={n}
                      title={
                        n === 5 && preEliteTravelStyle === "classic_explorer"
                          ? "Hidden for Classic Explorer — choose 3 or 4★"
                          : n <= 3 && preEliteTravelStyle !== "classic_explorer"
                            ? "Luxury Tier: Minimum 4-Star"
                            : `${n}-star not available for this travel style`
                      }
                      className="relative inline-flex cursor-not-allowed p-0.5 opacity-30"
                      aria-label={`${n}-star locked`}
                    >
                      <StarIcon filled={false} />
                      <Lock
                        className="absolute -right-0.5 -top-0.5 h-3 w-3 text-zinc-400"
                        aria-hidden
                      />
                    </span>
                  );
                }
                return (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n}-star`}
                    aria-pressed={starRating === n}
                    title={`${n}-Star`}
                    onClick={() =>
                      onChange({ starRating: n as HotelStarRating })
                    }
                    className="cursor-pointer p-0.5 text-accent-500 transition"
                  >
                    <StarIcon filled={selected || starRating === n} />
                  </button>
                );
              })}
              <span className="ml-2 text-sm font-medium text-white">
                {starRating}-star
              </span>
            </div>
          </div>

          <div>
            <FieldLabel>Rooms</FieldLabel>
            <div className="mt-2 max-h-[min(50vh,22rem)] overflow-y-auto overscroll-contain rounded-xl">
              <div
                className={`sticky top-0 z-20 mb-3 rounded-lg border-b border-zinc-800 px-3 py-2 shadow-sm backdrop-blur-md ${
                  allocation.remainingGuests > 0
                    ? "bg-accent-950/90 text-accent-500"
                    : allocation.remainingGuests === 0 &&
                        allocation.tone === "ok"
                      ? "bg-emerald-950/90 text-emerald-400"
                      : "bg-zinc-900/90 text-zinc-400"
                }`}
              >
                <p className="text-xs font-medium">
                  {allocation.remainingGuests > 0 ? (
                    <>
                      <span aria-hidden>⚠️ </span>
                      {allocation.remainingGuests} of {allocation.guests} guests
                      unassigned
                    </>
                  ) : allocation.tone === "ok" ? (
                    <>
                      <span aria-hidden>✓ </span>
                      All {allocation.guests} guests accommodated
                    </>
                  ) : (
                    allocation.label
                  )}
                </p>
              </div>

              <div className="space-y-2 pb-4">
                {ROOM_KEYS.map(({ key, label, capacityLabel }) => (
                  <div
                    key={key}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-white">
                          {label}
                        </span>
                        <p className="text-[11px] text-zinc-500">
                          {capacityLabel}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Fewer ${label} rooms`}
                          disabled={rooms[key] <= 0}
                          onClick={() => bump(key, -1)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 text-white disabled:opacity-30"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm font-semibold text-white">
                          {rooms[key]}
                        </span>
                        <button
                          type="button"
                          aria-label={`More ${label} rooms`}
                          disabled={!allocation.canAdd}
                          onClick={() => bump(key, 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 text-white disabled:opacity-30"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {key === "standard" && rooms.standard > 0 ? (
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                          Occupancy
                        </span>
                        {([1, 2] as const).map((occ) => (
                          <button
                            key={occ}
                            type="button"
                            aria-pressed={standardOccupancy === occ}
                            onClick={() =>
                              onChange({ standardOccupancy: occ })
                            }
                            className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                              standardOccupancy === occ
                                ? "bg-[#0B1F3A] text-white ring-1 ring-[#075473]/40"
                                : "bg-zinc-900 text-zinc-400 ring-1 ring-zinc-700 hover:ring-zinc-500"
                            }`}
                          >
                            {occ} Guest{occ === 1 ? "" : "s"}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {mixLabel ? (
              <p className="mt-2 text-xs text-zinc-400">
                Mix: <span className="text-zinc-300">{mixLabel}</span>
              </p>
            ) : null}
          </div>

          <div>
            <FieldLabel>Breakfast</FieldLabel>
            <div className="mt-4 flex items-center gap-3">
              <BreakfastPill
                active={breakfast}
                onClick={() => onChange({ breakfast: true })}
                label="With Breakfast"
                icon="coffee"
                hoverClass="hover:border-accent-500/40"
              />
              <BreakfastPill
                active={!breakfast}
                onClick={() => onChange({ breakfast: false })}
                label="No Breakfast"
                icon="ban"
                hoverClass="hover:border-zinc-500"
              />
            </div>
          </div>

          {rateHint ? (
            <p className="text-xs text-zinc-400">
              Matrix rate hint
              {monthName || seasonTier ? (
                <>
                  {" "}
                  (
                  {[
                    monthName,
                    seasonTier ? `${seasonTier} season` : null,
                    matrixRate?.monthMatched || matrixRate?.tierMatched
                      ? null
                      : "nearest",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  )
                </>
              ) : null}
              :{" "}
              <span className="font-semibold text-white">{rateHint}</span>
              {allocation.totalRooms > 0 ? " total" : ""}
            </p>
          ) : (
            <p className="text-xs text-[#B8B0A4]">
              No matrix rate for {starRating}-star
              {mixLabel ? ` · ${mixLabel}` : ""} ·{" "}
              {breakfast ? "Included" : "Not Included"}
              {monthName ? ` · ${monthName}` : ""}
              {seasonTier ? ` · ${seasonTier}` : ""}. Try another combo or set
              arrival date.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function BreakfastPill({
  active,
  onClick,
  label,
  icon,
  hoverClass,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: "coffee" | "ban";
  hoverClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
        active
          ? "border-accent-500/40 bg-[#0B1F3A] text-white shadow-sm"
          : `border-zinc-700 bg-zinc-900 text-zinc-300 ${hoverClass}`
      }`}
    >
      {icon === "coffee" ? <CoffeeIcon /> : <BanIcon />}
      {label}
    </button>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 3.2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.6 7.2 18.1l.9-5.4L4.2 8.9l5.4-.8L12 3.2z"
        fill={filled ? "#D4AF37" : "none"}
        stroke={filled ? "#D4AF37" : "#D9D2C7"}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CoffeeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 9h11v5a4 4 0 01-4 4H9a4 4 0 01-4-4V9z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M16 10h2a2.5 2.5 0 010 5h-2M8 4v2M11 3v3M14 4v2M4 19h13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BanIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M7 17L17 7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
