"use client";

import Link from "next/link";
import {
  BedDouble,
  CalendarDays,
  Car,
  CircleDot,
  MapPin,
  PlaneLanding,
  PlaneTakeoff,
  Route,
  Ticket,
  TrainFront,
  Users,
} from "lucide-react";
import {
  transferLocation,
  type BuilderConfig,
  type PbHub,
  type PbTransfer,
} from "@/lib/pocketbase/client";
import { formatCityDateSingle } from "@/lib/dateCascade";
import {
  formatDisplayDate,
  type LocationStop,
  type BuilderState,
} from "@/store/useBuilderStore";

export function TravelDossierView({
  state,
  config,
  departureIso,
  dateRanges,
  fleetLabel,
  arrivalHub,
  departureHub,
}: {
  state: BuilderState;
  config: BuilderConfig | null;
  departureIso: string | null;
  dateRanges: { label: string }[];
  fleetLabel: string | null;
  arrivalHub: PbHub | PbTransfer | null;
  departureHub: PbHub | PbTransfer | null;
}) {
  const cityName = (id: string) =>
    config?.cities.find((c) => c.id === id)?.name ?? id;

  const bookingRef = (() => {
    const y = state.arrivalDate?.slice(0, 4) || "2026";
    return `JPN-${y}`;
  })();

  const routeParts: string[] = [];
  if (arrivalHub) routeParts.push(hubShort(arrivalHub));
  for (const loc of state.locations) {
    if (loc.visitType === "stay" || !loc.visitType) {
      routeParts.push(cityName(loc.cityId));
    }
  }
  if (departureHub) {
    const d = hubShort(departureHub);
    if (routeParts[routeParts.length - 1] !== d) routeParts.push(d);
  }

  const days = state.durationDays;
  const dateSpan = !state.arrivalDate
    ? "Dates TBD"
    : `${formatDisplayDate(state.arrivalDate)} – ${formatDisplayDate(departureIso)} (${days} Day${days === 1 ? "" : "s"})`;

  return (
    <div className="space-y-0">
      <section className="overflow-hidden rounded-2xl bg-[#0B1F3A] text-white shadow-[0_12px_40px_rgba(11,31,58,0.25)]">
        <div className="flex items-start justify-between gap-3 border-b border-dashed border-white/20 px-5 py-4">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#C4A35A]">
              Booking Summary
            </p>
            <p className="mt-1 font-display text-xl text-white">
              Elite Travel Experiences
            </p>
          </div>
          <div className="rounded-lg border border-dashed border-[#C4A35A]/50 px-3 py-1.5 text-right">
            <p className="text-[0.55rem] uppercase tracking-[0.2em] text-[#C4A35A]/80">
              Booking Ref
            </p>
            <p className="font-mono text-sm font-semibold text-[#C4A35A]">
              {bookingRef}
            </p>
          </div>
        </div>

        <div className="grid gap-4 px-5 py-5 sm:grid-cols-3">
          <MetaBlock
            icon={<Users className="h-4 w-4 text-[#C4A35A]" />}
            label="Guests"
            value={`${state.adults} Adult${state.adults === 1 ? "" : "s"}, ${state.children} Child${state.children === 1 ? "" : "ren"}`}
          />
          <MetaBlock
            icon={<CalendarDays className="h-4 w-4 text-[#C4A35A]" />}
            label="Dates"
            value={dateSpan}
          />
          <MetaBlock
            icon={<Route className="h-4 w-4 text-[#C4A35A]" />}
            label="Route"
            value={
              routeParts.length
                ? routeParts.join(" ➔ ")
                : "Add cities in the builder"
            }
          />
        </div>
      </section>

      <TimelineSpine />

      <TicketCard accent="gold">
        <div className="flex items-center gap-2">
          <PlaneLanding className="h-4 w-4 text-[#C4A35A]" />
          <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[#0B1F3A]">
            Arrival
            <span className="mx-2 text-[#C4A35A]">·</span>
            <span className="tracking-normal text-[#5C6570]">
              {formatDisplayDate(state.arrivalDate)}
            </span>
          </h2>
        </div>
        <p className="mt-3 text-sm text-[#5C6570]">
          Landing at{" "}
          <span className="font-semibold text-[#0B1F3A]">
            {hubFull(arrivalHub) || "Arrival hub TBD"}
          </span>
        </p>
        {state.airportPickup ? (
          <ServiceStrip>
            <Car className="mt-0.5 h-4 w-4 shrink-0 text-[#C4A35A]" />
            <div>
              <p className="text-sm font-semibold text-[#0B1F3A]">
                VIP Airport Pickup Included
              </p>
              {fleetLabel ? (
                <p className="text-xs text-[#8A8278]">{fleetLabel}</p>
              ) : null}
            </div>
          </ServiceStrip>
        ) : null}
      </TicketCard>

      {state.locations.length === 0 ? (
        <>
          <TimelineSpine />
          <TicketCard accent="muted">
            <p className="text-sm text-[#8A8278]">
              No cities on your route yet.{" "}
              <Link
                href="/builder"
                className="font-semibold text-[#0B1F3A] underline"
              >
                Add locations in the builder
              </Link>
              .
            </p>
          </TicketCard>
        </>
      ) : (
        state.locations.map((loc, i) => (
          <LocationSegment
            key={loc.key}
            loc={loc}
            index={i}
            next={state.locations[i + 1]}
            cityLabel={cityName(loc.cityId)}
            nextCityLabel={
              state.locations[i + 1]
                ? cityName(state.locations[i + 1].cityId)
                : ""
            }
            dateLabel={dateRanges[i]?.label ?? ""}
            config={config}
            state={state}
          />
        ))
      )}

      <TimelineSpine />

      <TicketCard accent="navy">
        <div className="flex items-center gap-2">
          <PlaneTakeoff className="h-4 w-4 text-[#0B1F3A]" />
          <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[#0B1F3A]">
            Departure
            <span className="mx-2 text-[#C4A35A]">·</span>
            <span className="tracking-normal text-[#5C6570]">
              {formatDisplayDate(departureIso)}
            </span>
          </h2>
        </div>
        {state.airportDropoff ? (
          <ServiceStrip>
            <Car className="mt-0.5 h-4 w-4 shrink-0 text-[#C4A35A]" />
            <div>
              <p className="text-sm font-semibold text-[#0B1F3A]">
                VIP Airport Drop-off Included
              </p>
              {fleetLabel ? (
                <p className="text-xs text-[#8A8278]">{fleetLabel}</p>
              ) : null}
            </div>
          </ServiceStrip>
        ) : null}
        <p className="mt-3 text-sm text-[#5C6570]">
          Departing from{" "}
          <span className="font-semibold text-[#0B1F3A]">
            {hubFull(departureHub) || "Departure hub TBD"}
          </span>
        </p>
      </TicketCard>
    </div>
  );
}

function LocationSegment({
  loc,
  index,
  next,
  cityLabel,
  nextCityLabel,
  dateLabel,
  config,
  state,
}: {
  loc: LocationStop;
  index: number;
  next?: LocationStop;
  cityLabel: string;
  nextCityLabel: string;
  dateLabel: string;
  config: BuilderConfig | null;
  state: BuilderState;
}) {
  const isWaypoint =
    loc.visitType === "arrival" || loc.visitType === "departure";
  const hotelPref = state.cityHotels[loc.cityId];
  const tours = state.selectedTours[loc.cityId] ?? [];
  const chauffeurByDate = state.chauffeurSelections[loc.cityId] ?? {};

  const chauffeurLines = Object.entries(chauffeurByDate)
    .filter(([, sel]) => sel && sel.mode !== "none")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, sel]) => {
      const dayNum = tripDayIndex(state.arrivalDate, date);
      const modeLabel =
        sel.mode === "full_day"
          ? "Full Day"
          : sel.mode === "by_tour"
            ? "By Tour"
            : "—";
      return `Day ${dayNum} (${modeLabel})`;
    });

  return (
    <>
      <TimelineSpine />
      {isWaypoint ? (
        <TicketCard accent="muted" compact>
          <div className="flex items-center gap-2">
            <CircleDot className="h-3.5 w-3.5 text-[#8A8278]" />
            <div>
              <p className="text-sm font-semibold text-[#0B1F3A]">
                {cityLabel}
              </p>
              <p className="text-xs text-[#8A8278]">
                {loc.visitType === "arrival"
                  ? "Arrival waypoint · 0 nights"
                  : "Departure waypoint · 0 nights"}
                {dateLabel ? ` · ${dateLabel}` : ""}
              </p>
            </div>
          </div>
        </TicketCard>
      ) : (
        <TicketCard accent="plain">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-[#C4A35A]" />
              <h2 className="font-display text-xl text-[#0B1F3A]">
                {cityLabel}
                <span className="mx-2 text-[#C4A35A]">·</span>
                <span className="text-base font-sans font-semibold text-[#5C6570]">
                  {loc.nights} Night{loc.nights === 1 ? "" : "s"}
                </span>
              </h2>
            </div>
            {dateLabel ? (
              <p className="shrink-0 text-xs text-[#8A8278]">{dateLabel}</p>
            ) : null}
          </div>

          {state.needHotels || hotelPref?.needsHotel !== false ? (
            <div className="mt-4 flex items-start gap-2 border-t border-dashed border-[#E8E2D9] pt-3">
              <BedDouble className="mt-0.5 h-4 w-4 shrink-0 text-[#C4A35A]" />
              <p className="text-sm text-[#5C6570]">
                <span className="font-semibold text-[#0B1F3A]">
                  {hotelPref
                    ? `${hotelPref.starRating}-Star Hotel Tier`
                    : `${state.hotelTier === "5-star" ? "5" : "4"}-Star Hotel Tier`}
                </span>
                {" · "}
                {state.roomCount}×{" "}
                {hotelPref?.roomType ?? state.roomType} Room
              </p>
            </div>
          ) : null}

          {tours.length > 0 ? (
            <ul className="mt-3 space-y-2 border-t border-dashed border-[#E8E2D9] pt-3">
              {tours.map((row) => {
                const tour = config?.tours.find((t) => t.id === row.tourId);
                const hours = tour?.duration_hours ?? row.duration_hours;
                return (
                  <li
                    key={`${row.tourId}-${row.scheduledDate}`}
                    className="flex items-start gap-2 text-sm"
                  >
                    <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-[#C4A35A]" />
                    <span>
                      <span className="font-medium text-[#0B1F3A]">
                        {tour?.title ?? row.title ?? row.tourId}
                      </span>
                      {hours ? (
                        <span className="text-[#8A8278]">, {hours}h</span>
                      ) : null}
                      {row.scheduledDate ? (
                        <span className="mt-0.5 block text-xs text-[#8A8278]">
                          {formatCityDateSingle(row.scheduledDate) ||
                            formatDisplayDate(row.scheduledDate)}
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {chauffeurLines.length > 0 ? (
            <div className="mt-3 flex items-start gap-2 border-t border-dashed border-[#E8E2D9] pt-3">
              <Car className="mt-0.5 h-4 w-4 shrink-0 text-[#C4A35A]" />
              <p className="text-sm text-[#5C6570]">
                <span className="font-semibold text-[#0B1F3A]">
                  Private Chauffeur:
                </span>{" "}
                {chauffeurLines.join(", ")}
              </p>
            </div>
          ) : null}

          <span className="sr-only">Stop {index + 1}</span>
        </TicketCard>
      )}

      {next ? (
        <>
          <TimelineSpine />
          <div className="flex justify-center py-0.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#0B1F3A]/25 bg-white px-3 py-1.5 text-xs font-semibold text-[#0B1F3A] shadow-sm">
              {loc.transitType === "private" ? (
                <Car className="h-3.5 w-3.5 text-[#C4A35A]" />
              ) : (
                <TrainFront className="h-3.5 w-3.5 text-[#C4A35A]" />
              )}
              {loc.transitType === "private"
                ? `Private Car to ${nextCityLabel}`
                : `Bullet Train (Shinkansen) to ${nextCityLabel}`}
            </span>
          </div>
        </>
      ) : null}
    </>
  );
}

function TicketCard({
  children,
  accent,
  compact,
}: {
  children: React.ReactNode;
  accent: "gold" | "navy" | "plain" | "muted";
  compact?: boolean;
}) {
  const border =
    accent === "gold"
      ? "border-l-[3px] border-l-[#C4A35A]"
      : accent === "navy"
        ? "border-l-[3px] border-l-[#0B1F3A]"
        : accent === "muted"
          ? "border-l-[3px] border-l-[#D9D2C7]"
          : "border-l-[3px] border-l-[#E8E2D9]";

  return (
    <section
      className={`rounded-2xl border border-[#E8E2D9] bg-white shadow-[0_2px_12px_rgba(11,31,58,0.04)] ${border} ${
        compact ? "px-4 py-3" : "px-5 py-4"
      }`}
    >
      {children}
    </section>
  );
}

function ServiceStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex items-start gap-2.5 border-t border-dashed border-[#E8E2D9] pt-3">
      {children}
    </div>
  );
}

function MetaBlock({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        {icon}
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-[#C4A35A]/90">
          {label}
        </p>
      </div>
      <p className="text-sm leading-snug text-white/90">{value}</p>
    </div>
  );
}

function TimelineSpine() {
  return (
    <div className="flex justify-center py-1" aria-hidden>
      <div className="h-5 w-px border-l border-dashed border-[#0B1F3A]/30" />
    </div>
  );
}

function isHub(h: PbHub | PbTransfer): h is PbHub {
  return "name" in h && !("from_location" in h);
}

function hubFull(h: PbHub | PbTransfer | null): string {
  if (!h) return "";
  if (isHub(h)) return h.name;
  return transferLocation(h);
}

function hubShort(h: PbHub | PbTransfer): string {
  const full = hubFull(h);
  const code = full.match(/\(([A-Z]{3})\)/)?.[1];
  if (code) return code;
  const lower = full.toLowerCase();
  if (lower.includes("narita")) return "NRT";
  if (lower.includes("haneda")) return "HND";
  if (lower.includes("kansai") || lower.includes("osaka")) return "KIX";
  if (lower.includes("chubu") || lower.includes("nagoya")) return "NGO";
  return full.split(/[·(]/)[0]?.trim() || full;
}

function tripDayIndex(arrivalIso: string | null, date: string): number {
  if (!arrivalIso || !date) return 1;
  const [ay, am, ad] = arrivalIso.split("-").map(Number);
  const [by, bm, bd] = date.split("-").map(Number);
  if (!ay || !am || !ad || !by || !bm || !bd) return 1;
  const a = Date.UTC(ay, am - 1, ad);
  const b = Date.UTC(by, bm - 1, bd);
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

export function resolveHub(
  config: BuilderConfig | null,
  id: string | null | undefined
): PbHub | PbTransfer | null {
  if (!config || !id) return null;
  return (
    config.hubs.find((h) => h.id === id) ||
    config.transfers.find((t) => t.id === id) ||
    null
  );
}
