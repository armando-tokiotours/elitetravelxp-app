"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, PlaneLanding, PlaneTakeoff, Ship } from "lucide-react";
import type {
  PbAirportTransfer,
  PbHub,
  PbVehicle,
} from "@/lib/pocketbase/client";
import type { HubTravelMode } from "@/store/useBuilderStore";
import { ChoicePill, FieldLabel, PillToggle, SelectField } from "../ui";
import { ExplainerTriggerButton } from "../ExplainerTriggerButton";

type HubLegProps = {
  mode: HubTravelMode;
  onModeChange: (m: HubTravelMode) => void;
  hubId: string | null;
  onHubChange: (id: string | null) => void;
  hubs: PbHub[];
  vipEnabled: boolean;
  onVipChange: (v: boolean) => void;
};

/**
 * Single screen for Arrival + Departure hubs.
 * One shared VIP “How it works” video at the bottom.
 */
export function HubConfigModal({
  open,
  onClose,
  arrival,
  departure,
  allHubs,
  vehicles,
  airportTransfers,
}: {
  open: boolean;
  onClose: () => void;
  arrival: HubLegProps;
  departure: HubLegProps;
  allHubs: PbHub[];
  vehicles: PbVehicle[];
  airportTransfers: PbAirportTransfer[];
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
  }, [open]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence
      onExitComplete={() => {
        document.body.style.overflow = "";
      }}
    >
      {open ? (
        <motion.div
          key="hub-config-combined"
          className="fixed inset-0 z-50 flex flex-col bg-[#0A1017]"
          role="dialog"
          aria-modal="true"
          aria-label="Configure arrival and departure"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="relative z-[1] flex h-full w-full flex-col overflow-hidden bg-[#0A1017]"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="sticky top-0 z-20 flex w-full shrink-0 items-center gap-3 border-b border-white/10 bg-[#0A1017]/95 px-4 py-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] backdrop-blur-md">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-godiva text-base uppercase tracking-wider text-white">
                  Arrival &amp; Departure
                </h3>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-4 py-5 pb-[max(7rem,env(safe-area-inset-bottom))] sm:px-5">
              <HubLegEditor
                kind="arrival"
                mode={arrival.mode}
                onModeChange={arrival.onModeChange}
                hubId={arrival.hubId}
                onHubChange={arrival.onHubChange}
                hubs={arrival.hubs}
                vipEnabled={arrival.vipEnabled}
                onVipChange={arrival.onVipChange}
              />

              <div className="border-t border-white/10" aria-hidden />

              <HubLegEditor
                kind="departure"
                mode={departure.mode}
                onModeChange={departure.onModeChange}
                hubId={departure.hubId}
                onHubChange={departure.onHubChange}
                hubs={departure.hubs}
                vipEnabled={departure.vipEnabled}
                onVipChange={departure.onVipChange}
              />

              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#075473]">
                  How it works
                </p>
                <ExplainerTriggerButton
                  featureKey="airport_transfers"
                  title="The VIP Airport Arrival"
                  contextId={arrival.hubId}
                  arrivalHubId={arrival.hubId}
                  departureHubId={departure.hubId}
                  hubs={allHubs}
                  vehicles={vehicles}
                  airportTransfers={airportTransfers}
                />
              </div>
            </div>

            <div className="tokio-modal-chrome shrink-0 border-t px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-full bg-[#054F70] py-3 text-sm font-semibold text-white transition hover:bg-[#043d57]"
              >
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

function HubLegEditor({
  kind,
  mode,
  onModeChange,
  hubId,
  onHubChange,
  hubs,
  vipEnabled,
  onVipChange,
}: HubLegProps & { kind: "arrival" | "departure" }) {
  const isArrival = kind === "arrival";
  const title = isArrival ? "Arrival" : "Departure";
  const Icon = isArrival
    ? mode === "cruise"
      ? Ship
      : PlaneLanding
    : mode === "cruise"
      ? Ship
      : PlaneTakeoff;

  const hubPlaceholder =
    mode === "cruise"
      ? isArrival
        ? "Select cruise port"
        : "Select departure port"
      : isArrival
        ? "Select arrival airport"
        : "Select departure airport";

  const vipLabel =
    mode === "cruise"
      ? isArrival
        ? "Port pickup?"
        : "Port drop off?"
      : isArrival
        ? "Airport pickup?"
        : "Airport drop off?";

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-zinc-900 text-[#075473]">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <h4 className="font-display text-lg text-white">{title}</h4>
      </div>

      <div>
        <FieldLabel>Travel type</FieldLabel>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <ChoicePill
            active={mode === "airport"}
            onClick={() => onModeChange("airport")}
            size="sm"
          >
            <span className="inline-flex items-center gap-1.5">
              {isArrival ? (
                <PlaneLanding className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <PlaneTakeoff className="h-3.5 w-3.5" aria-hidden />
              )}
              Flight
            </span>
          </ChoicePill>
          <ChoicePill
            active={mode === "cruise"}
            onClick={() => onModeChange("cruise")}
            size="sm"
          >
            <span className="inline-flex items-center gap-1.5">
              <Ship className="h-3.5 w-3.5" aria-hidden />
              Cruise Port
            </span>
          </ChoicePill>
        </div>
      </div>

      <div>
        <FieldLabel>{mode === "cruise" ? "Port" : "Airport"}</FieldLabel>
        <SelectField
          value={hubId ?? ""}
          onChange={(v) => onHubChange(v || null)}
          options={hubs.map((h) => ({ value: h.id, label: h.name }))}
          placeholder={
            hubs.length === 0
              ? "No hubs available — add in Team Access"
              : hubPlaceholder
          }
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
          {vipLabel}
        </label>
        <PillToggle value={vipEnabled} onChange={onVipChange} size="sm" />
      </div>
    </section>
  );
}
