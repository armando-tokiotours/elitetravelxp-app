"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type PocketBase from "pocketbase";
import type { OpsDispatchRow } from "@/lib/opsDispatch";
import type { OpsHubRow, StaffOption } from "@/components/staff/opsHubClient";
import type { OpsGuestRequirements } from "@/lib/opsGuestRequirements";
import {
  guideConfirmStaffLabel,
  normalizeGuideConfirmStatus,
  type GuideConfirmStatus,
} from "@/lib/guideConfirmStatus";
import {
  estimateGuidePayout,
  guideRecordToMatchProfile,
  parseTourHoursLabel,
  type GuideMatchProfile,
} from "@/lib/guideMatcher";
import {
  isNightTourHours,
  loadGuideDayBookings,
  type GuideDayBooking,
} from "@/lib/guideScheduleRules";
import { GuideAssignPayoutPanel } from "@/components/staff/GuideAssignPayoutPanel";
import { GuideSearchModal } from "@/components/staff/GuideSearchModal";
import { GuideInviteButton } from "@/components/staff/GuideInviteButton";

function statusBadgeClass(status: GuideConfirmStatus): string {
  switch (status) {
    case "guide_confirmed":
      return "border-emerald-500/40 bg-emerald-500/20 text-emerald-300";
    case "pending_guide_acceptance":
      return "border-amber-500/30 bg-amber-500/20 text-amber-300";
    case "posted_open_board":
      return "border-cyan-500/35 bg-cyan-500/15 text-cyan-200";
    case "refused":
      return "border-red-500/40 bg-red-500/15 text-red-300";
    default:
      return "border-white/10 bg-gray-800 text-gray-400";
  }
}

/**
 * Tab 3 — Guide Dispatch console.
 * Vendor share-link box removed → Search & Assign modal + open job board.
 */
