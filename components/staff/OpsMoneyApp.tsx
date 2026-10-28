"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  Archive,
  ArrowUpRight,
  Banknote,
  Car,
  CheckCircle2,
  Gift,
  Loader2,
  Mail,
  Ticket,
  TrendingDown,
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
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import { loadAllMoney, type OpsMoneyRow } from "@/lib/opsMoney";
import {
  loadAllPayouts,
  upsertPayout,
  type OpsPayoutRow,
  type PayoutStatus,
} from "@/lib/opsPayouts";
import type { OpsDispatchRow } from "@/lib/opsDispatch";
import {
  buildPnlLedgerSnapshot,
  countByPnlFilter,
  filterPnrCards,
  hasPendingContractorPayouts,
  persistPnlPayoutStatus,
  persistPnrCostAmounts,
  type CostLine,
  type GuestMilestone,
  type PnlGuestLookup,
  type PnlKpis,
  type PnlListFilter,
  type PnlPayoutKey,
  type PnrLedgerCard,
  type PayoutToggleStatus,
} from "@/lib/pnlLedger";
import {
  generateAgencyMonthlyInvoice,
  generateGuideMonthlySettlement,
  markSettlementPaid,
  type AgencyMonthlyInvoice,
  type GuideMonthlySettlement,
} from "@/lib/pricing/settlements";
import { canAccessMoney } from "@/lib/staffRoles";
import type PocketBase from "pocketbase";
import { useTeamAuth } from "@/store/useTeamAuth";

type ForexPayload = {
  ok: boolean;
  pairs: { pair: string; rate: number }[];
  error?: string;
};

const FILTER_TABS: {
  id: PnlListFilter;
  label: string;
}[] = [
  { id: "all", label: "All PNRs" },
  { id: "active_pending", label: "Active / Pending Payouts" },
  { id: "outflows_paid", label: "Outflows Paid" },
  { id: "settled_archived", label: "Settled & Archived" },
];

