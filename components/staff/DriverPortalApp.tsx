"use client";

/**
 * Driver contractor portal — same UX shell as GuidePortalApp
 * (ContractorPortalShell + GuideDrawerNav + dashboard / calendar / invoices /
 * jobs / board / profile) wired to ops_dispatch + hub driver_dispatch legs.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  Loader2,
  Lock,
  MapPin,
  Pencil,
  Receipt,
  RefreshCw,
  Users,
  Wallet,
} from "lucide-react";
import { AliasDisguiseBanner } from "@/components/ops/AliasDisguiseBanner";
import { useAliasSession } from "@/components/ops/useAliasSession";
import {
  OpsStatusBadge,
  loadOpsHub,
  type OpsHubRow,
} from "@/components/staff/opsHubClient";
import { ContractorPortalShell } from "@/components/staff/ContractorPortalShell";
import { GuideDrawerNav } from "@/components/staff/GuideDrawerNav";
import { AvatarCropperModal } from "@/components/staff/AvatarCropperModal";
import { DriverRateSheetEditor } from "@/components/staff/DriverRateSheetEditor";
import { toCanonicalStatus } from "@/lib/bookingStatus";
import {
  buildDriverDispatchLegs,
  defaultDriverPickup,
  formatDriverLegPriceEur,
  normalizeDriverLegStatus,
  saveDriverLegAssignment,
  type DriverDispatchLeg,
} from "@/lib/driverDispatch";
import {
  formatGuideJobDateLabel,
  normalizeTourDateIso,
} from "@/lib/guideJobs";
import {
  addMonths,
  formatMonthTitle,
  monthGridDates,
  sameYmd,
  startOfMonth,
  toYmd,
} from "@/lib/opsCalendar";
import { classifyPaymentLane } from "@/lib/opsCalendarStatus";
import {
  claimDriverJob,
  type OpsDispatchRow,
} from "@/lib/opsDispatch";
import {
  loadOpsGuestRequirements,
  type OpsGuestRequirements,
} from "@/lib/opsGuestRequirements";
import {
  loadPayoutsForStaff,
  type OpsPayoutRow,
} from "@/lib/opsPayouts";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  getDriverByStaff,
  updateDriverProfile,
  type DriverProfile,
} from "@/lib/roleProfiles";
import { uploadStaffAvatarViaApi } from "@/lib/staffCredentialClient";
import {
  getCroppedSquareFile,
  staffAvatarSrc,
  type CroppedAreaPixels,
} from "@/lib/staffPhoto";
import {
  combineStaffDisplayName,
  ensureStaffProfile,
  resolveStaffNamePartsForEditor,
  updateStaffProfile,
  type StaffProfile,
} from "@/lib/staffProfiles";
import { canAccessDriver, canAccessOpsBoard } from "@/lib/staffRoles";
import { useTeamAuth } from "@/store/useTeamAuth";

type DriverTab =
  | "dashboard"
  | "calendar"
  | "invoices"
  | "mine"
  | "board"
  | "profile";

/** Unified driver job card — PNR-level dispatch and/or per-leg chauffeur lines. */
export type DriverPortalJob = {
  id: string;
  pnr: string;
  title: string;
  serviceDate: string;
  city: string;
  pax: number;
  pickup: string;
  dropoff: string;
  vehicleTier: string;
  status: "ASSIGNED" | "OPEN_BOARD";
  /** Present when card is a cart transit leg. */
  serviceLineId?: string;
  priceEur?: number;
  driverMode?: string;
  assigned: boolean;
};

type DriverJobGroup = {
  pnr: string;
  jobs: DriverPortalJob[];
};

