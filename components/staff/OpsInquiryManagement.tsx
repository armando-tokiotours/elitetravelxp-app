"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { Check, Trash2 } from "lucide-react";
import type PocketBase from "pocketbase";
import {
  type OpsDispatchRow,
} from "@/lib/opsDispatch";
import {
  loadTickets,
  type OpsTicketsRow,
} from "@/lib/opsTickets";
import {
  guideConfirmStaffLabel,
  normalizeGuideConfirmStatus,
} from "@/lib/guideConfirmStatus";
import { coerceStatusWithPayment, statusRequiresPayment } from "@/lib/paymentGate";
import { CANONICAL_STATUSES } from "@/lib/bookingStatus";
import {
  appendBookingLog,
  isoDateOnly,
  isPostTourBooking,
} from "@/lib/bookingLogs";
import { canAccessOpsBoard } from "@/lib/staffRoles";
import { useTeamAuth } from "@/store/useTeamAuth";
import { StaffPortalShell, STAFF_PORTAL_REFRESH_EVENT } from "@/components/staff/StaffPortalShell";
import { OpsBookingInspector } from "@/components/staff/OpsBookingInspector";
import { OpsCommsHub } from "@/components/staff/OpsCommsHub";
import { OpsPaymentStatusBadges } from "@/components/staff/OpsPaymentStatusBadges";
import {
  OpsStatusBadge,
  loadStaffByRole,
  useOpsHubList,
  type OpsHubRow,
  type StaffOption,
} from "@/components/staff/opsHubClient";
import { formatPbError } from "@/lib/pocketbase/admin-schema";

const STATUS_FILTER_PILLS: Array<{ id: string; label: string }> = [
  { id: "all", label: "All" },
  ...CANONICAL_STATUSES.map((s) => ({
    id: s,
    label:
      s === "in_ops"
        ? "In Ops"
        : s.charAt(0).toUpperCase() + s.slice(1),
  })),
  { id: "post_tour", label: "Post-Tour" },
];

const SUPER_ADMIN_EMAIL = "admin@travelexperiencesgroup.com";

function isSuperAdmin(opts: {
  role: string | null;
  email: string | null;
}): boolean {
  const email = String(opts.email || "")
    .trim()
    .toLowerCase();
  return opts.role === "owner" || email === SUPER_ADMIN_EMAIL;
}

export function OpsInquiryManagement() {
  return (
    <StaffPortalShell title="Ops inquiries" allow={canAccessOpsBoard} wide>
      <OpsInquiryInner />
    </StaffPortalShell>
  );
}

function ListRowBadges({
  row,
  dispatch,
  tickets,
}: {
  row: OpsHubRow;
  dispatch?: OpsDispatchRow;
  tickets?: OpsTicketsRow;
}) {
  const guideStatus = normalizeGuideConfirmStatus(dispatch?.guide_mode, {
    boardVisible: Boolean(dispatch?.guide_board_visible),
    assignedGuideId: dispatch?.assigned_guide_id,
    guideResponse: dispatch?.guide_response,
  });
  const ticketStatus = tickets?.ticket_status || row.ticket_status || "none";
  const listStatus = coerceStatusWithPayment(
    row.status,
    Boolean(row.payment_confirmed)
  );
  const guideApprovalPending =
    Boolean(dispatch?.assigned_guide_id) &&
    guideStatus === "pending_guide_acceptance";
  const tixNeeded =
    (row.tickets_needed === true || ticketStatus === "needed") &&
    ticketStatus !== "ordered" &&
    ticketStatus !== "done";

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      <OpsStatusBadge status={listStatus} />
      <OpsPaymentStatusBadges row={row} />
      {guideApprovalPending ? (
        <span className="rounded-md border border-orange-500/40 bg-orange-500/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-orange-300 uppercase">
          Guide approval pending
        </span>
      ) : (
        <span className="rounded-md border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[9px] tracking-wider text-zinc-400 uppercase">
          {guideConfirmStaffLabel(guideStatus)}
        </span>
      )}
      {tixNeeded ? (
        <span className="rounded-md border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-amber-300 uppercase">
          Tix needed
        </span>
      ) : ticketStatus !== "none" ? (
        <span className="rounded-md border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[9px] tracking-wider text-zinc-400 uppercase">
          Tix {ticketStatus}
        </span>
      ) : null}
    </div>
  );
}

