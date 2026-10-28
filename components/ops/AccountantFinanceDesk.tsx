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
  Building2,
  CheckCircle2,
  FileText,
  Loader2,
  Receipt,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { BoxGradingGlow } from "@/components/branding/BoxGradingGlow";
import {
  loadStaffByRole,
  type StaffOption,
} from "@/components/staff/opsHubClient";
import {
  StaffPortalShell,
  STAFF_PORTAL_REFRESH_EVENT,
} from "@/components/staff/StaffPortalShell";
import {
  agencyInvoiceStatusTone,
  buildContractorInvoiceCards,
  buildMonthlyPayoutSlips,
  computeAccountingDeskKpis,
  contractorStatusTone,
  currentBillingPeriod,
  filterAgencyInvoices,
  formatEur,
  formatJpy,
  slipStatusTone,
  type AccountingDeskTab,
  type AgencyInvoiceStatusFilter,
  type ContractorReportRow,
  type DatedPayoutRow,
  type MonthlyPayoutSlip,
  type StaffNameLookup,
} from "@/lib/accountantFinanceDesk";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  loadAllPayouts,
  upsertPayout,
  type PayoutStatus,
} from "@/lib/opsPayouts";
import {
  generateAgencyMonthlyInvoice,
  type AgencyMonthlyInvoice,
} from "@/lib/pricing/settlements";
import { canAccessAccounting } from "@/lib/staffRoles";
import { useTeamAuth } from "@/store/useTeamAuth";
import type PocketBase from "pocketbase";

const TABS: { id: AccountingDeskTab; label: string; icon: ReactNode }[] = [
  {
    id: "payouts",
    label: "Payouts",
    icon: <Wallet className="h-3.5 w-3.5" strokeWidth={2} />,
  },
  {
    id: "contractor_invoices",
    label: "Contractor Invoices",
    icon: <Receipt className="h-3.5 w-3.5" strokeWidth={2} />,
  },
  {
    id: "agency_invoices",
    label: "Agency Invoices",
    icon: <Building2 className="h-3.5 w-3.5" strokeWidth={2} />,
  },
];

const AGENCY_STATUS_FILTERS: { id: AgencyInvoiceStatusFilter; label: string }[] =
  [
    { id: "all", label: "All" },
    { id: "draft", label: "Draft" },
    { id: "sent", label: "Sent" },
    { id: "partially_paid", label: "Partial" },
    { id: "paid", label: "Paid" },
    { id: "overdue", label: "Overdue" },
  ];

type AgencyPartner = { id: string; name?: string };

/**
 * Accountant Financial Settlements Desk.
 * Guide/driver monthly payout slips · contractor receipt verification · B2B agency invoices.
 * Owner keeps high-level P&L at /ops/money.
 */
export function AccountantFinanceDesk() {
  return (
    <StaffPortalShell
      title="Accountant · Financial Settlements"
      allow={canAccessAccounting}
      wide
    >
      <AccountantFinanceInner />
    </StaffPortalShell>
  );
}

