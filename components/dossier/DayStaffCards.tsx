"use client";

import { Car, Ticket, UserRound } from "lucide-react";

export type ServiceIconState = "none" | "pending" | "confirmed" | "cancelled";

function toneClass(state: ServiceIconState): string {
  switch (state) {
    case "confirmed":
      return "border-emerald-500/50 bg-emerald-500/15 text-emerald-300";
    case "pending":
      return "border-amber-500/50 bg-amber-500/15 text-amber-300";
    case "cancelled":
      return "border-red-500/50 bg-red-500/15 text-red-300";
    default:
      return "border-white/10 bg-zinc-900/80 text-zinc-600";
  }
}

function ServiceIcon({
  label,
  state,
  Icon,
}: {
  label: string;
  state: ServiceIconState;
  Icon: typeof Car;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-0.5 rounded-xl border px-2 py-1.5 ${toneClass(state)}`}
      title={`${label}: ${state}`}
    >
      <Icon className="h-4 w-4" aria-hidden />
      <span className="text-[8px] font-bold tracking-wider uppercase">
        {label}
      </span>
    </div>
  );
}

/**
 * Day-by-day car / guide / tickets status strip.
 * none = muted · pending = amber · confirmed = green · cancelled = red
 */
export function DayServiceIcons({
  car = "none",
  guide = "none",
  tickets = "none",
  dayLabel,
}: {
  car?: ServiceIconState;
  guide?: ServiceIconState;
  tickets?: ServiceIconState;
  dayLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {dayLabel ? (
        <span className="mr-1 font-mono text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
          {dayLabel}
        </span>
      ) : null}
      <ServiceIcon label="Car" state={car} Icon={Car} />
      <ServiceIcon label="Guide" state={guide} Icon={UserRound} />
      <ServiceIcon label="Tickets" state={tickets} Icon={Ticket} />
    </div>
  );
}

/**
 * Staff identity card stubs for day timeline (guide / driver).
 * Shows name when Ops has assigned; otherwise quiet "Still pending".
 */
export function StaffIdentityCard({
  role,
  name,
  photoUrl,
  email,
}: {
  role: "guide" | "driver";
  name?: string | null;
  photoUrl?: string | null;
  email?: string | null;
}) {
  const label = role === "guide" ? "Guide" : "Driver";
  const assigned = Boolean(name && String(name).trim());
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
      {photoUrl && assigned ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt=""
          className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-white/10"
        />
      ) : (
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-[10px] font-bold tracking-wider uppercase ${
            assigned
              ? "border-cyan-500/30 bg-cyan-950/40 text-cyan-300"
              : "border-white/10 bg-zinc-900 text-zinc-600"
          }`}
        >
          ID
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[9px] font-semibold tracking-wider text-zinc-500 uppercase">
          {label}
        </p>
        {assigned ? (
          <>
            <p className="truncate text-sm font-semibold text-white">{name}</p>
            {email ? (
              <p className="truncate text-[11px] text-cyan-300/80">{email}</p>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-zinc-600">Still pending</p>
        )}
      </div>
    </div>
  );
}

/** Paper-style ticket stub (train / cinema / attraction) — not boarding pass. */
export function TicketStubCard({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-dashed border-amber-500/40 bg-gradient-to-r from-amber-950/40 to-zinc-950/80 px-3 py-2">
      <div className="absolute top-1/2 -left-1.5 h-3 w-3 -translate-y-1/2 rounded-full bg-[#04080C]" />
      <div className="absolute top-1/2 -right-1.5 h-3 w-3 -translate-y-1/2 rounded-full bg-[#04080C]" />
      <p className="text-[9px] font-bold tracking-[0.2em] text-amber-400/80 uppercase">
        Ticket
      </p>
      <p className="text-sm font-semibold text-white">{title}</p>
      {subtitle ? (
        <p className="text-[11px] text-zinc-400">{subtitle}</p>
      ) : null}
    </div>
  );
}

/** Trip-wide Suica / PASMO card — place after all days. */
export function SuicaPassCard({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="mt-4 rounded-2xl border border-[#1BA58A]/40 bg-gradient-to-br from-[#0a2a24] to-[#0A1017] p-4">
      <p className="text-[10px] font-bold tracking-[0.2em] text-[#1BA58A] uppercase">
        IC Pass · Trip-wide
      </p>
      <p className="mt-1 font-godiva text-lg tracking-wider text-white">
        SUICA / PASMO
      </p>
      <p className="mt-1 text-xs text-zinc-400">
        Valid for the full itinerary — trains, metro, and many convenience
        stores.
      </p>
    </div>
  );
}
