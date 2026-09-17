"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  PlaneLanding,
  PlaneTakeoff,
  Ship,
} from "lucide-react";
import type { PbAirportTransfer, PbHub, PbVehicle } from "@/lib/pocketbase/client";
import {
  useBuilderStore,
  type HubTravelMode,
} from "@/store/useBuilderStore";
import { SectionContinue } from "./SectionContinue";
import { SectionBlock } from "./ui";
import { useLazyModalMount } from "./modals/useLazyModalMount";

const HubConfigModal = dynamic(
  () =>
    import("./modals/HubConfigModal").then((m) => ({
      default: m.HubConfigModal,
    })),
  { ssr: false }
);

function hubTypeForMode(mode: HubTravelMode): PbHub["type"] {
  return mode === "cruise" ? "Cruise Terminal" : "Airport";
}

function hubDisplayName(hubs: PbHub[], id: string | null): string {
  const name = hubs.find((h) => h.id === id)?.name;
  if (!name) return "Tap to configure";
  return name.replace(/\s*\([^)]*\)\s*$/, "");
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
  const [activeModal, setActiveModal] = useState<
    "arrival" | "departure" | null
  >(null);
  const arrivalModalMounted = useLazyModalMount(activeModal === "arrival");
  const departureModalMounted = useLazyModalMount(activeModal === "departure");

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

  const arriveName = hubDisplayName(hubs, arrivalTransferId);
  const departName = hubDisplayName(hubs, departureTransferId);
  const summary = `${
    arrivalTransferId ? arriveName : "—"
  } → ${departureTransferId ? departName : "—"} · Pickup: ${
    airportPickup ? "Yes" : "No"
  }`;

  return (
    <SectionBlock
      number={2}
      title="Arrival & Departure"
      id="section-arrival"
      icon="plane"
      summary={summary}
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <HubSummaryCard
          kind="arrival"
          title="Arrival"
          hubName={arriveName}
          configured={Boolean(arrivalTransferId)}
          mode={arrivalMode}
          vipEnabled={airportPickup}
          onClick={() => setActiveModal("arrival")}
        />
        <HubSummaryCard
          kind="departure"
          title="Departure"
          hubName={departName}
          configured={Boolean(departureTransferId)}
          mode={departureMode}
          vipEnabled={airportDropoff}
          onClick={() => setActiveModal("departure")}
        />
      </div>

      {arrivalModalMounted ? (
      <HubConfigModal
        open={activeModal === "arrival"}
        kind="arrival"
        onClose={() => setActiveModal(null)}
        mode={arrivalMode}
        onModeChange={setArrivalMode}
        hubId={arrivalTransferId}
        onHubChange={setArrivalTransferId}
        hubs={arrivalHubs}
        vipEnabled={airportPickup}
        onVipChange={setAirportPickup}
        allHubs={hubs}
        vehicles={vehicles}
        airportTransfers={airportTransfers}
        arrivalHubId={arrivalTransferId}
        departureHubId={departureTransferId}
      />
      ) : null}

      {departureModalMounted ? (
      <HubConfigModal
        open={activeModal === "departure"}
        kind="departure"
        onClose={() => setActiveModal(null)}
        mode={departureMode}
        onModeChange={setDepartureMode}
        hubId={departureTransferId}
        onHubChange={setDepartureTransferId}
        hubs={departureHubs}
        vipEnabled={airportDropoff}
        onVipChange={setAirportDropoff}
        allHubs={hubs}
        vehicles={vehicles}
        airportTransfers={airportTransfers}
        arrivalHubId={arrivalTransferId}
        departureHubId={departureTransferId}
      />
      ) : null}

      <SectionContinue next={3} label="Continue to Locations" />
    </SectionBlock>
  );
}

function HubSummaryCard({
  kind,
  title,
  hubName,
  configured,
  mode,
  vipEnabled,
  onClick,
}: {
  kind: "arrival" | "departure";
  title: string;
  hubName: string;
  configured: boolean;
  mode: HubTravelMode;
  vipEnabled: boolean;
  onClick: () => void;
}) {
  const modeLabel = mode === "cruise" ? "Cruise" : "Flight";
  const vipLabel =
    kind === "arrival"
      ? vipEnabled
        ? "VIP pickup"
        : "No pickup"
      : vipEnabled
        ? "VIP drop-off"
        : "No drop-off";

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[9.5rem] flex-col rounded-[1.35rem] border border-zinc-800 bg-[#1C1C1E] p-4 text-left transition hover:border-[#C4A35A]/45 hover:bg-[#222226] sm:min-h-[10.5rem] sm:p-5"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
          {title}
        </p>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full ${
            kind === "arrival"
              ? "bg-emerald-500/15"
              : "bg-sky-500/15"
          }`}
          aria-hidden
        >
          {kind === "arrival" ? (
            mode === "cruise" ? (
              <Ship size={20} className="text-emerald-400" />
            ) : (
              <PlaneLanding size={20} className="text-emerald-400" />
            )
          ) : mode === "cruise" ? (
            <Ship size={20} className="text-sky-400" />
          ) : (
            <PlaneTakeoff size={20} className="text-sky-400" />
          )}
        </span>
      </div>

      <p
        className={`mt-3 line-clamp-2 font-display text-xl leading-snug text-white sm:text-2xl ${
          configured ? "" : "text-zinc-500"
        }`}
      >
        {hubName}
      </p>

      <div className="mt-auto flex items-end justify-between gap-2 pt-4">
        <div className="min-w-0">
          <p className="truncate text-xs text-zinc-400">
            {modeLabel}
            <span className="text-zinc-600"> · </span>
            {vipLabel}
          </p>
        </div>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-zinc-600 transition group-hover:text-[#C4A35A]"
          aria-hidden
        />
      </div>
    </button>
  );
}
