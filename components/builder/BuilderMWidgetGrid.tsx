"use client";

import { useEffect, useState } from "react";
import {
  Ban,
  BedDouble,
  CarFront,
  Plane,
  Ship,
  TrainFront,
} from "lucide-react";
import type { BuilderEditModalId } from "./BuilderEditModalContext";
import {
  getWidgetPulsarClass,
  WidgetCallingPulse,
} from "@/components/branding/WidgetCallingPulse";

/** Outer shell — overflow-visible so white calling pulse is not clipped. */
const WIDGET_SHELL =
  "w-full bg-[#0A1017]/90 border rounded-[22px] text-left relative overflow-visible shadow-xl hover:border-amber-500/40 transition-all active:scale-95 group";

type PulsarStep = "city" | "duration" | "guests" | "meeting" | "tours";

function WidgetLabel({
  children,
  muted,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <span
      className={`mt-1 block text-center font-mono text-[10px] ${
        muted ? "text-zinc-500" : "text-zinc-400"
      }`}
    >
      {children}
    </span>
  );
}

export type CityPhotoBand = {
  key: string;
  name: string;
  nights: number;
  photoUrl: string | null;
};

export type ExperiencePhotoBand = {
  key: string;
  title: string;
  photoUrl: string | null;
};

export function BuilderMWidgetGrid({
  onOpen,
  tripDays,
  startDateText,
  guestCount,
  paceLabel,
  arrivalAirport,
  departureAirport,
  arrivalMode,
  departureMode,
  airportPickup,
  airportDropoff,
  cityBands,
  hotelArrangeLabel,
  transportArrangeLabel,
  experienceBands,
  hotelCityChecks,
  locked,
}: {
  onOpen: (id: Exclude<BuilderEditModalId, null>) => void;
  tripDays: number;
  startDateText: string | null;
  guestCount: number;
  paceLabel: string | null;
  arrivalAirport: string | null;
  departureAirport: string | null;
  arrivalMode: "airport" | "cruise";
  departureMode: "airport" | "cruise";
  airportPickup: boolean;
  airportDropoff: boolean;
  cityBands: CityPhotoBand[];
  hotelArrangeLabel: string;
  transportArrangeLabel: string;
  experienceBands: ExperiencePhotoBand[];
  hotelCityChecks?: { name: string; done: boolean }[];
  locked?: Partial<Record<Exclude<BuilderEditModalId, null>, boolean>>;
}) {
  const open = (id: Exclude<BuilderEditModalId, null>) => {
    if (locked?.[id]) return;
    onOpen(id);
  };

  const ArrivalIcon = arrivalMode === "cruise" ? Ship : Plane;
  const DepartureIcon = departureMode === "cruise" ? Ship : Plane;

  const hotelsIncomplete =
    cityBands.length > 0 &&
    (hotelCityChecks || []).length > 0 &&
    (hotelCityChecks || []).some((r) => !r.done);

  const [activePulsarStep, setActivePulsarStep] = useState<PulsarStep | null>(
    "duration"
  );

  useEffect(() => {
    // Builder M has no City Focus — start at Days & Dates (`duration`).
    // Map transit/locations/hotels → `meeting` guided step until tours.
    if (!startDateText) {
      setActivePulsarStep("duration");
      return;
    }
    if (!paceLabel) {
      setActivePulsarStep("guests");
      return;
    }
    if (!arrivalAirport || cityBands.length === 0 || hotelsIncomplete) {
      setActivePulsarStep("meeting");
      return;
    }
    if (experienceBands.length === 0) {
      setActivePulsarStep("tours");
      return;
    }
    setActivePulsarStep(null);
  }, [
    startDateText,
    paceLabel,
    arrivalAirport,
    cityBands.length,
    hotelsIncomplete,
    experienceBands.length,
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 overflow-visible px-4 py-6">
      {/* ROW 1 */}
      <div className="grid grid-cols-2 gap-3.5 overflow-visible">
        <div className="overflow-visible">
          <button
            type="button"
            onClick={() => open("duration")}
            disabled={locked?.duration}
            className={`${WIDGET_SHELL} ${getWidgetPulsarClass(activePulsarStep, "duration")} h-36 p-4 disabled:pointer-events-none disabled:opacity-40`}
          >
            <WidgetCallingPulse active={activePulsarStep === "duration"} />
            <div className="relative z-10 flex items-center justify-between">
              <span className="text-xl" aria-hidden>
                📅
              </span>
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-amber-400">
                SET
              </span>
            </div>
            <div className="relative z-10 mt-3">
              <h3 className="font-godiva text-lg font-black leading-none text-white">
                {tripDays || 10} DAYS
              </h3>
              <p className="mt-1 font-mono text-[11px] text-zinc-300">
                {startDateText || "Set Arrival Date"}
              </p>
            </div>
          </button>
          <WidgetLabel>Days &amp; Dates</WidgetLabel>
        </div>

        <div className="overflow-visible">
          <button
            type="button"
            onClick={() => open("guests")}
            disabled={locked?.guests}
            className={`${WIDGET_SHELL} ${getWidgetPulsarClass(activePulsarStep, "guests")} h-36 p-4 disabled:pointer-events-none disabled:opacity-40`}
          >
            <WidgetCallingPulse active={activePulsarStep === "guests"} />
            <div className="relative z-10 flex items-center justify-between">
              <span className="text-xl" aria-hidden>
                👥
              </span>
              <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-400">
                PARTY
              </span>
            </div>
            <div className="relative z-10 mt-3">
              <h3 className="font-godiva text-lg font-black leading-none text-white">
                {guestCount || 2} GUESTS
              </h3>
              <p className="mt-1 font-mono text-[11px] text-zinc-300">
                {paceLabel || "Balanced Pace"}
              </p>
            </div>
          </button>
          <WidgetLabel>Guests &amp; Pace</WidgetLabel>
        </div>
      </div>

      {/* ROW 2 — Arrival ~2× */}
      <div className="overflow-visible">
        <button
          type="button"
          onClick={() => open("transit")}
          disabled={locked?.transit}
          className={`${WIDGET_SHELL} ${getWidgetPulsarClass(activePulsarStep, "meeting")} min-h-[9.5rem] p-4 disabled:pointer-events-none disabled:opacity-40`}
        >
            <WidgetCallingPulse active={activePulsarStep === "meeting"} />
          <span className="relative z-10 mb-3 block font-mono text-[10px] font-bold uppercase tracking-wider text-amber-400">
            ENTRY / EXIT
          </span>
          <div className="relative z-10 space-y-3">
            <HubLine
              Icon={ArrivalIcon}
              label={arrivalAirport || "Set arrival hub"}
              vip={airportPickup}
              vipLabel="Pickup"
            />
            <HubLine
              Icon={DepartureIcon}
              label={departureAirport || "Set departure hub"}
              vip={airportDropoff}
              vipLabel="Drop-off"
            />
          </div>
        </button>
        <WidgetLabel>Arrival &amp; Departure</WidgetLabel>
      </div>

      {/* ROW 3 — Locations ~3× photo stack */}
      <div className="overflow-visible">
        <button
          type="button"
          onClick={() => open("locations")}
          disabled={locked?.locations}
          className={`${WIDGET_SHELL} ${getWidgetPulsarClass(activePulsarStep, "meeting")} h-[16.5rem] p-0 disabled:pointer-events-none disabled:opacity-40`}
        >
            <WidgetCallingPulse active={activePulsarStep === "meeting"} />
          {cityBands.length === 0 ? (
            <div className="relative z-10 flex h-full flex-col items-center justify-center gap-1 px-4 text-center">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                Selected cities
              </span>
              <span className="text-sm font-bold uppercase text-zinc-400">
                Tap to build your route
              </span>
            </div>
          ) : (
            <div className="absolute inset-0 z-0 flex h-full w-full flex-col overflow-hidden rounded-[22px]">
              {cityBands.map((band) => (
                <div
                  key={band.key}
                  className="relative min-h-0 flex-1 overflow-hidden border-b border-black/40 last:border-b-0"
                >
                  {band.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={band.photoUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#1a3355] to-[#0B1F3A]" />
                  )}
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent"
                    aria-hidden
                  />
                  <div className="relative z-10 flex h-full items-end px-3 pb-2.5">
                    <p className="font-godiva text-sm font-bold uppercase tracking-wide text-white drop-shadow">
                      {band.name}{" "}
                      <span className="text-cyan-300">({band.nights}N)</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </button>
        <WidgetLabel>Locations &amp; Nights</WidgetLabel>
      </div>

      {/* ROW 4 — Hotel + Transport */}
      <div className="grid grid-cols-2 gap-3.5 overflow-visible">
        <div className="overflow-visible">
          <button
            type="button"
            onClick={() => open("hotels_transport")}
            disabled={locked?.hotels_transport}
            className={`${WIDGET_SHELL} ${getWidgetPulsarClass(activePulsarStep, "meeting")} flex min-h-[19.5rem] flex-col justify-between p-4 disabled:pointer-events-none disabled:opacity-40`}
          >
            <WidgetCallingPulse active={activePulsarStep === "meeting"} />
            <div className="relative z-10 flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-400">
                <BedDouble className="h-5 w-5" aria-hidden />
              </span>
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-amber-400">
                STAY
              </span>
            </div>
            <div className="relative z-10 mt-auto">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Hotels
              </p>
              <h3 className="mt-1 font-godiva text-lg font-black uppercase leading-tight text-white">
                {hotelArrangeLabel}
              </h3>
              <ul className="mt-2 max-h-16 space-y-0.5 overflow-y-auto">
                {(
                  hotelCityChecks ||
                  cityBands.map((b) => ({ name: b.name, done: false }))
                ).map((row) => (
                  <li
                    key={row.name}
                    className="flex items-center justify-between gap-2 font-mono text-[10px] text-zinc-400"
                  >
                    <span className="truncate">{row.name}</span>
                    <span
                      className={
                        row.done ? "text-emerald-400" : "text-zinc-600"
                      }
                    >
                      {row.done ? "✓" : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </button>
          <WidgetLabel>Hotels</WidgetLabel>
        </div>

        <div className="overflow-visible">
          <button
            type="button"
            onClick={() => open("drivers")}
            disabled={locked?.drivers}
            className={`${WIDGET_SHELL} ${getWidgetPulsarClass(activePulsarStep, "meeting")} flex min-h-[19.5rem] flex-col justify-between p-4 disabled:pointer-events-none disabled:opacity-40`}
          >
            <WidgetCallingPulse active={activePulsarStep === "meeting"} />
            <div className="relative z-10 flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-400">
                <TrainFront className="h-5 w-5" aria-hidden />
              </span>
              <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-400">
                MOVE
              </span>
            </div>
            <div className="relative z-10 mt-auto">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Transport
              </p>
              <h3 className="mt-1 font-godiva text-lg font-black uppercase leading-tight text-white">
                {transportArrangeLabel}
              </h3>
              <p className="mt-1 font-mono text-[10px] text-zinc-400">
                Public tickets or private drivers
              </p>
            </div>
          </button>
          <WidgetLabel>Transport</WidgetLabel>
        </div>
      </div>

      {/* Status overview — compact strip */}
      <div>
        <div className="relative flex min-h-[4.5rem] w-full flex-col items-center justify-center overflow-hidden rounded-[22px] border border-dashed border-white/5 bg-[#0A1017]/50 px-4 py-3 text-center">
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            Concierge Note
          </span>
          <span className="mt-0.5 font-sans text-[11px] text-zinc-400">
            Customized on submission
          </span>
        </div>
        <WidgetLabel muted>Status Overview</WidgetLabel>
      </div>

      {/* ROW 5 — Tours */}
      <div className="overflow-visible">
        <button
          type="button"
          onClick={() => open("tours")}
          disabled={locked?.tours}
          className={`${WIDGET_SHELL} ${getWidgetPulsarClass(activePulsarStep, "tours")} h-[13.5rem] p-0 disabled:pointer-events-none disabled:opacity-40`}
        >
            <WidgetCallingPulse active={activePulsarStep === "tours"} />
          {experienceBands.length === 0 ? (
            <div className="absolute inset-0 z-0 overflow-hidden rounded-[22px] bg-gradient-to-b from-[#1a2840] to-[#0A1017]">
              <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 pb-14 text-center">
                <p className="font-godiva text-base font-bold uppercase leading-snug text-white">
                  Pick an experience or tour
                </p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/cat-2.png"
                alt=""
                aria-hidden
                className="pointer-events-none absolute bottom-0 left-1/2 z-0 h-[5.75rem] w-auto -translate-x-1/2 select-none object-contain object-bottom"
              />
            </div>
          ) : (
            <div className="absolute inset-0 z-0 flex h-full w-full flex-col overflow-hidden rounded-[22px]">
              {experienceBands.slice(0, 4).map((band) => (
                <div
                  key={band.key}
                  className="relative min-h-0 flex-1 overflow-hidden border-b border-black/40 last:border-b-0"
                >
                  {band.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={band.photoUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#3a1a2e] to-[#0B1F3A]" />
                  )}
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent"
                    aria-hidden
                  />
                  <div className="relative z-10 flex h-full items-end px-3 pb-2">
                    <p className="line-clamp-1 font-godiva text-xs font-bold uppercase tracking-wide text-white drop-shadow">
                      {band.title}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </button>
        <WidgetLabel>Tours &amp; Experiences</WidgetLabel>
      </div>
    </div>
  );
}

function HubLine({
  Icon,
  label,
  vip,
  vipLabel,
}: {
  Icon: typeof Plane;
  label: string;
  vip: boolean;
  vipLabel: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <p className="min-w-0 flex-1 truncate text-sm font-bold uppercase text-white">
        {label}
      </p>
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
          vip
            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
            : "border-zinc-600 bg-zinc-900 text-zinc-500"
        }`}
        title={vip ? `VIP ${vipLabel}` : `No ${vipLabel.toLowerCase()}`}
      >
        {vip ? (
          <CarFront className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <Ban className="h-3.5 w-3.5" aria-hidden />
        )}
      </span>
    </div>
  );
}
