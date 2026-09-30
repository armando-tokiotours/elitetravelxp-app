/**
 * Cancellation timeframe rules + monthly settlement/invoice helpers.
 */

import type PocketBase from "pocketbase";
import { upsertPayout } from "@/lib/opsPayouts";

export type CancellationTimeframe =
  | "within_24h"
  | "days_2_7"
  | "days_8_plus";

export type CancellationRule = {
  id: string;
  cancellation_timeframe: CancellationTimeframe | string;
  client_refund_percentage?: number;
  guide_compensation_percentage?: number;
  agency_penalty_percentage?: number;
  applies_to?: string;
  is_active?: boolean;
};

export function timeframeFromHoursUntilTour(
  hoursUntil: number
): CancellationTimeframe {
  if (hoursUntil < 24) return "within_24h";
  if (hoursUntil < 24 * 8) return "days_2_7";
  return "days_8_plus";
}

export async function getCancellationRule(
  pb: PocketBase,
  timeframe: CancellationTimeframe,
  appliesTo: "direct" | "agency" | "both" = "both"
): Promise<CancellationRule | null> {
  try {
    const rows = await pb
      .collection("tour_cancellation_rules")
      .getFullList<CancellationRule>({
        filter: `cancellation_timeframe="${timeframe}" && is_active=true`,
        requestKey: null,
      });
    const exact = rows.find(
      (r) => r.applies_to === appliesTo || r.applies_to === "both"
    );
    return exact || rows[0] || null;
  } catch {
    return null;
  }
}

export type GuideMonthlySettlement = {
  id: string;
  guide: string;
  billing_period: string;
  total_tours_completed?: number;
  total_labor_fees?: number;
  total_reimbursed_expenses?: number;
  overtime_adjustments?: number;
  tax_withholding_amount?: number;
  final_net_payout?: number;
  currency?: string;
  included_report_ids?: string[];
  status?: string;
};

/**
 * Aggregate verified completion reports for a guide into a draft settlement.
 */
export async function generateGuideMonthlySettlement(
  pb: PocketBase,
  opts: {
    guideId: string;
    billingPeriod: string;
    currency?: "JPY" | "EUR";
    taxWithholding?: number;
    overtimeHourlyRate?: number;
  }
): Promise<GuideMonthlySettlement> {
  const period = String(opts.billingPeriod || "").trim();
  const guideId = String(opts.guideId || "").trim();
  if (!period || !guideId) throw new Error("guideId and billingPeriod required");

  const assignments = await pb
    .collection("itinerary_guide_assignments")
    .getFullList<{
      id: string;
      guide_fee_amount?: number;
      guide_expenses_amount?: number;
      tour_duration_hours?: number;
      staff_id?: string;
      pnr?: string;
    }>({
      filter: `assigned_guide="${guideId}"`,
      requestKey: null,
    });

  const reports = await pb.collection("tour_completion_reports").getFullList<{
    id: string;
    assignment: string;
    actual_hours_worked?: number;
    extra_hours_approved?: boolean;
    actual_expenses_jpy?: number;
    is_verified_by_admin?: boolean;
    created?: string;
  }>({
    filter: "is_verified_by_admin=true",
    requestKey: null,
  });

  const assignmentIds = new Set(assignments.map((a) => a.id));
  const periodReports = reports.filter((r) => {
    if (!assignmentIds.has(r.assignment)) return false;
    const created = String(r.created || "").slice(0, 7);
    return created === period;
  });

  let labor = 0;
  let expenses = 0;
  let overtime = 0;
  const reportIds: string[] = [];
  const overtimeRate = Number(opts.overtimeHourlyRate) || 0;

  for (const r of periodReports) {
    reportIds.push(r.id);
    const asg = assignments.find((a) => a.id === r.assignment);
    labor += Number(asg?.guide_fee_amount) || 0;
    expenses += Number(r.actual_expenses_jpy) || Number(asg?.guide_expenses_amount) || 0;
    if (r.extra_hours_approved && asg) {
      const scheduled = Number(asg.tour_duration_hours) || 0;
      const actual = Number(r.actual_hours_worked) || 0;
      const extra = Math.max(0, actual - scheduled);
      overtime += extra * overtimeRate;
    }
  }

  const tax = Math.max(0, Number(opts.taxWithholding) || 0);
  const net = labor + expenses + overtime - tax;

  const payload = {
    guide: guideId,
    billing_period: period,
    total_tours_completed: periodReports.length,
    total_labor_fees: labor,
    total_reimbursed_expenses: expenses,
    overtime_adjustments: overtime,
    tax_withholding_amount: tax,
    final_net_payout: net,
    currency: opts.currency || "JPY",
    included_report_ids: reportIds,
    status: "draft",
  };

  try {
    const existing = await pb
      .collection("guide_monthly_settlements")
      .getFirstListItem<GuideMonthlySettlement>(
        `guide="${guideId}" && billing_period="${period}"`,
        { requestKey: null }
      );
    return (await pb
      .collection("guide_monthly_settlements")
      .update(existing.id, payload, {
        requestKey: null,
      })) as GuideMonthlySettlement;
  } catch {
    return (await pb
      .collection("guide_monthly_settlements")
      .create(payload, { requestKey: null })) as GuideMonthlySettlement;
  }
}

