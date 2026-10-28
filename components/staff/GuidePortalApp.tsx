"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type PocketBase from "pocketbase";
import {
  AlertTriangle,
  Accessibility,
  CalendarDays,
  Camera,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Footprints,
  LayoutDashboard,
  Loader2,
  Lock,
  Clock,
  Pencil,
  Receipt,
  RefreshCw,
  Utensils,
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
import { GuidePayoutBreakdown } from "@/components/staff/GuidePayoutBreakdown";
import { AvatarCropperModal } from "@/components/staff/AvatarCropperModal";
import { GuideRateCardEditor } from "@/components/staff/GuideRateCardEditor";
import { LanguagePills } from "@/components/staff/LanguagePills";
import { TourCompletionReportForm } from "@/components/staff/TourCompletionReportForm";
import {
  formatGuestSpecialRequirementsStatusLine,
  formatGuestSpecialRequirementsSummary,
  hasGuestSpecialRequirements,
  normalizeGuestSpecialRequirements,
  type GuestSpecialRequirements,
} from "@/lib/guestSpecialRequirements";
import { toCanonicalStatus } from "@/lib/bookingStatus";
import {
  acceptGuideJob,
  collectGuidePortalTicketItems,
  formatGuideJobDateLabel,
  listGuideJobsForStaff,
  listOpenBoardGuideJobs,
  normalizeGuideJobStatus,
  normalizeTourDateIso,
  ticketItemsForJobDay,
  type GuideJobRow,
  type GuidePortalTicketItem,
} from "@/lib/guideJobs";
import {
  loadOpsGuestRequirements,
  type OpsGuestRequirements,
} from "@/lib/opsGuestRequirements";
import {
  addMonths,
  formatMonthTitle,
  monthGridDates,
  sameYmd,
  startOfMonth,
  toYmd,
} from "@/lib/opsCalendar";
import { classifyPaymentLane } from "@/lib/opsCalendarStatus";
import type { OpsDispatchRow } from "@/lib/opsDispatch";
import {
  loadPayoutsForStaff,
  type OpsPayoutRow,
} from "@/lib/opsPayouts";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  getGuideByStaff,
  updateGuideProfile,
  type GuideProfile,
} from "@/lib/roleProfiles";
import {
  saveStaffCredentialViaApi,
  uploadStaffAvatarViaApi,
} from "@/lib/staffCredentialClient";
import {
  parseStaffLanguages,
  serializeStaffLanguages,
} from "@/lib/staffLanguages";
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
import { canAccessGuide, canAccessOpsBoard } from "@/lib/staffRoles";
import { uploadToVps } from "@/lib/vpsUploadClient";
import { useTeamAuth } from "@/store/useTeamAuth";

type GuideTab =
  | "dashboard"
  | "calendar"
  | "invoices"
  | "pending"
  | "mine"
  | "board"
  | "profile";

type GuideJobGroup = {
  pnr: string;
  jobs: GuideJobRow[];
};

