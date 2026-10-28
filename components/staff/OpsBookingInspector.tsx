"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type PocketBase from "pocketbase";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  assignGuide,
  clearGuideAssignment,
  postGuideBoard,
  type OpsDispatchRow,
} from "@/lib/opsDispatch";
import { DriverDispatchConsole } from "@/components/ops/DriverDispatchConsole";
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
  opsProductLabelFromLead,
  type OpsGuestRequirements,
} from "@/lib/opsGuestRequirements";
import {
  assertStatusAllowedWithPayment,
  coerceStatusWithPayment,
  statusRequiresPayment,
} from "@/lib/paymentGate";
import {
  opsLabelForUnifiedStatus,
  toUnifiedPbStatus,
} from "@/lib/bookingStatus";
import { GuideDispatchTab } from "@/components/staff/GuideDispatchTab";
import { OpsActivityLogPanel } from "@/components/staff/OpsActivityLogPanel";
import { SingleBookingCommsTab } from "@/components/ops/SingleBookingCommsTab";
import { PaymentMilestoneBar } from "@/components/ops/PaymentMilestoneBar";
import { BulkJourneyDispatchButton } from "@/components/ops/BulkJourneyDispatchButton";
import { NotifyLockDatesButton } from "@/components/ops/NotifyLockDatesButton";
import { GuestRequirementsTab } from "@/components/staff/GuestRequirementsTab";
import {
  listGuideJobsForPnr,
  normalizeGuideJobStatus,
  type GuideJobRow,
} from "@/lib/guideJobs";
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
import { journeyItineraryHref } from "@/lib/builderRoutes";

type InspectorTab =
  | "requirements"
  | "status"
  | "guide"
  | "driver"
  | "tickets"
  | "activity"
  | "comms";

