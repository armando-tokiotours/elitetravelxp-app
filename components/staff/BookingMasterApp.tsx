"use client";

import { useState } from "react";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  loadBookingMasterByPnr,
  type BookingMasterBundle,
} from "@/lib/bookingMaster";
import { canAccessOpsBoard } from "@/lib/staffRoles";
import { useTeamAuth } from "@/store/useTeamAuth";
import { StaffPortalShell } from "@/components/staff/StaffPortalShell";
import { OpsStatusBadge } from "@/components/staff/opsHubClient";

type Tab = "hub" | "dispatch" | "money" | "tickets";

export function BookingMasterApp() {
  return (
    <StaffPortalShell title="Booking master" allow={canAccessOpsBoard}>
      <MasterInner />
    </StaffPortalShell>
  );
}

function MasterInner() {
  const getClient = useTeamAuth((s) => s.getClient);
  const canMoney = useTeamAuth((s) => s.role === "owner");
  const [pnrInput, setPnrInput] = useState("");
  const [tab, setTab] = useState<Tab>("hub");
  const [bundle, setBundle] = useState<BookingMasterBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadBookingMasterByPnr(getClient(), pnrInput);
      if (!data.hub && !data.dispatch && !data.money && !data.tickets) {
        setError(`No pockets found for ${data.pnr || pnrInput}`);
        setBundle(null);
      } else {
        setBundle(data);
        setTab("hub");
      }
    } catch (e) {
      setError(formatPbError(e));
      setBundle(null);
    } finally {
      setLoading(false);
    }
  };

  const tabs: Array<{ id: Tab; label: string; hide?: boolean }> = [
    { id: "hub", label: "Hub" },
    { id: "dispatch", label: "Dispatch" },
    { id: "money", label: "Money", hide: !canMoney },
    { id: "tickets", label: "Tickets" },
  ];

  return (
    <div className="space-y-4">
      <p className="max-w-xl text-sm text-zinc-400">
        Assemble Silo 3 pockets by PNR — same ID across hub, dispatch, money,
        and tickets.
      </p>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <input
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-white"
          placeholder="JPN-XXXXXX"
          value={pnrInput}
          onChange={(e) => setPnrInput(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading || !pnrInput.trim()}
          className="rounded-lg bg-[#075473] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "…" : "Load"}
        </button>
      </form>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {bundle ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-lg text-white">{bundle.pnr}</span>
            <OpsStatusBadge status={bundle.hub?.status} />
          </div>
          <div className="flex flex-wrap gap-2">
            {tabs
              .filter((t) => !t.hide)
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    tab === t.id
                      ? "bg-[#075473]/30 text-[#075473]"
                      : "border border-zinc-700 text-zinc-400"
                  }`}
                >
                  {t.label}
                </button>
              ))}
          </div>
          <pre className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs text-zinc-300">
            {JSON.stringify(
              tab === "hub"
                ? bundle.hub
                : tab === "dispatch"
                  ? bundle.dispatch
                  : tab === "money"
                    ? bundle.money
                    : bundle.tickets,
              null,
              2
            )}
          </pre>
        </>
      ) : null}
    </div>
  );
}
