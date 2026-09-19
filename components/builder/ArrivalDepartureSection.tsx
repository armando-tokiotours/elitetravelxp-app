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
  const summary = (
    <div className="flex max-w-[180px] flex-col gap-0.5 sm:max-w-none">
      <span className="block truncate text-[10px] font-medium text-zinc-300 sm:text-xs">
        {arrivalTransferId ? arriveName : "—"} →{" "}
        {departureTransferId ? departName : "—"}
      </span>
      <span className="block text-[9px] font-semibold text-[#B85304] sm:text-[11px]">
        Pickup: {airportPickup ? "Yes" : "No"} · Drop-off:{" "}
        {airportDropoff ? "Yes" : "No"}
      </span>
    </div>
  );

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

      <SectionContinue next={3} />
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

  const iconWrap = configured
    ? "border border-emerald-500/50 bg-emerald-950/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
    : "border border-zinc-700 bg-[#1C1C1E] text-zinc-500";

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[110px] flex-col justify-between rounded-2xl border border-[#2C2C2E] bg-[#121212] p-3 text-left transition hover:border-[#B85304]/45 hover:bg-[#222226] sm:min-h-[130px] sm:rounded-[1.35rem] sm:p-5"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 sm:text-[10px]">
          {title}
        </p>
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors duration-200 sm:h-8 sm:w-8 ${iconWrap}`}
          aria-hidden
        >
          {kind === "arrival" ? (
            mode === "cruise" ? (
              <Ship className="h-3 w-3 sm:h-4 sm:w-4" />
            ) : (
              <PlaneLanding className="h-3 w-3 sm:h-4 sm:w-4" />
            )
          ) : mode === "cruise" ? (
            <Ship className="h-3 w-3 sm:h-4 sm:w-4" />
          ) : (
            <PlaneTakeoff className="h-3 w-3 sm:h-4 sm:w-4" />
          )}
        </span>
      </div>

      <p
        className={`my-1 line-clamp-2 break-words whitespace-normal font-display text-sm font-bold leading-tight text-white sm:text-lg ${
          configured ? "" : "text-zinc-500"
        }`}
      >
        {hubName}
      </p>

      <div className="mt-auto flex items-end justify-between gap-2 pt-3 sm:pt-4">
        <div className="min-w-0">
          <p className="truncate text-[10px] text-zinc-400 sm:text-xs">
            {modeLabel}
            <span className="text-zinc-600"> · </span>
            {vipLabel}
          </p>
        </div>
        <ChevronRight
          className="h-3.5 w-3.5 shrink-0 text-zinc-600 transition group-hover:text-[#B85304] sm:h-4 sm:w-4"
          aria-hidden
        />
      </div>
    </button>
  );
}
