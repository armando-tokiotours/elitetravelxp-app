"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type PocketBase from "pocketbase";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  assignDriver,
  assignGuide,
  clearGuideAssignment,
  postDriverBoard,
  postGuideBoard,
  type OpsDispatchRow,
} from "@/lib/opsDispatch";
import {
  updateTicketsByPnr,
  type OpsTicketsRow,
} from "@/lib/opsTickets";
import {
  guideConfirmStaffLabel,
  normalizeGuideConfirmStatus,
} from "@/lib/guideConfirmStatus";
import {
  loadOpsGuestRequirements,
  type OpsGuestRequirements,
} from "@/lib/opsGuestRequirements";
import { CANONICAL_STATUSES } from "@/lib/bookingStatus";
import {
  assertStatusAllowedWithPayment,
  coerceStatusWithPayment,
  statusRequiresPayment,
} from "@/lib/paymentGate";
import { GuideAssignPayoutPanel } from "@/components/staff/GuideAssignPayoutPanel";
import { OpsActivityLogPanel } from "@/components/staff/OpsActivityLogPanel";
import { OpsVendorDispatchPanel } from "@/components/staff/OpsVendorDispatchPanel";
import {
  OpsStatusBadge,
  type OpsHubRow,
  type StaffOption,
} from "@/components/staff/opsHubClient";
import { useTeamAuth } from "@/store/useTeamAuth";
import { canAccessMoney } from "@/lib/staffRoles";

type InspectorTab =
  | "requirements"
  | "status"
  | "guide"
  | "driver"
  | "tickets"
  | "activity";

const INSPECTOR_TABS: Array<{ id: InspectorTab; label: string }> = [
  { id: "requirements", label: "1. Guest Requirements" },
  { id: "status", label: "2. Booking Status" },
  { id: "guide", label: "3. Guide Dispatch" },
  { id: "driver", label: "4. Driver Dispatch" },
  { id: "tickets", label: "5. Tickets & Logistics" },
  { id: "activity", label: "6. Activity & Logs" },
];

function languageFlag(lang: string): string {
  const s = String(lang || "").toLowerCase();
  if (s.includes("japan") || s === "ja" || s.startsWith("jp")) return "🇯🇵";
  if (s.includes("english") || s === "en") return "🇬🇧";
  if (s.includes("chinese") || s.includes("mandarin") || s === "zh")
    return "🇨🇳";
  if (s.includes("korean") || s === "ko") return "🇰🇷";
  if (s.includes("french") || s === "fr") return "🇫🇷";
  if (s.includes("spanish") || s === "es") return "🇪🇸";
  if (s.includes("german") || s === "de") return "🇩🇪";
  if (s.includes("italian") || s === "it") return "🇮🇹";
  return "";
}

