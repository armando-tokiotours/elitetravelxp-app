"use client";

import { HUBS, type HubId } from "@/config/pricing-data";
import { useItineraryStore } from "@/store/useItineraryStore";
import { ModuleShell, OptionChip } from "./ModuleShell";

function HubSelector({
  step,
  title,
  description,
  value,
  onChange,
}: {
  step: number;
  title: string;
  description: string;
  value: HubId | null;
  onChange: (hub: HubId) => void;
}) {
  return (
    <ModuleShell step={step} title={title} description={description}>
      <div className="grid gap-3 sm:grid-cols-2">
        {HUBS.map((hub) => (
          <OptionChip
            key={hub.id}
            selected={value === hub.id}
            onClick={() => onChange(hub.id)}
            className="w-full"
          >
            {hub.label}
          </OptionChip>
        ))}
      </div>
    </ModuleShell>
  );
}

export function ArrivalHub() {
  const arrivalHub = useItineraryStore((s) => s.arrivalHub);
  const setArrivalHub = useItineraryStore((s) => s.setArrivalHub);

  return (
    <HubSelector
      step={3}
      title="Arrival Hub"
      description="Where your journey into Japan begins."
      value={arrivalHub}
      onChange={setArrivalHub}
    />
  );
}

export function DepartureHub() {
  const departureHub = useItineraryStore((s) => s.departureHub);
  const setDepartureHub = useItineraryStore((s) => s.setDepartureHub);

  return (
    <HubSelector
      step={4}
      title="Departure Hub"
      description="Your final gateway before departing Japan."
      value={departureHub}
      onChange={setDepartureHub}
    />
  );
}
