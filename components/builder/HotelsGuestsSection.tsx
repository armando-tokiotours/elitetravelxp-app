"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BedDouble,
  CheckCircle2,
  ChevronRight,
  Pencil,
} from "lucide-react";
import type { PbAccommodation, PbCity } from "@/lib/pocketbase/client";
import { fetchAccommodations } from "@/lib/pocketbase/client";
import { buildCityMap, getCityName } from "@/lib/cityLabels";
import { CityThumb } from "./CityThumb";
import { isBuilderStepComplete } from "@/lib/builderSteps";
import {
  useBuilderStore,
  normalizeCityHotelPref,
  type CityHotelPref,
} from "@/store/useBuilderStore";
import {
  calculateRoomRequirements,
  formatHotelRoomsSummary,
  getHotelAllocationStatus,
  suggestedHotelRooms,
  totalHotelRooms,
} from "@/lib/hotelCalculator";
import { BoxGradingGlow } from "@/components/branding/BoxGradingGlow";
import { GoldLight } from "@/components/branding/GoldLight";
import { SectionBlock } from "./ui";
import { SectionContinue } from "./SectionContinue";
import { useLazyModalMount } from "./modals/useLazyModalMount";

const HotelsEditorModal = dynamic(
  () =>
    import("./modals/HotelsEditorModal").then((m) => ({
      default: m.HotelsEditorModal,
    })),
  { ssr: false }
);

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

