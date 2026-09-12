"use client";

import { useEffect, useMemo, useState } from "react";
import type { PbAccommodation, PbCity } from "@/lib/pocketbase/client";
import {
  useBuilderStore,
  type CityHotelPref,
  type HotelRoomType,
  type HotelStarRating,
} from "@/store/useBuilderStore";
import { FieldLabel, SectionBlock } from "./ui";
import { SectionContinue } from "./SectionContinue";

const ROOM_TYPES: HotelRoomType[] = ["Standard", "Twin", "Superior"];
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
    // When a global season tier is active, prefer / require matching hotel rows
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

  // Fallbacks: drop season, then month, if no exact matrix hit
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

export function HotelsGuestsSection({
  accommodations,
  cities,
  maxAdultsPerRoom = 3,
}: {
  accommodations: PbAccommodation[];
  cities: PbCity[];
  maxAdultsPerRoom?: number;
}) {
  const locations = useBuilderStore((s) => s.locations);
  const cityHotels = useBuilderStore((s) => s.cityHotels);
  const adults = useBuilderStore((s) => s.adults);
  const children = useBuilderStore((s) => s.children);
  const arrivalDate = useBuilderStore((s) => s.arrivalDate);
  const activeSeasonTier = useBuilderStore((s) => s.activeSeasonTier);
  const setCityHotel = useBuilderStore((s) => s.setCityHotel);
  const ensureCityHotels = useBuilderStore((s) => s.ensureCityHotels);

  const orderedCityIds = useMemo(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const loc of locations) {
      // Arrival/departure waypoints are 0-night — no hotel stop
      if (loc.visitType && loc.visitType !== "stay") continue;
      if (loc.nights <= 0) continue;
      if (!seen.has(loc.cityId)) {
        seen.add(loc.cityId);
        ids.push(loc.cityId);
      }
    }
    return ids;
  }, [locations]);

  useEffect(() => {
    if (orderedCityIds.length) ensureCityHotels(orderedCityIds);
  }, [orderedCityIds, ensureCityHotels]);

  const cityName = (id: string) =>
    cities.find((c) => c.id === id)?.name || "City";

  const totalGuests = adults + children;
  const hotelCities = orderedCityIds.filter(
    (id) => cityHotels[id]?.needsHotel !== false
  );
  const summary =
    orderedCityIds.length === 0
      ? "Add locations first"
      : `${totalGuests} guest${totalGuests === 1 ? "" : "s"} · ${hotelCities.length} hotel stop${hotelCities.length === 1 ? "" : "s"}`;

  const monthName = monthNameFromIso(arrivalDate);

  return (
    <SectionBlock
      number={4}
      title="Hotels"
      id="section-hotels"
      icon="hotel"
      summary={summary}
    >
      <div className="flex flex-col gap-5">
        <p className="text-xs text-[#A39A8E]">
          Party size from Step 1:{" "}
          <span className="font-medium text-[#0B1F3A]">
            {totalGuests} guest{totalGuests === 1 ? "" : "s"}
          </span>{" "}
          ({adults} adults, {children} children). Guidance: max{" "}
          {maxAdultsPerRoom} adults per room.
          {monthName ? (
            <>
              {" "}
              Rates use{" "}
              <span className="font-medium text-[#0B1F3A]">{monthName}</span>
              {activeSeasonTier ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="font-medium text-[#0B1F3A]">
                    {activeSeasonTier} season
                  </span>
                </>
              ) : null}{" "}
              from your arrival date.
            </>
          ) : (
            <> Set an arrival date in Step 1 for month-accurate rates.</>
          )}
        </p>

        {orderedCityIds.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#D9D2C7] bg-[#FBF8F2] p-4 text-sm text-[#8A8278]">
            Choose cities in Step 3 (Locations &amp; Nights) to configure hotels
            per stop.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {orderedCityIds.map((cityId) => (
              <CityHotelCard
                key={cityId}
                cityId={cityId}
                cityName={cityName(cityId)}
                pref={cityHotels[cityId]}
                monthName={monthName}
                seasonTier={activeSeasonTier}
                accommodations={accommodations.filter(
                  (a) => a.city_id === cityId
                )}
                onChange={(patch) => setCityHotel(cityId, patch)}
              />
            ))}
          </div>
        )}
      </div>

      <SectionContinue next={5} label="Continue to Tours" />
    </SectionBlock>
  );
}

