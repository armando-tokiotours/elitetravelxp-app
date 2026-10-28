"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { canAccessOpsBoard } from "@/lib/staffRoles";
import { useTeamAuth } from "@/store/useTeamAuth";
import {
  StaffPortalShell,
  STAFF_PORTAL_REFRESH_EVENT,
} from "@/components/staff/StaffPortalShell";
import { loadOpsHub, type OpsHubRow } from "@/components/staff/opsHubClient";
import type { OpsDispatchRow } from "@/lib/opsDispatch";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  DEFAULT_OPS_CALENDAR_FILTERS,
  addDays,
  addMonths,
  buildOpsCalendarEvents,
  countByFilterLane,
  endOfMonth,
  endOfWeekSaturday,
  eventsForDay,
  eventsOverlappingRange,
  filterCalendarEvents,
  formatDayTitle,
  formatMonthTitle,
  formatWeekTitle,
  monthGridDates,
  monthShort,
  sameYmd,
  serviceDayMetaFor,
  startOfMonth,
  startOfWeekSunday,
  toYmd,
  type ContinuityRole,
  type OpsCalendarEvent,
  type OpsCalendarFilters,
  type OpsCalendarGuest,
  type OpsCalendarView,
  weekDates,
  weekdayShort,
} from "@/lib/opsCalendar";
import { OPS_CALENDAR_COLOR } from "@/lib/opsCalendarStatus";
import { SummaryCardModal } from "@/components/ops/SummaryCardModal";

const VIEW_OPTIONS: Array<{ id: OpsCalendarView; label: string }> = [
  { id: "year", label: "Year" },
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
];

function continuityChipClass(role: ContinuityRole | null | undefined): string {
  switch (role) {
    case "start":
      // Bridge into the next day cell
      return "rounded-l-md rounded-r-none border-r-0 pr-2 -mr-1";
    case "mid":
      return "rounded-none border-x-0 px-1 -mx-1";
    case "end":
      return "rounded-r-md rounded-l-none border-l-0 pl-2 -ml-1";
    case "isolated":
    case "single":
    default:
      return "rounded-full";
  }
}

function EventChip({
  event,
  ymd,
  compact,
  onClick,
}: {
  event: OpsCalendarEvent;
  /** Calendar day being rendered — drives continuity bridge styling. */
  ymd: string;
  compact?: boolean;
  onClick: () => void;
}) {
  const tone = OPS_CALENDAR_COLOR[event.colorKey];
  const meta = serviceDayMetaFor(event, ymd);
  const role = meta?.continuity;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={`${event.pnr} · ${event.guestName} · ${event.status.label}${
        meta?.dayKind === "ticket_only" ? " · tickets" : ""
      }`}
      className={`w-full truncate border px-1.5 py-0.5 text-left transition hover:brightness-110 ${tone.chip} ${continuityChipClass(role)} ${
        compact ? "text-[9px] leading-tight" : "text-[10px]"
      }`}
    >
      {role === "mid" ? (
        <span className="block h-1.5 w-full rounded-sm opacity-80" aria-hidden />
      ) : (
        <>
          <span className="font-mono font-semibold">{event.pnr}</span>
          {!compact && role !== "end" && event.primaryCity ? (
            <span className="text-white/70"> · {event.primaryCity}</span>
          ) : null}
        </>
      )}
    </button>
  );
}

