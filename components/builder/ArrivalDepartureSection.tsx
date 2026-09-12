"use client";

import { useEffect, useMemo } from "react";
import type { PbAirportTransfer, PbHub, PbVehicle } from "@/lib/pocketbase/client";
import {
  useBuilderStore,
  type HubTravelMode,
} from "@/store/useBuilderStore";
import {
  ChoicePill,
  FieldLabel,
  PillToggle,
  SectionBlock,
  SelectField,
} from "./ui";
import { SectionContinue } from "./SectionContinue";
import { ExplainerTriggerButton } from "./ExplainerTriggerButton";

function hubTypeForMode(mode: HubTravelMode): PbHub["type"] {
  return mode === "cruise" ? "Cruise Terminal" : "Airport";
}

export function ArrivalDepartureSection({
  hubs,
  vehicles = [],
  airportTransfers = [],
}: {
  hubs: PbHub[];
  vehicles?: PbVehicle[];
  airportTransfers?: PbAirportTransfer[];
}) {
  const arrivalTransferId = useBuilderStore((s) => s.arrivalTransferId);
  const departureTransferId = useBuilderStore((s) => s.departureTransferId);
  const arrivalMode = useBuilderStore((s) => s.arrivalMode);
  const departureMode = useBuilderStore((s) => s.departureMode);
  const airportPickup = useBuilderStore((s) => s.airportPickup);
  const airportDropoff = useBuilderStore((s) => s.airportDropoff);
  const setArrivalTransferId = useBuilderStore((s) => s.setArrivalTransferId);
  const setDepartureTransferId = useBuilderStore(
    (s) => s.setDepartureTransferId
  );
  const setArrivalMode = useBuilderStore((s) => s.setArrivalMode);
  const setDepartureMode = useBuilderStore((s) => s.setDepartureMode);
  const setAirportPickup = useBuilderStore((s) => s.setAirportPickup);
  const setAirportDropoff = useBuilderStore((s) => s.setAirportDropoff);

  const arrivalHubs = useMemo(
    () => hubs.filter((h) => h.type === hubTypeForMode(arrivalMode)),
    [hubs, arrivalMode]
  );
  const departureHubs = useMemo(
    () => hubs.filter((h) => h.type === hubTypeForMode(departureMode)),
    [hubs, departureMode]
  );

  // If selected hub doesn't match mode filter, clear it
  useEffect(() => {
    if (
      arrivalTransferId &&
      !arrivalHubs.some((h) => h.id === arrivalTransferId)
    ) {
      setArrivalTransferId(null);
    }
  }, [arrivalHubs, arrivalTransferId, setArrivalTransferId]);

  useEffect(() => {
    if (
      departureTransferId &&
      !departureHubs.some((h) => h.id === departureTransferId)
    ) {
      setDepartureTransferId(null);
    }
  }, [departureHubs, departureTransferId, setDepartureTransferId]);

  const pickupLabel =
    arrivalMode === "cruise" ? "Port pickup?" : "Airport pickup?";
  const dropoffLabel =
    departureMode === "cruise" ? "Port drop off?" : "Airport drop off?";

  const arriveName =
    hubs
      .find((h) => h.id === arrivalTransferId)
      ?.name.replace(/\s*\([^)]*\)\s*$/, "") || "—";
  const departName =
    hubs
      .find((h) => h.id === departureTransferId)
      ?.name.replace(/\s*\([^)]*\)\s*$/, "") || "—";
  const summary = `${arriveName} → ${departName} · Pickup: ${airportPickup ? "Yes" : "No"}`;

  return (
    <SectionBlock
      number={2}
      title="Arrival & Departure"
      id="section-arrival"
      icon="plane"
      summary={summary}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <HubPicker
          label="Arriving at"
          mode={arrivalMode}
          onModeChange={setArrivalMode}
          value={arrivalTransferId ?? ""}
          onChange={(v) => setArrivalTransferId(v || null)}
          hubs={arrivalHubs}
          placeholder={
            arrivalMode === "cruise"
              ? "Select cruise port"
              : "Select arrival airport"
          }
        />
        <HubPicker
          label="Departing at"
          mode={departureMode}
          onModeChange={setDepartureMode}
          value={departureTransferId ?? ""}
          onChange={(v) => setDepartureTransferId(v || null)}
          hubs={departureHubs}
          placeholder={
            departureMode === "cruise"
              ? "Select cruise port"
              : "Select departure airport"
          }
        />
      </div>

      <div className="mt-5">
        <div className="grid grid-cols-2 gap-3 md:gap-6">
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-[#8A8278] sm:text-xs sm:tracking-[0.14em]">
              {pickupLabel}
            </label>
            <PillToggle
              value={airportPickup}
              onChange={setAirportPickup}
              size="xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-[#8A8278] sm:text-xs sm:tracking-[0.14em]">
              {dropoffLabel}
            </label>
            <PillToggle
              value={airportDropoff}
              onChange={setAirportDropoff}
              size="xs"
            />
          </div>
        </div>
        <div className="mt-3.5">
          <ExplainerTriggerButton
            featureKey="airport_transfers"
            title="The VIP Airport Arrival"
            contextId={arrivalTransferId}
            arrivalHubId={arrivalTransferId}
            departureHubId={departureTransferId}
            hubs={hubs}
            vehicles={vehicles}
            airportTransfers={airportTransfers}
          />
        </div>
      </div>

      <SectionContinue next={3} label="Continue to Locations" />
    </SectionBlock>
  );
}

function HubPicker({
  label,
  mode,
  onModeChange,
  value,
  onChange,
  hubs,
  placeholder,
}: {
  label: string;
  mode: HubTravelMode;
  onModeChange: (m: HubTravelMode) => void;
  value: string;
  onChange: (v: string) => void;
  hubs: PbHub[];
  placeholder: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="mb-2.5 flex flex-wrap gap-2">
        <ChoicePill
          active={mode === "airport"}
          onClick={() => onModeChange("airport")}
        >
          ✈️ Flight
        </ChoicePill>
        <ChoicePill
          active={mode === "cruise"}
          onClick={() => onModeChange("cruise")}
        >
          🚢 Cruise Port
        </ChoicePill>
      </div>
      <SelectField
        value={value}
        onChange={onChange}
        options={hubs.map((h) => ({ value: h.id, label: h.name }))}
        placeholder={
          hubs.length === 0
            ? "No hubs available — add in Team Access"
            : placeholder
        }
      />
    </div>
  );
}