function formatEur(n: number): string {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

function formatJpy(n: number): string {
  return `¥${Math.round(n).toLocaleString()}`;
}

function payStatusTone(status: string): string {
  switch (status) {
    case "FULLY_PAID":
      return "border-emerald-500/40 bg-emerald-500/15 text-emerald-200";
    case "PARTIALLY_PAID":
      return "border-amber-500/40 bg-amber-500/15 text-amber-200";
    case "FEE_PAID":
      return "border-sky-500/40 bg-sky-500/15 text-sky-200";
    default:
      return "border-zinc-600/50 bg-zinc-800/60 text-zinc-300";
  }
}

export function OpsMoneyApp() {
  return (
    <StaffPortalShell
      title="P&L Financial Ledger"
      allow={canAccessMoney}
      wide
    >
      <MoneyInner />
    </StaffPortalShell>
  );
}

function MoneyInner() {
  const getClient = useTeamAuth((s) => s.getClient);
  const [hubs, setHubs] = useState<OpsHubRow[]>([]);
  const [moneyRows, setMoneyRows] = useState<OpsMoneyRow[]>([]);
  const [payouts, setPayouts] = useState<OpsPayoutRow[]>([]);
  const [guestsByPnr, setGuestsByPnr] = useState<
    Record<string, PnlGuestLookup>
  >({});
  const [eurJpy, setEurJpy] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [listFilter, setListFilter] =
    useState<PnlListFilter>("active_pending");
  const [selectedPnr, setSelectedPnr] = useState<string | null>(null);
  const [showTools, setShowTools] = useState(false);

  const [settlements, setSettlements] = useState<GuideMonthlySettlement[]>([]);
  const [invoices, setInvoices] = useState<AgencyMonthlyInvoice[]>([]);
  const [period, setPeriod] = useState(() =>
    new Date().toISOString().slice(0, 7)
  );
  const [guideIdForSettle, setGuideIdForSettle] = useState("");
  const [agencyIdForInvoice, setAgencyIdForInvoice] = useState("");
  const [guidesList, setGuidesList] = useState<
    { id: string; full_name?: string }[]
  >([]);
  const [agenciesList, setAgenciesList] = useState<
    { id: string; name?: string }[]
  >([]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pb = getClient();

      const forexPromise = fetch("/api/ops/forex")
        .then(async (res) => (await res.json()) as ForexPayload)
        .catch(
          (): ForexPayload => ({
            ok: false,
            pairs: [],
            error: "FX unavailable",
          })
        );

      const [hubList, moneyList, fx] = await Promise.all([
        loadOpsHub(pb),
        loadAllMoney(pb).catch(() => [] as OpsMoneyRow[]),
        forexPromise,
      ]);

      setHubs(hubList);
      setMoneyRows(moneyList);
      setEurJpy(fx.pairs.find((p) => p.pair === "EUR/JPY")?.rate ?? null);

      try {
        setPayouts(await loadAllPayouts(pb));
      } catch {
        setPayouts([]);
      }

      const guests: Record<string, PnlGuestLookup> = {};
      try {
        const bals = await pb.collection("bookings_and_leads").getFullList<{
          booking_ref?: string;
          email?: string;
          full_name?: string;
          name?: string;
          guest_name?: string;
        }>({ requestKey: null });
        for (const bal of bals) {
          const ref = String(bal.booking_ref || "")
            .trim()
            .toUpperCase();
          if (!ref) continue;
          guests[ref] = {
            name: String(
              bal.full_name || bal.guest_name || bal.name || ""
            ).trim(),
            email: String(bal.email || "")
              .trim()
              .toLowerCase(),
          };
        }
      } catch {
        /* optional */
      }
      setGuestsByPnr(guests);

      try {
        setSettlements(
          await pb.collection("guide_monthly_settlements").getFullList({
            sort: "-billing_period",
            requestKey: null,
          })
        );
      } catch {
        setSettlements([]);
      }
      try {
        setInvoices(
          await pb.collection("agency_monthly_invoices").getFullList({
            sort: "-billing_period",
            requestKey: null,
          })
        );
      } catch {
        setInvoices([]);
      }
      try {
        setGuidesList(
          await pb.collection("guides").getFullList({
            sort: "full_name",
            requestKey: null,
          })
        );
      } catch {
        setGuidesList([]);
      }
      try {
        setAgenciesList(
          await pb.collection("agencies").getFullList({
            sort: "name",
            requestKey: null,
          })
        );
      } catch {
        setAgenciesList([]);
      }
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

  const moneyByPnr = useMemo(() => {
    const m: Record<string, OpsMoneyRow> = {};
    for (const row of moneyRows) {
      const pnr = String(row.pnr || "")
        .trim()
        .toUpperCase();
      if (pnr) m[pnr] = row;
    }
    return m;
  }, [moneyRows]);

  const snapshot = useMemo(
    () =>
      buildPnlLedgerSnapshot({
        hubs,
        moneyByPnr,
        guestsByPnr,
        eurJpy,
      }),
    [hubs, moneyByPnr, guestsByPnr, eurJpy]
  );

  const filterCounts = useMemo(
    () => countByPnlFilter(snapshot.cards),
    [snapshot.cards]
  );

  const filteredCards = useMemo(() => {
    const byTab = filterPnrCards(snapshot.cards, listFilter);
    const q = query.trim().toUpperCase();
    if (!q) return byTab;
    return byTab.filter(
      (c) =>
        c.pnr.includes(q) ||
        c.guestName.toUpperCase().includes(q) ||
        c.guestEmail.toUpperCase().includes(q) ||
        c.assignedGuide.toUpperCase().includes(q) ||
        c.assignedDriver.toUpperCase().includes(q)
    );
  }, [snapshot.cards, listFilter, query]);

  // Keep selection in the filtered set
  useEffect(() => {
    if (filteredCards.length === 0) {
      setSelectedPnr(null);
      return;
    }
    if (
      !selectedPnr ||
      !filteredCards.some((c) => c.pnr === selectedPnr)
    ) {
      setSelectedPnr(filteredCards[0].pnr);
    }
  }, [filteredCards, selectedPnr]);

  const selectedCard =
    filteredCards.find((c) => c.pnr === selectedPnr) || null;

  const syncPayoutsFromCosts = async (
    pnr: string,
    guidePay: number,
    driverPay: number
  ) => {
    const pb = getClient();
    try {
      const d = await pb
        .collection("ops_dispatch")
        .getFirstListItem<OpsDispatchRow>(`pnr="${pnr}"`, {
          requestKey: null,
        });
      if (d.assigned_guide_id) {
        await upsertPayout(pb, {
          pnr,
          staffId: d.assigned_guide_id,
          staffName: d.assigned_guide || "",
          role: "guide",
          amountJpy: guidePay,
        });
      }
      if (d.assigned_driver_id) {
        await upsertPayout(pb, {
          pnr,
          staffId: d.assigned_driver_id,
          staffName: d.assigned_driver || "",
          role: "driver",
          amountJpy: driverPay,
        });
      }
    } catch {
      /* no dispatch yet */
    }
  };

  const onTogglePayout = async (
    card: PnrLedgerCard,
    key: PnlPayoutKey,
    status: PayoutToggleStatus
  ) => {
    const hub = hubs.find((h) => h.id === card.hubId);
    if (!hub) return;
    setSavingKey(`${card.pnr}-${key}`);
    setMsg(null);
    try {
      const pb = getClient();
      const updated = await persistPnlPayoutStatus(pb, hub, key, status);
      setHubs((prev) =>
        prev.map((h) => (h.id === updated.id ? { ...h, ...updated } : h))
      );

      if (key === "guide" || key === "driver") {
        const staffId =
          key === "guide" ? hub.assigned_guide_id : hub.assigned_driver_id;
        if (staffId) {
          await upsertPayout(pb, {
            pnr: card.pnr,
            staffId,
            staffName:
              key === "guide"
                ? hub.assigned_guide || ""
                : hub.assigned_driver || "",
            role: key,
            status: status === "PAID" ? "paid" : "pending",
          });
        }
      }
      setMsg(
        `${card.pnr} · ${key} → ${status === "PAID" ? "Paid" : "Pending monthly"}`
      );
    } catch (e) {
      setMsg(formatPbError(e));
    } finally {
      setSavingKey(null);
    }
  };

  const onSaveCosts = async (
    card: PnrLedgerCard,
    patch: {
      guidePayJpy: number;
      driverPayJpy: number;
      ticketCostJpy: number;
    }
  ) => {
    const hub = hubs.find((h) => h.id === card.hubId);
    if (!hub) return;
    setSavingKey(`${card.pnr}-costs`);
    setMsg(null);
    try {
      const pb = getClient();
      await persistPnrCostAmounts(pb, { hub, ...patch });
      await syncPayoutsFromCosts(
        card.pnr,
        patch.guidePayJpy,
        patch.driverPayJpy
      );
      setMsg(`Costs saved · ${card.pnr}`);
      await reload();
    } catch (e) {
      setMsg(formatPbError(e));
    } finally {
      setSavingKey(null);
    }
  };

  if (loading && hubs.length === 0) {
    return (
      <p className="flex items-center gap-2 py-16 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading P&L ledger…
      </p>
    );
  }

  if (error && hubs.length === 0) {
    return <p className="py-16 text-sm text-red-400">{error}</p>;
  }

  const kpis = snapshot.kpis;

  return (
    <div className="space-y-4 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.28em] text-[#075473] uppercase">
            Super User · Money & payouts
          </p>
          <p className="mt-1 max-w-xl text-sm text-zinc-400">
            Inflows from{" "}
            <code className="text-zinc-300">tour_payment_status</code> /{" "}
            <code className="text-zinc-300">total_paid_eur</code> · outflows
            via hub JPY + bonus gifts · toggles on{" "}
            <code className="text-zinc-300">extras.pnl_payouts</code>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {eurJpy ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] text-[#7ec8e3]">
              EUR/JPY {eurJpy.toFixed(2)}
            </span>
          ) : (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-200">
              FX unavailable
            </span>
          )}
          <input
            type="search"
            placeholder="Search PNR / guest…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-44 rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600"
          />
        </div>
      </header>

      {msg ? <p className="text-sm text-[#7ec8e3]">{msg}</p> : null}

      <CompactKpiBar kpis={kpis} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="shrink-0 text-[11px] font-bold tracking-[0.2em] text-[#F6A724] uppercase">
            Per-PNR financial cards
          </h2>
          <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-black/25 p-0.5">
            {FILTER_TABS.map((tab) => {
              const active = listFilter === tab.id;
              const count = filterCounts[tab.id];
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setListFilter(tab.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold tracking-wide uppercase transition ${
                    active
                      ? "bg-[#075473] text-white"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`ml-1.5 tabular-nums ${
                      active ? "text-white/70" : "text-zinc-600"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-[11px] text-zinc-500">
          Showing {filteredCards.length}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-start">
        {/* Master list */}
        <aside className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]/70 lg:col-span-4 xl:col-span-3">
          <BoxGradingGlow />
          <div className="relative z-10 max-h-[min(70vh,720px)] overflow-y-auto">
            {filteredCards.length === 0 ? (
              <p className="px-4 py-10 text-center text-xs text-zinc-500">
                No PNRs in this filter.
              </p>
            ) : (
              <ul className="divide-y divide-white/5">
                {filteredCards.map((card) => {
                  const active = card.pnr === selectedPnr;
                  const pending = hasPendingContractorPayouts(card);
                  return (
                    <li key={card.hubId}>
                      <button
                        type="button"
                        onClick={() => setSelectedPnr(card.pnr)}
                        className={`flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition ${
                          active
                            ? "bg-[#075473]/25"
                            : "hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-semibold text-white">
                            {card.pnr}
                          </span>
                          <span
                            className={`rounded border px-1 py-0.5 text-[9px] font-semibold uppercase ${payStatusTone(card.tourPaymentStatus)}`}
                          >
                            {card.tourPaymentStatus === "FULLY_PAID"
                              ? "Paid"
                              : card.tourPaymentStatus === "PARTIALLY_PAID"
                                ? "30%"
                                : card.tourPaymentStatus === "FEE_PAID"
                                  ? "Fee"
                                  : "—"}
                          </span>
                        </div>
                        <p className="truncate text-[11px] text-zinc-300">
                          {card.guestName}
                        </p>
                        <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-500">
                          <span>{card.tourDate || "No date"}</span>
                          <span
                            className={
                              card.netPnrProfitEur >= 0
                                ? "text-emerald-400/90"
                                : "text-amber-400/90"
                            }
                          >
                            {formatEur(card.netPnrProfitEur)}
                          </span>
                        </div>
                        {(card.pendingReceivableEur > 0 || pending) && (
                          <p className="text-[9px] text-amber-400/80">
                            {card.pendingReceivableEur > 0
                              ? `Due ${formatEur(card.pendingReceivableEur)}`
                              : ""}
                            {card.pendingReceivableEur > 0 && pending
                              ? " · "
                              : ""}
                            {pending ? "Payouts pending" : ""}
                          </p>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Detail statement */}
        <section className="lg:col-span-8 xl:col-span-9">
          {selectedCard ? (
            <PnrDetailStatement
              card={selectedCard}
              savingKey={savingKey}
              onTogglePayout={onTogglePayout}
              onSaveCosts={onSaveCosts}
            />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-[#0D1117]/50 px-6 py-16 text-center text-sm text-zinc-500">
              Select a PNR to view its financial statement.
            </div>
          )}
        </section>
      </div>

      <section className="space-y-3">
        <button
          type="button"
          onClick={() => setShowTools((v) => !v)}
          className="text-xs font-semibold tracking-wide text-zinc-400 uppercase hover:text-zinc-200"
        >
          {showTools ? "Hide" : "Show"} payroll tools & staff payouts
        </button>
        {showTools ? (
          <PayrollTools
            payouts={payouts}
            settlements={settlements}
            invoices={invoices}
            period={period}
            setPeriod={setPeriod}
            guideIdForSettle={guideIdForSettle}
            setGuideIdForSettle={setGuideIdForSettle}
            agencyIdForInvoice={agencyIdForInvoice}
            setAgencyIdForInvoice={setAgencyIdForInvoice}
            guidesList={guidesList}
            agenciesList={agenciesList}
            getClient={getClient}
            setMsg={setMsg}
            reload={reload}
          />
        ) : null}
      </section>
    </div>
  );
}

function CompactKpiBar({ kpis }: { kpis: PnlKpis }) {
  const items: {
    label: string;
    value: string;
    icon: ReactNode;
    accent?: "profit" | "warn";
  }[] = [
    {
      label: "Gross Collected",
      value: formatEur(kpis.grossCollectedEur),
      icon: <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} />,
    },
    {
      label: "Pending Receivables",
      value: formatEur(kpis.pendingReceivablesEur),
      icon: <Wallet className="h-3.5 w-3.5" strokeWidth={2} />,
      accent: "warn",
    },
    {
      label: "Outflows Paid",
      value: formatEur(kpis.contractorOutflowsPaidEur),
      icon: <Banknote className="h-3.5 w-3.5" strokeWidth={2} />,
    },
    {
      label: "Pending Monthly",
      value: formatEur(kpis.pendingMonthlyPayoutsEur),
      icon: <TrendingDown className="h-3.5 w-3.5" strokeWidth={2} />,
      accent: "warn",
    },
    {
      label: "Net Company Profit",
      value: formatEur(kpis.netCompanyProfitEur),
      icon:
        kpis.netCompanyProfitEur >= 0 ? (
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
        ) : (
          <Archive className="h-3.5 w-3.5" strokeWidth={2} />
        ),
      accent: kpis.netCompanyProfitEur >= 0 ? "profit" : "warn",
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]/70 px-2 py-2 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur-md sm:px-3">
      <BoxGradingGlow />
      <div className="relative z-10 flex flex-wrap items-stretch divide-x divide-white/5">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex min-w-[140px] flex-1 items-center gap-2.5 px-3 py-1.5"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[#7ec8e3]">
              {item.icon}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[9px] font-bold tracking-[0.14em] text-[#F6A724] uppercase">
                {item.label}
              </p>
              <p
                className={`font-mono text-sm font-semibold tabular-nums ${
                  item.accent === "profit"
                    ? "text-emerald-300"
                    : item.accent === "warn"
                      ? "text-amber-300"
                      : "text-white"
                }`}
              >
                {item.value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MilestoneRow({ m }: { m: GuestMilestone }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2">
      <div>
        <p className="text-xs font-medium text-zinc-200">{m.label}</p>
        {m.dueLabel ? (
          <p className="text-[10px] text-zinc-500">{m.dueLabel}</p>
        ) : null}
      </div>
      <div className="text-right">
        <p className="font-mono text-xs text-white">{formatEur(m.amountEur)}</p>
        <span
          className={`mt-0.5 inline-block rounded-md border px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase ${
            m.paid
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
              : "border-zinc-600/50 bg-zinc-800/60 text-zinc-400"
          }`}
        >
          {m.paid ? "Paid" : "Pending"}
        </span>
      </div>
    </div>
  );
}

function CostRow({
  cost,
  busy,
  onToggle,
}: {
  cost: CostLine;
  busy: boolean;
  onToggle: (status: PayoutToggleStatus) => void;
}) {
  const icon =
    cost.key === "guide" ? (
      <UserCircle className="h-3.5 w-3.5" />
    ) : cost.key === "driver" ? (
      <Car className="h-3.5 w-3.5" />
    ) : cost.key === "tickets" ? (
      <Ticket className="h-3.5 w-3.5" />
    ) : (
      <Gift className="h-3.5 w-3.5" />
    );

  const hasAmount = cost.amountEur > 0 || cost.amountJpy > 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2">
      <div className="flex min-w-0 items-start gap-2">
        <span className="mt-0.5 text-[#7ec8e3]">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-200">{cost.label}</p>
          {cost.detail ? (
            <p className="truncate text-[10px] text-zinc-500" title={cost.detail}>
              {cost.detail}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <p className="font-mono text-xs text-white">
            {hasAmount ? formatEur(cost.amountEur) : "—"}
          </p>
          {cost.amountJpy > 0 ? (
            <p className="font-mono text-[10px] text-zinc-500">
              {formatJpy(cost.amountJpy)}
            </p>
          ) : null}
        </div>
        <div className="flex rounded-lg border border-white/10 p-0.5">
          <button
            type="button"
            disabled={busy || !hasAmount}
            onClick={() => onToggle("PAID")}
            className={`rounded-md px-2 py-1 text-[10px] font-semibold disabled:opacity-30 ${
              cost.status === "PAID"
                ? "bg-emerald-500/25 text-emerald-200"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Paid
          </button>
          <button
            type="button"
            disabled={busy || !hasAmount}
            onClick={() => onToggle("PENDING_MONTHLY")}
            className={`rounded-md px-2 py-1 text-[10px] font-semibold disabled:opacity-30 ${
              cost.status === "PENDING_MONTHLY"
                ? "bg-amber-500/25 text-amber-200"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Pending
          </button>
        </div>
      </div>
    </div>
  );
}

function PnrDetailStatement({
  card,
  savingKey,
  onTogglePayout,
  onSaveCosts,
}: {
  card: PnrLedgerCard;
  savingKey: string | null;
  onTogglePayout: (
    card: PnrLedgerCard,
    key: PnlPayoutKey,
    status: PayoutToggleStatus
  ) => Promise<void>;
  onSaveCosts: (
    card: PnrLedgerCard,
    patch: {
      guidePayJpy: number;
      driverPayJpy: number;
      ticketCostJpy: number;
    }
  ) => Promise<void>;
}) {
  const guide = card.costs.find((c) => c.key === "guide");
  const driver = card.costs.find((c) => c.key === "driver");
  const tickets = card.costs.find((c) => c.key === "tickets");
  const [guidePay, setGuidePay] = useState(String(guide?.amountJpy || ""));
  const [driverPay, setDriverPay] = useState(String(driver?.amountJpy || ""));
  const [ticketCost, setTicketCost] = useState(
    String(tickets?.amountJpy || "")
  );

  useEffect(() => {
    setGuidePay(String(guide?.amountJpy || ""));
    setDriverPay(String(driver?.amountJpy || ""));
    setTicketCost(String(tickets?.amountJpy || ""));
  }, [card.pnr, guide?.amountJpy, driver?.amountJpy, tickets?.amountJpy]);

  const costsBusy = savingKey === `${card.pnr}-costs`;

  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]/70 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur-md sm:p-5">
      <BoxGradingGlow />
      <div className="relative z-10 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-mono text-lg font-semibold text-white">
                {card.pnr}
              </h3>
              <span
                className={`rounded-md border px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase ${payStatusTone(card.tourPaymentStatus)}`}
              >
                {card.tourPaymentStatus.replace(/_/g, " ")}
              </span>
              <Link
                href={`/ops?pnr=${encodeURIComponent(card.pnr)}`}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-[#7ec8e3] hover:border-[#7ec8e3]/40"
              >
                Open in Ops
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <p className="text-sm text-zinc-200">{card.guestName}</p>
            {card.guestEmail ? (
              <p className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <Mail className="h-3 w-3 shrink-0" />
                <a
                  href={`mailto:${card.guestEmail}`}
                  className="hover:text-[#7ec8e3]"
                >
                  {card.guestEmail}
                </a>
              </p>
            ) : (
              <p className="text-[11px] text-zinc-600">No email on file</p>
            )}
            <p className="text-[11px] text-zinc-500">
              {card.tourDate || "No tour date"}
              {card.endDate && card.endDate !== card.tourDate
                ? ` → ${card.endDate}`
                : ""}
              {card.assignedGuide ? ` · Guide ${card.assignedGuide}` : ""}
              {card.assignedDriver ? ` · Driver ${card.assignedDriver}` : ""}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-2 text-right">
            <p className="text-[10px] tracking-wider text-zinc-500 uppercase">
              Net PNR profit
            </p>
            <p
              className={`font-display text-2xl font-semibold tabular-nums ${
                card.netPnrProfitEur >= 0
                  ? "text-emerald-300"
                  : "text-amber-300"
              }`}
            >
              {formatEur(card.netPnrProfitEur)}
            </p>
            <p className="text-[10px] text-zinc-500">
              {formatEur(card.totalInflowsEur)} in −{" "}
              {formatEur(card.totalCostsEur)} out
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold tracking-[0.18em] text-[#F6A724] uppercase">
              Guest inflows
            </p>
            {card.milestones.map((m) => (
              <MilestoneRow key={m.kind} m={m} />
            ))}
            <p className="pt-1 text-[10px] text-zinc-500">
              Package {formatEur(card.packageTotalEur)} · Collected{" "}
              {formatEur(card.totalPaidEur)}
              {card.pendingReceivableEur > 0
                ? ` · Due ${formatEur(card.pendingReceivableEur)}`
                : ""}
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold tracking-[0.18em] text-[#F6A724] uppercase">
              Contractor outflows
            </p>
            {card.costs.map((c) => (
              <CostRow
                key={c.key}
                cost={c}
                busy={savingKey === `${card.pnr}-${c.key}`}
                onToggle={(status) => void onTogglePayout(card, c.key, status)}
              />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-black/15 p-3">
          <p className="mb-2 text-[10px] font-bold tracking-[0.18em] text-zinc-500 uppercase">
            Edit cost JPY (ops_hub + ops_money)
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[10px] text-zinc-500">
              Guide ¥
              <input
                type="number"
                min={0}
                className="mt-0.5 block w-28 rounded-lg border border-white/10 bg-zinc-950 px-2 py-1 text-xs text-white"
                value={guidePay}
                onChange={(e) => setGuidePay(e.target.value)}
              />
            </label>
            <label className="text-[10px] text-zinc-500">
              Driver ¥
              <input
                type="number"
                min={0}
                className="mt-0.5 block w-28 rounded-lg border border-white/10 bg-zinc-950 px-2 py-1 text-xs text-white"
                value={driverPay}
                onChange={(e) => setDriverPay(e.target.value)}
              />
            </label>
            <label className="text-[10px] text-zinc-500">
              Tickets ¥
              <input
                type="number"
                min={0}
                className="mt-0.5 block w-28 rounded-lg border border-white/10 bg-zinc-950 px-2 py-1 text-xs text-white"
                value={ticketCost}
                onChange={(e) => setTicketCost(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={costsBusy}
              className="rounded-lg bg-[#075473] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              onClick={() =>
                void onSaveCosts(card, {
                  guidePayJpy: Number(guidePay) || 0,
                  driverPayJpy: Number(driverPay) || 0,
                  ticketCostJpy: Number(ticketCost) || 0,
                })
              }
            >
              {costsBusy ? "…" : "Save costs"}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function PayrollTools({
  payouts,
  settlements,
  invoices,
  period,
  setPeriod,
  guideIdForSettle,
  setGuideIdForSettle,
  agencyIdForInvoice,
  setAgencyIdForInvoice,
  guidesList,
  agenciesList,
  getClient,
  setMsg,
  reload,
}: {
  payouts: OpsPayoutRow[];
  settlements: GuideMonthlySettlement[];
  invoices: AgencyMonthlyInvoice[];
  period: string;
  setPeriod: (v: string) => void;
  guideIdForSettle: string;
  setGuideIdForSettle: (v: string) => void;
  agencyIdForInvoice: string;
  setAgencyIdForInvoice: (v: string) => void;
  guidesList: { id: string; full_name?: string }[];
  agenciesList: { id: string; name?: string }[];
  getClient: () => PocketBase;
  setMsg: (v: string | null) => void;
  reload: () => Promise<void>;
}) {
  return (
    <div className="space-y-6 rounded-3xl border border-white/10 bg-[#0D1117]/50 p-4">
      <div className="space-y-3">
        <h3 className="font-medium text-zinc-100">Staff payouts (ops_payouts)</h3>
        <p className="text-xs text-zinc-500">
          Legacy staff-visible earnings. Detail toggles also sync guide/driver
          here when assigned.
        </p>
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-950 text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2">PNR</th>
                <th className="px-3 py-2">Staff</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {payouts.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-zinc-500"
                  >
                    No payouts — assign guide/driver then save cost amounts.
                  </td>
                </tr>
              ) : (
                payouts.map((p) => (
                  <tr key={p.id} className="border-b border-zinc-900/80">
                    <td className="px-3 py-2 font-mono text-xs text-white">
                      {p.pnr}
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-400">
                      {p.staff_name || p.staff_id}
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-400">{p.role}</td>
                    <td className="px-3 py-2 text-xs text-zinc-300">
                      ¥{Number(p.amount_jpy || 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
                        value={p.status || "pending"}
                        onChange={async (e) => {
                          try {
                            await upsertPayout(getClient(), {
                              pnr: p.pnr,
                              staffId: p.staff_id,
                              role: p.role as "guide" | "driver",
                              status: e.target.value as PayoutStatus,
                            });
                            setMsg(`${p.pnr} payout → ${e.target.value}`);
                            await reload();
                          } catch (err) {
                            setMsg(formatPbError(err));
                          }
                        }}
                      >
                        {["pending", "paid", "hold"].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <h3 className="font-medium text-zinc-100">Monthly guide payroll</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="month"
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
          <select
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
            value={guideIdForSettle}
            onChange={(e) => setGuideIdForSettle(e.target.value)}
          >
            <option value="">Guide…</option>
            {guidesList.map((g) => (
              <option key={g.id} value={g.id}>
                {g.full_name || g.id}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded-lg bg-[#075473] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            disabled={!guideIdForSettle || !period}
            onClick={async () => {
              try {
                await generateGuideMonthlySettlement(getClient(), {
                  guideId: guideIdForSettle,
                  billingPeriod: period,
                });
                setMsg(`Settlement draft · ${period}`);
                await reload();
              } catch (e) {
                setMsg(formatPbError(e));
              }
            }}
          >
            Generate settlement
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {settlements.length === 0 ? (
            <li className="text-xs text-zinc-500">No settlements yet.</li>
          ) : (
            settlements.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-xs"
              >
                <span className="text-zinc-300">
                  {s.billing_period} · {s.total_tours_completed || 0} tours ·{" "}
                  {s.status}
                </span>
                <span className="font-mono text-white">
                  {Number(s.final_net_payout || 0).toLocaleString()}{" "}
                  {s.currency || "JPY"}
                </span>
                {s.status !== "paid" ? (
                  <button
                    type="button"
                    className="rounded border border-emerald-700/50 px-2 py-0.5 text-emerald-400"
                    onClick={async () => {
                      try {
                        await markSettlementPaid(getClient(), s.id);
                        setMsg(`Paid settlement ${s.billing_period}`);
                        await reload();
                      } catch (e) {
                        setMsg(formatPbError(e));
                      }
                    }}
                  >
                    Mark paid
                  </button>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <h3 className="font-medium text-zinc-100">Agency monthly invoices</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
            value={agencyIdForInvoice}
            onChange={(e) => setAgencyIdForInvoice(e.target.value)}
          >
            <option value="">Agency…</option>
            {agenciesList.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name || a.id}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded-lg bg-[#075473] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            disabled={!agencyIdForInvoice || !period}
            onClick={async () => {
              try {
                const pb = getClient();
                const orders = await pb
                  .collection("agency_orders")
                  .getFullList<{
                    booking_ref?: string;
                    agency_id?: string;
                    status?: string;
                  }>({
                    filter: `agency_id="${agencyIdForInvoice}"`,
                    requestKey: null,
                  });
                const lineItems = orders
                  .filter((o) => o.booking_ref)
                  .map((o) => ({
                    pnr: String(o.booking_ref).toUpperCase(),
                    amount: 0,
                    title: o.status || "order",
                  }));
                await generateAgencyMonthlyInvoice(pb, {
                  agencyId: agencyIdForInvoice,
                  billingPeriod: period,
                  lineItems,
                });
                setMsg(
                  `Invoice draft · ${period} (${lineItems.length} PNRs — set amounts in PB)`
                );
                await reload();
              } catch (e) {
                setMsg(formatPbError(e));
              }
            }}
          >
            Generate invoice
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {invoices.length === 0 ? (
            <li className="text-xs text-zinc-500">No invoices yet.</li>
          ) : (
            invoices.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap justify-between gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-xs"
              >
                <span className="text-zinc-300">
                  {inv.invoice_number} · {inv.invoice_status}
                </span>
                <span className="font-mono text-white">
                  {Number(inv.total_amount_due || 0).toLocaleString()}{" "}
                  {inv.currency || "EUR"}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
