/**
 * Accountant Financial Settlements Desk — pure helpers.
 * Sources: ops_payouts, staff (guide/driver), tour_completion_reports,
 * agency_monthly_invoices, agency_orders, ops_hub (agency amounts).
 */

import type { OpsPayoutRow, PayoutStatus } from "@/lib/opsPayouts";
import type { AgencyMonthlyInvoice } from "@/lib/pricing/settlements";

export type AccountingDeskTab =
  | "payouts"
  | "contractor_invoices"
  | "agency_invoices";

export type PayoutSlipStatus = "pending" | "partial" | "paid" | "hold";

export type ContractorInvoiceStatus =
  | "pending_review"
  | "verified"
  | "missing_receipt";

export type AgencyInvoiceStatusFilter =
  | "all"
  | "draft"
  | "sent"
  | "partially_paid"
  | "paid"
  | "overdue";

export type DatedPayoutRow = OpsPayoutRow & {
  created?: string;
  updated?: string;
};

export type ContractorReportRow = {
  id: string;
  pnr?: string;
  assignment?: string;
  actual_expenses_jpy?: number;
  receipts?: string[];
  is_verified_by_admin?: boolean;
  guide_tour_notes?: string;
  created?: string;
  updated?: string;
};

export type StaffNameLookup = {
  id: string;
  name?: string;
  email?: string;
};

export type MonthlyPayoutSlip = {
  key: string;
  staffId: string;
  staffName: string;
  role: "guide" | "driver" | string;
  period: string;
  lineCount: number;
  pendingCount: number;
  paidCount: number;
  holdCount: number;
  totalJpy: number;
  pendingJpy: number;
  paidJpy: number;
  status: PayoutSlipStatus;
  lines: DatedPayoutRow[];
};

export type ContractorInvoiceCard = {
  id: string;
  pnr: string;
  period: string;
  expensesJpy: number;
  receiptCount: number;
  verified: boolean;
  status: ContractorInvoiceStatus;
  notes: string;
  created: string;
  receiptFiles: string[];
};

export type AccountingDeskKpis = {
  pendingPayoutJpy: number;
  pendingSlipCount: number;
  contractorPendingCount: number;
  agencyOpenCount: number;
  agencyOpenDueEur: number;
};

function periodFromIso(iso: string | undefined | null): string {
  const raw = String(iso || "").trim();
  if (raw.length >= 7) return raw.slice(0, 7);
  return "";
}

export function currentBillingPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

export function payoutBelongsToPeriod(
  row: DatedPayoutRow,
  period: string
): boolean {
  const p = String(period || "").trim();
  if (!p) return true;
  const fromUpdated = periodFromIso(row.updated);
  const fromCreated = periodFromIso(row.created);
  // Prefer updated (status changes), else created; untimed rows stay visible.
  if (fromUpdated) return fromUpdated === p;
  if (fromCreated) return fromCreated === p;
  return true;
}

export function reportBelongsToPeriod(
  row: ContractorReportRow,
  period: string
): boolean {
  const p = String(period || "").trim();
  if (!p) return true;
  const fromCreated = periodFromIso(row.created);
  const fromUpdated = periodFromIso(row.updated);
  if (fromCreated) return fromCreated === p;
  if (fromUpdated) return fromUpdated === p;
  return true;
}

export function invoiceBelongsToPeriod(
  inv: AgencyMonthlyInvoice,
  period: string
): boolean {
  const p = String(period || "").trim();
  if (!p) return true;
  return String(inv.billing_period || "").trim() === p;
}

function normalizePayoutStatus(status: string | undefined): PayoutStatus | string {
  const s = String(status || "pending").trim().toLowerCase();
  if (s === "paid" || s === "hold" || s === "pending") return s;
  return "pending";
}

export function deriveSlipStatus(lines: DatedPayoutRow[]): PayoutSlipStatus {
  if (lines.length === 0) return "pending";
  let paid = 0;
  let hold = 0;
  let pending = 0;
  for (const line of lines) {
    const s = normalizePayoutStatus(line.status);
    if (s === "paid") paid += 1;
    else if (s === "hold") hold += 1;
    else pending += 1;
  }
  if (hold > 0 && paid === 0 && pending === 0) return "hold";
  if (paid === lines.length) return "paid";
  if (paid > 0) return "partial";
  if (hold > 0 && pending === 0) return "hold";
  return "pending";
}