/** On-the-fly guide dispatch strategy from tour date + language (no PB fields). */
function getDispatchStrategy(opts: {
  startDate?: string | null;
  language?: string | null;
}): { label: string; style: string } {
  const rawDate = String(opts.startDate || "").trim();
  if (!rawDate) {
    return {
      label: "TIMING NOT SET",
      style: "border-zinc-500/30 bg-zinc-500/20 text-zinc-400",
    };
  }

  const start = new Date(
    rawDate.includes("T") ? rawDate : `${rawDate.slice(0, 10)}T12:00:00`
  );
  if (Number.isNaN(start.getTime())) {
    return {
      label: "TIMING NOT SET",
      style: "border-zinc-500/30 bg-zinc-500/20 text-zinc-400",
    };
  }

  const now = new Date();
  const diffDays = Math.ceil(
    (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  const diffMonths =
    (start.getFullYear() - now.getFullYear()) * 12 +
    (start.getMonth() - now.getMonth());

  const lang = String(opts.language || "")
    .trim()
    .toUpperCase();
  const isNicheLanguage =
    Boolean(lang) &&
    lang !== "—" &&
    lang !== "-" &&
    lang !== "EN" &&
    lang !== "ENGLISH" &&
    !lang.startsWith("EN") &&
    lang !== "NL" &&
    lang !== "DUTCH" &&
    !lang.startsWith("NL");

  if (diffDays <= 7 || isNicheLanguage) {
    return {
      label:
        "⚠️ CHECK GUIDE AVAILABILITY FIRST (Do Not Request Payment Yet)",
      style: "border-amber-500/30 bg-amber-500/20 text-amber-300",
    };
  }

  if (diffMonths >= 3) {
    return {
      label: "💳 30% DEPOSIT ONLY (Defer Guide Assignment)",
      style: "border-blue-500/30 bg-blue-500/20 text-blue-300",
    };
  }

  return {
    label: "✅ COLLECT PAYMENT FIRST (Assign Guide Later)",
    style: "border-emerald-500/30 bg-emerald-500/20 text-emerald-300",
  };
}

function StatusPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "warn" | "info";
}) {
  const toneClass =
    tone === "ok"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : tone === "warn"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
        : tone === "info"
          ? "border-[#075473]/40 bg-[#075473]/15 text-[#7ec8e3]"
          : "border-zinc-700 bg-zinc-900 text-zinc-300";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] ${toneClass}`}
    >
      <span className="font-bold tracking-wider uppercase text-zinc-500">
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </span>
  );
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
      <p className="text-[10px] font-bold tracking-wider text-zinc-600 uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-zinc-200">{value || "—"}</p>
    </div>
  );
}

function PassBadge({ value }: { value: boolean | null }) {
  if (value === true) {
    return <span className="font-semibold text-emerald-400">✓ Yes</span>;
  }
  if (value === false) {
    return <span className="font-semibold text-zinc-400">✗ No</span>;
  }
  return <span className="font-semibold text-zinc-500">Unset</span>;
}

/** Format PB datetime for inspector meta (local-ish, compact). */
function formatLastModified(raw: string | undefined | null): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    const s = String(raw).replace("T", " ").slice(0, 16);
    return s || "—";
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function TabPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-[11px] font-bold tracking-[0.14em] text-zinc-500 uppercase">
        {title}
      </h3>
      {children}
    </div>
  );
}

export function OpsBookingInspector({
  row,
  dispatch,
  tickets,
  guides,
  drivers,
  ticketers,
  agents,
  saving,
  staffId,
  pb,
  onSave,
  onReloadPockets,
}: {
  row: OpsHubRow;
  dispatch?: OpsDispatchRow;
  tickets?: OpsTicketsRow;
  guides: StaffOption[];
  drivers: StaffOption[];
  ticketers: StaffOption[];
  agents: StaffOption[];
  saving: boolean;
  staffId: string | null;
  pb: PocketBase;
  onSave: (
    key: string,
    fn: () => Promise<void>,
    okMsg: string
  ) => Promise<void>;
  onReloadPockets: () => Promise<void>;
}) {
  const authEmail = useTeamAuth((s) => s.email);
  const authRecord = useTeamAuth((s) => s.record);
  const authRole = useTeamAuth((s) => s.role);
  const staffName =
    String(authRecord?.name || "").trim() ||
    String(authEmail || "").trim() ||
    "Staff";
  const showPayoutPanel = canAccessMoney(authRole);
  const [activeTab, setActiveTab] = useState<InspectorTab>("requirements");
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [status, setStatus] = useState(row.status || "incoming");
  const [paymentConfirmed, setPaymentConfirmed] = useState(
    Boolean(row.payment_confirmed)
  );
  const [agentId, setAgentId] = useState(row.assigned_agent_id || "");
  const [guideId, setGuideId] = useState(dispatch?.assigned_guide_id || "");
  const [driverId, setDriverId] = useState(dispatch?.assigned_driver_id || "");
  const [ticketerId, setTicketerId] = useState(
    tickets?.assigned_ticketer_id || row.assigned_ticketer_id || ""
  );
  const [ticketStatus, setTicketStatus] = useState(
    tickets?.ticket_status || row.ticket_status || "none"
  );
  const [ticketNotes, setTicketNotes] = useState(tickets?.ticket_notes || "");
  const [pickupNotes, setPickupNotes] = useState(row.pickup_notes || "");
  const [reqs, setReqs] = useState<OpsGuestRequirements | null>(null);
  const [reqsError, setReqsError] = useState<string | null>(null);
  const [saveVersion, setSaveVersion] = useState<number | null>(null);
  const [balUpdated, setBalUpdated] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab("requirements");
    setHeaderCollapsed(false);
  }, [row.pnr]);

  useEffect(() => {
    let cancelled = false;
    setSaveVersion(null);
    setBalUpdated(null);
    const pnr = String(row.pnr || "")
      .trim()
      .toUpperCase()
      .replace(/"/g, "");
    if (!pnr) return;
    void (async () => {
      try {
        const bal = await pb
          .collection("bookings_and_leads")
          .getFirstListItem<{
            save_version?: number;
            updated?: string;
            last_saved_at?: string;
          }>(`booking_ref="${pnr}"`, { requestKey: null });
        if (cancelled) return;
        const ver = Number(bal.save_version);
        setSaveVersion(Number.isFinite(ver) && ver > 0 ? ver : null);
        setBalUpdated(
          String(bal.last_saved_at || bal.updated || "").trim() || null
        );
      } catch {
        if (!cancelled) {
          setSaveVersion(null);
          setBalUpdated(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pb, row.pnr]);

  useEffect(() => {
    setStatus(
      coerceStatusWithPayment(row.status, Boolean(row.payment_confirmed))
    );
    setPaymentConfirmed(Boolean(row.payment_confirmed));
    setAgentId(row.assigned_agent_id || "");
    setGuideId(dispatch?.assigned_guide_id || "");
    setDriverId(dispatch?.assigned_driver_id || "");
    setTicketerId(
      tickets?.assigned_ticketer_id || row.assigned_ticketer_id || ""
    );
    setTicketStatus(tickets?.ticket_status || row.ticket_status || "none");
    setTicketNotes(tickets?.ticket_notes || "");
    setPickupNotes(row.pickup_notes || "");
  }, [row, dispatch, tickets]);

  useEffect(() => {
    let cancelled = false;
    setReqs(null);
    setReqsError(null);
    void (async () => {
      try {
        const data = await loadOpsGuestRequirements(pb, row);
        if (!cancelled) {
          setReqs(data);
          if (
            data.ticketsNeededFromCatalog &&
            row.tickets_needed !== true
          ) {
            await onReloadPockets();
          }
        }
      } catch (e) {
        if (!cancelled) setReqsError(formatPbError(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pb, row, onReloadPockets]);

  const guideStatus = normalizeGuideConfirmStatus(dispatch?.guide_mode, {
    boardVisible: Boolean(dispatch?.guide_board_visible),
    assignedGuideId: dispatch?.assigned_guide_id,
    guideResponse: dispatch?.guide_response,
  });
  const guideLockedPending = guideStatus === "pending_guide_acceptance";
  const guideConfirmed = guideStatus === "guide_confirmed";
  const guideRefused = guideStatus === "refused";
  const canSendGuide =
    Boolean(guideId) &&
    !guideLockedPending &&
    !guideConfirmed &&
    (!dispatch?.assigned_guide_id ||
      guideRefused ||
      guideId !== dispatch?.assigned_guide_id ||
      guideStatus === "unassigned");

  const ticketBadge = useMemo(() => {
    const lines = Array.isArray(tickets?.ticket_lines)
      ? (tickets?.ticket_lines as unknown[])
      : [];
    const needed =
      row.tickets_needed === true ||
      reqs?.ticketsNeededFromCatalog === true ||
      (reqs?.accessLines?.length || 0) > 0 ||
      lines.length > 0 ||
      ticketStatus === "needed" ||
      ticketStatus === "ordered" ||
      ticketStatus === "done";
    if (ticketStatus === "done")
      return { value: "Tickets Purchased", tone: "ok" as const };
    if (!needed && ticketStatus === "none") {
      return { value: "Not Required", tone: "neutral" as const };
    }
    if (ticketStatus === "ordered" || ticketStatus === "needed" || needed) {
      return { value: "Pending Ticketer", tone: "warn" as const };
    }
    return { value: String(ticketStatus || "—"), tone: "neutral" as const };
  }, [ticketStatus, row.tickets_needed, tickets?.ticket_lines, reqs]);

  const bookingStatusLabel = useMemo(() => {
    const effective = coerceStatusWithPayment(status, paymentConfirmed);
    const map: Record<string, string> = {
      draft: "Draft",
      incoming: "Incoming",
      quoted: "Quoted",
      confirmed: "Confirmed",
      in_ops: "In Progress",
      done: "Completed",
      cancelled: "Cancelled",
    };
    return map[effective] || effective;
  }, [status, paymentConfirmed]);

  // Illegal combo Confirmed + unpaid must not remain in the UI
  useEffect(() => {
    if (!paymentConfirmed && statusRequiresPayment(status)) {
      setStatus("incoming");
    }
  }, [paymentConfirmed, status, row.id]);

  // Persist heal so Confirmed+unpaid cannot linger in ops_hub / detail
  useEffect(() => {
    if (
      !Boolean(row.payment_confirmed) &&
      statusRequiresPayment(row.status)
    ) {
      void (async () => {
        try {
          await pb.collection("ops_hub").update(
            row.id,
            { status: "incoming" },
            { requestKey: null }
          );
          const { syncDetailStatusFromOpsHub } = await import(
            "@/lib/syncOpsStatusToDetail"
          );
          await syncDetailStatusFromOpsHub(
            pb,
            {
              source: row.source,
              detail_collection: row.detail_collection,
              detail_id: row.detail_id,
              pnr: row.pnr,
            },
            "incoming"
          );
          await onReloadPockets();
        } catch {
          /* non-blocking heal */
        }
      })();
    }
  }, [
    pb,
    row.id,
    row.payment_confirmed,
    row.status,
    row.source,
    row.detail_collection,
    row.detail_id,
    row.pnr,
    onReloadPockets,
  ]);

  const driverNeeded =
    row.driver_needed === true ||
    dispatch?.driver_needed === true ||
    Boolean(driverId) ||
    Boolean(dispatch?.assigned_driver_id);
  const driverMode = String(dispatch?.driver_mode || "unassigned");
  const driverApplies = driverNeeded;

  const saveGeneralStatus = () =>
    onSave(
      `${row.id}:status`,
      async () => {
        assertStatusAllowedWithPayment(status, paymentConfirmed);
        const agent = agents.find((x) => x.id === agentId);
        const nextStatus = coerceStatusWithPayment(status, paymentConfirmed);
        await pb.collection("ops_hub").update(
          row.id,
          {
            status: nextStatus,
            payment_confirmed: paymentConfirmed,
            assigned_agent_id: agentId,
            assigned_agent:
              agent?.name || agent?.email || row.assigned_agent || "",
          },
          { requestKey: null }
        );
        if (typeof nextStatus === "string" && nextStatus !== row.status) {
          const { syncDetailStatusFromOpsHub } = await import(
            "@/lib/syncOpsStatusToDetail"
          );
          await syncDetailStatusFromOpsHub(
            pb,
            { source: row.source, pnr: row.pnr },
            nextStatus
          );
        }
      },
      "Booking status saved"
    );

  const assignAndRequestGuide = () =>
    onSave(
      `${row.id}:guide-assign`,
      async () => {
        if (!guideId) throw new Error("Select a guide first");
        const g = guides.find((x) => x.id === guideId);
        await assignGuide(pb, {
          pnr: row.pnr,
          staffId: guideId,
          staffName: g?.name || g?.email || "",
          byStaffId: staffId || undefined,
        });
        await onReloadPockets();
      },
      "Guide sent for approval"
    );

  const savePostGuideBoard = () =>
    onSave(
      `${row.id}:guide-board`,
      async () => {
        await postGuideBoard(pb, {
          pnr: row.pnr,
          byStaffId: staffId || undefined,
        });
        setGuideId("");
        await onReloadPockets();
      },
      "Posted to open guide board"
    );

  const saveLogistics = () =>
    onSave(
      `${row.id}:logistics`,
      async () => {
        if (ticketStatus === "done" && !paymentConfirmed) {
          throw new Error(
            "Payment must be confirmed before marking tickets purchased"
          );
        }
        await pb.collection("ops_hub").update(
          row.id,
          { pickup_notes: pickupNotes },
          { requestKey: null }
        );
        await updateTicketsByPnr(pb, row.pnr, {
          assigned_ticketer_id: ticketerId,
          ticket_status: ticketStatus as "none" | "needed" | "ordered" | "done",
          ticket_notes: ticketNotes,
        });
        await onReloadPockets();
      },
      "Logistics & ticket status saved"
    );

  const langFlag = languageFlag(reqs?.tourLanguage || "");
  const dispatchStrategy = getDispatchStrategy({
    startDate: row.tour_date,
    language: reqs?.tourLanguage,
  });

  const paxLabel = useMemo(() => {
    if (reqs) {
      const kids = Math.max(0, Number(reqs.children) || 0);
      const adults = Math.max(0, Number(reqs.adults) || 0);
      const total = adults + kids;
      if (total > 0) {
        return kids > 0
          ? `${total} pax (${adults}A/${kids}K)`
          : `${total} pax`;
      }
    }
    const summary = String(row.guest_summary || "").trim();
    return summary || "— pax";
  }, [reqs, row.guest_summary]);

  const effectiveStatus = useMemo(
    () => coerceStatusWithPayment(status, paymentConfirmed),
    [status, paymentConfirmed]
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Compact blue PNR header card */}
      <div className="shrink-0 border-b border-zinc-800 px-3 pt-3 pb-2 sm:px-4">
        <div className="rounded-xl border border-[#075473] bg-[#075473]/30 p-3 text-white shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-xs font-semibold tracking-wide text-cyan-300">
                  PNR {row.pnr}
                </span>
                {!headerCollapsed ? (
                  <span className="text-[10px] text-white/50">
                    {row.source === "agency" ? "B2B Agency" : "Direct"}
                    {saveVersion != null ? ` · Rev ${saveVersion}` : ""}
                  </span>
                ) : null}
              </div>
              <h3 className="mt-0.5 truncate text-base font-bold text-white">
                {row.primary_city || "—"} · {paxLabel}
              </h3>
              {!headerCollapsed ? (
                <p className="mt-0.5 text-xs text-white/70">
                  {row.tour_date ? String(row.tour_date).slice(0, 10) : "—"}
                  {row.guest_summary
                    ? ` · ${row.guest_summary}`
                    : ""}
                  {" · "}
                  Last mod {formatLastModified(balUpdated || row.updated)}
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-white/60">
                  {row.tour_date ? String(row.tour_date).slice(0, 10) : "—"}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setHeaderCollapsed((v) => !v)}
              className="shrink-0 rounded-lg bg-white/10 px-3 py-1 text-[10px] font-semibold tracking-wide text-white uppercase transition hover:bg-white/20"
            >
              {headerCollapsed ? "Expand" : "Compact"}
            </button>
          </div>
          {!headerCollapsed ? (
            <div className="mt-2.5 flex flex-wrap gap-2">
              <StatusPill label="Booking" value={bookingStatusLabel} tone="info" />
              <StatusPill
                label="Payment"
                value={paymentConfirmed ? "Yes" : "No"}
                tone={paymentConfirmed ? "ok" : "warn"}
              />
              <StatusPill
                label="Guide"
                value={guideConfirmStaffLabel(guideStatus)}
                tone={
                  guideStatus === "guide_confirmed"
                    ? "ok"
                    : guideStatus === "unassigned"
                      ? "neutral"
                      : "warn"
                }
              />
              <StatusPill
                label="Tickets"
                value={ticketBadge.value}
                tone={ticketBadge.tone}
              />
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <OpsStatusBadge status={effectiveStatus} />
              <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-300">
                Guide: {guideConfirmStaffLabel(guideStatus)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* File-folder tab bar */}
      <div className="shrink-0 border-b border-zinc-800 px-3 pt-2 pb-0">
        <div
          className="flex gap-1 overflow-x-auto pb-2"
          role="tablist"
          aria-label="Inspector sections"
        >
          {INSPECTOR_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 rounded-t-lg border px-3 py-2 text-[10px] font-bold tracking-wide uppercase whitespace-nowrap transition ${
                  active
                    ? "border-amber-500/60 border-b-transparent bg-[#075473] text-white"
                    : "border-white/10 bg-zinc-900/50 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content — form state preserved across switches */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {activeTab === "requirements" ? (
          <TabPanel title="Guest requirements">
            {reqsError ? (
              <p className="text-xs text-red-400">{reqsError}</p>
            ) : !reqs ? (
              <p className="text-xs text-zinc-500">Loading booking context…</p>
            ) : (
              <div className="space-y-6">
                {/* Itinerary overview — from already-loaded BAL selections */}
                <div className="rounded-lg border border-white/10 bg-black/40 p-4">
                  <h4 className="mb-3 font-godiva text-sm text-[#F6A724]">
                    Itinerary Overview
                  </h4>
                  <div className="mb-4 grid grid-cols-3 gap-4 border-b border-white/10 pb-4">
                    <div>
                      <p className="text-[10px] font-bold tracking-wider text-zinc-600 uppercase">
                        Total days
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-white">
                        {reqs.totalDaysLabel}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold tracking-wider text-zinc-600 uppercase">
                        Start date
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-white">
                        {reqs.arrivalDateLabel}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold tracking-wider text-zinc-600 uppercase">
                        Travel pace
                      </p>
                      <p className="mt-0.5 text-sm font-semibold capitalize text-white">
                        {reqs.travelPaceLabel}
                      </p>
                    </div>
                  </div>

                  <p className="mb-4 text-[10px] font-bold tracking-[0.18em] text-zinc-500 uppercase">
                    Route, Tours &amp; Daily Transport
                  </p>
                  <div className="relative ml-3 space-y-8 border-l-2 border-white/10 pl-6">
                    {/* Arrival hub */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-[#0A1017] bg-white" />
                      <h4 className="mb-1 text-sm font-bold uppercase text-white">
                        {reqs.routeTimeline.arrivalHubLabel} Arrival waypoint
                      </h4>
                      <p className="text-sm text-zinc-400">
                        VIP Arrival Pickup: {reqs.routeTimeline.arrivalVipLabel}
                      </p>
                    </div>

                    {/* City stays */}
                    {reqs.routeTimeline.stays.length > 0 ? (
                      reqs.routeTimeline.stays.map((loc, idx) => (
                        <div
                          key={`${loc.cityId}-${idx}-${loc.startDate || idx}`}
                          className="relative"
                        >
                          <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-[#0A1017] bg-[#075473]" />
                          <h4 className="text-lg font-bold text-white">
                            {loc.cityName}{" "}
                            <span className="ml-2 text-sm font-normal text-zinc-400">
                              · {loc.nights} Night
                              {loc.nights === 1 ? "" : "s"}
                            </span>
                          </h4>
                          <p className="mb-1 text-sm text-[#F6A724]">
                            {loc.dateLabel}
                          </p>
                          <p
                            className={`mb-1 text-xs font-semibold ${
                              loc.hotelArrangement === "tokiotours"
                                ? "text-[#F6A724]"
                                : loc.hotelArrangement === "self"
                                  ? "text-zinc-300"
                                  : "text-zinc-500"
                            }`}
                          >
                            Hotel: {loc.hotelLabel}
                          </p>
                          <p className="mb-3 text-[11px] text-[#7ec8e3]">
                            {loc.localTransitLabel}
                          </p>
                          <div className="rounded-md border border-white/5 bg-black/40 p-3 text-sm">
                            <p className="mb-1 font-semibold text-zinc-300">
                              {loc.incomingTitle}
                            </p>
                            <ul className="list-disc space-y-1 pl-4 text-zinc-500">
                              {loc.incomingBullets.map((b) => (
                                <li key={b}>{b}</li>
                              ))}
                            </ul>
                          </div>

                          {/* Day-by-day services & tours */}
                          {loc.days?.length ? (
                            <div className="mt-3 space-y-2">
                              <p className="text-[10px] font-bold tracking-[0.14em] text-zinc-500 uppercase">
                                Day services
                              </p>
                              {loc.days.map((day) => (
                                <div
                                  key={`${loc.cityId}-${day.dayIndex}-${day.date || "tbd"}`}
                                  className="rounded-lg border border-white/5 bg-[#0D1117] p-3"
                                >
                                  <div className="mb-2 flex items-center justify-between gap-2">
                                    <span className="text-xs font-bold text-zinc-400">
                                      DAY {day.dayIndex}
                                      {day.dateLabel ? ` · ${day.dateLabel}` : ""}
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                      {day.hasCar ? (
                                        <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-zinc-300">
                                          CAR
                                        </span>
                                      ) : null}
                                      {day.hasGuide ? (
                                        <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-zinc-300">
                                          GUIDE
                                        </span>
                                      ) : null}
                                      {day.hasTickets ? (
                                        <span className="rounded bg-[#F6A724]/20 px-2 py-0.5 text-[10px] font-bold text-[#F6A724]">
                                          TICKETS
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                  {day.tours.map((t) => (
                                    <div
                                      key={`${t.tourId}-${t.title}`}
                                      className="mt-1 rounded border border-white/5 bg-black/40 px-2 py-1.5 text-xs text-white"
                                    >
                                      <p className="font-semibold">{t.title}</p>
                                      <p className="text-[10px] text-zinc-500">
                                        {[
                                          t.language
                                            ? `Lang ${t.language}`
                                            : null,
                                          t.hours
                                            ? `${t.hours}h`
                                            : null,
                                        ]
                                          .filter(Boolean)
                                          .join(" · ") || "Booked experience"}
                                      </p>
                                    </div>
                                  ))}
                                  {day.tickets.map((t, i) => (
                                    <div
                                      key={`${t.title}-${i}`}
                                      className="mt-1 rounded border border-dashed border-[#F6A724]/40 bg-black/40 p-2 text-xs"
                                    >
                                      <p className="font-bold text-white">
                                        {t.title}
                                      </p>
                                      <p className="text-[10px] text-zinc-400">
                                        {t.type}
                                      </p>
                                    </div>
                                  ))}
                                  {!day.tours.length &&
                                  !day.tickets.length &&
                                  !day.hasCar ? (
                                    <p className="text-[11px] text-zinc-600 italic">
                                      No activities flagged this day
                                    </p>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : null}

                          {loc.outgoingTitle ? (
                            <div className="mt-3 rounded-md border border-[#075473]/40 bg-[#075473]/15 p-3 text-sm">
                              <p className="mb-1 font-semibold text-[#7ec8e3]">
                                {loc.outgoingTitle}
                              </p>
                              <ul className="list-disc space-y-1 pl-4 text-zinc-400">
                                {(loc.outgoingBullets || []).map((b) => (
                                  <li key={b}>{b}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm italic text-zinc-500">
                        No stay cities selected yet.
                      </p>
                    )}

                    {/* Departure hub */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-[#0A1017] bg-white" />
                      <h4 className="mb-1 text-sm font-bold uppercase text-white">
                        {reqs.routeTimeline.departureHubLabel} Departure
                        waypoint
                      </h4>
                      <p className="text-sm text-zinc-400">
                        Departure Drop-off:{" "}
                        {reqs.routeTimeline.departureDropoffLabel}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Guest profile & contact */}
                <div className="grid grid-cols-2 gap-4 rounded-lg border border-white/10 bg-black/40 p-4 md:grid-cols-4">
                  <Field label="Guest name" value={reqs.guestName} />
                  <Field label="Guest email" value={reqs.guestEmail} />
                  <Field label="Phone / WhatsApp" value={reqs.guestPhone} />
                  <div>
                    <p className="text-[10px] font-bold tracking-wider text-zinc-600 uppercase">
                      Party size
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-[#F6A724]">
                      {reqs.adults} Adult{reqs.adults === 1 ? "" : "s"}
                      {reqs.children > 0
                        ? `, ${reqs.children} Child${
                            reqs.children === 1 ? "" : "ren"
                          }`
                        : ""}
                    </p>
                  </div>
                  <Field
                    label="Language"
                    value={
                      langFlag
                        ? `${langFlag} ${reqs.tourLanguage}`
                        : reqs.tourLanguage
                    }
                  />
                </div>

                {/* Transit & passes */}
                <div className="grid grid-cols-2 gap-4 rounded-lg border border-white/10 bg-black/40 p-4 md:grid-cols-4">
                  <div>
                    <p className="text-[10px] font-bold tracking-wider text-zinc-600 uppercase">
                      JR Rail Pass
                    </p>
                    <p className="mt-0.5 text-sm">
                      <PassBadge value={reqs.guestHasJRPass} />
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold tracking-wider text-zinc-600 uppercase">
                      Suica / IC Card
                    </p>
                    <p className="mt-0.5 text-sm">
                      <PassBadge value={reqs.guestHasICCard} />
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold tracking-wider text-zinc-600 uppercase">
                      Transit assistance
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-white">
                      {reqs.guestNeedsTransitHelp === true
                        ? "Requested"
                        : reqs.guestNeedsTransitHelp === false
                          ? "None"
                          : "Unset"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold tracking-wider text-zinc-600 uppercase">
                      Transport strategy
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-[#7ec8e3]">
                      {reqs.transportStrategy || "Unset"}
                    </p>
                  </div>
                </div>

                {/* Existing tour / meeting / access */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Tour / Experience"
                    value={
                      reqs.tourCode &&
                      reqs.tourCode !== "—" &&
                      !reqs.tourTitle.includes(reqs.tourCode)
                        ? `${reqs.tourTitle} · ${reqs.tourCode}`
                        : reqs.tourTitle
                    }
                  />
                  <Field
                    label="Tour language"
                    value={
                      langFlag
                        ? `${langFlag} ${reqs.tourLanguage}`
                        : reqs.tourLanguage
                    }
                  />
                  <Field
                    label="Meeting point"
                    value={reqs.meetingPointName}
                  />
                  <Field
                    label="Address"
                    value={reqs.meetingPointAddress}
                  />
                  <Field label="Start time" value={reqs.startTime} />
                  <Field label="Duration" value={reqs.durationLabel} />
                  <Field
                    label="Special mobility"
                    value={reqs.specialMobility}
                  />
                  <Field label="Special notes" value={reqs.specialNotes} />
                  {reqs.accessLines.length > 0 ? (
                    <div className="sm:col-span-2">
                      <p className="text-[10px] font-bold tracking-wider text-zinc-600 uppercase">
                        Access / tickets required
                      </p>
                      <ul className="mt-1 space-y-1 text-sm text-zinc-200">
                        {reqs.accessLines.map((line) => (
                          <li key={line.tourId}>
                            · {line.title} —{" "}
                            <span className="text-[#7ec8e3]">{line.label}</span>
                          </li>
                        ))}
                      </ul>
                      {reqs.guestNeedsTransitHelp === true ? (
                        <p className="mt-2 text-[11px] text-amber-300/90">
                          Transit assistance requested — confirm passes &amp;
                          day tickets above.
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <Field
                      label="Access / tickets required"
                      value={
                        reqs.guestNeedsTransitHelp === true
                          ? "Transit assistance requested — list tickets with guest"
                          : "None flagged"
                      }
                    />
                  )}
                </div>
              </div>
            )}
          </TabPanel>
        ) : null}

        {activeTab === "status" ? (
          <TabPanel title="Booking status">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                Overall booking status
                <select
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white"
                  value={status}
                  disabled={saving}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {CANONICAL_STATUSES.map((s) => (
                    <option
                      key={s}
                      value={s}
                      disabled={
                        !paymentConfirmed && statusRequiresPayment(s)
                      }
                    >
                      {s}
                      {!paymentConfirmed && statusRequiresPayment(s)
                        ? " (needs payment)"
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                Payment confirmed
                <select
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white"
                  value={paymentConfirmed ? "yes" : "no"}
                  disabled={saving}
                  onChange={(e) =>
                    setPaymentConfirmed(e.target.value === "yes")
                  }
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </label>
              {row.source === "agency" ? (
                <p className="text-[10px] tracking-wider text-zinc-600 uppercase sm:col-span-2">
                  Concierge · Ops (agency)
                </p>
              ) : (
                <label className="block text-[10px] font-bold tracking-wider text-zinc-500 uppercase sm:col-span-2">
                  Concierge agent
                  <select
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white"
                    value={agentId}
                    disabled={saving}
                    onChange={(e) => setAgentId(e.target.value)}
                  >
                    <option value="">—</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name || a.email}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {!paymentConfirmed ? (
              <p className="text-[11px] text-amber-400/90">
                Golden rule: guest Day Services only show confirmed guide /
                driver / ticket purchase after Payment = Yes. Ticketer cannot
                mark purchased until then.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                className="rounded-lg bg-[#075473] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
                onClick={() => void saveGeneralStatus()}
              >
                {saving ? "Saving…" : "Save Booking Status"}
              </button>
            </div>
          </TabPanel>
        ) : null}

        {activeTab === "guide" ? (
          <TabPanel title="Guide dispatch & payout">
            <div
              className={`mb-1 rounded-lg border p-3 text-center text-xs font-bold tracking-wide uppercase ${dispatchStrategy.style}`}
            >
              {dispatchStrategy.label}
            </div>
            <p className="text-xs text-zinc-500">
              Status:{" "}
              <span className="text-zinc-300">
                {guideConfirmStaffLabel(guideStatus)}
              </span>
              {dispatch?.assigned_guide
                ? ` · ${dispatch.assigned_guide}`
                : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <select
                className="min-w-[12rem] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs"
                value={guideId}
                disabled={saving || guideLockedPending || guideConfirmed}
                onChange={(e) => setGuideId(e.target.value)}
              >
                <option value="">Select guide…</option>
                {guides.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name || g.email}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={saving || !canSendGuide}
                className="rounded-lg border border-[#075473]/50 bg-[#075473]/20 px-3 py-1.5 text-[11px] font-semibold text-[#7ec8e3] disabled:opacity-40"
                onClick={() => void assignAndRequestGuide()}
              >
                Assign & Request Guide
              </button>
              <button
                type="button"
                disabled={saving || guideConfirmed}
                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-[11px] text-zinc-300 hover:text-white disabled:opacity-40"
                onClick={() => void savePostGuideBoard()}
              >
                Save & Post to Open Board
              </button>
              {(guideLockedPending || guideRefused || guideConfirmed) && (
                <button
                  type="button"
                  disabled={saving}
                  className="rounded-lg border border-amber-600/50 px-3 py-1.5 text-[11px] text-amber-300 disabled:opacity-40"
                  onClick={() =>
                    void onSave(
                      `${row.id}:guide-clear`,
                      async () => {
                        await clearGuideAssignment(pb, {
                          pnr: row.pnr,
                          byStaffId: staffId || undefined,
                        });
                        setGuideId("");
                        await onReloadPockets();
                      },
                      "Guide cleared — pick another or post board"
                    )
                  }
                >
                  Clear / Reassign
                </button>
              )}
            </div>
            <p className="text-[11px] text-zinc-600">
              1) Select guide · 2) Assign & Request Guide. While pending, Ops
              waits for Accept/Refuse in /guide. If refused, Clear/Reassign or
              post to open board.
            </p>
            <div className="border-t border-zinc-800 pt-4">
              <p className="mb-2 text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                Vendor dispatch links
              </p>
              <OpsVendorDispatchPanel
                pb={pb}
                row={row}
                dispatch={dispatch}
                tickets={tickets}
                staffId={staffId}
                staffName={staffName}
                paymentConfirmed={paymentConfirmed}
                onPaymentToggle={setPaymentConfirmed}
                onHubPatched={(patch) => {
                  if (patch.status) setStatus(String(patch.status));
                  if (patch.payment_confirmed != null) {
                    setPaymentConfirmed(Boolean(patch.payment_confirmed));
                  }
                }}
              />
            </div>
            <div className="border-t border-zinc-800 pt-4">
              <p className="mb-2 text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                Guide payout snapshot
              </p>
              {showPayoutPanel && guideId ? (
                <GuideAssignPayoutPanel
                  pb={pb}
                  pnr={row.pnr}
                  staffGuideId={guideId}
                />
              ) : showPayoutPanel ? (
                <p className="text-xs text-zinc-500">
                  Select a guide above to set payout terms (fee source, hours,
                  currency, margin).
                </p>
              ) : (
                <p className="text-xs text-zinc-500">
                  Payout / margin fields are owner-only. Use dispatch links above
                  for vendors.
                </p>
              )}
            </div>
          </TabPanel>
        ) : null}

        {activeTab === "driver" ? (
          <TabPanel title="Driver dispatch & transit">
            <p className="text-xs text-zinc-500">
              Requirement:{" "}
              <span className="text-zinc-300">
                {driverApplies ? "Driver needed" : "Not required"}
              </span>
              {" · "}
              Status:{" "}
              <span className="text-zinc-300">
                {driverMode === "claimed"
                  ? "Claimed"
                  : driverMode === "open"
                    ? "Posted on board"
                    : driverMode === "direct"
                      ? "Assigned"
                      : "Unassigned"}
              </span>
              {dispatch?.assigned_driver
                ? ` · ${dispatch.assigned_driver}`
                : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <select
                className="min-w-[12rem] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs"
                value={driverId}
                disabled={saving}
                onChange={(e) => setDriverId(e.target.value)}
              >
                <option value="">Assign driver / fleet…</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name || d.email}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={saving || !driverId}
                className="rounded-lg bg-[#075473] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
                onClick={() =>
                  void onSave(
                    `${row.id}:driver`,
                    async () => {
                      const d = drivers.find((x) => x.id === driverId);
                      await assignDriver(pb, {
                        pnr: row.pnr,
                        staffId: driverId,
                        staffName: d?.name || d?.email || "",
                        byStaffId: staffId || undefined,
                      });
                      await onReloadPockets();
                    },
                    "Driver assignment saved"
                  )
                }
              >
                Save Driver Assignment
              </button>
              <button
                type="button"
                disabled={saving}
                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-[11px] text-zinc-300 disabled:opacity-40"
                onClick={() =>
                  void onSave(
                    `${row.id}:driver-board`,
                    async () => {
                      await postDriverBoard(pb, {
                        pnr: row.pnr,
                        byStaffId: staffId || undefined,
                      });
                      setDriverId("");
                      await onReloadPockets();
                    },
                    "Driver posted to board"
                  )
                }
              >
                Post Driver Board
              </button>
            </div>
            <p className="text-[11px] text-zinc-600">
              Use for pick-up / drop-off or special private car. Leave empty when
              not required. Vehicle tier & rate-sheet lookup live on the Driver
              portal rate card.
            </p>
          </TabPanel>
        ) : null}

        {activeTab === "tickets" ? (
          <TabPanel title="Tickets & logistics">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                Access / ticket purchase status
                <select
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs"
                  value={ticketStatus}
                  disabled={saving}
                  onChange={(e) => setTicketStatus(e.target.value)}
                >
                  <option value="none">Not required</option>
                  <option value="needed">Pending purchase</option>
                  <option value="ordered">Ordered</option>
                  <option value="done" disabled={!paymentConfirmed}>
                    Purchased{!paymentConfirmed ? " (needs payment)" : ""}
                  </option>
                </select>
              </label>
              <label className="block text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                Ticketer assigned
                <select
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs"
                  value={ticketerId}
                  disabled={saving}
                  onChange={(e) => setTicketerId(e.target.value)}
                >
                  <option value="">—</option>
                  {ticketers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name || t.email}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[10px] font-bold tracking-wider text-zinc-500 uppercase sm:col-span-2">
                Tickets required / instructions
                <textarea
                  className="mt-1 h-16 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white"
                  value={ticketNotes}
                  disabled={saving}
                  onChange={(e) => setTicketNotes(e.target.value)}
                  placeholder="e.g. 4× teamLab Planets entries for 10:30"
                />
              </label>
              <label className="block text-[10px] font-bold tracking-wider text-zinc-500 uppercase sm:col-span-2">
                Pickup & meeting notes
                <textarea
                  className="mt-1 h-16 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white"
                  value={pickupNotes}
                  disabled={saving}
                  onChange={(e) => setPickupNotes(e.target.value)}
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={saving}
                className="rounded-lg bg-[#075473] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
                onClick={() => void saveLogistics()}
              >
                {saving ? "Saving…" : "Save Logistics & Ticket Status"}
              </button>
              <OpsStatusBadge status={ticketStatus} />
            </div>
          </TabPanel>
        ) : null}

        {activeTab === "activity" ? (
          <TabPanel title="Activity & logs">
            <OpsActivityLogPanel
              pb={pb}
              pnr={row.pnr}
              opsHubId={row.id}
              staffId={staffId}
              staffName={staffName}
            />
          </TabPanel>
        ) : null}
      </div>
    </div>
  );
}