const INSPECTOR_TABS: Array<{ id: InspectorTab; label: string }> = [
  { id: "requirements", label: "1. Guest Requirements" },
  { id: "status", label: "2. Booking Status" },
  { id: "guide", label: "3. Guide Dispatch" },
  { id: "driver", label: "4. Driver Dispatch" },
  { id: "tickets", label: "5. Tickets & Logistics" },
  { id: "activity", label: "6. Activity & Logs" },
  { id: "comms", label: "7. COMMS & REMINDERS" },
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
      style: "border-slate-300 bg-slate-100 text-slate-600",
    };
  }

  const start = new Date(
    rawDate.includes("T") ? rawDate : `${rawDate.slice(0, 10)}T12:00:00`
  );
  if (Number.isNaN(start.getTime())) {
    return {
      label: "TIMING NOT SET",
      style: "border-slate-300 bg-slate-100 text-slate-600",
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
      style: "border-amber-500/40 bg-amber-50 text-amber-800",
    };
  }

  if (diffMonths >= 3) {
    return {
      label: "💳 30% DEPOSIT ONLY (Defer Guide Assignment)",
      style: "border-blue-500/40 bg-blue-50 text-blue-800",
    };
  }

  return {
    label: "✅ COLLECT PAYMENT FIRST (Assign Guide Later)",
    style: "border-emerald-500/40 bg-emerald-50 text-emerald-800",
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
      <h3 className="font-sans text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
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
  const [guideJobs, setGuideJobs] = useState<GuideJobRow[]>([]);
  const [saveVersion, setSaveVersion] = useState<number | null>(null);
  const [balUpdated, setBalUpdated] = useState<string | null>(null);
  const [productLabel, setProductLabel] = useState("");
  /** BAL `bookings_and_leads.type` for this PNR — Journey routing discriminator. */
  const [leadType, setLeadType] = useState("");
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
    setProductLabel("");
    setLeadType("");
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
            type?: string;
            selections?: unknown;
            duration_label?: string;
            duration_value?: number;
          }>(`booking_ref="${pnr}"`, { requestKey: null });
        if (cancelled) return;
        const ver = Number(bal.save_version);
        setSaveVersion(Number.isFinite(ver) && ver > 0 ? ver : null);
        setBalUpdated(
          String(bal.last_saved_at || bal.updated || "").trim() || null
        );
        setLeadType(String(bal.type || ""));
        setProductLabel(
          opsProductLabelFromLead({
            type: bal.type,
            selections: bal.selections,
            durationLabel: bal.duration_label,
            durationValue: bal.duration_value,
          })
        );
      } catch {
        if (!cancelled) {
          setSaveVersion(null);
          setBalUpdated(null);
          setProductLabel("");
          setLeadType("");
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

  const reloadGuideJobs = async () => {
    const pnr = String(row.pnr || "")
      .trim()
      .toUpperCase();
    if (!pnr) {
      setGuideJobs([]);
      return;
    }
    try {
      setGuideJobs(await listGuideJobsForPnr(pb, pnr));
    } catch {
      setGuideJobs([]);
    }
  };

  useEffect(() => {
    void reloadGuideJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pb, row.pnr, activeTab]);

  /** Prefer guide_jobs rollup when present; else ops_dispatch guide_mode/response. */
  const guideStatus = useMemo(() => {
    if (guideJobs.length > 0) {
      const statuses = guideJobs.map((j) => normalizeGuideJobStatus(j.status));
      if (statuses.some((s) => s === "ACCEPTED" || s === "COMPLETED")) {
        return "guide_confirmed" as const;
      }
      if (statuses.some((s) => s === "OFFERED")) {
        return "pending_guide_acceptance" as const;
      }
      if (statuses.some((s) => s === "OPEN_BOARD")) {
        return "posted_open_board" as const;
      }
      if (statuses.some((s) => s === "REJECTED")) {
        return "refused" as const;
      }
      const hasAssigned = guideJobs.some(
        (j) => Boolean(String(j.assigned_guide_staff_id || "").trim())
      );
      if (hasAssigned) return "pending_guide_acceptance" as const;
      return "unassigned" as const;
    }
    return normalizeGuideConfirmStatus(dispatch?.guide_mode, {
      boardVisible: Boolean(dispatch?.guide_board_visible),
      assignedGuideId: dispatch?.assigned_guide_id,
      guideResponse: dispatch?.guide_response,
    });
  }, [
    guideJobs,
    dispatch?.guide_mode,
    dispatch?.guide_board_visible,
    dispatch?.assigned_guide_id,
    dispatch?.guide_response,
  ]);

  const guidePillTone =
    guideStatus === "guide_confirmed"
      ? ("ok" as const)
      : guideStatus === "unassigned"
        ? ("neutral" as const)
        : ("warn" as const);

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
    return opsLabelForUnifiedStatus(
      toUnifiedPbStatus(effective, {
        hasPaidFull: paymentConfirmed,
        depositPaidEur: row.concierge_fee_paid ? 60 : 0,
      })
    );
  }, [status, paymentConfirmed, row.concierge_fee_paid]);

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
        const prevAgentId = String(row.assigned_agent_id || "").trim();
        const agentChanged = nextAgentId !== prevAgentId;
        // Assignment is immediate — no pending-accept flow.
        const nextAgentResponse: "none" | "accepted" = nextAgentId
          ? "accepted"
          : "none";
        const agentDisplayName =
          agent?.name ||
          agent?.email ||
          (staffId && nextAgentId === String(staffId) ? staffName : "") ||
          (agentChanged ? "" : row.assigned_agent) ||
          "";

        if (payload) {
          setStatus(nextStatusRaw);
          setPaymentConfirmed(nextPayment);
          setAgentId(nextAgentId);
        }

        const hubPatch: Record<string, unknown> = {
          status: nextStatus,
          payment_confirmed: nextPayment,
          tour_payment_status: nextTourPay,
          assigned_agent_id: nextAgentId,
          assigned_agent: agentDisplayName,
          agent_response: nextAgentResponse,
        };
        try {
          await pb
            .collection("ops_hub")
            .update(row.id, hubPatch, { requestKey: null });
        } catch (e) {
          // Pre-migration: agent_response select may not exist yet
          const msg = formatPbError(e);
          if (
            "agent_response" in hubPatch &&
            (msg.includes("agent_response") || msg.includes("Unknown field"))
          ) {
            const { agent_response: _drop, ...rest } = hubPatch;
            await pb
              .collection("ops_hub")
              .update(row.id, rest, { requestKey: null });
          } else {
            throw e;
          }
        }
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
      {/* Compact PNR header — solid dark island on cream shell */}
      <div className="shrink-0 border-b border-slate-200 px-3 pt-3 pb-2 sm:px-4">
        <div className="rounded-xl border border-zinc-700 bg-[#23262c] p-3 text-white shadow-lg">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-[0.8025rem] font-semibold tracking-wide text-cyan-300">
                  PNR {row.pnr}
                </span>
                {!headerCollapsed ? (
                  <span className="text-[10.7px] text-white/50">
                    {row.source === "agency" ? "B2B Agency" : "Direct"}
                    {saveVersion != null ? ` · Rev ${saveVersion}` : ""}
                  </span>
                ) : null}
              </div>
              {(productLabel || reqs?.productLabel) ? (
                <p className="mt-0.5 truncate text-[11px] text-white/60">
                  {productLabel || reqs?.productLabel}
                </p>
              ) : null}
              {!headerCollapsed &&
              reqs?.guestName?.trim() &&
              reqs.guestName !== "—" ? (
                <p className="mt-0.5 truncate text-[11px] text-white/70">
                  {reqs.guestName.trim()}
                </p>
              ) : null}
            </div>
            <div className="min-w-0 max-w-[14rem] text-center sm:max-w-[18rem]">
              <p className="truncate text-[0.9rem] font-bold leading-snug text-white">
                {[row.primary_city || "—", paxLabel].join(" · ")}
              </p>
              <p className="mt-0.5 truncate text-xs text-white/60">
                {row.tour_date ? String(row.tour_date).slice(0, 10) : "—"}
                {!headerCollapsed && row.guest_summary
                  ? ` · ${row.guest_summary}`
                  : ""}
                {!headerCollapsed
                  ? ` · Last mod ${formatLastModified(balUpdated || row.updated)}`
                  : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setHeaderCollapsed((v) => !v)}
                className="rounded-lg bg-white/10 px-3 py-1 text-[10px] font-semibold tracking-wide text-white uppercase transition hover:bg-white/20"
              >
                {headerCollapsed ? "Expand" : "Compact"}
              </button>
              {row.pnr ? (
                <a
                  href={journeyItineraryHref(row.pnr, {
                    type: leadType || undefined,
                    productLabel:
                      productLabel || reqs?.productLabel || undefined,
                  })}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-[#F6A724] px-3 py-1 text-[10px] font-bold tracking-wide text-black uppercase transition hover:bg-[#ffb63e]"
                  title="Open the guest Journey dossier for this PNR (1-Day Express Pass → Single-Day Builder, otherwise Grand Japan Journey)"
                >
                  View Journey
                </a>
              ) : null}
            </div>
          </div>
          {!headerCollapsed ? (
            <div className="mt-2.5 flex flex-wrap gap-2">
              <StatusPill label="Booking" value={bookingStatusLabel} tone="info" />
              <StatusPill
                label="Guide"
                value={guideConfirmStaffLabel(guideStatus)}
                tone={guidePillTone}
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
              <PaymentMilestoneBar hub={row} compact />
              <StatusPill
                label="Guide"
                value={guideConfirmStaffLabel(guideStatus)}
                tone={guidePillTone}
              />
            </div>
          )}
          {!headerCollapsed ? (
            <div className="mt-3 space-y-2">
              <PaymentMilestoneBar hub={row} />
              <NotifyLockDatesButton
                pnr={row.pnr}
                hub={row}
                pb={pb}
                onDone={() => void onReloadPockets()}
              />
              <BulkJourneyDispatchButton
                pnr={row.pnr}
                hub={row}
                pb={pb}
                onDone={() => void onReloadPockets()}
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* Tabs + content sit on cream; PNR header above stays dark chrome */}
      <div className="flex min-h-0 flex-1 flex-col bg-[#faf9f4]">
      {/* File-folder tab bar */}
      <div className="shrink-0 border-b border-slate-200 px-3 pt-2 pb-0">
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
                    ? "border-amber-500/60 border-b-transparent bg-[#23262c] text-white"
                    : "border-[#23262c]/50 bg-[#23262c]/80 text-zinc-400 hover:bg-[#23262c] hover:text-zinc-200"
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
              <p className="text-xs text-red-600">{reqsError}</p>
            ) : !reqs ? (
              <p className="text-xs text-slate-500">Loading booking context…</p>
            ) : (
              <GuestRequirementsTab
                reqs={reqs}
                langFlag={langFlag}
                guideJobs={guideJobs}
              />
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
              onJobsChanged={async () => {
                await onReloadPockets();
                await reloadGuideJobs();
              }}
            />
          </TabPanel>
        ) : null}

        {activeTab === "driver" ? (
          <TabPanel title="Driver dispatch & transit">
            <DriverDispatchConsole
              pb={pb}
              row={row}
              dispatch={dispatch}
              drivers={drivers}
              reqs={reqs}
              saving={saving}
              staffId={staffId}
              onJobsChanged={async () => {
                await onReloadPockets();
              }}
            />
          </TabPanel>
        ) : null}

        {activeTab === "tickets" ? (
          <TabPanel title="Tickets & logistics">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                Access / ticket purchase status
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900"
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
              <label className="block text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                Ticketer assigned
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900"
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
              guestPaxLabel={paxLabel}
              onReload={() => void onReloadPockets()}
            />

            <details className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                Secondary notes (optional)
              </summary>
              <div className="mt-3 grid gap-3">
                <label className="block text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                  Tickets required / instructions
                  <textarea
                    className="mt-1 h-14 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900"
                    value={ticketNotes}
                    disabled={saving}
                    onChange={(e) => setTicketNotes(e.target.value)}
                    placeholder="Free-text notes for the ticketer (checklist above is primary)"
                  />
                </label>
                <label className="block text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                  Pickup & meeting notes
                  <textarea
                    className="mt-1 h-14 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900"
                    value={pickupNotes}
                    disabled={saving}
                    onChange={(e) => setPickupNotes(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  disabled={saving}
                  className="w-fit rounded-lg border border-slate-300 px-3 py-1.5 text-[11px] text-slate-700 disabled:opacity-40"
                  onClick={() => void saveLogistics()}
                >
                  {saving ? "Saving…" : "Save notes"}
                </button>
              </div>
            </details>
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

        {activeTab === "comms" ? (
          <TabPanel title="Comms & reminders">
            <SingleBookingCommsTab
              row={row}
              pb={pb}
              onSent={() => void onReloadPockets()}
            />
          </TabPanel>
        ) : null}
      </div>
      </div>
    </div>
  );
}