function todayIso(): string {
  return toYmd(new Date());
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function payoutStatusTone(status?: string): string {
  const s = String(status || "pending").toLowerCase();
  if (s === "paid") return "text-emerald-400";
  if (s === "hold") return "text-amber-400";
  return "text-[#F6A724]";
}

/** Same payment gate Guide uses for “Next tour”. */
function isClientPaymentReady(hub?: OpsHubRow | null): boolean {
  if (!hub) return false;
  const lane = classifyPaymentLane(hub);
  if (lane.paymentLane === "confirmed" || lane.datesLocked) return true;
  const tourPay = String(hub.tour_payment_status || "")
    .trim()
    .toUpperCase();
  if (
    tourPay === "PARTIALLY_PAID" ||
    tourPay === "FULLY_PAID" ||
    Boolean(hub.payment_confirmed)
  ) {
    return true;
  }
  const bookingRaw = String(hub.status || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (
    bookingRaw === "DEPOSIT_PAID" ||
    bookingRaw === "CONFIRMED" ||
    bookingRaw === "PENDING_BALANCE" ||
    bookingRaw === "FULLY_PAID"
  ) {
    return true;
  }
  const canonical = toCanonicalStatus(hub.status);
  return (
    canonical === "confirmed" ||
    canonical === "in_ops" ||
    canonical === "done"
  );
}

function partyCompositionLabel(brief?: OpsGuestRequirements | null): string {
  if (!brief) return "—";
  const parts = [
    brief.adults > 0
      ? `${brief.adults} adult${brief.adults === 1 ? "" : "s"}`
      : null,
    brief.children > 0
      ? `${brief.children} child${brief.children === 1 ? "" : "ren"}`
      : null,
    brief.infants > 0
      ? `${brief.infants} infant${brief.infants === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
}

function jobPartyCityLine(opts: {
  brief?: OpsGuestRequirements | null;
  hub?: OpsHubRow | null;
  job?: DriverPortalJob | null;
}): string {
  const party = partyCompositionLabel(opts.brief);
  const paxFallback = opts.job
    ? `${Math.max(1, Number(opts.job.pax) || 1)} pax`
    : null;
  const partyBit =
    party !== "—"
      ? party
      : opts.hub?.guest_summary?.trim() || paxFallback || null;
  const city =
    String(opts.job?.city || "").trim() ||
    String(opts.hub?.primary_city || "").trim() ||
    "";
  return [partyBit, city].filter(Boolean).join(" · ");
}

function meetingPointLabel(brief?: OpsGuestRequirements | null): string {
  if (!brief) return "";
  const name = String(brief.meetingPointName || "").trim();
  const addr = String(brief.meetingPointAddress || "").trim();
  if (name && addr && name !== addr) return `${name} — ${addr}`;
  return name || addr || "";
}

function resolvePickupDisplay(opts: {
  job: DriverPortalJob;
  hub?: OpsHubRow | null;
  brief?: OpsGuestRequirements | null;
}): string {
  const fromJob = String(opts.job.pickup || "").trim();
  if (fromJob) return fromJob;
  const notes = String(opts.hub?.pickup_notes || "").trim();
  if (notes) return notes;
  return (
    meetingPointLabel(opts.brief) ||
    defaultDriverPickup({ reqs: opts.brief, hub: opts.hub }) ||
    ""
  );
}

/**
 * Guest contact for assigned jobs — mirror Guide: party / name from brief,
 * WhatsApp only when Ops enabled driver direct chat or payment confirmed
 * (Guide itself does not surface guest phone on job cards).
 */
function guestContactForAssigned(opts: {
  hub?: OpsHubRow | null;
  brief?: OpsGuestRequirements | null;
  assigned: boolean;
}): { name: string; phone: string; showPhone: boolean } {
  if (!opts.assigned) {
    return { name: "", phone: "", showPhone: false };
  }
  const name = String(opts.brief?.guestName || "").trim();
  const phone = String(opts.brief?.guestPhone || "").trim();
  const showPhone =
    Boolean(opts.hub?.driver_direct_chat_enabled) ||
    Boolean(opts.hub?.payment_confirmed) ||
    isClientPaymentReady(opts.hub);
  return {
    name: name && name !== "—" ? name : "",
    phone: phone && phone !== "—" ? phone : "",
    showPhone,
  };
}

function legToPortalJob(
  pnr: string,
  leg: DriverDispatchLeg
): DriverPortalJob | null {
  const status = normalizeDriverLegStatus(leg.status);
  if (status === "UNASSIGNED") return null;
  const assigned = Boolean(leg.assignedDriverId) && status === "ASSIGNED";
  return {
    id: `${pnr}:${leg.serviceLineId}`,
    pnr,
    title: leg.title || "Private chauffeur / transfer",
    serviceDate: leg.serviceDate,
    city: leg.city,
    pax: leg.pax,
    pickup: leg.pickup,
    dropoff: leg.dropoff,
    vehicleTier: leg.vehicleTier,
    status: assigned ? "ASSIGNED" : "OPEN_BOARD",
    serviceLineId: leg.serviceLineId,
    priceEur: leg.priceEur,
    assigned,
  };
}

function legacyDispatchJob(
  d: OpsDispatchRow,
  hub?: OpsHubRow | null,
  brief?: OpsGuestRequirements | null
): DriverPortalJob {
  const assigned = Boolean(String(d.assigned_driver_id || "").trim());
  const mode = String(d.driver_mode || "").toLowerCase();
  const open =
    !assigned &&
    (d.driver_board_visible === true || mode === "open");
  const pickup =
    String(hub?.pickup_notes || "").trim() ||
    defaultDriverPickup({ reqs: brief, hub }) ||
    "";
  return {
    id: `dispatch:${d.id}`,
    pnr: String(d.pnr || "").trim().toUpperCase(),
    title: "Chauffeur / transfer day",
    serviceDate: normalizeTourDateIso(hub?.tour_date) || "",
    city: String(hub?.primary_city || "").trim(),
    pax: Math.max(
      1,
      (brief?.adults || 0) + (brief?.children || 0) + (brief?.infants || 0) ||
        1
    ),
    pickup,
    dropoff: "",
    vehicleTier: "",
    status: assigned ? "ASSIGNED" : open ? "OPEN_BOARD" : "ASSIGNED",
    driverMode: String(d.driver_mode || ""),
    assigned,
  };
}

export function DriverPortalApp() {
  const [profileSignal, setProfileSignal] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <ContractorPortalShell
      title="Driver portal"
      allow={canAccessDriver}
      loginTitle="Driver login"
      loginSubtitle="Email + password for your chauffeur account. Assigned pickups only — not the Ops Super User desk."
      onProfileClick={() => setProfileSignal((n) => n + 1)}
      onMenuClick={() => setDrawerOpen(true)}
    >
      <DriverPortalInner
        profileSignal={profileSignal}
        drawerOpen={drawerOpen}
        onCloseDrawer={() => setDrawerOpen(false)}
      />
    </ContractorPortalShell>
  );
}

function DriverPortalInner({
  profileSignal,
  drawerOpen,
  onCloseDrawer,
}: {
  profileSignal: number;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}) {
  const router = useRouter();
  const logout = useTeamAuth((s) => s.logout);
  const getClient = useTeamAuth((s) => s.getClient);
  const role = useTeamAuth((s) => s.role);
  const staffId = useTeamAuth((s) => s.staffId);
  const email = useTeamAuth((s) => s.email);
  const record = useTeamAuth((s) => s.record);
  const { alias, clearAlias } = useAliasSession();

  const [tab, setTab] = useState<DriverTab>("dashboard");
  const [prevProfileSignal, setPrevProfileSignal] = useState(profileSignal);
  if (profileSignal !== prevProfileSignal) {
    setPrevProfileSignal(profileSignal);
    if (profileSignal > 0) setTab("profile");
  }

  const [hubByPnr, setHubByPnr] = useState<Record<string, OpsHubRow>>({});
  const [briefByPnr, setBriefByPnr] = useState<
    Record<string, OpsGuestRequirements>
  >({});
  const [myJobs, setMyJobs] = useState<DriverPortalJob[]>([]);
  const [boardJobs, setBoardJobs] = useState<DriverPortalJob[]>([]);
  const [payouts, setPayouts] = useState<OpsPayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() =>
    startOfMonth(new Date())
  );
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const isAliasPreview =
    canAccessOpsBoard(role) &&
    !!alias &&
    alias.roleType === "driver" &&
    !!alias.userId;

  const effectiveStaffId = isAliasPreview ? alias.userId : staffId;
  const effectiveEmail = isAliasPreview
    ? alias.userEmail || email
    : email;

  const staffName = isAliasPreview
    ? String(alias.displayName || alias.userEmail || "Aliased staff").trim()
    : String(
        (record as { name?: string } | null)?.name || record?.email || ""
      ).trim() || "Staff";

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pb = getClient();
      const [hubs, dispatchRows, payoutList] = await Promise.all([
        loadOpsHub(pb),
        pb
          .collection("ops_dispatch")
          .getFullList<OpsDispatchRow>({
            sort: "-updated",
            requestKey: null,
          })
          .catch(() => [] as OpsDispatchRow[]),
        effectiveStaffId
          ? loadPayoutsForStaff(pb, effectiveStaffId).then((list) =>
              list.filter((p) => p.role === "driver")
            )
          : role === "owner" || role === "ops"
            ? pb
                .collection("ops_payouts")
                .getFullList<OpsPayoutRow>({
                  filter: `role="driver"`,
                  sort: "-updated",
                  requestKey: null,
                })
            : Promise.resolve([] as OpsPayoutRow[]),
      ]);

      const map: Record<string, OpsHubRow> = {};
      for (const h of hubs) map[String(h.pnr).toUpperCase()] = h;
      setHubByPnr(map);
      setPayouts(payoutList);

      const dispatchByPnr: Record<string, OpsDispatchRow> = {};
      for (const d of dispatchRows) {
        dispatchByPnr[String(d.pnr).toUpperCase()] = d;
      }

      const candidatePnrs = new Set<string>();
      for (const d of dispatchRows) {
        const pnr = String(d.pnr || "").trim().toUpperCase();
        if (!pnr) continue;
        if (
          d.assigned_driver_id ||
          d.driver_board_visible ||
          d.driver_mode === "open" ||
          d.driver_needed !== false
        ) {
          candidatePnrs.add(pnr);
        }
      }
      for (const h of hubs) {
        const pnr = String(h.pnr || "").trim().toUpperCase();
        if (!pnr) continue;
        if (
          h.assigned_driver_id ||
          h.driver_needed === true ||
          Boolean(h.extras)
        ) {
          candidatePnrs.add(pnr);
        }
      }

      const briefMap: Record<string, OpsGuestRequirements> = {};
      await Promise.all(
        Array.from(candidatePnrs).map(async (pnr) => {
          const hub = map[pnr];
          if (!hub) return;
          try {
            briefMap[pnr] = await loadOpsGuestRequirements(pb, hub);
          } catch {
            /* optional enrichment */
          }
        })
      );
      setBriefByPnr(briefMap);

      const mine: DriverPortalJob[] = [];
      const board: DriverPortalJob[] = [];

      for (const pnr of candidatePnrs) {
        const hub = map[pnr];
        const dispatch = dispatchByPnr[pnr];
        const brief = briefMap[pnr];
        if (!hub && !dispatch) continue;

        const legs = hub
          ? buildDriverDispatchLegs({
              hub,
              dispatch,
              reqs: brief,
              paxCount:
                (brief?.adults || 0) +
                  (brief?.children || 0) +
                  (brief?.infants || 0) || undefined,
            })
          : [];

        if (legs.length > 0) {
          for (const leg of legs) {
            const job = legToPortalJob(pnr, leg);
            if (!job) continue;
            if (
              effectiveStaffId &&
              leg.assignedDriverId === effectiveStaffId
            ) {
              mine.push({ ...job, assigned: true, status: "ASSIGNED" });
            } else if (normalizeDriverLegStatus(leg.status) === "OPEN_BOARD") {
              board.push({ ...job, assigned: false, status: "OPEN_BOARD" });
            }
          }
          continue;
        }

        // Legacy PNR-level ops_dispatch (no cart transit legs).
        if (!dispatch) continue;
        const assignedId = String(dispatch.assigned_driver_id || "").trim();
        const mode = String(dispatch.driver_mode || "").toLowerCase();
        const onBoard =
          (dispatch.driver_board_visible === true || mode === "open") &&
          !assignedId;
        if (effectiveStaffId && assignedId === effectiveStaffId) {
          mine.push(legacyDispatchJob(dispatch, hub, brief));
        } else if (onBoard && dispatch.driver_needed !== false) {
          board.push(legacyDispatchJob(dispatch, hub, brief));
        }
      }

      const sortJobs = (a: DriverPortalJob, b: DriverPortalJob) => {
        const da = a.serviceDate || "";
        const db = b.serviceDate || "";
        if (da !== db) return da.localeCompare(db);
        return a.title.localeCompare(b.title);
      };
      setMyJobs(mine.sort(sortJobs));
      setBoardJobs(board.sort(sortJobs));
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setLoading(false);
    }
  }, [effectiveStaffId, getClient, role]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const groupJobs = useCallback((jobs: DriverPortalJob[]): DriverJobGroup[] => {
    const map = new Map<string, DriverPortalJob[]>();
    for (const job of jobs) {
      const pnr = String(job.pnr || "UNKNOWN").trim().toUpperCase();
      const list = map.get(pnr) || [];
      list.push(job);
      map.set(pnr, list);
    }
    return Array.from(map.entries()).map(([pnr, list]) => ({
      pnr,
      jobs: [...list].sort((a, b) => {
        const da = a.serviceDate || "";
        const db = b.serviceDate || "";
        if (da !== db) return da.localeCompare(db);
        return a.title.localeCompare(b.title);
      }),
    }));
  }, []);

  const groupedMine = useMemo(
    () => groupJobs(myJobs),
    [groupJobs, myJobs]
  );
  const groupedBoard = useMemo(
    () => groupJobs(boardJobs),
    [groupJobs, boardJobs]
  );

  const today = todayIso();
  const upcomingJobs = useMemo(
    () =>
      myJobs
        .filter((j) => {
          const d = normalizeTourDateIso(j.serviceDate);
          return !d || d >= today;
        })
        .sort((a, b) =>
          String(a.serviceDate || "").localeCompare(String(b.serviceDate || ""))
        ),
    [myJobs, today]
  );

  const nextJob = useMemo(() => {
    const eligible = myJobs
      .filter((j) => {
        const d = normalizeTourDateIso(j.serviceDate);
        if (d && d < today) return false;
        const hub = hubByPnr[String(j.pnr || "").trim().toUpperCase()];
        return isClientPaymentReady(hub);
      })
      .sort((a, b) =>
        String(a.serviceDate || "").localeCompare(String(b.serviceDate || ""))
      );
    return eligible[0] || upcomingJobs[0] || null;
  }, [hubByPnr, myJobs, today, upcomingJobs]);

  const thisMonthKey = monthKey(new Date());
  const monthlyEarnings = useMemo(() => {
    return payouts
      .filter((p) => {
        const updated = String(p.updated || p.created || "").slice(0, 7);
        return updated === thisMonthKey;
      })
      .reduce((sum, p) => sum + Math.max(0, Number(p.amount_jpy) || 0), 0);
  }, [payouts, thisMonthKey]);

  const pendingPayouts = useMemo(
    () =>
      payouts.filter((p) => {
        const s = String(p.status || "pending").toLowerCase();
        return s === "pending" || s === "hold";
      }),
    [payouts]
  );
  const settledPayouts = useMemo(
    () =>
      payouts.filter((p) => String(p.status || "").toLowerCase() === "paid"),
    [payouts]
  );

  const calendarJobsByDay = useMemo(() => {
    const map = new Map<string, DriverPortalJob[]>();
    for (const job of myJobs) {
      const d = normalizeTourDateIso(job.serviceDate);
      if (!d) continue;
      const list = map.get(d) || [];
      list.push(job);
      map.set(d, list);
    }
    return map;
  }, [myJobs]);

  const calendarCells = useMemo(
    () => monthGridDates(calendarMonth),
    [calendarMonth]
  );

  const onClaim = async (job: DriverPortalJob) => {
    if (isAliasPreview) {
      setMsg("Alias preview is read-only — exit disguise to claim as yourself.");
      return;
    }
    if (!staffId) {
      setMsg("Sign in as driver staff to claim.");
      return;
    }
    setClaiming(job.id);
    setMsg(null);
    try {
      const pb = getClient();
      if (job.serviceLineId) {
        await saveDriverLegAssignment(pb, {
          pnr: job.pnr,
          leg: {
            serviceLineId: job.serviceLineId,
            pickup: job.pickup,
            dropoff: job.dropoff,
            vehicleTier: job.vehicleTier,
            assignedDriverId: staffId,
            assignedDriverName: staffName,
            status: "ASSIGNED",
          },
        });
      } else {
        await claimDriverJob(pb, {
          pnr: job.pnr,
          staffId,
          staffName,
        });
      }
      setMsg(`Accepted ${job.pnr}`);
      setTab("mine");
      await reload();
    } catch (e) {
      setMsg(formatPbError(e));
    } finally {
      setClaiming(null);
    }
  };

  const tabs: Array<{
    id: DriverTab;
    label: string;
    icon: typeof LayoutDashboard;
    count?: number;
  }> = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "calendar", label: "My Calendar", icon: CalendarDays },
    { id: "invoices", label: "Invoices", icon: Receipt },
    {
      id: "mine",
      label: "My Jobs",
      icon: ClipboardList,
      count: myJobs.length,
    },
    {
      id: "board",
      label: "Open Board",
      icon: Wallet,
      count: boardJobs.length,
    },
  ];

  return (
    <div className="space-y-4">
      {isAliasPreview && alias ? (
        <AliasDisguiseBanner
          alias={alias}
          compact
          onExit={() => {
            clearAlias();
            setMsg(null);
            void reload();
          }}
        />
      ) : null}

      <div className="flex items-center gap-2">
        <p className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
          {tab === "profile"
            ? "Profile"
            : tabs.find((t) => t.id === tab)?.label || ""}
        </p>
        <button
          type="button"
          onClick={() => void reload()}
          title="Refresh data"
          className="ml-auto inline-flex items-center gap-1 rounded-lg border border-transparent p-1.5 text-xs font-bold text-zinc-400 transition hover:border-white/10 hover:bg-white/10 hover:text-white"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      <GuideDrawerNav
        open={drawerOpen}
        onClose={onCloseDrawer}
        items={tabs}
        activeId={tab}
        onSelect={(id) => setTab(id as DriverTab)}
        userName={staffName}
        userEmail={effectiveEmail || undefined}
        avatarUrl={staffAvatarSrc(effectiveStaffId)}
        onProfile={() => setTab("profile")}
        onRefresh={() => void reload()}
        onSignOut={() => {
          logout();
          router.replace("/login");
        }}
        loading={loading}
      />

      {msg ? <p className="text-sm text-[#7dd3fc]">{msg}</p> : null}
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : tab === "dashboard" ? (
        <DashboardTab
          upcomingCount={upcomingJobs.length}
          monthlyEarnings={monthlyEarnings}
          openBoardCount={boardJobs.length}
          nextJob={nextJob}
          hubByPnr={hubByPnr}
          onOpenJobs={() => setTab("mine")}
          onOpenBoard={() => setTab("board")}
          onOpenInvoices={() => setTab("invoices")}
        />
      ) : tab === "calendar" ? (
        <CalendarTab
          month={calendarMonth}
          cells={calendarCells}
          jobsByDay={calendarJobsByDay}
          selectedDay={selectedDay}
          onPrev={() => setCalendarMonth((m) => addMonths(m, -1))}
          onNext={() => setCalendarMonth((m) => addMonths(m, 1))}
          onSelectDay={(ymd) => setSelectedDay(ymd)}
          onOpenJob={() => setTab("mine")}
          hubByPnr={hubByPnr}
        />
      ) : tab === "invoices" ? (
        <div className="space-y-6">
          <InvoicesTab
            pending={pendingPayouts}
            settled={settledPayouts}
            hubByPnr={hubByPnr}
          />
          {effectiveStaffId ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
              <h3 className="mb-3 text-sm font-semibold text-white">
                Rate sheet
              </h3>
              <DriverRateSheetEditor
                getClient={getClient}
                staffId={effectiveStaffId}
                seedName={staffName}
              />
            </div>
          ) : null}
        </div>
      ) : tab === "profile" ? (
        <DriverProfileSettingsTab
          effectiveStaffId={effectiveStaffId}
          isAliasPreview={isAliasPreview}
          seedName={staffName}
          seedEmail={effectiveEmail || undefined}
        />
      ) : (
        <JobGroupsList
          groups={tab === "board" ? groupedBoard : groupedMine}
          mode={tab === "board" ? "board" : "mine"}
          hubByPnr={hubByPnr}
          briefByPnr={briefByPnr}
          claiming={claiming}
          isAliasPreview={isAliasPreview}
          staffId={staffId}
          onClaim={onClaim}
        />
      )}
    </div>
  );
}

function DashboardTab({
  upcomingCount,
  monthlyEarnings,
  openBoardCount,
  nextJob,
  hubByPnr,
  onOpenJobs,
  onOpenBoard,
  onOpenInvoices,
}: {
  upcomingCount: number;
  monthlyEarnings: number;
  openBoardCount: number;
  nextJob: DriverPortalJob | null;
  hubByPnr: Record<string, OpsHubRow>;
  onOpenJobs: () => void;
  onOpenBoard: () => void;
  onOpenInvoices: () => void;
}) {
  const hub = nextJob
    ? hubByPnr[String(nextJob.pnr).toUpperCase()]
    : undefined;
  const openBoardValue =
    openBoardCount === 0
      ? "0 JOBS"
      : `${openBoardCount} OPEN JOB${openBoardCount === 1 ? "" : "S"}`;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Upcoming jobs"
          value={String(upcomingCount)}
          hint="Assigned ahead"
          onClick={onOpenJobs}
        />
        <MetricCard
          label="Monthly earnings"
          value={`¥${monthlyEarnings.toLocaleString("en-US")}`}
          hint="This month · payouts"
          onClick={onOpenInvoices}
        />
        <MetricCard
          label="Open board"
          value={openBoardValue}
          hint="Claim open chauffeur jobs"
          onClick={onOpenBoard}
        />
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-5">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
          <AlertTriangle className="h-3.5 w-3.5 text-[#F6A724]" />
          Next pickup
        </div>
        {nextJob ? (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-white">
                {nextJob.title}
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                {formatGuideJobDateLabel(nextJob.serviceDate)}
                {nextJob.city ? ` · ${nextJob.city}` : ""}
                {hub?.primary_city && !nextJob.city
                  ? ` · ${hub.primary_city}`
                  : ""}
                {" · "}
                {String(nextJob.pnr).toUpperCase()}
              </p>
              {hub?.guest_summary ? (
                <p className="mt-1 text-xs text-zinc-500">{hub.guest_summary}</p>
              ) : null}
              {nextJob.pickup ? (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-zinc-400">
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-[#F6A724]" />
                  {nextJob.pickup}
                </p>
              ) : null}
            </div>
            <div className="text-right">
              {typeof nextJob.priceEur === "number" && nextJob.priceEur > 0 ? (
                <p className="font-mono text-sm text-[#F6A724]">
                  {formatDriverLegPriceEur(nextJob.priceEur)}
                </p>
              ) : hub?.driver_pay_jpy ? (
                <p className="font-mono text-sm text-[#F6A724]">
                  ¥{Number(hub.driver_pay_jpy).toLocaleString("en-US")}
                </p>
              ) : null}
              <button
                type="button"
                onClick={onOpenJobs}
                className="mt-2 text-xs text-[#7dd3fc] hover:underline"
              >
                View in My Jobs
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No upcoming pickup yet.</p>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  onClick,
}: {
  label: string;
  value: string;
  hint: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 text-left transition hover:border-[#075473]/50"
    >
      <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
        {label}
      </p>
      <p className="mt-2 font-display text-2xl text-white">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </button>
  );
}

function CalendarTab({
  month,
  cells,
  jobsByDay,
  selectedDay,
  onPrev,
  onNext,
  onSelectDay,
  onOpenJob,
  hubByPnr,
}: {
  month: Date;
  cells: Date[];
  jobsByDay: Map<string, DriverPortalJob[]>;
  selectedDay: string | null;
  onPrev: () => void;
  onNext: () => void;
  onSelectDay: (ymd: string) => void;
  onOpenJob: () => void;
  hubByPnr: Record<string, OpsHubRow>;
}) {
  const monthStart = startOfMonth(month);
  const selectedJobs = selectedDay ? jobsByDay.get(selectedDay) || [] : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrev}
          className="rounded-lg border border-zinc-700 p-2 text-zinc-300 hover:text-white"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="font-display text-lg text-white">
          {formatMonthTitle(month)}
        </h2>
        <button
          type="button"
          onClick={onNext}
          className="rounded-lg border border-zinc-700 p-2 text-zinc-300 hover:text-white"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const ymd = toYmd(d);
          const inMonth = d.getMonth() === monthStart.getMonth();
          const jobs = jobsByDay.get(ymd) || [];
          const hasJobs = jobs.length > 0;
          const isToday = sameYmd(d, new Date());
          const selected = selectedDay === ymd;
          return (
            <button
              key={ymd}
              type="button"
              onClick={() => onSelectDay(ymd)}
              className={`min-h-[3.25rem] rounded-lg border p-1.5 text-left transition ${
                selected
                  ? "border-[#075473] bg-[#075473]/25"
                  : hasJobs
                    ? "border-[#F6A724]/40 bg-[#F6A724]/10 hover:border-[#F6A724]/70"
                    : "border-zinc-800/80 bg-zinc-950/40 hover:border-zinc-700"
              } ${inMonth ? "" : "opacity-40"}`}
            >
              <span
                className={`text-xs font-medium ${
                  isToday ? "text-[#7dd3fc]" : "text-zinc-300"
                }`}
              >
                {d.getDate()}
              </span>
              {hasJobs ? (
                <span className="mt-1 block truncate text-[9px] text-[#F6A724]">
                  {jobs.length} job{jobs.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {selectedDay ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
          <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
            {formatGuideJobDateLabel(selectedDay)}
          </p>
          {selectedJobs.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No jobs on this day.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {selectedJobs.map((job) => {
                const hub = hubByPnr[String(job.pnr).toUpperCase()];
                return (
                  <li
                    key={job.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/40 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {job.title}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {String(job.pnr).toUpperCase()}
                        {hub?.primary_city ? ` · ${hub.primary_city}` : ""}
                        {" · "}
                        {job.status.replace(/_/g, " ")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenJob}
                      className="text-xs text-[#7dd3fc] hover:underline"
                    >
                      Open My Jobs
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function InvoicesTab({
  pending,
  settled,
  hubByPnr,
}: {
  pending: OpsPayoutRow[];
  settled: OpsPayoutRow[];
  hubByPnr: Record<string, OpsHubRow>;
}) {
  const pendingTotal = pending.reduce(
    (s, p) => s + Math.max(0, Number(p.amount_jpy) || 0),
    0
  );
  const settledTotal = settled.reduce(
    (s, p) => s + Math.max(0, Number(p.amount_jpy) || 0),
    0
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[#F6A724]/30 bg-[#F6A724]/10 p-4">
          <p className="text-[10px] font-bold tracking-wider text-[#F6A724] uppercase">
            Pending payouts
          </p>
          <p className="mt-2 font-mono text-2xl text-white">
            ¥{pendingTotal.toLocaleString("en-US")}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            {pending.length} open item{pending.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
            Settled / paid
          </p>
          <p className="mt-2 font-mono text-2xl text-white">
            ¥{settledTotal.toLocaleString("en-US")}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            {settled.length} paid item{settled.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <PayoutSection
        title="Pending"
        rows={pending}
        hubByPnr={hubByPnr}
        empty="No pending payouts."
      />
      <PayoutSection
        title="Settled"
        rows={settled}
        hubByPnr={hubByPnr}
        empty="No settled payouts yet."
      />
    </div>
  );
}

function PayoutSection({
  title,
  rows,
  hubByPnr,
  empty,
}: {
  title: string;
  rows: OpsPayoutRow[];
  hubByPnr: Record<string, OpsHubRow>;
  empty: string;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-white">{title}</h3>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">
          {empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4"
            >
              <div>
                <p className="font-mono text-sm text-white">{p.pnr}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {hubByPnr[String(p.pnr).toUpperCase()]?.primary_city || "—"}
                  {p.notes ? ` · ${p.notes}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className={`font-mono text-sm ${payoutStatusTone(p.status)}`}>
                  ¥{Number(p.amount_jpy || 0).toLocaleString("en-US")}
                </p>
                <OpsStatusBadge status={p.status || "pending"} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DriverJobCard({
  job,
  mode,
  hub,
  brief,
  claiming,
  isAliasPreview,
  staffId,
  onClaim,
}: {
  job: DriverPortalJob;
  mode: "mine" | "board";
  hub?: OpsHubRow | null;
  brief?: OpsGuestRequirements | null;
  claiming: string | null;
  isAliasPreview: boolean;
  staffId: string | null;
  onClaim: (job: DriverPortalJob) => Promise<void>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [logisticsOpen, setLogisticsOpen] = useState(mode === "mine");
  const assigned = mode === "mine" || job.assigned;
  const pickup = resolvePickupDisplay({ job, hub, brief });
  const contact = guestContactForAssigned({ hub, brief, assigned });

  useEffect(() => {
    if (assigned) setLogisticsOpen(true);
  }, [assigned]);

  return (
    <div className="space-y-3 rounded-lg border border-white/5 bg-black/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          aria-expanded={isExpanded}
          className="group min-w-0 flex-1 text-left"
        >
          <span className="flex items-center gap-2">
            <span className="text-sm font-bold text-emerald-400 transition group-hover:text-emerald-300">
              {job.title}
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-zinc-500 transition ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          </span>
          <span className="mt-0.5 block text-xs text-zinc-400">
            {job.vehicleTier || "Vehicle TBD"}
            {job.pax ? ` · ${job.pax} pax` : ""}
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-3">
          {mode === "board" ? (
            <button
              type="button"
              disabled={claiming === job.id || !staffId || isAliasPreview}
              className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              onClick={() => void onClaim(job)}
            >
              {claiming === job.id ? "…" : "Claim"}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
              <CheckCircle2 className="h-3 w-3" />
              Assigned
            </span>
          )}
        </div>
      </div>

      {typeof job.priceEur === "number" && job.priceEur > 0 ? (
        <p className="font-mono text-sm font-bold text-white">
          {formatDriverLegPriceEur(job.priceEur)}
        </p>
      ) : hub?.driver_pay_jpy ? (
        <p className="font-mono text-sm font-bold text-white">
          ¥{Number(hub.driver_pay_jpy).toLocaleString("en-US")}
        </p>
      ) : null}

      {isExpanded ? (
        <div className="space-y-3">
          {assigned ? (
            <div className="overflow-hidden rounded-xl border border-[#0080A3]/40 bg-[#0080A3]/10">
              <button
                type="button"
                onClick={() => setLogisticsOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[11px] font-bold tracking-wider text-[#0080A3] uppercase transition hover:bg-white/5"
              >
                <span>Pickup logistics</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 transition ${
                    logisticsOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {logisticsOpen ? (
                <div className="space-y-3 border-t border-white/10 bg-black/40 p-3 text-xs">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <span className="block text-[10px] tracking-wider text-zinc-500 uppercase">
                        Pickup / meeting point
                      </span>
                      <span className="font-bold text-white">
                        {pickup || "No pickup notes yet."}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] tracking-wider text-zinc-500 uppercase">
                        Drop-off
                      </span>
                      <span className="font-bold text-white">
                        {job.dropoff || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] tracking-wider text-zinc-500 uppercase">
                        Guest
                      </span>
                      <span className="font-bold text-white">
                        {contact.name ||
                          hub?.guest_summary ||
                          partyCompositionLabel(brief)}
                      </span>
                    </div>
                    {contact.showPhone && contact.phone ? (
                      <div>
                        <span className="block text-[10px] tracking-wider text-zinc-500 uppercase">
                          Guest WhatsApp / phone
                        </span>
                        <a
                          href={`https://wa.me/${contact.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-[#7dd3fc] hover:underline"
                        >
                          {contact.phone}
                        </a>
                      </div>
                    ) : null}
                    <div>
                      <span className="block text-[10px] tracking-wider text-zinc-500 uppercase">
                        Vehicle
                      </span>
                      <span className="font-bold text-white">
                        {job.vehicleTier || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] tracking-wider text-zinc-500 uppercase">
                        Start time
                      </span>
                      <span className="font-bold text-white">
                        {String(brief?.startTime || "").trim() || "—"}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-[10px] text-zinc-500">
              <Lock className="h-3 w-3 shrink-0" />
              Pickup, guest contact &amp; drop-off unlock after you claim.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function JobGroupsList({
  groups,
  mode,
  hubByPnr,
  briefByPnr,
  claiming,
  isAliasPreview,
  staffId,
  onClaim,
}: {
  groups: DriverJobGroup[];
  mode: "mine" | "board";
  hubByPnr: Record<string, OpsHubRow>;
  briefByPnr: Record<string, OpsGuestRequirements>;
  claiming: string | null;
  isAliasPreview: boolean;
  staffId: string | null;
  onClaim: (job: DriverPortalJob) => Promise<void>;
}) {
  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
        {mode === "mine"
          ? "No chauffeur jobs assigned to you yet."
          : "No open jobs on the board."}
      </div>
    );
  }

  return (
    <ul className="space-y-5">
      {groups.map((group) => {
        const hub = hubByPnr[group.pnr];
        const brief = briefByPnr[group.pnr];
        const primary = group.jobs[0];
        const isMulti = group.jobs.length > 1;
        const partyCity = jobPartyCityLine({ brief, hub, job: primary });
        const headerDate = isMulti
          ? `${formatGuideJobDateLabel(primary?.serviceDate)} · ${group.jobs.length} legs`
          : formatGuideJobDateLabel(primary?.serviceDate);

        return (
          <li
            key={group.pnr}
            className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-5 shadow-lg"
          >
            <div className="mb-4 border-b border-zinc-800 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-white">
                    {String(group.pnr).toUpperCase()}
                  </h2>
                  <p className="mt-1 text-base font-bold text-[#F6A724]">
                    {headerDate || "Date TBD"}
                  </p>
                  {partyCity ? (
                    <p className="mt-1 text-sm text-zinc-400">{partyCity}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <OpsStatusBadge status={hub?.status} />
                  <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/40 bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-sky-300">
                    <Car className="h-3 w-3" />
                    Driver job
                  </span>
                  {mode === "mine" && partyCompositionLabel(brief) !== "—" ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-zinc-600 bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">
                      <Users className="h-3 w-3" />
                      {partyCompositionLabel(brief)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {group.jobs.map((job) => (
                <div key={job.id} className="space-y-2">
                  {isMulti ? (
                    <p className="text-sm font-bold text-[#F6A724]">
                      {formatGuideJobDateLabel(job.serviceDate) || "Date TBD"}
                    </p>
                  ) : null}
                  <DriverJobCard
                    job={job}
                    mode={mode}
                    hub={hub}
                    brief={brief}
                    claiming={claiming}
                    isAliasPreview={isAliasPreview}
                    staffId={staffId}
                    onClaim={onClaim}
                  />
                </div>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Slimmer profile than Guide — staff_profiles + drivers phone / cities. */
function DriverProfileSettingsTab({
  effectiveStaffId,
  isAliasPreview,
  seedName,
  seedEmail,
}: {
  effectiveStaffId: string | null;
  isAliasPreview: boolean;
  seedName: string;
  seedEmail?: string;
}) {
  const getClient = useTeamAuth((s) => s.getClient);
  const readOnly = isAliasPreview;

  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [driverRow, setDriverRow] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [operatingCities, setOperatingCities] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [accountType, setAccountType] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  useEffect(() => {
    if (!effectiveStaffId) {
      setLoading(false);
      setError("Profile needs a staff account.");
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const pb = getClient();
        const p = await ensureStaffProfile(pb, effectiveStaffId, {
          display_name: seedName,
        });
        if (cancelled) return;
        setProfile(p);
        const names = resolveStaffNamePartsForEditor({
          first_name: p.first_name,
          last_name: p.last_name,
          display_name: p.display_name,
          fallbackName: seedName,
        });
        setFirstName(names.first_name);
        setLastName(names.last_name);
        setPhone(p.phone || "");
        setBio(p.bio || "");
        setBankName(p.bank_name || "");
        setBankBranch(p.bank_branch || "");
        setAccountType(p.account_type || "");
        setAccountHolder(p.account_holder || "");
        setAccountNumber(p.account_number || "");

        try {
          const d = await getDriverByStaff(pb, effectiveStaffId);
          if (d) {
            setDriverRow(d);
            if (!String(p.phone || "").trim() && d.phone_number) {
              setPhone(String(d.phone_number));
            }
            const cities = Array.isArray(d.operating_cities)
              ? d.operating_cities.join(", ")
              : "";
            setOperatingCities(cities);
          }
        } catch {
          /* optional */
        }
      } catch (e) {
        if (!cancelled) setError(formatPbError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveStaffId, getClient, seedName]);

  const photoUrl = staffAvatarSrc(effectiveStaffId, {
    photo: profile?.photo,
    updated: profile?.updated,
  });
  const displayName =
    combineStaffDisplayName(firstName, lastName) || seedName || "Driver";

  const onSave = async () => {
    if (!effectiveStaffId || !profile || readOnly) return;
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const pb = getClient();
      const display = combineStaffDisplayName(firstName, lastName);
      const updated = await updateStaffProfile(pb, profile.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        display_name: display,
        phone: phone.trim(),
        bio: bio.trim(),
        bank_name: bankName.trim(),
        bank_branch: bankBranch.trim(),
        account_type: accountType.trim(),
        account_holder: accountHolder.trim(),
        account_number: accountNumber.trim(),
      });
      setProfile(updated);
      if (driverRow) {
        const cities = operatingCities
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const d = await updateDriverProfile(pb, driverRow.id, {
          full_name: display || seedName,
          phone_number: phone.trim(),
          operating_cities: cities,
        });
        setDriverRow(d);
      }
      setMsg("Profile saved.");
      setEditing(false);
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading profile…
      </p>
    );
  }
  if (error && !profile) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  return (
    <div className="space-y-4">
      {readOnly ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Alias preview — profile is read-only.
        </p>
      ) : null}
      {msg ? <p className="text-sm text-[#7dd3fc]">{msg}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-5">
        <div className="flex flex-wrap items-start gap-4">
          <label className="relative block h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-full border border-white/20 bg-zinc-800">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-lg font-bold text-zinc-400">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
            {!readOnly ? (
              <input
                type="file"
                accept="image/*"
                className="absolute inset-0 opacity-0"
                disabled={avatarBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  const url = URL.createObjectURL(file);
                  setCropImageSrc(url);
                }}
              />
            ) : null}
          </label>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-white">{displayName}</h2>
                <p className="text-xs text-zinc-500">
                  {seedEmail || "Driver contractor"}
                </p>
              </div>
              {!readOnly ? (
                <button
                  type="button"
                  onClick={() => setEditing((v) => !v)}
                  className="rounded-lg border border-zinc-700 p-2 text-zinc-300 hover:text-white"
                  aria-label="Edit profile"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            {!editing ? (
              <div className="mt-3 space-y-1 text-sm text-zinc-400">
                <p>
                  <span className="text-zinc-500">Phone: </span>
                  <span className="text-white">{phone || "—"}</span>
                </p>
                <p>
                  <span className="text-zinc-500">Cities: </span>
                  <span className="text-white">
                    {operatingCities || "—"}
                  </span>
                </p>
                {bio ? <p className="mt-2 text-zinc-300">{bio}</p> : null}
              </div>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-xs text-zinc-500">
                  First name
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  Last name
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  WhatsApp / phone
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  Operating cities
                  <input
                    value={operatingCities}
                    onChange={(e) => setOperatingCities(e.target.value)}
                    placeholder="Tokyo, Yokohama"
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="col-span-full block text-xs text-zinc-500">
                  Bio
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  Bank name
                  <input
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  Branch
                  <input
                    value={bankBranch}
                    onChange={(e) => setBankBranch(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  Account type
                  <input
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  Account holder
                  <input
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="block text-xs text-zinc-500 sm:col-span-2">
                  Account number
                  <input
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </label>
                <div className="col-span-full flex gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void onSave()}
                    className="rounded-lg bg-[#075473] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save profile"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="rounded-lg border border-zinc-700 px-4 py-2 text-xs text-zinc-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        Need the generic profile page?{" "}
        <Link href="/profile" className="text-[#7dd3fc] hover:underline">
          Open /profile
        </Link>
      </p>

      {cropImageSrc && effectiveStaffId ? (
        <AvatarCropperModal
          imageSrc={cropImageSrc}
          saving={avatarBusy}
          onCancel={() => {
            URL.revokeObjectURL(cropImageSrc);
            setCropImageSrc(null);
          }}
          onSaveCrop={(pixels: CroppedAreaPixels) => {
            void (async () => {
              setAvatarBusy(true);
              try {
                const file = await getCroppedSquareFile(cropImageSrc, pixels);
                const pb = getClient();
                await uploadStaffAvatarViaApi(
                  pb.authStore.token,
                  effectiveStaffId,
                  file
                );
                const p = await ensureStaffProfile(pb, effectiveStaffId, {
                  display_name: seedName,
                });
                setProfile(p);
                setMsg("Avatar updated.");
              } catch (e) {
                setError(formatPbError(e));
              } finally {
                URL.revokeObjectURL(cropImageSrc);
                setCropImageSrc(null);
                setAvatarBusy(false);
              }
            })();
          }}
        />
      ) : null}
    </div>
  );
}