function AccountantFinanceInner() {
  const getClient = useTeamAuth((s) => s.getClient);
  const [period, setPeriod] = useState(currentBillingPeriod);
  const [tab, setTab] = useState<AccountingDeskTab>("payouts");
  const [payouts, setPayouts] = useState<DatedPayoutRow[]>([]);
  const [reports, setReports] = useState<ContractorReportRow[]>([]);
  const [invoices, setInvoices] = useState<AgencyMonthlyInvoice[]>([]);
  const [agencies, setAgencies] = useState<AgencyPartner[]>([]);
  const [guides, setGuides] = useState<StaffOption[]>([]);
  const [drivers, setDrivers] = useState<StaffOption[]>([]);
  const [agencyNames, setAgencyNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [selectedSlipKey, setSelectedSlipKey] = useState<string | null>(null);
  const [agencyFilter, setAgencyFilter] =
    useState<AgencyInvoiceStatusFilter>("all");
  const [agencyIdForInvoice, setAgencyIdForInvoice] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pb = getClient();
      const [
        payoutList,
        guideList,
        driverList,
        reportList,
        invoiceList,
        agencyList,
      ] = await Promise.all([
        loadAllPayouts(pb).catch(() => [] as DatedPayoutRow[]),
        loadStaffByRole(pb, "guide"),
        loadStaffByRole(pb, "driver"),
        pb
          .collection("tour_completion_reports")
          .getFullList<ContractorReportRow>({
            sort: "-created",
            requestKey: null,
          })
          .catch(() => [] as ContractorReportRow[]),
        pb
          .collection("agency_monthly_invoices")
          .getFullList<AgencyMonthlyInvoice>({
            sort: "-billing_period",
            requestKey: null,
          })
          .catch(() => [] as AgencyMonthlyInvoice[]),
        pb
          .collection("agencies")
          .getFullList<AgencyPartner>({
            sort: "name",
            requestKey: null,
          })
          .catch(() => [] as AgencyPartner[]),
      ]);

      setPayouts(payoutList as DatedPayoutRow[]);
      setGuides(guideList);
      setDrivers(driverList);
      setReports(reportList);
      setInvoices(invoiceList);
      setAgencies(agencyList);

      const names: Record<string, string> = {};
      for (const a of agencyList) {
        names[a.id] = String(a.name || a.id).trim();
      }
      setAgencyNames(names);
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

  const staffById = useMemo(() => {
    const map: Record<string, StaffNameLookup> = {};
    for (const s of [...guides, ...drivers]) {
      map[s.id] = { id: s.id, name: s.name, email: s.email };
    }
    return map;
  }, [guides, drivers]);

  const slips = useMemo(
    () => buildMonthlyPayoutSlips(payouts, period, staffById),
    [payouts, period, staffById]
  );

  const contractorCards = useMemo(
    () => buildContractorInvoiceCards(reports, period),
    [reports, period]
  );

  const periodInvoices = useMemo(
    () => filterAgencyInvoices(invoices, period, agencyFilter),
    [invoices, period, agencyFilter]
  );

  const kpis = useMemo(
    () =>
      computeAccountingDeskKpis({
        slips,
        contractorCards,
        agencyInvoices: filterAgencyInvoices(invoices, period, "all"),
      }),
    [slips, contractorCards, invoices, period]
  );

  useEffect(() => {
    if (slips.length === 0) {
      setSelectedSlipKey(null);
      return;
    }
    if (!selectedSlipKey || !slips.some((s) => s.key === selectedSlipKey)) {
      setSelectedSlipKey(slips[0].key);
    }
  }, [slips, selectedSlipKey]);

  const selectedSlip =
    slips.find((s) => s.key === selectedSlipKey) || null;

  const settleSlip = async (slip: MonthlyPayoutSlip, status: PayoutStatus) => {
    setBusyKey(slip.key);
    setMsg(null);
    try {
      const pb = getClient();
      for (const line of slip.lines) {
        if (status === "paid" && line.status === "paid") continue;
        await upsertPayout(pb, {
          pnr: line.pnr,
          staffId: line.staff_id,
          staffName: line.staff_name,
          role: line.role === "driver" ? "driver" : "guide",
          status,
        });
      }
      setMsg(
        `${slip.staffName} · ${slip.lines.length} line(s) → ${status} (${period})`
      );
      await reload();
    } catch (e) {
      setMsg(formatPbError(e));
    } finally {
      setBusyKey(null);
    }
  };

  const setLineStatus = async (
    line: DatedPayoutRow,
    status: PayoutStatus
  ) => {
    setBusyKey(line.id);
    setMsg(null);
    try {
      await upsertPayout(getClient(), {
        pnr: line.pnr,
        staffId: line.staff_id,
        staffName: line.staff_name,
        role: line.role === "driver" ? "driver" : "guide",
        status,
      });
      setMsg(`${line.pnr} · ${line.staff_name || line.staff_id} → ${status}`);
      await reload();
    } catch (e) {
      setMsg(formatPbError(e));
    } finally {
      setBusyKey(null);
    }
  };

  const verifyReport = async (reportId: string, verified: boolean) => {
    setBusyKey(reportId);
    setMsg(null);
    try {
      await getClient()
        .collection("tour_completion_reports")
        .update(reportId, { is_verified_by_admin: verified }, {
          requestKey: null,
        });
      setMsg(verified ? "Receipt verified" : "Verification cleared");
      await reload();
    } catch (e) {
      setMsg(formatPbError(e));
    } finally {
      setBusyKey(null);
    }
  };

  const setInvoiceStatus = async (
    inv: AgencyMonthlyInvoice,
    invoice_status: string
  ) => {
    setBusyKey(inv.id);
    setMsg(null);
    try {
      await getClient()
        .collection("agency_monthly_invoices")
        .update(inv.id, { invoice_status }, { requestKey: null });
      setMsg(`${inv.invoice_number} → ${invoice_status}`);
      await reload();
    } catch (e) {
      setMsg(formatPbError(e));
    } finally {
      setBusyKey(null);
    }
  };

  const generateInvoice = async () => {
    if (!agencyIdForInvoice || !period) return;
    setBusyKey("gen-agency");
    setMsg(null);
    try {
      const pb = getClient();
      const orders = await pb.collection("agency_orders").getFullList<{
        booking_ref?: string;
        agency_id?: string;
        status?: string;
        tour_date?: string;
      }>({
        filter: `agency_id="${agencyIdForInvoice}"`,
        requestKey: null,
      });

      const hubs = await pb
        .collection("ops_hub")
        .getFullList<{
          pnr?: string;
          estimated_total_eur?: number;
          total_paid_eur?: number;
          source?: string;
        }>({
          filter: 'source="agency"',
          requestKey: null,
        })
        .catch(() => [] as {
          pnr?: string;
          estimated_total_eur?: number;
          total_paid_eur?: number;
        }[]);

      const hubByPnr: Record<string, { estimated: number; paid: number }> = {};
      for (const h of hubs) {
        const pnr = String(h.pnr || "")
          .trim()
          .toUpperCase();
        if (!pnr) continue;
        hubByPnr[pnr] = {
          estimated: Number(h.estimated_total_eur) || 0,
          paid: Number(h.total_paid_eur) || 0,
        };
      }

      const lineItems = orders
        .filter((o) => {
          if (!o.booking_ref) return false;
          const td = String(o.tour_date || "").slice(0, 7);
          if (td && td !== period) return false;
          return true;
        })
        .map((o) => {
          const pnr = String(o.booking_ref).trim().toUpperCase();
          const hub = hubByPnr[pnr];
          const amount = hub?.estimated || hub?.paid || 0;
          return {
            pnr,
            amount,
            title: o.status || "order",
          };
        });

      await generateAgencyMonthlyInvoice(pb, {
        agencyId: agencyIdForInvoice,
        billingPeriod: period,
        lineItems,
      });
      setMsg(
        `Invoice draft · ${period} (${lineItems.length} PNRs${
          lineItems.every((l) => l.amount === 0)
            ? " — amounts 0; set on ops_hub / PB"
            : ""
        })`
      );
      await reload();
    } catch (e) {
      setMsg(formatPbError(e));
    } finally {
      setBusyKey(null);
    }
  };

  if (loading && payouts.length === 0 && invoices.length === 0) {
    return (
      <p className="flex items-center gap-2 py-16 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading settlements desk…
      </p>
    );
  }

  if (error && payouts.length === 0 && invoices.length === 0) {
    return <p className="py-16 text-sm text-red-400">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            Settlements only · P&L stays on Money for Owner
          </p>
          <h1 className="mt-1 font-display text-2xl text-white md:text-3xl">
            Financial Settlements Desk
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Monthly guide &amp; driver payout slips, contractor tax
            invoice/receipt verification, and agency B2B invoicing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[11px] uppercase tracking-wider text-zinc-500">
            Month
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="ml-2 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
            />
          </label>
          <button
            type="button"
            onClick={() => void reload()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-500"
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
            Refresh
          </button>
          <Link
            href="/ops/money"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/10"
          >
            Owner P&amp;L →
          </Link>
        </div>
      </header>

      {msg ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {msg}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Pending payouts"
          value={formatJpy(kpis.pendingPayoutJpy)}
          hint={`${kpis.pendingSlipCount} open slip(s)`}
        />
        <KpiCard
          label="Open slips"
          value={String(kpis.pendingSlipCount)}
          hint={`${slips.length} total this month`}
        />
        <KpiCard
          label="Contractor receipts"
          value={String(kpis.contractorPendingCount)}
          hint="Awaiting verify"
        />
        <KpiCard
          label="Agency open"
          value={formatEur(kpis.agencyOpenDueEur)}
          hint={`${kpis.agencyOpenCount} invoice(s)`}
        />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "bg-[#075473] text-white"
                  : "border border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "payouts" ? (
        <PayoutsTab
          slips={slips}
          selectedSlip={selectedSlip}
          selectedSlipKey={selectedSlipKey}
          setSelectedSlipKey={setSelectedSlipKey}
          busyKey={busyKey}
          onSettleSlip={settleSlip}
          onSetLineStatus={setLineStatus}
        />
      ) : null}

      {tab === "contractor_invoices" ? (
        <ContractorTab
          cards={contractorCards}
          reports={reports}
          busyKey={busyKey}
          getClient={getClient}
          onVerify={verifyReport}
        />
      ) : null}

      {tab === "agency_invoices" ? (
        <AgencyTab
          invoices={periodInvoices}
          agencies={agencies}
          agencyNames={agencyNames}
          agencyFilter={agencyFilter}
          setAgencyFilter={setAgencyFilter}
          agencyIdForInvoice={agencyIdForInvoice}
          setAgencyIdForInvoice={setAgencyIdForInvoice}
          busyKey={busyKey}
          onGenerate={() => void generateInvoice()}
          onSetStatus={setInvoiceStatus}
        />
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]/70 p-4">
      <BoxGradingGlow />
      <div className="relative z-10">
        <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
          {label}
        </p>
        <p className="mt-2 font-display text-xl text-white">{value}</p>
        <p className="mt-1 text-xs text-zinc-500">{hint}</p>
      </div>
    </div>
  );
}

function PayoutsTab({
  slips,
  selectedSlip,
  selectedSlipKey,
  setSelectedSlipKey,
  busyKey,
  onSettleSlip,
  onSetLineStatus,
}: {
  slips: MonthlyPayoutSlip[];
  selectedSlip: MonthlyPayoutSlip | null;
  selectedSlipKey: string | null;
  setSelectedSlipKey: (k: string) => void;
  busyKey: string | null;
  onSettleSlip: (
    slip: MonthlyPayoutSlip,
    status: PayoutStatus
  ) => Promise<void>;
  onSetLineStatus: (
    line: DatedPayoutRow,
    status: PayoutStatus
  ) => Promise<void>;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-200">
          Monthly payout slips
        </h2>
        <p className="text-xs text-zinc-500">
          Aggregated from <code className="text-zinc-400">ops_payouts</code>{" "}
          for guides &amp; drivers (staff role, not fictional collections).
        </p>
        {slips.length === 0 ? (
          <p className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-8 text-center text-sm text-zinc-500">
            No payout lines for this month.
          </p>
        ) : (
          <ul className="max-h-[36rem] space-y-2 overflow-y-auto pr-1">
            {slips.map((slip) => {
              const active = slip.key === selectedSlipKey;
              return (
                <li key={slip.key}>
                  <button
                    type="button"
                    onClick={() => setSelectedSlipKey(slip.key)}
                    className={`relative w-full overflow-hidden rounded-2xl border p-3 text-left transition ${
                      active
                        ? "border-[#075473]/60 bg-[#075473]/15"
                        : "border-white/10 bg-[#0D1117]/60 hover:border-white/20"
                    }`}
                  >
                    <BoxGradingGlow />
                    <div className="relative z-10 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {slip.staffName}
                        </p>
                        <p className="mt-0.5 text-[11px] uppercase tracking-wider text-zinc-500">
                          {slip.role} · {slip.lineCount} PNR
                          {slip.lineCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${slipStatusTone(slip.status)}`}
                      >
                        {slip.status}
                      </span>
                    </div>
                    <p className="relative z-10 mt-2 font-mono text-sm text-zinc-200">
                      {formatJpy(slip.totalJpy)}
                      {slip.pendingJpy > 0 ? (
                        <span className="ml-2 text-xs text-amber-300/90">
                          {formatJpy(slip.pendingJpy)} pending
                        </span>
                      ) : null}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="relative min-h-[20rem] overflow-hidden rounded-3xl border border-white/10 bg-[#0D1117]/70 p-4 md:p-5">
        <BoxGradingGlow />
        <div className="relative z-10">
          {!selectedSlip ? (
            <p className="py-16 text-center text-sm text-zinc-500">
              Select a payout slip.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl text-white">
                    {selectedSlip.staffName}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    {selectedSlip.role} · {selectedSlip.period} ·{" "}
                    {selectedSlip.lineCount} line(s)
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyKey === selectedSlip.key}
                    onClick={() => void onSettleSlip(selectedSlip, "paid")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600/90 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Settle all paid
                  </button>
                  <button
                    type="button"
                    disabled={busyKey === selectedSlip.key}
                    onClick={() => void onSettleSlip(selectedSlip, "pending")}
                    className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 disabled:opacity-50"
                  >
                    Reset pending
                  </button>
                  <button
                    type="button"
                    disabled={busyKey === selectedSlip.key}
                    onClick={() => void onSettleSlip(selectedSlip, "hold")}
                    className="rounded-lg border border-rose-700/50 px-3 py-1.5 text-xs text-rose-300 disabled:opacity-50"
                  >
                    Hold
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <MiniStat label="Total" value={formatJpy(selectedSlip.totalJpy)} />
                <MiniStat
                  label="Pending"
                  value={formatJpy(selectedSlip.pendingJpy)}
                />
                <MiniStat label="Paid" value={formatJpy(selectedSlip.paidJpy)} />
              </div>

              <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-zinc-800 bg-zinc-950 text-[11px] uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="px-3 py-2">PNR</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSlip.lines.map((line) => (
                      <tr
                        key={line.id}
                        className="border-b border-zinc-900/80"
                      >
                        <td className="px-3 py-2 font-mono text-xs text-white">
                          {line.pnr}
                        </td>
                        <td className="px-3 py-2 text-xs text-zinc-300">
                          {formatJpy(Number(line.amount_jpy) || 0)}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
                            value={line.status || "pending"}
                            disabled={busyKey === line.id}
                            onChange={(e) =>
                              void onSetLineStatus(
                                line,
                                e.target.value as PayoutStatus
                              )
                            }
                          >
                            {["pending", "paid", "hold"].map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm text-zinc-100">{value}</p>
    </div>
  );
}

function receiptFileUrls(
  pb: PocketBase,
  report: ContractorReportRow | undefined,
  files: string[]
): string[] {
  if (!report || files.length === 0) return [];
  const urls: string[] = [];
  for (const file of files) {
    try {
      urls.push(pb.files.getURL(report as never, file));
    } catch {
      /* skip broken file ref */
    }
  }
  return urls;
}

function ContractorTab({
  cards,
  reports,
  busyKey,
  getClient,
  onVerify,
}: {
  cards: ReturnType<typeof buildContractorInvoiceCards>;
  reports: ContractorReportRow[];
  busyKey: string | null;
  getClient: () => PocketBase;
  onVerify: (id: string, verified: boolean) => Promise<void>;
}) {
  const reportById = useMemo(() => {
    const m: Record<string, ContractorReportRow> = {};
    for (const r of reports) m[r.id] = r;
    return m;
  }, [reports]);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-medium text-zinc-200">
          Contractor invoice / receipt collection
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          From <code className="text-zinc-400">tour_completion_reports</code>{" "}
          (receipts + admin verify). Guides upload via completion reports.
        </p>
      </div>
      {cards.length === 0 ? (
        <p className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-10 text-center text-sm text-zinc-500">
          No completion reports / receipts for this month.
        </p>
      ) : (
        <ul className="space-y-2">
          {cards.map((card) => {
            const receiptUrls = receiptFileUrls(
              getClient(),
              reportById[card.id],
              card.receiptFiles
            );
            return (
              <li
                key={card.id}
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]/70 p-4"
              >
                <BoxGradingGlow />
                <div className="relative z-10 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-sm text-white">
                        {card.pnr || "—"}
                      </p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${contractorStatusTone(card.status)}`}
                      >
                        {card.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      Expenses {formatJpy(card.expensesJpy)} ·{" "}
                      {card.receiptCount} receipt
                      {card.receiptCount === 1 ? "" : "s"}
                    </p>
                    {card.notes ? (
                      <p className="mt-2 max-w-xl text-xs text-zinc-400">
                        {card.notes}
                      </p>
                    ) : null}
                    {receiptUrls.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {receiptUrls.map((url, i) => (
                          <a
                            key={`${card.id}-r-${i}`}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-sky-300 hover:border-sky-600"
                          >
                            <FileText className="h-3 w-3" />
                            Receipt {i + 1}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    {!card.verified ? (
                      <button
                        type="button"
                        disabled={busyKey === card.id}
                        onClick={() => void onVerify(card.id, true)}
                        className="rounded-lg bg-emerald-600/90 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Verify
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyKey === card.id}
                        onClick={() => void onVerify(card.id, false)}
                        className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 disabled:opacity-50"
                      >
                        Unverify
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AgencyTab({
  invoices,
  agencies,
  agencyNames,
  agencyFilter,
  setAgencyFilter,
  agencyIdForInvoice,
  setAgencyIdForInvoice,
  busyKey,
  onGenerate,
  onSetStatus,
}: {
  invoices: AgencyMonthlyInvoice[];
  agencies: AgencyPartner[];
  agencyNames: Record<string, string>;
  agencyFilter: AgencyInvoiceStatusFilter;
  setAgencyFilter: (v: AgencyInvoiceStatusFilter) => void;
  agencyIdForInvoice: string;
  setAgencyIdForInvoice: (v: string) => void;
  busyKey: string | null;
  onGenerate: () => void;
  onSetStatus: (
    inv: AgencyMonthlyInvoice,
    status: string
  ) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]/70 p-4">
        <BoxGradingGlow />
        <div className="relative z-10">
          <h2 className="text-sm font-medium text-zinc-200">
            Issue agency monthly invoice
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Pulls <code className="text-zinc-400">agency_orders</code> for the
            selected month; amounts from matching agency{" "}
            <code className="text-zinc-400">ops_hub</code> estimates when
            available.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100"
              value={agencyIdForInvoice}
              onChange={(e) => setAgencyIdForInvoice(e.target.value)}
            >
              <option value="">Agency…</option>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name || a.id}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!agencyIdForInvoice || busyKey === "gen-agency"}
              onClick={onGenerate}
              className="rounded-lg bg-[#075473] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              {busyKey === "gen-agency" ? "Generating…" : "Generate / refresh draft"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {AGENCY_STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setAgencyFilter(f.id)}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
              agencyFilter === f.id
                ? "bg-zinc-100 text-zinc-900"
                : "border border-zinc-700 text-zinc-400"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {invoices.length === 0 ? (
        <p className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-10 text-center text-sm text-zinc-500">
          No agency invoices for this month / filter.
        </p>
      ) : (
        <ul className="space-y-2">
          {invoices.map((inv) => (
            <li
              key={inv.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0D1117]/70 px-4 py-3"
            >
              <div>
                <p className="font-mono text-sm text-white">
                  {inv.invoice_number}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {agencyNames[inv.agency] || inv.agency} ·{" "}
                  {inv.billing_period} ·{" "}
                  {(inv.included_pnrs || []).length} PNR
                  {(inv.included_pnrs || []).length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-zinc-100">
                  {formatEur(Number(inv.total_amount_due) || 0)}{" "}
                  <span className="text-xs text-zinc-500">
                    {inv.currency || "EUR"}
                  </span>
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${agencyInvoiceStatusTone(inv.invoice_status)}`}
                >
                  {inv.invoice_status || "draft"}
                </span>
                <select
                  className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
                  value={inv.invoice_status || "draft"}
                  disabled={busyKey === inv.id}
                  onChange={(e) =>
                    void onSetStatus(inv, e.target.value)
                  }
                >
                  {[
                    "draft",
                    "sent",
                    "partially_paid",
                    "paid",
                    "overdue",
                  ].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