function coerceStarRating(raw: unknown): HotelStarRating {
  const n = Number(raw);
  if (n === 3 || n === 4 || n === 5) return n;
  const fromStr = normalizeStar(raw);
  if (fromStr === "3-star") return 3;
  if (fromStr === "5-star") return 5;
  return 4;
}

function CityHotelCard({
  cityId,
  cityName,
  pref,
  monthName,
  seasonTier,
  accommodations,
  onChange,
}: {
  cityId: string;
  cityName: string;
  pref?: CityHotelPref;
  monthName: string | null;
  seasonTier: "Low" | "Mid" | "High" | null;
  accommodations: PbAccommodation[];
  onChange: (patch: Partial<CityHotelPref>) => void;
}) {
  const needsHotel = pref?.needsHotel ?? true;
  const starRating = coerceStarRating(pref?.starRating);
  const roomType: HotelRoomType =
    pref?.roomType === "Twin" || pref?.roomType === "Superior"
      ? pref.roomType
      : "Standard";
  const breakfast = pref?.breakfast ?? true;

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
    const hit = findMatrixRate(accommodations, {
      cityId,
      starRating,
      roomType,
      breakfast,
      monthName,
      seasonTier,
    });
    setMatrixRate(hit);
  }, [
    accommodations,
    breakfast,
    cityId,
    monthName,
    needsHotel,
    roomType,
    seasonTier,
    starRating,
  ]);

  const rateHint = matrixRate
    ? `€${matrixRate.min}–€${matrixRate.max}/night`
    : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E8E2D9] bg-white">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <h3 className="font-display text-xl text-[#0B1F3A]">{cityName}</h3>
        <label className="flex cursor-pointer items-center gap-2.5 text-xs text-[#5C6570]">
          <span className="hidden sm:inline">
            Need a hotel in {cityName}?
          </span>
          <span className="sm:hidden">Hotel?</span>
          <button
            type="button"
            role="switch"
            aria-checked={needsHotel}
            onClick={() => onChange({ needsHotel: !needsHotel })}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${
              needsHotel ? "bg-[#0B1F3A]" : "bg-[#D9D2C7]"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                needsHotel ? "left-[1.35rem]" : "left-0.5"
              }`}
            />
          </button>
        </label>
      </div>

      {needsHotel ? (
        <div className="space-y-5 border-t border-[#EEE8DF] px-4 py-4">
          <div>
            <FieldLabel>Star rating</FieldLabel>
            <div className="mt-1 flex items-center gap-1.5">
              {([3, 4, 5] as HotelStarRating[]).map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n}-star`}
                  aria-pressed={starRating === n}
                  onClick={() => onChange({ starRating: n })}
                  className="p-0.5 transition"
                >
                  <StarIcon filled={starRating >= n} />
                </button>
              ))}
              <span className="ml-2 text-sm font-medium text-[#0B1F3A]">
                {starRating}-star
              </span>
            </div>
          </div>

          <div>
            <FieldLabel>Room type</FieldLabel>
            <div className="mt-1 flex flex-wrap gap-2">
              {ROOM_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onChange({ roomType: t })}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    roomType === t
                      ? "bg-[#0B1F3A] text-white"
                      : "border border-[#D4C9B5] bg-[#FBF8F2] text-[#0B1F3A]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <FieldLabel>Breakfast</FieldLabel>
            <div className="mt-1 grid grid-cols-2 gap-2.5">
              <BreakfastButton
                active={breakfast}
                onClick={() => onChange({ breakfast: true })}
                label="With Breakfast"
                icon="coffee"
              />
              <BreakfastButton
                active={!breakfast}
                onClick={() => onChange({ breakfast: false })}
                label="No Breakfast"
                icon="ban"
              />
            </div>
          </div>

          {rateHint ? (
            <p className="text-xs text-[#8A8278]">
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
              <span className="font-semibold text-[#0B1F3A]">{rateHint}</span>
            </p>
          ) : (
            <p className="text-xs text-[#B8B0A4]">
              No matrix rate for {starRating}-star · {roomType} ·{" "}
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

function BreakfastButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: "coffee" | "ban";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-center transition ${
        active
          ? "border-[#0B1F3A] bg-[#0B1F3A] text-white"
          : "border-[#E8E2D9] bg-[#FBF8F2] text-[#0B1F3A] hover:border-[#C4A35A]"
      }`}
    >
      {icon === "coffee" ? <CoffeeIcon /> : <BanIcon />}
      <span className="text-xs font-semibold sm:text-sm">{label}</span>
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
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
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
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
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