function todayIso(): string {
  return toYmd(new Date());
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Next Tour payment gate: 30%+ deposit (shared lane), explicit tour pay statuses,
 * or booking status CONFIRMED / DEPOSIT_PAID / FULLY_PAID equivalents.
 */
function isNextTourClientPaymentReady(hub?: OpsHubRow | null): boolean {
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

function payoutStatusTone(status?: string): string {
  const s = String(status || "pending").toLowerCase();
  if (s === "paid") return "text-emerald-400";
  if (s === "hold") return "text-amber-400";
  return "text-[#F6A724]";
}

function isPrivateDriverIncluded(
  hub?: OpsHubRow | null,
  dispatch?: OpsDispatchRow | null
): boolean {
  if (hub?.driver_needed === true) return true;
  if (dispatch?.driver_needed === true) return true;
  if (hub?.assigned_driver_id || dispatch?.assigned_driver_id) return true;
  if (hub?.assigned_driver || dispatch?.assigned_driver) return true;
  return false;
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

/** Secondary header line: "3 adults · Tokyo" */
function jobPartyCityLine(opts: {
  brief?: OpsGuestRequirements | null;
  hub?: OpsHubRow | null;
  job?: GuideJobRow | null;
}): string {
  const party = partyCompositionLabel(opts.brief);
  const paxFallback = opts.job
    ? `${Math.max(1, Number(opts.job.pax_count) || 1)} pax`
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

function tourHoursLabel(
  job: GuideJobRow,
  brief?: OpsGuestRequirements | null
): string {
  const hours = Math.max(1, Number(job.duration_hours) || 6);
  const start = String(brief?.startTime || "").trim();
  if (start && start !== "—") {
    return `${start} · ${hours}h guided`;
  }
  return `${hours}h guided day`;
}

function pickupLabel(brief?: OpsGuestRequirements | null): string {
  if (!brief) return "—";
  const name = String(brief.meetingPointName || "").trim();
  const addr = String(brief.meetingPointAddress || "").trim();
  if (name && addr && name !== addr) return `${name} — ${addr}`;
  return name || addr || "—";
}

type DietaryMobilityInfo = {
  label: string;
  tone: "standard" | "special" | "unset";
};

/**
 * Dietary/mobility for the guide brief. Tri-state matters:
 * explicit No/No (false/false) is an answered quiz → “Standard…” (emerald);
 * a Yes / tags / notes → amber special summary; anything still null
 * (quiz not completed) → “None specified” only.
 * Empty notes alone never count as an answered No — normalize() keeps
 * unanswered fields null when no explicit false was stored.
 */
function dietaryMobilityInfo(
  brief?: OpsGuestRequirements | null,
  reqs?: GuestSpecialRequirements | null
): DietaryMobilityInfo {
  const n = normalizeGuestSpecialRequirements(
    brief?.guestSpecialRequirements ?? reqs
  );
  const mobility = String(brief?.specialMobility || "").trim();
  const notes = String(brief?.specialNotes || "").trim();
  const legacyBits = [mobility, notes].filter(
    (s) => s && s !== "—" && !/no special requirements/i.test(s)
  );
  if (hasGuestSpecialRequirements(n)) {
    const summary = formatGuestSpecialRequirementsSummary(n).trim();
    return {
      // Mobility=Yes with no tags/notes formats to "" — fall back to the
      // explicit status line so a Yes never renders blank.
      label: summary || formatGuestSpecialRequirementsStatusLine(n),
      tone: "special",
    };
  }
  if (n.hasDietary === false && n.hasMobility === false) {
    // Answered No to both. Legacy free-text notes (pickup / special
    // requests on the brief) still surface instead of the Standard line.
    if (legacyBits.length > 0) {
      return { label: legacyBits.join(" · "), tone: "special" };
    }
    return {
      label: "Standard (No dietary or mobility restrictions)",
      tone: "standard",
    };
  }
  // Unanswered / partially answered (either field still null).
  if (legacyBits.length > 0) {
    return { label: legacyBits.join(" · "), tone: "special" };
  }
  return { label: "None specified", tone: "unset" };
}

/** Subway / IC / Suica lines that duplicate the Walking / Public Transit badge. */
function isRedundantPublicTransitTicket(t: GuidePortalTicketItem): boolean {
  const hay = `${t.title} ${t.type}`.toLowerCase();
  return /subway|\bic\b|suica|pasmo|public\s*transit|public\s*transport|rail\s*\/\s*transit|ic\s*card|ic\s*top-?up/.test(
    hay
  );
}

function visibleDayTickets(
  tickets: GuidePortalTicketItem[],
  privateDriver: boolean
): GuidePortalTicketItem[] {
  if (privateDriver) return tickets;
  return tickets.filter((t) => !isRedundantPublicTransitTicket(t));
}

export function GuidePortalApp() {
  // Header avatar (in the shell) opens the in-portal Profile view —
  // the Profile tab button itself is gone from the nav grid.
  const [profileSignal, setProfileSignal] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <ContractorPortalShell
      title="Guide portal"
      allow={canAccessGuide}
      loginTitle="Guide login"
      loginSubtitle="Email + password from your onboarding link. Individual assigned jobs only — not the Ops Super User desk."
      onProfileClick={() => setProfileSignal((n) => n + 1)}
      onMenuClick={() => setDrawerOpen(true)}
    >
      <GuidePortalInner
        profileSignal={profileSignal}
        drawerOpen={drawerOpen}
        onCloseDrawer={() => setDrawerOpen(false)}
      />
    </ContractorPortalShell>
  );
}

function GuidePortalInner({
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

  const [tab, setTab] = useState<GuideTab>("dashboard");

  // Header avatar → Profile view (no Profile button in the nav grid).
  // Render-phase adjustment (React pattern) so no effect is needed.
  const [prevProfileSignal, setPrevProfileSignal] = useState(profileSignal);
  if (profileSignal !== prevProfileSignal) {
    setPrevProfileSignal(profileSignal);
    if (profileSignal > 0) setTab("profile");
  }
  const [hubByPnr, setHubByPnr] = useState<Record<string, OpsHubRow>>({});
  const [dispatchByPnr, setDispatchByPnr] = useState<
    Record<string, OpsDispatchRow>
  >({});
  const [guestReqsByPnr, setGuestReqsByPnr] = useState<
    Record<string, GuestSpecialRequirements>
  >({});
  const [opsBriefByPnr, setOpsBriefByPnr] = useState<
    Record<string, OpsGuestRequirements>
  >({});
  const [ticketItemsByPnr, setTicketItemsByPnr] = useState<
    Record<string, GuidePortalTicketItem[]>
  >({});
  const [myJobs, setMyJobs] = useState<GuideJobRow[]>([]);
  const [boardJobs, setBoardJobs] = useState<GuideJobRow[]>([]);
  const [payouts, setPayouts] = useState<OpsPayoutRow[]>([]);
  const [assignmentByPnr, setAssignmentByPnr] = useState<
    Record<string, string>
  >({});
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
    alias.roleType === "guide" &&
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
      const [hubs, mineRaw, boardRaw, payoutList, dispatchRows] =
        await Promise.all([
          loadOpsHub(pb),
          effectiveStaffId
            ? listGuideJobsForStaff(pb, effectiveStaffId)
            : Promise.resolve([] as GuideJobRow[]),
          listOpenBoardGuideJobs(pb),
          effectiveStaffId
            ? loadPayoutsForStaff(pb, effectiveStaffId).then((list) =>
                list.filter((p) => p.role === "guide")
              )
            : role === "owner" || role === "ops"
              ? pb
                  .collection("ops_payouts")
                  .getFullList<OpsPayoutRow>({
                    filter: `role="guide"`,
                    sort: "-updated",
                    requestKey: null,
                  })
              : Promise.resolve([] as OpsPayoutRow[]),
          pb
            .collection("ops_dispatch")
            .getFullList<OpsDispatchRow>({
              sort: "-updated",
              requestKey: null,
            })
            .catch(() => [] as OpsDispatchRow[]),
        ]);

      const map: Record<string, OpsHubRow> = {};
      for (const h of hubs) map[String(h.pnr).toUpperCase()] = h;
      setHubByPnr(map);

      const dmap: Record<string, OpsDispatchRow> = {};
      for (const d of dispatchRows) {
        dmap[String(d.pnr).toUpperCase()] = d;
      }
      setDispatchByPnr(dmap);

      const mine = mineRaw.filter((j) => {
        const s = normalizeGuideJobStatus(j.status);
        return s === "OFFERED" || s === "ACCEPTED" || s === "COMPLETED";
      });
      setMyJobs(mine);
      setBoardJobs(boardRaw);
      setPayouts(payoutList);

      const pnrs = Array.from(
        new Set(
          [...mine, ...boardRaw].map((j) =>
            String(j.pnr || "").trim().toUpperCase()
          )
        )
      ).filter(Boolean);
      const ticketMap: Record<string, GuidePortalTicketItem[]> = {};
      const briefMap: Record<string, OpsGuestRequirements> = {};
      const reqsMap: Record<string, GuestSpecialRequirements> = {};
      await Promise.all(
        pnrs.map(async (pnr) => {
          const hub = map[pnr];
          if (!hub) {
            ticketMap[pnr] = [];
            return;
          }
          try {
            const opsReqs = await loadOpsGuestRequirements(pb, hub);
            briefMap[pnr] = opsReqs;
            reqsMap[pnr] = normalizeGuestSpecialRequirements(
              opsReqs.guestSpecialRequirements
            );
            ticketMap[pnr] = collectGuidePortalTicketItems({
              reqs: opsReqs,
              hub,
            });
          } catch {
            ticketMap[pnr] = collectGuidePortalTicketItems({ hub });
          }
        })
      );
      setOpsBriefByPnr(briefMap);
      setGuestReqsByPnr(reqsMap);
      setTicketItemsByPnr(ticketMap);

      if (effectiveStaffId) {
        try {
          const asgs = await pb
            .collection("itinerary_guide_assignments")
            .getFullList<{ id: string; pnr: string; staff_id?: string }>({
              filter: `staff_id="${effectiveStaffId}"`,
              requestKey: null,
            });
          const amap: Record<string, string> = {};
          for (const a of asgs) amap[String(a.pnr).toUpperCase()] = a.id;
          setAssignmentByPnr(amap);
        } catch {
          setAssignmentByPnr({});
        }
      } else {
        setAssignmentByPnr({});
      }
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setLoading(false);
    }
  }, [effectiveStaffId, getClient, role]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const groupJobs = useCallback((jobs: GuideJobRow[]): GuideJobGroup[] => {
    const map = new Map<string, GuideJobRow[]>();
    for (const job of jobs) {
      const pnr = String(job.pnr || "UNKNOWN").trim().toUpperCase();
      const list = map.get(pnr) || [];
      list.push(job);
      map.set(pnr, list);
    }
    return Array.from(map.entries()).map(([pnr, list]) => ({
      pnr,
      jobs: [...list].sort((a, b) => {
        const da = String(a.tour_date || "");
        const db = String(b.tour_date || "");
        if (da !== db) return da.localeCompare(db);
        return (Number(a.day_index) || 0) - (Number(b.day_index) || 0);
      }),
    }));
  }, []);

  // My Jobs = accepted/confirmed only; Pending Offers = awaiting response.
  const acceptedJobs = useMemo(
    () =>
      myJobs.filter((j) => {
        const s = normalizeGuideJobStatus(j.status);
        return s === "ACCEPTED" || s === "COMPLETED";
      }),
    [myJobs]
  );
  const groupedMine = useMemo(
    () => groupJobs(acceptedJobs),
    [groupJobs, acceptedJobs]
  );
  const groupedPending = useMemo(
    () =>
      groupJobs(
        myJobs.filter(
          (j) => normalizeGuideJobStatus(j.status) === "OFFERED"
        )
      ),
    [groupJobs, myJobs]
  );
  const groupedBoard = useMemo(
    () => groupJobs(boardJobs),
    [groupJobs, boardJobs]
  );

  const today = todayIso();
  const upcomingAccepted = useMemo(
    () =>
      myJobs
        .filter((j) => {
          const s = normalizeGuideJobStatus(j.status);
          if (s !== "ACCEPTED") return false;
          const d = normalizeTourDateIso(j.tour_date);
          return !d || d >= today;
        })
        .sort((a, b) =>
          String(a.tour_date || "").localeCompare(String(b.tour_date || ""))
        ),
    [myJobs, today]
  );

  const pendingOffers = useMemo(
    () =>
      myJobs.filter((j) => normalizeGuideJobStatus(j.status) === "OFFERED"),
    [myJobs]
  );

  /** Earliest upcoming job that passes both Next Tour gates. */
  const nextTour = useMemo(() => {
    const eligible = myJobs
      .filter((j) => {
        if (normalizeGuideJobStatus(j.status) !== "ACCEPTED") return false;
        const d = normalizeTourDateIso(j.tour_date);
        if (d && d < today) return false;
        const hub = hubByPnr[String(j.pnr || "").trim().toUpperCase()];
        return isNextTourClientPaymentReady(hub);
      })
      .sort((a, b) =>
        String(a.tour_date || "").localeCompare(String(b.tour_date || ""))
      );
    return eligible[0] || null;
  }, [hubByPnr, myJobs, today]);

  const thisMonthKey = monthKey(new Date());
  const monthlyEarnings = useMemo(() => {
    const fromPayouts = payouts
      .filter((p) => {
        const updated = String(p.updated || p.created || "").slice(0, 7);
        return updated === thisMonthKey;
      })
      .reduce((sum, p) => sum + Math.max(0, Number(p.amount_jpy) || 0), 0);
    if (fromPayouts > 0) return fromPayouts;
    return myJobs
      .filter((j) => {
        const d = normalizeTourDateIso(j.tour_date);
        return d.startsWith(thisMonthKey);
      })
      .reduce((sum, j) => sum + Math.max(0, Number(j.payout_jpy) || 0), 0);
  }, [myJobs, payouts, thisMonthKey]);

  const acceptanceRate = useMemo(() => {
    const accepted = myJobs.filter((j) => {
      const s = normalizeGuideJobStatus(j.status);
      return s === "ACCEPTED" || s === "COMPLETED";
    }).length;
    const offered = pendingOffers.length;
    const denom = accepted + offered;
    if (denom === 0) return null;
    return Math.round((accepted / denom) * 100);
  }, [myJobs, pendingOffers.length]);

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
    const map = new Map<string, GuideJobRow[]>();
    for (const job of myJobs) {
      const d = normalizeTourDateIso(job.tour_date);
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

  const onAcceptGuideDay = async (jobId: string, label: string) => {
    if (isAliasPreview) {
      setMsg("Alias preview is read-only — exit disguise to accept as yourself.");
      return;
    }
    if (!staffId) {
      setMsg("Sign in as guide staff to accept.");
      return;
    }
    setClaiming(jobId);
    setMsg(null);
    try {
      const pb = getClient();
      await acceptGuideJob(pb, { jobId, staffId, staffName });
      setMsg(`Accepted: ${label}`);
      setTab("mine");
      await reload();
    } catch (e) {
      setMsg(formatPbError(e));
    } finally {
      setClaiming(null);
    }
  };

  const onRefuseGuideDay = async (jobId: string, label: string) => {
    if (isAliasPreview) {
      setMsg("Alias preview is read-only — exit disguise to refuse as yourself.");
      return;
    }
    if (!staffId) {
      setMsg("Sign in as guide staff to refuse.");
      return;
    }
    setClaiming(jobId);
    setMsg(null);
    try {
      const token = getClient().authStore.token;
      const res = await fetch("/api/ops/contractor-fallback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ jobId, reason: "declined" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setMsg(data.error || data.message || "Could not decline offer");
        return;
      }
      setMsg(`Declined: ${label} — returned to Open Board · Ops notified`);
      await reload();
    } catch (e) {
      setMsg(formatPbError(e));
    } finally {
      setClaiming(null);
    }
  };

  // Profile intentionally absent — header avatar opens that view.
  const tabs: Array<{
    id: GuideTab;
    label: string;
    icon: typeof LayoutDashboard;
    count?: number;
    accent?: "amber";
  }> = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "calendar", label: "My Calendar", icon: CalendarDays },
    { id: "invoices", label: "Invoices", icon: Receipt },
    {
      id: "pending",
      label: "Pending Offers",
      icon: Clock,
      count: pendingOffers.length,
      accent: "amber",
    },
    {
      id: "mine",
      label: "My Jobs",
      icon: ClipboardList,
      count: acceptedJobs.length,
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

      {/* Navigation lives in the slide-out drawer (header ☰). This slim
          toolbar only names the current section + keeps Refresh handy. */}
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
        onSelect={(id) => setTab(id as GuideTab)}
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
          upcomingCount={upcomingAccepted.length}
          monthlyEarnings={monthlyEarnings}
          acceptanceRate={acceptanceRate}
          pendingOffers={pendingOffers.length}
          openBoardCount={boardJobs.length}
          nextTour={nextTour}
          hubByPnr={hubByPnr}
          onOpenJobs={() => setTab("mine")}
          onOpenPending={() => setTab("pending")}
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
          onSelectDay={(ymd) => {
            setSelectedDay(ymd);
          }}
          onOpenJob={() => {
            const dayJobs = selectedDay
              ? calendarJobsByDay.get(selectedDay) || []
              : [];
            const hasAccepted = dayJobs.some((j) => {
              const s = normalizeGuideJobStatus(j.status);
              return s === "ACCEPTED" || s === "COMPLETED";
            });
            setTab(hasAccepted || dayJobs.length === 0 ? "mine" : "pending");
          }}
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
                Rate card
              </h3>
              <GuideRateCardEditor
                getClient={getClient}
                staffId={effectiveStaffId}
                seedName={staffName}
                seedEmail={effectiveEmail || undefined}
              />
            </div>
          ) : null}
        </div>
      ) : tab === "profile" ? (
        <GuideProfileSettingsTab
          effectiveStaffId={effectiveStaffId}
          realStaffId={staffId}
          isAliasPreview={isAliasPreview}
          seedName={staffName}
          seedEmail={effectiveEmail || undefined}
        />
      ) : (
        <JobGroupsList
          groups={
            tab === "board"
              ? groupedBoard
              : tab === "pending"
                ? groupedPending
                : groupedMine
          }
          mode={tab === "board" ? "board" : tab === "pending" ? "pending" : "mine"}
          hubByPnr={hubByPnr}
          dispatchByPnr={dispatchByPnr}
          guestReqsByPnr={guestReqsByPnr}
          opsBriefByPnr={opsBriefByPnr}
          ticketItemsByPnr={ticketItemsByPnr}
          assignmentByPnr={assignmentByPnr}
          claiming={claiming}
          isAliasPreview={isAliasPreview}
          staffId={staffId}
          getClient={getClient}
          onAccept={onAcceptGuideDay}
          onRefuse={onRefuseGuideDay}
        />
      )}
    </div>
  );
}

