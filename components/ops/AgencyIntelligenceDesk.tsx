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
  Briefcase,
  Building2,
  CheckCircle2,
  RefreshCw,
  Wallet,
  X,
} from "lucide-react";
import { BoxGradingGlow } from "@/components/branding/BoxGradingGlow";
import {
  loadOpsHub,
  type OpsHubRow,
} from "@/components/staff/opsHubClient";
import {
  StaffPortalShell,
  STAFF_PORTAL_REFRESH_EVENT,
} from "@/components/staff/StaffPortalShell";
import {
  buildAgencyIntelligenceSnapshot,
  filterAgencyOrders,
  formatAgencyEur,
  type AgencyCardStats,
  type AgencyIntelligenceKpis,
  type AgencyOrderCard,
  type AgencyOrderFilter,
  type AgencyOrderRaw,
  type AgencyPartnerRow,
} from "@/lib/agencyIntelligenceDesk";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import type { AgencyMonthlyInvoice } from "@/lib/pricing/settlements";
import { canAccessOpsBoard } from "@/lib/staffRoles";
import { useTeamAuth } from "@/store/useTeamAuth";

const FILTER_TABS: { id: AgencyOrderFilter; label: string }[] = [
  { id: "all", label: "All Orders" },
  { id: "pending_payment", label: "Pending Payment" },
  { id: "paid_active", label: "Paid / Active" },
  { id: "completed", label: "Completed / Closed" },
];

function statusTone(status: string): string {
  switch (status) {
    case "confirmed":
    case "in_ops":
      return "border-sky-500/40 bg-sky-500/15 text-sky-200";
    case "done":
      return "border-emerald-500/40 bg-emerald-500/15 text-emerald-200";
    case "cancelled":
      return "border-zinc-600/50 bg-zinc-800/60 text-zinc-400";
    case "quoted":
      return "border-amber-500/40 bg-amber-500/15 text-amber-200";
    default:
      return "border-white/10 bg-white/5 text-zinc-300";
  }
}

function payTone(pay: AgencyOrderCard["tourPaymentStatus"]): string {
  switch (pay) {
    case "FULLY_PAID":
      return "border-emerald-500/40 bg-emerald-500/15 text-emerald-200";
    case "PARTIALLY_PAID":
      return "border-amber-500/40 bg-amber-500/15 text-amber-200";
    case "FEE_PAID":
      return "border-sky-500/40 bg-sky-500/15 text-sky-200";
    case "UNPAID":
      return "border-red-500/35 bg-red-500/10 text-red-200";
    default:
      return "border-zinc-600/50 bg-zinc-800/60 text-zinc-400";
  }
}

function accountTone(status?: string): string {
  const s = String(status || "Active").toLowerCase();
  if (s.includes("suspend"))
    return "border-red-500/40 bg-red-500/10 text-red-200";
  if (s.includes("pending"))
    return "border-amber-500/40 bg-amber-500/15 text-amber-200";
  return "border-emerald-500/35 bg-emerald-500/10 text-emerald-200";
}

/**
 * Executive Agency Intelligence & Revenue Desk for Ops Super Users.
 * Does not replace /agency portal inquire flow — complements it for owners/ops.
 */
export function AgencyIntelligenceDesk() {
  return (
    <StaffPortalShell
      title="Agency Intelligence · Revenue"
      allow={canAccessOpsBoard}
      wide
    >
      <AgencyIntelligenceInner />
    </StaffPortalShell>
  );
}

