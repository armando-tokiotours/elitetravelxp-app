"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import {
  assertStatusAllowedWithPayment,
  coerceStatusWithPayment,
  statusRequiresPayment,
} from "@/lib/paymentGate";
import { GuideDispatchTab } from "@/components/staff/GuideDispatchTab";
import { OpsActivityLogPanel } from "@/components/staff/OpsActivityLogPanel";
import { OpsPaymentStatusBadges } from "@/components/staff/OpsPaymentStatusBadges";
import { GuestRequirementsTab } from "@/components/staff/GuestRequirementsTab";
import {
  BookingStatusTab,
  type BookingStatusSavePayload,
} from "@/components/staff/BookingStatusTab";
import { TicketVoucherUploadPanel } from "@/components/staff/TicketVoucherUploadPanel";
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
      <h3 className="font-sans text-[11px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">
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
  const rowRef = useRef(row);
  rowRef.current = row;
  const reqsPnrRef = useRef<string>("");

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

  // Guest requirements — key on PNR only so ops_hub realtime/heal updates
  // do not wipe the tab back to "Loading booking context…"
  useEffect(() => {
    let cancelled = false;
    const pnr = String(row.pnr || "")
      .trim()
      .toUpperCase();
    if (!pnr) {
      setReqs(null);
      setReqsError(null);
      reqsPnrRef.current = "";
      return;
    }
    const pnrChanged = reqsPnrRef.current !== pnr;
    reqsPnrRef.current = pnr;
    if (pnrChanged) {
      setReqs(null);
      setReqsError(null);
    }
    void (async () => {
      try {
        const data = await loadOpsGuestRequirements(pb, rowRef.current);
        if (cancelled) return;
        setReqs(data);
        setReqsError(null);
        if (
          data.ticketsNeededFromCatalog &&
          rowRef.current.tickets_needed !== true
        ) {
          // Fire-and-forget — do not block or clear reqs
          void onReloadPockets();
        }
      } catch (e) {
        if (!cancelled) {
          setReqsError(formatPbError(e));
          setReqs(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- row snapshot via rowRef
  }, [pb, row.pnr, onReloadPockets]);

  const guideStatus = normalizeGuideConfirmStatus(dispatch?.guide_mode, {
    boardVisible: Boolean(dispatch?.guide_board_visible),
    assignedGuideId: dispatch?.assigned_guide_id,
    guideResponse: dispatch?.guide_response,
  });

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

  const saveGeneralStatus = (payload?: BookingStatusSavePayload) =>
    onSave(
      `${row.id}:status`,
      async () => {
        const nextPayment =
          payload?.paymentConfirmed ?? paymentConfirmed;
        const nextStatusRaw = payload?.status ?? status;
        const nextAgentId = payload?.assignedAgentId ?? agentId;
        const nextTourPay =
          payload?.tourPaymentStatus ??
          (nextPayment
            ? "FULLY_PAID"
            : Boolean(row.concierge_fee_paid)
              ? "FEE_PAID"
              : "UNPAID");

        assertStatusAllowedWithPayment(nextStatusRaw, nextPayment);
        const agent = agents.find((x) => x.id === nextAgentId);
        const nextStatus = coerceStatusWithPayment(
          nextStatusRaw,
          nextPayment
        );

        if (payload) {
          setStatus(nextStatusRaw);
          setPaymentConfirmed(nextPayment);
          setAgentId(nextAgentId);
        }

        await pb.collection("ops_hub").update(
          row.id,
          {
            status: nextStatus,
            payment_confirmed: nextPayment,
            tour_payment_status: nextTourPay,
            assigned_agent_id: nextAgentId,
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
      "Booking status & agent saved"
    );

  const assignAndRequestGuide = (nextGuideId?: string) =>
    onSave(
      `${row.id}:guide-assign`,
      async () => {
        const id = String(nextGuideId || guideId || "").trim();
        if (!id) throw new Error("Select a guide first");
        const g = guides.find((x) => x.id === id);
        setGuideId(id);
        await assignGuide(pb, {
          pnr: row.pnr,
          staffId: id,
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

  const clearGuide = () =>
    onSave(
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
              <OpsPaymentStatusBadges row={row} className="gap-2" />
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
              <OpsPaymentStatusBadges row={row} />
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
              <GuestRequirementsTab reqs={reqs} langFlag={langFlag} />
            )}
          </TabPanel>
        ) : null}

        {activeTab === "status" ? (
          <TabPanel title="Booking status">
            <BookingStatusTab
              pb={pb}
              row={row}
              agents={agents}
              saving={saving}
              isAgency={row.source === "agency"}
              onSave={(payload) => void saveGeneralStatus(payload)}
            />
          </TabPanel>
        ) : null}

        {activeTab === "guide" ? (
          <TabPanel title="Guide dispatch & payout">
            <div
              className={`mb-3 rounded-lg border p-3 text-center text-xs font-bold tracking-wide uppercase ${dispatchStrategy.style}`}
            >
              {dispatchStrategy.label}
            </div>
            <GuideDispatchTab
              pb={pb}
              row={row}
              dispatch={dispatch}
              guides={guides}
              reqs={reqs}
              saving={saving}
              showPayoutPanel={showPayoutPanel}
              onAssignGuide={async (id) => {
                await assignAndRequestGuide(id);
              }}
              onPostToOpenBoard={async () => {
                await savePostGuideBoard();
              }}
              onClearGuide={async () => {
                await clearGuide();
              }}
            />
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

            <TicketVoucherUploadPanel
              pnr={row.pnr}
              tourDate={row.tour_date}
              tickets={tickets}
              onReload={() => void onReloadPockets()}
            />
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