function DashboardTab({
  upcomingCount,
  monthlyEarnings,
  acceptanceRate,
  pendingOffers,
  openBoardCount,
  nextTour,
  hubByPnr,
  onOpenJobs,
  onOpenPending,
  onOpenBoard,
  onOpenInvoices,
}: {
  upcomingCount: number;
  monthlyEarnings: number;
  acceptanceRate: number | null;
  pendingOffers: number;
  openBoardCount: number;
  nextTour: GuideJobRow | null;
  hubByPnr: Record<string, OpsHubRow>;
  onOpenJobs: () => void;
  onOpenPending: () => void;
  onOpenBoard: () => void;
  onOpenInvoices: () => void;
}) {
  const hub = nextTour
    ? hubByPnr[String(nextTour.pnr).toUpperCase()]
    : undefined;

  const openBoardValue =
    openBoardCount === 0
      ? "0 JOBS"
      : `${openBoardCount} OPEN JOB${openBoardCount === 1 ? "" : "S"}`;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Upcoming tours"
          value={String(upcomingCount)}
          hint="Accepted ahead"
          onClick={onOpenJobs}
        />
        <MetricCard
          label="Monthly earnings"
          value={`¥${monthlyEarnings.toLocaleString("en-US")}`}
          hint="This month · payouts / jobs"
          onClick={onOpenInvoices}
        />
        <MetricCard
          label="Acceptance"
          value={
            acceptanceRate == null ? "—" : `${acceptanceRate}%`
          }
          hint={
            pendingOffers > 0
              ? `${pendingOffers} pending offer${pendingOffers === 1 ? "" : "s"}`
              : "No pending offers"
          }
          onClick={pendingOffers > 0 ? onOpenPending : onOpenJobs}
        />
        <MetricCard
          label="Open board"
          value={openBoardValue}
          hint="Claim open-market days"
          onClick={onOpenBoard}
        />
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-5">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
          <AlertTriangle className="h-3.5 w-3.5 text-[#F6A724]" />
          Next tour
        </div>
        {nextTour ? (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-white">
                {nextTour.tour_name}
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                {formatGuideJobDateLabel(nextTour.tour_date)}
                {nextTour.city ? ` · ${nextTour.city}` : ""}
                {hub?.primary_city && !nextTour.city
                  ? ` · ${hub.primary_city}`
                  : ""}
                {" · "}
                {String(nextTour.pnr).toUpperCase()}
              </p>
              {hub?.guest_summary ? (
                <p className="mt-1 text-xs text-zinc-500">{hub.guest_summary}</p>
              ) : null}
            </div>
            <div className="text-right">
              <GuidePayoutBreakdown job={nextTour} />
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
          <p className="text-sm text-zinc-500">No upcoming tour yet.</p>
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
  jobsByDay: Map<string, GuideJobRow[]>;
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
                        {job.tour_name}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {String(job.pnr).toUpperCase()}
                        {hub?.primary_city ? ` · ${hub.primary_city}` : ""}
                        {" · "}
                        {normalizeGuideJobStatus(job.status).replace(/_/g, " ")}
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

      <PayoutSection title="Pending" rows={pending} hubByPnr={hubByPnr} empty="No pending payouts." />
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

function GuideJobDayCard({
  job,
  mode,
  brief,
  guestReqs,
  privateDriver,
  dayTickets,
  claiming,
  isAliasPreview,
  staffId,
  onAccept,
  onRefuse,
}: {
  job: GuideJobRow;
  mode: "mine" | "board" | "pending";
  brief?: OpsGuestRequirements | null;
  guestReqs?: GuestSpecialRequirements | null;
  privateDriver: boolean;
  dayTickets: GuidePortalTicketItem[];
  claiming: string | null;
  isAliasPreview: boolean;
  staffId: string | null;
  onAccept: (jobId: string, label: string) => Promise<void>;
  onRefuse: (jobId: string, label: string) => Promise<void>;
}) {
  const status = normalizeGuideJobStatus(job.status);
  const canAct = status === "OFFERED" || status === "OPEN_BOARD";
  const isAccepted =
    status === "ACCEPTED" || status === "COMPLETED";
  // Card accordion: only tour name + total payout show by default;
  // breakdown, quiz insights and logistics live inside.
  const [isExpanded, setIsExpanded] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [logisticsOpen, setLogisticsOpen] = useState(isAccepted);

  useEffect(() => {
    if (isAccepted) setLogisticsOpen(true);
  }, [isAccepted]);

  const transportLabel = privateDriver
    ? "Private driver / car"
    : String(brief?.transportStrategy || "").trim() ||
      "Walking / public transit";
  const dietaryMobility = dietaryMobilityInfo(brief, guestReqs);

  return (
    <div className="space-y-3 rounded-lg border border-white/5 bg-black/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Tour name = accordion toggle */}
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          aria-expanded={isExpanded}
          className="group min-w-0 flex-1 text-left"
        >
          <span className="flex items-center gap-2">
            <span className="text-sm font-bold text-emerald-400 transition group-hover:text-emerald-300">
              {job.tour_name}
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-zinc-500 transition ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          </span>
          <span className="mt-0.5 block text-xs text-zinc-400">
            {Math.max(1, Number(job.duration_hours) || 6)}h
            {job.day_index ? ` · Day ${job.day_index}` : ""}
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-3">
          {canAct ? (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={claiming === job.id || !staffId || isAliasPreview}
                className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                onClick={() => void onAccept(job.id, job.tour_name)}
              >
                {claiming === job.id
                  ? "…"
                  : mode === "board"
                    ? "Claim"
                    : "Accept"}
              </button>
              {status === "OFFERED" ? (
                <button
                  type="button"
                  disabled={claiming === job.id || !staffId || isAliasPreview}
                  className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs font-semibold text-red-300 disabled:opacity-50"
                  onClick={() => void onRefuse(job.id, job.tour_name)}
                >
                  Reject
                </button>
              ) : null}
            </div>
          ) : (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase ${
                isAccepted
                  ? "text-emerald-400"
                  : status === "REJECTED"
                    ? "text-red-400"
                    : "text-zinc-500"
              }`}
            >
              {isAccepted ? <CheckCircle2 className="h-3 w-3" /> : null}
              {status.replace(/_/g, " ")}
            </span>
          )}
        </div>
      </div>

      {/* Always visible: total payout only — the detailed breakdown
          (base / allowance / bonus) lives inside the accordion. */}
      <GuidePayoutBreakdown job={job} totalOnly />

      {isExpanded ? (
        <div className="space-y-3">
          {/* Total already shown above — breakdown lists parts only. */}
          <GuidePayoutBreakdown job={job} hideTotal />

      {/* Guest quiz / vibe */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
        <button
          type="button"
          onClick={() => setQuizOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[11px] font-bold tracking-wider text-amber-400 uppercase transition hover:bg-white/5"
        >
          <span>Guest profile &amp; quiz insights</span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 transition ${
              quizOpen ? "rotate-180" : ""
            }`}
          />
        </button>
        {quizOpen ? (
          <div className="grid grid-cols-2 gap-3 border-t border-white/10 bg-black/20 p-3 text-xs sm:grid-cols-3">
            <div>
              <span className="block text-[10px] tracking-wider text-zinc-500 uppercase">
                Travel vibe
              </span>
              <span className="font-bold text-white">
                {brief?.travelVibeLabel && brief.travelVibeLabel !== "—"
                  ? brief.travelVibeLabel
                  : brief?.experienceTierLabel &&
                      brief.experienceTierLabel !== "—"
                    ? brief.experienceTierLabel
                    : "—"}
              </span>
            </div>
            <div>
              <span className="block text-[10px] tracking-wider text-zinc-500 uppercase">
                Pace
              </span>
              <span className="font-bold text-white">
                {brief?.travelPaceLabel && brief.travelPaceLabel !== "—"
                  ? brief.travelPaceLabel
                  : "—"}
              </span>
            </div>
            <div>
              <span className="block text-[10px] tracking-wider text-zinc-500 uppercase">
                Language
              </span>
              <span className="font-bold text-white">
                {brief?.tourLanguage && brief.tourLanguage !== "—"
                  ? brief.tourLanguage
                  : "—"}
              </span>
            </div>
            <div>
              <span className="block text-[10px] tracking-wider text-zinc-500 uppercase">
                Party
              </span>
              <span className="font-bold text-white">
                {partyCompositionLabel(brief)}
              </span>
            </div>
            <div className="col-span-2 sm:col-span-2">
              <span className="block text-[10px] tracking-wider text-zinc-500 uppercase">
                Interests
              </span>
              <span className="font-bold text-[#0080A3]">
                {brief?.interestsLabel && brief.interestsLabel !== "—"
                  ? brief.interestsLabel
                  : "—"}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Post-acceptance: full logistics */}
      {isAccepted ? (
        <div className="overflow-hidden rounded-xl border border-[#0080A3]/40 bg-[#0080A3]/10">
          <button
            type="button"
            onClick={() => setLogisticsOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[11px] font-bold tracking-wider text-[#0080A3] uppercase transition hover:bg-white/5"
          >
            <span>Full dispatch logistics</span>
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
                    Tour hours
                  </span>
                  <span className="font-bold text-white">
                    {tourHoursLabel(job, brief)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] tracking-wider text-zinc-500 uppercase">
                    Pickup location
                  </span>
                  <span className="font-bold text-white">
                    {pickupLabel(brief)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] tracking-wider text-zinc-500 uppercase">
                    Transport mode
                  </span>
                  <span className="font-bold text-white">{transportLabel}</span>
                </div>
                <div>
                  <span className="block text-[10px] tracking-wider text-zinc-500 uppercase">
                    Dietary / mobility
                  </span>
                  <span
                    className={`font-bold ${
                      dietaryMobility.tone === "standard"
                        ? "text-emerald-400"
                        : dietaryMobility.tone === "special"
                          ? "text-amber-400"
                          : "text-zinc-400"
                    }`}
                  >
                    {dietaryMobility.label}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : canAct ? (
        <p className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          <Lock className="h-3 w-3 shrink-0" />
          Pickup, hours, dietary &amp; transport unlock after you accept.
        </p>
      ) : null}

      {dayTickets.length > 0 ? (
        <ul className="space-y-1 border-t border-dashed border-purple-500/25 pt-2">
          {dayTickets.map((t, i) => (
            <li
              key={`${t.title}-${i}`}
              className="rounded border border-dashed border-purple-400/35 bg-purple-500/5 px-2 py-1"
            >
              <p className="text-[11px] font-medium text-purple-200">
                Ticketed · {t.title}
              </p>
              {t.type ? (
                <p className="text-[10px] text-zinc-500">{t.type}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
        </div>
      ) : null}
    </div>
  );
}

function JobGroupsList({
  groups,
  mode,
  hubByPnr,
  dispatchByPnr,
  guestReqsByPnr,
  opsBriefByPnr,
  ticketItemsByPnr,
  assignmentByPnr,
  claiming,
  isAliasPreview,
  staffId,
  getClient,
  onAccept,
  onRefuse,
}: {
  groups: GuideJobGroup[];
  mode: "mine" | "board" | "pending";
  hubByPnr: Record<string, OpsHubRow>;
  dispatchByPnr: Record<string, OpsDispatchRow>;
  guestReqsByPnr: Record<string, GuestSpecialRequirements>;
  opsBriefByPnr: Record<string, OpsGuestRequirements>;
  ticketItemsByPnr: Record<string, GuidePortalTicketItem[]>;
  assignmentByPnr: Record<string, string>;
  claiming: string | null;
  isAliasPreview: boolean;
  staffId: string | null;
  getClient: () => PocketBase;
  onAccept: (jobId: string, label: string) => Promise<void>;
  onRefuse: (jobId: string, label: string) => Promise<void>;
}) {
  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
        {mode === "mine"
          ? "No accepted tours yet — accept a pending offer to see it here."
          : mode === "pending"
            ? "No pending offers — new requests will appear here."
            : "No open day jobs on the board."}
      </div>
    );
  }

  return (
    <ul className="space-y-5">
      {groups.map((group) => {
        const hub = hubByPnr[group.pnr];
        const dispatch = dispatchByPnr[group.pnr];
        const guestReqs = guestReqsByPnr[group.pnr];
        const brief = opsBriefByPnr[group.pnr];
        const asgId = assignmentByPnr[group.pnr];
        const privateDriver = isPrivateDriverIncluded(hub, dispatch);
        const anyAccepted = group.jobs.some((j) => {
          const s = normalizeGuideJobStatus(j.status);
          return s === "ACCEPTED" || s === "COMPLETED";
        });
        const primaryJob = group.jobs[0];
        const isMultiDay = group.jobs.length > 1;
        const partyCity = jobPartyCityLine({
          brief,
          hub,
          job: primaryJob,
        });
        const headerDate = isMultiDay
          ? `${formatGuideJobDateLabel(primaryJob?.tour_date)} · ${group.jobs.length} days`
          : formatGuideJobDateLabel(primaryJob?.tour_date);
        return (
          <li
            key={group.pnr}
            className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-5 shadow-lg"
          >
            <div className="mb-4 border-b border-zinc-800 pb-4">
              <div className="flex items-start justify-between gap-3">
                {/* Left: PNR · date · party/city */}
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-white">
                    {String(group.pnr).toUpperCase()}
                  </h2>
                  <p className="mt-1 text-base font-bold text-[#F6A724]">
                    {headerDate}
                  </p>
                  {partyCity ? (
                    <p className="mt-1 text-sm text-zinc-400">{partyCity}</p>
                  ) : null}
                </div>
                {/* Right: status / transport badges stacked top-right */}
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <OpsStatusBadge status={hub?.status} />
                  <DriverStatusChip included={privateDriver} />
                  {anyAccepted ? <GuestReqsChips reqs={guestReqs} /> : null}
                </div>
              </div>
              {/* Payout breakdown is condensed: each day card below shows
                  its Total day payout; tap the tour name for details. */}
            </div>

            <div className="space-y-3">
              {group.jobs.map((job) => (
                <div key={job.id} className="space-y-2">
                  {isMultiDay ? (
                    <p className="text-sm font-bold text-[#F6A724]">
                      {formatGuideJobDateLabel(job.tour_date)}
                      {job.day_index ? ` · Day ${job.day_index}` : ""}
                    </p>
                  ) : null}
                  <GuideJobDayCard
                    job={job}
                    mode={mode}
                    brief={brief}
                    guestReqs={guestReqs}
                    privateDriver={privateDriver}
                    dayTickets={visibleDayTickets(
                      ticketItemsForJobDay(
                        ticketItemsByPnr[group.pnr] || [],
                        job
                      ),
                      privateDriver
                    )}
                    claiming={claiming}
                    isAliasPreview={isAliasPreview}
                    staffId={staffId}
                    onAccept={onAccept}
                    onRefuse={onRefuse}
                  />
                </div>
              ))}

              {visibleDayTickets(ticketItemsByPnr[group.pnr] || [], privateDriver)
                .filter((t) => {
                  const covered = group.jobs.some(
                    (j) => ticketItemsForJobDay([t], j).length > 0
                  );
                  return !covered;
                })
                .map((t, i) => (
                  <div
                    key={`ticket-only-${t.title}-${i}`}
                    className="rounded-lg border border-dashed border-purple-400/40 bg-purple-500/5 p-3"
                  >
                    <p className="text-sm font-medium text-purple-200">
                      Ticketed · {t.title}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {t.date
                        ? formatGuideJobDateLabel(t.date)
                        : "Date TBD"}
                      {t.dayIndex ? ` · Day ${t.dayIndex}` : ""}
                      {t.type ? ` · ${t.type}` : ""}
                    </p>
                  </div>
                ))}
            </div>

            {mode === "mine" &&
            !isAliasPreview &&
            asgId &&
            anyAccepted ? (
              <div className="mt-4 border-t border-zinc-800 pt-3">
                <TourCompletionReportForm
                  pb={getClient()}
                  pnr={group.pnr}
                  assignmentId={asgId}
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function DriverStatusChip({ included }: { included: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
        included
          ? "border-sky-500/40 bg-sky-500/15 text-sky-300"
          : "border-zinc-600 bg-zinc-900 text-zinc-400"
      }`}
    >
      {included ? (
        <Car className="h-3 w-3" />
      ) : (
        <Footprints className="h-3 w-3" />
      )}
      {included ? "Private Driver Included" : "Walking / Public Transit"}
    </span>
  );
}

function GuestReqsChips({
  reqs,
}: {
  reqs?: GuestSpecialRequirements | null;
}) {
  const n = normalizeGuestSpecialRequirements(reqs);
  if (!hasGuestSpecialRequirements(n)) return null;

  return (
    <>
      {n.hasDietary ? (
        <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
          <Utensils className="h-3 w-3" />
          Dietary
        </span>
      ) : null}
      {n.hasMobility || n.mobilityTags.length > 0 ? (
        <span
          className="inline-flex items-center gap-1 rounded-md border border-violet-500/40 bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-300"
          title={n.mobilityTags.join(", ") || "Mobility needs"}
        >
          <Accessibility className="h-3 w-3" />
          {n.mobilityTags.length > 0
            ? n.mobilityTags.slice(0, 2).join(", ")
            : "Mobility"}
        </span>
      ) : null}
      {n.customNotes.trim() ? (
        <span
          className="max-w-[14rem] truncate rounded-md border border-zinc-600 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-400"
          title={formatGuestSpecialRequirementsSummary(n)}
        >
          {n.customNotes.trim()}
        </span>
      ) : null}
    </>
  );
}

const SPECIALTY_PRESETS = [
  "Otaku Culture",
  "Food & Culinary",
  "Nightlife",
  "History & Shrines",
  "Nature & Outdoors",
  "Pop Culture",
  "Shopping",
  "Art & Museums",
  "Family Fun",
  "Photography",
] as const;

function parseCsvList(raw?: string | null): string[] {
  const out: string[] = [];
  for (const part of String(raw || "").split(",")) {
    const t = part.trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

const GUIDING_TENURE_OPTIONS = [
  "Less than 1 year",
  "1–2 years",
  "3–5 years",
  "6–10 years",
  "10+ years",
] as const;

const FLUENCY_LANGUAGES = [
  "English",
  "Japanese",
  "Spanish",
  "French",
  "German",
  "Mandarin",
  "Korean",
  "Dutch",
] as const;

const STRENGTH_REGION_OPTIONS = [
  "Tokyo — central",
  "Tokyo — outer wards",
  "Yokohama",
  "Kamakura",
  "Kawagoe",
  "Nikko",
  "Hakone",
  "Mt. Fuji area",
  "Narita / Chiba",
] as const;

const TOUR_SPECIALTY_OPTIONS = [
  "Food & culinary",
  "Bike tours",
  "Shopping",
  "Nature & hiking",
  "Nightlife / bars",
  "Anime / pop culture",
  "Photography-focused",
  "Architecture tours",
  "Historical / temples & shrines",
  "Cultural workshops",
] as const;

const PREFERRED_CLIENT_OPTIONS = [
  "Families with young kids",
  "Solo travelers",
  "Couples / honeymooners",
  "Large groups (8+)",
  "Seniors / limited mobility",
  "First-time visitors to Japan",
  "Repeat visitors",
  "Business / VIP clients",
] as const;

const AVAILABILITY_OPTIONS = ["Yes", "Sometimes", "Prefer not"] as const;

/** Parse language_fluency JSON ({"English":5}) safely; ratings clamped 0–5. */
function parseLanguageFluency(
  raw?: string | null
): Record<string, number> {
  const out: Record<string, number> = {};
  const text = String(raw || "").trim();
  if (!text) return out;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return out;
    }
    for (const [lang, value] of Object.entries(
      parsed as Record<string, unknown>
    )) {
      const n = Math.min(5, Math.max(0, Math.round(Number(value) || 0)));
      if (lang.trim() && n > 0) out[lang.trim()] = n;
    }
  } catch {
    return out;
  }
  return out;
}

function toggleCsvSelection(
  setter: React.Dispatch<React.SetStateAction<string[]>>,
  value: string
) {
  setter((prev) =>
    prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
  );
}

/** Profile Settings — staff_profiles (+ optional guides phone/name sync). */
function GuideProfileSettingsTab({
  effectiveStaffId,
  realStaffId,
  isAliasPreview,
  seedName,
  seedEmail,
}: {
  effectiveStaffId: string | null;
  realStaffId: string | null;
  isAliasPreview: boolean;
  seedName: string;
  seedEmail?: string;
}) {
  const getClient = useTeamAuth((s) => s.getClient);
  const readOnly = isAliasPreview;

  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [strengthCities, setStrengthCities] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [customSpecialties, setCustomSpecialties] = useState("");
  const [addingFluency, setAddingFluency] = useState(false);
  const [newFluencyLang, setNewFluencyLang] = useState("");
  const [newFluencyRating, setNewFluencyRating] = useState("3");
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [accountType, setAccountType] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [legacyBankInfo, setLegacyBankInfo] = useState("");
  const [guidingTenure, setGuidingTenure] = useState("");
  const [baseLocation, setBaseLocation] = useState("");
  const [languageFluency, setLanguageFluency] = useState<
    Record<string, number>
  >({});
  const [strengthRegions, setStrengthRegions] = useState<string[]>([]);
  const [tourSpecialties, setTourSpecialties] = useState<string[]>([]);
  const [toursToAvoid, setToursToAvoid] = useState("");
  const [preferredClients, setPreferredClients] = useState<string[]>([]);
  const [challengingClients, setChallengingClients] = useState("");
  const [skillStorytelling, setSkillStorytelling] = useState("");
  const [skillLogistics, setSkillLogistics] = useState("");
  const [skillProblemSolving, setSkillProblemSolving] = useState("");
  const [skillKidsPatience, setSkillKidsPatience] = useState("");
  const [skillConflictResolution, setSkillConflictResolution] = useState("");
  const [skillStamina, setSkillStamina] = useState("");
  const [biggestStrength, setBiggestStrength] = useState("");
  const [improvementAreas, setImprovementAreas] = useState("");
  const [earlyStarts, setEarlyStarts] = useState("");
  const [fullDayTours, setFullDayTours] = useState("");
  const [physicalLimitations, setPhysicalLimitations] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [guideRow, setGuideRow] = useState<GuideProfile | null>(null);
  const [profileTab, setProfileTab] = useState<"about" | "video" | "badges">(
    "about"
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

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
        setLanguages(parseStaffLanguages(p.languages));
        setStrengthCities(p.strength_cities || "");
        setVideoUrl(p.video_url || "");
        const specs = parseCsvList(p.specialties);
        setSpecialties(
          specs.filter((s) =>
            (SPECIALTY_PRESETS as readonly string[]).includes(s)
          )
        );
        setCustomSpecialties(
          specs
            .filter(
              (s) => !(SPECIALTY_PRESETS as readonly string[]).includes(s)
            )
            .join(", ")
        );
        setBankName(p.bank_name || "");
        setBankBranch(p.bank_branch || "");
        setAccountType(p.account_type || "");
        setAccountHolder(p.account_holder || "");
        setAccountNumber(p.account_number || "");
        setLegacyBankInfo(p.bank_info || "");
        setGuidingTenure(p.guiding_tenure || "");
        setBaseLocation(p.base_location || "");
        setLanguageFluency(parseLanguageFluency(p.language_fluency));
        setStrengthRegions(parseCsvList(p.strength_regions));
        setTourSpecialties(parseCsvList(p.tour_specialties));
        setToursToAvoid(p.tours_to_avoid || "");
        setPreferredClients(parseCsvList(p.preferred_clients));
        setChallengingClients(p.challenging_clients || "");
        setSkillStorytelling(
          p.skill_storytelling ? String(p.skill_storytelling) : ""
        );
        setSkillLogistics(p.skill_logistics ? String(p.skill_logistics) : "");
        setSkillProblemSolving(
          p.skill_problem_solving ? String(p.skill_problem_solving) : ""
        );
        setSkillKidsPatience(
          p.skill_kids_patience ? String(p.skill_kids_patience) : ""
        );
        setSkillConflictResolution(
          p.skill_conflict_resolution
            ? String(p.skill_conflict_resolution)
            : ""
        );
        setSkillStamina(p.skill_stamina ? String(p.skill_stamina) : "");
        setBiggestStrength(p.biggest_strength || "");
        setImprovementAreas(p.improvement_areas || "");
        setEarlyStarts(p.early_starts || "");
        setFullDayTours(p.full_day_tours || "");
        setPhysicalLimitations(p.physical_limitations || "");

        // Prefer guides.phone_number when staff_profiles.phone is empty.
        try {
          const g = await getGuideByStaff(pb, effectiveStaffId);
          if (g) {
            setGuideRow(g);
            if (!String(p.phone || "").trim() && g.phone_number) {
              setPhone(String(g.phone_number));
            }
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
    combineStaffDisplayName(firstName, lastName) || seedName || "Guide";
  const cityLabel =
    String(guideRow?.city_of_operation || "").trim() ||
    strengthCities
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)[0] ||
    "Japan";
  const jlpt = String(guideRow?.japanese_jlpt_level || "").trim();

  const videoSrc = (() => {
    const url = videoUrl.trim();
    if (url) return url;
    if (profile?.video) {
      try {
        return getClient().files.getURL(
          profile as never,
          String(profile.video)
        );
      } catch {
        return "";
      }
    }
    return "";
  })();

  /** Upload an already-prepared avatar file → save immediately. */
  const uploadAvatarFile = async (file: File) => {
    if (readOnly || !realStaffId || realStaffId !== effectiveStaffId) return;
    const token = getClient().authStore.token;
    const { photo } = await uploadStaffAvatarViaApi(token, realStaffId, file);
    setProfile((prev) =>
      prev ? { ...prev, photo, updated: String(Date.now()) } : prev
    );
    try {
      await uploadToVps(file, "profiles", token);
    } catch {
      /* PB avatar remains source of truth if VPS mirror fails */
    }
    setMsg("Profile photo updated.");
  };

  const closeAvatarCropper = () => {
    if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
    setCropImageSrc(null);
  };

  /**
   * Crop modal save: square-crop on canvas (no portrait re-crop) → upload.
   * The cropped file is already 480×480, so it must NOT go through
   * optimizeCredentialPhoto.
   */
  const handleSaveCrop = async (pixels: CroppedAreaPixels) => {
    if (!cropImageSrc) return;
    setAvatarBusy(true);
    setMsg(null);
    setError(null);
    try {
      const file = await getCroppedSquareFile(cropImageSrc, pixels);
      await uploadAvatarFile(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Photo could not be saved.");
    } finally {
      URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc(null);
      setAvatarBusy(false);
    }
  };

  /** Cover camera button: upload to /uploads/profiles → save cover_url. */
  const onCoverPick = async (file: File) => {
    if (readOnly || !realStaffId || realStaffId !== effectiveStaffId) return;
    setCoverBusy(true);
    setMsg(null);
    setError(null);
    try {
      const token = getClient().authStore.token;
      const { url } = await uploadToVps(file, "profiles", token);
      const updated = await saveStaffCredentialViaApi(token, realStaffId, {
        cover_url: url,
      });
      setProfile(updated);
      setMsg("Cover photo updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cover could not be saved.");
    } finally {
      setCoverBusy(false);
    }
  };

  const saveVideo = async () => {
    if (readOnly) {
      setMsg("Alias preview is read-only — exit disguise to edit your profile.");
      return;
    }
    if (!realStaffId || realStaffId !== effectiveStaffId) {
      setMsg("Sign in as yourself to save profile.");
      return;
    }
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const pb = getClient();
      const token = pb.authStore.token;
      let updated = await saveStaffCredentialViaApi(token, realStaffId, {
        video_url: videoUrl.trim(),
      });
      if (videoFile) {
        updated = await updateStaffProfile(pb, realStaffId, {}, {
          video: videoFile,
        });
        setVideoFile(null);
      }
      setProfile(updated);
      setEditing(null);
      setMsg("Intro video saved.");
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (readOnly) {
      setMsg("Alias preview is read-only — exit disguise to edit your profile.");
      return;
    }
    if (!realStaffId || realStaffId !== effectiveStaffId) {
      setMsg("Sign in as yourself to save profile.");
      return;
    }
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const pb = getClient();
      const token = pb.authStore.token;
      const firstTrim = firstName.trim();
      const lastTrim = lastName.trim();
      const nameTrim = combineStaffDisplayName(firstTrim, lastTrim);
      if (!firstTrim) throw new Error("First name is required.");

      const structuredBank = [
        bankName.trim(),
        bankBranch.trim(),
        accountType.trim(),
        accountNumber.trim(),
        accountHolder.trim(),
      ];
      const hasStructuredBank = structuredBank.some(Boolean);
      const updated = await saveStaffCredentialViaApi(token, realStaffId, {
        first_name: firstTrim,
        last_name: lastTrim,
        display_name: nameTrim,
        staff_name: nameTrim,
        phone: phone.trim(),
        bio: bio.trim(),
        languages: serializeStaffLanguages(languages),
        strength_cities: strengthCities.trim(),
        specialties: [
          ...specialties,
          ...parseCsvList(customSpecialties),
        ].join(", "),
        bank_name: bankName.trim(),
        bank_branch: bankBranch.trim(),
        account_type: accountType.trim(),
        account_holder: accountHolder.trim(),
        account_number: accountNumber.trim(),
        // Keep the legacy free-text bank_info (used by /profile & Ops)
        // composed from the structured fields so both views agree.
        ...(hasStructuredBank
          ? { bank_info: structuredBank.filter(Boolean).join(" · ") }
          : {}),
        guiding_tenure: guidingTenure,
        base_location: baseLocation.trim(),
        language_fluency: JSON.stringify(
          Object.fromEntries(
            Object.entries(languageFluency).filter(
              ([, rating]) => Number(rating) > 0
            )
          )
        ),
        strength_regions: strengthRegions.join(", "),
        tour_specialties: tourSpecialties.join(", "),
        tours_to_avoid: toursToAvoid.trim(),
        preferred_clients: preferredClients.join(", "),
        challenging_clients: challengingClients.trim(),
        skill_storytelling: Math.max(
          0,
          Math.round(Number(skillStorytelling) || 0)
        ),
        skill_logistics: Math.max(0, Math.round(Number(skillLogistics) || 0)),
        skill_problem_solving: Math.max(
          0,
          Math.round(Number(skillProblemSolving) || 0)
        ),
        skill_kids_patience: Math.max(
          0,
          Math.round(Number(skillKidsPatience) || 0)
        ),
        skill_conflict_resolution: Math.max(
          0,
          Math.round(Number(skillConflictResolution) || 0)
        ),
        skill_stamina: Math.max(0, Math.round(Number(skillStamina) || 0)),
        biggest_strength: biggestStrength.trim(),
        improvement_areas: improvementAreas.trim(),
        early_starts: earlyStarts,
        full_day_tours: fullDayTours,
        physical_limitations: physicalLimitations.trim(),
      });

      // Keep guides desk fields in sync when a guide row exists.
      try {
        const g = await getGuideByStaff(pb, realStaffId);
        if (g) {
          await updateGuideProfile(pb, g.id, {
            full_name: nameTrim || g.full_name,
            phone_number: phone.trim(),
            main_tour_languages: languages,
            ...(seedEmail ? { email: seedEmail } : {}),
          });
        }
      } catch {
        /* guide row optional for profile tab */
      }

      setProfile(updated);
      setEditing(null);
      setMsg("Profile saved.");
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

  const inputCls =
    "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white";
  const labelCls =
    "block text-xs tracking-wider text-zinc-500 uppercase";

  const identityBadges: Array<{ label: string; cls: string }> = [
    { label: "TokioTours Guide", cls: "bg-[#0080A3]/15 text-[#7dd3fc]" },
    { label: cityLabel, cls: "bg-white/5 text-zinc-300" },
    ...(jlpt ? [{ label: `Japanese ${jlpt}`, cls: "bg-white/5 text-zinc-300" }] : []),
    ...(languages.length > 0
      ? [
          {
            label: languages.slice(0, 2).join(" · "),
            cls: "bg-white/5 text-zinc-300",
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-2xl pb-6">
      {/* ── Cover banner ─────────────────────────────── */}
      <div className="relative h-48 overflow-hidden rounded-t-2xl bg-[linear-gradient(120deg,#075473_0%,#0D141C_55%,#3a2a08_100%)] sm:h-56">
        {profile?.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.cover_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : null}
        {!readOnly ? (
          <label
            className="absolute right-4 bottom-4 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black/60 text-zinc-200 transition hover:bg-black/85"
            title="Change cover photo"
          >
            {coverBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={coverBusy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void onCoverPick(f);
              }}
            />
          </label>
        ) : null}
      </div>

      {/* ── Overlapping avatar + identity ────────────── */}
      <div className="relative px-5">
        <div className="relative -mt-12 inline-block">
          <span className="block h-24 w-24 overflow-hidden rounded-full border-4 border-[#0B0F14] bg-zinc-800">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt={displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl font-black text-zinc-300">
                {displayName.charAt(0).toUpperCase() || "G"}
              </span>
            )}
          </span>
          {!readOnly ? (
            <label
              className="absolute right-0 bottom-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black text-zinc-200 transition hover:bg-zinc-800"
              title="Change profile photo"
            >
              {avatarBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={avatarBusy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) setCropImageSrc(URL.createObjectURL(f));
                }}
              />
            </label>
          ) : null}
        </div>

        <h2 className="mt-3 text-2xl font-black text-white">{displayName}</h2>
        {seedEmail ? (
          <p className="mt-0.5 text-xs text-zinc-500">{seedEmail}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
          {identityBadges.map((b) => (
            <span key={b.label} className={`rounded-md px-2 py-1 ${b.cls}`}>
              {b.label}
            </span>
          ))}
        </div>
        {readOnly ? (
          <p className="mt-2 text-xs text-amber-400">
            Disguise preview — read-only.
          </p>
        ) : null}
      </div>

      {/* ── Pill tabs ────────────────────────────────── */}
      <div className="mt-6 flex gap-2 overflow-x-auto px-5 pb-1">
        {(
          [
            ["about", "All / About"],
            ["video", "30s Intro Video"],
            ["badges", "Badges & Reviews"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setProfileTab(id)}
            className={`rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap transition ${
              profileTab === id
                ? "bg-white text-black"
                : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="px-5 pt-3 text-sm text-red-400">{error}</p>
      ) : null}
      {msg ? <p className="px-5 pt-3 text-sm text-[#7dd3fc]">{msg}</p> : null}

      {/* ── Tab panels ───────────────────────────────── */}
      {profileTab === "about" ? (
        <div className="space-y-4 px-5 pt-5">
          <ProfileReadSection
            title="Personal Details"
            isEditing={editing === "personal"}
            readOnly={readOnly}
            saving={saving}
            onEdit={() => setEditing("personal")}
            onCancel={() => setEditing(null)}
            onSave={() => void save()}
            editForm={
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={labelCls}>
                    First name
                    <input
                      className={inputCls}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      autoComplete="given-name"
                    />
                  </label>
                  <label className={labelCls}>
                    Last name
                    <input
                      className={inputCls}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      autoComplete="family-name"
                    />
                  </label>
                  <label className={`${labelCls} sm:col-span-2`}>
                    WhatsApp / phone
                    <input
                      className={inputCls}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+81…"
                    />
                  </label>
                </div>
              </>
            }
          >
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-zinc-500">WhatsApp/Phone: </span>
                <span className="text-white">{phone || "—"}</span>
              </p>
              <p>
                <span className="text-zinc-500">Location: </span>
                <span className="text-white">
                  {strengthCities || cityLabel}
                </span>
              </p>
              {seedEmail ? (
                <p>
                  <span className="text-zinc-500">Email: </span>
                  <span className="text-white">{seedEmail}</span>
                </p>
              ) : null}
            </div>
          </ProfileReadSection>

          <ProfileReadSection
            title="Bio & Intro"
            isEditing={editing === "bio"}
            readOnly={readOnly}
            saving={saving}
            onEdit={() => setEditing("bio")}
            onCancel={() => setEditing(null)}
            onSave={() => void save()}
            editForm={
              <label className={labelCls}>
                Bio
                <textarea
                  className={inputCls}
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </label>
            }
          >
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-zinc-200">
              {bio || (
                <span className="text-zinc-500">
                  No bio yet — tap the pen to introduce yourself to guests.
                </span>
              )}
            </p>
          </ProfileReadSection>

          <ProfileReadSection
            title="Languages"
            isEditing={editing === "languages"}
            readOnly={readOnly}
            saving={saving}
            onEdit={() => setEditing("languages")}
            onCancel={() => setEditing(null)}
            onSave={() => void save()}
            editForm={
              <LanguagePills
                selected={languages}
                disabled={readOnly}
                onToggle={(l) =>
                  setLanguages((prev) =>
                    prev.includes(l)
                      ? prev.filter((x) => x !== l)
                      : [...prev, l]
                  )
                }
              />
            }
          >
            {languages.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {languages.map((l) => (
                  <span
                    key={l}
                    className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white"
                  >
                    {l}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No languages set yet.</p>
            )}
          </ProfileReadSection>

          <ProfileReadSection
            title="Strength Cities"
            isEditing={editing === "cities"}
            readOnly={readOnly}
            saving={saving}
            onEdit={() => setEditing("cities")}
            onCancel={() => setEditing(null)}
            onSave={() => void save()}
            editForm={
              <label className={labelCls}>
                Cities (comma separated)
                <input
                  className={inputCls}
                  value={strengthCities}
                  onChange={(e) => setStrengthCities(e.target.value)}
                  placeholder="Tokyo, Kyoto…"
                />
              </label>
            }
          >
            <p className="text-sm text-white">
              {strengthCities || (
                <span className="text-zinc-500">No strength cities set yet.</span>
              )}
            </p>
          </ProfileReadSection>

          <ProfileReadSection
            title="Specialties & Niches"
            isEditing={editing === "specialties"}
            readOnly={readOnly}
            saving={saving}
            onEdit={() => setEditing("specialties")}
            onCancel={() => setEditing(null)}
            onSave={() => void save()}
            editForm={
              <>
                <div className="flex flex-wrap gap-2">
                  {SPECIALTY_PRESETS.map((s) => {
                    const active = specialties.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() =>
                          setSpecialties((prev) =>
                            active
                              ? prev.filter((x) => x !== s)
                              : [...prev, s]
                          )
                        }
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                          active
                            ? "border border-[#0080A3]/50 bg-[#0080A3]/25 text-[#7dd3fc]"
                            : "border border-white/10 bg-black/40 text-zinc-400 hover:text-white"
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
                <label className={labelCls}>
                  Other (comma separated)
                  <input
                    className={inputCls}
                    value={customSpecialties}
                    onChange={(e) => setCustomSpecialties(e.target.value)}
                    placeholder="Tea ceremony, Baseball…"
                  />
                </label>
              </>
            }
          >
            {specialties.length > 0 || customSpecialties.trim() ? (
              <div className="flex flex-wrap gap-2">
                {[...specialties, ...parseCsvList(customSpecialties)].map(
                  (s) => (
                    <span
                      key={s}
                      className="rounded-xl border border-[#0080A3]/30 bg-[#0080A3]/10 px-3 py-1 text-xs font-bold text-[#7dd3fc]"
                    >
                      {s}
                    </span>
                  )
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">
                No specialties set (e.g., Otaku, Food, History).
              </p>
            )}
          </ProfileReadSection>

          <ProfileReadSection
            title="Guiding Background"
            isEditing={editing === "guiding-background"}
            readOnly={readOnly}
            saving={saving}
            onEdit={() => setEditing("guiding-background")}
            onCancel={() => setEditing(null)}
            onSave={() => void save()}
            editForm={
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelCls}>
                  Guiding tenure
                  <select
                    className={inputCls}
                    value={guidingTenure}
                    onChange={(e) => setGuidingTenure(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {GUIDING_TENURE_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelCls}>
                  Base location
                  <input
                    className={inputCls}
                    value={baseLocation}
                    onChange={(e) => setBaseLocation(e.target.value)}
                    placeholder="Shinjuku, Tokyo"
                  />
                </label>
              </div>
            }
          >
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-zinc-500">Guiding tenure: </span>
                <span className="text-white">{guidingTenure || "—"}</span>
              </p>
              <p>
                <span className="text-zinc-500">Base location: </span>
                <span className="text-white">{baseLocation || "—"}</span>
              </p>
              {!guidingTenure ? (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-400">
                  ⚠️ Guiding tenure is required — tap the pen to add how long
                  you have been guiding.
                </div>
              ) : null}
            </div>
          </ProfileReadSection>

          <ProfileReadSection
            title="Language Fluency"
            isEditing={editing === "language-fluency"}
            readOnly={readOnly}
            saving={saving}
            onEdit={() => {
              setAddingFluency(false);
              setEditing("language-fluency");
            }}
            onCancel={() => {
              setAddingFluency(false);
              setEditing(null);
            }}
            onSave={() => void save()}
            editForm={
              <div className="space-y-3">
                {Object.entries(languageFluency).filter(
                  ([, r]) => r > 0
                ).length === 0 && !addingFluency ? (
                  <p className="text-xs text-zinc-500">
                    No languages added yet.
                  </p>
                ) : null}

                {/* Only languages the guide has added — no static list */}
                {Object.entries(languageFluency)
                  .filter(([, r]) => r > 0)
                  .map(([lang, rating]) => (
                    <div
                      key={lang}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/40 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold tracking-wide text-white uppercase">
                          {lang}
                        </span>
                        <select
                          value={String(rating)}
                          onChange={(e) =>
                            setLanguageFluency((prev) => ({
                              ...prev,
                              [lang]: Number(e.target.value) || rating,
                            }))
                          }
                          className="rounded border border-white/20 bg-black/40 px-2 py-1 text-xs font-bold text-amber-400"
                          aria-label={`${lang} rating`}
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n} / 5
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setLanguageFluency((prev) => {
                            const next = { ...prev };
                            delete next[lang];
                            return next;
                          })
                        }
                        className="text-xs font-bold text-red-400 transition hover:text-red-300"
                      >
                        ✕ Remove
                      </button>
                    </div>
                  ))}

                {addingFluency ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#0080A3]/30 bg-[#0080A3]/10 p-3">
                    <select
                      value={newFluencyLang}
                      onChange={(e) => setNewFluencyLang(e.target.value)}
                      className="flex-1 rounded border border-white/20 bg-black/40 p-2 text-xs text-white"
                      aria-label="New language"
                    >
                      {FLUENCY_LANGUAGES.filter(
                        (l) => !(languageFluency[l] > 0)
                      ).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <select
                      value={newFluencyRating}
                      onChange={(e) => setNewFluencyRating(e.target.value)}
                      className="w-20 rounded border border-white/20 bg-black/40 p-2 text-xs text-white"
                      aria-label="New language rating"
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const lang =
                          newFluencyLang ||
                          FLUENCY_LANGUAGES.find(
                            (l) => !(languageFluency[l] > 0)
                          ) ||
                          "";
                        if (lang && !(languageFluency[lang] > 0)) {
                          setLanguageFluency((prev) => ({
                            ...prev,
                            [lang]: Math.min(
                              5,
                              Math.max(1, Number(newFluencyRating) || 3)
                            ),
                          }));
                        }
                        setAddingFluency(false);
                      }}
                      className="rounded bg-[#0080A3] px-3 py-2 text-xs font-bold text-white"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddingFluency(false)}
                      className="px-2 py-2 text-xs text-zinc-400 transition hover:text-white"
                      aria-label="Cancel adding language"
                    >
                      ✕
                    </button>
                  </div>
                ) : FLUENCY_LANGUAGES.some(
                    (l) => !(languageFluency[l] > 0)
                  ) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setNewFluencyLang(
                        FLUENCY_LANGUAGES.find(
                          (l) => !(languageFluency[l] > 0)
                        ) || ""
                      );
                      setNewFluencyRating("3");
                      setAddingFluency(true);
                    }}
                    className="w-full rounded-xl border border-dashed border-white/20 py-3 text-xs font-bold text-zinc-400 transition hover:bg-white/5 hover:text-white"
                  >
                    + Add Language
                  </button>
                ) : (
                  <p className="text-xs text-zinc-500">
                    All available languages added.
                  </p>
                )}
              </div>
            }
          >
            {Object.entries(languageFluency).filter(
              ([, rating]) => rating > 0
            ).length > 0 ? (
              <div className="space-y-2 text-sm">
                {Object.entries(languageFluency)
                  .filter(([, rating]) => rating > 0)
                  .map(([lang, rating]) => (
                    <div
                      key={lang}
                      className="flex justify-between border-b border-white/5 pb-2 last:border-0 last:pb-0"
                    >
                      <span className="text-zinc-400">{lang}</span>
                      <span className="font-bold text-white">{rating} / 5</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">
                No fluency ratings set yet.
              </p>
            )}
          </ProfileReadSection>

          <ProfileReadSection
            title="Strength Regions (Kanto)"
            isEditing={editing === "strength-regions"}
            readOnly={readOnly}
            saving={saving}
            onEdit={() => setEditing("strength-regions")}
            onCancel={() => setEditing(null)}
            onSave={() => void save()}
            editForm={
              <div className="flex flex-wrap gap-2">
                {STRENGTH_REGION_OPTIONS.map((region) => {
                  const active = strengthRegions.includes(region);
                  return (
                    <button
                      key={region}
                      type="button"
                      onClick={() =>
                        toggleCsvSelection(setStrengthRegions, region)
                      }
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                        active
                          ? "border border-emerald-500/50 bg-emerald-500/25 text-emerald-300"
                          : "border border-white/10 bg-black/40 text-zinc-400 hover:text-white"
                      }`}
                    >
                      📍 {region}
                    </button>
                  );
                })}
              </div>
            }
          >
            {strengthRegions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {strengthRegions.map((region) => (
                  <span
                    key={region}
                    className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300"
                  >
                    📍 {region}
                  </span>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-400">
                ⚠️ Required — tap the pen to select the Kanto regions you know
                best.
              </div>
            )}
          </ProfileReadSection>

          <ProfileReadSection
            title="Tour Type Preferences"
            isEditing={editing === "tour-type-preferences"}
            readOnly={readOnly}
            saving={saving}
            onEdit={() => setEditing("tour-type-preferences")}
            onCancel={() => setEditing(null)}
            onSave={() => void save()}
            editForm={
              <>
                <div>
                  <p className={labelCls}>Most enjoyable tours</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {TOUR_SPECIALTY_OPTIONS.map((s) => {
                      const active = tourSpecialties.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() =>
                            toggleCsvSelection(setTourSpecialties, s)
                          }
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                            active
                              ? "border border-[#0080A3]/50 bg-[#0080A3]/25 text-[#7dd3fc]"
                              : "border border-white/10 bg-black/40 text-zinc-400 hover:text-white"
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <label className={labelCls}>
                  Tours to avoid
                  <textarea
                    className={inputCls}
                    rows={3}
                    value={toursToAvoid}
                    onChange={(e) => setToursToAvoid(e.target.value)}
                    placeholder="Tours you would prefer not to lead…"
                  />
                </label>
              </>
            }
          >
            <div className="space-y-3 text-sm">
              <div>
                <p className="mb-2 text-xs tracking-wider text-zinc-500 uppercase">
                  Most Enjoyable Tours
                </p>
                {tourSpecialties.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {tourSpecialties.map((s) => (
                      <span
                        key={s}
                        className="rounded-xl border border-[#0080A3]/30 bg-[#0080A3]/10 px-3 py-1 text-xs font-bold text-[#7dd3fc]"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-500">None selected yet.</p>
                )}
              </div>
              <div>
                <p className="mb-1 text-xs tracking-wider text-zinc-500 uppercase">
                  Tours to avoid
                </p>
                {toursToAvoid ? (
                  <p className="whitespace-pre-wrap text-red-300">
                    {toursToAvoid}
                  </p>
                ) : (
                  <p className="text-zinc-500">None specified.</p>
                )}
              </div>
            </div>
          </ProfileReadSection>

          <ProfileReadSection
            title="Client Compatibility"
            isEditing={editing === "client-compatibility"}
            readOnly={readOnly}
            saving={saving}
            onEdit={() => setEditing("client-compatibility")}
            onCancel={() => setEditing(null)}
            onSave={() => void save()}
            editForm={
              <>
                <div>
                  <p className={labelCls}>Preferred clients</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {PREFERRED_CLIENT_OPTIONS.map((c) => {
                      const active = preferredClients.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() =>
                            toggleCsvSelection(setPreferredClients, c)
                          }
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold tracking-wide uppercase transition ${
                            active
                              ? "border border-purple-500/50 bg-purple-500/25 text-purple-200"
                              : "border border-white/10 bg-black/40 text-zinc-400 hover:text-white"
                          }`}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <label className={labelCls}>
                  Challenging clients
                  <textarea
                    className={inputCls}
                    rows={3}
                    value={challengingClients}
                    onChange={(e) => setChallengingClients(e.target.value)}
                    placeholder="Client situations you find challenging…"
                  />
                </label>
              </>
            }
          >
            <div className="space-y-3 text-sm">
              <div>
                <p className="mb-2 text-xs tracking-wider text-zinc-500 uppercase">
                  Preferred clients
                </p>
                {preferredClients.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {preferredClients.map((c) => (
                      <span
                        key={c}
                        className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-bold tracking-wide text-purple-200 uppercase"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-500">None selected yet.</p>
                )}
              </div>
              <div>
                <p className="mb-1 text-xs tracking-wider text-zinc-500 uppercase">
                  Challenging clients
                </p>
                {challengingClients ? (
                  <p className="whitespace-pre-wrap text-zinc-200">
                    {challengingClients}
                  </p>
                ) : (
                  <p className="text-zinc-500">None specified.</p>
                )}
              </div>
            </div>
          </ProfileReadSection>

          <ProfileReadSection
            title="Logistics & Stamina"
            isEditing={editing === "logistics-stamina"}
            readOnly={readOnly}
            saving={saving}
            onEdit={() => setEditing("logistics-stamina")}
            onCancel={() => setEditing(null)}
            onSave={() => void save()}
            editForm={
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={labelCls}>
                    Early Starts (&lt;7AM)
                    <select
                      className={inputCls}
                      value={earlyStarts}
                      onChange={(e) => setEarlyStarts(e.target.value)}
                    >
                      <option value="">Not specified</option>
                      {AVAILABILITY_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelCls}>
                    Full-Day Tours (8h+)
                    <select
                      className={inputCls}
                      value={fullDayTours}
                      onChange={(e) => setFullDayTours(e.target.value)}
                    >
                      <option value="">Not specified</option>
                      {AVAILABILITY_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className={labelCls}>
                  Physical Limitations
                  <textarea
                    className={inputCls}
                    rows={3}
                    value={physicalLimitations}
                    onChange={(e) => setPhysicalLimitations(e.target.value)}
                    placeholder="Any physical limitations Ops should know about…"
                  />
                </label>
              </>
            }
          >
            <div className="space-y-3 text-sm">
              <div className="space-y-3 rounded-xl border border-white/5 bg-black/40 p-3 font-mono">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-zinc-500">Early Starts (&lt;7AM):</span>
                  <span
                    className={`font-bold ${
                      earlyStarts === "Yes"
                        ? "text-emerald-400"
                        : earlyStarts
                          ? "text-amber-400"
                          : "text-zinc-400"
                    }`}
                  >
                    {earlyStarts || "Not specified"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Full-Day Tours (8h+):</span>
                  <span
                    className={`font-bold ${
                      fullDayTours === "Yes"
                        ? "text-emerald-400"
                        : fullDayTours
                          ? "text-amber-400"
                          : "text-zinc-400"
                    }`}
                  >
                    {fullDayTours || "Not specified"}
                  </span>
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs tracking-wider text-zinc-500 uppercase">
                  Physical Limitations
                </p>
                {physicalLimitations ? (
                  <p className="whitespace-pre-wrap text-zinc-200">
                    {physicalLimitations}
                  </p>
                ) : (
                  <p className="text-zinc-500">None specified.</p>
                )}
              </div>
            </div>
          </ProfileReadSection>

          <ProfileReadSection
            title="Self-Assessment (1-5)"
            isEditing={editing === "self-assessment"}
            readOnly={readOnly}
            saving={saving}
            onEdit={() => setEditing("self-assessment")}
            onCancel={() => setEditing(null)}
            onSave={() => void save()}
            editForm={
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["Storytelling", skillStorytelling, setSkillStorytelling],
                    ["Logistics", skillLogistics, setSkillLogistics],
                    [
                      "Problem Solving",
                      skillProblemSolving,
                      setSkillProblemSolving,
                    ],
                    [
                      "Kids Patience",
                      skillKidsPatience,
                      setSkillKidsPatience,
                    ],
                    [
                      "Difficult Clients",
                      skillConflictResolution,
                      setSkillConflictResolution,
                    ],
                    ["Stamina", skillStamina, setSkillStamina],
                  ] as const
                ).map(([label, value, setter]) => (
                  <label key={label} className={labelCls}>
                    {label} (1–5)
                    <select
                      className={inputCls}
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                    >
                      <option value="">Not rated</option>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n} / 5
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-3 text-sm">
              {(
                [
                  ["Storytelling", skillStorytelling],
                  ["Logistics", skillLogistics],
                  ["Problem Solving", skillProblemSolving],
                  ["Kids Patience", skillKidsPatience],
                  ["Difficult Clients", skillConflictResolution],
                  ["Stamina", skillStamina],
                ] as const
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/5 bg-black/40 p-3"
                >
                  <p className="text-xs tracking-wider text-zinc-500 uppercase">
                    {label}
                  </p>
                  <p className="mt-1 font-bold text-white">
                    {value ? `${value} / 5` : "- / 5"}
                  </p>
                </div>
              ))}
            </div>
          </ProfileReadSection>

          <ProfileReadSection
            title="Strengths & Growth"
            isEditing={editing === "strengths-growth"}
            readOnly={readOnly}
            saving={saving}
            onEdit={() => setEditing("strengths-growth")}
            onCancel={() => setEditing(null)}
            onSave={() => void save()}
            editForm={
              <>
                <label className={labelCls}>
                  Biggest strength
                  <textarea
                    className={inputCls}
                    rows={3}
                    value={biggestStrength}
                    onChange={(e) => setBiggestStrength(e.target.value)}
                  />
                </label>
                <label className={labelCls}>
                  Improvement areas
                  <textarea
                    className={inputCls}
                    rows={3}
                    value={improvementAreas}
                    onChange={(e) => setImprovementAreas(e.target.value)}
                  />
                </label>
              </>
            }
          >
            <div className="space-y-3 text-sm">
              <div>
                <p className="mb-1 text-xs tracking-wider text-zinc-500 uppercase">
                  Biggest strength
                </p>
                {biggestStrength ? (
                  <p className="whitespace-pre-wrap text-zinc-200">
                    {biggestStrength}
                  </p>
                ) : (
                  <p className="text-zinc-500">Not specified yet.</p>
                )}
              </div>
              <div>
                <p className="mb-1 text-xs tracking-wider text-zinc-500 uppercase">
                  Improvement areas
                </p>
                {improvementAreas ? (
                  <p className="whitespace-pre-wrap text-zinc-200">
                    {improvementAreas}
                  </p>
                ) : (
                  <p className="text-zinc-500">Not specified yet.</p>
                )}
              </div>
            </div>
          </ProfileReadSection>

          <ProfileReadSection
            title="Banking & Payout Details"
            isEditing={editing === "banking"}
            readOnly={readOnly}
            saving={saving}
            onEdit={() => setEditing("banking")}
            onCancel={() => setEditing(null)}
            onSave={() => void save()}
            editForm={
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelCls}>
                  Bank name
                  <input
                    className={inputCls}
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Mizuho Bank"
                  />
                </label>
                <label className={labelCls}>
                  Branch name / code
                  <input
                    className={inputCls}
                    value={bankBranch}
                    onChange={(e) => setBankBranch(e.target.value)}
                    placeholder="Shibuya (123)"
                  />
                </label>
                <label className={labelCls}>
                  Account type
                  <select
                    className={inputCls}
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
                  >
                    <option value="">Select…</option>
                    <option value="Ordinary (Futsu)">Ordinary (Futsu)</option>
                    <option value="Savings (Teiki)">Savings (Teiki)</option>
                    <option value="Current (Toza)">Current (Toza)</option>
                  </select>
                </label>
                <label className={labelCls}>
                  Account holder
                  <input
                    className={inputCls}
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    placeholder="YAMADA TARO"
                  />
                </label>
                <label className={`${labelCls} sm:col-span-2`}>
                  Account number
                  <input
                    className={inputCls}
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="1234567"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </label>
              </div>
            }
          >
            {bankName ? (
              <div className="space-y-3 rounded-xl border border-white/5 bg-black/40 p-3 font-mono text-sm">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-zinc-500">Bank Name:</span>
                  <span className="font-bold text-white">{bankName}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-zinc-500">Branch Name/Code:</span>
                  <span className="font-bold text-white">
                    {bankBranch || "—"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-zinc-500">Account Type:</span>
                  <span className="font-bold text-white">
                    {accountType || "Ordinary (Futsu)"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-zinc-500">Account Holder:</span>
                  <span className="font-bold text-white">
                    {accountHolder || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Account Number:</span>
                  <span className="font-bold text-white">
                    {accountNumber
                      ? `••••${accountNumber.replace(/\s/g, "").slice(-4)}`
                      : "Missing"}
                  </span>
                </div>
              </div>
            ) : legacyBankInfo ? (
              <div className="rounded-xl border border-white/5 bg-black/40 p-3 font-mono text-sm text-zinc-300">
                <p className="whitespace-pre-wrap">{legacyBankInfo}</p>
                <p className="mt-2 font-sans text-xs text-zinc-500">
                  Tap the pen to split this into structured bank fields so
                  payouts can be verified.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-400">
                ⚠️ Bank details missing. Tap the pen to add your payout
                information.
              </div>
            )}
          </ProfileReadSection>

          <p className="text-xs text-zinc-500">
            Full profile tools also live at{" "}
            <Link href="/profile" className="text-[#7dd3fc] hover:underline">
              /profile
            </Link>
            .
          </p>
        </div>
      ) : profileTab === "video" ? (
        <div className="space-y-4 px-5 pt-5">
          <ProfileReadSection
            title="30s Intro Video"
            isEditing={editing === "video"}
            readOnly={readOnly}
            saving={saving}
            onEdit={() => setEditing("video")}
            onCancel={() => setEditing(null)}
            onSave={() => void saveVideo()}
            editForm={
              <>
                <label className={labelCls}>
                  Video URL
                  <input
                    className={inputCls}
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://…"
                  />
                </label>
                <label className={labelCls}>
                  Or upload a video file
                  <input
                    type="file"
                    accept="video/mp4,video/webm"
                    className="mt-1 block w-full text-xs text-zinc-400"
                    onChange={(e) => {
                      setVideoFile(e.target.files?.[0] || null);
                      e.target.value = "";
                    }}
                  />
                </label>
                {videoFile ? (
                  <p className="text-xs text-zinc-400">
                    Ready to upload: {videoFile.name}
                  </p>
                ) : null}
              </>
            }
          >
            {videoSrc ? (
              <video
                src={videoSrc}
                controls
                className="w-full rounded-xl bg-black"
              />
            ) : (
              <p className="text-sm text-zinc-500">
                No intro video yet — tap the pen to add a 30-second clip
                guests can watch before booking.
              </p>
            )}
          </ProfileReadSection>
        </div>
      ) : (
        <div className="space-y-4 px-5 pt-5">
          <section className="rounded-2xl border border-white/10 bg-[#0D141C] p-5">
            <h3 className="mb-3 border-b border-white/5 pb-2 text-xs font-bold tracking-widest text-zinc-400 uppercase">
              Badges
            </h3>
            <div className="flex flex-wrap gap-2">
              {identityBadges.map((b) => (
                <span
                  key={b.label}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${b.cls}`}
                >
                  {b.label}
                </span>
              ))}
              {languages.map((l) => (
                <span
                  key={`lang-${l}`}
                  className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-bold text-zinc-300"
                >
                  {l}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#0D141C] p-5">
            <h3 className="mb-3 border-b border-white/5 pb-2 text-xs font-bold tracking-widest text-zinc-400 uppercase">
              Reviews
            </h3>
            <p className="text-sm text-zinc-500">
              No guest reviews yet — reviews from your completed tours will
              appear here.
            </p>
          </section>
        </div>
      )}

      {cropImageSrc ? (
        <AvatarCropperModal
          imageSrc={cropImageSrc}
          saving={avatarBusy}
          onCancel={closeAvatarCropper}
          onSaveCrop={(pixels) => void handleSaveCrop(pixels)}
        />
      ) : null}
    </div>
  );
}

/** Read-first profile block with an inline edit pen (✏ toggles the form). */
function ProfileReadSection({
  title,
  isEditing,
  readOnly,
  saving,
  onEdit,
  onCancel,
  onSave,
  editForm,
  children,
}: {
  title: string;
  isEditing: boolean;
  readOnly: boolean;
  saving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  editForm: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="relative rounded-2xl border border-white/10 bg-[#0D141C] p-5">
      <div className="mb-3 flex items-center justify-between border-b border-white/5 pb-2">
        <h3 className="text-xs font-bold tracking-widest text-zinc-400 uppercase">
          {title}
        </h3>
        {!readOnly && !isEditing ? (
          <button
            type="button"
            onClick={onEdit}
            title={`Edit ${title}`}
            aria-label={`Edit ${title}`}
            className="rounded-md p-1 text-zinc-500 transition hover:bg-white/5 hover:text-white"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {isEditing ? (
        <div className="space-y-3">
          {editForm}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={onSave}
              className="rounded-lg bg-[#075473] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onCancel}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-xs text-zinc-300 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