function AgencyIntelligenceInner() {
  const getClient = useTeamAuth((s) => s.getClient);
  const [agencies, setAgencies] = useState<AgencyPartnerRow[]>([]);
  const [ordersRaw, setOrdersRaw] = useState<AgencyOrderRaw[]>([]);
  const [hubs, setHubs] = useState<OpsHubRow[]>([]);
  const [invoices, setInvoices] = useState<AgencyMonthlyInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [listFilter, setListFilter] = useState<AgencyOrderFilter>("all");
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(
    null
  );
  const [createOpen, setCreateOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pb = getClient();
      const [agencyList, orderList, hubList, invoiceList] = await Promise.all([
        pb
          .collection("agencies")
          .getFullList<AgencyPartnerRow>({
            sort: "name",
            requestKey: null,
          })
          .catch(() => [] as AgencyPartnerRow[]),
        pb
          .collection("agency_orders")
          .getFullList<AgencyOrderRaw>({
            sort: "-created",
            requestKey: null,
          })
          .catch(() => [] as AgencyOrderRaw[]),
        loadOpsHub(pb).catch(() => [] as OpsHubRow[]),
        pb
          .collection("agency_monthly_invoices")
          .getFullList<AgencyMonthlyInvoice>({
            sort: "-billing_period",
            requestKey: null,
          })
          .catch(() => [] as AgencyMonthlyInvoice[]),
      ]);
      setAgencies(agencyList);
      setOrdersRaw(orderList);
      setHubs(hubList);
      setInvoices(invoiceList);
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

  const snapshot = useMemo(
    () =>
      buildAgencyIntelligenceSnapshot({
        agencies,
        orders: ordersRaw,
        hubs,
        invoices,
      }),
    [agencies, ordersRaw, hubs, invoices]
  );

  const filteredOrders = useMemo(
    () => filterAgencyOrders(snapshot.orders, listFilter, query),
    [snapshot.orders, listFilter, query]
  );

  const selectedCard =
    snapshot.agencyCards.find((c) => c.agency.id === selectedAgencyId) ||
    null;

  if (loading && agencies.length === 0 && ordersRaw.length === 0) {
    return (
      <p className="py-16 text-sm text-zinc-400">
        Loading agency intelligence…
      </p>
    );
  }

  if (error && agencies.length === 0 && ordersRaw.length === 0) {
    return <p className="py-16 text-sm text-red-400">{error}</p>;
  }

  return (
    <div className="space-y-4 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.28em] text-[#075473] uppercase">
            Super User · Agency intelligence
          </p>
          <p className="mt-1 max-w-xl text-sm text-zinc-400">
            Partner workload and B2B revenue from{" "}
            <code className="text-zinc-300">agencies</code>,{" "}
            <code className="text-zinc-300">agency_orders</code>, and{" "}
            <code className="text-zinc-300">ops_hub</code> payment lanes. Agency
            inquire stays on{" "}
            <Link href="/agency" className="text-[#7dd3fc] hover:underline">
              /agency
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCreateOpen((v) => !v)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 hover:bg-white/10"
          >
            {createOpen ? "Hide register" : "Register agency"}
          </button>
          <button
            type="button"
            onClick={() => void reload()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 hover:bg-white/10"
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
            Refresh
          </button>
          <input
            type="search"
            placeholder="Agency / PNR / guest…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-48 rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600"
          />
        </div>
      </header>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <CompactKpiBar kpis={snapshot.kpis} />

      {createOpen ? (
        <RegisterAgencyPanel
          getClient={getClient}
          onCreated={() => {
            setCreateOpen(false);
            void reload();
          }}
        />
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[11px] font-bold tracking-[0.2em] text-[#F6A724] uppercase">
            Partner agencies
          </h2>
          <p className="text-[11px] text-zinc-500">
            {snapshot.agencyCards.length} partners · click a card for workload
            drawer
          </p>
        </div>
        {snapshot.agencyCards.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-xs text-zinc-500">
            No agencies registered yet. Use Register agency or Team Access.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {snapshot.agencyCards.map((card) => {
              const active = card.agency.id === selectedAgencyId;
              return (
                <li key={card.agency.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedAgencyId(
                        active ? null : card.agency.id
                      )
                    }
                    className={`relative w-full overflow-hidden rounded-2xl border px-3.5 py-3 text-left transition ${
                      active
                        ? "border-[#075473]/60 bg-[#075473]/20"
                        : "border-white/10 bg-[#0D1117]/70 hover:border-white/20 hover:bg-white/[0.04]"
                    }`}
                  >
                    <BoxGradingGlow />
                    <div className="relative z-10 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {card.agency.name}
                          </p>
                          <p className="truncate text-[11px] text-zinc-500">
                            {card.agency.code ||
                              card.agency.contact_email ||
                              card.agency.ops_contact_email ||
                              "No code / email"}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${accountTone(card.agency.account_status)}`}
                        >
                          {card.agency.account_status || "Active"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-zinc-400">
                        <span>
                          <span className="tabular-nums text-zinc-200">
                            {card.activeCount}
                          </span>{" "}
                          active
                        </span>
                        <span>
                          <span className="tabular-nums text-zinc-200">
                            {card.orderCount}
                          </span>{" "}
                          bookings
                        </span>
                        <span>
                          {card.commissionRate > 0
                            ? `${card.commissionRate}% commission`
                            : "No commission rate"}
                        </span>
                      </div>
                      <div className="flex flex-wrap justify-between gap-2 text-[11px]">
                        <span className="text-zinc-500">
                          Paid{" "}
                          <span className="font-mono text-emerald-300/90">
                            {formatAgencyEur(card.paidEur)}
                          </span>
                        </span>
                        <span className="text-zinc-500">
                          Pending{" "}
                          <span className="font-mono text-amber-300/90">
                            {formatAgencyEur(card.pendingEur)}
                          </span>
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="shrink-0 text-[11px] font-bold tracking-[0.2em] text-[#F6A724] uppercase">
            Agency orders master
          </h2>
          <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-black/25 p-0.5">
            {FILTER_TABS.map((tab) => {
              const active = listFilter === tab.id;
              const count = snapshot.filterCounts[tab.id];
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
          Showing{" "}
          {selectedAgencyId
            ? filteredOrders.filter(
                (o) =>
                  o.agencyId === selectedAgencyId ||
                  (selectedCard &&
                    o.agencyName.toLowerCase() ===
                      selectedCard.agency.name.toLowerCase())
              ).length
            : filteredOrders.length}
          {selectedAgencyId ? " for selected agency" : ""}
        </p>
      </div>

      <OrdersMasterTable
        orders={
          selectedAgencyId
            ? filteredOrders.filter(
                (o) =>
                  o.agencyId === selectedAgencyId ||
                  (selectedCard &&
                    o.agencyName.toLowerCase() ===
                      selectedCard.agency.name.toLowerCase())
              )
            : filteredOrders
        }
        onOpenAgency={(agencyId) => {
          if (agencyId) setSelectedAgencyId(agencyId);
        }}
      />

      {selectedCard ? (
        <AgencyWorkloadDrawer
          card={selectedCard}
          onClose={() => setSelectedAgencyId(null)}
        />
      ) : null}
    </div>
  );
}

function CompactKpiBar({ kpis }: { kpis: AgencyIntelligenceKpis }) {
  const items: {
    label: string;
    value: string;
    icon: ReactNode;
    accent?: "warn" | "ok";
  }[] = [
    {
      label: "Partner agencies",
      value: String(kpis.partnerAgencies),
      icon: <Building2 className="h-3.5 w-3.5" strokeWidth={2} />,
    },
    {
      label: "Bookings / active B2B",
      value: `${kpis.totalBookings} / ${kpis.activeB2bOrders}`,
      icon: <Briefcase className="h-3.5 w-3.5" strokeWidth={2} />,
    },
    {
      label: "Pending receivables",
      value: formatAgencyEur(kpis.pendingReceivablesEur),
      icon: <Wallet className="h-3.5 w-3.5" strokeWidth={2} />,
      accent: "warn",
    },
    {
      label: "Settled agency revenue",
      value: formatAgencyEur(kpis.settledRevenueEur),
      icon: <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />,
      accent: "ok",
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
                  item.accent === "warn"
                    ? "text-amber-300"
                    : item.accent === "ok"
                      ? "text-emerald-300"
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

function OrdersMasterTable({
  orders,
  onOpenAgency,
}: {
  orders: AgencyOrderCard[];
  onOpenAgency: (agencyId: string) => void;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]/70">
      <BoxGradingGlow />
      <div className="relative z-10 overflow-x-auto">
        {orders.length === 0 ? (
          <p className="px-4 py-10 text-center text-xs text-zinc-500">
            No agency orders in this filter.
          </p>
        ) : (
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[10px] tracking-wider text-zinc-500 uppercase">
                <th className="px-3 py-2.5 font-semibold">PNR</th>
                <th className="px-3 py-2.5 font-semibold">Agency</th>
                <th className="px-3 py-2.5 font-semibold">Guest</th>
                <th className="px-3 py-2.5 font-semibold">City / date</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 font-semibold">Payment</th>
                <th className="px-3 py-2.5 font-semibold text-right">Paid</th>
                <th className="px-3 py-2.5 font-semibold text-right">Pending</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-white/[0.03]">
                  <td className="px-3 py-2">
                    {o.hubId ? (
                      <Link
                        href={`/ops/booking?pnr=${encodeURIComponent(o.pnr)}`}
                        className="font-mono text-[11px] font-semibold text-[#7dd3fc] hover:underline"
                      >
                        {o.pnr || "—"}
                      </Link>
                    ) : (
                      <span className="font-mono text-[11px] font-semibold text-white">
                        {o.pnr || "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {o.agencyId ? (
                      <button
                        type="button"
                        onClick={() => onOpenAgency(o.agencyId)}
                        className="truncate text-left text-zinc-200 hover:text-white"
                      >
                        {o.agencyName}
                      </button>
                    ) : (
                      <span className="text-zinc-400">{o.agencyName}</span>
                    )}
                  </td>
                  <td className="max-w-[160px] truncate px-3 py-2 text-zinc-400">
                    {o.guestLabel}
                  </td>
                  <td className="px-3 py-2 text-zinc-400">
                    {[o.primaryCity || "—", o.tourDate || "No date"].join(
                      " · "
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${statusTone(o.status)}`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${payTone(o.tourPaymentStatus)}`}
                    >
                      {o.tourPaymentStatus === "UNKNOWN"
                        ? "—"
                        : o.tourPaymentStatus.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-zinc-300">
                    {o.paidEur > 0 ? formatAgencyEur(o.paidEur) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-amber-300/80">
                    {o.pendingEur > 0 ? formatAgencyEur(o.pendingEur) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function AgencyWorkloadDrawer({
  card,
  onClose,
}: {
  card: AgencyCardStats;
  onClose: () => void;
}) {
  const a = card.agency;
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={`Workload for ${a.name}`}
      onClick={onClose}
    >
      <aside
        className="relative flex h-full w-full max-w-md flex-col overflow-hidden border-l border-white/10 bg-[#0D1117] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <BoxGradingGlow />
        <div className="relative z-10 flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.22em] text-[#075473] uppercase">
              Workload & revenue
            </p>
            <h3 className="truncate font-display text-lg text-white">
              {a.name}
            </h3>
            <p className="truncate text-[11px] text-zinc-500">
              {a.code ? `${a.code} · ` : ""}
              {a.preferred_currency || "EUR"}
              {a.commission_rate_percentage != null
                ? ` · ${a.commission_rate_percentage}% commission`
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white"
            aria-label="Close drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative z-10 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["Active tours", String(card.activeCount)],
                ["Total bookings", String(card.orderCount)],
                ["Paid", formatAgencyEur(card.paidEur)],
                ["Pending", formatAgencyEur(card.pendingEur)],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-white/10 bg-black/25 px-3 py-2"
              >
                <p className="text-[9px] font-bold tracking-[0.14em] text-[#F6A724] uppercase">
                  {label}
                </p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-white tabular-nums">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <section className="space-y-2">
            <h4 className="text-[10px] font-bold tracking-[0.18em] text-zinc-500 uppercase">
              Contacts
            </h4>
            <dl className="space-y-1.5 text-[11px]">
              <ContactLine label="Main" value={a.contact_email || a.phone} />
              <ContactLine
                label="Ops"
                value={[a.ops_contact_name, a.ops_contact_email, a.ops_contact_phone]
                  .filter(Boolean)
                  .join(" · ")}
              />
              <ContactLine
                label="Billing"
                value={[
                  a.billing_contact_name,
                  a.billing_contact_email,
                  a.billing_contact_phone,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
              <ContactLine label="Terms" value={a.payment_terms} />
              <ContactLine label="Method" value={a.payment_method} />
              <ContactLine
                label="Address"
                value={[a.address, a.country].filter(Boolean).join(", ")}
              />
            </dl>
          </section>

          <section className="space-y-2">
            <h4 className="text-[10px] font-bold tracking-[0.18em] text-zinc-500 uppercase">
              PNRs ({card.orders.length})
            </h4>
            {card.orders.length === 0 ? (
              <p className="text-xs text-zinc-500">No linked agency orders.</p>
            ) : (
              <ul className="space-y-1.5">
                {card.orders.map((o) => (
                  <li
                    key={o.id}
                    className="rounded-xl border border-white/10 bg-black/25 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      {o.hubId ? (
                        <Link
                          href={`/ops/booking?pnr=${encodeURIComponent(o.pnr)}`}
                          className="font-mono text-xs font-semibold text-[#7dd3fc] hover:underline"
                        >
                          {o.pnr}
                        </Link>
                      ) : (
                        <span className="font-mono text-xs font-semibold text-white">
                          {o.pnr || "—"}
                        </span>
                      )}
                      <span
                        className={`rounded border px-1 py-0.5 text-[9px] font-semibold uppercase ${statusTone(o.status)}`}
                      >
                        {o.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-zinc-400">
                      {o.tourDate || "No date"} · {o.primaryCity || "—"} ·{" "}
                      {o.guestLabel}
                    </p>
                    <p className="mt-0.5 text-[10px] text-zinc-500">
                      Paid {formatAgencyEur(o.paidEur)} · Pending{" "}
                      {formatAgencyEur(o.pendingEur)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}

function ContactLine({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  const v = String(value || "").trim();
  if (!v) return null;
  return (
    <div className="flex gap-2">
      <dt className="w-14 shrink-0 text-zinc-600">{label}</dt>
      <dd className="min-w-0 break-words text-zinc-300">{v}</dd>
    </div>
  );
}

function RegisterAgencyPanel({
  getClient,
  onCreated,
}: {
  getClient: () => import("pocketbase").default;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [commission, setCommission] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]/70 p-4">
      <BoxGradingGlow />
      <div className="relative z-10 space-y-3">
        <h2 className="text-sm font-semibold text-white">Register partner agency</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-[10px] tracking-wider text-zinc-500 uppercase">
            Name
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Agency legal name"
            />
          </label>
          <label className="block text-[10px] tracking-wider text-zinc-500 uppercase">
            Code
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Short code"
            />
          </label>
          <label className="block text-[10px] tracking-wider text-zinc-500 uppercase">
            Contact email
            <input
              type="email"
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-[10px] tracking-wider text-zinc-500 uppercase">
            Commission %
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white"
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
            />
          </label>
        </div>
        {err ? <p className="text-xs text-red-400">{err}</p> : null}
        {msg ? <p className="text-xs text-[#7dd3fc]">{msg}</p> : null}
        <button
          type="button"
          disabled={saving || !name.trim()}
          className="rounded-lg bg-[#075473] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
          onClick={async () => {
            setSaving(true);
            setErr(null);
            setMsg(null);
            try {
              await getClient().collection("agencies").create(
                {
                  name: name.trim(),
                  code: code.trim(),
                  contact_email: email.trim().toLowerCase() || undefined,
                  commission_rate_percentage: Number(commission) || 0,
                  account_status: "Active",
                  preferred_currency: "EUR",
                  active: true,
                },
                { requestKey: null }
              );
              setMsg("Agency registered.");
              setName("");
              setCode("");
              setEmail("");
              setCommission("");
              onCreated();
            } catch (e) {
              setErr(formatPbError(e));
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving…" : "Create agency"}
        </button>
      </div>
    </section>
  );
}