export async function markSettlementPaid(
  pb: PocketBase,
  settlementId: string,
  bankRef?: string
): Promise<GuideMonthlySettlement> {
  const row = await pb
    .collection("guide_monthly_settlements")
    .getOne<GuideMonthlySettlement & { included_report_ids?: string[] }>(
      settlementId,
      { requestKey: null }
    );

  const updated = (await pb.collection("guide_monthly_settlements").update(
    settlementId,
    {
      status: "paid",
      paid_at: new Date().toISOString().slice(0, 10),
      bank_payment_reference: bankRef || "",
    },
    { requestKey: null }
  )) as GuideMonthlySettlement;

  const reportIds = Array.isArray(row.included_report_ids)
    ? row.included_report_ids
    : [];
  for (const rid of reportIds) {
    try {
      const report = await pb.collection("tour_completion_reports").getOne<{
        assignment: string;
        pnr?: string;
      }>(rid, { requestKey: null });
      const asg = await pb
        .collection("itinerary_guide_assignments")
        .getOne<{ id: string; staff_id?: string; pnr?: string }>(
          report.assignment,
          { requestKey: null }
        );
      await pb.collection("itinerary_guide_assignments").update(
        asg.id,
        { payout_status: "paid" },
        { requestKey: null }
      );
      if (asg.staff_id && asg.pnr) {
        await upsertPayout(pb, {
          pnr: asg.pnr,
          staffId: asg.staff_id,
          role: "guide",
          status: "paid",
        });
      }
    } catch {
      /* continue */
    }
  }

  return updated;
}

export type AgencyMonthlyInvoice = {
  id: string;
  agency: string;
  invoice_number: string;
  billing_period: string;
  included_pnrs?: string[];
  line_items?: unknown;
  subtotal_amount?: number;
  agency_commission_deducted?: number;
  total_amount_due?: number;
  currency?: string;
  invoice_status?: string;
};

export async function generateAgencyMonthlyInvoice(
  pb: PocketBase,
  opts: {
    agencyId: string;
    billingPeriod: string;
    currency?: "EUR" | "JPY";
    lineItems: { pnr: string; amount: number; title?: string }[];
    commissionPct?: number;
  }
): Promise<AgencyMonthlyInvoice> {
  const agencyId = String(opts.agencyId || "").trim();
  const period = String(opts.billingPeriod || "").trim();
  if (!agencyId || !period) throw new Error("agencyId and billingPeriod required");

  let commissionPct = Number(opts.commissionPct);
  if (!Number.isFinite(commissionPct)) {
    try {
      const ag = await pb.collection("agencies").getOne<{
        commission_rate_percentage?: number;
      }>(agencyId, { requestKey: null });
      commissionPct = Number(ag.commission_rate_percentage) || 0;
    } catch {
      commissionPct = 0;
    }
  }

  const subtotal = opts.lineItems.reduce(
    (s, li) => s + (Number(li.amount) || 0),
    0
  );
  const commission = Math.round((subtotal * commissionPct) / 100);
  const due = Math.max(0, subtotal - commission);
  const pnrs = opts.lineItems.map((li) => li.pnr);
  const invoiceNumber = `INV-${period}-${agencyId.slice(0, 4).toUpperCase()}`;

  const issue = new Date();
  const dueDate = new Date(issue);
  dueDate.setDate(dueDate.getDate() + 30);

  const payload = {
    agency: agencyId,
    invoice_number: invoiceNumber,
    billing_period: period,
    included_pnrs: pnrs,
    line_items: opts.lineItems,
    subtotal_amount: subtotal,
    agency_commission_deducted: commission,
    total_amount_due: due,
    currency: opts.currency || "EUR",
    issue_date: issue.toISOString().slice(0, 10),
    due_date: dueDate.toISOString().slice(0, 10),
    invoice_status: "draft",
  };

  try {
    const existing = await pb
      .collection("agency_monthly_invoices")
      .getFirstListItem<AgencyMonthlyInvoice>(
        `agency="${agencyId}" && billing_period="${period}"`,
        { requestKey: null }
      );
    return (await pb
      .collection("agency_monthly_invoices")
      .update(existing.id, payload, {
        requestKey: null,
      })) as AgencyMonthlyInvoice;
  } catch {
    return (await pb
      .collection("agency_monthly_invoices")
      .create(payload, { requestKey: null })) as AgencyMonthlyInvoice;
  }
}