async function deleteOpsBookingCascade(
  pb: PocketBase,
  row: OpsHubRow
): Promise<void> {
  const pnr = String(row.pnr || "")
    .trim()
    .toUpperCase()
    .replace(/"/g, "");
  if (!pnr) throw new Error("Missing PNR.");

  // Related ops pockets first
  for (const col of [
    "ops_dispatch",
    "ops_tickets",
    "ops_money",
    "booking_logs",
  ] as const) {
    try {
      const hits = await pb.collection(col).getFullList<{ id: string }>({
        filter: `pnr="${pnr}"`,
        requestKey: null,
      });
      for (const hit of hits) {
        await pb.collection(col).delete(hit.id, { requestKey: null });
      }
    } catch {
      /* collection may be empty / missing */
    }
  }

  // bookings_and_leads by booking_ref
  try {
    const bals = await pb.collection("bookings_and_leads").getFullList<{
      id: string;
    }>({
      filter: `booking_ref="${pnr}"`,
      requestKey: null,
    });
    for (const bal of bals) {
      await pb.collection("bookings_and_leads").delete(bal.id, {
        requestKey: null,
      });
    }
  } catch {
    /* optional */
  }

  // Detail row if linked
  if (row.detail_collection && row.detail_id) {
    try {
      await pb.collection(row.detail_collection).delete(row.detail_id, {
        requestKey: null,
      });
    } catch {
      /* optional */
    }
  }

  await pb.collection("ops_hub").delete(row.id, { requestKey: null });
}

function OpsInquiryInner() {
  const getClient = useTeamAuth((s) => s.getClient);
  const staffId = useTeamAuth((s) => s.staffId);
  const role = useTeamAuth((s) => s.role);
  const email = useTeamAuth((s) => s.email);
  const record = useTeamAuth((s) => s.record);
  const staffName =
    String(record?.name || "").trim() || String(email || "").trim() || "Staff";
  const canDelete = isSuperAdmin({ role, email });
  const { rows, loading, error, reload, setRows } = useOpsHubList(getClient);
  const [guides, setGuides] = useState<StaffOption[]>([]);
  const [drivers, setDrivers] = useState<StaffOption[]>([]);
  const [ticketers, setTicketers] = useState<StaffOption[]>([]);
  const [agents, setAgents] = useState<StaffOption[]>([]);
  const [dispatchByPnr, setDispatchByPnr] = useState<
    Record<string, OpsDispatchRow>
  >({});
  const [ticketsByPnr, setTicketsByPnr] = useState<
    Record<string, OpsTicketsRow>
  >({});
  const [selectedPnr, setSelectedPnr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("incoming");
  const [isCompactView, setIsCompactView] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(380);
  const sidebarWidthRef = useRef(380);
  const isResizing = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(380);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ops_sidebar_width");
      const n = saved ? Number(saved) : NaN;
      if (Number.isFinite(n)) {
        const clamped = Math.min(550, Math.max(280, n));
        setSidebarWidth(clamped);
        sidebarWidthRef.current = clamped;
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = e.clientX - resizeStartX.current;
      const next = Math.min(
        550,
        Math.max(280, resizeStartW.current + delta)
      );
      sidebarWidthRef.current = next;
      setSidebarWidth(next);
    };
    const onUp = () => {
      if (!isResizing.current) return;
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try {
        localStorage.setItem(
          "ops_sidebar_width",
          String(sidebarWidthRef.current)
        );
      } catch {
        /* ignore */
      }
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  const handleSplitterMouseDown = (e: ReactMouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    resizeStartX.current = e.clientX;
    resizeStartW.current = sidebarWidthRef.current;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const reloadPockets = useCallback(async () => {
    const pb = getClient();
    try {
      const list = await pb
        .collection("ops_dispatch")
        .getFullList<OpsDispatchRow>({ requestKey: null });
      const map: Record<string, OpsDispatchRow> = {};
      for (const d of list) map[String(d.pnr).toUpperCase()] = d;
      setDispatchByPnr(map);
    } catch {
      setDispatchByPnr({});
    }
    try {
      const list = await loadTickets(pb);
      const map: Record<string, OpsTicketsRow> = {};
      for (const t of list) map[String(t.pnr).toUpperCase()] = t;
      setTicketsByPnr(map);
    } catch {
      setTicketsByPnr({});
    }
  }, [getClient]);

  useEffect(() => {
    const pb = getClient();
    void (async () => {
      setGuides(await loadStaffByRole(pb, "guide"));
      setDrivers(await loadStaffByRole(pb, "driver"));
      setTicketers(await loadStaffByRole(pb, "ticketer"));
      setAgents(await loadStaffByRole(pb, "agent"));
      await reloadPockets();
    })();
  }, [getClient, reloadPockets]);

  // Top-bar Refresh (StaffPortalShell ribbon) reloads inbox + pockets
  useEffect(() => {
    const onRefresh = () => {
      void Promise.all([reload(), reloadPockets()]);
    };
    window.addEventListener(STAFF_PORTAL_REFRESH_EVENT, onRefresh);
    return () => {
      window.removeEventListener(STAFF_PORTAL_REFRESH_EVENT, onRefresh);
    };
  }, [reload, reloadPockets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => {
      const postTour = isPostTourBooking(r);
      const effective = coerceStatusWithPayment(
        r.status,
        Boolean(r.payment_confirmed)
      );

      if (statusFilter === "post_tour") {
        if (!postTour) return false;
      } else if (statusFilter !== "all") {
        // Past trips live under Post-Tour, not their original status pill.
        if (postTour) return false;
        if (effective !== statusFilter) return false;
      }

      if (!q) return true;
      const hay = [
        r.pnr,
        r.primary_city,
        r.guest_summary,
        effective,
        r.source,
      ]
        .map((x) => String(x || "").toLowerCase())
        .join(" ");
      return hay.includes(q);
    });

    return [...list].sort((a, b) => {
      // Newest inquiries first (created → updated fallback)
      const dateA = new Date(a.created || a.updated || 0).getTime();
      const dateB = new Date(b.created || b.updated || 0).getTime();
      const safeA = Number.isFinite(dateA) ? dateA : 0;
      const safeB = Number.isFinite(dateB) ? dateB : 0;
      if (safeA !== safeB) return safeB - safeA;
      // Stable tie-break: unread above read within same timestamp
      return Number(Boolean(a.is_read)) - Number(Boolean(b.is_read));
    });
  }, [rows, query, statusFilter]);

  /** Isolated is_read patch — never re-submits full booking JSON */
  const toggleReadStatus = useCallback(
    async (row: OpsHubRow, nextRead: boolean) => {
      const prev = Boolean(row.is_read);
      if (prev === nextRead) return;
      setRows((list) =>
        list.map((r) => (r.id === row.id ? { ...r, is_read: nextRead } : r))
      );
      const pb = getClient();
      try {
        await pb.collection("ops_hub").update(
          row.id,
          { is_read: nextRead },
          { requestKey: null }
        );
      } catch (error) {
        console.error("Failed to update is_read on ops_hub:", error);
        setRows((list) =>
          list.map((r) => (r.id === row.id ? { ...r, is_read: prev } : r))
        );
      }
    },
    [getClient, setRows]
  );

  const markInquiryRead = useCallback(
    async (row: OpsHubRow) => {
      if (Boolean(row.is_read)) return;
      await toggleReadStatus(row, true);
      const pb = getClient();
      const now = isoDateOnly();
      try {
        await pb.collection("ops_hub").update(
          row.id,
          {
            last_action_by: staffId || "",
            last_action_date: now,
          },
          { requestKey: null }
        );
      } catch {
        /* non-blocking CRM touch */
      }
      void appendBookingLog(pb, {
        pnr: row.pnr,
        opsHubId: row.id,
        staffId,
        staffName,
        actionType: "opened",
        details: `${staffName} opened inquiry ${String(row.pnr).toUpperCase()}`,
      });
    },
    [getClient, staffId, staffName, toggleReadStatus]
  );

  useEffect(() => {
    if (!filtered.length) {
      setSelectedPnr(null);
      return;
    }
    const exists = selectedPnr
      ? filtered.some((r) => String(r.pnr).toUpperCase() === selectedPnr)
      : false;
    if (!exists) {
      setSelectedPnr(String(filtered[0].pnr).toUpperCase());
    }
  }, [filtered, selectedPnr]);

  // One-shot heal: Confirmed+unpaid → incoming (no reload loop)
  useEffect(() => {
    const bad = rows.filter(
      (r) =>
        !Boolean(r.payment_confirmed) && statusRequiresPayment(r.status)
    );
    if (!bad.length) return;
    const pb = getClient();
    let cancelled = false;
    void (async () => {
      const { syncDetailStatusFromOpsHub } = await import(
        "@/lib/syncOpsStatusToDetail"
      );
      let healed = 0;
      for (const r of bad) {
        if (cancelled) break;
        try {
          await pb.collection("ops_hub").update(
            r.id,
            { status: "incoming" },
            { requestKey: null }
          );
          await syncDetailStatusFromOpsHub(
            pb,
            {
              source: r.source,
              detail_collection: r.detail_collection,
              detail_id: r.detail_id,
              pnr: r.pnr,
            },
            "incoming"
          );
          healed += 1;
        } catch {
          /* non-blocking */
        }
      }
      if (!cancelled && healed > 0) await reload();
    })();
    return () => {
      cancelled = true;
    };
    // Only when the set of illegal ids changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rows
      .filter(
        (r) =>
          !Boolean(r.payment_confirmed) && statusRequiresPayment(r.status)
      )
      .map((r) => r.id)
      .join(","),
  ]);

  const selected = useMemo(
    () =>
      rows.find((r) => String(r.pnr).toUpperCase() === selectedPnr) || null,
    [rows, selectedPnr]
  );

  const withSave = async (
    key: string,
    fn: () => Promise<void>,
    okMsg: string
  ) => {
    setSavingId(key);
    setMsg(null);
    try {
      await fn();
      setMsg(okMsg);
      await Promise.all([reload(), reloadPockets()]);
    } catch (e) {
      setMsg(formatPbError(e));
    } finally {
      setSavingId(null);
    }
  };

  const onDeleteBooking = async (row: OpsHubRow) => {
    if (!canDelete) return;
    const pnr = String(row.pnr).toUpperCase();
    const ok = window.confirm(
      `Are you sure you want to permanently delete this booking?\n\n${pnr}`
    );
    if (!ok) return;
    setSavingId(`delete-${row.id}`);
    setMsg(null);
    try {
      await deleteOpsBookingCascade(getClient(), row);
      if (selectedPnr === pnr) setSelectedPnr(null);
      setMsg(`Deleted ${pnr}.`);
      await Promise.all([reload(), reloadPockets()]);
    } catch (e) {
      setMsg(formatPbError(e));
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-zinc-400">Loading inquiries…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  return (
    <div className="relative flex h-[calc(100vh-4.5rem)] min-h-[32rem] flex-col gap-1.5">
      {msg ? <p className="text-sm text-[#7ec8e3]">{msg}</p> : null}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-10 text-center text-sm text-zinc-500">
          No ops_hub rows yet — create a builder booking first.
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60">
          {/* Left pane — inquiry list (resizable on lg+) */}
          <aside
            style={
              {
                ["--ops-sidebar-w"]: `${sidebarWidth}px`,
              } as CSSProperties
            }
            className="flex min-h-0 w-full flex-col border-b border-zinc-800 lg:w-[var(--ops-sidebar-w)] lg:shrink-0 lg:border-r lg:border-b-0"
          >
            <div className="shrink-0 space-y-2 border-b border-zinc-800 px-3 py-2">
              <div className="flex items-center gap-2">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search PNR, city, guests…"
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:border-[#075473] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setIsCompactView((v) => !v)}
                  title={
                    isCompactView
                      ? "Switch to Detailed View"
                      : "Switch to Compact View"
                  }
                  className={`flex shrink-0 items-center justify-center rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                    isCompactView
                      ? "border-[#075473] bg-[#075473] text-white"
                      : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
                  }`}
                >
                  {isCompactView ? "☰ Detailed" : "☵ Compact"}
                </button>
              </div>
              <div className="flex gap-1 overflow-x-auto pb-0.5">
                <div className="inline-flex min-w-max gap-0.5 rounded-full border border-zinc-700 bg-zinc-900 p-0.5">
                  {STATUS_FILTER_PILLS.map((pill) => {
                    const active = statusFilter === pill.id;
                    return (
                      <button
                        key={pill.id}
                        type="button"
                        onClick={() => setStatusFilter(pill.id)}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide whitespace-nowrap transition ${
                          active
                            ? "bg-[#0B1F3A] text-white"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {pill.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="text-[10px] text-zinc-600">
                {filtered.length} of {rows.length} inquiries
                {isCompactView ? " · compact" : ""}
              </p>
            </div>
            <ul
              className={`min-h-0 flex-1 overflow-y-auto ${
                isCompactView ? "space-y-1 p-1.5" : ""
              }`}
            >
              {filtered.map((row) => {
                const pnr = String(row.pnr).toUpperCase();
                const active = pnr === selectedPnr;
                const unread = !Boolean(row.is_read);
                const postTour = isPostTourBooking(row);
                const listStatus = coerceStatusWithPayment(
                  row.status,
                  Boolean(row.payment_confirmed)
                );

                if (isCompactView) {
                  return (
                    <li key={row.id} className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPnr(pnr);
                          void markInquiryRead(row);
                        }}
                        className={`relative flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition ${
                          active
                            ? "border-[#075473] bg-[#075473]/30 font-bold text-white"
                            : "border-white/5 bg-[#0D1117] text-zinc-300 hover:bg-white/5"
                        }`}
                      >
                        {unread ? (
                          <span
                            className="absolute top-1/2 -left-0.5 h-2 w-2 -translate-y-1/2 animate-pulse rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"
                            aria-label="Unread"
                          />
                        ) : null}
                        <div className="flex min-w-0 items-center gap-2 truncate pl-1">
                          <span className="shrink-0 font-mono text-xs font-bold text-[#F6A724]">
                            {row.pnr}
                          </span>
                          <span className="truncate text-zinc-400">
                            {row.primary_city || "—"}
                          </span>
                          <span className="shrink-0 text-[11px] text-zinc-500">
                            {row.guest_summary || "—"}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${
                              listStatus === "draft"
                                ? "border border-gray-500/30 bg-gray-500/20 text-gray-400"
                                : listStatus === "incoming"
                                  ? "bg-amber-500/20 text-amber-300"
                                  : "bg-blue-500/20 text-blue-300"
                            }`}
                          >
                            {listStatus}
                          </span>
                          <span
                            role="button"
                            tabIndex={0}
                            title={unread ? "Mark as Read" : "Mark as Unread"}
                            aria-label={
                              unread ? "Mark as Read" : "Mark as Unread"
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              void toggleReadStatus(row, unread);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                void toggleReadStatus(row, unread);
                              }
                            }}
                            className={
                              unread
                                ? "rounded bg-blue-500/20 p-0.5 text-blue-300 hover:bg-blue-500/40"
                                : "rounded bg-white/5 p-0.5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
                            }
                          >
                            <Check className="h-3 w-3" aria-hidden />
                          </span>
                          {canDelete ? (
                            <span
                              role="button"
                              tabIndex={0}
                              title={`Delete ${pnr}`}
                              aria-label={`Delete ${pnr}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                void onDeleteBooking(row);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  void onDeleteBooking(row);
                                }
                              }}
                              className="rounded p-0.5 text-red-500/50 hover:bg-red-500/10 hover:text-red-500"
                            >
                              <Trash2 className="h-3 w-3" aria-hidden />
                            </span>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                }

                return (
                  <li key={row.id} className="relative border-b border-zinc-900">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPnr(pnr);
                        void markInquiryRead(row);
                      }}
                      className={`relative w-full px-3 py-2.5 pr-16 text-left transition ${
                        active
                          ? "bg-[#075473]/20"
                          : unread
                            ? "bg-[#0D1117] hover:bg-zinc-900/80"
                            : "hover:bg-zinc-900/80"
                      }`}
                    >
                      {unread ? (
                        <span
                          className={`absolute top-3 h-2 w-2 animate-pulse rounded-full bg-blue-500 ${
                            canDelete ? "right-14" : "right-9"
                          }`}
                          aria-label="Unread"
                        />
                      ) : null}
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-mono text-sm font-semibold text-white">
                          {row.pnr}
                        </p>
                        <span className="mr-8 shrink-0 text-[10px] text-zinc-500">
                          {row.tour_date
                            ? String(row.tour_date).slice(0, 10)
                            : "—"}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-zinc-400">
                        {row.primary_city || "—"} ·{" "}
                        {row.guest_summary || "—"}
                      </p>
                      <ListRowBadges
                        row={row}
                        dispatch={dispatchByPnr[pnr]}
                        tickets={ticketsByPnr[pnr]}
                      />
                      {postTour ? (
                        <span
                          role="link"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            const subject = encodeURIComponent(
                              `TokioTours follow-up · ${pnr}`
                            );
                            const body = encodeURIComponent(
                              `Hi,\n\nThank you for traveling with TokioTours (${pnr}). We'd love to hear how your trip went.\n\n— TokioTours Concierge`
                            );
                            window.open(
                              `mailto:?subject=${subject}&body=${body}`,
                              "_blank"
                            );
                            void appendBookingLog(getClient(), {
                              pnr,
                              opsHubId: row.id,
                              staffId,
                              staffName,
                              actionType: "note_added",
                              details: `${staffName} opened follow-up draft for ${pnr}`,
                            });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.currentTarget.click();
                            }
                          }}
                          className="mt-2 inline-flex rounded-md border border-[#F6A724]/35 bg-[#F6A724]/10 px-2 py-1 text-[10px] font-semibold tracking-wide text-[#F6A724] uppercase hover:bg-[#F6A724]/20"
                        >
                          Send follow-up
                        </span>
                      ) : null}
                    </button>
                    <div className="absolute top-2 right-2 flex items-center gap-0.5">
                      <button
                        type="button"
                        title={unread ? "Mark as Read" : "Mark as Unread"}
                        aria-label={
                          unread ? "Mark as Read" : "Mark as Unread"
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          void toggleReadStatus(row, unread);
                        }}
                        className={
                          unread
                            ? "rounded-md bg-blue-500/20 p-1 text-blue-300 transition hover:bg-blue-500/40"
                            : "rounded-md bg-white/5 p-1 text-zinc-500 transition hover:bg-white/10 hover:text-zinc-300"
                        }
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      {canDelete ? (
                        <button
                          type="button"
                          title={`Delete ${pnr}`}
                          aria-label={`Delete ${pnr}`}
                          disabled={savingId === `delete-${row.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void onDeleteBooking(row);
                          }}
                          className="rounded-md p-1 text-red-500/50 transition hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* Draggable vertical splitter — desktop only */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize inquiry list"
            aria-valuemin={280}
            aria-valuemax={550}
            aria-valuenow={sidebarWidth}
            onMouseDown={handleSplitterMouseDown}
            className="group relative z-30 hidden w-1.5 shrink-0 cursor-col-resize items-center justify-center bg-white/5 transition-colors hover:bg-[#075473] active:bg-[#F6A724] lg:flex"
          >
            <div className="h-8 w-0.5 rounded-full bg-gray-500 group-hover:bg-white" />
          </div>

          {/* Right pane — inspector */}
          <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
            {selected ? (
              <OpsBookingInspector
                row={selected}
                dispatch={
                  dispatchByPnr[String(selected.pnr).toUpperCase()]
                }
                tickets={ticketsByPnr[String(selected.pnr).toUpperCase()]}
                guides={guides}
                drivers={drivers}
                ticketers={ticketers}
                agents={agents}
                saving={Boolean(savingId)}
                staffId={staffId}
                pb={getClient()}
                onSave={withSave}
                onReloadPockets={reloadPockets}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-sm text-zinc-500">
                Select an inquiry
              </div>
            )}
          </div>
        </div>
      )}

      <OpsCommsHub
        pb={getClient()}
        pnr={selectedPnr}
        opsHubId={selected?.id}
        staffId={staffId}
        staffName={staffName}
        assignedAgentName={
          selected?.assigned_agent ||
          agents.find((a) => a.id === selected?.assigned_agent_id)?.name ||
          null
        }
        assignedAgentId={selected?.assigned_agent_id || null}
        assignedAgentEmail={
          agents.find((a) => a.id === selected?.assigned_agent_id)?.email ||
          null
        }
        staffRole={role}
        ticketerDirectChatEnabled={Boolean(
          selected?.ticketer_direct_chat_enabled
        )}
        driverDirectChatEnabled={Boolean(selected?.driver_direct_chat_enabled)}
      />
    </div>
  );
}
