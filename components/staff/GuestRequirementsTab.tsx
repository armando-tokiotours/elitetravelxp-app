"use client";

import type { ReactNode } from "react";
import type { OpsGuestRequirements } from "@/lib/opsGuestRequirements";

function PassBadge({ value }: { value: boolean | null }) {
  if (value === true) {
    return <span className="font-semibold text-emerald-400">Yes</span>;
  }
  if (value === false) {
    return <span className="font-semibold text-zinc-400">No</span>;
  }
  return <span className="font-semibold text-zinc-500">Unset</span>;
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-xs text-zinc-200 sm:text-sm">{value || "—"}</p>
    </div>
  );
}

function SectionTitle({
  children,
  tone = "amber",
  trailing,
}: {
  children: ReactNode;
  tone?: "amber" | "cyan";
  trailing?: ReactNode;
}) {
  return (
    <h2
      className={`flex items-center justify-between gap-2 border-b border-white/10 pb-2 font-sans text-sm font-semibold tracking-wider uppercase ${
        tone === "cyan" ? "text-cyan-300" : "text-[#F6A724]"
      }`}
    >
      <span>{children}</span>
      {trailing}
    </h2>
  );
}

/**
 * Ops Master Brief — aggregates every client input for Tab 1: Guest Requirements.
 */
