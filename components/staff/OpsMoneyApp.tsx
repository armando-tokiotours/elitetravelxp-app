"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  loadAllMoney,
  updateMoneyByPnr,
  type GuestPayStatus,
  type OpsMoneyRow,
} from "@/lib/opsMoney";
import {
  loadAllPayouts,
  upsertPayout,
  type OpsPayoutRow,
  type PayoutStatus,
} from "@/lib/opsPayouts";
import type { OpsDispatchRow } from "@/lib/opsDispatch";
import { canAccessMoney } from "@/lib/staffRoles";
import { useTeamAuth } from "@/store/useTeamAuth";
import { StaffPortalShell } from "@/components/staff/StaffPortalShell";
import {
  generateAgencyMonthlyInvoice,
  generateGuideMonthlySettlement,
  markSettlementPaid,
  type AgencyMonthlyInvoice,
  type GuideMonthlySettlement,
} from "@/lib/pricing/settlements";

const GUEST_STATUSES: GuestPayStatus[] = [
  "unpaid",
  "deposit_10",
  "deposit_30",
  "paid",
  "refunded",
  "partial_refund",
];

export function OpsMoneyApp() {
  return (
    <StaffPortalShell title="Money & pay" allow={canAccessMoney}>
      <MoneyInner />
    </StaffPortalShell>
  );
}

function MoneyInner() {
  const getClient = useTeamAuth((s) => s.getClient);
  const [rows, setRows] = useState<OpsMoneyRow[]>([]);
  const [payouts, setPayouts] = useState<OpsPayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

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
      setRows(await loadAllMoney(pb));
      setPayouts(await loadAllPayouts(pb));
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

  const syncPayoutsFromMoney = async (
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

  if (loading) return <p className="text-sm text-zinc-400">Loading…</p>;
  if (error) return <p className="text-sm text-red-400">{error}</p>;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <p className="max-w-2xl text-sm text-zinc-400">
          Guest money pocket (ops_money). Saving guide/driver pay also updates
          ops_payouts so staff see amount + pending/paid on their portal.
        </p>
        {msg ? <p className="text-sm text-[#075473]">{msg}</p> : null}
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-950 text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2">PNR</th>
                <th className="px-3 py-2">Guide</th>
                <th className="px-3 py-2">Guest pay</th>
                <th className="px-3 py-2">Paid / refund</th>
                <th className="px-3 py-2">Tours</th>
                <th className="px-3 py-2">Guide pay</th>
                <th className="px-3 py-2">Driver pay</th>
                <th className="px-3 py-2">Tickets</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-8 text-center text-zinc-500"
                  >
                    No money rows yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <MoneyRow
                    key={row.id}
                    row={row}
                    saving={savingId === row.id}
                    onSave={async (patch) => {
                      setSavingId(row.id);
                      setMsg(null);
                      try {
                        await updateMoneyByPnr(getClient(), row.pnr, patch);
                        await syncPayoutsFromMoney(
                          row.pnr,
                          Number(patch.guide_pay_jpy) || 0,
                          Number(patch.driver_pay_jpy) || 0
                        );
                        setMsg(`Saved ${row.pnr}`);
                        await reload();
                      } catch (e) {
                        setMsg(formatPbError(e));
                      } finally {
                        setSavingId(null);
                      }
                    }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-lg text-white">Staff payouts</h2>
        <p className="text-sm text-zinc-400">
          Per-PNR earnings guide/driver can see (ops_payouts). Mark paid when
          transferred.
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
                    No payouts — assign guide/driver then save money amounts.
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
        <p className="mt-1 text-xs text-zinc-500">
          Aggregates verified completion reports for a billing period.
        </p>
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

function MoneyRow({
  row,
  saving,
  onSave,
}: {
  row: OpsMoneyRow;
  saving: boolean;
  onSave: (patch: Partial<OpsMoneyRow>) => Promise<void>;
}) {
  const [tourCount, setTourCount] = useState(String(row.tour_count ?? ""));
  const [guidePay, setGuidePay] = useState(String(row.guide_pay_jpy ?? ""));
  const [driverPay, setDriverPay] = useState(String(row.driver_pay_jpy ?? ""));
  const [ticketCost, setTicketCost] = useState(
    String(row.ticket_cost_jpy ?? "")
  );
  const [guestStatus, setGuestStatus] = useState(
    String(row.guest_pay_status || "unpaid")
  );
  const [guestPaid, setGuestPaid] = useState(String(row.guest_paid_jpy ?? ""));
  const [guestRefund, setGuestRefund] = useState(
    String(row.guest_refund_jpy ?? "")
  );

  return (
    <tr className="border-b border-zinc-900/80 align-top">
      <td className="px-3 py-3 font-mono text-xs text-white">{row.pnr}</td>
      <td className="px-3 py-3 text-xs text-zinc-400">
        {row.assigned_guide || "—"}
      </td>
      <td className="px-3 py-3">
        <select
          className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
          value={guestStatus}
          onChange={(e) => setGuestStatus(e.target.value)}
        >
          {GUEST_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-col gap-1">
          <input
            type="number"
            min={0}
            placeholder="paid"
            className="w-24 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
            value={guestPaid}
            onChange={(e) => setGuestPaid(e.target.value)}
          />
          <input
            type="number"
            min={0}
            placeholder="refund"
            className="w-24 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
            value={guestRefund}
            onChange={(e) => setGuestRefund(e.target.value)}
          />
        </div>
      </td>
      <td className="px-3 py-3">
        <input
          type="number"
          min={0}
          className="w-16 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
          value={tourCount}
          onChange={(e) => setTourCount(e.target.value)}
        />
      </td>
      <td className="px-3 py-3">
        <input
          type="number"
          min={0}
          className="w-24 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
          value={guidePay}
          onChange={(e) => setGuidePay(e.target.value)}
        />
      </td>
      <td className="px-3 py-3">
        <input
          type="number"
          min={0}
          className="w-24 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
          value={driverPay}
          onChange={(e) => setDriverPay(e.target.value)}
        />
      </td>
      <td className="px-3 py-3">
        <input
          type="number"
          min={0}
          className="w-24 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
          value={ticketCost}
          onChange={(e) => setTicketCost(e.target.value)}
        />
      </td>
      <td className="px-3 py-3">
        <button
          type="button"
          disabled={saving}
          className="rounded-lg bg-[#075473] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          onClick={() =>
            void onSave({
              tour_count: Number(tourCount) || 0,
              guide_pay_jpy: Number(guidePay) || 0,
              driver_pay_jpy: Number(driverPay) || 0,
              ticket_cost_jpy: Number(ticketCost) || 0,
              guest_pay_status: guestStatus as GuestPayStatus,
              guest_paid_jpy: Number(guestPaid) || 0,
              guest_refund_jpy: Number(guestRefund) || 0,
            })
          }
        >
          {saving ? "…" : "Save"}
        </button>
      </td>
    </tr>
  );
}
