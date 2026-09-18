"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Car, CircleDot, TrainFront, X } from "lucide-react";
import { allocateFleet } from "@/lib/vehicleAllocator";
import type { BuilderConfig } from "@/lib/pocketbase/client";
import {
  coerceTransitType,
  type CityTransitType,
} from "@/store/useBuilderStore";
import {
  buildTransitTicketChoice,
  detectTransitTicketKind,
  ticketOptionLabel,
  ticketPriceBand,
  type TransitLegTicketChoice,
  type TransitTicketKind,
} from "@/lib/transitTickets";

export type InterCityTransitLeg = {
  fromLabel: string;
  toLabel: string;
  mode: CityTransitType;
  /** Location key whose transitType owns this leg, or "__arrival__". */
  storeKey: string;
  fromCityId?: string;
  toCityId?: string;
  /** True when the destination is an airport / cruise hub. */
  toIsHub?: boolean;
  needsTicket?: boolean;
  ticketType?: TransitLegTicketChoice["ticketType"];
  ticketPricePerPax?: number;
};

export function InterCityTransitModal({
  open,
  leg,
  config,
  totalGuests,
  onClose,
  onSave,
}: {
  open: boolean;
  leg: InterCityTransitLeg | null;
  config: BuilderConfig | null;
  totalGuests: number;
  onClose: () => void;
  onSave: (choice: TransitLegTicketChoice) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [selectedMode, setSelectedMode] = useState<CityTransitType>("self");
  const [needsTicket, setNeedsTicket] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !leg) return;
    const mode = coerceTransitType(leg.mode);
    // Unset opens on Self-Arranged (€0) as the baseline choice
    setSelectedMode(mode === "unset" ? "self" : mode);
    setNeedsTicket(leg.needsTicket !== false && mode === "public");
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, leg]);

  const ticketKind: TransitTicketKind = useMemo(
    () =>
      detectTransitTicketKind({
        fromCityId: leg?.fromCityId,
        toCityId: leg?.toCityId,
        toIsHub: leg?.toIsHub,
      }),
    [leg?.fromCityId, leg?.toCityId, leg?.toIsHub]
  );

  const priceBand = ticketPriceBand(ticketKind);
  const guests = Math.max(1, totalGuests);
  const calculatedTicketPrice =
    selectedMode === "public" && needsTicket ? priceBand.est : 0;
  const totalTicketCost = calculatedTicketPrice * guests;

  const movement = useMemo(() => {
    if (!config || !leg?.fromCityId || !leg?.toCityId) return null;
    return (
      config.cityMovements?.find(
        (m) =>
          m.from_city_id === leg.fromCityId && m.to_city_id === leg.toCityId
      ) ?? null
    );
  }, [config, leg]);

  const fleetLabel = useMemo(() => {
    if (!config?.vehicles?.length) return null;
    const fleet = allocateFleet(Math.max(1, totalGuests), config.vehicles);
    return fleet.units.length ? fleet.label.replace("×", "x") : null;
  }, [config?.vehicles, totalGuests]);

  const publicMins = movement?.public_transit_time_mins;
  const privateMins = movement?.private_transit_time_mins;

  if (!open || !mounted || !leg) return null;

  const save = () => {
    onSave(
      buildTransitTicketChoice(
        selectedMode,
        selectedMode === "public" ? needsTicket : false,
        ticketKind
      )
    );
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="intercity-transit-title"
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="relative z-[1] w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-[#C4A35A]">
              Inter-city transit
            </p>
            <h2
              id="intercity-transit-title"
              className="mt-1 text-lg font-bold leading-snug text-white"
            >
              Transit: {leg.fromLabel} to {leg.toLabel}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
          <TransitOption
            selected={selectedMode === "self"}
            onSelect={() => setSelectedMode("self")}
            icon={<CircleDot className="h-5 w-5" />}
            title="Self-Arranged / On Your Own"
            body="You handle this leg independently. No transfer or rail tickets are included in your quotation (€0)."
            meta={["€0", "Baseline · no booking"]}
          />

          <TransitOption
            selected={selectedMode === "public"}
            onSelect={() => setSelectedMode("public")}
            icon={<TrainFront className="h-5 w-5" />}
            title="Public Rail / Shinkansen"
            body={
              leg.toIsHub
                ? "Rapid express or airport rail with luggage on board. Ideal when travel light."
                : "Rapid express / bullet train between cities. Luggage stays with you on board."
            }
            meta={[
              publicMins ? `Est. ${publicMins} min` : "Time varies by route",
              "Optional ticket booking",
            ]}
          />

          {selectedMode === "public" ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
              <p className="mb-2 mt-0 text-xs font-semibold uppercase tracking-wider text-amber-500">
                Do you need us to pre-book tickets / IC cards for this leg?
              </p>
              <p className="mb-3 text-[11px] leading-relaxed text-zinc-400">
                {ticketKind === "ic_card"
                  ? `Airport express / local rail — ${ticketOptionLabel(ticketKind)} (Est. €${priceBand.min} – €${priceBand.max} per pax).`
                  : `Inter-city Shinkansen — ${ticketOptionLabel(ticketKind)} (Est. €${priceBand.min} – €${priceBand.max} per pax).`}
              </p>

              <div className="space-y-2">
                <TicketRadio
                  selected={needsTicket}
                  onSelect={() => setNeedsTicket(true)}
                  title="Yes, include reserved tickets / IC card"
                  badge={`+€${priceBand.est} / person`}
                />
                <TicketRadio
                  selected={!needsTicket}
                  onSelect={() => setNeedsTicket(false)}
                  title="No, I will purchase my own tickets on site"
                  badge="€0"
                />
              </div>

              <div className="mt-3 flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-300">
                <span>
                  Estimated Ticket Cost ({guests} guest
                  {guests === 1 ? "" : "s"}):
                </span>
                <span className="font-bold text-white">
                  €{totalTicketCost.toLocaleString()}
                </span>
              </div>
            </div>
          ) : null}

          <TransitOption
            selected={selectedMode === "private"}
            onSelect={() => setSelectedMode("private")}
            icon={<Car className="h-5 w-5" />}
            title="Private Chauffeur Transfer"
            body="Door-to-door luxury transfer with a dedicated driver handling luggage hotel to hotel (or airport)."
            meta={[
              privateMins
                ? `Est. ${privateMins} min`
                : "Direct point-to-point",
              fleetLabel ? fleetLabel : "Vehicle sized to your group",
            ]}
          />
        </div>

        <div className="border-t border-zinc-800 px-5 py-4">
          <button
            type="button"
            onClick={save}
            className="w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-black transition hover:bg-amber-400"
          >
            Save Transport Choice
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function TicketRadio({
  selected,
  onSelect,
  title,
  badge,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  badge: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
        selected
          ? "border-amber-500/60 bg-amber-500/10"
          : "border-zinc-700 bg-zinc-950 hover:border-zinc-500"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
            selected
              ? "border-amber-400 bg-amber-400"
              : "border-zinc-500 bg-transparent"
          }`}
        >
          {selected ? (
            <span className="h-1.5 w-1.5 rounded-full bg-black" />
          ) : null}
        </span>
        <span className="text-xs font-medium leading-snug text-zinc-100">
          {title}
        </span>
      </span>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
          selected
            ? "bg-amber-500/20 text-amber-300"
            : "bg-zinc-800 text-zinc-400"
        }`}
      >
        {badge}
      </span>
    </button>
  );
}

function TransitOption({
  selected,
  onSelect,
  icon,
  title,
  body,
  meta,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  body: string;
  meta: string[];
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        selected
          ? "border-[#C4A35A] bg-[#C4A35A]/10 shadow-[0_0_0_1px_rgba(196,163,90,0.35)]"
          : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            selected
              ? "bg-[#C4A35A]/20 text-[#C4A35A]"
              : "bg-zinc-800 text-zinc-300"
          }`}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">{body}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {meta.map((m) => (
              <span
                key={m}
                className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}
