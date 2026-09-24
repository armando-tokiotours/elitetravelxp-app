"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, PlaneLanding, Ship } from "lucide-react";
import type {
  PbAirportTransfer,
  PbHub,
  PbVehicle,
} from "@/lib/pocketbase/client";
import type { HubTravelMode } from "@/store/useBuilderStore";
import { ChoicePill, FieldLabel, PillToggle, SelectField } from "../ui";
import { ExplainerTriggerButton } from "../ExplainerTriggerButton";

export function HubConfigModal({
  open,
  kind,
  onClose,
  mode,
  onModeChange,
  hubId,
  onHubChange,
  hubs,
  vipEnabled,
  onVipChange,
  allHubs,
  vehicles,
  airportTransfers,
  arrivalHubId,
  departureHubId,
}: {
  open: boolean;
  kind: "arrival" | "departure";
  onClose: () => void;
  mode: HubTravelMode;
  onModeChange: (m: HubTravelMode) => void;
  hubId: string | null;
  onHubChange: (id: string | null) => void;
  hubs: PbHub[];
  vipEnabled: boolean;
  onVipChange: (v: boolean) => void;
  allHubs: PbHub[];
  vehicles: PbVehicle[];
  airportTransfers: PbAirportTransfer[];
  arrivalHubId: string | null;
  departureHubId: string | null;
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

  const isArrival = kind === "arrival";
  const title = isArrival ? "Arrival" : "Departure";
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
  const explainerTitle = isArrival
    ? "The VIP Airport Arrival"
    : "The VIP Airport Departure";

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence
      onExitComplete={() => {
        document.body.style.overflow = "";
      }}
    >
      {open ? (
        <motion.div
          key={`hub-config-${kind}`}
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="tokio-modal-backdrop absolute inset-0 cursor-default"
            onClick={onClose}
          />

          <motion.div
            className="tokio-modal-content relative z-[1] flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden border border-white/10 sm:h-[min(90dvh,40rem)] sm:max-h-[min(90dvh,40rem)] sm:max-w-lg sm:rounded-3xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="tokio-modal-chrome flex shrink-0 items-center gap-3 border-b px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-5 sm:pt-5">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-white transition hover:border-zinc-500"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#075473]">
                  Configure
                </p>
                <h3 className="truncate font-display text-2xl text-white">
                  {title}
                </h3>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 pb-[max(7rem,env(safe-area-inset-bottom))] sm:px-5">
              <div>
                <FieldLabel>Travel type</FieldLabel>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <ChoicePill
                    active={mode === "airport"}
                    onClick={() => onModeChange("airport")}
                    size="sm"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <PlaneLanding className="h-3.5 w-3.5" aria-hidden />
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
                <FieldLabel>
                  {mode === "cruise" ? "Port" : "Airport"}
                </FieldLabel>
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
                <PillToggle
                  value={vipEnabled}
                  onChange={onVipChange}
                  size="sm"
                />
              </div>

              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#075473]">
                  How it works
                </p>
                <ExplainerTriggerButton
                  featureKey="airport_transfers"
                  title={explainerTitle}
                  contextId={hubId}
                  arrivalHubId={arrivalHubId}
                  departureHubId={departureHubId}
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
                className="w-full rounded-full bg-[#1BA58A] py-3 text-sm font-semibold text-white transition hover:bg-[#159377]"
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
