"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import {
  filterAndScoreGuides,
  type GuideMatchBooking,
  type GuideMatchProfile,
} from "@/lib/guideMatcher";
import {
  evaluateGuideWorkload,
  type GuideDayBooking,
} from "@/lib/guideScheduleRules";

type MatchTab = "BEST" | "PARTIAL" | "ALL";

/**
 * Multi-tier smart guide picker with workload locks + assign confirmations.
 */
export function GuideSearchModal({
  pnr,
  booking,
  tourDate,
  tourHours,
  isNightTour,
  guideAlreadyConfirmed,
  allGuides,
  dayBookings,
  onClose,
  onSelectGuide,
}: {
  pnr: string;
  booking: GuideMatchBooking;
  tourDate: string;
  tourHours: number;
  isNightTour: boolean;
  /** Current booking already has an accepted guide */
  guideAlreadyConfirmed: boolean;
  allGuides: GuideMatchProfile[];
  dayBookings: GuideDayBooking[];
  onClose: () => void;
  onSelectGuide: (guideId: string) => void | Promise<void>;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<MatchTab>("BEST");
  const [pendingGuide, setPendingGuide] = useState<GuideMatchProfile | null>(
    null
  );
  const [showReassignWarning, setShowReassignWarning] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const scoredList = useMemo(
    () => filterAndScoreGuides(booking, allGuides),
    [booking, allGuides]
  );

  const workloadByGuide = useMemo(() => {
    const map = new Map<string, ReturnType<typeof evaluateGuideWorkload>>();
    for (const g of allGuides) {
      map.set(
        g.id,
        evaluateGuideWorkload({
          guideId: g.id,
          targetDateStr: tourDate,
          targetHours: tourHours,
          isTargetNightTour: isNightTour,
          existingBookings: dayBookings,
          excludePnr: pnr,
        })
      );
    }
    return map;
  }, [allGuides, tourDate, tourHours, isNightTour, dayBookings, pnr]);

  const tierCounts = useMemo(() => {
    let best = 0;
    let partial = 0;
    for (const row of scoredList) {
      if (row.matchScore >= 100) best += 1;
      else if (row.matchScore >= 50) partial += 1;
    }
    return { best, partial, all: scoredList.length };
  }, [scoredList]);

  const filteredList = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return scoredList.filter(({ guide, matchScore }) => {
      if (q) {
        const hay =
          `${guide.name} ${guide.languages.join(" ")} ${guide.phone} ${guide.email || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (activeTab === "BEST") return matchScore >= 100;
      if (activeTab === "PARTIAL") return matchScore >= 50 && matchScore < 100;
      return true;
    });
  }, [scoredList, searchTerm, activeTab]);

  const handleAssignClick = (guide: GuideMatchProfile) => {
    const workload = workloadByGuide.get(guide.id);
    if (workload && !workload.canAssign) return;
    setPendingGuide(guide);
    setShowReassignWarning(guideAlreadyConfirmed);
  };

  const handleConfirmAssignment = async () => {
    if (!pendingGuide || isExecuting) return;
    setIsExecuting(true);
    try {
      await onSelectGuide(pendingGuide.id);
    } finally {
      setIsExecuting(false);
      setPendingGuide(null);
      setShowReassignWarning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Smart guide recommendation studio"
        className="relative z-[1] flex h-[min(600px,90vh)] w-full max-w-2xl flex-col rounded-3xl border border-white/10 bg-[#0A1017] p-5 text-xs text-white shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
          <div className="min-w-0">
            <span className="text-[10px] font-bold tracking-wider text-[#F6A724] uppercase">
              Smart guide recommendation studio
            </span>
            <h2 className="truncate text-base font-bold text-white uppercase">
              Assign guide · PNR: {pnr}
            </h2>
            {tourDate ? (
              <p className="mt-0.5 text-[10px] text-zinc-500">
                Tour date {tourDate} · {tourHours}h
                {isNightTour ? " · night tour" : ""}
              </p>
            ) : (
              <p className="mt-0.5 text-[10px] text-amber-400/90">
                No tour date on hub — schedule overlap checks limited
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-gray-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search guide name, language (e.g. Dutch, English)…"
            className="w-full rounded-xl border border-white/10 bg-[#0D1117] py-2.5 pr-4 pl-9 text-xs text-white placeholder:text-gray-500 focus:border-[#075473] focus:outline-none"
          />
        </div>

        <div className="my-3 grid grid-cols-3 gap-1 rounded-xl border border-white/5 bg-black/40 p-1 text-[10px] font-bold sm:text-[11px]">
          {(
            [
              { id: "BEST" as const, label: "Best 100%", count: tierCounts.best },
              {
                id: "PARTIAL" as const,
                label: "Partial 50–99%",
                count: tierCounts.partial,
              },
              {
                id: "ALL" as const,
                label: "All / Override",
                count: tierCounts.all,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg py-2 uppercase transition-all ${
                activeTab === tab.id
                  ? "bg-[#075473] text-white shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {tab.label}
              <span className="ml-1 opacity-70">({tab.count})</span>
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
          {filteredList.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-gray-500">
              No guides in this tier. Try another tab or clear search.
            </div>
          ) : (
            filteredList.map(
              ({ guide, matchScore, disqualifications, matchTags }) => {
                const workload = workloadByGuide.get(guide.id);
                const blocked = workload ? !workload.canAssign : false;
                return (
                  <div
                    key={guide.id}
                    className={`flex items-center justify-between gap-3 rounded-2xl border p-3.5 transition ${
                      blocked
                        ? "border-red-500/20 bg-red-950/20 opacity-70"
                        : "border-white/10 bg-[#0D1117] hover:border-white/20"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-800 text-base font-bold text-white">
                        {guide.name.trim().charAt(0).toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-bold text-white">
                            {guide.name}
                          </span>
                          <span
                            className={`rounded px-2 py-0.5 text-[9px] font-bold ${
                              matchScore >= 100
                                ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
                                : matchScore >= 50
                                  ? "border border-amber-500/30 bg-amber-500/20 text-amber-300"
                                  : "border border-red-500/30 bg-red-500/20 text-red-300"
                            }`}
                          >
                            {matchScore}% match
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {guide.languages.join(", ")} · ¥
                          {guide.hourlyRateJpy.toLocaleString("en-US")}/hr
                        </div>
                        {matchScore >= 50 && matchTags.length > 0 ? (
                          <div className="text-[10px] font-medium text-emerald-400/90">
                            {matchTags.slice(0, 3).join(" · ")}
                          </div>
                        ) : null}
                        {disqualifications.length > 0 ? (
                          <div className="text-[10px] font-medium text-red-400">
                            Notes: {disqualifications.join(" · ")}
                          </div>
                        ) : null}
                        {blocked && workload?.reason ? (
                          <div className="text-[10px] font-medium text-red-400">
                            Schedule conflict: {workload.reason}
                          </div>
                        ) : workload?.reason && workload.canAssign ? (
                          <div className="text-[10px] font-medium text-cyan-400/90">
                            {workload.reason}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={blocked || isExecuting}
                      onClick={() => handleAssignClick(guide)}
                      className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold tracking-wider uppercase shadow transition active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-500 ${
                        blocked
                          ? ""
                          : "bg-[#075473] text-white hover:bg-[#054F70]"
                      }`}
                    >
                      Assign
                    </button>
                  </div>
                );
              }
            )
          )}
        </div>

        {/* Confirm assign */}
        {pendingGuide && !showReassignWarning ? (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center space-y-5 rounded-3xl bg-black/90 p-6 text-center backdrop-blur-md">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#075473] bg-[#075473]/30 text-lg font-bold text-white">
              {pendingGuide.name.trim().charAt(0).toUpperCase() || "?"}
            </div>
            <div className="max-w-md space-y-2">
              <span className="text-[10px] font-bold tracking-widest text-[#F6A724] uppercase">
                Confirm guide assignment
              </span>
              <h3 className="text-base font-bold text-white">
                Assign{" "}
                <span className="text-[#F6A724]">{pendingGuide.name}</span> to
                PNR <span className="text-cyan-300">{pnr}</span>?
              </h3>
            </div>
            <div className="flex w-full max-w-xs items-center gap-3">
              <button
                type="button"
                onClick={() => setPendingGuide(null)}
                className="flex-1 rounded-xl bg-gray-800 py-3 text-xs font-bold text-gray-300 uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isExecuting}
                onClick={() => void handleConfirmAssignment()}
                className="flex-1 rounded-xl bg-[#075473] py-3 text-xs font-bold text-white uppercase shadow-lg disabled:opacity-40"
              >
                {isExecuting ? "Assigning…" : "Yes, assign"}
              </button>
            </div>
          </div>
        ) : null}

        {/* Re-assign override when already accepted */}
        {pendingGuide && showReassignWarning ? (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center space-y-5 rounded-3xl border-2 border-red-500/50 bg-black/95 p-6 text-center backdrop-blur-md">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-red-500 bg-red-500/20 text-2xl font-bold text-red-400">
              !
            </div>
            <div className="max-w-md space-y-2">
              <span className="text-[10px] font-bold tracking-widest text-red-400 uppercase">
                Critical re-assignment warning
              </span>
              <h3 className="text-base font-bold text-white">
                The current guide has already accepted this booking.
              </h3>
              <p className="text-xs text-gray-300">
                Are you 100% sure you want to override and assign{" "}
                <span className="font-bold text-[#F6A724]">
                  {pendingGuide.name}
                </span>{" "}
                instead?
              </p>
            </div>
            <div className="flex w-full max-w-xs items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setPendingGuide(null);
                  setShowReassignWarning(false);
                }}
                className="flex-1 rounded-xl bg-gray-800 py-3 text-xs font-bold text-gray-300 uppercase"
              >
                Abort
              </button>
              <button
                type="button"
                disabled={isExecuting}
                onClick={() => void handleConfirmAssignment()}
                className="flex-1 rounded-xl bg-red-600 py-3 text-xs font-bold text-white uppercase shadow-lg hover:bg-red-500 disabled:opacity-40"
              >
                {isExecuting ? "Overriding…" : "Yes, override & assign"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
