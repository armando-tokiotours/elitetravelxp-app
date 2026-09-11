"use client";

import type { PbTransfer } from "@/lib/pocketbase/client";
import { useBuilderStore } from "@/store/useBuilderStore";
import { FieldLabel, PillToggle, SectionBlock, SelectField } from "./ui";

export function ArrivalDepartureSection({
  transfers,
}: {
  transfers: PbTransfer[];
}) {
  const arrivalTransferId = useBuilderStore((s) => s.arrivalTransferId);
  const departureTransferId = useBuilderStore((s) => s.departureTransferId);
  const airportPickup = useBuilderStore((s) => s.airportPickup);
  const airportDropoff = useBuilderStore((s) => s.airportDropoff);
  const setArrivalTransferId = useBuilderStore((s) => s.setArrivalTransferId);
  const setDepartureTransferId = useBuilderStore(
    (s) => s.setDepartureTransferId
  );
  const setAirportPickup = useBuilderStore((s) => s.setAirportPickup);
  const setAirportDropoff = useBuilderStore((s) => s.setAirportDropoff);

  const options = transfers.map((t) => ({
    value: t.id,
    label: t.location,
  }));

  return (
    <SectionBlock number={2} title="Arrival & Departure" id="section-arrival">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel>Arriving at</FieldLabel>
          <SelectField
            value={arrivalTransferId ?? ""}
            onChange={(v) => setArrivalTransferId(v || null)}
            options={options}
            placeholder="Select arrival hub"
          />
        </div>
        <div>
          <FieldLabel>Departing at</FieldLabel>
          <SelectField
            value={departureTransferId ?? ""}
            onChange={(v) => setDepartureTransferId(v || null)}
            options={options}
            placeholder="Select departure hub"
          />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:gap-10">
        <div>
          <FieldLabel>Airport pickup?</FieldLabel>
          <PillToggle value={airportPickup} onChange={setAirportPickup} />
        </div>
        <div>
          <FieldLabel>Airport drop off?</FieldLabel>
          <PillToggle value={airportDropoff} onChange={setAirportDropoff} />
        </div>
      </div>
    </SectionBlock>
  );
}
