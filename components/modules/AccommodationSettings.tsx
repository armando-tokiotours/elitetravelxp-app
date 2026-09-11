"use client";

import { HOTEL_TIERS, ROOM_TYPES, type HotelTier } from "@/config/pricing-data";
import { useItineraryStore, totalRooms } from "@/store/useItineraryStore";
import { Counter, ModuleShell, OptionChip, ToggleYesNo } from "./ModuleShell";

export function AccommodationSettings() {
  const needHotels = useItineraryStore((s) => s.needHotels);
  const hotelTier = useItineraryStore((s) => s.hotelTier);
  const rooms = useItineraryStore((s) => s.rooms);
  const setNeedHotels = useItineraryStore((s) => s.setNeedHotels);
  const setHotelTier = useItineraryStore((s) => s.setHotelTier);
  const setRoomCount = useItineraryStore((s) => s.setRoomCount);

  return (
    <ModuleShell
      step={6}
      title="Accommodation Settings"
      description="Select luxury tier and room configuration for your stays."
    >
      <div className="mb-6">
        <p className="mb-3 text-xs uppercase tracking-[0.2em] text-white/45">
          Need Hotels
        </p>
        <ToggleYesNo value={needHotels} onChange={setNeedHotels} />
      </div>

      {needHotels ? (
        <div className="space-y-6 animate-fade-in">
          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-white/45">
              Tier Level
            </p>
            <div className="flex flex-wrap gap-3">
              {HOTEL_TIERS.map((tier) => (
                <OptionChip
                  key={tier.id}
                  selected={hotelTier === tier.id}
                  onClick={() => setHotelTier(tier.id as HotelTier)}
                >
                  {tier.label}
                </OptionChip>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-white/45">
              Room Specs · {totalRooms(rooms)} room
              {totalRooms(rooms) === 1 ? "" : "s"}
            </p>
            <div className="flex flex-col gap-4">
              {ROOM_TYPES.map((rt) => {
                const room = rooms.find((r) => r.type === rt.id);
                return (
                  <div
                    key={rt.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-3"
                  >
                    <span className="text-sm text-white/80">{rt.label}</span>
                    <Counter
                      value={room?.count ?? 0}
                      min={0}
                      max={10}
                      onChange={(n) => setRoomCount(rt.id, n)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </ModuleShell>
  );
}
