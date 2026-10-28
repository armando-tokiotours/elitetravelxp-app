"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Car,
  FileSpreadsheet,
  Loader2,
  MessageSquareHeart,
  Ticket,
  TrendingUp,
  UserCircle,
  Wallet,
} from "lucide-react";
import { BoxGradingGlow } from "@/components/branding/BoxGradingGlow";
import { loadOpsHub, type OpsHubRow } from "@/components/staff/opsHubClient";
import {
  StaffPortalShell,
  STAFF_PORTAL_REFRESH_EVENT,
} from "@/components/staff/StaffPortalShell";
import {
  buildCeoDashboardMetrics,
  type CeoDashboardMetrics,
  type CeoIncomingTrip,
} from "@/lib/ceoDashboardMetrics";
import type { GuideJobRow } from "@/lib/guideJobs";
import type { OpsDispatchRow } from "@/lib/opsDispatch";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import { canAccessOpsBoard } from "@/lib/staffRoles";
import { useTeamAuth } from "@/store/useTeamAuth";

type ForexPair = {
  pair: string;
  rate: number;
  changePct: number | null;
  base: string;
  quote: string;
};

type ForexPayload = {
  ok: boolean;
  pairs: ForexPair[];
  source?: string;
  asOf?: string;
  fetchedAt?: string;
  approximate?: boolean;
  error?: string;
};

