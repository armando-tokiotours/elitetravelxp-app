"use client";

import { useEffect, useMemo, useState } from "react";
import type { PbAccommodation } from "@/lib/pocketbase/client";
import { useBuilderStore } from "@/store/useBuilderStore";
import { FieldLabel, PillToggle, SectionBlock, SelectField } from "./ui";

export function HotelsGuestsSection({
  accommodations,
}: {
  accommodations: PbAccommodation[];
}) {
  const needHotels = useBuilderStore((s) => s.needHotels);
  const hotelTier = useBuilderStore((s) => s.hotelTier);
  const roomCount = useBuilderStore((s) => s.roomCount);
  const roomType = useBuilderStore((s) => s.roomType);
  const adults = useBuilderStore((s) => s.adults);
  const children = useBuilderStore((s) => s.children);
  const setNeedHotels = useBuilderStore((s) => s.setNeedHotels);
  const setHotelTier = useBuilderStore((s) => s.setHotelTier);
  const setRoomCount = useBuilderStore((s) => s.setRoomCount);
  const setRoomType = useBuilderStore((s) => s.setRoomType);
  const setAdults = useBuilderStore((s) => s.setAdults);
  const setChildren = useBuilderStore((s) => s.setChildren);

  const [guestOpen, setGuestOpen] = useState(false);

  const roomTypes = useMemo(() => {
    const types = accommodations
      .filter((a) => a.tier === hotelTier)
      .map((a) => a.room_type);
    return [...new Set(types)];
  }, [accommodations, hotelTier]);

  useEffect(() => {
    if (roomTypes.length && !roomTypes.includes(roomType)) {
      setRoomType(roomTypes[0]);
    }
  }, [roomTypes, roomType, setRoomType]);

  const totalGuests = adults + children;

  return (
    <SectionBlock number={3} title="Hotels & Guests" id="section-hotels">
      <div className="flex flex-col gap-5">
        <div>
          <FieldLabel>Need hotels?</FieldLabel>
          <PillToggle value={needHotels} onChange={setNeedHotels} />
        </div>

        {needHotels ? (
          <>
            <div>
              <FieldLabel>Hotel standard</FieldLabel>
              <div className="inline-flex rounded-full border border-[#D9D2C7] bg-[#F7F3EC] p-1">
                {(["4-star", "5-star"] as const).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setHotelTier(tier)}
                    className={`rounded-full px-5 py-1.5 text-sm font-medium transition ${
                      hotelTier === tier
                        ? "bg-[#0B1F3A] text-white"
                        : "text-[#5C6570]"
                    }`}
                  >
                    {tier === "4-star" ? "4 star" : "5 star"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>No of rooms</FieldLabel>
                <SelectField
                  value={String(roomCount)}
                  onChange={(v) => setRoomCount(Number(v) || 1)}
                  options={[1, 2, 3, 4, 5, 6].map((n) => ({
                    value: String(n),
                    label: `${n} room${n === 1 ? "" : "s"}`,
                  }))}
                  placeholder="Rooms"
                />
              </div>
              <div>
                <FieldLabel>Type of room</FieldLabel>
                <SelectField
                  value={roomType}
                  onChange={setRoomType}
                  options={roomTypes.map((t) => ({ value: t, label: t }))}
                  placeholder="Room type"
                />
              </div>
            </div>
          </>
        ) : null}

        <div>
          <FieldLabel>No of guests</FieldLabel>
          <button
            type="button"
            onClick={() => setGuestOpen(true)}
            className="flex w-full items-center justify-between rounded-xl border border-[#D9D2C7] bg-white px-4 py-3 text-left text-sm text-[#0B1F3A]"
          >
            <span>
              {totalGuests} guest{totalGuests === 1 ? "" : "s"}
              <span className="text-[#8A8278]">
                {" "}
                · {adults} adults, {children} children
              </span>
            </span>
            <span className="text-[#C4A35A]">Edit</span>
          </button>
        </div>
      </div>

      {guestOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-display text-2xl text-[#0B1F3A]">Guests</h3>
              <button
                type="button"
                onClick={() => setGuestOpen(false)}
                className="text-sm text-[#8A8278]"
              >
                Done
              </button>
            </div>
            <GuestRow
              label="Adults"
              value={adults}
              onChange={setAdults}
              min={0}
            />
            <GuestRow
              label="Children"
              value={children}
              onChange={setChildren}
              min={0}
            />
          </div>
        </div>
      ) : null}
    </SectionBlock>
  );
}

function GuestRow({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[#EEE8DF] py-4">
      <span className="text-[#0B1F3A]">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D9D2C7]"
        >
          −
        </button>
        <span className="w-6 text-center font-semibold">{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D9D2C7]"
        >
          +
        </button>
      </div>
    </div>
  );
}