function FilterSidebar({
  filters,
  setFilters,
  counts,
  undatedCount,
}: {
  filters: OpsCalendarFilters;
  setFilters: (next: OpsCalendarFilters) => void;
  counts: ReturnType<typeof countByFilterLane>;
  undatedCount: number;
}) {
  const rows: Array<{
    key: keyof OpsCalendarFilters;
    colorKey: keyof typeof OPS_CALENDAR_COLOR;
    count: number;
  }> = [
    { key: "confirmed", colorKey: "confirmed", count: counts.confirmed },
    { key: "design", colorKey: "design", count: counts.design },
    { key: "draft", colorKey: "draft", count: counts.draft },
    {
      key: "actionRequired",
      colorKey: "critical",
      count: counts.actionRequired,
    },
  ];

  return (
    <aside className="w-full shrink-0 space-y-3 rounded-2xl border border-white/10 bg-[#0D1117]/70 p-3 lg:w-56">
      <p className="text-[10px] font-bold tracking-[0.22em] text-[#F6A724] uppercase">
        My calendars
      </p>
      <ul className="space-y-1.5">
        {rows.map((row) => {
          const meta = OPS_CALENDAR_COLOR[row.colorKey];
          const checked = filters[row.key];
          return (
            <li key={row.key}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1.5 text-xs text-zinc-300 hover:bg-white/5">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setFilters({ ...filters, [row.key]: !checked })
                  }
                  className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-900 accent-[#075473]"
                />
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />
                <span className="min-w-0 flex-1 truncate">{meta.label}</span>
                <span className="font-mono text-[10px] text-zinc-500">
                  {row.count}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {undatedCount > 0 ? (
        <p className="border-t border-white/5 pt-2 text-[10px] text-zinc-500">
          {undatedCount} active hub
          {undatedCount === 1 ? "" : "s"} without tour dates (hidden from
          grid).
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => setFilters({ ...DEFAULT_OPS_CALENDAR_FILTERS })}
        className="text-[10px] text-[#7ec8e3] hover:underline"
      >
        Show all
      </button>
    </aside>
  );
}

export function OpsCalendarApp() {
  return (
    <StaffPortalShell title="Operations Calendar" allow={canAccessOpsBoard} wide>
      <OpsCalendarInner />
    </StaffPortalShell>
  );
}

function OpsCalendarInner() {
  const getClient = useTeamAuth((s) => s.getClient);
  const [hubs, setHubs] = useState<OpsHubRow[]>([]);
  const [dispatchByPnr, setDispatchByPnr] = useState<
    Record<string, OpsDispatchRow>
  >({});
  const [guestsByPnr, setGuestsByPnr] = useState<
    Record<string, OpsCalendarGuest>
  >({});
  const [openGuideJobPnrs, setOpenGuideJobPnrs] = useState<Set<string>>(
    () => new Set()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<OpsCalendarView>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [filters, setFilters] = useState<OpsCalendarFilters>({
    ...DEFAULT_OPS_CALENDAR_FILTERS,
  });
  const [selected, setSelected] = useState<OpsCalendarEvent | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pb = getClient();
      const rows = await loadOpsHub(pb);
      setHubs(rows);

      const byPnr: Record<string, OpsDispatchRow> = {};
      try {
        const list = await pb
          .collection("ops_dispatch")
          .getFullList<OpsDispatchRow>({ requestKey: null });
        for (const d of list) {
          const pnr = String(d.pnr || "")
            .trim()
            .toUpperCase();
          if (pnr) byPnr[pnr] = d;
        }
      } catch {
        /* optional */
      }
      setDispatchByPnr(byPnr);

      const guests: Record<string, OpsCalendarGuest> = {};
      try {
        const bals = await pb.collection("bookings_and_leads").getFullList<{
          booking_ref?: string;
          email?: string;
          full_name?: string;
          name?: string;
          guest_name?: string;
          contact_phone?: string;
          whatsapp?: string;
          phone?: string;
          duration_value?: number;
          duration_label?: string;
          type?: string;
          selections?: unknown;
        }>({ requestKey: null });
        for (const bal of bals) {
          const ref = String(bal.booking_ref || "")
            .trim()
            .toUpperCase();
          if (!ref) continue;
          const type = String(bal.type || "").toLowerCase();
          const label = String(bal.duration_label || "").toLowerCase();
          let durationDays: number | null = null;
          const raw = Number(bal.duration_value) || 0;
          if (
            raw > 0 &&
            (type.includes("multi") ||
              label.includes("day") ||
              (!type.includes("single") && raw <= 30 && raw >= 2))
          ) {
            durationDays = Math.round(raw);
          }
          const sel =
            bal.selections && typeof bal.selections === "object"
              ? (bal.selections as Record<string, unknown>)
              : {};
          const phone = String(
            bal.contact_phone ||
              bal.whatsapp ||
              bal.phone ||
              sel.guestPhone ||
              sel.whatsapp ||
              sel.phone ||
              ""
          ).trim();
          guests[ref] = {
            email: String(bal.email || "")
              .trim()
              .toLowerCase(),
            name: String(
              bal.full_name || bal.guest_name || bal.name || ""
            ).trim(),
            phone,
            durationDays,
          };
        }
      } catch {
        /* agency-only hubs */
      }
      setGuestsByPnr(guests);

      const openPnrs = new Set<string>();
      try {
        const jobs = await pb.collection("guide_jobs").getFullList<{
          pnr?: string;
          status?: string;
        }>({
          filter: 'status="UNASSIGNED" || status="OPEN_BOARD" || status="REJECTED"',
          requestKey: null,
        });
        for (const j of jobs) {
          const pnr = String(j.pnr || "")
            .trim()
            .toUpperCase();
          if (pnr) openPnrs.add(pnr);
        }
      } catch {
        /* guide_jobs optional */
      }
      setOpenGuideJobPnrs(openPnrs);
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setLoading(false);
    }
  }, [getClient]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onRefresh = () => void reload();
    window.addEventListener(STAFF_PORTAL_REFRESH_EVENT, onRefresh);
    return () =>
      window.removeEventListener(STAFF_PORTAL_REFRESH_EVENT, onRefresh);
  }, [reload]);

  const undatedCount = useMemo(() => {
    return hubs.filter((h) => {
      if (String(h.status || "").toLowerCase() === "cancelled") return false;
      return !String(h.tour_date || "").trim();
    }).length;
  }, [hubs]);

  const allEvents = useMemo(
    () =>
      buildOpsCalendarEvents(hubs, {
        dispatchByPnr,
        guestsByPnr,
        openGuideJobPnrs,
      }),
    [hubs, dispatchByPnr, guestsByPnr, openGuideJobPnrs]
  );

  const filtered = useMemo(
    () => filterCalendarEvents(allEvents, filters),
    [allEvents, filters]
  );

  const counts = useMemo(() => countByFilterLane(allEvents), [allEvents]);

  const title = useMemo(() => {
    if (view === "year") return String(anchor.getFullYear());
    if (view === "month") return formatMonthTitle(anchor);
    if (view === "week") return formatWeekTitle(anchor);
    return formatDayTitle(anchor);
  }, [view, anchor]);

  const goPrev = () => {
    if (view === "year") setAnchor(addMonths(anchor, -12));
    else if (view === "month") setAnchor(addMonths(anchor, -1));
    else if (view === "week") setAnchor(addDays(anchor, -7));
    else setAnchor(addDays(anchor, -1));
  };

  const goNext = () => {
    if (view === "year") setAnchor(addMonths(anchor, 12));
    else if (view === "month") setAnchor(addMonths(anchor, 1));
    else if (view === "week") setAnchor(addDays(anchor, 7));
    else setAnchor(addDays(anchor, 1));
  };

  const goToday = () => setAnchor(new Date());

  if (loading) {
    return (
      <p className="flex items-center justify-center gap-2 py-20 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading calendar…
      </p>
    );
  }

  if (error) {
    return <p className="py-10 text-sm text-red-400">{error}</p>;
  }

  return (
    <div className="flex min-h-[calc(100vh-5.5rem)] flex-col gap-3 pb-6">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-[#0D1117]/70 px-3 py-2.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goPrev}
            className="rounded-lg border border-white/10 p-1.5 text-zinc-300 hover:bg-white/5"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-lg border border-white/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-zinc-300 uppercase hover:bg-white/5"
          >
            Today
          </button>
          <button
            type="button"
            onClick={goNext}
            className="rounded-lg border border-white/10 p-1.5 text-zinc-300 hover:bg-white/5"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <h2 className="flex min-w-0 flex-1 items-center gap-2 font-display text-lg text-white sm:text-xl">
          <CalendarDays className="h-5 w-5 shrink-0 text-[#F6A724]" />
          <span className="truncate">{title}</span>
        </h2>

        <div className="flex rounded-xl border border-white/10 bg-[#0A1017] p-0.5">
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setView(opt.id)}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase transition ${
                view === opt.id
                  ? "bg-[#075473] text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <FilterSidebar
          filters={filters}
          setFilters={setFilters}
          counts={counts}
          undatedCount={undatedCount}
        />

        <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-[#0D1117]/50 p-2 sm:p-3">
          {view === "year" ? (
            <YearView
              year={anchor.getFullYear()}
              events={filtered}
              onSelectDay={(d) => {
                setAnchor(d);
                setView("day");
              }}
              onSelectEvent={setSelected}
            />
          ) : null}
          {view === "month" ? (
            <MonthView
              anchor={anchor}
              events={filtered}
              onSelectDay={(d) => {
                setAnchor(d);
                setView("day");
              }}
              onSelectEvent={setSelected}
            />
          ) : null}
          {view === "week" ? (
            <WeekView
              anchor={anchor}
              events={filtered}
              onSelectDay={(d) => {
                setAnchor(d);
                setView("day");
              }}
              onSelectEvent={setSelected}
            />
          ) : null}
          {view === "day" ? (
            <DayView
              anchor={anchor}
              events={filtered}
              onSelectEvent={setSelected}
            />
          ) : null}
        </div>
      </div>

      <SummaryCardModal event={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function YearView({
  year,
  events,
  onSelectDay,
  onSelectEvent,
}: {
  year: number;
  events: OpsCalendarEvent[];
  onSelectDay: (d: Date) => void;
  onSelectEvent: (e: OpsCalendarEvent) => void;
}) {
  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1, 12));
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {months.map((m) => {
        const start = toYmd(startOfMonth(m));
        const end = toYmd(endOfMonth(m));
        const monthEvents = eventsOverlappingRange(events, start, end);
        const cells = monthGridDates(m);
        return (
          <div
            key={start}
            className="rounded-xl border border-white/10 bg-[#0A1017]/80 p-2"
          >
            <button
              type="button"
              onClick={() => onSelectDay(m)}
              className="mb-1 w-full text-left text-xs font-semibold text-white hover:text-[#F6A724]"
            >
              {monthShort(m)} {year}
              <span className="ml-2 font-mono text-[10px] text-zinc-500">
                {monthEvents.length}
              </span>
            </button>
            <div className="grid grid-cols-7 gap-px text-center text-[9px] text-zinc-600">
              {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="mt-0.5 grid grid-cols-7 gap-px">
              {cells.map((cell) => {
                const ymd = toYmd(cell);
                const inMonth = cell.getMonth() === m.getMonth();
                const dayEvents = inMonth ? eventsForDay(monthEvents, ymd) : [];
                const top = dayEvents[0];
                return (
                  <button
                    key={ymd}
                    type="button"
                    disabled={!inMonth}
                    onClick={() => {
                      if (top) onSelectEvent(top);
                      else onSelectDay(cell);
                    }}
                    className={`relative flex h-7 flex-col items-center justify-start rounded pt-0.5 text-[9px] ${
                      inMonth
                        ? "text-zinc-300 hover:bg-white/5"
                        : "text-zinc-700"
                    } ${sameYmd(cell, new Date()) ? "ring-1 ring-[#F6A724]/50" : ""}`}
                  >
                    {cell.getDate()}
                    {top ? (
                      <span
                        className={`mt-0.5 h-1 w-1 rounded-full ${OPS_CALENDAR_COLOR[top.colorKey].dot}`}
                      />
                    ) : null}
                    {dayEvents.length > 1 ? (
                      <span className="absolute right-0.5 top-0 text-[7px] text-zinc-500">
                        {dayEvents.length}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthView({
  anchor,
  events,
  onSelectDay,
  onSelectEvent,
}: {
  anchor: Date;
  events: OpsCalendarEvent[];
  onSelectDay: (d: Date) => void;
  onSelectEvent: (e: OpsCalendarEvent) => void;
}) {
  const cells = monthGridDates(anchor);
  const month = anchor.getMonth();
  const today = new Date();

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
        {WEEKDAY_HEADERS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const ymd = toYmd(cell);
          const inMonth = cell.getMonth() === month;
          const dayEvents = eventsForDay(events, ymd);
          const isToday = sameYmd(cell, today);
          return (
            <div
              key={ymd}
              className={`min-h-[5.5rem] overflow-visible rounded-lg border p-1 sm:min-h-[6.5rem] ${
                inMonth
                  ? "border-white/10 bg-[#0A1017]/70"
                  : "border-transparent bg-transparent opacity-40"
              } ${isToday ? "ring-1 ring-[#F6A724]/45" : ""}`}
            >
              <button
                type="button"
                onClick={() => onSelectDay(cell)}
                className={`mb-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                  isToday
                    ? "bg-[#F6A724] font-bold text-black"
                    : "text-zinc-400 hover:bg-white/5"
                }`}
              >
                {cell.getDate()}
              </button>
              <div className="space-y-0.5 overflow-visible">
                {dayEvents.slice(0, 3).map((ev) => (
                  <EventChip
                    key={`${ev.id}-${ymd}`}
                    event={ev}
                    ymd={ymd}
                    compact
                    onClick={() => onSelectEvent(ev)}
                  />
                ))}
                {dayEvents.length > 3 ? (
                  <button
                    type="button"
                    onClick={() => onSelectDay(cell)}
                    className="w-full text-left text-[9px] text-zinc-500 hover:text-zinc-300"
                  >
                    +{dayEvents.length - 3} more
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function WeekView({
  anchor,
  events,
  onSelectDay,
  onSelectEvent,
}: {
  anchor: Date;
  events: OpsCalendarEvent[];
  onSelectDay: (d: Date) => void;
  onSelectEvent: (e: OpsCalendarEvent) => void;
}) {
  const days = weekDates(anchor);
  const today = new Date();
  return (
    <div className="grid gap-2 md:grid-cols-7">
      {days.map((day) => {
        const ymd = toYmd(day);
        const dayEvents = eventsForDay(events, ymd);
        const isToday = sameYmd(day, today);
        return (
          <div
            key={ymd}
            className={`min-h-[12rem] rounded-xl border border-white/10 bg-[#0A1017]/70 p-2 ${
              isToday ? "ring-1 ring-[#F6A724]/45" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectDay(day)}
              className="mb-2 flex w-full items-center justify-between text-left"
            >
              <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                {weekdayShort(day)}
              </span>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  isToday
                    ? "bg-[#F6A724] font-bold text-black"
                    : "text-zinc-300"
                }`}
              >
                {day.getDate()}
              </span>
            </button>
            <div className="space-y-1 overflow-visible">
              {dayEvents.length === 0 ? (
                <p className="text-[10px] text-zinc-600">—</p>
              ) : (
                dayEvents.map((ev) => (
                  <EventChip
                    key={`${ev.id}-${ymd}`}
                    event={ev}
                    ymd={ymd}
                    onClick={() => onSelectEvent(ev)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayView({
  anchor,
  events,
  onSelectEvent,
}: {
  anchor: Date;
  events: OpsCalendarEvent[];
  onSelectEvent: (e: OpsCalendarEvent) => void;
}) {
  const ymd = toYmd(anchor);
  const dayEvents = eventsForDay(events, ymd);
  const weekStart = toYmd(startOfWeekSunday(anchor));
  const weekEnd = toYmd(endOfWeekSaturday(anchor));
  const weekCount = eventsOverlappingRange(events, weekStart, weekEnd).length;

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        {dayEvents.length} service day{dayEvents.length === 1 ? "" : "s"} today ·{" "}
        {weekCount} booking{weekCount === 1 ? "" : "s"} this week
      </p>
      {dayEvents.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-12 text-center text-sm text-zinc-500">
          No TokioTours services on this day (rest / empty stay days stay blank).
        </p>
      ) : (
        <ul className="space-y-2">
          {dayEvents.map((ev) => {
            const tone = OPS_CALENDAR_COLOR[ev.colorKey];
            const meta = serviceDayMetaFor(ev, ymd);
            const dayHint =
              meta?.dayKind === "ticket_only"
                ? "Tickets"
                : meta?.continuity === "start"
                  ? "Service bridge · start"
                  : meta?.continuity === "mid"
                    ? "Service bridge · mid"
                    : meta?.continuity === "end"
                      ? "Service bridge · end"
                      : meta?.continuity === "single"
                        ? "Service day"
                        : "Service day";
            const titles = (meta?.titles || []).slice(0, 3).join(" · ");
            return (
              <li key={ev.id}>
                <button
                  type="button"
                  onClick={() => onSelectEvent(ev)}
                  className="flex w-full items-stretch gap-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0A1017]/80 text-left transition hover:border-white/20"
                >
                  <span className={`w-1.5 shrink-0 ${tone.bar}`} />
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-semibold text-white">
                        {ev.pnr}
                      </p>
                      <p className="truncate text-xs text-zinc-400">
                        {ev.guestName} · {ev.primaryCity}
                        {ev.guestSummary ? ` · ${ev.guestSummary}` : ""}
                      </p>
                      <p className="mt-0.5 text-[10px] text-zinc-500">
                        {dayHint}
                        {titles ? ` · ${titles}` : ""}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${tone.chip}`}
                    >
                      {ev.status.shortLabel}
                    </span>
                    <div className="text-[10px] text-zinc-500">
                      Guide: {ev.assignedGuide}
                      <br />
                      Driver: {ev.assignedDriver}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
