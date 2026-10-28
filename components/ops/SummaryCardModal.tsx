"use client";

import Link from "next/link";
import {
  CalendarDays,
  Car,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  UserCircle,
  Wallet,
  X,
} from "lucide-react";
import type { OpsCalendarEvent } from "@/lib/opsCalendar";
import {
  OPS_CALENDAR_COLOR,
  type OpsCalendarColorKey,
} from "@/lib/opsCalendarStatus";
import { formatGuideJobDateLabel } from "@/lib/guideJobs";
import { guideConfirmStaffLabel } from "@/lib/guideConfirmStatus";

function formatEur(n: number): string {
  if (!n) return "€0";
  return `€${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function paymentLabel(status: string): string {
  switch (String(status || "").toUpperCase()) {
    case "FULLY_PAID":
      return "Fully paid";
    case "PARTIALLY_PAID":
      return "30%+ deposit secured";
    case "FEE_PAID":
      return "Design fee paid (€60)";
    case "UNPAID":
      return "Unpaid / draft";
    default:
      return status || "—";
  }
}

export function SummaryCardModal({
  event,
  onClose,
}: {
  event: OpsCalendarEvent | null;
  onClose: () => void;
}) {
  if (!event) return null;

  const colorKey: OpsCalendarColorKey = event.colorKey;
  const tone = OPS_CALENDAR_COLOR[colorKey];
  const stayLabel =
    event.startDate === event.endDate
      ? formatGuideJobDateLabel(event.startDate)
      : `${formatGuideJobDateLabel(event.startDate)} → ${formatGuideJobDateLabel(event.endDate)}`;
  const serviceDayCount = event.serviceDays?.length ?? 0;
  const continuousCount =
    event.serviceDays?.filter((d) => d.dayKind === "continuous").length ?? 0;
  const ticketOnlyCount =
    event.serviceDays?.filter((d) => d.dayKind === "ticket_only").length ?? 0;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/65 p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ops-cal-summary-title"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#0A1017] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`h-1.5 w-full rounded-t-3xl ${tone.bar}`} />

        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[0.6rem] font-semibold tracking-[0.28em] text-[#075473] uppercase">
              Interactive summary
            </p>
            <h2
              id="ops-cal-summary-title"
              className="mt-1 font-display text-xl text-white"
            >
              {event.pnr}
            </h2>
            <p className="mt-0.5 truncate text-sm text-zinc-400">
              {event.guestName}
              {event.guestSummary ? ` · ${event.guestSummary}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${tone.chip}`}
            >
              {event.status.label}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] tracking-wider text-zinc-400 uppercase">
              {String(event.bookingStatus || "—").replace(/_/g, " ")}
            </span>
            {event.status.datesLocked ? (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] text-emerald-300">
                Dates locked
              </span>
            ) : (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] text-amber-200">
                Dates moveable
              </span>
            )}
          </div>

          <section className="rounded-2xl border border-[#F6A724]/25 bg-[#F6A724]/5 p-3">
            <div className="flex items-start gap-2 text-zinc-300">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[#F6A724]" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold tracking-[0.2em] text-[#F6A724] uppercase">
                  Guest in Japan
                </p>
                <p className="mt-1 font-display text-lg text-white sm:text-xl">
                  {stayLabel}
                </p>
                <p className="mt-1 text-[11px] text-zinc-400">
                  Full stay ({event.startDate}
                  {event.endDate !== event.startDate
                    ? ` → ${event.endDate}`
                    : ""}
                  ). Calendar bars show service days only — not empty rest days.
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-2 rounded-2xl border border-white/10 bg-[#0D1117]/80 p-3 sm:grid-cols-2">
            <div className="flex items-start gap-2 text-zinc-300">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F6A724]" />
              <div>
                <p className="text-[10px] tracking-wider text-zinc-500 uppercase">
                  Primary city
                </p>
                <p className="mt-0.5 text-sm text-white">{event.primaryCity}</p>
              </div>
            </div>
            <div className="text-zinc-300">
              <p className="text-[10px] tracking-wider text-zinc-500 uppercase">
                Service days on grid
              </p>
              <p className="mt-0.5 text-sm text-white">
                {serviceDayCount} day{serviceDayCount === 1 ? "" : "s"}
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-500">
                {continuousCount} tour/guide/transit
                {ticketOnlyCount > 0
                  ? ` · ${ticketOnlyCount} ticket-only`
                  : ""}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#0D1117]/80 p-3">
            <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
              Guest contacts
            </p>
            <ul className="mt-2 space-y-1.5 text-zinc-300">
              <li className="flex items-center gap-2">
                <UserCircle className="h-3.5 w-3.5 text-zinc-500" />
                <span>{event.guestName || "—"}</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-zinc-500" />
                {event.guestEmail ? (
                  <a
                    href={`mailto:${event.guestEmail}`}
                    className="text-[#7ec8e3] hover:underline"
                  >
                    {event.guestEmail}
                  </a>
                ) : (
                  <span className="text-zinc-500">No email on file</span>
                )}
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-zinc-500" />
                {event.guestPhone ? (
                  <a
                    href={`tel:${event.guestPhone.replace(/\s/g, "")}`}
                    className="text-[#7ec8e3] hover:underline"
                  >
                    {event.guestPhone}
                  </a>
                ) : (
                  <span className="text-zinc-500">No phone on file</span>
                )}
              </li>
            </ul>
          </section>

          <section className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#0D1117]/80 p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                <UserCircle className="h-3 w-3" /> Guide
              </p>
              <p className="mt-1 text-sm text-white">{event.assignedGuide}</p>
              <p
                className={`mt-1 text-[10px] ${
                  event.status.guideGap ? "text-red-300" : "text-zinc-500"
                }`}
              >
                {guideConfirmStaffLabel(event.status.guideStatus)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0D1117]/80 p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                <Car className="h-3 w-3" /> Driver
              </p>
              <p className="mt-1 text-sm text-white">{event.assignedDriver}</p>
              <p
                className={`mt-1 text-[10px] ${
                  event.status.driverGap ? "text-red-300" : "text-zinc-500"
                }`}
              >
                {event.status.driverGap
                  ? "Unassigned / needs dispatch"
                  : "Dispatch OK"}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#0D1117]/80 p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
              <Wallet className="h-3 w-3" /> Payment
            </p>
            <p className="mt-1 text-sm text-white">
              {paymentLabel(event.tourPaymentStatus)}
            </p>
            <p className="mt-1 text-zinc-400">
              Paid {formatEur(event.totalPaidEur)}
              {event.estimatedTotalEur > 0
                ? ` of ${formatEur(event.estimatedTotalEur)}`
                : ""}
            </p>
            {event.assignedAgent !== "—" ? (
              <p className="mt-1 text-zinc-500">
                Concierge: {event.assignedAgent}
              </p>
            ) : null}
          </section>

          {(event.scopeNotes ||
            event.pickupNotes ||
            event.specialRequests) && (
            <section className="rounded-2xl border border-white/10 bg-[#0D1117]/80 p-3 space-y-2">
              <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                Itinerary / scope notes
              </p>
              {event.scopeNotes ? (
                <p className="text-zinc-300 leading-relaxed">{event.scopeNotes}</p>
              ) : null}
              {event.pickupNotes ? (
                <p className="text-zinc-400">
                  <span className="text-zinc-500">Pickup: </span>
                  {event.pickupNotes}
                </p>
              ) : null}
              {event.specialRequests ? (
                <p className="text-zinc-400">
                  <span className="text-zinc-500">Requests: </span>
                  {event.specialRequests}
                </p>
              ) : null}
            </section>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href={`/ops?pnr=${encodeURIComponent(event.pnr)}`}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#075473] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#054F70] sm:flex-none"
            >
              Open in Ops inbox
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <Link
              href={`/ops/booking?pnr=${encodeURIComponent(event.pnr)}`}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/5"
            >
              Booking master
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-full border border-white/10 px-4 py-2.5 text-xs text-zinc-400 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