export function GuestRequirementsTab({
  reqs,
  langFlag = "",
}: {
  reqs: OpsGuestRequirements;
  langFlag?: string;
}) {
  const partyTotal = reqs.adults + reqs.children + reqs.infants;
  const partyDetail = [
    `${reqs.adults} Adult${reqs.adults === 1 ? "" : "s"}`,
    reqs.children > 0
      ? `${reqs.children} Child${reqs.children === 1 ? "" : "ren"}`
      : null,
    reqs.infants > 0
      ? `${reqs.infants} Infant${reqs.infants === 1 ? "" : "s"}`
      : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-6 text-xs text-white">
      {/* Executive summary strip */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="space-y-1 rounded-xl border border-white/10 bg-[#0D1117] p-3.5">
          <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
            Party size
          </span>
          <div className="text-base font-bold text-[#F6A724]">
            {partyTotal > 0 ? partyTotal : "—"} Guests{" "}
            <span className="text-xs font-normal text-gray-400">
              ({partyDetail || "Unset"})
            </span>
          </div>
        </div>
        <div className="space-y-1 rounded-xl border border-white/10 bg-[#0D1117] p-3.5">
          <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
            Travel dates
          </span>
          <div className="text-xs font-bold text-white">
            {reqs.arrivalDateLabel}{" "}
            <span className="font-normal text-gray-400">
              ({reqs.totalDaysLabel})
            </span>
          </div>
        </div>
        <div className="space-y-1 rounded-xl border border-white/10 bg-[#0D1117] p-3.5">
          <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
            Pace &amp; vibe
          </span>
          <div className="text-xs font-bold text-emerald-400 uppercase">
            {reqs.travelPaceLabel} · {reqs.travelVibeLabel !== "—"
              ? reqs.travelVibeLabel
              : reqs.experienceTierLabel}
          </div>
        </div>
        <div className="space-y-1 rounded-xl border border-white/10 bg-[#0D1117] p-3.5">
          <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
            IC cards &amp; logistics
          </span>
          <div className="text-xs font-bold text-cyan-400">
            {reqs.icCardsLabel}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* A. Guest & Contact Profile */}
        <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1117] p-4">
          <SectionTitle>1. Guest contact &amp; requirements</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Lead guest" value={reqs.guestName} />
            <Field label="Email" value={reqs.guestEmail} />
            <Field label="WhatsApp / phone" value={reqs.guestPhone} />
            <Field
              label="Language"
              value={
                langFlag
                  ? `${langFlag} ${reqs.tourLanguage}`
                  : reqs.tourLanguage
              }
            />
            <Field label="Travel pace" value={reqs.travelPaceLabel} />
            <Field label="Travel vibe" value={reqs.travelVibeLabel} />
            <Field label="Experience tier" value={reqs.experienceTierLabel} />
            <Field label="Interests" value={reqs.interestsLabel} />
          </div>
          <div className="rounded-xl border border-white/5 bg-black/40 p-3">
            <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
              Dietary / mobility / special notes
            </p>
            <p className="mt-1 text-xs text-zinc-300">{reqs.specialMobility}</p>
            <p className="mt-1 text-xs text-zinc-400">{reqs.specialNotes}</p>
          </div>
        </div>

        {/* B. Flight, Logistics & Transit */}
        <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1117] p-4">
          <SectionTitle>2. Flight, logistics &amp; transit</SectionTitle>
          <div className="space-y-2 text-xs text-gray-300">
            <div>
              <strong className="text-white">Arrival hub:</strong>{" "}
              {reqs.arrivalHubLabel}
            </div>
            <div>
              <strong className="text-white">Arrival pickup:</strong>{" "}
              {reqs.arrivalVipLabel}
            </div>
            <div>
              <strong className="text-white">Arrival flight:</strong>{" "}
              {reqs.arrivalFlightLabel}
            </div>
            <div>
              <strong className="text-white">Departure hub:</strong>{" "}
              {reqs.departureHubLabel}
            </div>
            <div>
              <strong className="text-white">Departure drop-off:</strong>{" "}
              {reqs.departureDropoffLabel}
            </div>
            <div>
              <strong className="text-white">Departure flight:</strong>{" "}
              {reqs.departureFlightLabel}
            </div>
            <div>
              <strong className="text-white">Chauffeur pickup:</strong>{" "}
              {reqs.chauffeurPickupLabel}
            </div>
            <div>
              <strong className="text-white">Shinkansen:</strong>{" "}
              {reqs.shinkansenLabel}
            </div>
            <div>
              <strong className="text-white">Transport mix:</strong>{" "}
              {reqs.transportStrategy}
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              <span>
                JR Pass: <PassBadge value={reqs.guestHasJRPass} />
              </span>
              <span>
                IC Card: <PassBadge value={reqs.guestHasICCard} />
              </span>
              <span>
                Transit help: <PassBadge value={reqs.guestNeedsTransitHelp} />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* C. Hotel & Accommodation */}
      <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1117] p-4">
        <SectionTitle>3. Hotel &amp; accommodation summary</SectionTitle>
        {reqs.itineraryStops.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {reqs.itineraryStops.map((stop, idx) => (
              <div
                key={`${stop.cityId}-${idx}`}
                className="rounded-xl border border-white/5 bg-black/40 p-3"
              >
                <p className="text-xs font-bold text-white">{stop.cityName}</p>
                <p className="mt-0.5 text-[10px] text-[#F6A724]">
                  {stop.dateLabel} · {stop.nights} night
                  {stop.nights === 1 ? "" : "s"}
                </p>
                <p
                  className={`mt-1 text-xs font-semibold ${
                    stop.hotelArrangement === "tokiotours"
                      ? "text-[#F6A724]"
                      : stop.hotelArrangement === "self"
                        ? "text-zinc-300"
                        : "text-zinc-500"
                  }`}
                >
                  {stop.hotelLabel}
                </p>
                <p className="mt-0.5 text-[10px] text-[#7ec8e3]">
                  {stop.localTransitLabel}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-500 italic">
            No accommodation cities selected yet.
          </p>
        )}
      </div>

      {/* D. Day-by-day itinerary */}
      <div className="space-y-4 rounded-2xl border border-white/10 bg-[#0D1117] p-4">
        <SectionTitle
          tone="cyan"
          trailing={
            <span className="text-[10px] font-normal normal-case tracking-normal text-gray-400">
              {reqs.serviceCount} service
              {reqs.serviceCount === 1 ? "" : "s"} ·{" "}
              {reqs.accessLines.length} ticket line
              {reqs.accessLines.length === 1 ? "" : "s"}
            </span>
          }
        >
          4. Complete day-by-day master plan
        </SectionTitle>

        {/* Hub waypoints */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-white/5 bg-black/40 p-3">
            <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
              Arrival waypoint
            </p>
            <p className="mt-0.5 text-xs font-bold text-white">
              {reqs.arrivalHubLabel}
            </p>
            <p className="text-[11px] text-zinc-400">{reqs.arrivalVipLabel}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-black/40 p-3">
            <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
              Departure waypoint
            </p>
            <p className="mt-0.5 text-xs font-bold text-white">
              {reqs.departureHubLabel}
            </p>
            <p className="text-[11px] text-zinc-400">
              {reqs.departureDropoffLabel}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {reqs.itineraryStops.length > 0 ? (
            reqs.itineraryStops.map((loc, idx) => (
              <div
                key={`plan-${loc.cityId}-${idx}`}
                className="space-y-2 rounded-xl border border-white/5 bg-black/40 p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-bold text-white">
                    {loc.cityName}{" "}
                    <span className="text-xs font-normal text-zinc-400">
                      · {loc.nights} night{loc.nights === 1 ? "" : "s"}
                    </span>
                  </p>
                  <p className="text-[10px] text-[#F6A724]">{loc.dateLabel}</p>
                </div>
                <p className="text-[11px] text-zinc-400">
                  In: {loc.incomingTitle}
                  {loc.outgoingTitle ? ` · Out: ${loc.outgoingTitle}` : ""}
                </p>

                {loc.days.map((day) => (
                  <div
                    key={`${loc.cityId}-${day.dayIndex}-${day.date || "tbd"}`}
                    className="rounded-lg border border-white/5 bg-[#0D1117] p-3"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-[#F6A724]">
                        DAY {day.dayIndex}
                        {day.dateLabel ? ` — ${day.dateLabel}` : ""} ({loc.cityName})
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {day.hasCar ? (
                          <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-zinc-300">
                            CAR
                          </span>
                        ) : null}
                        {day.hasGuide ? (
                          <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-zinc-300">
                            GUIDE
                          </span>
                        ) : (
                          <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-zinc-500">
                            Guide unassigned
                          </span>
                        )}
                        {day.hasTickets ? (
                          <span className="rounded bg-[#F6A724]/20 px-2 py-0.5 text-[10px] font-bold text-[#F6A724]">
                            TICKETS
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-1 border-l-2 border-[#075473] pl-3">
                      {day.tours.map((t) => (
                        <div key={`${t.tourId}-${t.title}`}>
                          <p className="font-bold text-white">{t.title}</p>
                          <p className="text-[10px] text-zinc-500">
                            {[
                              t.language ? `Lang ${t.language}` : null,
                              t.hours ? `${t.hours}h` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "Booked experience"}
                          </p>
                        </div>
                      ))}
                      {day.tickets.map((t, i) => (
                        <div
                          key={`${t.title}-${i}`}
                          className="rounded border border-dashed border-purple-400/40 bg-black/30 px-2 py-1"
                        >
                          <p className="text-[11px] font-mono text-purple-300">
                            Ticket: {t.title}
                          </p>
                          <p className="text-[10px] text-zinc-500">{t.type}</p>
                        </div>
                      ))}
                      {!day.tours.length &&
                      !day.tickets.length &&
                      !day.hasCar ? (
                        <p className="text-[11px] text-zinc-600 italic">
                          No activities flagged this day
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-500 italic">
              No stay cities / day services selected yet.
            </p>
          )}
        </div>

        {/* Catalog ticket / access rollup */}
        {reqs.accessLines.length > 0 ? (
          <div className="rounded-xl border border-dashed border-[#F6A724]/30 bg-black/40 p-3">
            <p className="mb-2 text-[10px] font-bold tracking-wider text-[#F6A724] uppercase">
              Ticket &amp; access rollup
            </p>
            <ul className="space-y-1">
              {reqs.accessLines.map((line) => (
                <li
                  key={`${line.tourId}-${line.title}`}
                  className="text-xs text-zinc-300"
                >
                  <span className="font-semibold text-white">{line.title}</span>
                  <span className="text-zinc-500"> · {line.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Meeting point (single-day / first service) */}
        <div className="grid grid-cols-1 gap-3 border-t border-white/10 pt-3 sm:grid-cols-2">
          <Field label="Meeting point" value={reqs.meetingPointName} />
          <Field label="Address" value={reqs.meetingPointAddress} />
          <Field label="Start time" value={reqs.startTime} />
          <Field label="Duration" value={reqs.durationLabel} />
          <Field
            label="Primary tour / experience"
            value={
              reqs.tourCode &&
              reqs.tourCode !== "—" &&
              !reqs.tourTitle.includes(reqs.tourCode)
                ? `${reqs.tourTitle} · ${reqs.tourCode}`
                : reqs.tourTitle
            }
          />
        </div>
      </div>
    </div>
  );
}
