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
  CalendarClock,
  FileUp,
  Lock,
  RefreshCw,
  ShoppingCart,
  Ticket,
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
import { TicketVoucherUploadPanel } from "@/components/staff/TicketVoucherUploadPanel";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import { canAccessOpsBoard } from "@/lib/staffRoles";
import {
  buildTicketsMasterSnapshot,
  countByTicketsMasterFilter,
  filterTicketsMasterCards,
  type TicketsMasterCard,
  type TicketsMasterFilter,
  type TicketsMasterGuestLookup,
  type TicketsMasterKpis,
} from "@/lib/ticketsMasterDesk";
import { useTeamAuth } from "@/store/useTeamAuth";

const FILTER_TABS: { id: TicketsMasterFilter; label: string }[] = [
  { id: "ready_to_buy", label: "Ready to buy" },
  { id: "payment_locked", label: "Payment locked" },
  { id: "awaiting_pdf", label: "Awaiting PDF" },
  { id: "completed", label: "Completed" },
  { id: "all", label: "All" },
];

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

function bucketTone(bucket: TicketsMasterCard["bucket"]): string {
  switch (bucket) {
    case "ready_to_buy":
      return "border-emerald-500/35 bg-emerald-500/10 text-emerald-200";
    case "payment_locked":
      return "border-red-500/40 bg-red-500/10 text-red-200";
    case "awaiting_pdf":
      return "border-amber-500/35 bg-amber-500/10 text-amber-200";
    case "completed":
      return "border-zinc-500/35 bg-zinc-500/10 text-zinc-300";
    default:
      return "border-white/10 bg-white/5 text-zinc-400";
  }
}

function bucketLabel(bucket: TicketsMasterCard["bucket"]): string {
  switch (bucket) {
    case "ready_to_buy":
      return "Ready to buy";
    case "payment_locked":
      return "Payment locked";
    case "awaiting_pdf":
      return "Awaiting PDF";
    case "completed":
      return "Done";
    default:
      return bucket;
  }
}

/**
 * Executive Ticket Procurement Command Center for Ops Manager / Owner.
 * Split master-detail mirrors the Money desk; uploads via POST /api/tickets/voucher.
 */
export function TicketsMasterDesk() {
  return (
    <StaffPortalShell
      title="Tickets Master · Procurement"
      allow={canAccessOpsBoard}
      wide
    >
      <TicketsMasterInner />
    </StaffPortalShell>
  );
}

