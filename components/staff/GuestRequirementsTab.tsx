"use client";

import type { ReactNode } from "react";
import {
  accommodationSummaryStops,
  type OpsGuestRequirements,
} from "@/lib/opsGuestRequirements";
import { hasGuestSpecialRequirements } from "@/lib/guestSpecialRequirements";
import {
  matchGuideJobForDay,
  normalizeGuideJobStatus,
  normalizeTourDateIso,
  type GuideJobRow,
} from "@/lib/guideJobs";

function PassBadge({ value }: { value: boolean | null }) {
  if (value === true) {
    return <span className="font-semibold text-emerald-400">Yes</span>;
  }
  if (value === false) {
    return <span className="font-semibold text-zinc-400">No</span>;
  }
  return <span className="font-semibold text-zinc-500">Unset</span>;
}

/** Matches header `icCardsLabel` / “assistance needed” (cyan). */
function TransitHelpBadge({ value }: { value: boolean | null }) {
  if (value === true) {
    return (
      <span className="font-semibold text-cyan-400">Assistance Needed</span>
    );
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
      <p className="text-[10px] font-normal tracking-wider text-zinc-400 uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-xs font-bold text-zinc-100 sm:text-sm">
        {value || "—"}
      </p>
    </div>
  );
}

/** Logistics row: grey label · bold value */
function LogisticsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs">
      <span className="font-normal text-zinc-400">{label}:</span>{" "}
      <span className="font-bold text-zinc-100">{value || "—"}</span>
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
      className={`flex items-center justify-between gap-2 border-b border-zinc-700 pb-2 font-sans text-sm font-semibold tracking-wider uppercase ${
        tone === "cyan" ? "text-cyan-400" : "text-[#F6A724]"
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
  guideJobs = [],
}: {
  reqs: OpsGuestRequirements;
  langFlag?: string;
  /** Per-day guide_jobs for this PNR (from Dispatch sync). */
  guideJobs?: GuideJobRow[];
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

  // Keep Hotel & Accommodation UI; only hide when lodging not required / no real data.
  const hotelStops = accommodationSummaryStops(reqs.itineraryStops);

  return (
    <div className="space-y-6 text-xs text-slate-900">
      {/* Executive summary strip */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-3.5">
          <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
            Party size
          </span>
          <div className="text-base font-bold text-amber-700">
            {partyTotal > 0 ? partyTotal : "—"} Guests{" "}
            <span className="text-xs font-normal text-slate-500">
              ({partyDetail || "Unset"})
            </span>
          </div>
        </div>
        <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-3.5">
          <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
            Travel dates
          </span>
          <div className="text-xs font-bold text-slate-900">
            {reqs.arrivalDateLabel}{" "}
            <span className="font-normal text-slate-500">
              ({reqs.totalDaysLabel})
            </span>
          </div>
        </div>
        <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-3.5">
          <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
            Pace &amp; vibe
          </span>
          <div className="text-xs font-bold text-emerald-600 uppercase">
            {reqs.travelPaceLabel} · {reqs.travelVibeLabel !== "—"
              ? reqs.travelVibeLabel
              : reqs.experienceTierLabel}
          </div>
        </div>
        <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-3.5">
          <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
            IC cards &amp; logistics
          </span>
          <div className="text-xs font-bold">
            <span className="text-slate-900">Suica / PASMO</span>{" "}
            <span className="text-cyan-600">
              {reqs.icCardsLabel
                .replace(/^Suica\s*\/\s*PASMO\s*/i, "")
                .trim() || "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* A. Guest & Contact Profile */}
        <div className="space-y-3 rounded-2xl border border-zinc-700 bg-[#23262c] p-4">
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
          <div className="space-y-2 rounded-xl border border-zinc-700 bg-zinc-900/80 p-3">
            <p className="text-[10px] font-bold tracking-wider text-cyan-400 uppercase">
              Dietary / mobility / special notes
            </p>
            {hasGuestSpecialRequirements(reqs.guestSpecialRequirements) ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {reqs.guestSpecialRequirements.hasDietary ? (
                    <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-400">
                      Dietary: Yes
                    </span>
                  ) : null}
                  {reqs.guestSpecialRequirements.mobilityTags.map((m) => (
                    <span
                      key={`m-${m}`}
                      className="rounded border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-1 text-[10px] font-bold text-cyan-300"
                    >
                      {m}
                    </span>
                  ))}
                </div>
                {reqs.guestSpecialRequirements.customNotes.trim() ? (
                  <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 text-xs text-zinc-300">
                    <strong className="mb-0.5 block font-mono text-[10px] uppercase text-zinc-100">
                      Special instructions
                    </strong>
                    {reqs.guestSpecialRequirements.customNotes}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <p className="text-xs italic text-zinc-400">
                  No special requirements specified by client.
                </p>
                {reqs.specialMobility !==
                  "No special requirements specified by client" ||
                reqs.specialNotes !==
                  "No special requirements specified by client" ? (
                  <>
                    <p className="mt-1 text-xs text-zinc-300">
                      {reqs.specialMobility}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {reqs.specialNotes}
                    </p>
                  </>
                ) : null}
              </>
            )}
          </div>
        </div>

        {/* B. Flight, Logistics & Transit */}
        <div className="space-y-3 rounded-2xl border border-zinc-700 bg-[#23262c] p-4">
          <SectionTitle>2. Flight, logistics &amp; transit</SectionTitle>
          <div className="space-y-2">
            <LogisticsRow label="Arrival hub" value={reqs.arrivalHubLabel} />
            <LogisticsRow label="Arrival pickup" value={reqs.arrivalVipLabel} />
            <LogisticsRow
              label="Arrival flight"
              value={reqs.arrivalFlightLabel}
            />
            <LogisticsRow
              label="Departure hub"
              value={reqs.departureHubLabel}
            />
            <LogisticsRow
              label="Departure drop-off"
              value={reqs.departureDropoffLabel}
            />
            <LogisticsRow
              label="Departure flight"
              value={reqs.departureFlightLabel}
            />
            <LogisticsRow
              label="Chauffeur pickup"
              value={reqs.chauffeurPickupLabel}
            />
            <LogisticsRow label="Shinkansen" value={reqs.shinkansenLabel} />
            <LogisticsRow
              label="Transport mix"
              value={reqs.transportStrategy}
            />
            <div className="flex flex-wrap gap-3 pt-1 text-zinc-300">
              <span>
                JR Pass: <PassBadge value={reqs.guestHasJRPass} />
              </span>
              <span>
                IC Card: <PassBadge value={reqs.guestHasICCard} />
              </span>
              <span>
                Transit help:{" "}
                <TransitHelpBadge value={reqs.guestNeedsTransitHelp} />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* C. Hotel & Accommodation Summary — always show section 3; empty shell when no lodging */}
      <div className="space-y-3 rounded-2xl border border-zinc-700 bg-[#23262c] p-4">
        <SectionTitle>3. Hotel &amp; accommodation summary</SectionTitle>
        {hotelStops.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {hotelStops.map((stop, idx) => (
              <div
                key={`${stop.cityId}-${idx}`}
                className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-3"
              >
                <p className="text-xs font-bold text-zinc-100">{stop.cityName}</p>
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
                <p className="mt-0.5 text-[10px] text-cyan-400">
                  {stop.localTransitLabel}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-400">No hotel requested</p>
        )}
      </div>

      {/* D. Day-by-day itinerary */}
      <div className="space-y-4 rounded-2xl border border-zinc-700 bg-[#23262c] p-4">
        <SectionTitle
          tone="cyan"
          trailing={
            <span className="text-[10px] font-normal normal-case tracking-normal text-zinc-400">
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
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-3">
            <p className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
              Arrival waypoint
            </p>
            <p className="mt-0.5 text-xs font-bold text-zinc-100">
              {reqs.arrivalHubLabel}
            </p>
            <p className="text-[11px] text-zinc-400">{reqs.arrivalVipLabel}</p>
          </div>
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-3">
            <p className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
              Departure waypoint
            </p>
            <p className="mt-0.5 text-xs font-bold text-zinc-100">
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
                className="space-y-2 rounded-xl border border-zinc-700 bg-[#23262c] p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-bold text-zinc-100">
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

                {loc.days.map((day) => {
                  const dayJob = matchGuideJobForDay(guideJobs, {
                    date: day.date,
                    dayIndex: day.dayIndex,
                  });
                  const jobStatus = dayJob
                    ? normalizeGuideJobStatus(dayJob.status)
                    : null;
                  const guideName = String(
                    dayJob?.assigned_guide_name || ""
                  ).trim();
                  const guideInitial = guideName
                    ? guideName.charAt(0).toUpperCase()
                    : "?";
                  const needsGuide =
                    day.hasGuide ||
                    (day.tours && day.tours.length > 0) ||
                    Boolean(dayJob);
                  return (
                  <div
                    key={`${loc.cityId}-${day.dayIndex}-${day.date || "tbd"}`}
                    className="rounded-lg border border-zinc-700 bg-zinc-900/80 p-3"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-[#F6A724]">
                        DAY {day.dayIndex}
                        {day.dateLabel ? ` — ${day.dateLabel}` : ""} ({loc.cityName})
                        {normalizeTourDateIso(day.date) ? (
                          <span className="ml-1 font-mono text-[10px] font-normal text-zinc-400">
                            {normalizeTourDateIso(day.date)}
                          </span>
                        ) : null}
                      </span>
                      <div className="flex flex-wrap items-center gap-1">
                        {day.hasCar ? (
                          <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300">
                            CAR
                          </span>
                        ) : null}
                        {jobStatus === "ACCEPTED" ||
                        jobStatus === "COMPLETED" ? (
                          <span className="inline-flex items-center gap-1.5 rounded border border-cyan-500/40 bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#075473] text-[8px] text-white">
                              {guideInitial}
                            </span>
                            {guideName || "Guide confirmed"}
                          </span>
                        ) : jobStatus === "OFFERED" ? (
                          <span className="inline-flex items-center gap-1.5 rounded border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-[#F6A724]">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-600/80 text-[8px] text-white">
                              {guideInitial}
                            </span>
                            {guideName
                              ? `${guideName} · offered`
                              : "Guide offered"}
                          </span>
                        ) : jobStatus === "OPEN_BOARD" ? (
                          <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-400 uppercase">
                            Open board
                          </span>
                        ) : needsGuide ? (
                          <span className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400 uppercase">
                            Guide unassigned
                          </span>
                        ) : null}
                        {day.hasTickets ? (
                          <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-[#F6A724]">
                            TICKETS
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-1 border-l-2 border-[#075473] pl-3">
                      {day.tours.map((t) => (
                        <div key={`${t.tourId}-${t.title}`}>
                          <p className="font-bold text-zinc-100">{t.title}</p>
                          <p className="text-[10px] text-zinc-400">
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
                          className="rounded border border-dashed border-purple-400/50 bg-purple-500/15 px-2 py-1"
                        >
                          <p className="text-[11px] font-mono text-purple-300">
                            Ticket: {t.title}
                          </p>
                          <p className="text-[10px] text-zinc-400">{t.type}</p>
                        </div>
                      ))}
                      {!day.tours.length &&
                      !day.tickets.length &&
                      !day.hasCar ? (
                        <p className="text-[11px] text-zinc-500 italic">
                          No activities flagged this day
                        </p>
                      ) : null}
                    </div>
                  </div>
                  );
                })}
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-400 italic">
              No stay cities / day services selected yet.
            </p>
          )}
        </div>

        {/* Catalog ticket / access rollup */}
        {reqs.accessLines.length > 0 ? (
          <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/10 p-3">
            <p className="mb-2 text-[10px] font-bold tracking-wider text-[#F6A724] uppercase">
              Ticket &amp; access rollup
            </p>
            <ul className="space-y-1">
              {reqs.accessLines.map((line) => (
                <li
                  key={`${line.tourId}-${line.title}`}
                  className="text-xs text-zinc-300"
                >
                  <span className="font-semibold text-zinc-100">{line.title}</span>
                  <span className="text-zinc-400"> · {line.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Meeting point (single-day / first service) */}
        <div className="grid grid-cols-1 gap-3 border-t border-zinc-700 pt-3 sm:grid-cols-2">
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