export function HotelsGuestsSection({
  cities,
  maxAdultsPerRoom = 3,
  onAccommodationsLoaded,
}: {
  cities: PbCity[];
  maxAdultsPerRoom?: number;
  /** Sync loaded hotel matrix into parent BuilderConfig for quote calc */
  onAccommodationsLoaded?: (rows: PbAccommodation[]) => void;
}) {
  const [accommodations, setAccommodations] = useState<PbAccommodation[]>([]);
  const [hotelsLoading, setHotelsLoading] = useState(false);
  const [isHotelModalOpen, setIsHotelModalOpen] = useState(false);
  const modalMounted = useLazyModalMount(isHotelModalOpen);
  const onLoadedRef = useRef(onAccommodationsLoaded);
  onLoadedRef.current = onAccommodationsLoaded;

  const highestUnlockedStep = useBuilderStore((s) => s.highestUnlockedStep);
  const hotelsStepActive = highestUnlockedStep >= 4;

  useEffect(() => {
    if (!hotelsStepActive) return;
    let cancelled = false;
    setHotelsLoading(true);
    (async () => {
      try {
        const rows = await fetchAccommodations();
        if (cancelled) return;
        setAccommodations(rows);
        onLoadedRef.current?.(rows);
      } catch {
        if (!cancelled) setAccommodations([]);
      } finally {
        if (!cancelled) setHotelsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotelsStepActive]);

  const locations = useBuilderStore((s) => s.locations);
  const cityHotels = useBuilderStore((s) => s.cityHotels);
  const adults = useBuilderStore((s) => s.adults);
  const children = useBuilderStore((s) => s.children);
  const arrivalDate = useBuilderStore((s) => s.arrivalDate);
  const durationDays = useBuilderStore((s) => s.durationDays);
  const arrivalTransferId = useBuilderStore((s) => s.arrivalTransferId);
  const departureTransferId = useBuilderStore((s) => s.departureTransferId);
  const activeSeasonTier = useBuilderStore((s) => s.activeSeasonTier);
  const setCityHotel = useBuilderStore((s) => s.setCityHotel);
  const ensureCityHotels = useBuilderStore((s) => s.ensureCityHotels);
  const setRoomCount = useBuilderStore((s) => s.setRoomCount);

  const orderedCityIds = useMemo(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const loc of locations) {
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

  const cityById = (id: string) => cities.find((c) => c.id === id);
  const cityLabelMap = useMemo(() => buildCityMap(cities), [cities]);
  const cityName = (id: string) => getCityName(id, cityLabelMap);

  const totalGuests = adults + children;
  const roomCapacity = Math.max(
    1,
    Math.min(2, Number(maxAdultsPerRoom) || 2)
  );
  const roomReq = useMemo(
    () => calculateRoomRequirements(totalGuests, roomCapacity),
    [totalGuests, roomCapacity]
  );

  useEffect(() => {
    if (!orderedCityIds.length || totalGuests <= 0) return;
    const suggested = suggestedHotelRooms(totalGuests, roomCapacity);
    for (const id of orderedCityIds) {
      const pref = normalizeCityHotelPref(
        cityHotels[id] || { cityId: id },
        id,
        roomReq?.roomsNeeded ?? 1
      );
      if (!pref.needsHotel) continue;
      if (totalHotelRooms(pref.rooms) === 0) {
        setCityHotel(id, { rooms: suggested });
      }
    }
    const firstHotelCity = orderedCityIds.find(
      (id) => cityHotels[id]?.needsHotel !== false
    );
    if (!firstHotelCity) return;
    const first = cityHotels[firstHotelCity];
    const count = first ? totalHotelRooms(first.rooms) : roomReq?.roomsNeeded;
    if (count && count > 0) setRoomCount(count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalGuests, roomCapacity, orderedCityIds.join("|")]);

  const hotelCities = orderedCityIds.filter(
    (id) => cityHotels[id]?.needsHotel !== false
  );

  const hotelsComplete = isBuilderStepComplete(4, {
    arrivalDate,
    durationDays,
    adults,
    children,
    arrivalTransferId,
    departureTransferId,
    locations,
    cityHotels,
  });

  const overallAllocation = useMemo(() => {
    if (hotelCities.length === 0) {
      return {
        remaining: 0,
        covered: true,
        label: "No hotel needed · Self-arranged (€0)",
      };
    }
    let worstRemaining = 0;
    let allCovered = true;
    for (const id of hotelCities) {
      const pref = normalizeCityHotelPref(
        cityHotels[id] || { cityId: id },
        id
      );
      const status = getHotelAllocationStatus(
        pref.rooms,
        totalGuests,
        pref.standardOccupancy
      );
      if (status.remainingGuests > worstRemaining) {
        worstRemaining = status.remainingGuests;
      }
      if (status.remainingGuests > 0 || status.tone !== "ok") {
        allCovered = false;
      }
    }
    return {
      remaining: worstRemaining,
      covered: allCovered && totalGuests > 0,
      label: allCovered
        ? `All ${totalGuests} guests accommodated`
        : `${worstRemaining} of ${totalGuests} guests unassigned`,
    };
  }, [cityHotels, hotelCities, totalGuests]);

  const summary =
    orderedCityIds.length === 0
      ? "Add locations first"
      : hotelCities.length === 0
        ? `${totalGuests} guest${totalGuests === 1 ? "" : "s"} · No hotel needed (self-arranged €0)`
        : [
            `${totalGuests} guest${totalGuests === 1 ? "" : "s"}`,
            roomReq ? roomReq.breakdownText : null,
            `${hotelCities.length} hotel stop${hotelCities.length === 1 ? "" : "s"}`,
          ]
            .filter(Boolean)
            .join(" · ");

  const monthName = monthNameFromIso(arrivalDate);
  const openEditor = () => setIsHotelModalOpen(true);

  return (
    <SectionBlock
      number={4}
      title="Hotels"
      id="section-hotels"
      icon="hotel"
      summary={summary}
    >
      <p className="mb-3 rounded-xl border border-[#2C2C2E] bg-[#1C1C1E] p-3 text-xs text-zinc-300">
        Self-arranged hotels are free (€0 concierge fee). If you select
        concierge booking, a transparent service fee will be applied to cover
        hotel sourcing and reservation management.
      </p>

      <HotelsSummaryWidget
        orderedCityIds={orderedCityIds}
        cityById={cityById}
        cityName={cityName}
        cityHotels={cityHotels}
        totalGuests={totalGuests}
        overallAllocation={overallAllocation}
        onClick={openEditor}
      />

      {hotelsLoading ? (
        <p className="mt-2 text-center text-xs text-zinc-500">
          Loading hotel rates…
        </p>
      ) : null}

      <button
        type="button"
        onClick={openEditor}
        disabled={orderedCityIds.length === 0 || hotelsLoading}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-[#075473]/50 bg-zinc-950 py-2.5 text-sm font-semibold text-white transition hover:border-[#075473] hover:bg-[#0B1F3A] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden />
        {orderedCityIds.length === 0
          ? "Add cities in Step 3 first"
          : "Edit Hotels"}
      </button>

      <SectionContinue next={5} />

      {modalMounted ? (
      <HotelsEditorModal
        open={isHotelModalOpen}
        onClose={() => setIsHotelModalOpen(false)}
        orderedCityIds={orderedCityIds}
        cityById={cityById}
        cityName={cityName}
        cityHotels={cityHotels}
        accommodations={accommodations}
        monthName={monthName}
        seasonTier={activeSeasonTier}
        totalGuests={totalGuests}
        adults={adults}
        children={children}
        roomReq={roomReq}
        hotelsComplete={hotelsComplete}
        overallAllocation={overallAllocation}
        onChange={(cityId, patch) => setCityHotel(cityId, patch)}
      />
      ) : null}

    </SectionBlock>
  );
}

function HotelsSummaryWidget({
  orderedCityIds,
  cityById,
  cityName,
  cityHotels,
  totalGuests,
  overallAllocation,
  onClick,
}: {
  orderedCityIds: string[];
  cityById: (id: string) => PbCity | undefined;
  cityName: (id: string) => string;
  cityHotels: Record<string, CityHotelPref>;
  totalGuests: number;
  overallAllocation: {
    remaining: number;
    covered: boolean;
    label: string;
  };
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={orderedCityIds.length === 0}
      className="group relative w-full overflow-hidden rounded-[1.35rem] border border-zinc-800 bg-[#1C1C1E] p-4 text-left transition hover:border-[#075473]/45 hover:bg-[#222226] disabled:cursor-not-allowed disabled:opacity-60 sm:p-5"
    >
      <BoxGradingGlow />
      <div className="relative z-10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
            Luxury hotels
          </p>
          <p className="mt-1 font-display text-xl text-white sm:text-2xl">
            {orderedCityIds.length === 0
              ? "No hotel stops yet"
              : `${orderedCityIds.length} cit${orderedCityIds.length === 1 ? "y" : "ies"}`}
          </p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#075473]/15 text-[#075473]">
          <BedDouble className="h-4 w-4" aria-hidden />
        </span>
      </div>

      {orderedCityIds.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {orderedCityIds.map((id) => {
            const pref = normalizeCityHotelPref(
              cityHotels[id] || { cityId: id },
              id
            );
            const mix = formatHotelRoomsSummary(
              pref.rooms,
              pref.standardOccupancy
            );
            return (
            <li
                key={id || `hotel-city-${cityName(id)}`}
                className="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2"
              >
                <GoldLight
                  color="#F6A724"
                  placement="top-center"
                  active={pref.needsHotel}
                />
                <span className="relative z-10 h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                  <CityThumb
                    city={cityById(id)}
                    name={cityName(id)}
                    alt=""
                    thumb="200x200"
                    className="h-full w-full object-cover"
                  />
                </span>
                <span className="relative z-10 min-w-0 flex-1 overflow-hidden">
                  <span className="block break-words text-sm font-semibold leading-tight text-white">
                    {cityName(id)}
                  </span>
                  <span className="block break-words text-[11px] leading-tight text-zinc-500">
                    {pref.needsHotel
                      ? `${pref.starRating}★ · ${mix || "No rooms"} · ${
                          pref.breakfast ? "Breakfast" : "No breakfast"
                        }`
                      : "No hotel needed · Self-arranged (€0)"}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">
          Choose stay cities in Step 3, then configure rooms and breakfast here.
        </p>
      )}

      <div className="mt-4 flex items-end justify-between gap-3 border-t border-zinc-800/80 pt-3">
        <p
          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
            overallAllocation.covered ? "text-emerald-400" : "text-accent-500"
          }`}
        >
          {overallAllocation.covered ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : null}
          {orderedCityIds.length === 0
            ? `${totalGuests} guests · awaiting cities`
            : overallAllocation.label}
        </p>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-zinc-600 transition group-hover:text-[#075473]"
          aria-hidden
        />
      </div>
      </div>
    </button>
  );
}