function TicketsMasterInner() {
  const getClient = useTeamAuth((s) => s.getClient);
  const [hubs, setHubs] = useState<OpsHubRow[]>([]);
  const [guestsByPnr, setGuestsByPnr] = useState<
    Record<string, TicketsMasterGuestLookup>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [listFilter, setListFilter] =
    useState<TicketsMasterFilter>("ready_to_buy");
  const [selectedPnr, setSelectedPnr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pb = getClient();
      const hubList = await loadOpsHub(pb);
      setHubs(hubList);

      const guests: Record<string, TicketsMasterGuestLookup> = {};
      try {
        const bals = await pb.collection("bookings_and_leads").getFullList<{
          booking_ref?: string;
          email?: string;
          full_name?: string;
          name?: string;
          guest_name?: string;
          guest_summary?: string;
          pax_count?: number;
          adults?: number;
          children?: number;
        }>({ requestKey: null });
        for (const bal of bals) {
          const ref = String(bal.booking_ref || "")
            .trim()
            .toUpperCase();
          if (!ref) continue;
          const paxBits: string[] = [];
          if (bal.pax_count != null && Number(bal.pax_count) > 0) {
            paxBits.push(`${bal.pax_count} pax`);
          } else {
            const a = Number(bal.adults) || 0;
            const c = Number(bal.children) || 0;
            if (a || c) {
              paxBits.push(
                [a ? `${a}A` : null, c ? `${c}K` : null]
                  .filter(Boolean)
                  .join("/")
              );
            }
          }
          guests[ref] = {
            name: String(
              bal.full_name || bal.guest_name || bal.name || ""
            ).trim(),
            email: String(bal.email || "")
              .trim()
              .toLowerCase(),
            paxSummary:
              paxBits.join(" · ") ||
              String(bal.guest_summary || "").trim() ||
              undefined,
          };
        }
      } catch {
        /* optional guest enrich */
      }
      setGuestsByPnr(guests);
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
    () => buildTicketsMasterSnapshot({ hubs, guestsByPnr }),
    [hubs, guestsByPnr]
  );

  const filterCounts = useMemo(
    () => countByTicketsMasterFilter(snapshot.cards),
    [snapshot.cards]
  );

  const filteredCards = useMemo(() => {
    const byTab = filterTicketsMasterCards(snapshot.cards, listFilter);
    const q = query.trim().toUpperCase();
    if (!q) return byTab;
    return byTab.filter(
      (c) =>
        c.pnr.includes(q) ||
        c.guestName.toUpperCase().includes(q) ||
        c.guestEmail.toUpperCase().includes(q) ||
        c.primaryCity.toUpperCase().includes(q)
    );
  }, [snapshot.cards, listFilter, query]);

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
  const selectedHub = selectedCard
    ? hubs.find(
        (h) =>
          String(h.pnr || "")
            .trim()
            .toUpperCase() === selectedCard.pnr
      ) || null
    : null;

  if (loading && hubs.length === 0) {
    return (
      <p className="py-16 text-sm text-zinc-400">Loading ticket procurement…</p>
    );
  }

  if (error && hubs.length === 0) {
    return <p className="py-16 text-sm text-red-400">{error}</p>;
  }

  return (
    <div className="space-y-4 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.28em] text-[#075473] uppercase">
            Super User · Ticket procurement
          </p>
          <p className="mt-1 max-w-xl text-sm text-zinc-400">
            Buy queue locked until{" "}
            <code className="text-zinc-300">tour_payment_status</code> hits
            30% / partial / full · vouchers via{" "}
            <code className="text-zinc-300">POST /api/tickets/voucher</code>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            placeholder="Search PNR / guest…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-44 rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600"
          />
        </div>
      </header>

      <CompactKpiBar kpis={snapshot.kpis} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="shrink-0 text-[11px] font-bold tracking-[0.2em] text-[#F6A724] uppercase">
            PNR procurement queue
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
          Showing {filteredCards.length} · sorted by earliest target date
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-start">
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
                  return (
                    <li key={card.hubId}>
                      <button
                        type="button"
                        onClick={() => setSelectedPnr(card.pnr)}
                        className={`flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition ${
                          active ? "bg-[#075473]/25" : "hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-semibold text-white">
                            {card.pnr}
                          </span>
                          {card.bucket === "payment_locked" ? (
                            <span className="inline-flex items-center gap-0.5 rounded border border-red-500/40 bg-red-500/10 px-1 py-0.5 text-[9px] font-semibold uppercase text-red-200">
                              <Lock className="h-2.5 w-2.5" />
                              Locked
                            </span>
                          ) : (
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
                          )}
                        </div>
                        <p className="truncate text-[11px] text-zinc-300">
                          {card.guestName}
                        </p>
                        <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-500">
                          <span>
                            {card.earliestTargetDate || "No date"} ·{" "}
                            {card.primaryCity}
                          </span>
                          <span className="tabular-nums text-zinc-400">
                            {card.pendingItemCount > 0
                              ? `${card.pendingItemCount} open`
                              : "clear"}
                          </span>
                        </div>
                        {card.bonusItemCount > 0 ? (
                          <p className="text-[9px] text-purple-300/90">
                            {card.bonusItemCount} bonus gift
                          </p>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <section className="lg:col-span-8 xl:col-span-9">
          {selectedCard && selectedHub ? (
            <PnrProcurementDetail
              card={selectedCard}
              hub={selectedHub}
              onReload={reload}
            />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-[#0D1117]/50 px-6 py-16 text-center text-sm text-zinc-500">
              Select a PNR to open its procurement checklist.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function CompactKpiBar({ kpis }: { kpis: TicketsMasterKpis }) {
  const items: {
    label: string;
    value: string;
    icon: ReactNode;
    accent?: "warn" | "lock";
  }[] = [
    {
      label: "Pending purchases",
      value: String(kpis.pendingPurchases),
      icon: <ShoppingCart className="h-3.5 w-3.5" strokeWidth={2} />,
    },
    {
      label: "Vouchers awaiting PDF",
      value: String(kpis.awaitingPdf),
      icon: <FileUp className="h-3.5 w-3.5" strokeWidth={2} />,
      accent: "warn",
    },
    {
      label: "Upcoming target dates",
      value: String(kpis.upcomingTargetDates),
      icon: <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} />,
    },
    {
      label: "Payment locks",
      value: String(kpis.paymentLocks),
      icon: <Lock className="h-3.5 w-3.5" strokeWidth={2} />,
      accent: "lock",
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
                    : item.accent === "lock"
                      ? "text-red-300"
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

function PnrProcurementDetail({
  card,
  hub,
  onReload,
}: {
  card: TicketsMasterCard;
  hub: OpsHubRow;
  onReload: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]/70 p-4 sm:p-5">
      <BoxGradingGlow />
      <div className="relative z-10 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-mono text-lg font-semibold text-white">
                {card.pnr}
              </h3>
              <span
                className={`rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase ${bucketTone(card.bucket)}`}
              >
                {card.bucket === "payment_locked" ? (
                  <span className="inline-flex items-center gap-1">
                    <Lock className="h-2.5 w-2.5" />
                    Payment locked
                  </span>
                ) : (
                  bucketLabel(card.bucket)
                )}
              </span>
              <span
                className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${payStatusTone(card.tourPaymentStatus)}`}
              >
                {card.paymentLabel}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-300">{card.guestName}</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              {[
                card.paxLabel,
                card.earliestTargetDate || "Date TBD",
                card.primaryCity,
                `ticket_status: ${card.ticketStatus}`,
              ].join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/ops?pnr=${encodeURIComponent(card.pnr)}`}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold tracking-wider text-zinc-300 uppercase hover:bg-white/10"
            >
              Open in Ops
            </Link>
            <span className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
              <Ticket className="h-3 w-3" />
              {card.readyItemCount}/{card.totalItemCount || "—"} vouchers
            </span>
          </div>
        </div>

        {card.bucket === "payment_locked" ? (
          <div className="rounded-xl border border-red-500/35 bg-red-950/30 px-3 py-2.5 text-[11px] leading-relaxed text-red-100/90">
            <span className="font-bold tracking-wider uppercase">
              🔒 Payment locked
            </span>
            {" — "}
            Tickets are needed but the client has not reached 30% deposit /
            PARTIALLY_PAID / FULLY_PAID yet. Do not purchase. Current lane:{" "}
            <strong>{card.paymentLabel}</strong> (
            {card.tourPaymentStatus}).
          </div>
        ) : null}

        {card.totalItemCount === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 bg-black/30 px-3 py-3 text-[11px] text-zinc-500">
            Flagged via{" "}
            <code className="text-zinc-400">ticket_status={card.ticketStatus}</code>
            {hub.tickets_needed ? " / tickets_needed" : ""} but no procurement
            cart lines yet. Add Suica, tickets, rail, or hotels in Pricing Studio
            — bonus gifts still need purchase.
          </p>
        ) : null}

        <TicketVoucherUploadPanel
          pnr={card.pnr}
          tourDate={card.tourDate}
          guestPaxLabel={card.paxLabel}
          onReload={onReload}
        />
      </div>
    </div>
  );
}