export function GuideDispatchTab({
  pb,
  row,
  dispatch,
  guides,
  reqs,
  saving,
  showPayoutPanel,
  onAssignGuide,
  onPostToOpenBoard,
  onClearGuide,
}: {
  pb: PocketBase;
  row: OpsHubRow;
  dispatch?: OpsDispatchRow;
  guides: StaffOption[];
  reqs: OpsGuestRequirements | null;
  saving: boolean;
  showPayoutPanel: boolean;
  onAssignGuide: (guideStaffId: string) => Promise<void>;
  onPostToOpenBoard: () => Promise<void>;
  onClearGuide: () => Promise<void>;
}) {
  const [profiles, setProfiles] = useState<GuideMatchProfile[]>([]);
  const [dayBookings, setDayBookings] = useState<GuideDayBooking[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showBroadcastConfirm, setShowBroadcastConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingProfiles(true);
    void (async () => {
      try {
        const [rows, bookings] = await Promise.all([
          pb.collection("guides").getFullList<Record<string, unknown>>({
            requestKey: null,
          }),
          loadGuideDayBookings(pb),
        ]);
        if (cancelled) return;
        setDayBookings(bookings);
        const byStaff = new Map<string, GuideMatchProfile>();
        for (const r of rows) {
          const staff = guides.find((g) => g.id === String(r.staff || ""));
          const profile = guideRecordToMatchProfile(r, staff);
          if (profile) byStaff.set(profile.id, profile);
        }
        for (const g of guides) {
          if (byStaff.has(g.id)) continue;
          byStaff.set(g.id, {
            id: g.id,
            name: g.name || g.email || "Guide",
            phone: "—",
            email: g.email,
            languages: ["EN"],
            acceptsKids: true,
            acceptsCouples: true,
            maxGroupSize: 10,
            hourlyRateJpy: 3500,
            baseRate6hJpy: 0,
            baseRate8hJpy: 0,
            status: "AVAILABLE",
          });
        }
        setProfiles([...byStaff.values()]);
      } catch {
        if (!cancelled) {
          setDayBookings([]);
          setProfiles(
            guides.map((g) => ({
              id: g.id,
              name: g.name || g.email || "Guide",
              phone: "—",
              email: g.email,
              languages: ["EN"],
              acceptsKids: true,
              acceptsCouples: true,
              maxGroupSize: 10,
              hourlyRateJpy: 3500,
              baseRate6hJpy: 0,
              baseRate8hJpy: 0,
              status: "AVAILABLE" as const,
            }))
          );
        }
      } finally {
        if (!cancelled) setLoadingProfiles(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pb, guides, row.pnr]);

  const guideStatus = normalizeGuideConfirmStatus(dispatch?.guide_mode, {
    boardVisible: Boolean(dispatch?.guide_board_visible),
    assignedGuideId: dispatch?.assigned_guide_id,
    guideResponse: dispatch?.guide_response,
  });
  const guideConfirmed = guideStatus === "guide_confirmed";
  const guideLockedPending = guideStatus === "pending_guide_acceptance";
  const guideRefused = guideStatus === "refused";

  const bookingMatch = useMemo(
    () => ({
      language: reqs?.tourLanguage || null,
      paxAdults: reqs?.adults ?? 1,
      paxChildren: reqs?.children ?? 0,
      totalHours: parseTourHoursLabel(reqs?.durationLabel),
      couplesOnly: (reqs?.adults ?? 0) === 2 && (reqs?.children ?? 0) === 0,
    }),
    [reqs]
  );

  const tourHours = bookingMatch.totalHours || 6;
  const tourDate = String(row.tour_date || "").slice(0, 10);
  const isNightTour = isNightTourHours(tourHours, reqs?.durationLabel);
  const pnrKey = String(row.pnr || "")
    .trim()
    .toUpperCase();
  const assignedId = String(dispatch?.assigned_guide_id || "").trim();
  const assignedGuide =
    profiles.find((g) => g.id === assignedId) ||
    (assignedId
      ? {
          id: assignedId,
          name: dispatch?.assigned_guide || "Assigned guide",
          phone: "—",
          languages: [] as string[],
          acceptsKids: true,
          acceptsCouples: true,
          maxGroupSize: 10,
          hourlyRateJpy: 3500,
          baseRate6hJpy: 0,
          baseRate8hJpy: 0,
          status: "AVAILABLE" as const,
        }
      : null);

  const payout = estimateGuidePayout({
    tourHours,
    hourlyRateJpy: assignedGuide?.hourlyRateJpy,
    baseRate6hJpy: assignedGuide?.baseRate6hJpy,
    baseRate8hJpy: assignedGuide?.baseRate8hJpy,
  });

  const confirmBroadcast = async () => {
    if (processing || saving) return;
    setProcessing(true);
    try {
      await onPostToOpenBoard();
      setShowBroadcastConfirm(false);
    } finally {
      setProcessing(false);
    }
  };

  const confirmClear = async () => {
    if (processing || saving) return;
    setProcessing(true);
    try {
      await onClearGuide();
      setShowClearConfirm(false);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6 text-xs text-white">
      <div className="space-y-4 rounded-2xl border border-white/10 bg-[#0D1117] p-5">
        <div className="flex flex-col gap-2 border-b border-white/10 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-sans text-sm font-semibold tracking-wider text-[#F6A724] uppercase">
            Guide dispatch &amp; payout console
          </h2>
          <span
            className={`rounded px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase ${statusBadgeClass(guideStatus)}`}
          >
            {guideConfirmStaffLabel(guideStatus)}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-xl border border-white/5 bg-black/40 p-4 sm:grid-cols-3">
          <div>
            <span className="block text-[10px] font-bold tracking-wider text-gray-400 uppercase">
              Tour duration
            </span>
            <div className="font-mono text-sm font-bold text-white">
              {payout.tourHours} Hours
            </div>
            {reqs?.tourLanguage ? (
              <span className="mt-0.5 block text-[9px] text-zinc-500">
                Language: {reqs.tourLanguage}
              </span>
            ) : null}
          </div>
          <div>
            <span className="block text-[10px] font-bold tracking-wider text-gray-400 uppercase">
              Hourly rate
            </span>
            <div className="font-mono text-sm font-bold text-white">
              ¥{payout.hourlyRateJpy.toLocaleString("en-US")} / hr
            </div>
          </div>
          <div>
            <span className="block text-[10px] font-bold tracking-wider text-gray-400 uppercase">
              Guide payout total
            </span>
            <div className="font-mono text-base font-bold text-emerald-400">
              ¥{payout.totalPayoutJpy.toLocaleString("en-US")}{" "}
              <span className="text-xs text-gray-400">
                (~€{payout.totalPayoutEur})
              </span>
            </div>
          </div>
        </div>

        {/* Passport + Search & Assign */}
        <div className="flex flex-col items-stretch justify-between gap-4 rounded-2xl border border-white/10 bg-black/50 p-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-gray-800 text-lg font-bold text-gray-400">
              {assignedGuide?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={assignedGuide.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : assignedGuide ? (
                assignedGuide.name.trim().charAt(0).toUpperCase() || "?"
              ) : (
                "?"
              )}
            </div>
            <div className="min-w-0 space-y-0.5">
              <span className="block text-[10px] font-bold tracking-wider text-[#F6A724] uppercase">
                {assignedGuide && !guideRefused
                  ? "Assigned guide"
                  : "No guide assigned"}
              </span>
              <h3 className="truncate text-sm font-bold text-white uppercase">
                {assignedGuide && !guideRefused
                  ? assignedGuide.name
                  : "Unassigned"}
              </h3>
              <p className="truncate text-[11px] text-gray-400">
                {assignedGuide && !guideRefused
                  ? assignedGuide.phone !== "—"
                    ? assignedGuide.phone
                    : guideConfirmStaffLabel(guideStatus)
                  : loadingProfiles
                    ? "Loading guide profiles…"
                    : "Search recommendations or post to the open job board"}
              </p>
              {assignedGuide && assignedGuide.languages.length > 0 ? (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {assignedGuide.languages.map((lang) => (
                    <span
                      key={lang}
                      className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-gray-300"
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            disabled={saving || processing}
            onClick={() => setSearchOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#075473] px-5 py-3 text-xs font-bold tracking-wider text-white uppercase shadow-lg transition hover:bg-[#054F70] active:scale-95 disabled:opacity-40 sm:w-auto"
          >
            <Search className="h-3.5 w-3.5" />
            {guideConfirmed ? "Re-assign guide" : "Search & assign guide"}
          </button>
        </div>

        {guideLockedPending || guideRefused || guideConfirmed ? (
          <button
            type="button"
            disabled={saving || processing}
            onClick={() => {
              if (guideConfirmed) setShowClearConfirm(true);
              else void onClearGuide();
            }}
            className="rounded-lg border border-amber-600/50 px-3 py-1.5 text-[11px] text-amber-300 disabled:opacity-40"
          >
            {guideConfirmed ? "Clear confirmed guide…" : "Clear / reassign"}
          </button>
        ) : null}

        <button
          type="button"
          disabled={processing || saving || guideConfirmed}
          onClick={() => setShowBroadcastConfirm(true)}
          className="w-full rounded-xl bg-[#F6A724] py-3.5 text-xs font-bold tracking-wider text-black uppercase shadow-md transition hover:bg-[#F6A724]/85 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-500"
        >
          Broadcast tour to open guide job board →
        </button>

        <GuideInviteButton
          guideEmail={
            assignedGuide?.email ||
            guides.find((g) => g.id === assignedId)?.email ||
            ""
          }
          guideName={
            assignedGuide?.name ||
            guides.find((g) => g.id === assignedId)?.name ||
            "Guide"
          }
          staffId={assignedId || undefined}
        />
      </div>

      {showPayoutPanel ? (
        <div className="space-y-2 rounded-2xl border border-white/10 bg-[#0D1117] p-5">
          <div className="space-y-1">
            <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
              Guide payout snapshot (owner)
            </p>
            <p className="text-[10px] leading-relaxed text-zinc-500">
              Internal margin check: tour hours × guide rate card (JPY). Owner /
              ops only — not shown to guests.
            </p>
          </div>
          {assignedId ? (
            <GuideAssignPayoutPanel
              pb={pb}
              pnr={row.pnr}
              staffGuideId={assignedId}
              defaultHours={tourHours}
              guestCount={(reqs?.adults || 0) + (reqs?.children || 0) || 2}
            />
          ) : (
            <p className="text-xs text-zinc-500">
              Assign a guide first to set payout terms.
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">
          Guide payout snapshot is owner-only. Estimate above uses the guide
          rate card for hours × hourly JPY.
        </p>
      )}

      {searchOpen ? (
        <GuideSearchModal
          pnr={pnrKey}
          booking={bookingMatch}
          tourDate={tourDate}
          tourHours={tourHours}
          isNightTour={isNightTour}
          guideAlreadyConfirmed={guideConfirmed}
          allGuides={profiles}
          dayBookings={dayBookings}
          onClose={() => setSearchOpen(false)}
          onSelectGuide={async (guideId) => {
            await onAssignGuide(guideId);
            setSearchOpen(false);
            try {
              setDayBookings(await loadGuideDayBookings(pb));
            } catch {
              /* non-blocking */
            }
          }}
        />
      ) : null}

      {showBroadcastConfirm ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm space-y-4 rounded-3xl border border-white/10 bg-[#0A1017] p-6 text-center shadow-2xl">
            <div className="text-[10px] font-bold tracking-wider text-[#F6A724] uppercase">
              Broadcast to open roster
            </div>
            <h3 className="text-sm font-bold text-white uppercase">
              Broadcast PNR {pnrKey} to all guides?
            </h3>
            <p className="text-xs text-gray-400">
              First eligible guide to accept on the job board will take this
              tour.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowBroadcastConfirm(false)}
                className="flex-1 rounded-xl bg-gray-800 py-3 text-xs font-bold text-gray-300 uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processing || saving}
                onClick={() => void confirmBroadcast()}
                className="flex-1 rounded-xl bg-[#F6A724] py-3 text-xs font-bold text-black uppercase shadow-md disabled:opacity-40"
              >
                {processing ? "Broadcasting…" : "Yes, broadcast now"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showClearConfirm ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm space-y-4 rounded-3xl border-2 border-red-500/40 bg-[#0A1017] p-6 text-center shadow-2xl">
            <div className="text-[10px] font-bold tracking-wider text-red-400 uppercase">
              Guide already confirmed
            </div>
            <h3 className="text-sm font-bold text-white">
              Are you 100% sure you want to clear the accepted guide on PNR{" "}
              {pnrKey}?
            </h3>
            <p className="text-xs text-gray-400">
              Manual unassign only — required before freeing their day for
              another tour.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 rounded-xl bg-gray-800 py-3 text-xs font-bold text-gray-300 uppercase"
              >
                Abort
              </button>
              <button
                type="button"
                disabled={processing || saving}
                onClick={() => void confirmClear()}
                className="flex-1 rounded-xl bg-red-600 py-3 text-xs font-bold text-white uppercase shadow-md hover:bg-red-500 disabled:opacity-40"
              >
                {processing ? "Clearing…" : "Yes, clear guide"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
