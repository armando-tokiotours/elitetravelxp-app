"use client";

import { useItineraryStore } from "@/store/useItineraryStore";
import { Counter, ModuleShell } from "./ModuleShell";

export function GuestDetails() {
  const totalGuests = useItineraryStore((s) => s.totalGuests);
  const adults = useItineraryStore((s) => s.adults);
  const children = useItineraryStore((s) => s.children);
  const setTotalGuests = useItineraryStore((s) => s.setTotalGuests);
  const setAdults = useItineraryStore((s) => s.setAdults);
  const setChildren = useItineraryStore((s) => s.setChildren);

  return (
    <ModuleShell
      step={2}
      title="Guest Details"
      description="Party size drives vehicle allocation and per-guest transit pricing."
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:gap-8">
        <Counter
          label="Total"
          value={totalGuests}
          min={1}
          max={20}
          onChange={setTotalGuests}
        />
        <Counter
          label="Adults"
          value={adults}
          min={0}
          max={totalGuests}
          onChange={setAdults}
        />
        <Counter
          label="Children"
          value={children}
          min={0}
          max={totalGuests}
          onChange={setChildren}
        />
      </div>
    </ModuleShell>
  );
}