function formatEur(n: number): string {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

function formatFxRate(pair: string, rate: number): string {
  if (pair.includes("JPY")) {
    return rate.toLocaleString("en-US", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
  }
  return rate.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

function paymentTone(kind: CeoIncomingTrip["paymentBadgeKind"]): string {
  switch (kind) {
    case "fully_paid":
      return "border-emerald-500/40 bg-emerald-500/15 text-emerald-200";
    case "progress30":
      return "border-amber-500/40 bg-amber-500/15 text-amber-200";
    case "fee":
      return "border-sky-500/40 bg-sky-500/15 text-sky-200";
    default:
      return "border-zinc-600/50 bg-zinc-800/60 text-zinc-300";
  }
}

function WidgetShell({
  title,
  icon,
  children,
  className = "",
  large,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
  large?: boolean;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-[#0D1117]/70 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur-md sm:p-5 ${
        large ? "sm:col-span-2 lg:col-span-2 lg:row-span-2" : ""
      } ${className}`}
    >
      <BoxGradingGlow />
      <div className="relative z-10">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#7ec8e3]">
            {icon}
          </span>
          <h2 className="text-[11px] font-bold tracking-[0.22em] text-[#F6A724] uppercase">
            {title}
          </h2>
        </div>
        {children}
      </div>
    </section>
  );
}

export function CeoDashboardApp() {
  return (
    <StaffPortalShell
      title="Executive Command"
      allow={canAccessOpsBoard}
      wide
    >
      <CeoDashboardInner />
    </StaffPortalShell>
  );
}

function CeoDashboardInner() {
  const getClient = useTeamAuth((s) => s.getClient);
  const token = useTeamAuth((s) => s.token);
  const [metrics, setMetrics] = useState<CeoDashboardMetrics | null>(null);
  const [forex, setForex] = useState<ForexPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pb = getClient();

      const forexPromise = fetch("/api/ops/forex")
        .then(async (res) => {
          const json = (await res.json()) as ForexPayload;
          return json;
        })
        .catch(
          (): ForexPayload => ({
            ok: false,
            pairs: [],
            error: "FX feed unavailable",
          })
        );

      const [hubs, fx] = await Promise.all([
        loadOpsHub(pb),
        forexPromise,
      ]);
      setForex(fx);

      const dispatchByPnr: Record<string, OpsDispatchRow> = {};
      try {
        const list = await pb
          .collection("ops_dispatch")
          .getFullList<OpsDispatchRow>({ requestKey: null });
        for (const d of list) {
          const pnr = String(d.pnr || "")
            .trim()
            .toUpperCase();
          if (pnr) dispatchByPnr[pnr] = d;
        }
      } catch {
        /* optional */
      }

      let guideJobs: GuideJobRow[] = [];
      try {
        guideJobs = await pb.collection("guide_jobs").getFullList<GuideJobRow>({
          filter:
            'status="UNASSIGNED" || status="OPEN_BOARD" || status="REJECTED"',
          requestKey: null,
        });
      } catch {
        guideJobs = [];
      }

      const guestsByPnr: Record<
        string,
        { name?: string; email?: string; durationDays?: number | null }
      > = {};
      try {
        const bals = await pb.collection("bookings_and_leads").getFullList<{
          booking_ref?: string;
          email?: string;
          full_name?: string;
          name?: string;
          guest_name?: string;
          duration_value?: number;
          duration_label?: string;
          type?: string;
        }>({ requestKey: null });
        for (const bal of bals) {
          const ref = String(bal.booking_ref || "")
            .trim()
            .toUpperCase();
          if (!ref) continue;
          guestsByPnr[ref] = {
            email: String(bal.email || "")
              .trim()
              .toLowerCase(),
            name: String(
              bal.full_name || bal.guest_name || bal.name || ""
            ).trim(),
            durationDays: Number(bal.duration_value) || null,
          };
        }
      } catch {
        /* agency-only */
      }

      const eurJpy =
        fx.pairs.find((p) => p.pair === "EUR/JPY")?.rate ?? null;

      setMetrics(
        buildCeoDashboardMetrics({
          hubs: hubs as OpsHubRow[],
          dispatchByPnr,
          guideJobs,
          guestsByPnr,
          eurJpy,
        })
      );
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

  const downloadMasterKnowledge = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/ops/export-master-knowledge", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `tokiotours_master_knowledge_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      /* swallow — button stays available */
    } finally {
      setExporting(false);
    }
  };

  if (loading && !metrics) {
    return (
      <p className="flex items-center gap-2 py-16 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading executive dashboard…
      </p>
    );
  }

  if (error && !metrics) {
    return <p className="py-16 text-sm text-red-400">{error}</p>;
  }

  const fin = metrics?.financial;
  const dispatch = metrics?.dispatch;
  const incoming = metrics?.incoming7d || [];

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.28em] text-[#075473] uppercase">
            Super User · Live ops
          </p>
          <p className="mt-1 max-w-xl text-sm text-zinc-400">
            Aggregated from{" "}
            <code className="text-zinc-300">ops_hub</code>,{" "}
            <code className="text-zinc-300">bookings_and_leads</code>, guide
            jobs, driver dispatch, and ticket procurement status.
          </p>
        </div>
        {metrics?.generatedAt ? (
          <p className="text-[10px] text-zinc-500">
            Snapshot {new Date(metrics.generatedAt).toLocaleString()}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Financial — large */}
        <WidgetShell
          large
          title="Financial Overview"
          icon={<TrendingUp className="h-4 w-4" strokeWidth={2} />}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MetricTile
              label="Total Gross Revenue"
              value={formatEur(fin?.totalGrossRevenueEur || 0)}
              hint={`${fin?.confirmedBookingCount || 0} confirmed / locked`}
            />
            <MetricTile
              label="Outstanding Balances"
              value={formatEur(fin?.outstandingBalancesEur || 0)}
              hint="Package − paid (all active hubs)"
            />
            <MetricTile
              label="Pipeline Value"
              value={formatEur(fin?.pipelineValueEur || 0)}
              hint={`${fin?.pipelineBookingCount || 0} draft / design quotes`}
            />
            <MetricTile
              label="Net Profit Margin"
              value={
                fin?.netProfitMarginPct != null
                  ? `${fin.netProfitMarginPct.toFixed(1)}%`
                  : "N/A"
              }
              hint={fin?.costBasisNote || "Requires cost JPY + EUR/JPY"}
            />
          </div>
        </WidgetShell>

        {/* Forex */}
        <WidgetShell
          title="Forex Ticker"
          icon={<Wallet className="h-4 w-4" strokeWidth={2} />}
        >
          {forex?.ok && forex.pairs.length > 0 ? (
            <ul className="space-y-2.5">
              {forex.pairs.map((p) => (
                <li
                  key={p.pair}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-white/5 bg-black/20 px-3 py-2"
                >
                  <div>
                    <p className="font-mono text-sm font-semibold text-white">
                      {p.pair}
                    </p>
                    <p className="font-mono text-lg text-[#7ec8e3]">
                      {formatFxRate(p.pair, p.rate)}
                    </p>
                  </div>
                  <ChangePill pct={p.changePct} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">
              {forex?.error || "Live FX unavailable"}
            </p>
          )}
          <p className="mt-3 text-[10px] leading-relaxed text-zinc-500">
            {forex?.source
              ? `Source: ${forex.source}`
              : "Public FX feed"}
            {forex?.asOf ? ` · as of ${forex.asOf}` : ""}
            {forex?.approximate ? " · approximate" : ""}
            . No API keys.
          </p>
        </WidgetShell>

        {/* Dispatch alerts */}
        <WidgetShell
          title="Dispatch Alerts · 14d"
          icon={<AlertTriangle className="h-4 w-4" strokeWidth={2} />}
        >
          <ul className="space-y-2">
            <AlertRow
              icon={<UserCircle className="h-3.5 w-3.5" />}
              label="Unassigned guides"
              count={dispatch?.unassignedGuides || 0}
              href="/ops/guides-master"
            />
            <AlertRow
              icon={<Car className="h-3.5 w-3.5" />}
              label="Unassigned drivers"
              count={dispatch?.unassignedDrivers || 0}
              href="/ops/drivers-master"
            />
            <AlertRow
              icon={<Ticket className="h-3.5 w-3.5" />}
              label="Pending ticket procurements"
              count={dispatch?.pendingTicketProcurements || 0}
              href="/ops/tickets-master"
            />
          </ul>
        </WidgetShell>

        {/* Quick actions */}
        <WidgetShell
          title="Quick Actions"
          icon={<FileSpreadsheet className="h-4 w-4" strokeWidth={2} />}
          className="lg:col-span-2"
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <QuickLink
              href="/ops/ingestion"
              label="AI Ingest"
              icon={<FileSpreadsheet className="h-4 w-4" />}
            />
            <QuickLink
              href="/ops/concierge"
              label="Concierge"
              icon={<MessageSquareHeart className="h-4 w-4" />}
            />
            <QuickLink
              href="/ops/money"
              label="Money desk"
              icon={<Wallet className="h-4 w-4" />}
            />
            <QuickLink
              href="/ops/calendar"
              label="Calendar"
              icon={<CalendarDays className="h-4 w-4" />}
            />
            <QuickLink
              href="/ops/tickets-master"
              label="Tickets desk"
              icon={<Ticket className="h-4 w-4" />}
            />
            <button
              type="button"
              onClick={() => void downloadMasterKnowledge()}
              disabled={exporting}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-center text-xs font-medium text-zinc-200 transition hover:border-[#F6A724]/40 hover:bg-white/10 disabled:opacity-50"
            >
              <BookOpen className="h-4 w-4 text-[#F6A724]" />
              {exporting ? "Exporting…" : "Master knowledge"}
            </button>
          </div>
        </WidgetShell>

        {/* 7-day digest */}
        <WidgetShell
          title="7-Day Incoming Trips"
          icon={<CalendarDays className="h-4 w-4" strokeWidth={2} />}
          className="sm:col-span-2 lg:col-span-2"
        >
          {incoming.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">
              No tours starting in the next 7 days.
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {incoming.map((trip) => (
                <li
                  key={trip.pnr}
                  className="flex flex-wrap items-center gap-2 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={trip.opsHref}
                        className="font-mono text-sm font-semibold text-white hover:text-[#7ec8e3]"
                      >
                        {trip.pnr}
                      </Link>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${paymentTone(trip.paymentBadgeKind)}`}
                      >
                        {trip.paymentBadgeLabel}
                      </span>
                    </div>
                    <p className="truncate text-xs text-zinc-400">
                      {trip.guestName}
                      {trip.paxLabel && trip.paxLabel !== "—"
                        ? ` · ${trip.paxLabel}`
                        : ""}
                      {` · ${trip.primaryCity}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <time className="font-mono text-xs text-zinc-300">
                      {trip.tourDate}
                    </time>
                    <Link
                      href={trip.calendarHref}
                      className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-[#7ec8e3] hover:bg-white/5"
                    >
                      Calendar
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </WidgetShell>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-black/25 px-3 py-3">
      <p className="text-[10px] tracking-wider text-zinc-500 uppercase">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl text-white">{value}</p>
      {hint ? <p className="mt-1 text-[10px] text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function ChangePill({ pct }: { pct: number | null }) {
  if (pct == null) {
    return (
      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-zinc-500">
        —
      </span>
    );
  }
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        up
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-red-500/30 bg-red-500/10 text-red-300"
      }`}
    >
      {up ? (
        <ArrowUpRight className="h-3 w-3" />
      ) : (
        <ArrowDownRight className="h-3 w-3" />
      )}
      {up ? "+" : ""}
      {pct.toFixed(2)}%
    </span>
  );
}

function AlertRow({
  icon,
  label,
  count,
  href,
}: {
  icon: ReactNode;
  label: string;
  count: number;
  href: string;
}) {
  const hot = count > 0;
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 transition hover:bg-white/5 ${
        hot
          ? "border-red-500/35 bg-red-500/10"
          : "border-white/5 bg-black/20"
      }`}
    >
      <span className={hot ? "text-red-300" : "text-zinc-500"}>{icon}</span>
      <span className="min-w-0 flex-1 text-xs text-zinc-300">{label}</span>
      <span
        className={`font-mono text-sm font-bold ${hot ? "text-red-200" : "text-zinc-500"}`}
      >
        {count}
      </span>
    </Link>
  );
}

function QuickLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-center text-xs font-medium text-zinc-200 transition hover:border-[#F6A724]/40 hover:bg-white/10"
    >
      <span className="text-[#F6A724]">{icon}</span>
      {label}
    </Link>
  );
}