export function buildMonthlyPayoutSlips(
  payouts: DatedPayoutRow[],
  period: string,
  staffById: Record<string, StaffNameLookup>
): MonthlyPayoutSlip[] {
  const filtered = payouts.filter((p) => payoutBelongsToPeriod(p, period));
  const buckets = new Map<string, DatedPayoutRow[]>();

  for (const row of filtered) {
    const staffId = String(row.staff_id || "").trim();
    const role = String(row.role || "guide").trim() || "guide";
    if (!staffId) continue;
    const key = `${staffId}::${role}`;
    const list = buckets.get(key) || [];
    list.push(row);
    buckets.set(key, list);
  }

  const slips: MonthlyPayoutSlip[] = [];
  for (const [key, lines] of buckets) {
    const [staffId, role] = key.split("::");
    const staff = staffById[staffId];
    const staffName =
      String(lines[0]?.staff_name || "").trim() ||
      String(staff?.name || "").trim() ||
      String(staff?.email || "").trim() ||
      staffId;

    let totalJpy = 0;
    let pendingJpy = 0;
    let paidJpy = 0;
    let pendingCount = 0;
    let paidCount = 0;
    let holdCount = 0;

    for (const line of lines) {
      const amount = Number(line.amount_jpy) || 0;
      totalJpy += amount;
      const s = normalizePayoutStatus(line.status);
      if (s === "paid") {
        paidCount += 1;
        paidJpy += amount;
      } else if (s === "hold") {
        holdCount += 1;
      } else {
        pendingCount += 1;
        pendingJpy += amount;
      }
    }

    slips.push({
      key,
      staffId,
      staffName,
      role,
      period,
      lineCount: lines.length,
      pendingCount,
      paidCount,
      holdCount,
      totalJpy,
      pendingJpy,
      paidJpy,
      status: deriveSlipStatus(lines),
      lines: [...lines].sort((a, b) =>
        String(a.pnr || "").localeCompare(String(b.pnr || ""))
      ),
    });
  }

  return slips.sort((a, b) => {
    const roleCmp = String(a.role).localeCompare(String(b.role));
    if (roleCmp !== 0) return roleCmp;
    return a.staffName.localeCompare(b.staffName);
  });
}

export function buildContractorInvoiceCards(
  reports: ContractorReportRow[],
  period: string
): ContractorInvoiceCard[] {
  return reports
    .filter((r) => reportBelongsToPeriod(r, period))
    .map((r) => {
      const receipts = Array.isArray(r.receipts) ? r.receipts.filter(Boolean) : [];
      const expensesJpy = Number(r.actual_expenses_jpy) || 0;
      const verified = Boolean(r.is_verified_by_admin);
      let status: ContractorInvoiceStatus;
      if (verified) status = "verified";
      else if (receipts.length === 0 && expensesJpy > 0)
        status = "missing_receipt";
      else status = "pending_review";

      return {
        id: r.id,
        pnr: String(r.pnr || "").trim().toUpperCase(),
        period: periodFromIso(r.created) || period,
        expensesJpy,
        receiptCount: receipts.length,
        verified,
        status,
        notes: String(r.guide_tour_notes || "").trim(),
        created: String(r.created || ""),
        receiptFiles: receipts,
      };
    })
    .sort((a, b) => b.created.localeCompare(a.created));
}

export function computeAccountingDeskKpis(opts: {
  slips: MonthlyPayoutSlip[];
  contractorCards: ContractorInvoiceCard[];
  agencyInvoices: AgencyMonthlyInvoice[];
}): AccountingDeskKpis {
  let pendingPayoutJpy = 0;
  let pendingSlipCount = 0;
  for (const slip of opts.slips) {
    pendingPayoutJpy += slip.pendingJpy;
    if (slip.status === "pending" || slip.status === "partial" || slip.status === "hold") {
      pendingSlipCount += 1;
    }
  }

  const contractorPendingCount = opts.contractorCards.filter(
    (c) => c.status !== "verified"
  ).length;

  let agencyOpenCount = 0;
  let agencyOpenDueEur = 0;
  for (const inv of opts.agencyInvoices) {
    const st = String(inv.invoice_status || "draft").toLowerCase();
    if (st === "paid") continue;
    agencyOpenCount += 1;
    agencyOpenDueEur += Number(inv.total_amount_due) || 0;
  }

  return {
    pendingPayoutJpy,
    pendingSlipCount,
    contractorPendingCount,
    agencyOpenCount,
    agencyOpenDueEur,
  };
}

export function filterAgencyInvoices(
  invoices: AgencyMonthlyInvoice[],
  period: string,
  statusFilter: AgencyInvoiceStatusFilter
): AgencyMonthlyInvoice[] {
  return invoices.filter((inv) => {
    if (period && !invoiceBelongsToPeriod(inv, period)) return false;
    if (statusFilter === "all") return true;
    return String(inv.invoice_status || "draft").toLowerCase() === statusFilter;
  });
}

export function formatJpy(n: number): string {
  return `¥${Math.round(n).toLocaleString()}`;
}

export function formatEur(n: number): string {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

export function slipStatusTone(status: PayoutSlipStatus): string {
  switch (status) {
    case "paid":
      return "border-emerald-500/40 bg-emerald-500/15 text-emerald-200";
    case "partial":
      return "border-amber-500/40 bg-amber-500/15 text-amber-200";
    case "hold":
      return "border-rose-500/40 bg-rose-500/15 text-rose-200";
    default:
      return "border-sky-500/40 bg-sky-500/15 text-sky-200";
  }
}

export function contractorStatusTone(status: ContractorInvoiceStatus): string {
  switch (status) {
    case "verified":
      return "border-emerald-500/40 bg-emerald-500/15 text-emerald-200";
    case "missing_receipt":
      return "border-rose-500/40 bg-rose-500/15 text-rose-200";
    default:
      return "border-amber-500/40 bg-amber-500/15 text-amber-200";
  }
}

export function agencyInvoiceStatusTone(status: string | undefined): string {
  switch (String(status || "draft").toLowerCase()) {
    case "paid":
      return "border-emerald-500/40 bg-emerald-500/15 text-emerald-200";
    case "sent":
      return "border-sky-500/40 bg-sky-500/15 text-sky-200";
    case "partially_paid":
      return "border-amber-500/40 bg-amber-500/15 text-amber-200";
    case "overdue":
      return "border-rose-500/40 bg-rose-500/15 text-rose-200";
    default:
      return "border-zinc-600/50 bg-zinc-800/60 text-zinc-300";
  }
}
